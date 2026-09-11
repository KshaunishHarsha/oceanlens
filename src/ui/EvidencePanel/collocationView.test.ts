import { describe, expect, it } from 'vitest';
import {
  describeBiasDirection,
  formatHours,
  formatKm,
  isCollocationVariable,
  selectCollocationView,
  verdictColorVar,
} from './collocationView';

describe('isCollocationVariable', () => {
  it('supports only temperature and salinity — matches ProfileChart\'s gate', () => {
    expect(isCollocationVariable('temperature')).toBe(true);
    expect(isCollocationVariable('salinity')).toBe(true);
    expect(isCollocationVariable('currentSpeed')).toBe(false);
    expect(isCollocationVariable('chlorophyll')).toBe(false);
  });
});

describe('verdictColorVar', () => {
  it('maps every real verdict word to a distinct existing token, never inventing a new one', () => {
    const colors = (['High', 'Fair', 'Moderate', 'Low'] as const).map(verdictColorVar);
    expect(colors).toEqual(['--good', '--cyan', '--warn', '--bad']);
    expect(new Set(colors).size).toBe(4);
  });
});

describe('formatKm', () => {
  it('formats a real finite distance', () => {
    expect(formatKm(4.211)).toBe('4.21 km');
    expect(formatKm(123.4)).toBe('123.4 km');
  });

  it('returns an em dash for a non-finite value — never a fabricated 0', () => {
    expect(formatKm(Number.NaN)).toBe('—');
    expect(formatKm(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatHours', () => {
  it('signs a positive offset (observation after model)', () => {
    expect(formatHours(14.08)).toBe('+14.1 h');
  });

  it('signs a negative offset (observation before model) with a real minus, not a hyphen substitute issue', () => {
    expect(formatHours(-10.2)).toBe('−10.2 h');
  });

  it('returns an em dash for a non-finite value', () => {
    expect(formatHours(Number.NaN)).toBe('—');
  });
});

describe('describeBiasDirection', () => {
  const words: readonly [string, string] = ['warmer', 'cooler'];

  it('describes a positive bias using the first (positive) word', () => {
    expect(describeBiasDirection(words, 0.18)).toBe('model warmer than observed');
  });

  it('describes a negative bias using the second (negative) word', () => {
    expect(describeBiasDirection(words, -0.4)).toBe('model cooler than observed');
  });

  it('treats exactly zero as the positive word (>= 0), never a special case', () => {
    expect(describeBiasDirection(words, 0)).toBe('model warmer than observed');
  });

  it('returns empty (never guesses a direction) for an unavailable statistic', () => {
    expect(describeBiasDirection(words, Number.NaN)).toBe('');
  });
});

describe('selectCollocationView', () => {
  const base = {
    variableSupported: true,
    variableName: 'Sea-water temperature',
    status: 'ready' as const,
    error: null,
    sampleCount: 5,
  };

  it('flags an unsupported variable before considering fetch status at all', () => {
    expect(
      selectCollocationView({ ...base, variableSupported: false, variableName: 'Chlorophyll-a' }),
    ).toEqual({ kind: 'unavailable-variable', variableName: 'Chlorophyll-a' });
  });

  it('shows loading for idle/loading status', () => {
    for (const status of ['idle', 'loading'] as const) {
      expect(selectCollocationView({ ...base, status })).toEqual({ kind: 'loading' });
    }
  });

  it('surfaces a real fetch error', () => {
    expect(
      selectCollocationView({ ...base, status: 'error', error: 'backend unreachable' }),
    ).toEqual({ kind: 'error', message: 'backend unreachable' });
  });

  it('reports no-collocation when the adapter genuinely found none (sampleCount null)', () => {
    expect(selectCollocationView({ ...base, sampleCount: null })).toEqual({
      kind: 'no-collocation',
    });
  });

  it('reports no-valid-levels for a real result with zero QC-good overlap (e.g. an all-BAD profile)', () => {
    expect(selectCollocationView({ ...base, sampleCount: 0 })).toEqual({
      kind: 'no-valid-levels',
    });
  });

  it('is ready once there is at least one real overlapping level', () => {
    expect(selectCollocationView({ ...base, sampleCount: 1 })).toEqual({ kind: 'ready' });
  });
});
