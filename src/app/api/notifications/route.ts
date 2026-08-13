import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50", 10), 100);

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq("is_read", false);

    const { data: notifications, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const { notificationId, markAllRead } = await request.json() as {
      notificationId?: string;
      markAllRead?: boolean;
    };

    if (markAllRead) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId or markAllRead required" }, { status: 400 });
    }

    const { data: notification, error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!notification) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Notifications update error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
