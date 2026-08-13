import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  optimizeResumeForJob,
  generateResumePDF,
  generateResumeDOCX,
} from "@/lib/services/resume-optimizer";
import { requireUser, requireCandidate } from "@/lib/api/helpers";
import type { Job, ParsedResumeData } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const candidateResult = await requireCandidate(supabase, user.id);
    if ("error" in candidateResult) return candidateResult.error;
    const { candidate } = candidateResult;

    const { jobId, resumeId } = await request.json();
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    let resumeQuery = supabase.from("resumes").select("*").eq("candidate_id", candidate.id);
    if (resumeId) {
      resumeQuery = resumeQuery.eq("id", resumeId);
    } else {
      resumeQuery = resumeQuery.eq("is_primary", true);
    }

    const { data: resume } = await resumeQuery.single();
    if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

    const result = await optimizeResumeForJob(
      resume.parsed_data as ParsedResumeData,
      resume.raw_text,
      job as Job
    );

    const serviceClient = await createServiceClient();
    const basePath = `${user.id}/optimized/${Date.now()}`;
    const pdfPath = `${basePath}.pdf`;
    const docxPath = `${basePath}.docx`;

    const [pdfBuffer, docxBuffer] = await Promise.all([
      generateResumePDF(result.optimized_content),
      generateResumeDOCX(result.optimized_content),
    ]);

    await Promise.all([
      serviceClient.storage.from("optimized-resumes").upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      }),
      serviceClient.storage.from("optimized-resumes").upload(docxPath, docxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      }),
    ]);

    const { data: optimization, error } = await supabase
      .from("resume_optimizations")
      .insert({
        candidate_id: candidate.id,
        resume_id: resume.id,
        job_id: jobId,
        optimized_content: result.optimized_content,
        changes_summary: result.changes_summary,
        pdf_path: pdfPath,
        docx_path: docxPath,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ optimization });
  } catch (error) {
    console.error("Resume optimization error:", error);
    return NextResponse.json({ error: "Failed to optimize resume" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const candidateResult = await requireCandidate(supabase, user.id);
    if ("error" in candidateResult) return candidateResult.error;
    const { candidate } = candidateResult;

    const optimizationId = request.nextUrl.searchParams.get("optimizationId");
    const format = request.nextUrl.searchParams.get("format") || "pdf";

    if (!optimizationId) return NextResponse.json({ error: "Optimization ID required" }, { status: 400 });
    if (!["pdf", "docx"].includes(format)) {
      return NextResponse.json({ error: "Format must be pdf or docx" }, { status: 400 });
    }

    const { data: optimization } = await supabase
      .from("resume_optimizations")
      .select("*")
      .eq("id", optimizationId)
      .eq("candidate_id", candidate.id)
      .single();

    if (!optimization) return NextResponse.json({ error: "Optimization not found" }, { status: 404 });

    const filePath = format === "pdf" ? optimization.pdf_path : optimization.docx_path;
    if (!filePath) return NextResponse.json({ error: "File not available" }, { status: 404 });

    const serviceClient = await createServiceClient();
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("optimized-resumes")
      .download(filePath);

    if (downloadError || !fileData) {
      const content = optimization.optimized_content as ParsedResumeData;
      const buffer = format === "pdf"
        ? await generateResumePDF(content)
        : await generateResumeDOCX(content);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="optimized-resume.${format}"`,
        },
      });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="optimized-resume.${format}"`,
      },
    });
  } catch (error) {
    console.error("Resume download error:", error);
    return NextResponse.json({ error: "Failed to download optimized resume" }, { status: 500 });
  }
}
