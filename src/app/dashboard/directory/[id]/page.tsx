import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AvatarBadge } from "@/components/people/avatar-badge";

function formatStartDate(value: string | null): string {
  if (!value) return "—";
  // start_date is a plain 'YYYY-MM-DD' date — pin it to UTC midnight so the
  // rendered day never shifts across the viewer's timezone.
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatKudosDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// A single person's directory profile (HR-68). No FK joins are configured, so
// the manager name, site name and kudos giver names are each resolved with a
// separate query and joined in JS (same pattern as the admin employees list).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, employee_code, role, manager_id, site_id, job_title, department, start_date, about",
    )
    .eq("id", id)
    .single();

  if (!profile) notFound();

  const [managerRes, siteRes, kudosRes] = await Promise.all([
    profile.manager_id
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", profile.manager_id)
          .single()
      : Promise.resolve({ data: null }),
    profile.site_id
      ? supabase.from("sites").select("name").eq("id", profile.site_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("kudos")
      .select("id, category, message, giver_id, created_at")
      .eq("recipient_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const manager = managerRes.data;
  const siteName = siteRes.data?.name ?? null;
  const kudos = kudosRes.data ?? [];

  // Resolve giver names in a single `in` query, then join in JS.
  const giverIds = Array.from(new Set(kudos.map((k) => k.giver_id)));
  const giverNameById = new Map<string, string>();
  if (giverIds.length > 0) {
    const { data: givers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", giverIds);
    for (const g of givers ?? []) giverNameById.set(g.id, g.full_name);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <Link
        href="/dashboard/directory"
        className="text-sm font-medium text-link hover:underline"
      >
        Back to directory
      </Link>

      <div className="card flex items-center gap-4 p-6">
        <AvatarBadge name={profile.full_name} seed={profile.id} size={72} />
        <div className="min-w-0 space-y-1">
          <h1 className="display-serif text-3xl">{profile.full_name}</h1>
          {profile.job_title && <p className="text-mute">{profile.job_title}</p>}
          {profile.department && (
            <span className="inline-flex items-center rounded-full border border-hairline-strong bg-elevated px-2 py-0.5 text-xs text-body">
              {profile.department}
            </span>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Details</h2>
        <dl className="card grid grid-cols-2 gap-x-6 gap-y-4 p-6 sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="section-label">Department</dt>
            <dd className="text-sm text-ink">{profile.department ?? "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="section-label">Email</dt>
            <dd className="break-all font-mono text-[13px] text-ink">
              {profile.email ?? "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="section-label">Employee code</dt>
            <dd className="font-mono text-[13px] text-ink">
              {profile.employee_code ?? "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="section-label">Manager</dt>
            <dd className="text-sm text-ink">
              {manager ? (
                <Link
                  href={`/dashboard/directory/${manager.id}`}
                  className="text-link hover:underline"
                >
                  {manager.full_name}
                </Link>
              ) : (
                "Not assigned"
              )}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="section-label">Site</dt>
            <dd className="text-sm text-ink">{siteName ?? "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="section-label">Start date</dt>
            <dd className="text-sm text-ink">{formatStartDate(profile.start_date)}</dd>
          </div>
        </dl>
      </section>

      {profile.about && (
        <section className="space-y-3">
          <h2 className="section-label">About</h2>
          <p className="max-w-2xl text-body">{profile.about}</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-label">Recognition</h2>
          <Link
            href="/dashboard/kudos"
            className="text-sm font-medium text-link hover:underline"
          >
            Give kudos →
          </Link>
        </div>

        {kudos.length === 0 ? (
          <p className="text-sm text-mute">No kudos yet.</p>
        ) : (
          <ul className="space-y-3">
            {kudos.map((k) => (
              <li key={k.id} className="card space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full border border-hairline-strong bg-elevated px-2 py-0.5 text-xs text-body">
                    {k.category}
                  </span>
                  <time className="text-xs text-ash">{formatKudosDate(k.created_at)}</time>
                </div>
                <p className="text-body">{k.message}</p>
                <p className="text-sm text-mute">
                  from {giverNameById.get(k.giver_id) ?? "Someone"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
