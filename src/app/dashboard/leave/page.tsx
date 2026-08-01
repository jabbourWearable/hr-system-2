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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Leave requests</h1>
          <p className="text-sm text-mute">
            Submit a leave request and track its status.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      <section className="max-w-md space-y-3">
        <h2 className="section-label">New request</h2>
        <div className="card p-6">
          <LeaveRequestForm />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">My requests</h2>
        {!requests || requests.length === 0 ? (
          <p className="text-sm text-mute">No leave requests yet.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-hairline-strong text-left">
                <tr>
                  <th className="section-label px-4 py-3">Type</th>
                  <th className="section-label px-4 py-3">Dates</th>
                  <th className="section-label px-4 py-3">Reason</th>
                  <th className="section-label px-4 py-3">Status</th>
                  <th className="section-label px-4 py-3">Reviewer comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {requests.map((request) => (
                  <tr key={request.id} className="align-top">
                    <td className="px-4 py-3 capitalize text-ink">{request.leave_type}</td>
                    <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap">
                      {request.start_date} → {request.end_date}
                    </td>
                    <td className="max-w-xs px-4 py-3">{request.reason}</td>
                    <td className="px-4 py-3">
                      <LeaveStatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 text-mute">
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
