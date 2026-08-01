// Celebrations: upcoming birthdays & work anniversaries (HR-68), modelled on
// hibob's "Club" / Your Bob celebration cards.
//
// Pure date math on YYYY-MM-DD strings (no Date parsing of the stored value)
// so it never drifts by a timezone. "Today" is passed in as an ISO date by
// the caller (server components derive it the same way the admin dashboard
// does: new Date().toISOString().slice(0, 10)).

export type CelebrationType = "birthday" | "anniversary";

export type Celebration = {
  key: string;
  personId: string;
  fullName: string;
  department: string | null;
  type: CelebrationType;
  /** ISO date (YYYY-MM-DD) of the upcoming occurrence. */
  date: string;
  /** 0 = today, 1 = tomorrow, … */
  daysUntil: number;
  /** Years of service reached at this occurrence; null for birthdays. */
  years: number | null;
};

export type CelebrationPerson = {
  id: string;
  full_name: string;
  department: string | null;
  birthday: string | null;
  start_date: string | null;
};

function todayUtc(todayISO: string): { year: number; ms: number } {
  const [y, m, d] = todayISO.split("-").map(Number);
  return { year: y, ms: Date.UTC(y, m - 1, d) };
}

// Next occurrence (this year, else next year) of a recurring MM-DD, measured
// from `today`. Both anchors are UTC midnight, so the day delta is exact.
function nextOccurrence(monthDay: string, today: { year: number; ms: number }) {
  const [mm, dd] = monthDay.split("-").map(Number);
  let year = today.year;
  let ms = Date.UTC(year, mm - 1, dd);
  if (ms < today.ms) {
    year += 1;
    ms = Date.UTC(year, mm - 1, dd);
  }
  const daysUntil = Math.round((ms - today.ms) / 86_400_000);
  const iso = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { year, daysUntil, iso };
}

export function upcomingCelebrations(
  people: CelebrationPerson[],
  opts: { todayISO: string; windowDays?: number },
): Celebration[] {
  const windowDays = opts.windowDays ?? 30;
  const today = todayUtc(opts.todayISO);
  const out: Celebration[] = [];

  for (const p of people) {
    if (p.birthday) {
      const occ = nextOccurrence(p.birthday.slice(5), today);
      if (occ.daysUntil <= windowDays) {
        out.push({
          key: `${p.id}-birthday`,
          personId: p.id,
          fullName: p.full_name,
          department: p.department,
          type: "birthday",
          date: occ.iso,
          daysUntil: occ.daysUntil,
          years: null,
        });
      }
    }
    if (p.start_date) {
      const startYear = Number(p.start_date.slice(0, 4));
      const occ = nextOccurrence(p.start_date.slice(5), today);
      const years = occ.year - startYear;
      // Only celebrate real anniversaries (1+ years of service).
      if (years >= 1 && occ.daysUntil <= windowDays) {
        out.push({
          key: `${p.id}-anniversary`,
          personId: p.id,
          fullName: p.full_name,
          department: p.department,
          type: "anniversary",
          date: occ.iso,
          daysUntil: occ.daysUntil,
          years,
        });
      }
    }
  }

  out.sort((a, b) => a.daysUntil - b.daysUntil || a.fullName.localeCompare(b.fullName));
  return out;
}

/** "Today", "Tomorrow", or "in N days". */
export function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `in ${daysUntil} days`;
}
