import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DirectoryList } from "./directory-list";

// Company Directory (HR-68): everyone at the company, searchable and
// filterable. Any authenticated user may browse — profiles/sites are readable
// under RLS — so we gate with requireUser() like every other /dashboard page
// (ARCHITECTURE.md: each page re-checks auth itself, no shared-layout guard).
export default async function DirectoryPage() {
  await requireUser();
  const supabase = await createClient();

  // No FK joins are configured, so we resolve the site name in JS via a Map
  // (same pattern as src/app/admin/employees/page.tsx).
  const [{ data: profiles }, { data: sites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, job_title, department, role, manager_id, site_id")
      .order("full_name"),
    supabase.from("sites").select("id, name"),
  ]);

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));

  const people = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    jobTitle: p.job_title,
    department: p.department,
    email: p.email,
    role: p.role,
    siteName: p.site_id ? siteNameById.get(p.site_id) ?? null : null,
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl sm:text-4xl">Company directory</h1>
          <p className="text-sm text-mute">Everyone at the company — search and explore.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      <DirectoryList people={people} />
    </main>
  );
}
