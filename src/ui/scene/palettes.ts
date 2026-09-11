/* Colour ramps for the 3D scene's model-field texture.
 *
 * These stops are copied verbatim from the CSS gradients in
 * src/styles/tokens.css (--ramp-thermal, --ramp-haline, --ramp-speed,
 * --ramp-algae) so the WebGL texture and the on-screen legend swatch always
 * agree — the legend IS the ramp, not an approximation of it. If the tokens
 * change, update both places; `palettes.test.ts` pins the stop colours so a
 * silent drift fails a test rather than just looking wrong. */

import type { PaletteName } from '@/domain/variables';

export type RGB = readonly [number, number, number];

/** [offset 0..1, [r,g,b] 0..255] */
type Stop = readonly [number, RGB];

const THERMAL: readonly Stop[] = [
  [0, [0x1b, 0x2a, 0x6b]],
  [0.24, [0x1d, 0x5c, 0x8c]],
  [0.46, [0x1f, 0x8c, 0x93]],
  [0.62, [0x4f, 0xa8, 0x8a]],
  [0.82, [0xc7, 0x9b, 0x3c]],
  [1, [0xc4, 0x64, 0x3c]],
];

const HALINE: readonly Stop[] = [
  [0, [0x16, 0x23, 0x4f]],
  [0.24, [0x1c, 0x4c, 0x7a]],
  [0.46, [0x2c, 0x7f, 0x92]],
  [0.64, [0x56, 0xa7, 0x8e]],
  [0.83, [0x9c, 0xc0, 0x8a]],
  [1, [0xd9, 0xd7, 0xa6]],
];

const SPEED: readonly Stop[] = [
  [0, [0x10, 0x1a, 0x2e]],
  [0.24, [0x1d, 0x4e, 0x6b]],
  [0.46, [0x2e, 0x86, 0xa0]],
  [0.66, [0x58, 0xb0, 0xb5]],
  [0.84, [0x9a, 0xd1, 0xc4]],
  [1, [0xe4, 0xeb, 0xd9]],
];

const ALGAE: readonly Stop[] = [
  [0, [0x10, 0x23, 0x1c]],
  [0.24, [0x14, 0x45, 0x3a]],
  [0.46, [0x1c, 0x6b, 0x4f]],
  [0.66, [0x3e, 0x91, 0x59]],
  [0.84, [0x86, 0xb4, 0x5c]],
  [1, [0xd6, 0xd1, 0x83]],
];

const RAMPS: Readonly<Record<PaletteName, readonly Stop[]>> = {
  thermal: THERMAL,
  haline: HALINE,
  speed: SPEED,
  algae: ALGAE,
};

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Sample a named ramp at t in [0, 1]. Clamps t; never extrapolates. */
export function sampleRamp(palette: PaletteName, t: number): RGB {
  const stops = RAMPS[palette];
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const [hi, hiColor] = stops[i]!;
    if (clamped <= hi) {
      const [lo, loColor] = stops[i - 1]!;
      const span = hi - lo;
      const f = span === 0 ? 0 : (clamped - lo) / span;
      return [
        Math.round(lerp(loColor[0], hiColor[0], f)),
        Math.round(lerp(loColor[1], hiColor[1], f)),
        Math.round(lerp(loColor[2], hiColor[2], f)),
      ];
    }
  }
  const last = stops[stops.length - 1]!;
  return last[1];
}
