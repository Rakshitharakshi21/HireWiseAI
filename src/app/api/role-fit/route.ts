import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateRoleFit } from "@/lib/services/role-fit-engine";
import type { ParsedResumeData, Job } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    /*
     * =========================================================
     * 1. AUTHENTICATE USER
     * =========================================================
     */

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
     * =========================================================
     * 2. GET JOB ID
     * =========================================================
     */

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    /*
     * =========================================================
     * 3. GET CANDIDATE PROFILE
     * =========================================================
     */

    const {
      data: candidate,
      error: candidateError,
    } = await supabase
      .from("candidate_profiles")
      .select(
        "id, years_of_experience"
      )
      .eq("user_id", user.id)
      .single();

    if (candidateError || !candidate) {
      console.error(
        "Candidate profile lookup error:",
        candidateError
      );

      return NextResponse.json(
        {
          error:
            "Candidate profile not found",
        },
        { status: 404 }
      );
    }

    /*
     * =========================================================
     * 4. GET JOB
     * =========================================================
     */

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(
        "Job lookup error:",
        jobError
      );

      return NextResponse.json(
        {
          error: "Job not found",
        },
        { status: 404 }
      );
    }

    /*
     * =========================================================
     * 5. CHECK EXISTING ROLE-FIT SCORE
     * =========================================================
     */

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("role_fit_scores")
      .select(`
        *,
        role_fit_explanations(*)
      `)
      .eq("candidate_id", candidate.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing role-fit lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        { status: 500 }
      );
    }

    if (existing) {
      const explanation =
        Array.isArray(
          existing.role_fit_explanations
        )
          ? existing
              .role_fit_explanations[0]
          : existing.role_fit_explanations;

      return NextResponse.json({
        score: {
          ...existing,
          explanation,
        },
      });
    }

    /*
     * =========================================================
     * 6. GET CANDIDATE RESUME
     * =========================================================
     *
     * Your current resumes table uses:
     *
     * candidate_id
     * parsed
     * parsed_successfully
     *
     * We therefore don't use is_primary or raw_text here.
     * =========================================================
     */

    const {
      data: resume,
      error: resumeError,
    } = await supabase
      .from("resumes")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("parsed_successfully", true)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (resumeError) {
      console.error(
        "Resume lookup error:",
        resumeError
      );

      return NextResponse.json(
        {
          error:
            "Failed to load candidate resume",
        },
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

    /*
     * =========================================================
     * 7. GET PARSED RESUME DATA
     * =========================================================
     */

    const parsedResume =
      resume.parsed as ParsedResumeData | null;

    if (!parsedResume) {
      return NextResponse.json(
        {
          error:
            "Resume has not been parsed yet. Please upload your resume again.",
        },
        { status: 400 }
      );
    }

    /*
     * =========================================================
     * 8. GET RAW RESUME TEXT
     * =========================================================
     *
     * Your current resumes table doesn't expose raw_text
     * according to the schema you've shown.
     *
     * So safely check parsed JSON for possible raw text.
     * =========================================================
     */

    const parsedAny =
      parsedResume as unknown as Record<
        string,
        unknown
      >;

    const rawText =
      typeof parsedAny.raw_text ===
      "string"
        ? parsedAny.raw_text
        : typeof parsedAny.raw_resume_text ===
            "string"
          ? parsedAny.raw_resume_text
          : "";

    /*
     * =========================================================
     * 9. CALCULATE ROLE FIT
     * =========================================================
     */

    const fitResult =
      await calculateRoleFit(
        parsedResume,
        rawText,
        job as Job,
        candidate.years_of_experience ??
          0
      );

    if (!fitResult) {
      return NextResponse.json(
        {
          error:
            "Role-fit calculation returned no result",
        },
        { status: 500 }
      );
    }

    /*
     * =========================================================
     * 10. INSERT ROLE-FIT SCORE
     * =========================================================
     */

    const {
      data: score,
      error: scoreError,
    } = await supabase
      .from("role_fit_scores")
      .insert({
        candidate_id: candidate.id,
        job_id: jobId,

        overall_score:
          fitResult.overall_score,

        semantic_match:
          fitResult.semantic_match,

        skills_match:
          fitResult.skills_match,

        experience_match:
          fitResult.experience_match,

        project_relevance:
          fitResult.project_relevance,

        education_match:
          fitResult.education_match,

        scoring_metadata:
          fitResult.scoring_metadata,
      })
      .select()
      .single();

    if (scoreError) {
      console.error(
        "Role-fit score insert error:",
        scoreError
      );

      return NextResponse.json(
        {
          error:
            scoreError.message,
        },
        { status: 500 }
      );
    }

    /*
     * =========================================================
     * 11. INSERT AI EXPLANATION
     * =========================================================
     */

    let explanation = null;

    if (fitResult.explanation) {
      const {
        data: explanationData,
        error: explanationError,
      } = await supabase
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
        explanation =
          explanationData;
      }
    }

    /*
     * =========================================================
     * 12. RETURN RESULT
     * =========================================================
     */

    return NextResponse.json({
      score: {
        ...score,
        explanation,
      },
    });
  } catch (error) {
    console.error(
      "Role fit calculation error:",
      error
    );

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

/*
 * ============================================================
 * GET ROLE-FIT SCORE
 * ============================================================
 *
 * Used by candidate-side pages to retrieve an already
 * calculated role-fit score.
 */

export async function GET(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATE
     * ---------------------------------------------------------
     */

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. GET JOB ID
     * ---------------------------------------------------------
     */

    const jobId =
      request.nextUrl.searchParams.get(
        "jobId"
      );

    if (!jobId) {
      return NextResponse.json(
        {
          error: "Job ID required",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. GET CANDIDATE
     * ---------------------------------------------------------
     */

    const {
      data: candidate,
      error: candidateError,
    } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (
      candidateError ||
      !candidate
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate profile not found",
        },
        { status: 404 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. GET ROLE-FIT SCORE
     * ---------------------------------------------------------
     */

    const {
      data: score,
      error,
    } = await supabase
      .from("role_fit_scores")
      .select(`
        *,
        role_fit_explanations(*)
      `)
      .eq(
        "candidate_id",
        candidate.id
      )
      .eq("job_id", jobId)
      .maybeSingle();

    if (error) {
      console.error(
        "Role-fit GET error:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. NO SCORE
     * ---------------------------------------------------------
     */

    if (!score) {
      return NextResponse.json({
        score: null,
      });
    }

    /*
     * ---------------------------------------------------------
     * 6. NORMALIZE EXPLANATION
     * ---------------------------------------------------------
     */

    const explanation =
      Array.isArray(
        score.role_fit_explanations
      )
        ? score.role_fit_explanations[0]
        : score.role_fit_explanations;

    /*
     * ---------------------------------------------------------
     * 7. RETURN SCORE
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      score: {
        ...score,
        explanation,
      },
    });
  } catch (error) {
    console.error(
      "Role-fit GET error:",
      error
    );

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
