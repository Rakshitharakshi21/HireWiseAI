import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateRoleFit } from "@/lib/services/role-fit-engine";
import type { ParsedResumeData, Job } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const { data: candidate } = await supabase
      .from("candidate_profiles")
      .select("id, years_of_experience")
      .eq("user_id", user.id)
      .single();

    if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 });

    const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { data: existing } = await supabase
      .from("role_fit_scores")
      .select("*, role_fit_explanations(*)")
      .eq("candidate_id", candidate.id)
      .eq("job_id", jobId)
      .single();

    if (existing) {
      return NextResponse.json({ score: existing });
    }

    const { data: resume } = await supabase
      .from("resumes")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("is_primary", true)
      .single();

    if (!resume) {
      return NextResponse.json({ error: "Upload your resume first to calculate role fit" }, { status: 400 });
    }

    const fitResult = await calculateRoleFit(
      resume.parsed_data as ParsedResumeData,
      resume.raw_text,
      job as Job,
      candidate.years_of_experience
    );

    const { data: score, error: scoreError } = await supabase
      .from("role_fit_scores")
      .insert({
        candidate_id: candidate.id,
        job_id: jobId,
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

    if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });

    const { data: explanation } = await supabase
      .from("role_fit_explanations")
      .insert({
        role_fit_score_id: score.id,
        ...fitResult.explanation,
      })
      .select()
      .single();

    return NextResponse.json({ score: { ...score, explanation } });
  } catch (error) {
    console.error("Role fit calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate role fit" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

  const { data: candidate } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: score } = await supabase
    .from("role_fit_scores")
    .select("*, role_fit_explanations(*)")
    .eq("candidate_id", candidate.id)
    .eq("job_id", jobId)
    .single();

  if (!score) return NextResponse.json({ score: null });

  const explanation = Array.isArray(score.role_fit_explanations)
    ? score.role_fit_explanations[0]
    : score.role_fit_explanations;

  return NextResponse.json({ score: { ...score, explanation } });
}
