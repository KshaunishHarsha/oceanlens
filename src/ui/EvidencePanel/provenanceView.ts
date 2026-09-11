/* Pure formatting/lookup logic for the Provenance tab. No DOM/React here —
 * same split as profileComparison.ts/collocationView.ts. This tab shows NO
 * statistic: no RMSE, bias, profile line, or depth-band result — those
 * belong to the Profile and Comparison tabs and are deliberately not
 * duplicated here. Everything this module touches is already-loaded,
 * adapter-derived provenance data (dataStore.layers / an observation's own
 * `.provenance`), never a new fetch and never invented text. */

import type { OceanVariable } from '@/domain/variables';
import type { LayerId } from '@/domain/layers';
import type { DataSourceDescriptor, TemporalCoverage } from '@/domain/provenance';

/** Which registry layer carries the real source for a given variable's
 * MODEL side. Chlorophyll has no HYCOM field — its only registered source
 * is the (currently unavailable) satellite layer, and showing that
 * honestly (rather than omitting a model section) is the point: this tab
 * must keep unavailable sources explicitly unavailable, never silent. */
export function modelLayerIdForVariable(variable: OceanVariable): LayerId {
  switch (variable) {
    case 'temperature':
      return 'model.temperature';
    case 'salinity':
      return 'model.salinity';
    case 'currentSpeed':
      return 'model.currents';
    case 'chlorophyll':
      return 'satellite.chlorophyll';
  }
}

/** Source variable names with their declared units where known. Not every
 * source variable has a unit entry (e.g. Argo's QC/adjusted-field names) —
 * those are listed bare rather than fabricating a unit for them. */
export function formatSourceVariables(source: DataSourceDescriptor): string {
  if (source.sourceVariables.length === 0) return '—';
  return source.sourceVariables
    .map((v) => {
      const unit = source.sourceUnits[v];
      return unit ? `${v} (${unit})` : v;
    })
    .join(', ');
}

export function formatTemporalCoverage(t: TemporalCoverage | null): string {
  if (!t) return '—';
  return `${t.start.slice(0, 10)} → ${t.end.slice(0, 10)} (${t.cadence})`;
}

export function formatRetrievedAt(retrievedAt: string | null): string {
  if (!retrievedAt) return '—';
  return retrievedAt.slice(0, 16).replace('T', ' ') + ' UTC';
}
