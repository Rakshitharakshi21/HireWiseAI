"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, MapPin, Briefcase, CheckCircle, XCircle, Lightbulb,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScoreDisplay, ScoreBreakdown, EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import {
  EMPLOYMENT_TYPE_LABELS, formatDate, formatScore, getScoreColor,
} from "@/lib/utils";
import type { Job, RoleFitScore, RoleFitExplanation } from "@/types";

interface RoleFitResponse {
  score: (RoleFitScore & { explanation?: RoleFitExplanation; role_fit_explanations?: RoleFitExplanation[] }) | null;
}

export default function JobDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [roleFit, setRoleFit] = useState<RoleFitScore | null>(null);
  const [explanation, setExplanation] = useState<RoleFitExplanation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);

  const loadRoleFit = useCallback(async () => {
    const res = await fetch(`/api/role-fit?jobId=${jobId}`);
    if (!res.ok) return;
    const data: RoleFitResponse = await res.json();
    if (data.score) {
      setRoleFit(data.score);
      const exp = data.score.explanation ||
        (Array.isArray(data.score.role_fit_explanations)
          ? data.score.role_fit_explanations[0]
          : data.score.role_fit_explanations);
      setExplanation(exp || null);
    }
  }, [jobId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("status", "published")
        .single();

      if (jobError || !jobData) {
        setError("Job not found or no longer available.");
        setLoading(false);
        return;
      }

      setJob(jobData);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: candidate } = await supabase
          .from("candidate_profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (candidate) {
          const { data: application } = await supabase
            .from("applications")
            .select("id")
            .eq("candidate_id", candidate.id)
            .eq("job_id", jobId)
            .maybeSingle();
          setHasApplied(!!application);
        }
      }

      await loadRoleFit();
      setLoading(false);
    }

    load();
  }, [jobId, loadRoleFit]);

  async function handleCalculateFit() {
    setCalculating(true);
    try {
      const res = await fetch("/api/role-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate role fit");

      setRoleFit(data.score);
      setExplanation(data.score.explanation || null);
      toast({ title: "Role fit calculated", variant: "success" });
    } catch (e) {
      toast({
        title: "Calculation failed",
        description: e instanceof Error ? e.message : "Upload your resume first",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, coverLetter: coverLetter || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply");

      setHasApplied(true);
      setShowApplyForm(false);
      toast({ title: "Application submitted!", variant: "success" });
      await loadRoleFit();
    } catch (e) {
      toast({
        title: "Application failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <EmptyState
        icon={<Briefcase className="h-12 w-12" />}
        title="Job not found"
        description={error || "This job may have been removed or is no longer published."}
        action={
          <Button asChild>
            <Link href="/candidate/jobs">Back to Jobs</Link>
          </Button>
        }
      />
    );
  }

  const breakdownScores = roleFit
    ? [
        { label: "Skills Match", value: roleFit.skills_match ?? 0 },
        { label: "Experience Match", value: roleFit.experience_match ?? 0 },
        { label: "Semantic Match", value: roleFit.semantic_match ?? 0 },
        { label: "Project Relevance", value: roleFit.project_relevance ?? 0 },
        { label: "Education Match", value: roleFit.education_match ?? 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/candidate/jobs">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Jobs
        </Link>
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
            <Badge variant="secondary">
              {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!roleFit && (
            <Button onClick={handleCalculateFit} loading={calculating}>
              Calculate Role Fit
            </Button>
          )}
          {hasApplied ? (
            <Badge variant="success" className="py-2 px-4">Applied</Badge>
          ) : (
            <Button onClick={() => setShowApplyForm(true)}>Apply Now</Button>
          )}
        </div>
      </div>

      {showApplyForm && !hasApplied && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Application</CardTitle>
            <CardDescription>Optional cover letter to accompany your application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="coverLetter">Cover Letter (optional)</Label>
              <Textarea
                id="coverLetter"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell the recruiter why you're a great fit..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApply} loading={applying}>Submit Application</Button>
              <Button variant="outline" onClick={() => setShowApplyForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{job.description}</p>
            {job.required_skills?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {job.required_skills.map((s) => (
                    <Badge key={s} variant="default">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {job.preferred_skills?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Preferred Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {job.preferred_skills.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
              {job.experience_min > 0 && (
                <span>{job.experience_min}+ years experience</span>
              )}
              {job.salary_min && (
                <span>
                  {job.salary_currency} {job.salary_min.toLocaleString()}
                  {job.salary_max ? ` – ${job.salary_max.toLocaleString()}` : "+"}
                </span>
              )}
              {job.deadline && <span>Deadline: {formatDate(job.deadline)}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Role Fit</CardTitle>
          </CardHeader>
          <CardContent>
            {roleFit ? (
              <div className="space-y-4">
                <ScoreDisplay score={roleFit.overall_score} label="Overall Match" size="lg" />
                <p className="text-xs text-muted-foreground text-center">
                  Calculated {formatDate(roleFit.calculated_at)}
                </p>
              </div>
            ) : (
              <EmptyState
                title="No score yet"
                description="Upload your resume and calculate your role-fit score for this position."
                action={
                  <Button size="sm" onClick={handleCalculateFit} loading={calculating}>
                    Calculate Fit
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      {roleFit && (
        <Card>
          <CardHeader>
            <CardTitle>Why am I not 100%?</CardTitle>
            <CardDescription>
              Breakdown of your match score — overall:{" "}
              <span className={getScoreColor(roleFit.overall_score)}>
                {formatScore(roleFit.overall_score)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScoreBreakdown scores={breakdownScores} />

            {explanation && (
              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                {explanation.strong_matches?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      Strong Matches
                    </h4>
                    <ul className="space-y-1">
                      {explanation.strong_matches.map((m, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.missing_skills?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Missing Skills
                    </h4>
                    <ul className="space-y-1">
                      {explanation.missing_skills.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.recommendations?.length > 0 && (
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-brand-600" />
                      Recommendations
                    </h4>
                    <ul className="space-y-1">
                      {explanation.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.summary && (
                  <p className="md:col-span-2 text-sm bg-gray-50 p-4 rounded-lg">
                    {explanation.summary}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
