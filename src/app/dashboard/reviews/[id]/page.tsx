import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/performance/profiles";
import { ReviewStatusBadge } from "@/components/performance/status-badges";
import { SelfAssessmentForm } from "../self-assessment-form";
import { ManagerAssessmentForm } from "../manager-assessment-form";

// Single review detail page shared by three viewers (HR-78): the employee
// (self-assessment section), the reviewer (manager-assessment + rating
// section), and admin/HR (read-only, reached via /admin/reviews/[cycleId]'s
// row links) — RLS (performance_reviews_select_own/_select_reviewer/
// _admin_all, 0010_performance_reviews_goals.sql) is what actually decides
// whether the row loads at all; the checks below only decide which sections
// render editable vs read-only for whoever it did load for.
export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("performance_reviews")
    .select(
      "id, cycle_id, employee_id, reviewer_id, status, self_assessment, self_submitted_at, manager_assessment, rating, manager_submitted_at",
    )
    .eq("id", id)
    .single();

  if (!review) notFound();

  const { data: cycle } = await supabase
    .from("review_cycles")
    .select("name")
    .eq("id", review.cycle_id)
    .single();

  const profileMap = await loadProfilesByIds(
    supabase,
    [review.employee_id, review.reviewer_id].filter(Boolean) as string[],
  );

  const isEmployee = user.id === review.employee_id;
  const isReviewer = user.id === review.reviewer_id;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display-serif text-3xl">
              {profileMap.get(review.employee_id)?.fullName ?? "Review"}
            </h1>
            <ReviewStatusBadge status={review.status} />
          </div>
          <p className="text-sm text-mute">
            {cycle?.name ?? "Review cycle"} · Reviewer:{" "}
            {review.reviewer_id
              ? (profileMap.get(review.reviewer_id)?.fullName ?? "Unknown")
              : "Unassigned"}
          </p>
        </div>
        <Link href="/dashboard/reviews" className="text-sm font-medium text-link hover:underline">
          Back to reviews
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Self-assessment</h2>
        {isEmployee && review.status === "pending_self" ? (
          <div className="card p-6">
            <SelfAssessmentForm reviewId={review.id} />
          </div>
        ) : review.self_assessment ? (
          <div className="card whitespace-pre-wrap p-6 text-sm text-body">
            {review.self_assessment}
          </div>
        ) : (
          <p className="text-sm text-mute">Not submitted yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Manager assessment</h2>
        {isReviewer && review.status === "pending_manager" ? (
          <div className="card p-6">
            <ManagerAssessmentForm reviewId={review.id} />
          </div>
        ) : review.manager_assessment ? (
          <div className="card space-y-3 p-6">
            <p className="whitespace-pre-wrap text-sm text-body">{review.manager_assessment}</p>
            {review.rating != null && (
              <p className="font-mono text-sm text-ink">Rating: {review.rating}/5</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-mute">
            {review.status === "pending_self"
              ? "Waiting on the self-assessment first."
              : "Not submitted yet."}
          </p>
        )}
      </section>
    </main>
  );
}
