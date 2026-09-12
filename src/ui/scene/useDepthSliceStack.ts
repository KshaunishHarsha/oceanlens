/* Loads a small, fixed stack of real depth slices for the 3D context view.
 * This is deliberately depth-resolved layers, not invented interpolation or
 * volume ray marching: every coloured plane comes from the existing adapter. */
import { useEffect, useRef, useState } from 'react';
import type { OceanVariable } from '@/domain/variables';
import type { VolumeSlice } from '@/domain/types';
import { useDataStore } from '@/state/dataStore';
import { DEPTH_STOPS } from '@/state/analysisStore';

export interface DepthSliceStackState { readonly slices: readonly VolumeSlice[]; readonly loading: boolean; }

export function useDepthSliceStack(variable: OceanVariable, timestamp: string | null): DepthSliceStackState {
  const adapter = useDataStore((s) => s.adapter);
  const [state, setState] = useState<DepthSliceStackState>({ slices: [], loading: false });
  const requestId = useRef(0);
  useEffect(() => {
    if (!adapter || !timestamp) { setState({ slices: [], loading: false }); return; }
    const id = ++requestId.current;
    setState((previous) => ({ ...previous, loading: true }));
    Promise.all(DEPTH_STOPS.map((depthM) => adapter.getVolumeSlice({ variable, timestamp, depthM })))
      .then((slices) => { if (requestId.current === id) setState({ slices, loading: false }); })
      // The selected slice remains independently available. A failed context
      // layer must not replace a real chosen slice with a fake fallback.
      .catch(() => { if (requestId.current === id) setState({ slices: [], loading: false }); });
  }, [adapter, variable, timestamp]);
  return state;
}
