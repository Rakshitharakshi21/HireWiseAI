import { describe, it, expect } from "vitest";
import { calculateRoleFit } from "@/lib/services/role-fit-engine";
import type { ParsedResumeData, Job } from "@/types";

describe("Role Fit Engine", () => {
  const mockJob: Job = {
    id: "job-1",
    recruiter_id: "rec-1",
    title: "Software Engineer",
    company: "TechCorp",
    description: "Build web applications with React and Node.js",
    required_skills: ["JavaScript", "React", "Node.js"],
    preferred_skills: ["TypeScript", "PostgreSQL"],
    experience_min: 2,
    experience_max: 5,
    education_requirement: "Bachelor's in CS",
    location: "Remote",
    employment_type: "full_time",
    salary_min: 80000,
    salary_max: 120000,
    salary_currency: "USD",
    deadline: null,
    status: "published",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockResume: ParsedResumeData = {
    name: "John Doe",
    email: "john@example.com",
    skills: ["JavaScript", "React", "Node.js", "HTML", "CSS"],
    experience: [
      { company: "Startup", title: "Developer", start_date: "2021", end_date: "2024" },
    ],
    education: [{ institution: "University", degree: "BS", field: "Computer Science" }],
    projects: [{ name: "Web App", technologies: ["React", "Node.js"] }],
  };

  it("should calculate role fit score from real data", async () => {
    const result = await calculateRoleFit(mockResume, null, mockJob, 3);

    expect(result.overall_score).toBeGreaterThan(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
    expect(result.skills_match).toBeGreaterThan(50);
    expect(result.explanation.missing_skills).toBeDefined();
    expect(result.explanation.strong_matches).toBeDefined();
  });

  it("should identify missing required skills", async () => {
    const resumeWithGaps: ParsedResumeData = {
      ...mockResume,
      skills: ["HTML", "CSS"],
    };

    const result = await calculateRoleFit(resumeWithGaps, null, mockJob, 3);
    expect(result.skills_match).toBeLessThan(50);
    expect(result.explanation.missing_skills.length).toBeGreaterThan(0);
  });

  it("should not invent scores", async () => {
    const emptyResume: ParsedResumeData = { skills: [], experience: [], education: [] };
    const result = await calculateRoleFit(emptyResume, null, mockJob, null);

    expect(result.overall_score).toBeLessThan(60);
    expect(result.experience_match).toBeLessThanOrEqual(30);
  });
});
