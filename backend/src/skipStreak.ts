// Pure streak derivation for the repeated-skips escalation (Phase 1).
// No database access here: callers load events, this function counts.
// A "skip" counts at most ONCE per Asia/Manila calendar day (UTC+8, no DST).
// A CollectionEntry resets the streak. dirty_surroundings/other reports,
// dismissed reports and archived households never count.

export type SkipStreakEvent = {
  kind: 'skip' | 'collection';
  timestamp: string | Date;
};

export type SkipStreakResult = {
  streak: number;
  // ISO timestamp of the first skip in the streak (identifies the streak).
  streakStart: string | null;
  // Manila calendar days counted, newest first.
  skippedDates: string[];
};

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function manilaDayKey(timestamp: string | Date): string {
  return new Date(new Date(timestamp).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function computeSkipStreak(
  events: SkipStreakEvent[],
  opts?: { archived?: boolean },
): SkipStreakResult {
  const empty: SkipStreakResult = { streak: 0, streakStart: null, skippedDates: [] };
  if (opts?.archived) return empty;
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const seenDays = new Set<string>();
  const skippedDates: string[] = [];
  let oldestMs = 0;
  for (const event of sorted) {
    if (event.kind === 'collection') break;
    const day = manilaDayKey(event.timestamp);
    if (seenDays.has(day)) continue; // same-day duplicates (or two collectors) count once
    seenDays.add(day);
    skippedDates.push(day);
    oldestMs = new Date(event.timestamp).getTime();
  }
  if (skippedDates.length === 0) return empty;
  return { streak: skippedDates.length, streakStart: new Date(oldestMs).toISOString(), skippedDates };
}
