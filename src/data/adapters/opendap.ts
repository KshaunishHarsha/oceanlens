/* Architectural placeholder — not implemented in the MVP.
 *
 * OPeNDAP / THREDDS (e.g. HYCOM at tds.hycom.org) allows array-level subsetting
 * over HTTP via DAP constraint expressions. A production adapter would issue
 * .dods requests for a bounded [time][depth][lat][lon] hyperslab and decode the
 * binary response.
 *
 * The MVP uses an offline-prepared HYCOM subset (Phase 2) so the demo runs with
 * no network dependency. */

import { NotImplementedError, type OceanDataAdapter } from '@/data/adapter';

export class OPeNDAPAdapter implements Partial<OceanDataAdapter> {
  constructor(private readonly datasetUrl: string) {}

  readonly describe = () =>
    `OPeNDAPAdapter(${this.datasetUrl}) — architectural placeholder; MVP uses an offline HYCOM subset`;

  getVolumeSlice(): never {
    throw new NotImplementedError('OPeNDAPAdapter', 'getVolumeSlice');
  }
}
