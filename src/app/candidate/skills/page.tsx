"use client";

import { useEffect, useState } from "react";
import { GraduationCap, AlertTriangle, CheckCircle, MinusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import type { Job, SkillGap, SkillLevel } from "@/types";

const LEVEL_CONFIG: Record<SkillLevel, { variant: "success" | "warning" | "destructive"; icon: typeof CheckCircle; label: string }> = {
  strong: { variant: "success", icon: CheckCircle, label: "Strong" },
  moderate: { variant: "warning", icon: MinusCircle, label: "Moderate" },
  missing: { variant: "destructive", icon: AlertTriangle, label: "Missing" },
};

export default function SkillsPage() {
  const { toast } = useToast();
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      const supabase = createClient();
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      setJobs(data || []);
      setLoadingJobs(false);
    }
    loadJobs();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setGaps([]);
      return;
    }

    async function loadGaps() {
      setLoadingGaps(true);
      try {
        const res = await fetch(`/api/skills/gaps?jobId=${selectedJobId}`);
        if (res.ok) {
          const data = await res.json();
          setGaps(data.gaps || []);
        } else {
          setGaps([]);
        }
      } catch {
        setGaps([]);
      } finally {
        setLoadingGaps(false);
      }
    }
    loadGaps();
  }, [selectedJobId]);

  async function handleAnalyze() {
    if (!selectedJobId) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/skills/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setGaps(data.gaps || []);
      toast({ title: "Skill gap analysis complete", variant: "success" });
    } catch (e) {
      toast({
        title: "Analysis failed",
        description: e instanceof Error ? e.message : "Upload your resume first",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const missingGaps = gaps.filter((g) => g.level === "missing");
  const moderateGaps = gaps.filter((g) => g.level === "moderate");
  const strongSkills = gaps.filter((g) => g.level === "strong");

  if (loadingJobs) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Skill Gaps</h1>
        <p className="text-muted-foreground mt-1">
          Identify skills to develop for your target role
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Target Job</CardTitle>
          <CardDescription>
            Compare your resume skills against job requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-10 w-10" />}
              title="No published jobs"
              description="Browse jobs to analyze skill gaps for specific roles."
            />
          ) : (
            <>
              <div>
                <Label htmlFor="job">Job</Label>
                <select
                  id="job"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a job...</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} at {job.company}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleAnalyze} loading={analyzing} disabled={!selectedJobId}>
                Analyze Skill Gaps
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {loadingGaps && selectedJobId && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!loadingGaps && selectedJobId && gaps.length === 0 && !analyzing && (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={<GraduationCap className="h-10 w-10" />}
              title="No analysis yet"
              description="Run skill gap analysis to see how your skills compare to job requirements."
            />
          </CardContent>
        </Card>
      )}

      {gaps.length > 0 && selectedJob && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-red-600">{missingGaps.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Missing Skills</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-amber-600">{moderateGaps.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Needs Improvement</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-emerald-600">{strongSkills.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Strong Matches</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Skills for {selectedJob.title}</CardTitle>
              <CardDescription>Sorted by priority — focus on missing skills first</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...gaps].sort((a, b) => b.priority - a.priority).map((gap) => {
                  const config = LEVEL_CONFIG[gap.level];
                  const Icon = config.icon;
                  return (
                    <div
                      key={gap.id || gap.skill_name}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className={`h-5 w-5 shrink-0 ${
                          gap.level === "strong" ? "text-emerald-600" :
                          gap.level === "moderate" ? "text-amber-600" : "text-red-600"
                        }`} />
                        <div>
                          <p className="font-medium">{gap.skill_name}</p>
                          {gap.recommendation && (
                            <p className="text-sm text-muted-foreground mt-0.5">{gap.recommendation}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
