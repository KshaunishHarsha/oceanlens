/* Wire types for the FastAPI backend — snake_case, matching the Pydantic
 * response models in backend/app/models/ exactly. Nothing here is renamed to
 * match the frontend's domain types; ApiOceanDataAdapter.ts does that
 * translation at the boundary. See docs/data-contract.md. */

/** The backend's own provenance vocabulary. Deliberately distinct from the
 * frontend's DataStatus (src/domain/provenance.ts) — see ApiOceanDataAdapter. */
export type ApiDataStatus =
  | 'REAL_SOURCE_LOCALLY_CACHED'
  | 'PRECOMPUTED_FROM_REAL_SOURCE'
  | 'DERIVED_FROM_REAL_SOURCE'
  | 'SYNTHETIC_TEST_FIXTURE'
  | 'NOT_AVAILABLE_MVP'
  | 'PLANNED_EXTENSION';

export interface ApiSourceDescriptor {
  readonly name: string;
  readonly status: ApiDataStatus;
  readonly url: string | null;
  readonly retrieved_at: string | null;
  readonly checksum: string | null;
  readonly notes: string | null;
  readonly originator: string | null;
  readonly source_files: readonly string[];
  readonly variables: readonly string[];
  readonly units: Readonly<Record<string, string>>;
  readonly coordinate_system: string | null;
  readonly temporal_start: string | null;
  readonly temporal_end: string | null;
  readonly temporal_cadence: string | null;
  readonly depth_min_m: number | null;
  readonly depth_max_m: number | null;
  readonly spatial_bounds: Readonly<Record<string, number>> | null;
  readonly qc_convention: string | null;
  readonly transformations: readonly string[];
  readonly licence: string | null;
  readonly caveats: readonly string[];
}

export interface ApiLayerProvenance {
  readonly layer_id: string;
  readonly label: string;
  readonly kind: string;
  readonly variable: string | null;
  readonly platform_type: string | null;
  readonly collocatable: boolean;
  readonly source: ApiSourceDescriptor;
}

export interface ApiProvenanceResponse {
  readonly layers: readonly ApiLayerProvenance[];
  readonly generated_at: string;
  readonly cache_id: string;
}

export interface ApiHealthResponse {
  readonly status: string;
  readonly service: string;
  readonly cache_loaded: boolean;
  readonly cache_id: string | null;
}

export interface ApiVariableMetadata {
  readonly key: string;
  readonly standard_name: string | null;
  readonly unit: string;
  readonly available: boolean;
  readonly source: ApiSourceDescriptor;
}

export interface ApiPlatformMetadata {
  readonly key: string;
  readonly label: string;
  readonly available: boolean;
  readonly count: number;
}

export interface ApiDatasetMetadata {
  readonly dataset_id: string;
  readonly title: string;
  readonly region: Readonly<Record<string, number>>;
  readonly region_name: string;
  readonly timestamps: readonly string[];
  readonly depths_m: readonly number[];
  readonly variables: readonly ApiVariableMetadata[];
  readonly platforms: readonly ApiPlatformMetadata[];
  readonly observation_count: number;
  readonly historical_window: boolean;
  readonly window_label: string;
  readonly view_id: string;
  readonly source: ApiSourceDescriptor;
}

export interface ApiTimesResponse {
  readonly variable: string;
  readonly available: boolean;
  readonly timestamps: readonly string[];
  readonly reason: string | null;
}

export interface ApiPlatformIdentity {
  readonly wmo: string;
  readonly data_centre: string;
  readonly cycle_number: number;
  readonly data_mode: string | null;
  readonly project_name: string | null;
  readonly principal_investigator: string | null;
  readonly positioning_system: string | null;
  readonly instrument_type: string | null;
  readonly position_qc: string | null;
  readonly profile_temperature_qc_letter: string | null;
  readonly profile_salinity_qc_letter: string | null;
  readonly used_adjusted_fields: boolean;
}

export interface ApiObservationSummary {
  readonly id: string;
  readonly platform_type: string;
  readonly platform_name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observed_at: string;
  readonly qc: string;
  readonly level_count: number;
  readonly identity: ApiPlatformIdentity;
}

export interface ApiObservationsListResponse {
  readonly observations: readonly ApiObservationSummary[];
  readonly total: number;
  readonly filters_applied: Readonly<Record<string, unknown>>;
  readonly source: ApiSourceDescriptor;
}

export interface ApiObservationLevel {
  readonly depth_m: number;
  readonly value: number | null;
  readonly qc: string | null;
}

export interface ApiProfileResponse {
  readonly observation_id: string;
  readonly variable: string;
  readonly unit: string;
  readonly platform_type: string;
  readonly platform_name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observed_at: string;
  readonly qc: string;
  readonly levels: readonly ApiObservationLevel[];
  readonly identity: ApiPlatformIdentity;
  readonly source: ApiSourceDescriptor;
}

export interface ApiSliceResponse {
  readonly variable: string;
  readonly unit: string;
  readonly requested_timestamp: string;
  readonly actual_timestamp: string;
  readonly requested_depth_m: number;
  readonly actual_depth_m: number;
  readonly latitudes: readonly number[];
  readonly longitudes: readonly number[];
  readonly values: readonly (readonly (number | null)[])[]; // [lat][lon]
  readonly resolution: Readonly<Record<string, number>>;
  readonly decimation: Readonly<Record<string, number>> | null;
  readonly source: ApiSourceDescriptor;
}

export interface ApiModelColumnResponse {
  readonly variable: string;
  readonly unit: string;
  readonly requested_timestamp: string;
  readonly actual_timestamp: string;
  readonly requested_latitude: number;
  readonly requested_longitude: number;
  readonly grid_latitude: number;
  readonly grid_longitude: number;
  readonly depths_m: readonly number[];
  readonly values: readonly (number | null)[];
  readonly source: ApiSourceDescriptor;
}

export interface ApiBandAgreement {
  readonly from_m: number;
  readonly to_m: number;
  readonly mean_delta: number | null;
  readonly rmse: number | null;
  readonly sample_count: number;
  readonly verdict: string;
}

export interface ApiCollocationResponse {
  readonly observation_id: string;
  readonly variable: string;
  readonly unit: string;
  readonly model_source: string;
  readonly observation_source: string;
  readonly model_timestamp: string;
  readonly observation_timestamp: string;
  readonly horizontal_distance_km: number;
  readonly time_offset_hours: number;
  readonly rmse: number | null;
  readonly mean_bias: number | null;
  readonly depths_m: readonly number[];
  readonly observed_values: readonly number[];
  readonly modeled_values: readonly number[];
  readonly sample_count: number;
  readonly bands: readonly ApiBandAgreement[];
  readonly interpretation: string;
  readonly source: ApiSourceDescriptor;
}
