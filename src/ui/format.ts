/**
 * Display formatting for walking distances. Presentation-only: everything
 * underneath is metres (workplan Stage 1). Domain numbers (realValue) are
 * never formatted here — packs author those strings themselves.
 */

export type DistanceUnits = "km" | "mi";

const METRES_PER_MILE = 1609.344;

/**
 * "850 m", "1.25 km", "12.4 km" — or "0.53 mi", "6.2 mi".
 * Short metric distances read in metres; miles never switch to feet.
 */
export function formatDistance(metres: number, units: DistanceUnits): string {
  const m = Math.max(0, metres);
  if (units === "mi") {
    const miles = m / METRES_PER_MILE;
    return `${miles < 10 ? miles.toFixed(2) : miles.toFixed(1)} mi`;
  }
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
}

/** Suggested-distance chip labels: "2 km", "5 km", or "1.2 mi". Compact. */
export function formatDistanceShort(metres: number, units: DistanceUnits): string {
  if (units === "mi") {
    const miles = metres / METRES_PER_MILE;
    return `${Number(miles.toFixed(1))} mi`;
  }
  return metres < 1000 ? `${Math.round(metres)} m` : `${Number((metres / 1000).toFixed(2))} km`;
}

/** User-typed distance in the chosen units → metres, or null if invalid. */
export function parseDistance(input: string, units: DistanceUnits): number | null {
  const value = Number(input.replace(",", ".").trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * (units === "mi" ? METRES_PER_MILE : 1000));
}

/** "7 Oct 2026, 14:05" in the device locale. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "12 min", "1 h 05 min" between two ISO timestamps. */
export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
