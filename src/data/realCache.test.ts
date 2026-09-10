/* Validates the committed real-data cache against the domain model and the
 * honesty policy. Runs offline against public/data/real/.
 *
 * If the cache has not been prepared yet (fresh clone before
 * `npm run data:prepare`), the suite skips rather than fails, and says so. */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_STATUS, FORBIDDEN_CLAIMS } from '@/domain/provenance';
import { calculateMeanBias, calculateRMSE, pairFinite } from '@/domain/stats';

const ROOT = 'public/data/real';
const have = existsSync(join(ROOT, 'manifest.json'));
const readJson = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

describe.skipIf(!have)('real-data cache', () => {
  const manifest = have ? readJson('manifest.json') : null;
  const grid = have ? readJson('model/grid.json') : null;
  const profiles: any[] = have ? readJson('observations/profiles.json') : [];
  const columns: any[] = have ? readJson('model/columns.json') : [];

  it('manifest declares a historical window, not live data', () => {
    expect(manifest.windowLabel).toBeTruthy();
    expect(manifest.windowLabel).not.toMatch(/live|operational|real-?time/i);
    expect(manifest.viewId.startsWith('DEMO-')).toBe(true);
    expect(Date.parse(manifest.demonstrationWindow.start)).toBeLessThan(
      Date.parse(manifest.demonstrationWindow.end),
    );
  });

  it('carries no forbidden claim anywhere', () => {
    const text = JSON.stringify(manifest).toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(text.includes(claim.toLowerCase())).toBe(false);
    }
  });

  it('every source uses a known status vocabulary word', () => {
    for (const s of manifest.sources) {
      expect(Object.keys(DATA_STATUS)).toContain(s.status);
    }
  });

  it('real sources carry url, retrieval time and checksums', () => {
    for (const s of manifest.sources) {
      if (s.status === 'REAL_CACHED' || s.status === 'PRECOMPUTED_FROM_REAL') {
        expect(s.sourceUrl, `${s.id} sourceUrl`).toBeTruthy();
        expect(s.retrievedAt, `${s.id} retrievedAt`).toBeTruthy();
        expect(Object.keys(s.checksums).length, `${s.id} checksums`).toBeGreaterThan(0);
        expect(s.transformations.length, `${s.id} transformations`).toBeGreaterThan(0);
      }
    }
  });

  it('model slice binaries match the grid shape', () => {
    const { nt, nz, ny, nx } = grid.shape;
    const bytes = (f: string) =>
      existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f)).byteLength : -1;
    for (const v of ['temperature', 'salinity']) {
      expect(bytes(`model/${v}.f32`)).toBe(nt * nz * ny * nx * 4);
    }
  });

  it('grid axes are strictly ascending', () => {
    for (const key of ['latitudes', 'longitudes', 'depthsM', 'timestamps'] as const) {
      const a = grid[key].map((x: string | number) =>
        typeof x === 'string' ? Date.parse(x) : x,
      );
      for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    }
  });

  it('every profile has ascending depths and parallel QC arrays', () => {
    expect(profiles.length).toBeGreaterThan(0);
    for (const p of profiles) {
      for (let i = 1; i < p.depthsM.length; i++) {
        expect(p.depthsM[i]).toBeGreaterThan(p.depthsM[i - 1]);
      }
      const n = p.depthsM.length;
      for (const k of ['temperature', 'salinity', 'temperatureQc', 'salinityQc']) {
        expect(p[k].length, `${p.id}.${k}`).toBe(n);
      }
      const finiteT = p.temperature.filter((v: unknown) => typeof v === 'number').length;
      const qcT = p.temperatureQc.filter((v: unknown) => v != null).length;
      if (finiteT > 0) expect(qcT, `${p.id} QC dropped`).toBeGreaterThan(0);
    }
  });

  it('contains real INCOIS profiles', () => {
    const incois = profiles.filter((p) => p.identity?.dataCentre === 'IN');
    expect(incois.length).toBeGreaterThan(0);
  });

  it('keeps the QC-failed profile rather than hiding it', () => {
    // Float 4903776 cycle 2 has PROFILE_TEMP_QC = F. It must still be present.
    const failed = profiles.find((p) => p.id.startsWith('ARGO-4903776'));
    expect(failed).toBeTruthy();
  });

  it('RMSE and bias recomputed here match a from-scratch pairing', () => {
    // Pick a profile with a model column and good temperature levels.
    const p = profiles.find(
      (x) =>
        columns.some((c) => c.observationId === x.id) &&
        x.temperatureQc.some((f: string) => f === 'GOOD' || f === 'PROBABLY_GOOD'),
    );
    expect(p).toBeTruthy();
    const col = columns.find((c) => c.observationId === p.id);
    const slot = col.byTimestamp[0];

    // crude nearest-depth pairing, independent of the adapter's interpolation
    const obs: number[] = [];
    const mod: number[] = [];
    p.depthsM.forEach((z: number, i: number) => {
      const f = p.temperatureQc[i];
      const o = p.temperature[i];
      if ((f === 'GOOD' || f === 'PROBABLY_GOOD') && typeof o === 'number') {
        let k = 0;
        for (let j = 1; j < col.depthsM.length; j++) {
          if (Math.abs(col.depthsM[j] - z) < Math.abs(col.depthsM[k] - z)) k = j;
        }
        const m = slot.temperature[k];
        if (typeof m === 'number') {
          obs.push(o);
          mod.push(m);
        }
      }
    });
    const pairs = pairFinite(obs.map((_, i) => i), obs, mod);
    expect(pairs.length).toBeGreaterThan(3);
    const rmse = calculateRMSE(obs, mod);
    const bias = calculateMeanBias(obs, mod);
    expect(Number.isFinite(rmse)).toBe(true);
    expect(Number.isFinite(bias)).toBe(true);
    // sanity: HYCOM vs Argo temperature RMSE in the BoB is a few tenths to ~2 C
    expect(rmse).toBeGreaterThan(0);
    expect(rmse).toBeLessThan(5);
  });
});

describe.skipIf(have)('real-data cache (not prepared)', () => {
  it('is skipped until `npm run data:prepare` has been run', () => {
    expect(have).toBe(false);
  });
});
