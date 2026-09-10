/* Provenance and data honesty.
 *
 * This module is the reason the product can be shown to a scientific audience.
 * Every layer the UI can render must carry a DataSourceDescriptor, and the UI
 * renders its availability and status *from that descriptor* — never from a
 * hard-coded assumption about what we think we shipped.
 *
 * Consequence: adding a real source later is a data change, not a refactor.
 * And a layer with no real source cannot accidentally be rendered as though
 * it had one. */

/** How a layer's data came to exist. Exactly one applies. */
export type DataStatus =
  /** Downloaded from a real public source and cached in-repo. */
  | 'REAL_CACHED'
  /** Computed offline from real source data (e.g. a regridded subset). */
  | 'PRECOMPUTED_FROM_REAL'
  /** Computed at runtime from real source data (e.g. an isosurface). */
  | 'DERIVED_FROM_REAL'
  /** Deterministic fixture. Renderer or unit-test use only. Never scientific. */
  | 'SYNTHETIC_FIXTURE'
  /** Investigated, no usable real source found in time. Shown as unavailable. */
  | 'NOT_AVAILABLE_MVP'
  /** Real source exists and is understood, but out of scope for this build. */
  | 'PLANNED_EXTENSION';

export interface DataStatusDescriptor {
  readonly status: DataStatus;
  /** Exact string shown in the UI. These are the approved wordings. */
  readonly label: string;
  /** Whether this layer may be rendered as active data. */
  readonly renderable: boolean;
  /** Whether the layer's control should be interactive. */
  readonly interactive: boolean;
  readonly colorVar: string;
}

export const DATA_STATUS: Readonly<Record<DataStatus, DataStatusDescriptor>> = {
  REAL_CACHED: {
    status: 'REAL_CACHED',
    label: 'Real source, locally cached',
    renderable: true,
    interactive: true,
    colorVar: '--good',
  },
  PRECOMPUTED_FROM_REAL: {
    status: 'PRECOMPUTED_FROM_REAL',
    label: 'Precomputed from real source',
    renderable: true,
    interactive: true,
    colorVar: '--good',
  },
  DERIVED_FROM_REAL: {
    status: 'DERIVED_FROM_REAL',
    label: 'Derived from real source',
    renderable: true,
    interactive: true,
    colorVar: '--cyan',
  },
  SYNTHETIC_FIXTURE: {
    status: 'SYNTHETIC_FIXTURE',
    label: 'Synthetic test fixture',
    renderable: true,
    interactive: true,
    colorVar: '--warn',
  },
  NOT_AVAILABLE_MVP: {
    status: 'NOT_AVAILABLE_MVP',
    label: 'Not available in MVP',
    renderable: false,
    interactive: false,
    colorVar: '--text-disabled',
  },
  PLANNED_EXTENSION: {
    status: 'PLANNED_EXTENSION',
    label: 'Planned extension',
    renderable: false,
    interactive: false,
    colorVar: '--text-disabled',
  },
};

/**
 * Phrases that must never be rendered against data that is not actually
 * official, live, or externally verified. Enforced by a unit test that scans
 * the source tree, so a future edit cannot quietly reintroduce them.
 */
export const FORBIDDEN_CLAIMS: readonly string[] = [
  'Verified source',
  'Official observation',
  'Live operational data',
  'INCOIS real-time',
  'Processing status: verified',
];

/** Approved replacement for the artboard's fabricated processing status. */
export const PROCESSING_STATUS_LABEL = 'Processing status: locally validated';

export interface TemporalCoverage {
  /** ISO 8601 UTC. */
  readonly start: string;
  readonly end: string;
  /** Human description of cadence, e.g. "3-hourly", "per float cycle". */
  readonly cadence: string;
}

export interface DepthCoverage {
  readonly minM: number;
  readonly maxM: number;
  /** Number of levels, or a description for irregular sampling. */
  readonly levels: number | string;
}

export interface SpatialCoverage {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
  /** e.g. "1/12 degree", "irregular (float positions)". */
  readonly resolution: string;
}

/**
 * The complete provenance record for one data layer.
 * Everything the Phase 2 brief requires us to preserve lives here.
 */
export interface DataSourceDescriptor {
  readonly id: string;
  /** Human dataset name, e.g. "Argo global profiles (INCOIS DAC)". */
  readonly datasetName: string;
  /** Institution or programme that produced it. */
  readonly originator: string;
  readonly status: DataStatus;

  /** Canonical URL the data came from. Null only for synthetic fixtures. */
  readonly sourceUrl: string | null;
  /** Original filenames retrieved, before any normalisation. */
  readonly sourceFiles: readonly string[];
  /** ISO 8601 UTC timestamp of retrieval. Null for synthetic fixtures. */
  readonly retrievedAt: string | null;
  /** SHA-256 of each retrieved file, keyed by filename. */
  readonly checksums: Readonly<Record<string, string>>;

  /** Source variable names as they appear in the file, e.g. ["TEMP", "PSAL"]. */
  readonly sourceVariables: readonly string[];
  /** Units as declared by the source, keyed by source variable name. */
  readonly sourceUnits: Readonly<Record<string, string>>;
  /** e.g. "WGS84 lat/lon, depth positive down from mean sea surface". */
  readonly coordinateSystem: string;

  readonly temporal: TemporalCoverage | null;
  readonly depth: DepthCoverage | null;
  readonly spatial: SpatialCoverage | null;

  /** What the source's QC values mean, in the source's own terms. */
  readonly qcConvention: string | null;
  /** Every transformation applied, in order. Subsetting counts. */
  readonly transformations: readonly string[];
  /** Licence or usage terms, and any attribution the source requires. */
  readonly licence: string | null;
  /** Free-text caveats a scientist should know before trusting this layer. */
  readonly caveats: readonly string[];
}

/** A descriptor for a layer we investigated but could not source. */
export function unavailable(
  id: string,
  datasetName: string,
  status: Extract<DataStatus, 'NOT_AVAILABLE_MVP' | 'PLANNED_EXTENSION'>,
  caveats: readonly string[],
): DataSourceDescriptor {
  return {
    id,
    datasetName,
    originator: '—',
    status,
    sourceUrl: null,
    sourceFiles: [],
    retrievedAt: null,
    checksums: {},
    sourceVariables: [],
    sourceUnits: {},
    coordinateSystem: '—',
    temporal: null,
    depth: null,
    spatial: null,
    qcConvention: null,
    transformations: [],
    licence: null,
    caveats,
  };
}

export function isRenderable(d: DataSourceDescriptor): boolean {
  return DATA_STATUS[d.status].renderable;
}

export function statusLabel(d: DataSourceDescriptor): string {
  return DATA_STATUS[d.status].label;
}

/**
 * Demo identifiers. Deliberately unmistakable — no real DOI, no real INCOIS
 * operations reference, nothing that could be taken for an official record.
 */
export const DEMO_IDS = {
  view: 'DEMO-OCN-2026-001',
  provenance: 'DEMO-PROVENANCE',
  runPrefix: 'DEMO-RUN-',
} as const;
