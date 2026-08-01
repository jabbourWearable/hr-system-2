import type {
  GoalStatus,
  OneOnOneStatus,
  PerformanceReviewStatus,
  ReviewCycleStatus,
} from "@/types/database";

// badge-pill + status-dot per DESIGN.md, same shape as
// src/components/leave/status-badge.tsx and
// src/components/onboarding/status-badge.tsx: a neutral elevated pill whose
// semantic colour lives in the dot, not the surface.

const REVIEW_DOT_STYLES: Record<PerformanceReviewStatus, string> = {
  pending_self: "bg-accent-yellow",
  pending_manager: "bg-accent-blue",
  completed: "bg-accent-green",
};

const REVIEW_LABELS: Record<PerformanceReviewStatus, string> = {
  pending_self: "Awaiting self-assessment",
  pending_manager: "Awaiting manager review",
  completed: "Completed",
};

export function ReviewStatusBadge({ status }: { status: PerformanceReviewStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${REVIEW_DOT_STYLES[status]}`} />
      {REVIEW_LABELS[status]}
    </span>
  );
}

const CYCLE_DOT_STYLES: Record<ReviewCycleStatus, string> = {
  draft: "bg-accent-yellow",
  active: "bg-accent-blue",
  closed: "bg-accent-green",
};

export function CycleStatusBadge({ status }: { status: ReviewCycleStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium capitalize text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${CYCLE_DOT_STYLES[status]}`} />
      {status}
    </span>
  );
}

const GOAL_DOT_STYLES: Record<GoalStatus, string> = {
  not_started: "bg-mute",
  on_track: "bg-accent-green",
  at_risk: "bg-accent-orange",
  completed: "bg-accent-blue",
};

const GOAL_LABELS: Record<GoalStatus, string> = {
  not_started: "Not started",
  on_track: "On track",
  at_risk: "At risk",
  completed: "Completed",
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${GOAL_DOT_STYLES[status]}`} />
      {GOAL_LABELS[status]}
    </span>
  );
}

const ONE_ON_ONE_DOT_STYLES: Record<OneOnOneStatus, string> = {
  scheduled: "bg-accent-blue",
  completed: "bg-accent-green",
};

export function OneOnOneStatusBadge({ status }: { status: OneOnOneStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-elevated px-2.5 py-0.5 text-xs font-medium capitalize text-body">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ONE_ON_ONE_DOT_STYLES[status]}`} />
      {status}
    </span>
  );
}
