import { describe, expect, it } from 'vitest';
import {
  buildScientificInterpretation,
  calculateBandAgreement,
  calculateHaversineDistance,
  calculateMeanBias,
  calculateRMSE,
  calculateTimeOffsetHours,
  collocateObservationToModel,
  interpolateProfile,
  nearestIndex,
  pairFinite,
} from './stats';

describe('calculateRMSE', () => {
  it('matches a hand-computed value', () => {
    // deltas (model-obs): +1, -1, +2  -> sqrt((1+1+4)/3) = sqrt(2)
    const rmse = calculateRMSE([10, 20, 30], [11, 19, 32]);
    expect(rmse).toBeCloseTo(Math.SQRT2, 12);
  });

  it('is zero for identical series', () => {
    expect(calculateRMSE([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('ignores levels where either value is missing', () => {
    // only the first and last pairs are finite: deltas +1, +1 -> rmse 1
    const rmse = calculateRMSE([10, 20, 30], [11, Number.NaN, 31]);
    expect(rmse).toBe(1);
  });

  it('is NaN when nothing overlaps', () => {
    expect(Number.isNaN(calculateRMSE([], []))).toBe(true);
    expect(Number.isNaN(calculateRMSE([1, 2], [Number.NaN, Number.NaN]))).toBe(true);
  });
});

describe('calculateMeanBias', () => {
  it('is mean of (model - observation)', () => {
    // deltas: +1, -1, +2 -> mean 2/3
    expect(calculateMeanBias([10, 20, 30], [11, 19, 32])).toBeCloseTo(2 / 3, 12);
  });

  it('signs correctly for a cool model', () => {
    expect(calculateMeanBias([20, 20], [19, 19])).toBe(-1);
  });
});

describe('interpolateProfile', () => {
  const profile = [
    { depthM: 0, value: 30 },
    { depthM: 100, value: 20 },
    { depthM: 200, value: 14 },
  ];

  it('returns exact values at node depths', () => {
    expect(interpolateProfile(profile, [0, 100, 200])).toEqual([30, 20, 14]);
  });

  it('linearly interpolates between nodes', () => {
    expect(interpolateProfile(profile, [50])[0]).toBeCloseTo(25, 12);
    expect(interpolateProfile(profile, [150])[0]).toBeCloseTo(17, 12);
  });

  it('never extrapolates beyond the measured range', () => {
    expect(interpolateProfile(profile, [-10, 250])).toEqual([null, null]);
  });

  it('handles an empty profile', () => {
    expect(interpolateProfile([], [0, 50])).toEqual([null, null]);
  });
});

describe('pairFinite', () => {
  it('keeps only levels finite in all three arrays', () => {
    const pairs = pairFinite([0, 50, 100, 150], [30, null, 20, 18], [29, 25, Number.NaN, 17.5]);
    expect(pairs).toEqual([
      { depthM: 0, observed: 30, modeled: 29 },
      { depthM: 150, observed: 18, modeled: 17.5 },
    ]);
  });
});

describe('calculateHaversineDistance', () => {
  it('matches a known Bay of Bengal pair to ~1%', () => {
    // Two real Argo positions, 2023-09-29: 5907082 and 5907083.
    const d = calculateHaversineDistance(
      { latitude: 13.3167, longitude: 83.7167 },
      { latitude: 13.2, longitude: 86.7167 },
    );
    expect(d).toBeGreaterThan(320);
    expect(d).toBeLessThan(330);
  });
});

describe('calculateTimeOffsetHours', () => {
  it('is observation minus model, signed, in hours', () => {
    expect(
      calculateTimeOffsetHours('2023-09-29T14:05:00Z', '2023-09-29T00:00:00Z'),
    ).toBeCloseTo(14.0833, 3);
    expect(
      calculateTimeOffsetHours('2023-09-28T22:00:00Z', '2023-09-29T00:00:00Z'),
    ).toBe(-2);
  });
});

describe('nearestIndex', () => {
  const axis = [0, 10, 20, 50, 100];
  it('finds the closest index on an ascending axis', () => {
    expect(nearestIndex(axis, 12)).toBe(1);
    expect(nearestIndex(axis, 16)).toBe(2);
    expect(nearestIndex(axis, -5)).toBe(0);
    expect(nearestIndex(axis, 999)).toBe(4);
  });
});

describe('collocateObservationToModel', () => {
  const grid = {
    latitudes: [12, 12.5, 13, 13.5, 14],
    longitudes: [86, 86.5, 87, 87.5, 88],
    bounds: { minLat: 12, maxLat: 14, minLon: 86, maxLon: 88 },
  };

  it('snaps to the nearest grid node and reports the real distance', () => {
    const r = collocateObservationToModel({ latitude: 13.2, longitude: 86.72 }, grid);
    expect(r.gridPoint).toEqual({ latitude: 13, longitude: 86.5 });
    expect(r.latIndex).toBe(2);
    expect(r.lonIndex).toBe(1);
    expect(r.withinGrid).toBe(true);
    expect(r.horizontalDistanceKm).toBeGreaterThan(0);
    expect(r.horizontalDistanceKm).toBeLessThan(35);
  });

  it('flags an observation outside the grid', () => {
    const r = collocateObservationToModel({ latitude: 20, longitude: 90 }, grid);
    expect(r.withinGrid).toBe(false);
  });
});

describe('calculateBandAgreement', () => {
  const pairs = [
    { depthM: 10, observed: 29, modeled: 29.1 },
    { depthM: 40, observed: 28, modeled: 28.2 },
    { depthM: 120, observed: 20, modeled: 22 }, // big miss in the thermocline band
    { depthM: 180, observed: 16, modeled: 17.6 },
    { depthM: 400, observed: 10, modeled: 10.1 },
  ];
  const bands = [
    { fromM: 0, toM: 50 },
    { fromM: 100, toM: 200 },
    { fromM: 300, toM: 500 },
  ];

  it('verdicts each band by RMSE against the tolerance', () => {
    const out = calculateBandAgreement(pairs, bands, 1); // tolerance 1 unit
    expect(out[0]!.verdict).toBe('High'); // rmse ~0.16
    expect(out[1]!.verdict).toBe('Low'); // rmse ~1.8 > 1.4*tol
    expect(out[2]!.verdict).toBe('High');
    expect(out[1]!.sampleCount).toBe(2);
  });

  it('reports the per-band mean delta with sign', () => {
    const out = calculateBandAgreement(pairs, bands, 1);
    expect(out[1]!.meanDelta).toBeCloseTo((2 + 1.6) / 2, 6);
  });
});

describe('buildScientificInterpretation', () => {
  const base = {
    variableName: 'Sea-water temperature',
    unit: '°C',
    biasWords: ['warmer', 'cooler'] as const,
    structureName: 'thermocline',
  };

  it('is deterministic for the same input', () => {
    const input = {
      ...base,
      overallRmse: 0.72,
      overallBias: 0.31,
      sampleCount: 68,
      bands: [
        { fromM: 0, toM: 100, meanDelta: 0.1, rmse: 0.2, verdict: 'High' as const, sampleCount: 30 },
        { fromM: 100, toM: 300, meanDelta: 0.9, rmse: 1.1, verdict: 'Low' as const, sampleCount: 20 },
      ],
    };
    expect(buildScientificInterpretation(input)).toBe(buildScientificInterpretation(input));
  });

  it('names the agreeing depth and the biased band and direction', () => {
    const s = buildScientificInterpretation({
      ...base,
      overallRmse: 0.72,
      overallBias: 0.31,
      sampleCount: 68,
      bands: [
        { fromM: 0, toM: 100, meanDelta: 0.1, rmse: 0.2, verdict: 'High', sampleCount: 30 },
        { fromM: 100, toM: 300, meanDelta: 0.9, rmse: 1.1, verdict: 'Low', sampleCount: 20 },
      ],
    });
    expect(s).toContain('agree through 100 m');
    expect(s).toContain('warmer model bias');
    expect(s).toContain('100–300 m');
    expect(s).toContain('n = 68 levels');
  });

  it('says so plainly when there is no overlap', () => {
    const s = buildScientificInterpretation({
      ...base,
      overallRmse: Number.NaN,
      overallBias: Number.NaN,
      sampleCount: 0,
      bands: [],
    });
    expect(s).toMatch(/no comparison can be made/i);
  });
});
