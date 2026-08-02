"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordState = { error: string } | { sent: true } | undefined;

/**
 * Requests a recovery-link email (HR-88). Lands on /auth/confirm ->
 * /update-password once clicked, rather than requiring the caller to
 * already know their password.
 */
export async function requestPasswordReset(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();
  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { sent: true };
}
