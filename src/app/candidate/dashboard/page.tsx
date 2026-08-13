"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User, FileText, Briefcase, MessageSquare, GraduationCap, Bell,
  ArrowRight, Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard, EmptyState } from "@/components/shared/dashboard-components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatScore } from "@/lib/utils";
import type { DashboardStats, Notification } from "@/types";

export default function CandidateDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in to view your dashboard.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setUserName(profile?.full_name || "there");

      const { data: candidate } = await supabase
        .from("candidate_profiles")
        .select("id, profile_completeness")
        .eq("user_id", user.id)
        .single();

      if (!candidate) {
        setError("Candidate profile not found. Complete onboarding first.");
        setLoading(false);
        return;
      }

      const [
        { data: primaryResume },
        { count: applicationsCount },
        { count: interviewsCount },
        { count: skillGapsCount },
        { count: unreadNotifications },
        { data: recentNotifications },
      ] = await Promise.all([
        supabase
          .from("resumes")
          .select("health_score")
          .eq("candidate_id", candidate.id)
          .eq("is_primary", true)
          .maybeSingle(),
        supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("candidate_id", candidate.id),
        supabase
          .from("interview_sessions")
          .select("*", { count: "exact", head: true })
          .eq("candidate_id", candidate.id),
        supabase
          .from("skill_gaps")
          .select("*", { count: "exact", head: true })
          .eq("candidate_id", candidate.id)
          .neq("level", "strong"),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        profileCompleteness: candidate.profile_completeness ?? 0,
        resumeHealth: primaryResume?.health_score ?? null,
        applicationsCount: applicationsCount ?? 0,
        interviewsCount: interviewsCount ?? 0,
        skillGapsCount: skillGapsCount ?? 0,
        unreadNotifications: unreadNotifications ?? 0,
      });
      setNotifications(recentNotifications || []);
      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<User className="h-12 w-12" />}
        title="Unable to load dashboard"
        description={error}
        action={
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
    );
  }

  const hasAnyActivity =
    (stats?.applicationsCount ?? 0) > 0 ||
    stats?.resumeHealth != null ||
    (stats?.interviewsCount ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Welcome back, {userName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your job search progress
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Profile Completeness"
          value={formatScore(stats?.profileCompleteness ?? 0)}
          description="Complete your profile to stand out"
          icon={<User className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Resume Health"
          value={stats?.resumeHealth != null ? formatScore(stats.resumeHealth) : "—"}
          description={stats?.resumeHealth != null ? "Primary resume score" : "Upload a resume to get scored"}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Applications"
          value={stats?.applicationsCount ?? 0}
          description="Jobs you've applied to"
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Interviews"
          value={stats?.interviewsCount ?? 0}
          description="Practice sessions completed"
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Skill Gaps"
          value={stats?.skillGapsCount ?? 0}
          description="Areas to improve"
          icon={<GraduationCap className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Notifications"
          value={stats?.unreadNotifications ?? 0}
          description="Unread updates"
          icon={<Bell className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {!hasAnyActivity && (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={<Upload className="h-12 w-12" />}
              title="Get started with HireWise AI"
              description="Upload your resume and explore published jobs to unlock AI-powered insights, role-fit scoring, and interview practice."
              action={
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button asChild>
                    <Link href="/candidate/resume">Upload Resume</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/candidate/jobs">Browse Jobs</Link>
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Notifications</CardTitle>
            {(stats?.unreadNotifications ?? 0) > 0 && (
              <Badge variant="default">{stats?.unreadNotifications} new</Badge>
            )}
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No notifications yet. Activity will appear here.
              </p>
            ) : (
              <div className="space-y-4">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 p-3 rounded-lg ${!n.is_read ? "bg-brand-50/50" : ""}`}
                  >
                    <Bell className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/candidate/resume", label: "Upload or update resume", icon: FileText },
              { href: "/candidate/jobs", label: "Browse open positions", icon: Briefcase },
              { href: "/candidate/interview", label: "Practice an interview", icon: MessageSquare },
              { href: "/candidate/coach", label: "Ask the career coach", icon: User },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <action.icon className="h-4 w-4 text-brand-600" />
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
