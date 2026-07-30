import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely —
 * never import this into a Client Component, and never send
 * SUPABASE_SERVICE_ROLE_KEY to the browser.
 *
 * Use only where RLS structurally can't authorize the write, e.g. inserting
 * a `notifications` row for a *different* user when a manager/admin
 * approves or rejects that user's leave request (see
 * supabase/migrations/0002_rls_policies.sql, "notifications" section).
 * Every call site must apply its own authorization check first — this
 * client has no built-in guardrails.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
