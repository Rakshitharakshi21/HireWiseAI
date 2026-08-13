"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain, LayoutDashboard, FileText, Briefcase, Target, MessageSquare,
  Sparkles, GraduationCap, LogOut, Menu, X, User, Send,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const candidateNav = [
  { href: "/candidate/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidate/resume", label: "Resume", icon: FileText },
  { href: "/candidate/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidate/applications", label: "Applications", icon: Target },
  { href: "/candidate/interview", label: "Interview Practice", icon: MessageSquare },
  { href: "/candidate/optimizer", label: "Resume Optimizer", icon: Sparkles },
  { href: "/candidate/skills", label: "Skill Gaps", icon: GraduationCap },
  { href: "/candidate/coach", label: "Career Coach", icon: Brain },
  { href: "/candidate/profile", label: "Profile", icon: User },
  { href: "/candidate/telegram", label: "Telegram", icon: Send },
];

export function CandidateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b h-14 flex items-center px-4">
        <button onClick={() => setMobileOpen(true)} className="mr-3">
          <Menu className="h-5 w-5" />
        </button>
        <Brain className="h-5 w-5 text-brand-600 mr-2" />
        <span className="font-semibold">HireWise AI</span>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <nav className="p-2">
              {candidateNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r flex-col z-30">
        <div className="p-6 border-b">
          <Link href="/candidate/dashboard" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-brand-600" />
            <span className="text-lg font-bold">HireWise AI</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {candidateNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start text-gray-600" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      <Link
        href="/candidate/telegram"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-colors"
        title="Connect Telegram"
      >
        <Send className="h-6 w-6" />
      </Link>
    </div>
  );
}
