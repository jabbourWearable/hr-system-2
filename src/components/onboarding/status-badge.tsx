import type { OnboardingTaskStatus, WorkflowType, WorkflowStatus } from "@/types/database";

// badge-pill + status-dot per DESIGN.md, same shape as
// src/components/leave/status-badge.tsx: a neutral elevated pill whose
// semantic colour lives in the dot, not the surface.
const TASK_DOT_STYLES: Record<OnboardingTaskStatus, string> = {
  pending: "bg-accent-yellow",
  in_progress: "bg-accent-blue",
  done: "bg-accent-green",
};

const TASK_LABELS: Record<OnboardingTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

export function TaskStatusBadge({ status }: { status: OnboardingTaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TASK_DOT_STYLES[status]}`} />
      {TASK_LABELS[status]}
    </span>
  );
}

const WORKFLOW_DOT_STYLES: Record<WorkflowStatus, string> = {
  active: "bg-accent-blue",
  completed: "bg-accent-green",
  cancelled: "bg-accent-red",
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium capitalize text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${WORKFLOW_DOT_STYLES[status]}`} />
      {status}
    </span>
  );
}

export function WorkflowTypeBadge({ type }: { type: WorkflowType }) {
  return (
    <span className="inline-flex items-center rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium capitalize text-body">
      {type}
    </span>
  );
}
