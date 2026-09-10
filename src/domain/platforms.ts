/* Observation platform classes.
 *
 * The union is complete on purpose. Nothing is excluded here because it looked
 * hard to source — a platform's presence in the product is decided by whether
 * Phase 2 found real data for it, which is recorded in the layer registry, not
 * in this type. */

export type PlatformType = 'ARGO' | 'GLIDER' | 'CTD' | 'BGC';

export const PLATFORM_TYPES: readonly PlatformType[] = ['ARGO', 'GLIDER', 'CTD', 'BGC'];

export interface PlatformMeta {
  readonly id: PlatformType;
  /** Rail label, e.g. "ARGO". */
  readonly label: string;
  /** Longer description for the evidence panel header. */
  readonly description: string;
  /** Marker glyph used in legends and dense lists. */
  readonly glyph: string;
  /** CSS variable holding this platform's identity colour. */
  readonly colorVar: string;
  /** Noun for counting, e.g. "3 platforms" vs "7 profiles". */
  readonly countNoun: string;
  /** Scene marker shape. The renderer maps this to geometry. */
  readonly markerShape: 'circle' | 'triangle' | 'diamond' | 'ring';
  /** True if the platform moves along a track we can draw. */
  readonly hasTrack: boolean;
}

export const PLATFORMS: Readonly<Record<PlatformType, PlatformMeta>> = {
  ARGO: {
    id: 'ARGO',
    label: 'ARGO',
    description: 'Argo profiling float',
    glyph: '●',
    colorVar: '--platform-argo',
    countNoun: 'platforms',
    markerShape: 'circle',
    hasTrack: false,
  },
  GLIDER: {
    id: 'GLIDER',
    label: 'GLIDER',
    description: 'Autonomous underwater glider',
    glyph: '▲',
    colorVar: '--platform-glider',
    countNoun: 'platforms',
    markerShape: 'triangle',
    hasTrack: true,
  },
  CTD: {
    id: 'CTD',
    label: 'CTD',
    description: 'Shipborne CTD cast',
    glyph: '◆',
    colorVar: '--platform-ctd',
    countNoun: 'profiles',
    markerShape: 'diamond',
    hasTrack: false,
  },
  BGC: {
    id: 'BGC',
    label: 'BGC FLOAT',
    description: 'Biogeochemical profiling float',
    glyph: '○',
    colorVar: '--platform-bgc',
    countNoun: 'platforms',
    markerShape: 'ring',
    hasTrack: false,
  },
};

export function platformMeta(p: PlatformType): PlatformMeta {
  return PLATFORMS[p];
}
