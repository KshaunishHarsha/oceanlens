/* Fetches a real observation profile and its closest real model column
 * through the existing OceanDataAdapter boundary (dataStore.adapter ->
 * ApiOceanDataAdapter -> FastAPI), whenever the selected observation or
 * variable changes. No synthetic fallback: a failed observation fetch
 * surfaces as `status: 'error'`; a failed/unavailable model-column fetch
 * degrades to `modelColumn: null` (the observed profile still renders —
 * see profileComparison.ts's "ready" state, which never requires a model
 * column) rather than failing the whole view. Race-guarded the same way
 * src/ui/scene/useVolumeSlice.ts is. */

import { useEffect, useRef, useState } from 'react';
import type { OceanVariable } from '@/domain/variables';
import type { ModelColumn, ObservationProfile } from '@/domain/types';
import { useDataStore } from '@/state/dataStore';
import { isProfileChartVariable, nearestTimestamp } from './profileComparison';

export type ProfileComparisonStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseProfileComparisonResult {
  readonly status: ProfileComparisonStatus;
  readonly error: string | null;
  readonly observation: ObservationProfile | null;
  readonly modelColumn: ModelColumn | null;
  /** The exact real timestamp requested for the model column (nearest to
   * the observation's own time), or null if none could be chosen. */
  readonly modelTimestamp: string | null;
}

const EMPTY: UseProfileComparisonResult = {
  status: 'idle',
  error: null,
  observation: null,
  modelColumn: null,
  modelTimestamp: null,
};

export function useProfileComparison(
  observationId: string | null,
  variable: OceanVariable,
  availableTimes: readonly string[],
  /** Bump to force a refetch (e.g. a manual retry after an error). */
  reloadToken = 0,
): UseProfileComparisonResult {
  const adapter = useDataStore((s) => s.adapter);
  const [state, setState] = useState<UseProfileComparisonResult>(EMPTY);
  const requestId = useRef(0);

  useEffect(() => {
    if (!adapter || !observationId || !isProfileChartVariable(variable)) {
      setState(EMPTY);
      return;
    }
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    (async () => {
      const observation = await adapter.getObservation(observationId);
      if (requestId.current !== id) return; // superseded
      if (!observation) {
        setState({
          status: 'error',
          error: `Observation '${observationId}' could not be loaded.`,
          observation: null,
          modelColumn: null,
          modelTimestamp: null,
        });
        return;
      }

      const modelTimestamp = nearestTimestamp(observation.observedAt, availableTimes);
      let modelColumn: ModelColumn | null = null;
      if (modelTimestamp) {
        try {
          modelColumn = await adapter.getModelColumn({
            variable,
            timestamp: modelTimestamp,
            latitude: observation.latitude,
            longitude: observation.longitude,
          });
        } catch {
          // Real gap (e.g. outside the cached region, or the variable's
          // model source failed to harvest) — degrade honestly, don't
          // fabricate a column, don't fail the observed-only view.
          modelColumn = null;
        }
      }
      if (requestId.current !== id) return;
      setState({ status: 'ready', error: null, observation, modelColumn, modelTimestamp });
    })().catch((e: unknown) => {
      if (requestId.current !== id) return;
      setState({
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
        observation: null,
        modelColumn: null,
        modelTimestamp: null,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, observationId, variable, availableTimes, reloadToken]);

  return state;
}
