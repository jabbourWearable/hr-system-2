"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error: string } | undefined;

// Email confirmation is disabled on the Supabase project (spec §2), so
// signUp() returns an active session immediately — no "check your email"
// step. The corresponding `profiles` row (role defaults to 'employee' at
// the DB level; employee_code/manager_id/site_id stay null until an admin
// assigns them) is inserted right after, using the same request's now-
// authenticated client so RLS's `profiles_insert_self` policy allows it.
export async function signup(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Full name, email, and password are all required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Sign-up failed — please try again." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  redirect("/dashboard");
}
