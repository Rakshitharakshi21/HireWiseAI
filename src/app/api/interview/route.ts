import { NextRequest, NextResponse } from "next/server";
import {
  generateInterviewQuestion,
  evaluateInterviewAnswer,
  generateInterviewEvaluation,
  shouldEndInterview,
} from "@/lib/services/interview-engine";
import { requireUser, requireCandidate } from "@/lib/api/helpers";
import type { InterviewType, Job, ParsedResumeData } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const candidateResult = await requireCandidate(supabase, user.id);
    if ("error" in candidateResult) return candidateResult.error;
    const { candidate } = candidateResult;

    const body = await request.json();
    const { action, sessionId, jobId, interviewType, answer } = body as {
      action: "start" | "answer" | "end";
      sessionId?: string;
      jobId?: string;
      interviewType?: InterviewType;
      answer?: string;
    };

    if (action === "start") {
      const type: InterviewType = interviewType || "mixed";
      let job: Job | null = null;

      if (jobId) {
        const { data } = await supabase.from("jobs").select("*").eq("id", jobId).single();
        if (!data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
        job = data as Job;
      }

      const { data: resume } = await supabase
        .from("resumes")
        .select("*")
        .eq("candidate_id", candidate.id)
        .eq("is_primary", true)
        .single();

      if (!resume) {
        return NextResponse.json({ error: "Upload your resume before starting an interview" }, { status: 400 });
      }

      const { data: session, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert({
          candidate_id: candidate.id,
          job_id: jobId || null,
          resume_id: resume.id,
          interview_type: type,
          status: "active",
        })
        .select()
        .single();

      if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

      const question = await generateInterviewQuestion({
        resumeData: resume.parsed_data as ParsedResumeData,
        job,
        interviewType: type,
        conversationHistory: [],
      });

      await supabase.from("interview_messages").insert({
        session_id: session.id,
        role: "interviewer",
        content: question,
      });

      return NextResponse.json({ session, question });
    }

    if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*, jobs(*), resumes(*)")
      .eq("id", sessionId)
      .eq("candidate_id", candidate.id)
      .single();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "active") {
      return NextResponse.json({ error: "Interview session is not active" }, { status: 400 });
    }

    const { data: messages } = await supabase
      .from("interview_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const conversationHistory = (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const resumeRecord = Array.isArray(session.resumes) ? session.resumes[0] : session.resumes;
    const resumeData = (resumeRecord?.parsed_data || {}) as ParsedResumeData;
    const job = (Array.isArray(session.jobs) ? session.jobs[0] : session.jobs) as Job | null;
    const context = {
      resumeData,
      job,
      interviewType: session.interview_type as InterviewType,
      conversationHistory,
    };

    if (action === "answer") {
      if (!answer?.trim()) return NextResponse.json({ error: "Answer required" }, { status: 400 });

      const lastQuestion = [...conversationHistory].reverse().find((m) => m.role === "interviewer");
      if (!lastQuestion) return NextResponse.json({ error: "No question to answer" }, { status: 400 });

      const evaluation = await evaluateInterviewAnswer(lastQuestion.content, answer, context);

      await supabase.from("interview_messages").insert([
        { session_id: sessionId, role: "candidate", content: answer, evaluation },
      ]);

      const updatedHistory = [...conversationHistory, { role: "candidate", content: answer }];
      const candidateMessages = updatedHistory.filter((m) => m.role === "candidate").length;

      if (shouldEndInterview(updatedHistory.length)) {
        const finalEval = await generateInterviewEvaluation(
          updatedHistory,
          session.interview_type as InterviewType,
          job
        );

        const { data: completedSession } = await supabase
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
          .eq("id", sessionId)
          .select()
          .single();

        return NextResponse.json({
          session: completedSession,
          evaluation: finalEval,
          feedback: evaluation.feedback,
          completed: true,
        });
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

      return NextResponse.json({
        feedback: evaluation.feedback,
        question: nextQuestion,
        questionNumber: candidateMessages + 1,
        completed: false,
      });
    }

    if (action === "end") {
      const finalEval = await generateInterviewEvaluation(
        conversationHistory,
        session.interview_type as InterviewType,
        job
      );

      const { data: completedSession } = await supabase
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
        .eq("id", sessionId)
        .select()
        .single();

      return NextResponse.json({ session: completedSession, evaluation: finalEval, completed: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Interview error:", error);
    return NextResponse.json({ error: "Interview operation failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const candidateResult = await requireCandidate(supabase, user.id);
    if ("error" in candidateResult) return candidateResult.error;
    const { candidate } = candidateResult;

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*, interview_messages(*), jobs(title, company)")
      .eq("id", sessionId)
      .eq("candidate_id", candidate.id)
      .single();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const messages = Array.isArray(session.interview_messages)
      ? session.interview_messages.sort(
          (a: { created_at: string }, b: { created_at: string }) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      : [];

    return NextResponse.json({ session: { ...session, messages } });
  } catch (error) {
    console.error("Interview fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch interview session" }, { status: 500 });
  }
}
