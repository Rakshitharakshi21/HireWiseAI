"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus, Pencil, XCircle, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import {
  formatDate,
  JOB_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/utils";
import type { Job, JobStatus } from "@/types";

function statusBadgeVariant(status: JobStatus) {
  const map: Record<JobStatus, "default" | "secondary" | "success" | "warning" | "outline"> = {
    draft: "secondary",
    published: "success",
    closed: "warning",
    archived: "outline",
  };
  return map[status];
}

export default function RecruiterJobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs?mine=true")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .catch(() => toast({ title: "Failed to load jobs", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function closeJob(jobId: string) {
    setClosingId(jobId);
    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status: "closed" }),
      });
      if (!res.ok) throw new Error();
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "closed" as JobStatus } : j))
      );
      toast({ title: "Job closed", variant: "success" });
    } catch {
      toast({ title: "Failed to close job", variant: "destructive" });
    } finally {
      setClosingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Jobs</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your job postings
          </p>
        </div>
        <Button asChild>
          <Link href="/recruiter/jobs/new">
            <Plus className="h-4 w-4" /> Create Job
          </Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Briefcase className="h-12 w-12" />}
              title="No jobs yet"
              description="Create your first job posting to start receiving applications from qualified candidates."
              action={
                <Button asChild>
                  <Link href="/recruiter/jobs/new">
                    <Plus className="h-4 w-4" /> Create Job
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/recruiter/jobs/${job.id}`}
                        className="text-lg font-semibold hover:text-brand-600 transition-colors"
                      >
                        {job.title}
                      </Link>
                      <Badge variant={statusBadgeVariant(job.status)}>
                        {JOB_STATUS_LABELS[job.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{job.company}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {job.location}
                        </span>
                      )}
                      <span>{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</span>
                      <span>Posted {formatDate(job.created_at)}</span>
                      {job.deadline && <span>Deadline {formatDate(job.deadline)}</span>}
                    </div>
                    {job.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.required_skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {job.required_skills.length > 5 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{job.required_skills.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/recruiter/jobs/${job.id}`}>
                        <Users className="h-4 w-4" /> Applicants
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/recruiter/jobs/${job.id}`}>
                        <Pencil className="h-4 w-4" /> View
                      </Link>
                    </Button>
                    {job.status === "published" && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={closingId === job.id}
                        onClick={() => closeJob(job.id)}
                      >
                        <XCircle className="h-4 w-4" /> Close
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
