// Pure aggregation helpers for the admin analytics dashboard (HR-76).
// No Supabase imports — everything here takes plain rows and returns plain
// numbers, so the bucketing/overlap logic is testable in isolation.
//
// All date math is UTC, matching the rest of the app's convention (e.g.
// `new Date().toISOString().slice(0, 10)` in src/app/admin/page.tsx).

export type RangeKey = "30d" | "90d" | "12m";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
];

export function resolveRangeKey(raw: string | undefined): RangeKey {
  return RANGE_OPTIONS.some((option) => option.key === raw)
    ? (raw as RangeKey)
    : "30d";
}

/** One time bucket on the x-axis. `end` is exclusive. */
export type Bucket = {
  /** Short x-axis tick label ("Jul 14", "Aug"). */
  label: string;
  /** Fuller label for the hover readout ("Jul 14, 2026", "Week of Jul 14"). */
  longLabel: string;
  start: Date;
  end: Date;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayLabel(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * The buckets always end at "now": 30 daily, 13 weekly (Monday-start), or
 * 12 monthly buckets. The dashboard's range window is buckets[0].start → now.
 */
export function buildBuckets(range: RangeKey, now: Date): Bucket[] {
  const today = utcMidnight(now);
  const buckets: Bucket[] = [];

  if (range === "30d") {
    for (let i = 29; i >= 0; i -= 1) {
      const start = addDays(today, -i);
      buckets.push({
        label: dayLabel(start),
        longLabel: `${dayLabel(start)}, ${start.getUTCFullYear()}`,
        start,
        end: addDays(start, 1),
      });
    }
  } else if (range === "90d") {
    // Monday of the current UTC week, then 12 weeks back → 13 buckets (~91d).
    const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
    for (let i = 12; i >= 0; i -= 1) {
      const start = addDays(monday, -7 * i);
      buckets.push({
        label: dayLabel(start),
        longLabel: `Week of ${dayLabel(start)}`,
        start,
        end: addDays(start, 7),
      });
    }
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
      );
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      );
      buckets.push({
        label: MONTHS[start.getUTCMonth()],
        longLabel: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
        start,
        end,
      });
    }
  }

  return buckets;
}

/** Count of timestamps falling in each bucket (timestamps outside → dropped). */
export function countPerBucket(timestamps: string[], buckets: Bucket[]): number[] {
  const counts = buckets.map(() => 0);
  for (const raw of timestamps) {
    const t = new Date(raw).getTime();
    const index = buckets.findIndex(
      (b) => t >= b.start.getTime() && t < b.end.getTime(),
    );
    if (index !== -1) counts[index] += 1;
  }
  return counts;
}

/** Running total of timestamps up to each bucket's (exclusive) end. */
export function cumulativePerBucket(
  timestamps: string[],
  buckets: Bucket[],
): number[] {
  const times = timestamps.map((raw) => new Date(raw).getTime());
  return buckets.map((b) => times.filter((t) => t < b.end.getTime()).length);
}

/**
 * Whole-day span of a leave request, end date inclusive — matches how the
 * leave form treats a single-day request (start = end → 1 day). Inputs are
 * `date` columns (YYYY-MM-DD strings).
 */
export function inclusiveDaySpan(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  return days > 0 ? days : 0;
}

/** Group rows by a key and return [key, count] pairs sorted by count desc. */
export function countBy<T>(
  rows: T[],
  keyOf: (row: T) => string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
