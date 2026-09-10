/* Evidence layers.
 *
 * Not every layer is a depth-resolved field that can be collocated against an
 * Argo profile. Satellite SST is a surface raster. An advisory is a document.
 * An ML anomaly field is a derived product with its own error characteristics.
 *
 * Forcing them all through one workflow would misrepresent them, so each layer
 * declares its `kind`, and the UI decides what it can meaningfully do with it.
 *
 * Availability is NOT decided here. Every layer is registered; its
 * DataSourceDescriptor says whether Phase 2 found real data for it. */

import type { OceanVariable } from './variables';
import type { PlatformType } from './platforms';
import type { DataSourceDescriptor } from './provenance';

export type LayerKind =
  /** Depth-resolved gridded field. Sliceable, collocatable. */
  | 'MODEL_VOLUME'
  /** Depth-resolved point profiles from instruments. */
  | 'OBSERVATION_PROFILE'
  /** Surface-only gridded raster, e.g. satellite SST or ocean colour. */
  | 'SURFACE_RASTER'
  /** Vector field, e.g. model u/v currents. */
  | 'VECTOR_FIELD'
  /** Contour traced from another layer at runtime. */
  | 'DERIVED_CONTOUR'
  /** Static geographic context, e.g. coastline, bathymetry, EEZ. */
  | 'GEOGRAPHIC_CONTEXT'
  /** Structured advisory or alert records. */
  | 'ADVISORY'
  /** Model output from a learned model. Always flagged as such. */
  | 'ML_DERIVED';

export type LayerId =
  | 'model.temperature'
  | 'model.salinity'
  | 'model.currents'
  | 'obs.argo'
  | 'obs.bgc'
  | 'obs.glider'
  | 'obs.ctd'
  | 'satellite.sst'
  | 'satellite.chlorophyll'
  | 'derived.isosurface'
  | 'context.coastline'
  | 'context.bathymetry'
  | 'advisory.incois'
  | 'ml.anomaly';

export interface EvidenceLayer {
  readonly id: LayerId;
  readonly kind: LayerKind;
  /** Control-rail label. */
  readonly label: string;
  /** One line explaining what the layer shows. Used in tooltips. */
  readonly description: string;
  /** The depth-resolved variable this layer carries, if it carries one. */
  readonly variable: OceanVariable | null;
  /** The platform class this layer represents, if it is an observation layer. */
  readonly platformType: PlatformType | null;
  /** Whether this layer can participate in model/observation collocation. */
  readonly collocatable: boolean;
  /** Provenance and availability. Populated by the Phase 2 data build. */
  readonly source: DataSourceDescriptor;
}

/**
 * The registry shape. Phase 2 produces the concrete instance by writing a
 * manifest; nothing in the UI hard-codes which layers exist or are available.
 */
export type LayerRegistry = Readonly<Record<LayerId, EvidenceLayer>>;

export const ALL_LAYER_IDS: readonly LayerId[] = [
  'model.temperature',
  'model.salinity',
  'model.currents',
  'obs.argo',
  'obs.bgc',
  'obs.glider',
  'obs.ctd',
  'satellite.sst',
  'satellite.chlorophyll',
  'derived.isosurface',
  'context.coastline',
  'context.bathymetry',
  'advisory.incois',
  'ml.anomaly',
];

/** Layers the user can toggle in the scene, in control-rail order. */
export const SCENE_LAYER_ORDER: readonly LayerId[] = [
  'model.temperature',
  'model.salinity',
  'derived.isosurface',
  'model.currents',
  'obs.argo',
  'obs.bgc',
  'obs.glider',
  'obs.ctd',
  'satellite.sst',
  'context.bathymetry',
];

export function renderableLayers(reg: LayerRegistry): EvidenceLayer[] {
  return ALL_LAYER_IDS.map((id) => reg[id]).filter(
    (l) => l.source.status === 'REAL_CACHED' ||
           l.source.status === 'PRECOMPUTED_FROM_REAL' ||
           l.source.status === 'DERIVED_FROM_REAL' ||
           l.source.status === 'SYNTHETIC_FIXTURE',
  );
}

export function unavailableLayers(reg: LayerRegistry): EvidenceLayer[] {
  return ALL_LAYER_IDS.map((id) => reg[id]).filter(
    (l) => l.source.status === 'NOT_AVAILABLE_MVP' ||
           l.source.status === 'PLANNED_EXTENSION',
  );
}
