/* Applies the existing observation filters (platform type, Argo data
 * centre, good-QC-only, collocated-only) to a real observation list.
 *
 * Pure and shared: both EvidencePanel's observation picker and the 3D
 * scene's markers must show the same set for the same filter state, or a
 * marker selectable in the scene could vanish from the panel's list (or
 * vice versa) — a real correctness bug the previous EvidencePanel-only
 * implementation had no way to expose, since collocated-only wasn't wired
 * to anything. This is now the one place that logic lives. */

import type { ObservationFilters } from './analysisStore';
import type { ObservationProfile } from '@/domain/types';

export function filterObservations(
  observations: readonly ObservationProfile[],
  filters: ObservationFilters,
  collocatedObservationIds: ReadonlySet<string>,
): ObservationProfile[] {
  return observations.filter((o) => {
    if (!filters.platformTypes[o.platformType]) return false;

    const dac = o.identity?.dataCentre;
    if (dac === 'IN' && !filters.dataCentres.IN) return false;
    if (dac === 'HZ' && !filters.dataCentres.HZ) return false;

    if (filters.goodQualityOnly && o.qc !== 'GOOD' && o.qc !== 'PROBABLY_GOOD') return false;

    if (filters.collocatedOnly && !collocatedObservationIds.has(o.id)) return false;

    return true;
  });
}
