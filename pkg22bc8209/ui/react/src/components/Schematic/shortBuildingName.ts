/*
 * Short building labels for the network schematic, where nine buildings share one loop row.
 * Pure module (no React) so Jest can test it; Schematic.tsx re-exports it.
 */

/** Longest name drawn in full once the "Hall" / "Building" suffix is dropped. */
const MAX_FULL_LENGTH = 16;

/** "Chemistry Building" → "Chemistry"; long multi-word names → initials ("WIMR"). */
export function shortBuildingName(name: string): string {
  const trimmed = name.replace(/\s+(Hall|Building)$/i, '').trim();
  if (trimmed.length <= MAX_FULL_LENGTH) return trimmed;
  const words = trimmed.split(/\s+/).filter((w) => !/^(and|of|the|for)$/i.test(w));
  if (words.length >= 3) return words.map((w) => w.charAt(0).toUpperCase()).join('');
  return trimmed;
}
