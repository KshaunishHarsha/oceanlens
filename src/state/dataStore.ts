/* Owns the data-adapter lifecycle and the results of the handful of calls
 * every screen needs at startup: metadata, the layer registry, the real
 * timestamp axis, and the observation list.
 *
 * This is deliberately separate from analysisStore (the UI's interaction
 * state) — this store is about what came back from the API and whether that
 * succeeded; analysisStore is about what the user has selected. */

import { create } from 'zustand';
import { createDataAdapter } from '@/data';
import type { OceanDataAdapter } from '@/data/adapter';
import type { LayerRegistry } from '@/domain/layers';
import { OCEAN_VARIABLES, type OceanVariable } from '@/domain/variables';
import type { DatasetMetadata, ObservationProfile } from '@/domain/types';
import { useAnalysisStore } from './analysisStore';

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DataState {
  status: DataStatus;
  error: string | null;
  adapter: OceanDataAdapter | null;
  metadata: DatasetMetadata | null;
  layers: LayerRegistry | null;
  observations: readonly ObservationProfile[];
  /** Whether each OceanVariable has a real timestamp axis at all — the
   * cheapest honest signal of "is there real data behind this control". */
  variableAvailability: Partial<Record<OceanVariable, boolean>>;
}

export interface DataActions {
  initialize(): Promise<void>;
  retry(): Promise<void>;
}

export type DataStore = DataState & DataActions;

const INITIAL: DataState = {
  status: 'idle',
  error: null,
  adapter: null,
  metadata: null,
  layers: null,
  observations: [],
  variableAvailability: {},
};

export const useDataStore = create<DataStore>((set, get) => ({
  ...INITIAL,

  async initialize() {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const adapter = await createDataAdapter();
      const [metadata, layers, observations, variableTimes] = await Promise.all([
        adapter.getMetadata(),
        adapter.getLayerRegistry(),
        adapter.getObservations({}),
        Promise.all(OCEAN_VARIABLES.map((v) => adapter.getAvailableTimes(v))),
      ]);
      const variableAvailability = Object.fromEntries(
        OCEAN_VARIABLES.map((v, i) => [v, (variableTimes[i]?.length ?? 0) > 0]),
      ) as Partial<Record<OceanVariable, boolean>>;

      // temperature's real axis drives the timeline; every variable shares
      // the same model timestamps in this cache, but temperature is
      // guaranteed present if anything is.
      useAnalysisStore.getState().setAvailableTimes(variableTimes[0] ?? []);
      set({
        status: 'ready',
        adapter,
        metadata,
        layers,
        observations,
        variableAvailability,
        error: null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ status: 'error', error: message });
    }
  },

  async retry() {
    set({ ...INITIAL });
    await get().initialize();
  },
}));
