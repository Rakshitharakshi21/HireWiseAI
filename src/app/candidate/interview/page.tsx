"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Play, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ScoreBreakdown } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatScore } from "@/lib/utils";
import type { InterviewType, Job, InterviewEvaluation } from "@/types";

interface ChatMessage {
  role: "interviewer" | "candidate" | "system";
  content: string;
}

interface InterviewSession {
  id: string;
  interview_type: InterviewType;
  status: string;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  answer_quality_score: number | null;
  relevance_score: number | null;
  evaluation: InterviewEvaluation | null;
}

const INTERVIEW_TYPES: { value: InterviewType; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "hr", label: "HR" },
  { value: "mixed", label: "Mixed" },
];

export default function InterviewPage() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [phase, setPhase] = useState<"setup" | "active" | "completed">("setup");

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          jobId: selectedJobId || undefined,
          interviewType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start interview");

      setSession(data.session);
      setMessages(data.messages || [{ role: "interviewer", content: data.message }]);
      setPhase("active");
    } catch (e) {
      toast({
        title: "Could not start interview",
        description: e instanceof Error ? e.message : "Upload your resume first",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !session) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "candidate", content: userMessage }]);
    setSending(true);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          sessionId: session.id,
          message: userMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      if (data.message) {
        setMessages((prev) => [...prev, { role: "interviewer", content: data.message }]);
      }
      if (data.endInterview) {
        await handleEnd(session.id);
      }
    } catch (e) {
      toast({
        title: "Message failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleEnd(sessionId?: string) {
    const id = sessionId || session?.id;
    if (!id) return;
    setEnding(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to end interview");

      setSession(data.session);
      setPhase("completed");
      toast({ title: "Interview complete", variant: "success" });
    } catch (e) {
      toast({
        title: "Could not finish interview",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setEnding(false);
    }
  }

  function handleReset() {
    setSession(null);
    setMessages([]);
    setPhase("setup");
    setInput("");
  }

  if (loadingJobs && phase === "setup") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Interview Practice</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered mock interviews tailored to your resume and target role
        </p>
      </div>

      {phase === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle>Start a Practice Session</CardTitle>
            <CardDescription>
              Select a job and interview type. Upload your resume first for personalized questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="job">Target Job (optional)</Label>
              <select
                id="job"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">General practice (no specific job)</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} at {job.company}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Interview Type</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INTERVIEW_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setInterviewType(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      interviewType === t.value
                        ? "bg-brand-50 border-brand-600 text-brand-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleStart} loading={starting}>
              <Play className="h-4 w-4 mr-1" />
              Start Interview
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "active" && (
        <Card className="flex flex-col h-[calc(100vh-12rem)] max-h-[700px]">
          <CardHeader className="border-b py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Live Interview</CardTitle>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {session?.interview_type}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleEnd()} loading={ending}>
                End Interview
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto py-4 space-y-4">
            {messages.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title="Waiting for first question..."
                description="The interviewer will begin shortly."
              />
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      msg.role === "candidate"
                        ? "bg-brand-600 text-white"
                        : msg.role === "system"
                          ? "bg-gray-100 text-muted-foreground italic"
                          : "bg-gray-100"
                    }`}
                  >
                    {msg.role === "interviewer" && (
                      <span className="text-xs font-semibold text-brand-600 block mb-1">
                        Interviewer
                      </span>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="border-t p-4 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} loading={sending} disabled={!input.trim()} size="icon" className="shrink-0 h-auto">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {phase === "completed" && session && (
        <div className="space-y-6">
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="py-6 flex items-center gap-4">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold">Interview Complete</h2>
                <p className="text-sm text-muted-foreground">
                  Overall score: {formatScore(session.overall_score ?? 0)}
                </p>
              </div>
              <Button variant="outline" className="ml-auto" onClick={handleReset}>
                Practice Again
              </Button>
            </CardContent>
          </Card>

          {session.overall_score != null && (
            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreBreakdown
                  scores={[
                    { label: "Technical", value: session.technical_score ?? 0 },
                    { label: "Communication", value: session.communication_score ?? 0 },
                    { label: "Answer Quality", value: session.answer_quality_score ?? 0 },
                    { label: "Relevance", value: session.relevance_score ?? 0 },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {session.evaluation && (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: "Strengths", items: session.evaluation.strengths },
                { title: "Weaknesses", items: session.evaluation.weaknesses },
                { title: "Recommendations", items: session.evaluation.recommendations },
              ].map((section) => (
                <Card key={section.title}>
                  <CardHeader>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {section.items?.length ? (
                      <ul className="space-y-1">
                        {section.items.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">None noted.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {session.evaluation?.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{session.evaluation.summary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
