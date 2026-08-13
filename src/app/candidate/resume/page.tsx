"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ScoreDisplay } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatScore } from "@/lib/utils";
import type { Resume, ResumeHealthAnalysis } from "@/types";

export default function ResumePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);

  const loadResume = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume/upload");
      if (!res.ok) throw new Error("Failed to load resume");
      const data = await res.json();
      const primary = (data.resumes as Resume[])?.find((r) => r.is_primary) || data.resumes?.[0] || null;
      setResume(primary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load resume");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or DOCX file.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/resume/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setResume(data.resume);
      toast({
        title: "Resume uploaded",
        description: `Health score: ${data.resume.health_score}/100`,
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const analysis = resume?.health_analysis as ResumeHealthAnalysis | null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Resume</h1>
        <p className="text-muted-foreground mt-1">
          Upload your resume for AI-powered analysis and health scoring
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={loadResume}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload Resume</CardTitle>
          <CardDescription>PDF or DOCX, max 10MB. Replaces your primary resume.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleUpload}
          />
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center hover:border-brand-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">
              {uploading ? "Analyzing your resume..." : "Click to upload or drag and drop"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">PDF or DOCX</p>
            <Button className="mt-4" loading={uploading} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Choose File
            </Button>
          </div>
        </CardContent>
      </Card>

      {!resume ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No resume uploaded"
              description="Upload your resume to get a health score, strengths analysis, and personalized recommendations."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreDisplay
                  score={resume.health_score ?? 0}
                  label="Resume Health Score"
                  size="lg"
                />
                <div className="mt-4 text-center space-y-1">
                  <p className="font-medium truncate max-w-[200px]">{resume.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {formatDate(resume.created_at)}
                  </p>
                  <Badge variant="secondary">Primary</Badge>
                </div>
              </CardContent>
            </Card>

            {analysis && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Completeness", value: analysis.completeness_score },
                    { label: "Skills", value: analysis.skills_score },
                    { label: "Experience", value: analysis.experience_score },
                    { label: "Formatting", value: analysis.formatting_score },
                    { label: "ATS Readiness", value: analysis.ats_readiness_score },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{item.label}</span>
                        <span className="font-medium">{formatScore(item.value)}</span>
                      </div>
                      <Progress value={item.value ?? 0} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {analysis && (
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.strengths?.length ? (
                    <ul className="space-y-2">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-emerald-600 shrink-0">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No strengths identified yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Weaknesses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.weaknesses?.length ? (
                    <ul className="space-y-2">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-amber-600 shrink-0">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No weaknesses identified.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-brand-600" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.recommendations?.length ? (
                    <ul className="space-y-2">
                      {analysis.recommendations.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-brand-600 shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recommendations yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
