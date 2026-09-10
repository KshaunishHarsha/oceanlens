import { describe, expect, it } from 'vitest';
import { argoProfileQcToPercent, fromArgoQc, QUALITY, worstFlag } from './quality';
import { formatDelta, formatValue, VARIABLES } from './variables';
import { haversineKm, withinBounds } from './types';
import { DATA_STATUS, unavailable } from './provenance';

describe('Argo QC mapping', () => {
  it('maps the four judgement flags', () => {
    expect(fromArgoQc('1')).toBe('GOOD');
    expect(fromArgoQc('2')).toBe('PROBABLY_GOOD');
    expect(fromArgoQc('3')).toBe('SUSPECT');
    expect(fromArgoQc('4')).toBe('BAD');
  });

  it('returns null for values carrying no quality judgement', () => {
    // 5 changed, 8 interpolated, 9 missing, blank not assessed.
    for (const c of ['5', '8', '9', ' ', '', 'x']) expect(fromArgoQc(c)).toBeNull();
  });

  it('only lets flags 1 and 2 through a good-quality filter', () => {
    expect(QUALITY.GOOD.passesGoodOnlyFilter).toBe(true);
    expect(QUALITY.PROBABLY_GOOD.passesGoodOnlyFilter).toBe(true);
    expect(QUALITY.SUSPECT.passesGoodOnlyFilter).toBe(false);
    expect(QUALITY.BAD.passesGoodOnlyFilter).toBe(false);
  });

  it('reads PROFILE_<PARAM>_QC letters, including the E/F we saw on real INCOIS floats', () => {
    expect(argoProfileQcToPercent('A')).toBe(100);
    expect(argoProfileQcToPercent('D')).toBe(25);
    expect(argoProfileQcToPercent('E')).toBe(0);
    expect(argoProfileQcToPercent('F')).toBe(0);
    expect(argoProfileQcToPercent(' ')).toBeNull();
  });

  it('summarises a mixed profile by its worst flag', () => {
    expect(worstFlag(['GOOD', 'GOOD', 'SUSPECT'])).toBe('SUSPECT');
    expect(worstFlag(['GOOD', 'PROBABLY_GOOD'])).toBe('PROBABLY_GOOD');
    expect(worstFlag(['BAD', 'GOOD'])).toBe('BAD');
    expect(worstFlag([])).toBeNull();
  });
});

describe('value formatting', () => {
  it('uses each variable declared precision', () => {
    expect(formatValue('temperature', 29.3812)).toBe('29.38 °C');
    expect(formatValue('chlorophyll', 0.30512)).toBe('0.305 mg/m³');
  });

  it('never renders NaN or null into the interface', () => {
    expect(formatValue('temperature', null)).toBe('—');
    expect(formatValue('temperature', Number.NaN)).toBe('—');
    expect(formatDelta('temperature', null)).toBe('—');
  });

  it('signs deltas explicitly, using a true minus sign', () => {
    expect(formatDelta('temperature', 0.18)).toBe('+0.18 °C');
    expect(formatDelta('temperature', -0.62)).toBe('−0.62 °C');
  });

  it('gives every variable a CF standard name for provenance', () => {
    for (const v of Object.values(VARIABLES)) {
      expect(v.cfStandardName.length).toBeGreaterThan(0);
      expect(v.unit.length).toBeGreaterThan(0);
    }
  });
});

describe('geography', () => {
  it('computes great-circle distance', () => {
    // Two real Argo positions from the Phase 0 audit, 2026-09-03.
    const a = { latitude: 9.112, longitude: 86.795 };
    const b = { latitude: 12.397, longitude: 88.933 };
    const d = haversineKm(a, b);
    expect(d).toBeGreaterThan(420);
    expect(d).toBeLessThan(450);
  });

  it('is zero for coincident points and symmetric', () => {
    const a = { latitude: 16.82, longitude: 88.31 };
    const b = { latitude: 14.255, longitude: 91.261 };
    expect(haversineKm(a, a)).toBeCloseTo(0, 9);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });

  it('tests bounds inclusively', () => {
    const bay = { minLat: 5, maxLat: 23, minLon: 78, maxLon: 95 };
    expect(withinBounds({ latitude: 16.82, longitude: 88.31 }, bay)).toBe(true);
    expect(withinBounds({ latitude: 5, longitude: 78 }, bay)).toBe(true);
    expect(withinBounds({ latitude: 2, longitude: 88 }, bay)).toBe(false);
  });
});

describe('data status', () => {
  it('never marks an unavailable layer renderable', () => {
    expect(DATA_STATUS.NOT_AVAILABLE_MVP.renderable).toBe(false);
    expect(DATA_STATUS.PLANNED_EXTENSION.renderable).toBe(false);
    expect(DATA_STATUS.NOT_AVAILABLE_MVP.interactive).toBe(false);
  });

  it('builds an unavailable descriptor with no source claims', () => {
    const d = unavailable('satellite.sst', 'Satellite SST', 'PLANNED_EXTENSION', [
      'No source investigated yet.',
    ]);
    expect(d.sourceUrl).toBeNull();
    expect(d.retrievedAt).toBeNull();
    expect(d.sourceFiles).toHaveLength(0);
    expect(DATA_STATUS[d.status].renderable).toBe(false);
  });
});
