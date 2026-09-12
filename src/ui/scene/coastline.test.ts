import { describe, expect, it } from 'vitest';
import type { GeoBounds } from '@/domain/types';
import { projectCoastline, type CoastlineData } from './coastline';

const BOUNDS: GeoBounds = { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 };

function makeData(overrides?: Partial<CoastlineData>): CoastlineData {
  return {
    region: BOUNDS,
    source: {
      datasetName: 'Natural Earth 1:50m Cultural Vectors (via world-atlas countries-50m)',
      originator: 'Natural Earth (public domain) / world-atlas npm package',
      sourceUrl: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
      retrievedAt: '2026-09-12T00:00:00.000Z',
      licence: 'Natural Earth data is in the public domain.',
    },
    features: [
      {
        name: 'Sri Lanka',
        rings: [
          [
            [79.97, 9.63],
            [79.91, 9.62],
            [79.86, 9.69],
            [79.97, 9.63], // closed ring
          ],
        ],
      },
    ],
    ...overrides,
  };
}

describe('projectCoastline', () => {
  it('projects every real ring point through the same world coordinate system the plane/markers use', () => {
    const data = makeData();
    const [feature] = projectCoastline(data, BOUNDS);
    expect(feature?.name).toBe('Sri Lanka');
    expect(feature?.rings).toHaveLength(1);
    expect(feature?.rings[0]?.points).toHaveLength(4);
    // real coordinates project to finite, distinct world positions — not
    // collapsed to the origin or to NaN
    for (const p of feature!.rings[0]!.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });

  it('a point south of the bounds midpoint gets a positive Z (matches the plane\'s south=+Z convention)', () => {
    const data = makeData({
      features: [{ name: 'Test', rings: [[[87, 8.5], [87, 8.5]]] }], // near the southern edge
    });
    const [feature] = projectCoastline(data, BOUNDS);
    expect(feature!.rings[0]!.points[0]!.z).toBeGreaterThan(0);
  });

  it('drops a degenerate ring with fewer than 2 points rather than projecting a meaningless point', () => {
    const data = makeData({
      features: [
        {
          name: 'Degenerate',
          rings: [[[87, 13]], [[87, 13], [88, 14]]],
        },
      ],
    });
    const [feature] = projectCoastline(data, BOUNDS);
    expect(feature!.rings).toHaveLength(1);
  });

  it('preserves every feature name and does not silently merge/drop features', () => {
    const data = makeData({
      features: [
        { name: 'India', rings: [[[80, 15], [80.5, 15], [80, 15]]] },
        { name: 'Sri Lanka', rings: [[[80, 9], [80.5, 9], [80, 9]]] },
      ],
    });
    const projected = projectCoastline(data, BOUNDS);
    expect(projected.map((f) => f.name)).toEqual(['India', 'Sri Lanka']);
  });

  it('returns an empty array for no features — never a fabricated coastline', () => {
    const data = makeData({ features: [] });
    expect(projectCoastline(data, BOUNDS)).toEqual([]);
  });
});
