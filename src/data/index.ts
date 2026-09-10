/* Application data entry point.
 *
 * The app uses exactly one adapter: CachedRealDataAdapter, backed by the
 * locally cached extract of real Argo + HYCOM data. The synthetic
 * FixtureDataAdapter is intentionally NOT re-exported here — it is imported
 * directly by tests and stories only, so it can never be wired into a running
 * build by accident. */

export type {
  OceanDataAdapter,
  SliceQuery,
  ColumnQuery,
  ObservationQuery,
  CollocationQuery,
} from './adapter';
export { NotImplementedError } from './adapter';
export { CachedRealDataAdapter } from './CachedRealDataAdapter';
export { loadRealDataCache } from './cache/loadCache';

import { CachedRealDataAdapter } from './CachedRealDataAdapter';
import { loadRealDataCache } from './cache/loadCache';

/** Construct the production adapter from the committed cache. */
export function createDataAdapter(): Promise<CachedRealDataAdapter> {
  return CachedRealDataAdapter.create(loadRealDataCache);
}
