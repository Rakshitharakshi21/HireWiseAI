import Link from "next/link";
import { ArrowRight, Brain, Shield, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-brand-600" />
            <span className="text-xl font-bold text-gray-900">HireWise AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Explainable & Bias-Aware AI Hiring
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6 text-balance">
            Fairer Hiring.<br />Smarter Careers.
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 text-balance">
            HireWise AI connects candidates, recruiters, and AI career intelligence
            with explainable role-fit scoring and independent fairness auditing.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">Sign In</Button>
            </Link>
          </div>
        </section>

        <section className="bg-gray-50 py-24">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16">Built for everyone in hiring</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Users,
                  title: "For Candidates",
                  desc: "Upload resumes, discover jobs, calculate role-fit scores, practice AI interviews, and get personalized career coaching.",
                },
                {
                  icon: Target,
                  title: "For Recruiters",
                  desc: "Create jobs, view explainable candidate rankings, manage pipelines, and monitor fairness with independent bias auditing.",
                },
                {
                  icon: Brain,
                  title: "AI Intelligence",
                  desc: "Semantic matching, skill gap analysis, resume optimization, adaptive interviews, and career roadmaps — all powered by real AI.",
                },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-xl border p-8 shadow-sm">
                  <item.icon className="h-10 w-10 text-brand-600 mb-4" />
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Why HireWise AI?</h2>
            <p className="text-gray-600 mb-12 max-w-xl mx-auto">
              Every score is explainable. Every audit is independent. No fake data. No black boxes.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Explainable Scoring", value: "5 Dimensions" },
                { label: "Fairness Auditing", value: "Independent" },
                { label: "AI Interviews", value: "Adaptive" },
                { label: "Career Coach", value: "Personalized" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border p-6">
                  <p className="text-2xl font-bold text-brand-600">{stat.value}</p>
                  <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} HireWise AI. Fairer Hiring. Smarter Careers.
        </div>
      </footer>
    </div>
  );
}
