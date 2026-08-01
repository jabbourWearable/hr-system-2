import Link from "next/link";
import { AvatarBadge } from "@/components/people/avatar-badge";
import { type Celebration, whenLabel } from "@/lib/people/celebrations";

// Dashboard widget: upcoming birthdays & work anniversaries (HR-68), styled
// after hibob's celebration cards. Presentational — the caller computes the
// list with upcomingCelebrations() and passes it in.
export function CelebrationsCard({
  celebrations,
}: {
  celebrations: Celebration[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-label">Celebrations</h2>
      <div className="card divide-y divide-hairline">
        {celebrations.length === 0 ? (
          <p className="p-6 text-sm text-mute">
            No birthdays or work anniversaries in the next 30 days.
          </p>
        ) : (
          celebrations.map((c) => (
            <div key={c.key} className="flex items-center gap-3 p-4">
              <AvatarBadge name={c.fullName} seed={c.personId} size={40} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/directory/${c.personId}`}
                  className="font-medium text-ink hover:underline"
                >
                  {c.fullName}
                </Link>
                <p className="truncate text-sm text-mute">
                  {c.type === "birthday"
                    ? "Birthday"
                    : `${c.years}-year work anniversary`}
                  {c.department ? ` · ${c.department}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-medium ${
                  c.daysUntil === 0 ? "text-accent-green" : "text-ash"
                }`}
              >
                {whenLabel(c.daysUntil)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
