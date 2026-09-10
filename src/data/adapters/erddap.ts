/* Architectural placeholder — not implemented in the MVP.
 *
 * ERDDAP (e.g. an INCOIS or IMOS server) exposes griddap/tabledap endpoints
 * returning NetCDF, CSV or JSON for a requested subset. A production adapter
 * would build griddap queries from SliceQuery/ColumnQuery, request .json,
 * and map the response's column metadata (units, ioos_category, actual_range)
 * onto our types.
 *
 * Phase 0 did not confirm a public INCOIS ERDDAP; INCOIS observations reach
 * the MVP through the Argo GDAC instead. */

import { NotImplementedError, type OceanDataAdapter } from '@/data/adapter';

export class ERDDAPAdapter implements Partial<OceanDataAdapter> {
  constructor(private readonly baseUrl: string) {}

  readonly describe = () =>
    `ERDDAPAdapter(${this.baseUrl}) — architectural placeholder; no public INCOIS ERDDAP confirmed in Phase 0`;

  getMetadata(): never {
    throw new NotImplementedError('ERDDAPAdapter', 'getMetadata');
  }
}
