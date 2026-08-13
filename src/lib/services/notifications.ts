import { createServiceClient } from "@/lib/supabase/server";
import type { Notification } from "@/types";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<Notification | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, type, title, message, metadata })
    .select()
    .single();

  if (error) {
    console.error("Failed to create notification:", error);
    return null;
  }

  await sendTelegramNotificationIfLinked(userId, title, message);

  return data;
}

async function sendTelegramNotificationIfLinked(
  userId: string,
  title: string,
  message: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const supabase = await createServiceClient();

  const { data: telegramAccount } = await supabase
    .from("telegram_accounts")
    .select("telegram_chat_id")
    .eq("user_id", userId)
    .eq("status", "linked")
    .single();

  if (!telegramAccount?.telegram_chat_id) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramAccount.telegram_chat_id,
        text: `🔔 *${title}*\n\n${message}`,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
}

export async function notifyApplicationStatusChange(
  candidateUserId: string,
  jobTitle: string,
  company: string,
  newStatus: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    under_review: "Under Review",
    shortlisted: "Shortlisted",
    interview: "Interview Scheduled",
    rejected: "Not Selected",
    selected: "Selected",
  };

  await createNotification(
    candidateUserId,
    "status_updated",
    "Application Status Updated",
    `Your application for ${jobTitle} at ${company} is now: ${statusLabels[newStatus] || newStatus}`,
    { job_title: jobTitle, company, status: newStatus }
  );
}

export async function notifyNewApplication(
  recruiterUserId: string,
  candidateName: string,
  jobTitle: string
): Promise<void> {
  await createNotification(
    recruiterUserId,
    "new_application",
    "New Application Received",
    `${candidateName} applied for ${jobTitle}`,
    { candidate_name: candidateName, job_title: jobTitle }
  );
}
