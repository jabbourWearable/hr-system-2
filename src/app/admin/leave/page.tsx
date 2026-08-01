import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadRequesterProfiles } from "@/lib/leave/requester-profiles";
import { ReviewForm } from "@/components/leave/review-form";
import { reviewAsAdmin } from "./actions";

// Admin-only, company-wide pending leave approvals (spec §5 item 7 / §4
// Admin: "can approve/reject any leave request"). Gated by requireRole
// ('admin') here — see ARCHITECTURE.md's note that every page under /admin
// must call this itself, not rely on a shared layout.
export default async function AdminLeavePage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, leave_type, reason, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const profileMap = await loadRequesterProfiles(
    supabase,
    [...new Set((requests ?? []).map((request) => request.user_id))],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Leave approvals</h1>
          <p className="text-sm text-mute">
            All pending leave requests, company-wide.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-link hover:underline">
          Back to admin
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <p className="text-sm text-mute">No pending requests.</p>
      ) : (
        <ul className="max-w-2xl space-y-4">
          {requests.map((request) => {
            const requester = profileMap.get(request.user_id);
            return (
              <li key={request.id} className="card p-6">
                <div className="mb-2 space-y-0.5">
                  <p className="font-medium text-ink">
                    {requester?.fullName ?? "Unknown employee"}
                  </p>
                  <p className="text-sm capitalize text-mute">
                    {request.leave_type} ·{" "}
                    <span className="font-mono text-[13px] normal-case">
                      {request.start_date} → {request.end_date}
                    </span>
                  </p>
                </div>
                <p className="mb-4 text-sm">{request.reason}</p>
                <ReviewForm requestId={request.id} action={reviewAsAdmin} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
