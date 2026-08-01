import { initials, accentFor } from "@/lib/people/avatar";

// Shared monogram avatar for the People Hub (HR-68). Asset-free per DESIGN.md
// (type-and-code brand): a surface-elevated tile with a hairline border and
// the person's initials in a deterministic accent. Used by the directory,
// profile pages, org chart, kudos feed and dashboard widgets so one person
// looks the same everywhere.
export function AvatarBadge({
  name,
  seed,
  size = 40,
  className = "",
}: {
  name: string;
  /** Stable seed for the accent colour — pass the person's id. */
  seed: string;
  size?: number;
  className?: string;
}) {
  const accent = accentFor(seed);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full border border-hairline-strong bg-elevated font-mono font-medium leading-none ${className}`}
      style={{
        width: size,
        height: size,
        color: accent,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name)}
    </span>
  );
}
