import Link from "next/link";
import { AvatarBadge } from "@/components/people/avatar-badge";

// Presentational, recursive org-chart renderer (HR-68). Pure server component
// — no "use client", no state. The forest is built upstream in page.tsx and is
// guaranteed acyclic (each person has at most one manager), so recursing over
// `reports` can't loop.
export type OrgNode = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  reports: OrgNode[];
};

export function OrgTree({ nodes, depth = 0 }: { nodes: OrgNode[]; depth?: number }) {
  return (
    <div className="space-y-2">
      {nodes.map((n) => {
        // "jobTitle · department", dropping whichever part is missing.
        const meta = [n.jobTitle, n.department].filter(Boolean).join(" · ");
        const reportCount = n.reports.length;

        return (
          <div key={n.id} className="space-y-2">
            <div className="card flex items-center gap-3 p-3">
              <AvatarBadge name={n.fullName} seed={n.id} size={36} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/directory/${n.id}`}
                  className="font-medium text-ink hover:underline"
                >
                  {n.fullName}
                </Link>
                {meta ? <p className="text-xs text-mute">{meta}</p> : null}
              </div>
              {reportCount > 0 ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-hairline-strong bg-elevated px-2 py-0.5 text-xs text-body">
                  {reportCount} {reportCount === 1 ? "report" : "reports"}
                </span>
              ) : null}
            </div>

            {reportCount > 0 ? (
              <div className="ml-4 mt-2 space-y-2 border-l border-hairline pl-4">
                <OrgTree nodes={n.reports} depth={depth + 1} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
