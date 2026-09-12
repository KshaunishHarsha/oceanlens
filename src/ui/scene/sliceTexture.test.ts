import { describe, expect, it } from 'vitest';
import type { VolumeSlice } from '@/domain/types';
import {
  buildSliceTexture,
  computePlaneWorldSize,
  depthToWorldY,
  projectGeoToWorld,
  projectWorldToGeo,
  sampleSliceNearest,
} from './sliceTexture';
import { sampleRamp } from './palettes';

function makeSlice(overrides: Partial<VolumeSlice> = {}): VolumeSlice {
  // 2x2 real-shaped slice: one land cell, three ocean cells at known values.
  const values = new Float32Array([16, 23, 30, 0]);
  const valid = new Uint8Array([1, 1, 1, 0]);
  return {
    gridId: 'test',
    variable: 'temperature',
    timestamp: '2023-09-28T00:00:00.000Z',
    depthM: 100,
    nx: 2,
    ny: 2,
    bounds: { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 },
    values,
    valid,
    range: [16, 30],
    ...overrides,
  };
}

describe('buildSliceTexture', () => {
  it('sizes the buffer to nx*ny*4 (RGBA)', () => {
    const slice = makeSlice();
    const tex = buildSliceTexture(slice, 'thermal', [16, 30]);
    expect(tex.width).toBe(2);
    expect(tex.height).toBe(2);
    expect(tex.data.length).toBe(2 * 2 * 4);
  });

  it('maps the domain minimum to the ramp start colour', () => {
    const slice = makeSlice();
    const tex = buildSliceTexture(slice, 'thermal', [16, 30]);
    const [r, g, b] = sampleRamp('thermal', 0);
    expect([tex.data[0], tex.data[1], tex.data[2]]).toEqual([r, g, b]);
    expect(tex.data[3]).toBe(255); // valid cell -> opaque
  });

  it('maps the domain maximum to the ramp end colour', () => {
    const slice = makeSlice();
    const tex = buildSliceTexture(slice, 'thermal', [16, 30]);
    const [r, g, b] = sampleRamp('thermal', 1);
    // cell index 2 (row 1, col 0) holds value 30
    const o = 2 * 4;
    expect([tex.data[o], tex.data[o + 1], tex.data[o + 2]]).toEqual([r, g, b]);
  });

  it('marks an invalid (land/missing) cell fully transparent and black — never a fabricated colour', () => {
    const slice = makeSlice();
    const tex = buildSliceTexture(slice, 'thermal', [16, 30]);
    const o = 3 * 4; // the invalid cell
    expect([tex.data[o], tex.data[o + 1], tex.data[o + 2], tex.data[o + 3]]).toEqual([0, 0, 0, 0]);
  });

  it('preserves row order — row 0 of the slice is row 0 of the texture', () => {
    const slice = makeSlice({ values: new Float32Array([16, 16, 30, 30]) });
    const tex = buildSliceTexture(slice, 'thermal', [16, 30]);
    const row0 = sampleRamp('thermal', 0);
    const row1 = sampleRamp('thermal', 1);
    expect([tex.data[0], tex.data[1], tex.data[2]]).toEqual(row0);
    expect([tex.data[8], tex.data[9], tex.data[10]]).toEqual(row1);
  });

  it('does not divide by zero when the domain range is degenerate', () => {
    const slice = makeSlice({ values: new Float32Array([5, 5, 5, 0]) });
    expect(() => buildSliceTexture(slice, 'thermal', [5, 5])).not.toThrow();
  });
});

describe('model-point probe mapping', () => {
  const BOUNDS = { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 };
  it('round-trips a geographic point through the world plane', () => {
    const geo = { latitude: 13.2, longitude: 86.7 };
    const world = projectGeoToWorld(geo.latitude, geo.longitude, BOUNDS);
    expect(projectWorldToGeo(world.x, world.z, BOUNDS)).toEqual(expect.objectContaining(geo));
  });
  it('returns null for a real land/missing cell rather than a fabricated value', () => {
    expect(sampleSliceNearest(makeSlice(), { latitude: 20.5, longitude: 93 })).toBeNull();
  });
});

describe('computePlaneWorldSize', () => {
  it('returns a positive width and depth for the real Bay of Bengal bounds', () => {
    const size = computePlaneWorldSize({ minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 });
    expect(size.width).toBeGreaterThan(0);
    expect(size.depth).toBeGreaterThan(0);
  });

  it('shrinks longitude width relative to a naive equal-degree scale, away from the equator', () => {
    const bounds = { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 };
    const size = computePlaneWorldSize(bounds);
    const naiveWidth = (bounds.maxLon - bounds.minLon) * 6; // no cos correction
    expect(size.width).toBeLessThan(naiveWidth);
  });

  it('is degenerate-safe for a bounds spanning the equator', () => {
    const size = computePlaneWorldSize({ minLat: -5, maxLat: 5, minLon: 80, maxLon: 90 });
    expect(Number.isFinite(size.width)).toBe(true);
    expect(size.width).toBeGreaterThan(0);
  });
});

describe('depthToWorldY', () => {
  it('is zero at the surface', () => {
    expect(depthToWorldY(0, 18)).toBe(0);
  });

  it('is negative (below the plane origin) for any positive depth', () => {
    expect(depthToWorldY(100, 18)).toBeLessThan(0);
  });

  it('scales monotonically with exaggeration', () => {
    const low = depthToWorldY(500, 2);
    const high = depthToWorldY(500, 40);
    expect(Math.abs(high)).toBeGreaterThan(Math.abs(low));
  });

  it('scales monotonically with depth at fixed exaggeration', () => {
    const shallow = depthToWorldY(50, 18);
    const deep = depthToWorldY(500, 18);
    expect(Math.abs(deep)).toBeGreaterThan(Math.abs(shallow));
  });
});

describe('projectGeoToWorld', () => {
  const BOUNDS = { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 };

  it('places the bounds centre at the world origin', () => {
    const midLat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
    const midLon = (BOUNDS.minLon + BOUNDS.maxLon) / 2;
    const p = projectGeoToWorld(midLat, midLon, BOUNDS);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('places the southern edge at positive Z and the northern edge at negative Z, matching the documented ThreeSceneCanvas convention', () => {
    const midLon = (BOUNDS.minLon + BOUNDS.maxLon) / 2;
    const south = projectGeoToWorld(BOUNDS.minLat, midLon, BOUNDS);
    const north = projectGeoToWorld(BOUNDS.maxLat, midLon, BOUNDS);
    expect(south.z).toBeGreaterThan(0);
    expect(north.z).toBeLessThan(0);
  });

  it('places the western edge at negative X and the eastern edge at positive X', () => {
    const midLat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
    const west = projectGeoToWorld(midLat, BOUNDS.minLon, BOUNDS);
    const east = projectGeoToWorld(midLat, BOUNDS.maxLon, BOUNDS);
    expect(west.x).toBeLessThan(0);
    expect(east.x).toBeGreaterThan(0);
  });

  it('spans exactly the plane width/depth computed by computePlaneWorldSize', () => {
    const size = computePlaneWorldSize(BOUNDS);
    const midLat = (BOUNDS.minLat + BOUNDS.maxLat) / 2;
    const midLon = (BOUNDS.minLon + BOUNDS.maxLon) / 2;
    const west = projectGeoToWorld(midLat, BOUNDS.minLon, BOUNDS);
    const east = projectGeoToWorld(midLat, BOUNDS.maxLon, BOUNDS);
    const south = projectGeoToWorld(BOUNDS.minLat, midLon, BOUNDS);
    const north = projectGeoToWorld(BOUNDS.maxLat, midLon, BOUNDS);
    expect(east.x - west.x).toBeCloseTo(size.width, 6);
    expect(south.z - north.z).toBeCloseTo(size.depth, 6);
  });

  it('does not throw for a real position slightly outside the model bounds', () => {
    // real Argo floats can drift just off the model grid
    expect(() => projectGeoToWorld(BOUNDS.minLat - 0.5, BOUNDS.minLon - 0.5, BOUNDS)).not.toThrow();
  });

  it('two distinct real positions never collapse onto the same point', () => {
    const a = projectGeoToWorld(13.2, 86.7167, BOUNDS); // real ARGO-5907083-2 position
    const b = projectGeoToWorld(13.3167, 83.7167, BOUNDS); // real ARGO-5907082-2 position
    expect(a.x === b.x && a.z === b.z).toBe(false);
  });
});
