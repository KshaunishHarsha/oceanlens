/* Pure data-mapping functions between a real VolumeSlice (from
 * OceanDataAdapter.getVolumeSlice — never fabricated, never a synthetic
 * fallback) and what the Three.js layer needs: an RGBA pixel buffer and a
 * geographically-scaled plane size. No Three.js/WebGL imports here on
 * purpose — this is the part of the scene that a unit test can actually
 * exercise without a browser. */

import type { GeoBounds, GeoPoint, VolumeSlice } from '@/domain/types';
import { sampleRamp } from './palettes';
import type { PaletteName } from '@/domain/variables';

export interface SliceTextureData {
  readonly data: Uint8ClampedArray; // RGBA, row-major, row 0 = slice.values row 0
  readonly width: number;
  readonly height: number;
}

/**
 * Maps a real VolumeSlice onto an RGBA buffer via the variable's colour ramp.
 *
 * `domainRange` is the variable's declared scientific range (matching the
 * legend ticks already shown in SceneStage), not the slice's own min/max —
 * so the same colour always means the same value across every timestamp and
 * depth, which is what "restrained scientific colour scale" requires.
 *
 * A cell with `valid[i] === 0` (land or missing — real absence, per the
 * VolumeSlice contract) gets alpha 0. Nothing is invented for it.
 */
export function buildSliceTexture(
  slice: VolumeSlice,
  palette: PaletteName,
  domainRange: readonly [number, number],
): SliceTextureData {
  const { nx, ny, values, valid } = slice;
  const [lo, hi] = domainRange;
  const span = hi - lo;
  const data = new Uint8ClampedArray(nx * ny * 4);

  for (let i = 0; i < nx * ny; i++) {
    const o = i * 4;
    if (!valid[i]) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      continue;
    }
    const v = values[i]!;
    const t = span === 0 ? 0 : (v - lo) / span;
    const [r, g, b] = sampleRamp(palette, t);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }

  return { data, width: nx, height: ny };
}

export interface PlaneWorldSize {
  /** World units along the east–west (longitude) axis. */
  readonly width: number;
  /** World units along the north–south (latitude) axis. */
  readonly depth: number;
}

/** World units per degree of latitude. Longitude is scaled by cos(mean
 * latitude) so a degree of longitude — genuinely shorter than a degree of
 * latitude away from the equator — doesn't render as a square, without
 * pulling in a full geodesy library for a flat regional slice. */
const WORLD_UNITS_PER_DEGREE = 6;

/** cos(mean latitude), clamped away from 0 so a bounds box straddling a pole
 * (not a real case for this project's region, but cheap to guard) can't
 * blow the correction up to infinity. Shared by the plane and by every
 * point projected onto it — this is the ONE place that scale lives, so a
 * marker can never drift from the plane it sits on. */
function longitudeCorrection(bounds: GeoBounds): number {
  const midLatRad = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  return Math.max(0.1, Math.cos(midLatRad));
}

export function computePlaneWorldSize(bounds: GeoBounds): PlaneWorldSize {
  const latSpan = bounds.maxLat - bounds.minLat;
  const lonSpan = bounds.maxLon - bounds.minLon;
  return {
    width: lonSpan * WORLD_UNITS_PER_DEGREE * longitudeCorrection(bounds),
    depth: latSpan * WORLD_UNITS_PER_DEGREE,
  };
}

export interface WorldXZ {
  readonly x: number;
  readonly z: number;
}

/**
 * Projects a real (latitude, longitude) onto the same XZ plane
 * `computePlaneWorldSize` sizes and `ThreeSceneCanvas` builds the slice
 * plane on — same origin (bounds centre), same per-degree scale, same
 * south=+Z/north=-Z convention documented in `ThreeSceneCanvas.tsx`. A
 * point outside `bounds` still projects (linear extrapolation) rather than
 * throwing — real Argo floats can sit just outside the model's bounding
 * box, and clipping them would mean hiding a real, if slightly off-grid,
 * observation.
 */
export function projectGeoToWorld(latitude: number, longitude: number, bounds: GeoBounds): WorldXZ {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const lonMid = (bounds.minLon + bounds.maxLon) / 2;
  const lonCorrection = longitudeCorrection(bounds);
  return {
    x: (longitude - lonMid) * WORLD_UNITS_PER_DEGREE * lonCorrection,
    z: -(latitude - latMid) * WORLD_UNITS_PER_DEGREE,
  };
}

/** Inverse of projectGeoToWorld, used only for a deliberate click on the
 * real model plane. The point is clamped to the plane's actual bounds. */
export function projectWorldToGeo(x: number, z: number, bounds: GeoBounds): GeoPoint {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const lonMid = (bounds.minLon + bounds.maxLon) / 2;
  const latitude = latMid - z / WORLD_UNITS_PER_DEGREE;
  const longitude = lonMid + x / (WORLD_UNITS_PER_DEGREE * longitudeCorrection(bounds));
  return {
    latitude: Math.min(bounds.maxLat, Math.max(bounds.minLat, latitude)),
    longitude: Math.min(bounds.maxLon, Math.max(bounds.minLon, longitude)),
  };
}

/** Nearest real grid cell at a geographic probe point. Missing/land cells
 * remain null: a hover readout must never invent an ocean value over land. */
export function sampleSliceNearest(slice: VolumeSlice, point: GeoPoint): number | null {
  const x = Math.round(((point.longitude - slice.bounds.minLon) / (slice.bounds.maxLon - slice.bounds.minLon)) * (slice.nx - 1));
  const y = Math.round(((point.latitude - slice.bounds.minLat) / (slice.bounds.maxLat - slice.bounds.minLat)) * (slice.ny - 1));
  const xi = Math.min(slice.nx - 1, Math.max(0, x));
  const yi = Math.min(slice.ny - 1, Math.max(0, y));
  const index = yi * slice.nx + xi;
  return slice.valid[index] ? slice.values[index] ?? null : null;
}

/**
 * World-space Y (up) for a given depth, negative = below the surface.
 * `exaggeration` is the store's verticalExaggeration (a visual multiplier
 * only — never changes what depth value is reported elsewhere in the UI).
 */
export function depthToWorldY(depthM: number, exaggeration: number): number {
  const WORLD_UNITS_PER_1000M_AT_1X = 3;
  const y = -(depthM / 1000) * WORLD_UNITS_PER_1000M_AT_1X * (exaggeration / 18);
  return y === 0 ? 0 : y; // normalise -0 to 0
}
