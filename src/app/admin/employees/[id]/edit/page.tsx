import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateEmployeeProfile } from "../../actions";
import { EmployeeForm } from "../../employee-form";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, manager_id, site_id")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  const [{ data: allProfiles }, { data: sites }, { data: emailRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .neq("id", id)
      .order("full_name"),
    supabase.from("sites").select("id, name").order("name"),
    // `email` isn't in the original schema (migration 0007 backfills it via a
    // DB trigger) — select it separately so a not-yet-applied migration can't
    // 42703 the whole edit page, only the email display.
    supabase.from("profiles").select("email").eq("id", id).single(),
  ]);

  const updateEmployeeWithId = updateEmployeeProfile.bind(null, profile.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Edit {profile.full_name}</h1>
          <p className="font-mono text-sm text-mute">
            {emailRow?.email ?? "No email on file"}
          </p>
        </div>
        <Link
          href="/admin/employees"
          className="text-sm font-medium text-link hover:underline"
        >
          Back to employees
        </Link>
      </div>
      <div className="card max-w-md p-6">
        <EmployeeForm
          action={updateEmployeeWithId}
          managers={(allProfiles ?? []).map((p) => ({ id: p.id, fullName: p.full_name }))}
          sites={(sites ?? []).map((s) => ({ id: s.id, name: s.name }))}
          defaultValues={{
            role: profile.role,
            managerId: profile.manager_id,
            siteId: profile.site_id,
          }}
          submitLabel="Save changes"
        />
      </div>
    </main>
  );
}
