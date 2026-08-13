import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const publicRoutes = ["/", "/login", "/signup", "/auth/callback"];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/auth/")
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    if (!profile?.role) {
      url.pathname = "/onboarding/role";
    } else if (profile.role === "candidate") {
      url.pathname = "/candidate/dashboard";
    } else {
      url.pathname = "/recruiter/dashboard";
    }
    return NextResponse.redirect(url);
  }

  if (user && !isPublicRoute && !pathname.startsWith("/onboarding")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile?.role && pathname !== "/onboarding/role") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/role";
      return NextResponse.redirect(url);
    }

    if (profile?.role === "candidate" && pathname.startsWith("/recruiter")) {
      const url = request.nextUrl.clone();
      url.pathname = "/candidate/dashboard";
      return NextResponse.redirect(url);
    }

    if (profile?.role === "recruiter" && pathname.startsWith("/candidate")) {
      const url = request.nextUrl.clone();
      url.pathname = "/recruiter/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
