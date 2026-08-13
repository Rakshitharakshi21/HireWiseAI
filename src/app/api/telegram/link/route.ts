import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/helpers";
import { generateLinkToken } from "@/lib/utils";

const TOKEN_TTL_MINUTES = 15;

export async function POST() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const token = generateLinkToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;

    const { data: existing } = await supabase
      .from("telegram_accounts")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      const { data: account, error } = await supabase
        .from("telegram_accounts")
        .update({
          link_token: token,
          link_token_expires_at: expiresAt,
          status: existing.status === "linked" ? "linked" : "pending",
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        token,
        expiresAt,
        botUsername,
        deepLink: botUsername ? `https://t.me/${botUsername}?start=${token}` : null,
        account,
      });
    }

    const { data: account, error } = await supabase
      .from("telegram_accounts")
      .insert({
        user_id: user.id,
        link_token: token,
        link_token_expires_at: expiresAt,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      token,
      expiresAt,
      botUsername,
      deepLink: botUsername ? `https://t.me/${botUsername}?start=${token}` : null,
      account,
    });
  } catch (error) {
    console.error("Telegram link token error:", error);
    return NextResponse.json({ error: "Failed to generate link token" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const { data: account } = await supabase
      .from("telegram_accounts")
      .select("id, status, telegram_username, linked_at, link_token_expires_at")
      .eq("user_id", user.id)
      .single();

    if (!account) {
      return NextResponse.json({
        linked: false,
        status: "not_configured",
        botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
      });
    }

    return NextResponse.json({
      linked: account.status === "linked",
      status: account.status,
      telegramUsername: account.telegram_username,
      linkedAt: account.linked_at,
      hasPendingToken: account.link_token_expires_at
        ? new Date(account.link_token_expires_at) > new Date()
        : false,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    });
  } catch (error) {
    console.error("Telegram status error:", error);
    return NextResponse.json({ error: "Failed to fetch Telegram status" }, { status: 500 });
  }
}
