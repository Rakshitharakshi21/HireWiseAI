"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Copy, CheckCircle, Link2, Unlink, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/dashboard-components";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { TelegramAccount, TelegramLinkStatus } from "@/types";

const STATUS_CONFIG: Record<TelegramLinkStatus, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  linked: { label: "Connected", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  revoked: { label: "Disconnected", variant: "destructive" },
};

export default function TelegramPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [account, setAccount] = useState<TelegramAccount | null>(null);
  const [botUsername, setBotUsername] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account || null);
        setBotUsername(data.botUsername || "");
      }
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleGenerateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");

      setAccount(data.account);
      setBotUsername(data.botUsername || botUsername);
      toast({ title: "Link token generated", variant: "success" });
    } catch (e) {
      toast({
        title: "Failed to generate link",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  const botLink = account?.link_token && botUsername
    ? `https://t.me/${botUsername}?start=${account.link_token}`
    : null;

  async function handleCopy() {
    if (!botLink) return;
    await navigator.clipboard.writeText(botLink);
    setCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const status = account?.status || "pending";
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Telegram</h1>
        <p className="text-muted-foreground mt-1">
          Connect Telegram to receive job alerts and application updates
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>HireWise AI Telegram Bot</CardDescription>
              </div>
            </div>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "linked" ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900">Telegram connected</p>
                {account?.telegram_username && (
                  <p className="text-sm text-emerald-700 mt-1">
                    @{account.telegram_username}
                  </p>
                )}
                {account?.linked_at && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Linked {formatRelativeTime(account.linked_at)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Unlink className="h-10 w-10" />}
              title="Not connected"
              description="Generate a link token and open it in Telegram to connect your account."
            />
          )}
        </CardContent>
      </Card>

      {status !== "linked" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Generate Link Token
            </CardTitle>
            <CardDescription>
              Create a one-time link to connect your Telegram account. Tokens expire after 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGenerateToken} loading={generating}>
              Generate New Link
            </Button>

            {account?.link_token && (
              <div className="space-y-3 p-4 rounded-lg bg-gray-50 border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Your link token</p>
                  <code className="text-sm font-mono bg-white px-3 py-2 rounded border block break-all">
                    {account.link_token}
                  </code>
                </div>
                {account.link_token_expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(account.link_token_expires_at)}
                  </p>
                )}
                {botLink && botUsername && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <CheckCircle className="h-4 w-4 mr-1 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Copy Link
                    </Button>
                    <Button size="sm" asChild>
                      <a href={botLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open in Telegram
                      </a>
                    </Button>
                  </div>
                )}
                {!botUsername && (
                  <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                    Bot username not configured. Set TELEGRAM_BOT_USERNAME in your environment.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What you&apos;ll receive</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              Application status updates
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              New job recommendations
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              Interview reminders
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              Resume analysis notifications
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
