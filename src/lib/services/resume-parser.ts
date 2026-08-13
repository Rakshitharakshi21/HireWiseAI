import type { ParsedResumeData } from "@/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Only PDF and DOCX files are allowed" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size must be under 5MB" };
  }
  return { valid: true };
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text || "";
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDOCX(buffer);
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export function extractBasicInfo(text: string): Partial<ParsedResumeData> {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
  );

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0]?.length < 60 ? lines[0] : null;

  return {
    name: name || null,
    email: emailMatch?.[0] || null,
    phone: phoneMatch?.[0] || null,
  };
}
