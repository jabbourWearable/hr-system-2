import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateSite } from "../../actions";
import { SiteForm } from "../../site-form";

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude, radius_meters")
    .eq("id", id)
    .single();

  if (!site) notFound();

  const updateSiteWithId = updateSite.bind(null, site.id);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Edit site</h1>
        <Link
          href="/admin/sites"
          className="text-sm font-medium text-primary hover:underline"
        >
          Back to sites
        </Link>
      </div>
      <div className="max-w-md">
        <SiteForm
          action={updateSiteWithId}
          submitLabel="Save changes"
          defaultValues={{
            name: site.name,
            latitude: site.latitude,
            longitude: site.longitude,
            radiusMeters: site.radius_meters,
          }}
        />
      </div>
    </main>
  );
}
