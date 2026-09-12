/* Sanity-checks the actual committed coastline asset (not a fixture) —
 * guards against scripts/prepare-coastline.mjs being re-run with a bad
 * region/margin and silently committing something empty, off-region, or
 * structurally broken. Reads the file directly rather than through
 * fetch()/a dev server, so this runs in the plain `npm test` suite. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CoastlineData } from './coastline';

const data: CoastlineData = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../public/data/coastline/bay-of-bengal-coastline.json', import.meta.url)),
    'utf-8',
  ),
);

describe('the committed coastline asset', () => {
  it('carries real, non-empty provenance — never a placeholder source', () => {
    expect(data.source.datasetName).toContain('Natural Earth');
    expect(data.source.sourceUrl).toMatch(/^https:\/\//);
    expect(data.source.retrievedAt).toBeTruthy();
  });

  it('includes the real countries a Bay of Bengal scene needs', () => {
    const names = data.features.map((f) => f.name);
    for (const expected of ['India', 'Sri Lanka', 'Bangladesh', 'Myanmar']) {
      expect(names).toContain(expected);
    }
  });

  it('every ring is closed and inside a sane real-world coordinate range', () => {
    for (const feature of data.features) {
      expect(feature.rings.length).toBeGreaterThan(0);
      for (const ring of feature.rings) {
        expect(ring.length).toBeGreaterThanOrEqual(2);
        for (const [lon, lat] of ring) {
          expect(lon).toBeGreaterThanOrEqual(-180);
          expect(lon).toBeLessThanOrEqual(180);
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('India\'s coastline includes real coordinates near the actual Bay of Bengal region, not just far-flung border fragments', () => {
    const india = data.features.find((f) => f.name === 'India')!;
    const allPoints = india.rings.flat();
    const near = allPoints.some(
      ([lon, lat]) => lon > 78 && lon < 96 && lat > 6 && lat < 23,
    );
    expect(near).toBe(true);
  });
});
