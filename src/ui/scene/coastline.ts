/* Pure data-mapping for the scene's real coastline reference layer — same
 * split as sliceTexture.ts: no Three.js/WebGL imports here, so this is the
 * part a unit test can exercise directly.
 *
 * The coastline itself is real Natural Earth cartographic data (see
 * scripts/prepare-coastline.mjs's header comment for provenance and why it
 * is vendored rather than fetched from a CDN at runtime), not an
 * oceanographic measurement — it never goes through OceanDataAdapter. */

import type { GeoBounds } from '@/domain/types';
import { projectGeoToWorld, type WorldXZ } from './sliceTexture';

/** One [longitude, latitude] pair, matching GeoJSON/TopoJSON coordinate order. */
export type LonLat = readonly [number, number];

export interface CoastlineFeature {
  readonly name: string;
  /** Each ring is a closed polygon boundary, real coordinates only. */
  readonly rings: readonly (readonly LonLat[])[];
}

export interface CoastlineSource {
  readonly datasetName: string;
  readonly originator: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly licence: string;
}

export interface CoastlineData {
  readonly region: GeoBounds;
  readonly source: CoastlineSource;
  readonly features: readonly CoastlineFeature[];
}

export interface ProjectedRing {
  readonly points: readonly WorldXZ[];
}

export interface ProjectedCoastlineFeature {
  readonly name: string;
  readonly rings: readonly ProjectedRing[];
}

/**
 * Projects every real coastline ring onto the same XZ plane the depth-slice
 * plane and the Argo markers use — same `projectGeoToWorld`, same `bounds`,
 * so the coastline can never drift from what it is supposed to outline.
 * `bounds` is deliberately the live slice's own bounds (not the coastline
 * file's own recorded `region`), matching the convention `ThreeSceneCanvas`
 * already uses for markers.
 */
export function projectCoastline(
  data: CoastlineData,
  bounds: GeoBounds,
): readonly ProjectedCoastlineFeature[] {
  return data.features.map((feature) => ({
    name: feature.name,
    rings: feature.rings
      .filter((ring) => ring.length >= 2)
      .map((ring) => ({
        points: ring.map(([lon, lat]) => projectGeoToWorld(lat, lon, bounds)),
      })),
  }));
}
