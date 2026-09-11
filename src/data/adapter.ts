/* The data boundary.
 *
 * Everything the UI knows about ocean data arrives through this interface.
 * The Phase 2 implementation reads a locally cached extract of real data; a
 * future implementation could read NetCDF, ERDDAP, OPeNDAP or an OGC service
 * without the UI changing.
 *
 * All methods are async even when the MVP answers synchronously, so that a
 * networked adapter is a drop-in rather than a rewrite. */

import type { OceanVariable } from '@/domain/variables';
import type { PlatformType } from '@/domain/platforms';
import type { LayerRegistry } from '@/domain/layers';
import type {
  CollocationResult,
  DatasetMetadata,
  GeoBounds,
  ModelColumn,
  ObservationProfile,
  VolumeSlice,
} from '@/domain/types';

export interface SliceQuery {
  readonly variable: OceanVariable;
  readonly timestamp: string;
  readonly depthM: number;
  readonly bounds?: GeoBounds;
}

export interface ColumnQuery {
  readonly variable: OceanVariable;
  readonly timestamp: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface ObservationQuery {
  readonly bounds?: GeoBounds;
  readonly platformTypes?: readonly PlatformType[];
  /** Argo DATA_CENTRE codes, e.g. ["IN"] for INCOIS, ["HZ"] for China Argo. */
  readonly dataCentres?: readonly string[];
  /** ISO 8601 UTC window. */
  readonly from?: string;
  readonly to?: string;
  /** Drop levels whose QC does not pass the good-only filter. */
  readonly goodQualityOnly?: boolean;
  /** Only profiles with a model collocation within this distance. */
  readonly maxCollocationKm?: number;
  /** Only profiles that have a model collocation at all (any distance) —
   * maps onto the backend's existing `?collocated_only=` query param. */
  readonly collocatedOnly?: boolean;
}

export interface CollocationQuery {
  readonly observationId: string;
  readonly variable: OceanVariable;
  /** Model timestamp to compare against. Defaults to nearest in time. */
  readonly timestamp?: string;
}

export interface OceanDataAdapter {
  /** Dataset identity, demonstration window, and every source descriptor. */
  getMetadata(): Promise<DatasetMetadata>;

  /** What layers exist and what their real availability is. */
  getLayerRegistry(): Promise<LayerRegistry>;

  /** Timestamps available for a variable, ascending ISO 8601 UTC. */
  getAvailableTimes(variable: OceanVariable): Promise<readonly string[]>;

  /** Depth levels available for a variable, ascending metres. */
  getAvailableDepths(variable: OceanVariable): Promise<readonly number[]>;

  /** A horizontal slice of the model volume. */
  getVolumeSlice(query: SliceQuery): Promise<VolumeSlice>;

  /** A single model column, for comparison against an observation. */
  getModelColumn(query: ColumnQuery): Promise<ModelColumn>;

  /** Observation profiles matching the query. */
  getObservations(query: ObservationQuery): Promise<readonly ObservationProfile[]>;

  /** One observation by id. */
  getObservation(id: string): Promise<ObservationProfile | null>;

  /** Model-versus-observation comparison, computed from real arrays. */
  getCollocation(query: CollocationQuery): Promise<CollocationResult | null>;
}

/** Thrown by adapters that exist as architectural placeholders. */
export class NotImplementedError extends Error {
  constructor(adapter: string, method: string) {
    super(
      `${adapter}.${method}() is not implemented. ` +
        `This adapter is an architectural placeholder showing how OceanLens would ` +
        `ingest this source in production; the MVP uses the locally cached real-data adapter.`,
    );
    this.name = 'NotImplementedError';
  }
}
