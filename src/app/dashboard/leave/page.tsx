import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LeaveStatusBadge } from "@/components/leave/status-badge";
import { LeaveRequestForm } from "./leave-request-form";

// Employee-facing leave request page (spec §5 items 6-7, HR-13). Gated by
// requireUser() directly here, not a shared layout — see ARCHITECTURE.md.
export default async function LeaveRequestsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, leave_type, reason, status, review_comment, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Leave requests</h1>
          <p className="text-sm text-foreground-muted">
            Submit a leave request and track its status.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      <section className="max-w-md space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          New request
        </h2>
        <LeaveRequestForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          My requests
        </h2>
        {!requests || requests.length === 0 ? (
          <p className="text-sm text-foreground-muted">No leave requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Dates</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Reviewer comment</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 capitalize">{request.leave_type}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {request.start_date} → {request.end_date}
                    </td>
                    <td className="max-w-xs px-3 py-2">{request.reason}</td>
                    <td className="px-3 py-2">
                      <LeaveStatusBadge status={request.status} />
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {request.review_comment ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
