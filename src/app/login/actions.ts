"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export type MagicLinkState = { error: string } | { sent: true } | undefined;

/**
 * Passwordless "email me a sign-in link" path (HR-88), alongside the
 * password form above. Lands the recipient on /auth/confirm, which calls
 * verifyOtp() and redirects to /dashboard — or back here with
 * ?error=link_expired if the token is stale/already used.
 */
export async function sendSignInLink(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();
  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host")}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Sign-IN only — a nonexistent address must not silently create a
      // bare auth.users row with no matching `profiles` row (which would
      // permanently break getAuthenticatedUser()'s profile lookup for that
      // user). New accounts still only come from /signup.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { sent: true };
}
