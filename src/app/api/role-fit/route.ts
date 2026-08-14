import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateRoleFit } from "@/lib/services/role-fit-engine";
import type { ParsedResumeData, Job } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Get candidate profile
    // ---------------------------------------------------------
    const { data: candidate, error: candidateError } = await supabase
      .from("candidate_profiles")
      .select("id, years_of_experience")
      .eq("user_id", user.id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Candidate profile not found" },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 2. Get job
    // ---------------------------------------------------------
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 3. Check whether score already exists
    // ---------------------------------------------------------
    const { data: existing } = await supabase
      .from("role_fit_scores")
      .select(`
        *,
        role_fit_explanations(*)
      `)
      .eq("candidate_id", candidate.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        score: existing,
      });
    }

    // ---------------------------------------------------------
    // 4. Get candidate's resume
    //
    // Your actual resumes table contains:
    // parsed, parsed_successfully, candidate_id, etc.
    // ---------------------------------------------------------
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("parsed_successfully", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resumeError) {
      console.error("Resume lookup error:", resumeError);

      return NextResponse.json(
        { error: "Failed to load candidate resume" },
        { status: 500 }
      );
    }

    if (!resume) {
      return NextResponse.json(
        {
          error:
            "Upload and successfully parse your resume first to calculate role fit",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Read parsed resume data
    // ---------------------------------------------------------
    const parsedResume = resume.parsed as ParsedResumeData | null;

    if (!parsedResume) {
      return NextResponse.json(
        {
          error:
            "Resume has not been parsed yet. Please upload your resume again.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 6. Extract raw text if it exists inside parsed JSON
    //
    // We don't have a raw_text column in your current resumes
    // table, so safely look for it inside parsed.
    // ---------------------------------------------------------
    const parsedAny = parsedResume as unknown as Record<string, unknown>;

    const rawText =
      typeof parsedAny.raw_text === "string"
        ? parsedAny.raw_text
        : typeof parsedAny.raw_resume_text === "string"
          ? parsedAny.raw_resume_text
          : "";

    // ---------------------------------------------------------
    // 7. Calculate role fit
    // ---------------------------------------------------------
    const fitResult = await calculateRoleFit(
      parsedResume,
      rawText,
      job as Job,
      candidate.years_of_experience ?? 0
    );

    if (!fitResult) {
      return NextResponse.json(
        { error: "Role-fit calculation returned no result" },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 8. Save role-fit score
    // ---------------------------------------------------------
    const { data: score, error: scoreError } = await supabase
      .from("role_fit_scores")
      .insert({
        candidate_id: candidate.id,
        job_id: jobId,
        overall_score: fitResult.overall_score,
        semantic_match: fitResult.semantic_match,
        skills_match: fitResult.skills_match,
        experience_match: fitResult.experience_match,
        project_relevance: fitResult.project_relevance,
        education_match: fitResult.education_match,
        scoring_metadata: fitResult.scoring_metadata,
      })
      .select()
      .single();

    if (scoreError) {
      console.error("Role-fit score insert error:", scoreError);

      return NextResponse.json(
        { error: scoreError.message },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 9. Save explanation
    // ---------------------------------------------------------
    let explanation = null;

    if (fitResult.explanation) {
      const { data: explanationData, error: explanationError } =
        await supabase
          .from("role_fit_explanations")
          .insert({
            role_fit_score_id: score.id,
            ...fitResult.explanation,
          })
          .select()
          .single();

      if (explanationError) {
        console.error(
          "Role-fit explanation insert error:",
          explanationError
        );
      } else {
        explanation = explanationData;
      }
    }

    return NextResponse.json({
      score: {
        ...score,
        explanation,
      },
    });
  } catch (error) {
    console.error("Role fit calculation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate role fit",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    const { data: candidate } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate profile not found" },
        { status: 404 }
      );
    }

    const { data: score, error } = await supabase
      .from("role_fit_scores")
      .select(`
        *,
        role_fit_explanations(*)
      `)
      .eq("candidate_id", candidate.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (error) {
      console.error("Role-fit GET error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!score) {
      return NextResponse.json({
        score: null,
      });
    }

    const explanation = Array.isArray(score.role_fit_explanations)
      ? score.role_fit_explanations[0]
      : score.role_fit_explanations;

    return NextResponse.json({
      score: {
        ...score,
        explanation,
      },
    });
  } catch (error) {
    console.error("Role-fit GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load role fit",
      },
      { status: 500 }
    );
  }
}
