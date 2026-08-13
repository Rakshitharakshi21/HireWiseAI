import { webhookCallback } from "grammy";
import { getBot } from "@/telegram/bot";

const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ error: "Bot not configured" }, { status: 503 });
  }

  const handler = webhookCallback(getBot(), "std/http", {
    secretToken: secretToken || undefined,
  });
  return handler(request);
}

export async function GET() {
  if (!secretToken) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  return Response.json({ status: "ok", mode: "webhook" });
}
