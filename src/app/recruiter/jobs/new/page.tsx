"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { EmploymentType } from "@/types";

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "remote", label: "Remote" },
];

export default function NewJobPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [preferredSkills, setPreferredSkills] = useState("");
  const [experienceMin, setExperienceMin] = useState("0");
  const [experienceMax, setExperienceMax] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [deadline, setDeadline] = useState("");

  async function handleSubmit(status: "draft" | "published") {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (description.trim().length < 10) {
      toast({ title: "Description must be at least 10 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company: "",
          description: description.trim(),
          required_skills: requiredSkills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          preferred_skills: preferredSkills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          experience_min: parseInt(experienceMin) || 0,
          experience_max: experienceMax ? parseInt(experienceMax) : null,
          location: location.trim() || null,
          employment_type: employmentType,
          salary_min: salaryMin ? parseInt(salaryMin) : null,
          salary_max: salaryMax ? parseInt(salaryMax) : null,
          deadline: deadline || null,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create job");

      toast({
        title: status === "published" ? "Job published" : "Draft saved",
        variant: "success",
      });
      router.push(`/recruiter/jobs/${data.job.id}`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/recruiter/jobs"
          className="mb-4 -ml-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
  
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Create Job
        </h1>
  
        <p className="text-muted-foreground mt-1">
          Post a new role and start receiving AI-ranked applications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <CardDescription>Provide the role information candidates will see</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, and requirements..."
              rows={6}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="requiredSkills">Required Skills</Label>
            <Input
              id="requiredSkills"
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              placeholder="React, TypeScript, Node.js (comma-separated)"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="preferredSkills">Preferred Skills</Label>
            <Input
              id="preferredSkills"
              value={preferredSkills}
              onChange={(e) => setPreferredSkills(e.target.value)}
              placeholder="GraphQL, AWS (comma-separated)"
              className="mt-1"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="experienceMin">Min Experience (years)</Label>
              <Input
                id="experienceMin"
                type="number"
                min="0"
                value={experienceMin}
                onChange={(e) => setExperienceMin(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="experienceMax">Max Experience (years)</Label>
              <Input
                id="experienceMax"
                type="number"
                min="0"
                value={experienceMax}
                onChange={(e) => setExperienceMax(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA or Remote"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="employmentType">Employment Type</Label>
              <select
                id="employmentType"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salaryMin">Salary Min (USD)</Label>
              <Input
                id="salaryMin"
                type="number"
                min="0"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="salaryMax">Salary Max (USD)</Label>
              <Input
                id="salaryMax"
                type="number"
                min="0"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="deadline">Application Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              loading={loading}
              onClick={() => handleSubmit("draft")}
              className="flex-1"
            >
              Save as Draft
            </Button>
            <Button
              loading={loading}
              onClick={() => handleSubmit("published")}
              className="flex-1"
            >
              Publish Job
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
