/**
 * Converts a wall-clock time typed into a `datetime-local` field ("2026-06-01T08:30") in the
 * municipality's time zone to a UTC instant. Staff schedule in city time regardless of where
 * the server or their browser is.
 */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(wall)) return null;
  // Offset of the zone at a given instant = (that instant rendered in the zone) - instant.
  const offsetAt = (instant: number): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return (
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
      ) - instant
    );
  };
  try {
    // Two passes settle correctly on either side of a daylight-saving change.
    const guess = wall - offsetAt(wall);
    return new Date(wall - offsetAt(guess));
  } catch {
    return null;
  }
}
