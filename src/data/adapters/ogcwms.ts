/* Architectural placeholder — not implemented in the MVP.
 *
 * An OGC WMS/WCS service returns pre-rendered map tiles (WMS) or raw coverages
 * (WCS) for a bbox, time and elevation. A production adapter would use WMS
 * GetMap for fast basemap-style field imagery and WCS GetCoverage where numeric
 * values are needed.
 *
 * Out of scope for the MVP, which renders fields itself from cached arrays so
 * that colour scale, opacity and palette stay under the user's control. */

import { NotImplementedError, type OceanDataAdapter } from '@/data/adapter';

export class OGCWMSAdapter implements Partial<OceanDataAdapter> {
  constructor(private readonly serviceUrl: string) {}

  readonly describe = () =>
    `OGCWMSAdapter(${this.serviceUrl}) — architectural placeholder; MVP renders fields from cached arrays`;

  getVolumeSlice(): never {
    throw new NotImplementedError('OGCWMSAdapter', 'getVolumeSlice');
  }
}
