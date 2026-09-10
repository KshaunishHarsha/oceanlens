import { describe, expect, it } from 'vitest';
import { NotImplementedError } from '@/data/adapter';
import { NetCDFAdapter } from './netcdf';
import { ERDDAPAdapter } from './erddap';
import { OPeNDAPAdapter } from './opendap';
import { OGCWMSAdapter } from './ogcwms';

describe('future-source adapters', () => {
  it('compile and construct', () => {
    expect(new NetCDFAdapter('file:///x.nc')).toBeInstanceOf(NetCDFAdapter);
    expect(new ERDDAPAdapter('https://example.org/erddap')).toBeInstanceOf(ERDDAPAdapter);
    expect(new OPeNDAPAdapter('https://tds.example.org/x')).toBeInstanceOf(OPeNDAPAdapter);
    expect(new OGCWMSAdapter('https://example.org/wms')).toBeInstanceOf(OGCWMSAdapter);
  });

  it('throw a descriptive NotImplementedError rather than failing silently', () => {
    expect(() => new NetCDFAdapter('x').getMetadata()).toThrow(NotImplementedError);
    expect(() => new OPeNDAPAdapter('x').getVolumeSlice()).toThrow(/architectural placeholder/i);
  });

  it('describe themselves', () => {
    expect(new ERDDAPAdapter('https://x/erddap').describe()).toMatch(/placeholder/);
  });
});
