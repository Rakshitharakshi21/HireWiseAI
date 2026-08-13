"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  AlertTriangle,
  BarChart3,
  Play,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { FairnessAudit, FairnessAlert, Job } from "@/types";

function alertVariant(severity: FairnessAlert["severity"]) {
  const map = { low: "secondary" as const, medium: "warning" as const, high: "destructive" as const };
  return map[severity];
}

function confidenceLabel(level: string | null) {
  if (level === "insufficient") return { label: "Insufficient Data", variant: "secondary" as const };
  if (level === "high") return { label: "High Confidence", variant: "success" as const };
  if (level === "medium") return { label: "Medium Confidence", variant: "default" as const };
  return { label: "Low Confidence", variant: "warning" as const };
}

export default function FairnessMonitorPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [audits, setAudits] = useState<(FairnessAudit & { jobs?: { title: string } })[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = useCallback(async () => {
    const jobsRes = await fetch("/api/jobs?mine=true");
    const jobsData = await jobsRes.json();
    const jobList: Job[] = jobsData.jobs || [];
    setJobs(jobList);
    setSelectedJobId((prev) => prev || jobList[0]?.id || "");

    const auditsRes = await fetch("/api/fairness");
    const auditsData = await auditsRes.json();
    setAudits(auditsData.audits || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runAudit() {
    if (!selectedJobId) return;
    setRunning(true);
    try {
      const res = await fetch("/api/fairness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");

      setAudits((prev) => [data.audit, ...prev]);
      toast({ title: "Fairness audit completed", variant: "success" });
    } catch (err) {
      toast({
        title: "Audit failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  const jobAudits = audits.filter((a) => a.job_id === selectedJobId);
  const latestAudit = jobAudits[0] ?? null;
  const isInsufficient =
    latestAudit?.status === "insufficient_data" ||
    latestAudit?.confidence_level === "insufficient";

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Fairness Monitor
          </h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Independent bias monitoring — demographic data never influences role-fit scores
        </p>
      </div>

      <Card className="border-brand-100 bg-brand-50/30">
        <CardContent className="p-4 flex gap-3">
          <Info className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Audits analyze selection patterns across demographic groups using only consented,
            voluntarily-provided data. This layer is completely independent from AI scoring.
          </p>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Shield className="h-12 w-12" />}
              title="No jobs to audit"
              description="Create and publish a job with applicants before running fairness audits."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Run Audit</CardTitle>
              <CardDescription>
                Select a job and run a fairness analysis on its applicant pool
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.status})
                  </option>
                ))}
              </select>
              <Button loading={running} onClick={runAudit}>
                <Play className="h-4 w-4" /> Run Audit
              </Button>
            </CardContent>
          </Card>

          {!latestAudit ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<BarChart3 className="h-12 w-12" />}
                  title="No audits yet"
                  description="Run your first fairness audit to see demographic parity metrics and disparity alerts."
                  action={
                    <Button loading={running} onClick={runAudit}>
                      <Play className="h-4 w-4" /> Run First Audit
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={confidenceLabel(latestAudit.confidence_level).variant}>
                  {confidenceLabel(latestAudit.confidence_level).label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Sample size: {latestAudit.sample_size} ·{" "}
                  {formatDate(latestAudit.created_at)}
                </span>
                {latestAudit.status === "attention_required" && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Attention Required
                  </Badge>
                )}
              </div>

              {isInsufficient ? (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="py-8">
                    <EmptyState
                      icon={<AlertTriangle className="h-10 w-10 text-amber-600" />}
                      title="Insufficient data"
                      description={
                        (latestAudit.alerts as FairnessAlert[])?.[0]?.message ||
                        "Not enough consented demographic data to run a reliable fairness analysis. At least 5 candidates with demographic consent are required."
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      title="Demographic Parity"
                      data={latestAudit.demographic_parity as Record<string, number>}
                      threshold={0.8}
                    />
                    <MetricCard
                      title="Selection Rate Ratio"
                      data={latestAudit.selection_rate_ratio as Record<string, number>}
                      threshold={0.8}
                    />
                    <MetricCard
                      title="Equal Opportunity (TPR)"
                      data={latestAudit.equal_opportunity as Record<string, number>}
                      threshold={0.8}
                      isRate
                    />
                  </div>

                  {(latestAudit.alerts as FairnessAlert[])?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" /> Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(latestAudit.alerts as FairnessAlert[]).map((alert, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 p-3 rounded-lg border"
                          >
                            <Badge variant={alertVariant(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {alert.type.replace(/_/g, " ")}
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {alert.message}
                              </p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {jobAudits.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Audit History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {jobAudits.slice(1, 6).map((audit) => (
                        <div
                          key={audit.id}
                          className="flex items-center justify-between p-3 rounded-lg border text-sm"
                        >
                          <span>{formatDate(audit.created_at)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              n={audit.sample_size}
                            </span>
                            <Badge variant={confidenceLabel(audit.confidence_level).variant}>
                              {audit.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  title,
  data,
  threshold,
  isRate,
}: {
  title: string;
  data: Record<string, number>;
  threshold: number;
  isRate?: boolean;
}) {
  const entries = Object.entries(data || {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([key, value]) => {
              const pct = isRate ? value * 100 : value * 100;
              const display = isRate
                ? `${(value * 100).toFixed(1)}%`
                : value.toFixed(2);
              const isBelow = !isRate && value < threshold && value > 0;

              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize truncate mr-2">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className={isBelow ? "text-red-600 font-medium" : "font-medium"}>
                      {display}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className={isBelow ? "[&>div]:bg-red-500" : ""}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
