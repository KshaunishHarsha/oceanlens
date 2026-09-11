import type { OceanVariable } from './variables';
import type { PlatformType } from './platforms';
import type { QualityFlag } from './quality';
import type { DataSourceDescriptor } from './provenance';

/* ------------------------------------------------------------------ *
 * Geography
 * ------------------------------------------------------------------ */

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface GeoBounds {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
}

export function withinBounds(p: GeoPoint, b: GeoBounds): boolean {
  return (
    p.latitude >= b.minLat &&
    p.latitude <= b.maxLat &&
    p.longitude >= b.minLon &&
    p.longitude <= b.maxLon
  );
}

/** Great-circle distance in kilometres. Used for real collocation. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ------------------------------------------------------------------ *
 * Model side
 * ------------------------------------------------------------------ */

export interface OceanModelGrid {
  readonly id: string;
  /** Free-form so a new model can be added without widening a union. */
  readonly source: string;
  readonly variable: OceanVariable;
  readonly unit: string;
  /** ISO 8601 UTC, ascending. */
  readonly timestamps: readonly string[];
  /** Metres, positive down, ascending. */
  readonly depthsM: readonly number[];
  readonly bounds: GeoBounds;
  readonly resolution: { readonly nx: number; readonly ny: number; readonly nz: number };
  readonly provenance: DataSourceDescriptor;
}

/**
 * A horizontal slice of the model volume at one depth and one time.
 * `values` is row-major `[y * nx + x]`, row 0 = `bounds.minLat` (south),
 * ascending northward — matching `CachedRealDataAdapter`'s `.f32` layout and
 * the API's `latitudes` array, both ascending. (Corrected 2026-09-11: an
 * earlier version of this doc said "north-to-south"; verified against the
 * actual data pipeline while building the 3D scene — see
 * `src/ui/scene/sliceTexture.ts`.)
 * `null` entries are land or missing data — never silently zero-filled.
 */
export interface VolumeSlice {
  readonly gridId: string;
  readonly variable: OceanVariable;
  readonly timestamp: string;
  readonly depthM: number;
  readonly nx: number;
  readonly ny: number;
  readonly bounds: GeoBounds;
  readonly values: Float32Array;
  /** Parallel mask: true where `values` holds real data. */
  readonly valid: Uint8Array;
  readonly range: readonly [number, number];
}

/** One model column interpolated to an observation's position and time. */
export interface ModelColumn {
  readonly gridId: string;
  readonly variable: OceanVariable;
  readonly timestamp: string;
  readonly at: GeoPoint;
  readonly depthsM: readonly number[];
  readonly values: readonly (number | null)[];
}

/* ------------------------------------------------------------------ *
 * Observation side
 * ------------------------------------------------------------------ */

/** One measured level. Per-level QC is mandatory — real profiles mix flags. */
export interface ObservationLevel {
  readonly depthM: number;
  readonly value: number;
  readonly qc: QualityFlag;
}

export interface ObservationProfile {
  readonly id: string;
  readonly platformType: PlatformType;
  /** Display name, e.g. "ARGO 1902594". */
  readonly platformName: string;
  readonly latitude: number;
  readonly longitude: number;
  /** ISO 8601 UTC. */
  readonly observedAt: string;
  /** Summary flag for the profile. Derived from per-level flags, not asserted. */
  readonly qc: QualityFlag;
  /** Depth axis shared by every variable in this profile, positive down. */
  readonly depthsM: readonly number[];
  /** Parallel to `depthsM`. Absent variables are simply not keyed. */
  readonly variables: Partial<Record<OceanVariable, readonly (number | null)[]>>;
  /** Per-level QC, parallel to `depthsM`, keyed by variable. */
  readonly qcByVariable: Partial<Record<OceanVariable, readonly (QualityFlag | null)[]>>;
  readonly unitByVariable: Partial<Record<OceanVariable, string>>;

  /** Real source identity. Present for real data, null for fixtures. */
  readonly identity: PlatformIdentity | null;
  readonly provenance: DataSourceDescriptor;
}

/** Real platform identity as recorded by the source archive. */
export interface PlatformIdentity {
  /** WMO number, e.g. "1902594". */
  readonly wmo: string;
  /** Argo data assembly centre code, e.g. "IN" for INCOIS. */
  readonly dataCentre: string;
  readonly cycleNumber: number;
  /** Argo DATA_MODE: R real-time, A adjusted, D delayed-mode. */
  readonly dataMode: 'R' | 'A' | 'D' | null;
  readonly projectName: string | null;
  readonly principalInvestigator: string | null;
  readonly positioningSystem: string | null;
  /** WMO instrument type code. */
  readonly instrumentType: string | null;
  readonly positionQc: QualityFlag | null;
}

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

export interface CollocationResult {
  readonly observationId: string;
  readonly variable: OceanVariable;
  readonly modelSource: string;
  readonly modelTimestamp: string;
  readonly horizontalDistanceKm: number;
  readonly timeOffsetHours: number;
  readonly rmse: number;
  readonly meanBias: number;
  /** Depth axis the comparison was evaluated on. */
  readonly depthsM: readonly number[];
  /** Observed values on that axis, QC-filtered. */
  readonly observedValues: readonly (number | null)[];
  /** Model values interpolated to that axis. */
  readonly modeledValues: readonly (number | null)[];
  /** Number of levels that contributed to rmse/meanBias. */
  readonly sampleCount: number;
  readonly bands: readonly DepthBandAgreement[];
  /** Deterministic plain-language reading of the comparison. */
  readonly interpretation: string;
  /** Unit for rmse/meanBias/observedValues/modeledValues, e.g. "°C".
   * Optional: not every adapter populates it — see CachedRealDataAdapter and
   * FixtureDataAdapter, which predate this field. ApiOceanDataAdapter (the
   * default) always sets it from the backend's own response. */
  readonly unit?: string;
  /** ISO 8601 UTC — the observation's own time. Duplicates
   * ObservationProfile.observedAt but kept here so a CollocationResult is
   * self-contained for display without a second lookup. */
  readonly observationTimestamp?: string;
  /** Human label for the observation source, e.g. "Argo GDAC". */
  readonly observationSource?: string;
  /** Full provenance descriptor for the comparison's source data (real
   * dataset name, retrieval date, QC convention, caveats). */
  readonly source?: DataSourceDescriptor;
}

export interface DepthBandAgreement {
  readonly fromM: number;
  readonly toM: number;
  readonly meanDelta: number;
  readonly rmse: number;
  readonly verdict: 'High' | 'Fair' | 'Moderate' | 'Low';
  readonly sampleCount: number;
}

/* ------------------------------------------------------------------ *
 * Dataset-level metadata
 * ------------------------------------------------------------------ */

export interface DatasetMetadata {
  readonly title: string;
  /** The window the cached data actually covers. Drives all UI date copy. */
  readonly demonstrationWindow: { readonly start: string; readonly end: string };
  /** Label describing what kind of window this is. Never implies live data. */
  readonly windowLabel: string;
  readonly region: GeoBounds;
  readonly regionName: string;
  readonly sources: readonly DataSourceDescriptor[];
  /** Demo view identifier. Always a DEMO- prefixed value. */
  readonly viewId: string;
  readonly generatedAt: string;
}
