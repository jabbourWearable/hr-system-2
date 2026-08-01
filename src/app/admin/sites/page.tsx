import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createSite } from "./actions";
import { SiteForm } from "./site-form";
import { DeleteSiteButton } from "./delete-site-button";

// Admin-only work site CRUD (spec §5.3, task list Task 9). Route access is
// gated by requireRole('admin') here — see ARCHITECTURE.md's note that
// every page under /admin must call this itself, not rely on a shared
// layout.
export default async function AdminSitesPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude, radius_meters")
    .order("name");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Work sites</h1>
          <p className="text-sm text-mute">
            Admin-managed geofences used to validate employee check-in/out.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-link hover:underline">
          Back to admin
        </Link>
      </div>

      <section className="max-w-md space-y-3">
        <h2 className="section-label">New site</h2>
        <div className="card p-6">
          <SiteForm action={createSite} submitLabel="Create site" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">All sites</h2>
        {!sites || sites.length === 0 ? (
          <p className="text-sm text-mute">No sites yet — create one above.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-hairline-strong text-left">
                <tr>
                  <th className="section-label px-4 py-3">Name</th>
                  <th className="section-label px-4 py-3">Latitude</th>
                  <th className="section-label px-4 py-3">Longitude</th>
                  <th className="section-label px-4 py-3">Radius (m)</th>
                  <th className="section-label px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td className="px-4 py-3 text-ink">{site.name}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{site.latitude}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{site.longitude}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{site.radius_meters}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/sites/${site.id}/edit`}
                          className="font-medium text-link hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteSiteButton siteId={site.id} siteName={site.name} />
                      </div>
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
