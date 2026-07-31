import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadRequesterProfiles } from "@/lib/leave/requester-profiles";
import { ReviewForm } from "@/components/leave/review-form";
import { reviewAsManager } from "./actions";

// Manager-only pending-approvals list (spec §5 item 7). RLS
// (leave_requests_select_manager) already scopes the query below to rows
// where the requester's manager_id is this manager — no extra filter
// needed here. Admin's broader "approve for anyone" capability lives at
// /admin/leave instead (its own requireRole('admin') page).
export default async function LeaveApprovalsPage() {
  await requireRole("manager");
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
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Leave approvals</h1>
          <p className="text-sm text-foreground-muted">
            Pending leave requests from your direct reports.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <p className="text-sm text-foreground-muted">No pending requests.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((request) => {
            const requester = profileMap.get(request.user_id);
            return (
              <li key={request.id} className="rounded-md border border-border p-4">
                <div className="mb-2">
                  <p className="font-medium">{requester?.fullName ?? "Unknown employee"}</p>
                  <p className="text-sm capitalize text-foreground-muted">
                    {request.leave_type} · {request.start_date} → {request.end_date}
                  </p>
                </div>
                <p className="mb-3 text-sm">{request.reason}</p>
                <ReviewForm requestId={request.id} action={reviewAsManager} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
