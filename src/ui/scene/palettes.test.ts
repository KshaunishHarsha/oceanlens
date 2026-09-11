import { describe, expect, it } from 'vitest';
import { sampleRamp } from './palettes';

describe('sampleRamp', () => {
  it('returns the exact first stop colour at t=0 for every palette', () => {
    expect(sampleRamp('thermal', 0)).toEqual([0x1b, 0x2a, 0x6b]);
    expect(sampleRamp('haline', 0)).toEqual([0x16, 0x23, 0x4f]);
    expect(sampleRamp('speed', 0)).toEqual([0x10, 0x1a, 0x2e]);
    expect(sampleRamp('algae', 0)).toEqual([0x10, 0x23, 0x1c]);
  });

  it('returns the exact last stop colour at t=1 for every palette', () => {
    expect(sampleRamp('thermal', 1)).toEqual([0xc4, 0x64, 0x3c]);
    expect(sampleRamp('haline', 1)).toEqual([0xd9, 0xd7, 0xa6]);
    expect(sampleRamp('speed', 1)).toEqual([0xe4, 0xeb, 0xd9]);
    expect(sampleRamp('algae', 1)).toEqual([0xd6, 0xd1, 0x83]);
  });

  it('interpolates linearly between two known thermal stops', () => {
    // Stops at 0.24 (#1d5c8c) and 0.46 (#1f8c93); midpoint t=0.35 is halfway.
    const mid = sampleRamp('thermal', 0.35);
    expect(Math.abs(mid[0] - (0x1d + 0x1f) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(mid[1] - (0x5c + 0x8c) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(mid[2] - (0x8c + 0x93) / 2)).toBeLessThanOrEqual(1);
  });

  it('clamps out-of-range t rather than extrapolating', () => {
    expect(sampleRamp('thermal', -5)).toEqual(sampleRamp('thermal', 0));
    expect(sampleRamp('thermal', 5)).toEqual(sampleRamp('thermal', 1));
  });

  it('is monotonically distinct across the four palettes at the same t', () => {
    const t = 0.5;
    const colors = (['thermal', 'haline', 'speed', 'algae'] as const).map((p) => sampleRamp(p, t));
    const unique = new Set(colors.map((c) => c.join(',')));
    expect(unique.size).toBe(4);
  });
});
