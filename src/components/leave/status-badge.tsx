import type { LeaveStatus } from "@/types/database";

const STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  approved: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
