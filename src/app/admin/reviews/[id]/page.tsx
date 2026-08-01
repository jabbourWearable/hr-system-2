import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/performance/profiles";
import { CycleStatusBadge, ReviewStatusBadge } from "@/components/performance/status-badges";
import { generateReviews, setCycleStatus } from "../actions";
import { GenerateReviewsButton } from "./generate-reviews-button";

export default async function AdminReviewCyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("review_cycles")
    .select("id, name, status, start_date, end_date")
    .eq("id", id)
    .single();

  if (!cycle) notFound();

  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("id, employee_id, reviewer_id, status, rating")
    .eq("cycle_id", id)
    .order("created_at", { ascending: true });

  const profileMap = await loadProfilesByIds(
    supabase,
    [...new Set((reviews ?? []).flatMap((r) => [r.employee_id, r.reviewer_id].filter(Boolean)))] as string[],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display-serif text-3xl">{cycle.name}</h1>
            <CycleStatusBadge status={cycle.status} />
          </div>
          {(cycle.start_date || cycle.end_date) && (
            <p className="font-mono text-[13px] text-mute">
              {cycle.start_date ?? "—"} – {cycle.end_date ?? "—"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <Link href="/admin/reviews" className="text-sm font-medium text-link hover:underline">
            Back to reviews
          </Link>
          <div className="flex gap-2">
            {cycle.status !== "active" && (
              <form action={setCycleStatus.bind(null, cycle.id, "active")}>
                <button type="submit" className="btn btn-outline btn-sm">
                  Activate
                </button>
              </form>
            )}
            {cycle.status !== "closed" && (
              <form action={setCycleStatus.bind(null, cycle.id, "closed")}>
                <button type="submit" className="btn btn-danger btn-sm">
                  Close cycle
                </button>
              </form>
            )}
            {cycle.status !== "draft" && (
              <form action={setCycleStatus.bind(null, cycle.id, "draft")}>
                <button type="submit" className="btn btn-outline btn-sm">
                  Revert to draft
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Reviews</h2>
          <GenerateReviewsButton action={generateReviews.bind(null, cycle.id)} />
        </div>
        {!reviews || reviews.length === 0 ? (
          <p className="text-sm text-mute">
            No reviews yet — generate one for every employee, or wait until the cycle starts.
          </p>
        ) : (
          <div className="card divide-y divide-hairline">
            {reviews.map((review) => (
              <Link
                key={review.id}
                href={`/dashboard/reviews/${review.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-ink">
                    {profileMap.get(review.employee_id)?.fullName ?? "Unknown employee"}
                  </p>
                  <p className="text-sm text-mute">
                    Reviewer:{" "}
                    {review.reviewer_id
                      ? (profileMap.get(review.reviewer_id)?.fullName ?? "Unknown")
                      : "Unassigned"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {review.rating != null && (
                    <span className="font-mono text-sm text-ink">{review.rating}/5</span>
                  )}
                  <ReviewStatusBadge status={review.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
