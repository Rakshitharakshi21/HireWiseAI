"use client";

import { useEffect, useState } from "react";
import { Sparkles, Download, FileText, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import type { Job, ResumeOptimization } from "@/types";

export default function OptimizerPage() {
  const { toast } = useToast();
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<ResumeOptimization | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

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
      setOptimization(null);
      return;
    }

    async function loadExisting() {
      setLoadingExisting(true);
      try {
        const res = await fetch(`/api/resume/optimize?jobId=${selectedJobId}`);
        if (res.ok) {
          const data = await res.json();
          setOptimization(data.optimization || null);
        }
      } catch {
        setOptimization(null);
      } finally {
        setLoadingExisting(false);
      }
    }
    loadExisting();
  }, [selectedJobId]);

  async function handleOptimize() {
    if (!selectedJobId) return;
    setOptimizing(true);
    try {
      const res = await fetch("/api/resume/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Optimization failed");

      setOptimization(data.optimization);
      toast({ title: "Resume optimized", variant: "success" });
    } catch (e) {
      toast({
        title: "Optimization failed",
        description: e instanceof Error ? e.message : "Upload your resume first",
        variant: "destructive",
      });
    } finally {
      setOptimizing(false);
    }
  }

  function handleDownload(format: "pdf" | "docx") {
    if (!optimization) return;
    const path = format === "pdf" ? optimization.pdf_path : optimization.docx_path;
    if (!path) {
      toast({
        title: "Download unavailable",
        description: `No ${format.toUpperCase()} file generated yet.`,
        variant: "destructive",
      });
      return;
    }
    window.open(path, "_blank");
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const changes = (optimization?.changes_summary as string[]) || [];

  if (loadingJobs) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Resume Optimizer</h1>
        <p className="text-muted-foreground mt-1">
          Tailor your resume for a specific job without inventing new experience
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Target Job</CardTitle>
          <CardDescription>
            AI will rewrite and reorder your existing resume content for the selected role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No published jobs"
              description="Jobs must be published before you can optimize your resume for them."
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
              <Button
                onClick={handleOptimize}
                loading={optimizing}
                disabled={!selectedJobId}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Optimize Resume
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {loadingExisting && selectedJobId && (
        <Skeleton className="h-48 rounded-xl" />
      )}

      {optimization && selectedJob && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Optimized for {selectedJob.title}</CardTitle>
                  <CardDescription>{selectedJob.company}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload("pdf")}
                    disabled={!optimization.pdf_path}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload("docx")}
                    disabled={!optimization.docx_path}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    DOCX
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {changes.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Changes Made
                  </h4>
                  <ul className="space-y-1">
                    {changes.map((change, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {change}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No change summary available.</p>
              )}
            </CardContent>
          </Card>

          {optimization.optimized_content && (
            <Card>
              <CardHeader>
                <CardTitle>Optimized Content Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {optimization.optimized_content.summary && (
                  <div>
                    <h4 className="font-semibold mb-1">Summary</h4>
                    <p className="text-muted-foreground">{optimization.optimized_content.summary}</p>
                  </div>
                )}
                {optimization.optimized_content.skills?.length ? (
                  <div>
                    <h4 className="font-semibold mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {optimization.optimized_content.skills.map((s) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {optimization.optimized_content.experience?.length ? (
                  <div>
                    <h4 className="font-semibold mb-2">Experience</h4>
                    {optimization.optimized_content.experience.map((exp, i) => (
                      <div key={i} className="mb-3 pb-3 border-b last:border-0">
                        <p className="font-medium">{exp.title} — {exp.company}</p>
                        {exp.description && (
                          <p className="text-muted-foreground mt-1">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedJobId && !optimization && !loadingExisting && !optimizing && (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={<Sparkles className="h-10 w-10" />}
              title="No optimization yet"
              description="Click Optimize Resume to generate a job-tailored version of your resume."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
