import type { LeaveStatus } from "@/types/database";

// badge-pill + status-dot per DESIGN.md: a neutral elevated pill whose
// semantic colour lives in the dot, not the surface (accents are never
// solid surfaces in this system).
const DOT_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-accent-yellow",
  approved: "bg-accent-green",
  rejected: "bg-accent-red",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium capitalize text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status]}`} />
      {status}
    </span>
  );
}
