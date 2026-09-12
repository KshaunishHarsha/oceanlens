/* Real substring search over the already-loaded observation list — no
 * fetch, no fuzzy scoring, no invented ranking. Matches a query against
 * three real identifiers: the observation's own id (e.g.
 * "ARGO-5907083-2"), its display platform name (e.g. "ARGO 5907083"), and
 * its real WMO number (e.g. "5907083") when the observation carries real
 * identity — never a fabricated match. Deliberately independent of the
 * active platform/DAC/QC filters (src/state/filterObservations.ts): a
 * search is how a user finds a SPECIFIC known float regardless of what the
 * current filter state happens to be hiding from the marker/picker view;
 * selecting a result still works even if that float's marker isn't
 * currently clickable in the scene (EvidencePanel's header reads from the
 * full observation list, not the filtered one). */

import type { ObservationProfile } from '@/domain/types';

/** Keeps the results dropdown short and scannable — not a hard technical
 * limit, a display choice. */
export const MAX_SEARCH_RESULTS = 8;

export function searchObservations(
  observations: readonly ObservationProfile[],
  query: string,
): readonly ObservationProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = observations.filter((o) => {
    if (o.id.toLowerCase().includes(q)) return true;
    if (o.platformName.toLowerCase().includes(q)) return true;
    if (o.identity && o.identity.wmo.toLowerCase().includes(q)) return true;
    return false;
  });
  return matches.slice(0, MAX_SEARCH_RESULTS);
}
