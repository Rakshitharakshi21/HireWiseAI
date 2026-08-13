"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brain, Briefcase, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import type { UserRole } from "@/types";

export default function RoleSelectionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");

  async function handleContinue() {
    if (!selectedRole) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: selectedRole, onboarding_completed: true })
      .eq("id", user.id);

    if (profileError) {
      toast({ title: "Error", description: profileError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (selectedRole === "candidate") {
      const { error } = await supabase.from("candidate_profiles").insert({
        user_id: user.id,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      router.push("/candidate/dashboard");
    } else {
      if (!companyName.trim()) {
        toast({ title: "Company name is required", variant: "destructive" });
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("recruiter_profiles").insert({
        user_id: user.id,
        company_name: companyName.trim(),
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      router.push("/recruiter/dashboard");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Brain className="h-10 w-10 text-brand-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Welcome to HireWise AI</h1>
          <p className="text-gray-600 mt-2">How will you be using the platform?</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setSelectedRole("candidate")}
            className={`rounded-xl border-2 p-6 text-left transition-all ${
              selectedRole === "candidate"
                ? "border-brand-600 bg-brand-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <User className="h-8 w-8 text-brand-600 mb-3" />
            <h3 className="font-semibold">Candidate</h3>
            <p className="text-sm text-gray-600 mt-1">Find jobs, optimize resume, practice interviews</p>
          </button>

          <button
            onClick={() => setSelectedRole("recruiter")}
            className={`rounded-xl border-2 p-6 text-left transition-all ${
              selectedRole === "recruiter"
                ? "border-brand-600 bg-brand-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Briefcase className="h-8 w-8 text-brand-600 mb-3" />
            <h3 className="font-semibold">Recruiter</h3>
            <p className="text-sm text-gray-600 mt-1">Post jobs, review candidates, monitor fairness</p>
          </button>
        </div>

        {selectedRole === "recruiter" && (
          <div className="mb-6">
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
              className="mt-1"
            />
          </div>
        )}

        <Button
          className="w-full"
          disabled={!selectedRole}
          loading={loading}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
