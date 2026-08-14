import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const jobSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string().min(10),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  experience_min: z.number().default(0),
  experience_max: z.number().nullable().optional(),
  education_requirement: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  employment_type: z.enum(["full_time", "part_time", "contract", "internship", "remote"]).default("full_time"),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  deadline: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: recruiter } = await supabase
      .from("recruiter_profiles")
      .select("id, company_name")
      .eq("user_id", user.id)
      .single();

    if (!recruiter) return NextResponse.json({ error: "Recruiter profile not found" }, { status: 404 });

    const body = await request.json();
    const parsed = jobSchema.parse(body);

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        recruiter_id: recruiter.id,
        ...parsed,
        company: parsed.company || recruiter.company_name,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (parsed.required_skills.length > 0) {
      const skillRows = parsed.required_skills.map((skill) => ({
        job_id: job.id,
        skill_name: skill,
        is_required: true,
      }));
      const prefRows = parsed.preferred_skills.map((skill) => ({
        job_id: job.id,
        skill_name: skill,
        is_required: false,
      }));
      await supabase.from("job_skills").insert([...skillRows, ...prefRows]);
    }

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Job creation error:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = request.nextUrl.searchParams.get("search") || "";
  const status = request.nextUrl.searchParams.get("status");
  const mine = request.nextUrl.searchParams.get("mine") === "true";

  let query = supabase.from("jobs").select("*").order("created_at", { ascending: false });

  if (mine) {
    const { data: recruiter } = await supabase
      .from("recruiter_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!recruiter) return NextResponse.json({ jobs: [] });
    query = query.eq("recruiter_id", recruiter.id);
  } else {
    query = query.eq("status", "published");
  }

  if (status) query = query.eq("status", status);
  if (search) query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,description.ilike.%${search}%`);

  const { data: jobs } = await query;
  return NextResponse.json({ jobs: jobs || [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId, ...updates } = await request.json();

  const { data: recruiter } = await supabase
    .from("recruiter_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!recruiter) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { data: job, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", jobId)
    .eq("recruiter_id", recruiter.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job });
}
