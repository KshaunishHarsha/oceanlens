/* Application data entry point.
 *
 * Default: ApiOceanDataAdapter, calling the Python/FastAPI backend. The
 * backend owns NetCDF parsing, QC mapping, depth conversion, interpolation,
 * collocation and every statistic; this adapter only does HTTP + shape
 * translation.
 *
 * CachedRealDataAdapter (reads public/data/real/ directly in the browser) is
 * retained ONLY for fallback and comparison testing, per the approved
 * backend-refactor scope. It is NEVER the default. To use it during local
 * development, set VITE_USE_LOCAL_CACHE_ADAPTER=true — an explicit,
 * development-only opt-in, never set in a production build. Enabling it logs
 * a visible console warning so it is never silently active.
 *
 * The synthetic FixtureDataAdapter is not exported here at all; it is
 * imported directly by tests only. */

export type {
  OceanDataAdapter,
  SliceQuery,
  ColumnQuery,
  ObservationQuery,
  CollocationQuery,
} from './adapter';
export { NotImplementedError } from './adapter';
export { CachedRealDataAdapter } from './CachedRealDataAdapter';
export { ApiOceanDataAdapter, mapApiStatus } from './ApiOceanDataAdapter';
export { loadRealDataCache } from './cache/loadCache';
export { apiBaseUrl, apiGet, ApiUnavailableError, ApiResponseError } from './api/client';

import type { OceanDataAdapter } from './adapter';
import { ApiOceanDataAdapter } from './ApiOceanDataAdapter';
import { CachedRealDataAdapter } from './CachedRealDataAdapter';
import { loadRealDataCache } from './cache/loadCache';

/** Construct the production adapter. Defaults to the API; the local-cache
 * adapter is opt-in only, per VITE_USE_LOCAL_CACHE_ADAPTER. */
export async function createDataAdapter(): Promise<OceanDataAdapter> {
  const useLocalCache = import.meta.env.VITE_USE_LOCAL_CACHE_ADAPTER === 'true';
  if (useLocalCache) {
    // eslint-disable-next-line no-console
    console.warn(
      '[OceanLens] VITE_USE_LOCAL_CACHE_ADAPTER=true — using CachedRealDataAdapter ' +
        '(reads public/data/real/ directly in the browser) instead of the FastAPI backend. ' +
        'Development/comparison only; never set this in a production build.',
    );
    return CachedRealDataAdapter.create(loadRealDataCache);
  }
  return new ApiOceanDataAdapter();
}
