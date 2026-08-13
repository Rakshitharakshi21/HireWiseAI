import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function requireUser(): Promise<
  { user: User; supabase: SupabaseClient } | { error: Response }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, supabase };
}

export async function requireCandidate(supabase: SupabaseClient, userId: string) {
  const { data: candidate } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!candidate) {
    return { error: Response.json({ error: "Candidate profile not found" }, { status: 404 }) };
  }
  return { candidate };
}

export async function requireRecruiter(supabase: SupabaseClient, userId: string) {
  const { data: recruiter } = await supabase
    .from("recruiter_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!recruiter) {
    return { error: Response.json({ error: "Recruiter profile not found" }, { status: 403 }) };
  }
  return { recruiter };
}
