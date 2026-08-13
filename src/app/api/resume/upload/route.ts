import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractTextFromFile, validateResumeFile } from "@/lib/services/resume-parser";
import { parseResumeWithAI, analyzeResumeWithAI } from "@/lib/services/resume-analysis";
import { createNotification } from "@/lib/services/notifications";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: candidate } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const validation = validateResumeFile(file);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    const serviceClient = await createServiceClient();
    const { error: uploadError } = await serviceClient.storage
      .from("resumes")
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const rawText = await extractTextFromFile(buffer, file.type);
    const parsedData = await parseResumeWithAI(rawText);
    const { healthScore, analysis } = await analyzeResumeWithAI(rawText, parsedData);

    await supabase.from("resumes").update({ is_primary: false }).eq("candidate_id", candidate.id);

    const { data: resume, error: dbError } = await supabase
      .from("resumes")
      .insert({
        candidate_id: candidate.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        is_primary: true,
        parsed_data: parsedData,
        raw_text: rawText,
        health_score: healthScore,
        health_analysis: analysis,
      })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    if (parsedData.skills?.length) {
      const skillRows = parsedData.skills.map((skill) => ({
        candidate_id: candidate.id,
        skill_name: skill,
        source: "resume",
      }));
      await supabase.from("candidate_skills").upsert(skillRows, { onConflict: "candidate_id,skill_name" });
    }

    await createNotification(
      user.id,
      "resume_analysis_complete",
      "Resume Analysis Complete",
      `Your resume scored ${healthScore}/100. View the full analysis in your dashboard.`,
      { resume_id: resume.id, health_score: healthScore }
    );

    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ error: "Failed to process resume" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: candidate } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) return NextResponse.json({ resumes: [] });

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ resumes: resumes || [] });
}
