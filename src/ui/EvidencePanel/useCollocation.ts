/* Fetches the selected observation's existing real collocation result
 * through the existing OceanDataAdapter boundary. No timestamp is passed —
 * backend/app/science/collocation.py's compute_collocation() already snaps
 * to the nearest real model timestamp itself when none is given (verified
 * by reading it: `_nearest_timestamp(profile["observedAt"], all_ts)`),
 * unlike the /model-column endpoint's fallback-to-first-timestamp bug found
 * in Phase 5A step 1 — that workaround does not apply here. Race-guarded
 * the same way useProfileComparison.ts/useVolumeSlice.ts are. No synthetic
 * fallback: a fetch failure surfaces as `status: 'error'`; a real "no
 * collocation exists" answer surfaces as `result: null` with `status:
 * 'ready'`, which is a different, honest thing from an error. */

import { useEffect, useRef, useState } from 'react';
import type { OceanVariable } from '@/domain/variables';
import type { CollocationResult } from '@/domain/types';
import { useDataStore } from '@/state/dataStore';
import { isCollocationVariable } from './collocationView';

export type CollocationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseCollocationResult {
  readonly status: CollocationStatus;
  readonly error: string | null;
  readonly result: CollocationResult | null;
}

const EMPTY: UseCollocationResult = { status: 'idle', error: null, result: null };

export function useCollocation(
  observationId: string | null,
  variable: OceanVariable,
  /** Bump to force a refetch (manual retry after an error). */
  reloadToken = 0,
): UseCollocationResult {
  const adapter = useDataStore((s) => s.adapter);
  const [state, setState] = useState<UseCollocationResult>(EMPTY);
  const requestId = useRef(0);

  useEffect(() => {
    if (!adapter || !observationId || !isCollocationVariable(variable)) {
      setState(EMPTY);
      return;
    }
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    adapter
      .getCollocation({ observationId, variable })
      .then((result) => {
        if (requestId.current !== id) return; // superseded by a newer request
        setState({ status: 'ready', error: null, result });
      })
      .catch((e: unknown) => {
        if (requestId.current !== id) return;
        setState({
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
          result: null,
        });
      });
  }, [adapter, observationId, variable, reloadToken]);

  return state;
}
