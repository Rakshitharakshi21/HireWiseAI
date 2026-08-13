"use client";

import { useEffect, useState } from "react";
import { User, Shield, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { CandidateProfile, EducationEntry } from "@/types";

function calculateCompleteness(profile: Partial<CandidateProfile>): number {
  const fields = [
    profile.phone,
    profile.location,
    profile.headline,
    profile.bio,
    profile.linkedin_url,
    profile.github_url,
    profile.portfolio_url,
    profile.years_of_experience != null,
    profile.current_title,
    profile.current_company,
    profile.education?.length,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [profile, setProfile] = useState<Partial<CandidateProfile>>({
    phone: "",
    location: "",
    headline: "",
    bio: "",
    linkedin_url: "",
    github_url: "",
    portfolio_url: "",
    years_of_experience: null,
    current_title: "",
    current_company: "",
    education: [],
    gender: null,
    age_group: null,
    demographic_consent: false,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: baseProfile }, { data: candidate }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("candidate_profiles").select("*").eq("user_id", user.id).single(),
      ]);

      setFullName(baseProfile?.full_name || "");
      if (candidate) {
        setProfile({
          ...candidate,
          education: (candidate.education as EducationEntry[]) || [],
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  function updateField<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Not signed in", variant: "destructive" });
      setSaving(false);
      return;
    }

    const completeness = calculateCompleteness(profile);

    const [{ error: nameError }, { error: profileError }] = await Promise.all([
      supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id),
      supabase.from("candidate_profiles").update({
        phone: profile.phone || null,
        location: profile.location || null,
        headline: profile.headline || null,
        bio: profile.bio || null,
        linkedin_url: profile.linkedin_url || null,
        github_url: profile.github_url || null,
        portfolio_url: profile.portfolio_url || null,
        years_of_experience: profile.years_of_experience,
        current_title: profile.current_title || null,
        current_company: profile.current_company || null,
        education: profile.education || [],
        gender: profile.demographic_consent ? profile.gender : null,
        age_group: profile.demographic_consent ? profile.age_group : null,
        demographic_consent: profile.demographic_consent ?? false,
        profile_completeness: completeness,
      }).eq("user_id", user.id),
    ]);

    if (nameError || profileError) {
      toast({
        title: "Save failed",
        description: nameError?.message || profileError?.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Profile saved", variant: "success" });
      setProfile((prev) => ({ ...prev, profile_completeness: completeness }));
    }
    setSaving(false);
  }

  const completeness = calculateCompleteness(profile);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your candidate profile and preferences
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save className="h-4 w-4 mr-1" />
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={completeness} className="flex-1" />
            <span className="text-sm font-semibold w-12 text-right">{completeness}%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={profile.headline || ""}
              onChange={(e) => updateField("headline", e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={profile.phone || ""}
              onChange={(e) => updateField("phone", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={profile.location || ""}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="City, Country"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="experience">Years of Experience</Label>
            <Input
              id="experience"
              type="number"
              min={0}
              step={0.5}
              value={profile.years_of_experience ?? ""}
              onChange={(e) =>
                updateField("years_of_experience", e.target.value ? parseFloat(e.target.value) : null)
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="currentTitle">Current Title</Label>
            <Input
              id="currentTitle"
              value={profile.current_title || ""}
              onChange={(e) => updateField("current_title", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="currentCompany">Current Company</Label>
            <Input
              id="currentCompany"
              value={profile.current_company || ""}
              onChange={(e) => updateField("current_company", e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio || ""}
              onChange={(e) => updateField("bio", e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Tell recruiters about yourself..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              value={profile.linkedin_url || ""}
              onChange={(e) => updateField("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="github">GitHub</Label>
            <Input
              id="github"
              value={profile.github_url || ""}
              onChange={(e) => updateField("github_url", e.target.value)}
              placeholder="https://github.com/..."
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="portfolio">Portfolio</Label>
            <Input
              id="portfolio"
              value={profile.portfolio_url || ""}
              onChange={(e) => updateField("portfolio_url", e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" />
            Demographic Data & Fairness
          </CardTitle>
          <CardDescription>
            Optional demographic information used solely for fairness auditing.
            This data is never used in scoring or hiring decisions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={profile.demographic_consent ?? false}
              onChange={(e) => updateField("demographic_consent", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <p className="font-medium text-sm">I consent to providing demographic data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your gender and age group will only be used in aggregate fairness audits
                to detect potential bias. Individual data is never shared with recruiters.
              </p>
            </div>
          </label>

          {profile.demographic_consent && (
            <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-brand-200">
              <div>
                <Label htmlFor="gender">Gender (optional)</Label>
                <select
                  id="gender"
                  value={profile.gender || ""}
                  onChange={(e) => updateField("gender", e.target.value || null)}
                  className="mt-1 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ageGroup">Age Group (optional)</Label>
                <select
                  id="ageGroup"
                  value={profile.age_group || ""}
                  onChange={(e) => updateField("age_group", e.target.value || null)}
                  className="mt-1 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Prefer not to say</option>
                  <option value="18-24">18–24</option>
                  <option value="25-34">25–34</option>
                  <option value="35-44">35–44</option>
                  <option value="45-54">45–54</option>
                  <option value="55+">55+</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
