import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { scheduleOneOnOne } from "../actions";
import { NewOneOnOneForm } from "./new-one-on-one-form";

export default async function NewOneOnOnePage() {
  const user = await requireRole("manager");
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("manager_id", user.id)
    .order("full_name");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Schedule a 1:1</h1>
          <p className="text-sm text-mute">With one of your direct reports.</p>
        </div>
        <Link
          href="/dashboard/one-on-ones"
          className="text-sm font-medium text-link hover:underline"
        >
          Back to 1:1s
        </Link>
      </div>
      <div className="card max-w-md p-6">
        <NewOneOnOneForm
          action={scheduleOneOnOne}
          reports={(reports ?? []).map((r) => ({ id: r.id, fullName: r.full_name }))}
        />
      </div>
    </main>
  );
}
