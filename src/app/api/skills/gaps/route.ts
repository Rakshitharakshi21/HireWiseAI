import { NextRequest, NextResponse } from "next/server";
import { analyzeSkillGaps } from "@/lib/services/career-coach";
import { requireUser, requireCandidate } from "@/lib/api/helpers";
import type { Job, ParsedResumeData } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const candidateResult = await requireCandidate(supabase, user.id);
    if ("error" in candidateResult) return candidateResult.error;
    const { candidate } = candidateResult;

    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

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
    const dbSkills = (candidateSkills || []).map((s) => s.skill_name);
    const allSkills = [...new Set([...resumeSkills, ...dbSkills])];

    const gaps = await analyzeSkillGaps(allSkills, job as Job);

    await supabase.from("skill_gaps").delete().eq("candidate_id", candidate.id).eq("job_id", jobId);

    const { data: savedGaps, error } = await supabase
      .from("skill_gaps")
      .insert(
        gaps.map((g) => ({
          candidate_id: candidate.id,
          job_id: g.job_id,
          skill_name: g.skill_name,
          level: g.level,
          priority: g.priority,
          recommendation: g.recommendation,
        }))
      )
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ gaps: savedGaps, job: { id: job.id, title: job.title, company: job.company } });
  } catch (error) {
    console.error("Skill gap analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze skill gaps" }, { status: 500 });
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

    const jobId = request.nextUrl.searchParams.get("jobId");

    let query = supabase
      .from("skill_gaps")
      .select("*, jobs(title, company)")
      .eq("candidate_id", candidate.id)
      .order("priority", { ascending: false });

    if (jobId) query = query.eq("job_id", jobId);

    const { data: gaps } = await query;

    return NextResponse.json({ gaps: gaps || [] });
  } catch (error) {
    console.error("Skill gaps fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch skill gaps" }, { status: 500 });
  }
}
