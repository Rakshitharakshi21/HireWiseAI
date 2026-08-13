"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ScoreDisplay } from "@/components/shared/dashboard-components";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  APPLICATION_STATUS_LABELS,
} from "@/lib/utils";
import type { ApplicationStatus } from "@/types";

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  job_id: string;
  candidate_id: string;
  jobs: { id: string; title: string; company: string } | null;
  candidate_profiles: {
    headline: string | null;
    current_title: string | null;
    years_of_experience: number | null;
  } | null;
  role_fit_scores: { overall_score: number }[] | null;
}

const STATUS_OPTIONS = ["all", "applied", "under_review", "shortlisted", "interview", "rejected", "selected"];

function statusBadgeVariant(status: ApplicationStatus) {
  const map: Record<ApplicationStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    applied: "secondary",
    under_review: "default",
    shortlisted: "success",
    interview: "default",
    rejected: "destructive",
    selected: "success",
  };
  return map[status];
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeApplications(data: unknown[]): ApplicationRow[] {
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const fitScores = r.role_fit_scores;
    return {
      id: r.id as string,
      status: r.status as ApplicationStatus,
      applied_at: r.applied_at as string,
      job_id: r.job_id as string,
      candidate_id: r.candidate_id as string,
      jobs: normalizeOne(r.jobs as ApplicationRow["jobs"] | ApplicationRow["jobs"][]),
      candidate_profiles: normalizeOne(
        r.candidate_profiles as ApplicationRow["candidate_profiles"] | ApplicationRow["candidate_profiles"][]
      ),
      role_fit_scores: Array.isArray(fitScores)
        ? fitScores as ApplicationRow["role_fit_scores"]
        : fitScores
          ? [fitScores as { overall_score: number }]
          : null,
    };
  });
}

function getCandidateName(row: ApplicationRow) {
  const cp = row.candidate_profiles;
  return cp?.headline || cp?.current_title || `Candidate ${row.candidate_id.slice(0, 8)}`;
}

export default function RecruiterApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadApplications = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: recruiter } = await supabase
      .from("recruiter_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!recruiter) {
      setLoading(false);
      return;
    }

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("recruiter_id", recruiter.id);

    const jobIds = (jobs || []).map((j) => j.id);
    if (jobIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("applications")
      .select(`
        id,
        status,
        applied_at,
        job_id,
        candidate_id,
        jobs (id, title, company),
        candidate_profiles (headline, current_title, years_of_experience),
        role_fit_scores (overall_score)
      `)
      .in("job_id", jobIds)
      .order("applied_at", { ascending: false });

    setApplications(normalizeApplications(data || []));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const filtered =
    statusFilter === "all"
      ? applications
      : applications.filter((a) => a.status === statusFilter);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground mt-1">
          All applications across your job postings
        </p>
      </div>

      {applications.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : APPLICATION_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      )}

      {applications.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No applications yet"
              description="Applications will appear here when candidates apply to your job postings."
              action={
                <Button asChild>
                  <Link href="/recruiter/jobs/new">Post a Job</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No applications match the selected filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const score = app.role_fit_scores?.[0]?.overall_score;
            return (
              <Card key={app.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{getCandidateName(app)}</p>
                        <Badge variant={statusBadgeVariant(app.status)}>
                          {APPLICATION_STATUS_LABELS[app.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        <Link
                          href={`/recruiter/jobs/${app.job_id}`}
                          className="hover:text-brand-600 transition-colors"
                        >
                          {app.jobs?.title || "Unknown job"}
                        </Link>
                        {app.jobs?.company && ` · ${app.jobs.company}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Applied {formatDate(app.applied_at)}
                        {app.candidate_profiles?.years_of_experience != null &&
                          ` · ${app.candidate_profiles.years_of_experience} yrs experience`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {score != null ? (
                        <ScoreDisplay score={Number(score)} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending score</span>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/recruiter/jobs/${app.job_id}`}>Review</Link>
                      </Button>
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
