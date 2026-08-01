import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OrgTree, type OrgNode } from "./org-tree";

// Company-wide org chart (HR-68). Any signed-in user may view the reporting
// structure — profiles are readable under RLS — so this gates on requireUser()
// (see ARCHITECTURE.md: each page runs its own auth check, no shared layout).
// The tree is assembled entirely in JS (no FK joins) from a single flat query.
export default async function OrgChartPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, manager_id, job_title, department")
    .order("full_name");

  const rows = profiles ?? [];

  // One node per profile, indexed by id (already in full_name order).
  const nodeById = new Map<string, OrgNode>(
    rows.map((p) => [
      p.id,
      {
        id: p.id,
        fullName: p.full_name,
        jobTitle: p.job_title,
        department: p.department,
        reports: [],
      },
    ]),
  );

  const roots: OrgNode[] = [];
  // Every node is attached to at most one parent; the guard makes that a hard
  // guarantee so a malformed manager_id chain can never create a cycle (which
  // would infinite-loop the recursive renderer).
  const attached = new Set<string>();

  for (const p of rows) {
    const node = nodeById.get(p.id)!;
    // A manager that is null, self-referential, or points outside the set makes
    // this profile a root.
    const manager =
      p.manager_id && p.manager_id !== p.id ? nodeById.get(p.manager_id) : undefined;

    if (!manager) {
      roots.push(node);
      continue;
    }
    if (attached.has(node.id)) continue;
    manager.reports.push(node);
    attached.add(node.id);
  }

  const total = rows.length;
  const managerCount = [...nodeById.values()].filter((n) => n.reports.length > 0).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl sm:text-4xl">Org chart</h1>
          <p className="text-sm text-mute">Reporting structure across the company.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-sm text-mute">No profiles to display yet.</p>
      ) : (
        <section className="space-y-4">
          <p className="text-sm text-mute">
            {total} {total === 1 ? "person" : "people"} · {managerCount} with direct
            reports
          </p>
          <OrgTree nodes={roots} />
        </section>
      )}
    </main>
  );
}
