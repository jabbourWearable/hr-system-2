// A "to" date filter should include the whole day, but check_in_at is a
// timestamptz — comparing it to the bare date string would only match
// midnight. Convert "to" into the exclusive start of the following day so
// callers can use `.lt("check_in_at", nextDayExclusive(to))`.
export function nextDayExclusive(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
