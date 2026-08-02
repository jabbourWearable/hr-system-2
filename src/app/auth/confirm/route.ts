import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing point for every Supabase email link (magic link / signup
// confirmation) — see HR-88. GoTrue's recommended `token_hash`+`type`
// query-string shape, verified server-side with verifyOtp() so the
// session cookie lands via our own @supabase/ssr client. proxy.ts must
// treat this route as public (see PUBLIC_ROUTES) since the visitor has no
// session yet when they arrive here.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error && data.user) {
      // Accounts that predate this app's own /signup (e.g. created directly
      // against this shared Supabase project before HR-88) can have an
      // auth.users row with no matching `profiles` row. Without this,
      // getAuthenticatedUser() finds no profile and requireUser() bounces
      // straight back to /login — a silent, confusing dead end right after
      // a *successful* verify. Backfill it here, same shape /signup uses.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();
      if (!profile) {
        const fallbackName =
          (data.user.user_metadata?.full_name as string | undefined) ||
          data.user.email?.split("@")[0] ||
          "New User";
        await supabase
          .from("profiles")
          .insert({ id: data.user.id, full_name: fallbackName });
      }
      redirect(next);
    }
  }

  redirect("/login?error=link_expired");
}
