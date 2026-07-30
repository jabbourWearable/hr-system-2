import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Runs as the calling user (anon key + their session
 * cookie), so Row Level Security still applies — this is not a privileged
 * client. For writes that must cross RLS (see
 * supabase/migrations/0002_rls_policies.sql), use `createAdminClient` from
 * ./admin instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render, where cookies can't
            // be set. Safe to ignore because proxy.ts refreshes the
            // session's cookies on every request.
          }
        },
      },
    },
  );
}
