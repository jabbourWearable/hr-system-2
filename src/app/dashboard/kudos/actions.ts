"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { KUDOS_CATEGORIES } from "./categories";

export type KudosFormState = { error: string } | undefined;

export async function giveKudos(
  _prevState: KudosFormState,
  formData: FormData,
): Promise<KudosFormState> {
  const user = await requireUser();

  const recipientId = String(formData.get("recipientId") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (!recipientId) return { error: "Choose a colleague to recognize." };
  if (recipientId === user.id) return { error: "You can't give kudos to yourself." };
  if (!KUDOS_CATEGORIES.includes(category as (typeof KUDOS_CATEGORIES)[number])) {
    return { error: "Choose a category." };
  }
  if (!message) return { error: "Add a short message." };
  if (message.length > 500) return { error: "Keep it under 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("kudos").insert({
    giver_id: user.id,
    recipient_id: recipientId,
    category,
    message,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/kudos");
  return undefined;
}
