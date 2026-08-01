// Deterministic, asset-free avatars for the People Hub (HR-68).
//
// DESIGN.md keeps the brand type-and-code, not photography-led, and reserves
// solid colour for atmospheric washes only — so avatars are monogram chips:
// the person's initials over a surface-elevated tile whose accent (used only
// for the text + a hairline tint) is picked deterministically from their id
// so the same person always looks the same across the directory, org chart,
// profile page and kudos feed.

const ACCENTS = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-orange)",
  "var(--accent-yellow)",
  "var(--accent-red)",
] as const;

/** Up to two initials from a full name ("Ada Lovelace" -> "AL"). */
export function initials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable accent CSS var for a person, derived from a seed (their id). */
export function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length];
}
