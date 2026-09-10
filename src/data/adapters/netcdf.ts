/* Architectural placeholder — not implemented in the MVP.
 *
 * In production, OceanLens would ingest CF-compliant NetCDF directly:
 *   - map CF standard names to OceanVariable
 *   - normalise coordinates (lon 0..360 -> -180..180, depth orientation)
 *   - honour _FillValue / missing_value rather than zero-filling
 *   - align time axes to a common reference
 *   - carry QC variables and provenance attributes through untouched
 *
 * The MVP instead reads a locally cached extract prepared offline from real
 * NetCDF sources (see scripts/prepare-real-data.mjs in Phase 2), so the demo
 * never depends on network access or a NetCDF runtime in the browser. */

import { NotImplementedError, type OceanDataAdapter } from '@/data/adapter';

export class NetCDFAdapter implements Partial<OceanDataAdapter> {
  constructor(private readonly url: string) {}

  readonly describe = () =>
    `NetCDFAdapter(${this.url}) — architectural placeholder; MVP uses the cached real-data adapter`;

  getMetadata(): never {
    throw new NotImplementedError('NetCDFAdapter', 'getMetadata');
  }
}
