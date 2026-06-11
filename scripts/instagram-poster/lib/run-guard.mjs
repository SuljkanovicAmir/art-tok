/**
 * Idempotency guard against double-posting.
 *
 * GitHub Actions can re-run a job (manual re-run, overlapping schedule, retry),
 * which would publish a second post for the same slot. The scheduled gap is
 * 180 minutes; if the most recent *successful* publish (an entry with a mediaId)
 * is closer than the window below, treat this invocation as a duplicate and bail.
 */
const WINDOW_MINUTES = 90; // schedule gap is 180 min; anything closer is a re-run/overlap

export function isDuplicateRun(qualityLog, now = new Date()) {
  const last = [...qualityLog].reverse().find((e) => e.mediaId && e.timestamp);
  if (!last) return false;
  const ageMin = (now - new Date(last.timestamp)) / 60000;
  return ageMin >= 0 && ageMin < WINDOW_MINUTES;
}
