import { NextRequest, NextResponse } from "next/server";
import { askCareerCoach, generateCareerRoadmap } from "@/lib/services/career-coach";
import { requireUser, requireCandidate } from "@/lib/api/helpers";
import type { Application, Job, ParsedResumeData, SkillGap } from "@/types";

async function buildCoachContext(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  candidate: { id: string; headline?: string | null; years_of_experience?: number | null; current_title?: string | null },
  jobId?: string
) {
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

  let skillGaps: SkillGap[] = [];
  let targetJob: Job | null = null;

  if (jobId) {
    const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
    targetJob = (job as Job) || null;

    const { data: gaps } = await supabase
      .from("skill_gaps")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("job_id", jobId);
    skillGaps = (gaps as SkillGap[]) || [];
  } else {
    const { data: gaps } = await supabase
      .from("skill_gaps")
      .select("*")
      .eq("candidate_id", candidate.id)
      .order("priority", { ascending: false })
      .limit(20);
    skillGaps = (gaps as SkillGap[]) || [];
  }

  return {
    profile: {
      headline: candidate.headline,
      years_of_experience: candidate.years_of_experience,
      current_title: candidate.current_title,
    },
    resumeData: (resume?.parsed_data as ParsedResumeData) || null,
    applications: (applications as Application[]) || [],
    skillGaps,
    targetJob,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const candidateResult = await requireCandidate(supabase, user.id);
    if ("error" in candidateResult) return candidateResult.error;
    const { candidate } = candidateResult;

    const { action, question, jobId } = await request.json() as {
      action: "ask" | "roadmap";
      question?: string;
      jobId?: string;
    };

    if (action === "ask") {
      if (!question?.trim()) return NextResponse.json({ error: "Question required" }, { status: 400 });

      const context = await buildCoachContext(supabase, candidate, jobId);
      const answer = await askCareerCoach(question, context);

      const { data: recommendation } = await supabase
        .from("career_recommendations")
        .insert({
          candidate_id: candidate.id,
          job_id: jobId || null,
          recommendation_type: "coach_qa",
          title: question.slice(0, 100),
          content: answer,
        })
        .select()
        .single();

      return NextResponse.json({ answer, recommendation });
    }

    if (action === "roadmap") {
      if (!jobId) return NextResponse.json({ error: "Job ID required for roadmap" }, { status: 400 });

      const context = await buildCoachContext(supabase, candidate, jobId);
      if (!context.targetJob) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const roadmap = await generateCareerRoadmap(context, context.targetJob);

      const { data: recommendation } = await supabase
        .from("career_recommendations")
        .insert({
          candidate_id: candidate.id,
          job_id: jobId,
          recommendation_type: "roadmap",
          title: `90-Day Roadmap: ${context.targetJob.title}`,
          content: `Personalized career roadmap for ${context.targetJob.title} at ${context.targetJob.company}`,
          roadmap,
        })
        .select()
        .single();

      return NextResponse.json({ roadmap, recommendation });
    }

    return NextResponse.json({ error: "Invalid action. Use ask or roadmap" }, { status: 400 });
  } catch (error) {
    console.error("Career coach error:", error);
    return NextResponse.json({ error: "Career coach request failed" }, { status: 500 });
  }
}
