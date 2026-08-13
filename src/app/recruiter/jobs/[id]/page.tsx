"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  ChevronDown,
  ChevronUp,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  ScoreDisplay,
  ScoreBreakdown,
} from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  JOB_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/utils";
import type { Job, ApplicationStatus, RoleFitExplanation } from "@/types";

interface ApplicantRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  candidate_id: string;
  candidate_profiles: {
    headline: string | null;
    current_title: string | null;
    years_of_experience: number | null;
  } | null;
  role_fit_scores: {
    overall_score: number;
    semantic_match: number | null;
    skills_match: number | null;
    experience_match: number | null;
    project_relevance: number | null;
    education_match: number | null;
    role_fit_explanations: RoleFitExplanation | RoleFitExplanation[] | null;
  }[] | null;
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  "applied",
  "under_review",
  "shortlisted",
  "interview",
  "rejected",
  "selected",
];

function getCandidateName(applicant: ApplicantRow) {
  const cp = applicant.candidate_profiles;
  return cp?.headline || cp?.current_title || `Candidate ${applicant.candidate_id.slice(0, 8)}`;
}

function getExplanation(
  scores: ApplicantRow["role_fit_scores"]
): RoleFitExplanation | null {
  if (!scores?.length) return null;
  const exp = scores[0].role_fit_explanations;
  if (!exp) return null;
  return Array.isArray(exp) ? exp[0] : exp;
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const { data: jobData } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!jobData) {
      setLoading(false);
      return;
    }
    setJob(jobData as Job);

    const { data: apps } = await supabase
      .from("applications")
      .select(`
        id,
        status,
        applied_at,
        candidate_id,
        candidate_profiles (
          headline,
          current_title,
          years_of_experience
        ),
        role_fit_scores (
          overall_score,
          semantic_match,
          skills_match,
          experience_match,
          project_relevance,
          education_match,
          role_fit_explanations (
            strong_matches,
            missing_skills,
            weak_areas,
            experience_gaps,
            recommendations,
            feature_importance,
            summary
          )
        )
      `)
      .eq("job_id", jobId)
      .order("applied_at", { ascending: false });

    const sorted = (apps || []).sort((a, b) => {
      const scoreA = (a.role_fit_scores as ApplicantRow["role_fit_scores"])?.[0]?.overall_score ?? -1;
      const scoreB = (b.role_fit_scores as ApplicantRow["role_fit_scores"])?.[0]?.overall_score ?? -1;
      return Number(scoreB) - Number(scoreA);
    });

    setApplicants(sorted as ApplicantRow[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updateStatus(applicationId: string, status: ApplicationStatus) {
    setUpdatingId(applicationId);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, status }),
      });
      if (!res.ok) throw new Error();
      setApplicants((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a))
      );
      toast({ title: "Status updated", variant: "success" });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <EmptyState
        title="Job not found"
        description="This job may have been removed or you don't have access to it."
        action={
          <Button asChild>
            <Link href="/recruiter/jobs">Back to Jobs</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/recruiter/jobs">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{job.title}</h1>
          <Badge
            variant={
              job.status === "published"
                ? "success"
                : job.status === "closed"
                  ? "warning"
                  : "secondary"
            }
          >
            {JOB_STATUS_LABELS[job.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">{job.company}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm whitespace-pre-wrap">{job.description}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {job.location}
              </span>
            )}
            <span>{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</span>
            <span>
              Experience: {job.experience_min}
              {job.experience_max ? `–${job.experience_max}` : "+"} years
            </span>
            {(job.salary_min || job.salary_max) && (
              <span>
                Salary:{" "}
                {job.salary_min ? `$${job.salary_min.toLocaleString()}` : ""}
                {job.salary_min && job.salary_max ? " – " : ""}
                {job.salary_max ? `$${job.salary_max.toLocaleString()}` : ""}
              </span>
            )}
            {job.deadline && <span>Deadline: {formatDate(job.deadline)}</span>}
          </div>
          {job.required_skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.required_skills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-brand-600" />
          <h2 className="text-xl font-semibold">
            Applicants ({applicants.length})
          </h2>
          <Badge variant="secondary" className="ml-1">
            <Sparkles className="h-3 w-3 mr-1" /> AI Ranked
          </Badge>
        </div>

        {applicants.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Users className="h-12 w-12" />}
                title="No applicants yet"
                description="Candidates will appear here once they apply. Role-fit scores are calculated automatically."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {applicants.map((applicant, index) => {
              const score = applicant.role_fit_scores?.[0];
              const explanation = getExplanation(applicant.role_fit_scores);
              const isExpanded = expandedId === applicant.id;

              return (
                <Card key={applicant.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-brand-50 text-brand-700 font-bold text-sm shrink-0">
                          #{index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {getCandidateName(applicant)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Applied {formatDate(applicant.applied_at)}
                            {applicant.candidate_profiles?.years_of_experience != null &&
                              ` · ${applicant.candidate_profiles.years_of_experience} yrs exp`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {score ? (
                          <ScoreDisplay score={Number(score.overall_score)} size="sm" />
                        ) : (
                          <span className="text-sm text-muted-foreground">No score</span>
                        )}

                        <select
                          value={applicant.status}
                          disabled={updatingId === applicant.id}
                          onChange={(e) =>
                            updateStatus(applicant.id, e.target.value as ApplicationStatus)
                          }
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {APPLICATION_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : applicant.id)
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Explain
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 p-5 space-y-5">
                        {score ? (
                          <>
                            <div>
                              <h4 className="text-sm font-semibold mb-3">
                                Score Breakdown
                              </h4>
                              <ScoreBreakdown
                                scores={[
                                  { label: "Semantic Match", value: Number(score.semantic_match ?? 0) },
                                  { label: "Skills Match", value: Number(score.skills_match ?? 0) },
                                  { label: "Experience Match", value: Number(score.experience_match ?? 0) },
                                  { label: "Project Relevance", value: Number(score.project_relevance ?? 0) },
                                  { label: "Education Match", value: Number(score.education_match ?? 0) },
                                ]}
                              />
                            </div>

                            {explanation && (
                              <div className="grid md:grid-cols-2 gap-4">
                                {explanation.summary && (
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardDescription>AI Summary</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <p className="text-sm">{explanation.summary}</p>
                                    </CardContent>
                                  </Card>
                                )}

                                {(explanation.strong_matches as string[])?.length > 0 && (
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardDescription>Strong Matches</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <ul className="text-sm space-y-1">
                                        {(explanation.strong_matches as string[]).map((m) => (
                                          <li key={m} className="text-emerald-700">✓ {m}</li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                )}

                                {(explanation.missing_skills as string[])?.length > 0 && (
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardDescription>Missing Skills</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <ul className="text-sm space-y-1">
                                        {(explanation.missing_skills as string[]).map((s) => (
                                          <li key={s} className="text-red-600">✗ {s}</li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                )}

                                {(explanation.recommendations as string[])?.length > 0 && (
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardDescription>Recommendations</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <ul className="text-sm space-y-1">
                                        {(explanation.recommendations as string[]).map((r) => (
                                          <li key={r}>→ {r}</li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Role-fit score not yet calculated for this applicant.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
