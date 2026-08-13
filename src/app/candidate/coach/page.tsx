"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import type { Job } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What skills should I focus on developing next?",
  "How can I improve my resume for tech roles?",
  "What interview questions should I prepare for?",
  "How do I negotiate a better salary offer?",
];

export default function CoachPage() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

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

  async function handleSend(question?: string) {
    const text = (question || input).trim();
    if (!text) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch("/api/career-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          jobId: selectedJobId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (e) {
      toast({
        title: "Coach unavailable",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  if (loadingJobs) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Career Coach</h1>
        <p className="text-muted-foreground mt-1">
          Personalized career advice based on your profile, resume, and applications
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center">
              <Brain className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <CardTitle className="text-base">HireWise Career Coach</CardTitle>
              <CardDescription>Ask anything about your career journey</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="targetJob">Target Job Context (optional)</Label>
            <select
              id="targetJob"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">General career advice</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} at {job.company}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col h-[calc(100vh-20rem)] max-h-[600px]">
        <CardContent className="flex-1 overflow-y-auto py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-6">
              <EmptyState
                icon={<Sparkles className="h-10 w-10" />}
                title="Start a conversation"
                description="Ask the career coach for personalized advice based on your profile and job search."
              />
              <div className="grid gap-2 sm:grid-cols-2 max-w-lg mx-auto">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="text-left text-sm p-3 rounded-lg border hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <span className="text-xs font-semibold text-brand-600 mb-1 flex items-center gap-1">
                      <Brain className="h-3 w-3" /> Career Coach
                    </span>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="border-t p-4 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your career coach..."
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={() => handleSend()}
            loading={sending}
            disabled={!input.trim()}
            size="icon"
            className="shrink-0 h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
