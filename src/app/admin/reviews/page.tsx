import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CycleStatusBadge } from "@/components/performance/status-badges";

// Admin-only review-cycle overview (HR-78 — hibob-style Performance
// module). Gated by requireRole('admin') here — see ARCHITECTURE.md's note
// that every page under /admin must call this itself.
// review_cycles_admin_all (0010_performance_reviews_goals.sql) grants the
// unrestricted read.
export default async function AdminReviewsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: cycles } = await supabase
    .from("review_cycles")
    .select("id, name, status, start_date, end_date, created_at")
    .order("created_at", { ascending: false });

  const cycleIds = (cycles ?? []).map((c) => c.id);
  const { data: reviews } = cycleIds.length
    ? await supabase.from("performance_reviews").select("cycle_id, status").in("cycle_id", cycleIds)
    : { data: [] };

  const countsByCycle = new Map<string, { total: number; completed: number }>();
  for (const review of reviews ?? []) {
    const counts = countsByCycle.get(review.cycle_id) ?? { total: 0, completed: 0 };
    counts.total += 1;
    if (review.status === "completed") counts.completed += 1;
    countsByCycle.set(review.cycle_id, counts);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Performance reviews</h1>
          <p className="text-sm text-mute">Review cycles, self &amp; manager assessments.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/reviews/new" className="btn btn-primary">
            New cycle
          </Link>
          <Link href="/admin" className="text-sm font-medium text-link hover:underline">
            Back to admin
          </Link>
        </div>
      </div>

      {!cycles || cycles.length === 0 ? (
        <p className="text-sm text-mute">No review cycles yet.</p>
      ) : (
        <ul className="space-y-3">
          {cycles.map((cycle) => {
            const counts = countsByCycle.get(cycle.id) ?? { total: 0, completed: 0 };
            return (
              <li key={cycle.id}>
                <Link
                  href={`/admin/reviews/${cycle.id}`}
                  className="card flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-stone"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{cycle.name}</p>
                      <CycleStatusBadge status={cycle.status} />
                    </div>
                    {(cycle.start_date || cycle.end_date) && (
                      <p className="font-mono text-[13px] text-mute">
                        {cycle.start_date ?? "—"} – {cycle.end_date ?? "—"}
                      </p>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-mono text-[13px] text-mute">
                    {counts.completed}/{counts.total} reviews completed
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
