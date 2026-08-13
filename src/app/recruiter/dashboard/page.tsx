import Link from "next/link";
import { Briefcase, Users, Star, Calendar, Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/shared/dashboard-components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, JOB_STATUS_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/utils";
import type { ApplicationStatus, JobStatus } from "@/types";

async function getDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: recruiter } = await supabase
    .from("recruiter_profiles")
    .select("id, company_name")
    .eq("user_id", user.id)
    .single();

  if (!recruiter) redirect("/onboarding/role");

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, created_at")
    .eq("recruiter_id", recruiter.id)
    .order("created_at", { ascending: false });

  const jobIds = (jobs || []).map((j) => j.id);
  const activeJobs = (jobs || []).filter((j) => j.status === "published").length;

  let applications: {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  job_id: string;
  jobs: { title: string }[];
  }[] = [];

  if (jobIds.length > 0) {
    const { data } = await supabase
      .from("applications")
      .select("id, status, applied_at, job_id, jobs(title)")
      .in("job_id", jobIds)
      .order("applied_at", { ascending: false });

    applications = (data || []) as typeof applications;
  }

  const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
  const interviewsPending = applications.filter((a) => a.status === "interview").length;

  return {
    companyName: recruiter.company_name,
    activeJobs,
    totalApplications: applications.length,
    shortlisted,
    interviewsPending,
    recentJobs: (jobs || []).slice(0, 5),
    recentApplications: applications.slice(0, 5),
  };
}

function statusBadgeVariant(status: JobStatus | ApplicationStatus) {
  const map: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
    draft: "secondary",
    published: "success",
    closed: "warning",
    archived: "outline",
    applied: "secondary",
    under_review: "default",
    shortlisted: "success",
    interview: "default",
    rejected: "destructive",
    selected: "success",
  };
  return map[status] || "secondary";
}

export default async function RecruiterDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back{data.companyName ? `, ${data.companyName}` : ""}. Here&apos;s your hiring overview.
          </p>
        </div>
        <Button asChild>
          <Link href="/recruiter/jobs/new">
            <Plus className="h-4 w-4" /> Post a Job
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Jobs"
          value={data.activeJobs}
          description="Currently published"
          icon={<Briefcase className="h-4 w-4 text-brand-600" />}
        />
        <StatCard
          title="Applications"
          value={data.totalApplications}
          description="Total received"
          icon={<Users className="h-4 w-4 text-brand-600" />}
        />
        <StatCard
          title="Shortlisted"
          value={data.shortlisted}
          description="Ready for next step"
          icon={<Star className="h-4 w-4 text-brand-600" />}
        />
        <StatCard
          title="Interviews Pending"
          value={data.interviewsPending}
          description="Awaiting interview"
          icon={<Calendar className="h-4 w-4 text-brand-600" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Jobs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/recruiter/jobs">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No jobs yet.{" "}
                <Link href="/recruiter/jobs/new" className="text-brand-600 hover:underline">
                  Create your first job
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/recruiter/jobs/${job.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                    </div>
                    <Badge variant={statusBadgeVariant(job.status as JobStatus)}>
                      {JOB_STATUS_LABELS[job.status] || job.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Applications</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/recruiter/applications">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No applications yet. Applications will appear here once candidates apply.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {(app.jobs as { title: string } | null)?.title || "Unknown job"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(app.applied_at)}</p>
                    </div>
                    <Badge variant={statusBadgeVariant(app.status)}>
                      {APPLICATION_STATUS_LABELS[app.status] || app.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
