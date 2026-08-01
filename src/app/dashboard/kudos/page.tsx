import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AvatarBadge } from "@/components/people/avatar-badge";
import { KUDOS_CATEGORIES } from "./categories";
import { KudosForm } from "./kudos-form";

type ProfileRow = {
  id: string;
  full_name: string | null;
  job_title: string | null;
};

type KudosRow = {
  id: string;
  giver_id: string;
  recipient_id: string;
  category: string;
  message: string;
  created_at: string;
};

export default async function KudosPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profiles }, { data: kudos }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, job_title").order("full_name"),
    supabase
      .from("kudos")
      .select("id, giver_id, recipient_id, category, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const profileRows = (profiles ?? []) as ProfileRow[];
  const kudosRows = (kudos ?? []) as KudosRow[];

  // No FK joins — resolve display names in JS.
  const nameMap = new Map(profileRows.map((p) => [p.id, p.full_name ?? "Someone"]));

  const colleagues = profileRows
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: p.id, fullName: p.full_name ?? "Someone" }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl sm:text-4xl">Kudos</h1>
          <p className="text-sm text-mute">
            Celebrate great work — recognize a colleague.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      <KudosForm colleagues={colleagues} categories={KUDOS_CATEGORIES} />

      <section className="space-y-3">
        <h2 className="section-label">Recent recognition</h2>
        {kudosRows.length === 0 ? (
          <p className="text-sm text-mute">
            No kudos yet — be the first to recognize someone.
          </p>
        ) : (
          <ul className="space-y-4">
            {kudosRows.map((k) => {
              const giverName = nameMap.get(k.giver_id) ?? "Someone";
              const recipientName = nameMap.get(k.recipient_id) ?? "Someone";
              return (
                <li key={k.id} className="card space-y-2 p-5">
                  <div className="flex items-center gap-3">
                    <AvatarBadge name={giverName} seed={k.giver_id} size={36} />
                    <p className="text-sm text-body">
                      <Link
                        href={`/dashboard/directory/${k.giver_id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {giverName}
                      </Link>{" "}
                      recognized{" "}
                      <Link
                        href={`/dashboard/directory/${k.recipient_id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {recipientName}
                      </Link>
                    </p>
                    <span className="ml-auto inline-flex items-center whitespace-nowrap rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs text-body">
                      {k.category}
                    </span>
                  </div>
                  <p className="text-body">{k.message}</p>
                  <p className="text-xs text-ash">
                    {new Date(k.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
