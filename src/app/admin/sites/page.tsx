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
    <main className="flex flex-1 flex-col gap-8 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Work sites</h1>
          <p className="text-sm text-foreground-muted">
            Admin-managed geofences used to validate employee check-in/out.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-medium text-primary hover:underline"
        >
          Back to admin
        </Link>
      </div>

      <section className="max-w-md space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          New site
        </h2>
        <SiteForm action={createSite} submitLabel="Create site" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          All sites
        </h2>
        {!sites || sites.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No sites yet — create one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Latitude</th>
                  <th className="px-3 py-2 font-medium">Longitude</th>
                  <th className="px-3 py-2 font-medium">Radius (m)</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id} className="border-t border-border">
                    <td className="px-3 py-2">{site.name}</td>
                    <td className="px-3 py-2">{site.latitude}</td>
                    <td className="px-3 py-2">{site.longitude}</td>
                    <td className="px-3 py-2">{site.radius_meters}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/sites/${site.id}/edit`}
                          className="font-medium text-primary hover:underline"
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
