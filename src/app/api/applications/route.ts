import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, notifyNewApplication } from "@/lib/services/notifications";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId, coverLetter } = await request.json();
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const { data: candidate } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 });

    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("candidate_id", candidate.id)
      .eq("job_id", jobId)
      .single();

    if (existing) return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 });

    const { data: resume } = await supabase
      .from("resumes")
      .select("id")
      .eq("candidate_id", candidate.id)
      .eq("is_primary", true)
      .single();

    const { data: job } = await supabase
      .from("jobs")
      .select("*, recruiter_profiles(user_id, company_name)")
      .eq("id", jobId)
      .eq("status", "published")
      .single();

    if (!job) return NextResponse.json({ error: "Job not found or not published" }, { status: 404 });

    const { data: application, error } = await supabase
      .from("applications")
      .insert({
        candidate_id: candidate.id,
        job_id: jobId,
        resume_id: resume?.id || null,
        cover_letter: coverLetter || null,
        status: "applied",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await createNotification(
      user.id,
      "application_submitted",
      "Application Submitted",
      `Your application for ${job.title} at ${job.company} has been submitted.`,
      { application_id: application.id, job_id: jobId }
    );

    const recruiterUserId = (job.recruiter_profiles as { user_id: string })?.user_id;
    if (recruiterUserId) {
      await notifyNewApplication(recruiterUserId, profile?.full_name || "A candidate", job.title);
    }

try {
  const roleFitUrl = `${request.nextUrl.origin}/api/role-fit`;

  const roleFitResponse = await fetch(roleFitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: request.headers.get("cookie") || "",
    },
    body: JSON.stringify({
      jobId,
      applicationId: application.id,
    }),
  });

  if (!roleFitResponse.ok) {
    const errorText = await roleFitResponse.text();

    console.error(
      "Role-fit calculation failed:",
      roleFitResponse.status,
      errorText
    );
  } else {
    console.log(
      "Role-fit calculation completed successfully"
    );
  }
} catch (roleFitError) {
  console.error(
    "Role-fit request failed:",
    roleFitError
  );
}
    return NextResponse.json({ application });
  } catch (error) {
    console.error("Application error:", error);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: candidate } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) return NextResponse.json({ applications: [] });

  const { data: applications } = await supabase
    .from("applications")
    .select("*, jobs(*), role_fit_scores(overall_score)")
    .eq("candidate_id", candidate.id)
    .order("applied_at", { ascending: false });

  return NextResponse.json({ applications: applications || [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicationId, status } = await request.json();

  const { data: recruiter } = await supabase
    .from("recruiter_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!recruiter) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { data: application } = await supabase
    .from("applications")
    .select("*, jobs!inner(recruiter_id, title, company), candidate_profiles(user_id)")
    .eq("id", applicationId)
    .single();

  if (!application || (application.jobs as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidateUserId = (application.candidate_profiles as { user_id: string }).user_id;
  const job = application.jobs as { title: string; company: string };

  const { notifyApplicationStatusChange } = await import("@/lib/services/notifications");
  await notifyApplicationStatusChange(candidateUserId, job.title, job.company, status);

  return NextResponse.json({ success: true });
}
