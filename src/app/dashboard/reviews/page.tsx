import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/performance/profiles";
import { ReviewStatusBadge } from "@/components/performance/status-badges";

// Employee-facing performance review index (HR-78). Two independent
// sections, same "own + assigned to you" shape as /dashboard/onboarding:
// reviews about the current user (self-assessment) and reviews the current
// user is the reviewer for (a manager's direct reports). RLS
// (performance_reviews_select_own / _select_reviewer,
// 0010_performance_reviews_goals.sql) already scopes both queries.
export default async function DashboardReviewsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: myReviews }, { data: reviewingReviews }] = await Promise.all([
    supabase
      .from("performance_reviews")
      .select("id, cycle_id, status, rating")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("performance_reviews")
      .select("id, cycle_id, employee_id, status, rating")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const cycleIds = [
    ...new Set([...(myReviews ?? []), ...(reviewingReviews ?? [])].map((r) => r.cycle_id)),
  ];
  const { data: cycles } = cycleIds.length
    ? await supabase.from("review_cycles").select("id, name").in("id", cycleIds)
    : { data: [] };
  const cycleNameById = new Map((cycles ?? []).map((c) => [c.id, c.name]));

  const employeeIds = [...new Set((reviewingReviews ?? []).map((r) => r.employee_id))];
  const profileMap = await loadProfilesByIds(supabase, employeeIds);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Performance reviews</h1>
          <p className="text-sm text-mute">Your reviews and any you&apos;re writing.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Your reviews</h2>
        {!myReviews || myReviews.length === 0 ? (
          <p className="text-sm text-mute">No review cycles yet.</p>
        ) : (
          <ul className="card divide-y divide-hairline">
            {myReviews.map((review) => (
              <li key={review.id}>
                <Link
                  href={`/dashboard/reviews/${review.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated"
                >
                  <p className="text-sm font-medium text-ink">
                    {cycleNameById.get(review.cycle_id) ?? "Review cycle"}
                  </p>
                  <div className="flex items-center gap-3">
                    {review.rating != null && (
                      <span className="font-mono text-sm text-ink">{review.rating}/5</span>
                    )}
                    <ReviewStatusBadge status={review.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviewingReviews && reviewingReviews.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-label">Reviews you&apos;re writing</h2>
          <ul className="card divide-y divide-hairline">
            {reviewingReviews.map((review) => (
              <li key={review.id}>
                <Link
                  href={`/dashboard/reviews/${review.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-ink">
                      {profileMap.get(review.employee_id)?.fullName ?? "Unknown employee"}
                    </p>
                    <p className="text-sm text-mute">
                      {cycleNameById.get(review.cycle_id) ?? "Review cycle"}
                    </p>
                  </div>
                  <ReviewStatusBadge status={review.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
