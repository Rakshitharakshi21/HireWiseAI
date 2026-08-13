"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ScoreDisplay } from "@/components/shared/dashboard-components";
import {
  APPLICATION_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, formatDate,
} from "@/lib/utils";
import type { Application, Job } from "@/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  applied: "secondary",
  under_review: "warning",
  shortlisted: "default",
  interview: "default",
  rejected: "destructive",
  selected: "success",
};

interface ApplicationWithJob extends Application {
  jobs: Job;
  role_fit_scores: { overall_score: number }[] | { overall_score: number } | null;
}

export default function ApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/applications");
        if (!res.ok) throw new Error("Failed to load applications");
        const data = await res.json();
        setApplications(data.applications || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load applications");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getRoleFitScore(app: ApplicationWithJob): number | null {
    if (!app.role_fit_scores) return null;
    if (Array.isArray(app.role_fit_scores)) {
      return app.role_fit_scores[0]?.overall_score ?? null;
    }
    return app.role_fit_scores.overall_score ?? null;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground mt-1">
          Track the status of your job applications
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {applications.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Target className="h-12 w-12" />}
              title="No applications yet"
              description="Browse open positions and apply to jobs that match your skills and experience."
              action={
                <Button asChild>
                  <Link href="/candidate/jobs">Browse Jobs</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const job = app.jobs;
            const fitScore = getRoleFitScore(app);
            return (
              <Card key={app.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{job?.title || "Unknown Job"}</h3>
                        <Badge variant={STATUS_VARIANT[app.status] || "secondary"}>
                          {APPLICATION_STATUS_LABELS[app.status] || app.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {job?.company}
                        </span>
                        {job?.employment_type && (
                          <Badge variant="outline" className="font-normal">
                            {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                          </Badge>
                        )}
                        <span>Applied {formatDate(app.applied_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {fitScore != null ? (
                        <ScoreDisplay score={fitScore} label="Role Fit" size="sm" />
                      ) : (
                        <span className="text-sm text-muted-foreground">No fit score</span>
                      )}
                      {job?.id && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/candidate/jobs/${job.id}`}>
                            View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
