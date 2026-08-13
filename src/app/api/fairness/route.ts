import { NextRequest, NextResponse } from "next/server";
import { runFairnessAudit } from "@/lib/services/fairness-audit";
import { requireUser, requireRecruiter } from "@/lib/api/helpers";
import type { ApplicationStatus } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const recruiterResult = await requireRecruiter(supabase, user.id);
    if ("error" in recruiterResult) return recruiterResult.error;
    const { recruiter } = recruiterResult;

    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const { data: job } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("id", jobId)
      .eq("recruiter_id", recruiter.id)
      .single();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { data: applications } = await supabase
      .from("applications")
      .select(`
        candidate_id,
        status,
        candidate_profiles(gender, age_group, demographic_consent),
        role_fit_scores(overall_score)
      `)
      .eq("job_id", jobId);

    const candidates = (applications || []).map((app) => {
      const profile = Array.isArray(app.candidate_profiles)
        ? app.candidate_profiles[0]
        : app.candidate_profiles;
      const fitScore = Array.isArray(app.role_fit_scores)
        ? app.role_fit_scores[0]
        : app.role_fit_scores;

      const hasConsent = profile?.demographic_consent === true;

      return {
        candidate_id: app.candidate_id as string,
        gender: hasConsent ? (profile?.gender as string | null) : null,
        age_group: hasConsent ? (profile?.age_group as string | null) : null,
        application_status: app.status as ApplicationStatus,
        role_fit_score: fitScore?.overall_score != null ? Number(fitScore.overall_score) : null,
      };
    });

    const auditResult = runFairnessAudit(candidates, jobId);

    const { data: audit, error } = await supabase
      .from("fairness_audits")
      .insert({
        ...auditResult,
        recruiter_id: recruiter.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ audit });
  } catch (error) {
    console.error("Fairness audit error:", error);
    return NextResponse.json({ error: "Failed to run fairness audit" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const recruiterResult = await requireRecruiter(supabase, user.id);
    if ("error" in recruiterResult) return recruiterResult.error;
    const { recruiter } = recruiterResult;

    const jobId = request.nextUrl.searchParams.get("jobId");

    let query = supabase
      .from("fairness_audits")
      .select("*, jobs(title, company)")
      .eq("recruiter_id", recruiter.id)
      .order("created_at", { ascending: false });

    if (jobId) query = query.eq("job_id", jobId);

    const { data: audits } = await query.limit(jobId ? 10 : 50);

    return NextResponse.json({ audits: audits || [] });
  } catch (error) {
    console.error("Fairness audits fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch fairness audits" }, { status: 500 });
  }
}
