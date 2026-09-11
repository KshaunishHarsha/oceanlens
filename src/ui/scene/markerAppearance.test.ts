import { describe, expect, it } from 'vitest';
import { computeMarkerAppearance, MARKER_COLOR_HEX } from './markerAppearance';

describe('computeMarkerAppearance', () => {
  it('colours GOOD and PROBABLY_GOOD with the good token colour', () => {
    expect(computeMarkerAppearance('GOOD', false, false).colorHex).toBe(0x3fa98a);
    expect(computeMarkerAppearance('PROBABLY_GOOD', false, false).colorHex).toBe(0x3fa98a);
  });

  it('colours SUSPECT distinctly from GOOD', () => {
    const suspect = computeMarkerAppearance('SUSPECT', false, false);
    expect(suspect.colorHex).toBe(0xc9932e);
    expect(suspect.colorHex).not.toBe(MARKER_COLOR_HEX.GOOD);
  });

  it('colours BAD distinctly and does not suppress it (no hidden flag anywhere in the result)', () => {
    const bad = computeMarkerAppearance('BAD', false, false);
    expect(bad.colorHex).toBe(0xd2775e);
    expect(bad.colorHex).not.toBe(MARKER_COLOR_HEX.GOOD);
    expect(bad.colorHex).not.toBe(MARKER_COLOR_HEX.SUSPECT);
    expect(bad.scale).toBeGreaterThan(0); // still rendered, real size
  });

  it('every quality flag maps to a distinct colour except the two "good" tiers', () => {
    const flags = ['GOOD', 'PROBABLY_GOOD', 'SUSPECT', 'BAD'] as const;
    const colors = flags.map((f) => computeMarkerAppearance(f, false, false).colorHex);
    expect(new Set(colors).size).toBe(3); // GOOD and PROBABLY_GOOD legitimately share one
  });

  it('enlarges and flags a selected marker regardless of its QC', () => {
    const sel = computeMarkerAppearance('BAD', true, false);
    expect(sel.selected).toBe(true);
    expect(sel.hovered).toBe(false);
    expect(sel.scale).toBeGreaterThan(computeMarkerAppearance('BAD', false, false).scale);
  });

  it('gives selection priority over hover when both are true', () => {
    const both = computeMarkerAppearance('GOOD', true, true);
    expect(both.selected).toBe(true);
    expect(both.hovered).toBe(false); // never double-rings
  });

  it('marks a plain hover distinctly from selection', () => {
    const hovered = computeMarkerAppearance('GOOD', false, true);
    expect(hovered.selected).toBe(false);
    expect(hovered.hovered).toBe(true);
  });

  it('orders selected above hovered above plain, so nothing real is hidden behind a cluster', () => {
    const plain = computeMarkerAppearance('GOOD', false, false);
    const hovered = computeMarkerAppearance('GOOD', false, true);
    const selected = computeMarkerAppearance('GOOD', true, false);
    expect(selected.renderOrder).toBeGreaterThan(hovered.renderOrder);
    expect(hovered.renderOrder).toBeGreaterThan(plain.renderOrder);
  });
});
