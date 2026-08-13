import { Bot, Keyboard, type Context } from "grammy";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateRoleFit } from "@/lib/services/role-fit-engine";
import {
  generateInterviewQuestion,
  evaluateInterviewAnswer,
  generateInterviewEvaluation,
  shouldEndInterview,
} from "@/lib/services/interview-engine";
import { analyzeSkillGaps, askCareerCoach, generateCareerRoadmap } from "@/lib/services/career-coach";
import { optimizeResumeForJob } from "@/lib/services/resume-optimizer";
import { createNotification } from "@/lib/services/notifications";
import { formatScore, truncate, APPLICATION_STATUS_LABELS } from "@/lib/utils";
import type {
  Application,
  Job,
  ParsedResumeData,
  SkillGap,
  TelegramAccount,
} from "@/types";

interface BotSession {
  awaiting?: "coach_question" | "job_selection" | "interview_answer";
  pendingAction?: "job_fit" | "skill_gaps" | "optimize" | "roadmap";
  interviewSessionId?: string;
}

type BotContext = Context & { session: BotSession };

const sessions = new Map<number, BotSession>();

function getSession(chatId: number): BotSession {
  if (!sessions.has(chatId)) sessions.set(chatId, {});
  return sessions.get(chatId)!;
}

function clearSession(chatId: number) {
  sessions.delete(chatId);
}

function mainMenuKeyboard() {
  return new Keyboard()
    .text("My Resume").text("Job Fit").row()
    .text("Interview").text("Skill Gaps").row()
    .text("Applications").text("Resume Optimization").row()
    .text("Career Coach")
    .resized()
    .persistent();
}

async function getLinkedAccount(chatId: number): Promise<TelegramAccount | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("telegram_accounts")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .eq("status", "linked")
    .single();
  return data;
}

async function getCandidateForChat(chatId: number) {
  const account = await getLinkedAccount(chatId);
  if (!account) return null;

  const supabase = await createServiceClient();
  const { data: candidate } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", account.user_id)
    .single();

  if (!candidate) return null;
  return { account, candidate, supabase };
}

async function linkTelegramAccount(
  token: string,
  chatId: number,
  username?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServiceClient();

  const { data: account } = await supabase
    .from("telegram_accounts")
    .select("*")
    .eq("link_token", token)
    .single();

  if (!account) {
    return { ok: false, error: "Invalid link token. Generate a new one from the HireWise web app." };
  }

  if (account.link_token_expires_at && new Date(account.link_token_expires_at) < new Date()) {
    return { ok: false, error: "Link token expired. Generate a new one from Settings → Telegram in HireWise." };
  }

  const { data: chatTaken } = await supabase
    .from("telegram_accounts")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .eq("status", "linked")
    .neq("user_id", account.user_id)
    .maybeSingle();

  if (chatTaken) {
    return { ok: false, error: "This Telegram account is already linked to another HireWise user." };
  }

  const { error } = await supabase
    .from("telegram_accounts")
    .update({
      telegram_chat_id: chatId,
      telegram_username: username || null,
      status: "linked",
      linked_at: new Date().toISOString(),
      link_token: null,
      link_token_expires_at: null,
    })
    .eq("id", account.id);

  if (error) return { ok: false, error: "Failed to link account. Please try again." };

  await createNotification(
    account.user_id,
    "telegram_linked",
    "Telegram Linked",
    "Your Telegram account is now connected to HireWise AI.",
    { telegram_username: username }
  );

  return { ok: true };
}

async function requireLinked(ctx: BotContext): Promise<
  Awaited<ReturnType<typeof getCandidateForChat>>
> {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;

  const linked = await getCandidateForChat(chatId);
  if (!linked) {
    await ctx.reply(
      "Your Telegram is not linked to HireWise yet.\n\n" +
      "1. Log in at the HireWise web app\n" +
      "2. Go to Settings → Telegram\n" +
      "3. Tap the link and send /start with your token here",
      { reply_markup: { remove_keyboard: true } }
    );
  }
  return linked;
}

async function listPublishedJobs(supabase: Awaited<ReturnType<typeof createServiceClient>>, limit = 5) {
  const { data } = await supabase
    .from("jobs")
    .select("id, title, company")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

function formatJobList(jobs: { id: string; title: string; company: string }[]) {
  if (!jobs.length) return "No published jobs found.";
  return jobs.map((j, i) => `${i + 1}. ${j.title} at ${j.company}\n   ID: \`${j.id}\``).join("\n\n");
}

function createBot(): Bot<BotContext> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const bot = new Bot<BotContext>(token);

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId) {
      ctx.session = getSession(chatId);
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const payload = ctx.match?.trim();
    if (payload) {
      const result = await linkTelegramAccount(payload, chatId, ctx.from?.username);
      if (!result.ok) {
        await ctx.reply(result.error);
        return;
      }
      await ctx.reply(
        "Account linked successfully! Use the menu below to explore HireWise AI.",
        { reply_markup: mainMenuKeyboard() }
      );
      return;
    }

    const linked = await getLinkedAccount(chatId);
    if (linked) {
      await ctx.reply("Welcome back to HireWise AI!", { reply_markup: mainMenuKeyboard() });
      return;
    }

    await ctx.reply(
      "Welcome to HireWise AI Bot!\n\n" +
      "Link your account by opening the Telegram page in the HireWise web app, " +
      "then tap the deep link or send:\n/start YOUR_LINK_TOKEN",
      { reply_markup: { remove_keyboard: true } }
    );
  });

  bot.command("menu", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;
    await ctx.reply("Main menu:", { reply_markup: mainMenuKeyboard() });
  });

  bot.hears("My Resume", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;
    const { candidate, supabase } = linked;

    const { data: resume } = await supabase
      .from("resumes")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("is_primary", true)
      .single();

    if (!resume) {
      await ctx.reply("No resume uploaded yet. Upload one at the HireWise web app first.");
      return;
    }

    const parsed = resume.parsed_data as ParsedResumeData;
    const skills = parsed.skills?.slice(0, 10).join(", ") || "None detected";
    const summary = parsed.summary ? truncate(parsed.summary, 200) : "No summary";

    await ctx.reply(
      `*Your Resume*\n\n` +
      `File: ${resume.file_name}\n` +
      `Health Score: ${formatScore(resume.health_score)}\n\n` +
      `Summary: ${summary}\n\n` +
      `Top Skills: ${skills}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.hears("Job Fit", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const chatId = ctx.chat!.id;
    const session = getSession(chatId);
    session.pendingAction = "job_fit";
    session.awaiting = "job_selection";

    const jobs = await listPublishedJobs(linked.supabase);
    await ctx.reply(
      `*Job Fit Analysis*\n\nReply with a job ID from the list below:\n\n${formatJobList(jobs)}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.hears("Interview", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;
    const { candidate, supabase } = linked;

    const { data: resume } = await supabase
      .from("resumes")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("is_primary", true)
      .single();

    if (!resume) {
      await ctx.reply("Upload your resume first to start interview practice.");
      return;
    }

    const { data: session } = await supabase
      .from("interview_sessions")
      .insert({
        candidate_id: candidate.id,
        resume_id: resume.id,
        interview_type: "mixed",
        status: "active",
      })
      .select()
      .single();

    if (!session) {
      await ctx.reply("Failed to start interview. Please try again.");
      return;
    }

    const question = await generateInterviewQuestion({
      resumeData: resume.parsed_data as ParsedResumeData,
      job: null,
      interviewType: "mixed",
      conversationHistory: [],
    });

    await supabase.from("interview_messages").insert({
      session_id: session.id,
      role: "interviewer",
      content: question,
    });

    const chatId = ctx.chat!.id;
    const botSession = getSession(chatId);
    botSession.interviewSessionId = session.id;
    botSession.awaiting = "interview_answer";

    await ctx.reply(
      `*Interview Practice Started*\n\n${question}\n\n_Reply with your answer. Send /endinterview to finish early._`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("endinterview", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const chatId = ctx.chat!.id;
    const botSession = getSession(chatId);
    if (!botSession.interviewSessionId) {
      await ctx.reply("No active interview session.");
      return;
    }

    await finishInterview(ctx, linked.supabase, linked.candidate.id, botSession.interviewSessionId);
    clearSession(chatId);
  });

  bot.hears("Skill Gaps", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const chatId = ctx.chat!.id;
    const session = getSession(chatId);
    session.pendingAction = "skill_gaps";
    session.awaiting = "job_selection";

    const jobs = await listPublishedJobs(linked.supabase);
    await ctx.reply(
      `*Skill Gap Analysis*\n\nReply with a job ID:\n\n${formatJobList(jobs)}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.hears("Applications", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;
    const { candidate, supabase } = linked;

    const { data: applications } = await supabase
      .from("applications")
      .select("status, applied_at, jobs(title, company), role_fit_scores(overall_score)")
      .eq("candidate_id", candidate.id)
      .order("applied_at", { ascending: false })
      .limit(10);

    if (!applications?.length) {
      await ctx.reply("You have no applications yet. Browse jobs in the HireWise web app.");
      return;
    }

    const lines = applications.map((app) => {
      const job = app.jobs as { title: string; company: string } | null;
      const fit = Array.isArray(app.role_fit_scores)
        ? app.role_fit_scores[0]
        : app.role_fit_scores;
      return (
        `• ${job?.title || "Unknown"} at ${job?.company || "Unknown"}\n` +
        `  Status: ${APPLICATION_STATUS_LABELS[app.status] || app.status}\n` +
        `  Fit: ${formatScore(fit?.overall_score != null ? Number(fit.overall_score) : null)}`
      );
    });

    await ctx.reply(`*Your Applications*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
  });

  bot.hears("Resume Optimization", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const chatId = ctx.chat!.id;
    const session = getSession(chatId);
    session.pendingAction = "optimize";
    session.awaiting = "job_selection";

    const jobs = await listPublishedJobs(linked.supabase);
    await ctx.reply(
      `*Resume Optimization*\n\nReply with a job ID to optimize your resume for:\n\n${formatJobList(jobs)}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.hears("Career Coach", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const chatId = ctx.chat!.id;
    const session = getSession(chatId);
    session.awaiting = "coach_question";
    session.pendingAction = undefined;

    await ctx.reply(
      "Ask me anything about your career — job search, skills, interviews, or applications.\n\n" +
      "Send /roadmap followed by a job ID for a 90-day roadmap."
    );
  });

  bot.command("roadmap", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const jobId = ctx.match?.trim();
    if (!jobId) {
      const jobs = await listPublishedJobs(linked.supabase);
      await ctx.reply(`Provide a job ID:\n/roadmap JOB_ID\n\n${formatJobList(jobs)}`, { parse_mode: "Markdown" });
      return;
    }

    await handleRoadmap(ctx, linked, jobId);
  });

  bot.on("message:text", async (ctx) => {
    const linked = await requireLinked(ctx);
    if (!linked) return;

    const chatId = ctx.chat!.id;
    const session = getSession(chatId);
    const text = ctx.message.text.trim();

    if (session.awaiting === "interview_answer" && session.interviewSessionId) {
      await handleInterviewAnswer(ctx, linked, text);
      return;
    }

    if (session.awaiting === "job_selection" && session.pendingAction) {
      await handleJobSelection(ctx, linked, text);
      return;
    }

    if (session.awaiting === "coach_question") {
      await handleCoachQuestion(ctx, linked, text);
      return;
    }
  });

  return bot;
}

async function handleJobSelection(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  jobId: string
) {
  const chatId = ctx.chat!.id;
  const session = getSession(chatId);
  const action = session.pendingAction;

  const { data: job } = await linked.supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) {
    await ctx.reply("Job not found. Please send a valid job ID from the list.");
    return;
  }

  session.awaiting = undefined;
  session.pendingAction = undefined;

  if (action === "job_fit") {
    await handleJobFit(ctx, linked, job as Job);
  } else if (action === "skill_gaps") {
    await handleSkillGaps(ctx, linked, job as Job);
  } else if (action === "optimize") {
    await handleOptimize(ctx, linked, job as Job);
  }

  clearSession(chatId);
}

async function handleJobFit(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  job: Job
) {
  const { candidate, supabase } = linked;

  const { data: existing } = await supabase
    .from("role_fit_scores")
    .select("*, role_fit_explanations(*)")
    .eq("candidate_id", candidate.id)
    .eq("job_id", job.id)
    .single();

  if (existing) {
    const explanation = Array.isArray(existing.role_fit_explanations)
      ? existing.role_fit_explanations[0]
      : existing.role_fit_explanations;
    await ctx.reply(formatRoleFitResult(job, existing.overall_score, explanation?.summary));
    return;
  }

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("candidate_id", candidate.id)
    .eq("is_primary", true)
    .single();

  if (!resume) {
    await ctx.reply("Upload your resume first to calculate job fit.");
    return;
  }

  await ctx.reply("Calculating role fit...");

  const fitResult = await calculateRoleFit(
    resume.parsed_data as ParsedResumeData,
    resume.raw_text,
    job,
    candidate.years_of_experience
  );

  const { data: score } = await supabase
    .from("role_fit_scores")
    .insert({
      candidate_id: candidate.id,
      job_id: job.id,
      overall_score: fitResult.overall_score,
      semantic_match: fitResult.semantic_match,
      skills_match: fitResult.skills_match,
      experience_match: fitResult.experience_match,
      project_relevance: fitResult.project_relevance,
      education_match: fitResult.education_match,
      scoring_metadata: fitResult.scoring_metadata,
    })
    .select()
    .single();

  if (score) {
    await supabase.from("role_fit_explanations").insert({
      role_fit_score_id: score.id,
      ...fitResult.explanation,
    });
  }

  await ctx.reply(formatRoleFitResult(job, fitResult.overall_score, fitResult.explanation.summary));
}

function formatRoleFitResult(job: Job, score: number, summary?: string | null) {
  return (
    `*Role Fit: ${job.title}*\n` +
    `Company: ${job.company}\n\n` +
    `Overall Score: *${formatScore(score)}*\n\n` +
    (summary ? truncate(summary, 500) : "")
  );
}

async function handleSkillGaps(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  job: Job
) {
  const { candidate, supabase } = linked;

  const { data: resume } = await supabase
    .from("resumes")
    .select("parsed_data")
    .eq("candidate_id", candidate.id)
    .eq("is_primary", true)
    .single();

  const { data: candidateSkills } = await supabase
    .from("candidate_skills")
    .select("skill_name")
    .eq("candidate_id", candidate.id);

  const resumeSkills = (resume?.parsed_data as ParsedResumeData | undefined)?.skills || [];
  const allSkills = [...new Set([...resumeSkills, ...(candidateSkills || []).map((s) => s.skill_name)])];

  const gaps = await analyzeSkillGaps(allSkills, job);

  await supabase.from("skill_gaps").delete().eq("candidate_id", candidate.id).eq("job_id", job.id);
  await supabase.from("skill_gaps").insert(
    gaps.map((g) => ({
      candidate_id: candidate.id,
      job_id: g.job_id,
      skill_name: g.skill_name,
      level: g.level,
      priority: g.priority,
      recommendation: g.recommendation,
    }))
  );

  const missing = gaps.filter((g) => g.level === "missing");
  const moderate = gaps.filter((g) => g.level === "moderate");

  let message = `*Skill Gaps for ${job.title}*\n\n`;
  if (missing.length) {
    message += `*Missing (${missing.length}):*\n${missing.map((g) => `• ${g.skill_name}`).join("\n")}\n\n`;
  }
  if (moderate.length) {
    message += `*To strengthen (${moderate.length}):*\n${moderate.map((g) => `• ${g.skill_name}`).join("\n")}\n\n`;
  }
  if (!missing.length && !moderate.length) {
    message += "Great news — you match the key skills for this role!";
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

async function handleOptimize(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  job: Job
) {
  const { candidate, supabase } = linked;

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("candidate_id", candidate.id)
    .eq("is_primary", true)
    .single();

  if (!resume) {
    await ctx.reply("Upload your resume first.");
    return;
  }

  await ctx.reply("Optimizing your resume for this job...");

  const result = await optimizeResumeForJob(
    resume.parsed_data as ParsedResumeData,
    resume.raw_text,
    job
  );

  await supabase.from("resume_optimizations").insert({
    candidate_id: candidate.id,
    resume_id: resume.id,
    job_id: job.id,
    optimized_content: result.optimized_content,
    changes_summary: result.changes_summary,
  });

  const changes = result.changes_summary.slice(0, 5).map((c) => `• ${c}`).join("\n");
  await ctx.reply(
    `*Resume Optimized for ${job.title}*\n\nChanges made:\n${changes}\n\n` +
    "Download PDF/DOCX from the HireWise web app.",
    { parse_mode: "Markdown" }
  );
}

async function handleCoachQuestion(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  question: string
) {
  const { candidate, supabase } = linked;

  const { data: resume } = await supabase
    .from("resumes")
    .select("parsed_data")
    .eq("candidate_id", candidate.id)
    .eq("is_primary", true)
    .single();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("candidate_id", candidate.id);

  const { data: skillGaps } = await supabase
    .from("skill_gaps")
    .select("*")
    .eq("candidate_id", candidate.id)
    .order("priority", { ascending: false })
    .limit(20);

  await ctx.reply("Thinking...");

  const answer = await askCareerCoach(question, {
    profile: {
      headline: candidate.headline,
      years_of_experience: candidate.years_of_experience,
      current_title: candidate.current_title,
    },
    resumeData: (resume?.parsed_data as ParsedResumeData) || null,
    applications: (applications as Application[]) || [],
    skillGaps: (skillGaps as SkillGap[]) || [],
  });

  await supabase.from("career_recommendations").insert({
    candidate_id: candidate.id,
    recommendation_type: "coach_qa",
    title: question.slice(0, 100),
    content: answer,
  });

  await ctx.reply(truncate(answer, 4000));
}

async function handleRoadmap(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  jobId: string
) {
  const { candidate, supabase } = linked;

  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) {
    await ctx.reply("Job not found.");
    return;
  }

  const { data: resume } = await supabase
    .from("resumes")
    .select("parsed_data")
    .eq("candidate_id", candidate.id)
    .eq("is_primary", true)
    .single();

  const { data: skillGaps } = await supabase
    .from("skill_gaps")
    .select("*")
    .eq("candidate_id", candidate.id)
    .eq("job_id", jobId);

  await ctx.reply("Generating your 90-day roadmap...");

  const roadmap = await generateCareerRoadmap(
    {
      profile: {
        headline: candidate.headline,
        years_of_experience: candidate.years_of_experience,
        current_title: candidate.current_title,
      },
      resumeData: (resume?.parsed_data as ParsedResumeData) || null,
      applications: [],
      skillGaps: (skillGaps as SkillGap[]) || [],
      targetJob: job as Job,
    },
    job as Job
  );

  await supabase.from("career_recommendations").insert({
    candidate_id: candidate.id,
    job_id: jobId,
    recommendation_type: "roadmap",
    title: `90-Day Roadmap: ${job.title}`,
    content: `Roadmap for ${job.title} at ${job.company}`,
    roadmap,
  });

  const formatPhase = (label: string, items: string[]) =>
    items.length ? `*${label}:*\n${items.map((i) => `• ${i}`).join("\n")}` : "";

  await ctx.reply(
    [
      `*90-Day Roadmap: ${job.title}*`,
      formatPhase("30 Days", roadmap["30_day"]),
      formatPhase("60 Days", roadmap["60_day"]),
      formatPhase("90 Days", roadmap["90_day"]),
    ].filter(Boolean).join("\n\n"),
    { parse_mode: "Markdown" }
  );
}

async function handleInterviewAnswer(
  ctx: BotContext,
  linked: NonNullable<Awaited<ReturnType<typeof getCandidateForChat>>>,
  answer: string
) {
  const chatId = ctx.chat!.id;
  const botSession = getSession(chatId);
  const sessionId = botSession.interviewSessionId!;
  const { candidate, supabase } = linked;

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*, resumes(*)")
    .eq("id", sessionId)
    .eq("candidate_id", candidate.id)
    .single();

  if (!session || session.status !== "active") {
    await ctx.reply("No active interview session.");
    clearSession(chatId);
    return;
  }

  const { data: messages } = await supabase
    .from("interview_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history = (messages || []).map((m) => ({ role: m.role, content: m.content }));
  const lastQuestion = [...history].reverse().find((m) => m.role === "interviewer");
  if (!lastQuestion) return;

  const resumeRecord = Array.isArray(session.resumes) ? session.resumes[0] : session.resumes;
  const resumeData = (resumeRecord?.parsed_data || {}) as ParsedResumeData;
  const context = {
    resumeData,
    job: null,
    interviewType: session.interview_type as "mixed",
    conversationHistory: history,
  };

  const evaluation = await evaluateInterviewAnswer(lastQuestion.content, answer, context);

  await supabase.from("interview_messages").insert({
    session_id: sessionId,
    role: "candidate",
    content: answer,
    evaluation,
  });

  const updatedHistory = [...history, { role: "candidate", content: answer }];

  if (shouldEndInterview(updatedHistory.length)) {
    await finishInterview(ctx, supabase, candidate.id, sessionId);
    clearSession(chatId);
    return;
  }

  const nextQuestion = await generateInterviewQuestion({
    ...context,
    conversationHistory: updatedHistory,
  });

  await supabase.from("interview_messages").insert({
    session_id: sessionId,
    role: "interviewer",
    content: nextQuestion,
  });

  await ctx.reply(
    `Feedback: ${evaluation.feedback}\n\n*Next question:*\n${nextQuestion}`,
    { parse_mode: "Markdown" }
  );
}

async function finishInterview(
  ctx: BotContext,
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  candidateId: string,
  sessionId: string
) {
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("interview_type")
    .eq("id", sessionId)
    .eq("candidate_id", candidateId)
    .single();

  const { data: messages } = await supabase
    .from("interview_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history = (messages || []).map((m) => ({ role: m.role, content: m.content }));

  const finalEval = await generateInterviewEvaluation(
    history,
    (session?.interview_type || "mixed") as "mixed",
    null
  );

  await supabase
    .from("interview_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      overall_score: finalEval.overall_score,
      technical_score: finalEval.technical_score,
      communication_score: finalEval.communication_score,
      answer_quality_score: finalEval.answer_quality_score,
      relevance_score: finalEval.relevance_score,
      evaluation: {
        strengths: finalEval.strengths,
        weaknesses: finalEval.weaknesses,
        recommendations: finalEval.recommendations,
        summary: finalEval.summary,
      },
    })
    .eq("id", sessionId);

  const strengths = finalEval.strengths.slice(0, 3).map((s) => `• ${s}`).join("\n");
  const recs = finalEval.recommendations.slice(0, 3).map((r) => `• ${r}`).join("\n");

  await ctx.reply(
    `*Interview Complete*\n\n` +
    `Overall Score: *${formatScore(finalEval.overall_score)}*\n\n` +
    `${finalEval.summary}\n\n` +
    `*Strengths:*\n${strengths}\n\n` +
    `*Recommendations:*\n${recs}`,
    { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() }
  );
}

let _bot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!_bot) _bot = createBot();
  return _bot;
}

export const bot = new Proxy({} as Bot<BotContext>, {
  get(_target, prop, receiver) {
    const instance = getBot();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

if (process.argv[1]?.includes("bot.ts") || process.argv[1]?.includes("bot.js")) {
  getBot().start({
    onStart: (info) => console.log(`HireWise Telegram bot started as @${info.username}`),
  });
}
