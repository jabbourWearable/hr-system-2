export function formatAttendanceDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function formatAttendanceTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
