import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/signup"];
// /api/version is unauthenticated on purpose — the HR-73 deploy guard (CI +
// scripts/deploy-prod.sh) polls it from outside any logged-in session.
const PUBLIC_ROUTES = [...AUTH_ROUTES, "/", "/api/version"];

/**
 * Refreshes the Supabase session cookie on every request and performs an
 * *optimistic* auth check: is there a session at all. This intentionally
 * does not check `profiles.role` — Proxy runs on every route (including
 * prefetches) and the Next.js team recommends keeping it to a cheap,
 * cookie-only check. The real role check for /admin lives in
 * src/lib/auth/session.ts (requireRole), evaluated server-side per request
 * against the database — see ARCHITECTURE.md.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not add logic between createServerClient and auth.getUser() — it
  // can break session refresh in subtle ways (see @supabase/ssr docs).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.includes(path);
  const isPublicRoute = PUBLIC_ROUTES.includes(path);

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Must return this exact object (or a copy with the same cookies) so the
  // refreshed session cookie actually reaches the browser.
  return supabaseResponse;
}
