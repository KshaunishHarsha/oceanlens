/* Fetches a real VolumeSlice through the existing OceanDataAdapter boundary
 * (dataStore.adapter -> ApiOceanDataAdapter -> FastAPI) whenever the
 * selected variable, timestamp or depth changes. No synthetic fallback: a
 * failed or unavailable request surfaces as `status: 'error'`, never a
 * placeholder slice. */

import { useEffect, useRef, useState } from 'react';
import type { OceanVariable } from '@/domain/variables';
import type { VolumeSlice } from '@/domain/types';
import { useDataStore } from '@/state/dataStore';

export type SliceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseVolumeSliceResult {
  readonly status: SliceStatus;
  readonly slice: VolumeSlice | null;
  readonly error: string | null;
}

export function useVolumeSlice(
  variable: OceanVariable,
  timestamp: string | null,
  depthM: number,
): UseVolumeSliceResult {
  const adapter = useDataStore((s) => s.adapter);
  const [state, setState] = useState<UseVolumeSliceResult>({
    status: 'idle',
    slice: null,
    error: null,
  });

  // Guards against a slow, now-stale request overwriting a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    if (!adapter || !timestamp) {
      setState({ status: 'idle', slice: null, error: null });
      return;
    }
    const id = ++requestId.current;
    setState((prev) => ({ status: 'loading', slice: prev.slice, error: null }));
    adapter
      .getVolumeSlice({ variable, timestamp, depthM })
      .then((slice) => {
        if (requestId.current !== id) return; // superseded by a newer request
        setState({ status: 'ready', slice, error: null });
      })
      .catch((e: unknown) => {
        if (requestId.current !== id) return;
        setState({
          status: 'error',
          slice: null,
          error: e instanceof Error ? e.message : String(e),
        });
      });
  }, [adapter, variable, timestamp, depthM]);

  return state;
}
