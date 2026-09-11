/* Pure appearance mapping for a real observation marker in the 3D scene:
 * QC + selection/hover state -> colour, size, label. No Three.js import, so
 * this is directly unit-testable.
 *
 * Colours are copied verbatim from src/styles/tokens.css (--good, --warn,
 * --bad, --cyan-bright) so the WebGL markers and every other QC badge in the
 * app (EvidencePanel, ControlRail) agree — same principle as palettes.ts for
 * the field ramps. BAD and SUSPECT observations get their own honest colour;
 * neither is hidden nor recoloured to look better than it is. */

import type { QualityFlag } from '@/domain/quality';

export const MARKER_COLOR_HEX: Readonly<Record<QualityFlag, number>> = {
  GOOD: 0x3fa98a, // --good
  PROBABLY_GOOD: 0x3fa98a, // --good (same badge colour as GOOD in QUALITY, domain/quality.ts)
  SUSPECT: 0xc9932e, // --warn
  BAD: 0xd2775e, // --bad
};

export const SELECTED_RING_COLOR_HEX = 0x6fdcf0; // --cyan-bright
export const HOVERED_RING_COLOR_HEX = 0xffffff;

export interface MarkerAppearance {
  readonly colorHex: number;
  /** Relative sprite scale multiplier; 1 = base size. */
  readonly scale: number;
  /** Whether to draw the selection ring (cyan). */
  readonly selected: boolean;
  /** Whether to draw the hover ring (white), when not also selected. */
  readonly hovered: boolean;
  /** Draw order — selected/hovered markers paint above plain ones so they
   * are never hidden behind a denser cluster. */
  readonly renderOrder: number;
}

export function computeMarkerAppearance(
  qc: QualityFlag,
  isSelected: boolean,
  isHovered: boolean,
): MarkerAppearance {
  return {
    colorHex: MARKER_COLOR_HEX[qc],
    scale: isSelected ? 1.6 : isHovered ? 1.25 : 1,
    selected: isSelected,
    hovered: isHovered && !isSelected,
    renderOrder: isSelected ? 3 : isHovered ? 2 : 1,
  };
}
