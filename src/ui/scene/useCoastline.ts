/* Fetches the vendored real coastline reference (see
 * scripts/prepare-coastline.mjs) from the frontend's own static assets —
 * not through OceanDataAdapter, since this is cartographic reference
 * geometry, not an oceanographic measurement (same distinction the module
 * doc comment in coastline.ts makes). No synthetic fallback: a fetch
 * failure surfaces as `status: 'error'`, never a fabricated or blank
 * coastline silently swapped in.
 *
 * Fetched once and cached at module scope — this file never changes at
 * runtime (it is a static build asset), so there is nothing to
 * request-id-guard against the way useVolumeSlice.ts must for
 * parameterised, frequently-changing queries. */

import { useEffect, useState } from 'react';
import type { CoastlineData } from './coastline';

export type CoastlineStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseCoastlineResult {
  readonly status: CoastlineStatus;
  readonly data: CoastlineData | null;
  readonly error: string | null;
}

let moduleCache: CoastlineData | null = null;

const IDLE: UseCoastlineResult = { status: 'idle', data: null, error: null };

export function useCoastline(): UseCoastlineResult {
  const [state, setState] = useState<UseCoastlineResult>(
    moduleCache ? { status: 'ready', data: moduleCache, error: null } : IDLE,
  );

  useEffect(() => {
    if (moduleCache) {
      setState({ status: 'ready', data: moduleCache, error: null });
      return;
    }
    let dead = false;
    setState({ status: 'loading', data: null, error: null });
    fetch('/data/coastline/bay-of-bengal-coastline.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Coastline asset fetch failed: ${res.status}`);
        return res.json() as Promise<CoastlineData>;
      })
      .then((data) => {
        if (dead) return;
        moduleCache = data;
        setState({ status: 'ready', data, error: null });
      })
      .catch((e: unknown) => {
        if (dead) return;
        setState({
          status: 'error',
          data: null,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    return () => {
      dead = true;
    };
  }, []);

  return state;
}
