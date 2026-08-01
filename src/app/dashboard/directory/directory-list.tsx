"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AvatarBadge } from "@/components/people/avatar-badge";

type Person = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  role: string;
  siteName: string | null;
};

// Client-side search + department filter over the pre-fetched people list.
// The whole company fits comfortably in memory, so filtering stays on the
// client for an instant, no-round-trip experience.
export function DirectoryList({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");

  const departments = useMemo(() => {
    const unique = new Set<string>();
    for (const p of people) {
      if (p.department) unique.add(p.department);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (department !== "All" && p.department !== department) return false;
      if (!q) return true;
      return [p.fullName, p.jobTitle, p.department, p.email]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [people, query, department]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          aria-label="Search people"
          className="field w-full sm:max-w-xs"
        />

        {departments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {["All", ...departments].map((dept) => {
              const active = department === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartment(dept)}
                  aria-pressed={active}
                  className={`inline-flex items-center rounded-full border bg-elevated px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-ink text-ink"
                      : "border-hairline-strong text-body hover:border-stone"
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-sm text-mute">
        {filtered.length} {filtered.length === 1 ? "person" : "people"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-mute">No one matches your search.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/directory/${p.id}`}
              className="card flex items-center gap-3 p-4 transition-colors hover:border-stone"
            >
              <AvatarBadge name={p.fullName} seed={p.id} size={44} />
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-ink">{p.fullName}</p>
                <p className="truncate text-sm text-mute">{p.jobTitle ?? "—"}</p>
                {p.department && (
                  <span className="inline-flex items-center rounded-full border border-hairline-strong bg-elevated px-2 py-0.5 text-xs text-body">
                    {p.department}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
