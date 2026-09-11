/* The default production adapter: calls the FastAPI backend and translates
 * its responses into the existing frontend domain types.
 *
 * The frontend no longer parses NetCDF, converts pressure to depth, maps QC,
 * interpolates, collocates, or computes RMSE/bias — the backend does all of
 * that from the real cached arrays. This adapter's only job is HTTP + shape
 * translation, including the one deliberate vocabulary translation: the
 * API's own provenance status names (ApiDataStatus) to the frontend's
 * existing DataStatus (see docs/data-contract.md for the full mapping and
 * the reasoning — renaming either vocabulary to match the other was
 * rejected in favour of one explicit translation at this boundary). */

import type { OceanVariable } from '@/domain/variables';
import { ALL_LAYER_IDS, type EvidenceLayer, type LayerId, type LayerKind, type LayerRegistry } from '@/domain/layers';
import type { PlatformType } from '@/domain/platforms';
import type { QualityFlag } from '@/domain/quality';
import type { DataStatus, DataSourceDescriptor } from '@/domain/provenance';
import { unavailable } from '@/domain/provenance';
import type {
  CollocationResult,
  DatasetMetadata,
  DepthBandAgreement,
  ModelColumn,
  ObservationProfile,
  PlatformIdentity,
  VolumeSlice,
} from '@/domain/types';
import { apiGet, ApiResponseError } from './api/client';
import type {
  ApiCollocationResponse,
  ApiDataStatus,
  ApiDatasetMetadata,
  ApiLayerProvenance,
  ApiObservationsListResponse,
  ApiPlatformIdentity,
  ApiProfileResponse,
  ApiProvenanceResponse,
  ApiSliceResponse,
  ApiSourceDescriptor,
} from './api/types';
import type {
  ColumnQuery,
  CollocationQuery,
  ObservationQuery,
  OceanDataAdapter,
  SliceQuery,
} from './adapter';

/* -------------------------------------------------------------------- *
 * Vocabulary translation — the one place API status becomes frontend status
 * -------------------------------------------------------------------- */

const API_STATUS_TO_FRONTEND: Readonly<Record<ApiDataStatus, DataStatus>> = {
  REAL_SOURCE_LOCALLY_CACHED: 'REAL_CACHED',
  PRECOMPUTED_FROM_REAL_SOURCE: 'PRECOMPUTED_FROM_REAL',
  DERIVED_FROM_REAL_SOURCE: 'DERIVED_FROM_REAL',
  SYNTHETIC_TEST_FIXTURE: 'SYNTHETIC_FIXTURE',
  NOT_AVAILABLE_MVP: 'NOT_AVAILABLE_MVP',
  PLANNED_EXTENSION: 'PLANNED_EXTENSION',
};

export function mapApiStatus(status: ApiDataStatus): DataStatus {
  return API_STATUS_TO_FRONTEND[status];
}

function toDescriptor(id: string, src: ApiSourceDescriptor): DataSourceDescriptor {
  return {
    id,
    datasetName: src.name,
    originator: src.originator ?? '—',
    status: mapApiStatus(src.status),
    sourceUrl: src.url,
    sourceFiles: src.source_files,
    retrievedAt: src.retrieved_at,
    checksums: src.checksum ? { [src.name]: src.checksum } : {},
    sourceVariables: src.variables,
    sourceUnits: src.units,
    coordinateSystem: src.coordinate_system ?? '—',
    temporal:
      src.temporal_start && src.temporal_end
        ? { start: src.temporal_start, end: src.temporal_end, cadence: src.temporal_cadence ?? '—' }
        : null,
    depth:
      src.depth_min_m != null && src.depth_max_m != null
        ? { minM: src.depth_min_m, maxM: src.depth_max_m, levels: '—' }
        : null,
    spatial: src.spatial_bounds
      ? {
          minLat: src.spatial_bounds['minLat'] ?? Number.NaN,
          maxLat: src.spatial_bounds['maxLat'] ?? Number.NaN,
          minLon: src.spatial_bounds['minLon'] ?? Number.NaN,
          maxLon: src.spatial_bounds['maxLon'] ?? Number.NaN,
          resolution: '—',
        }
      : null,
    qcConvention: src.qc_convention,
    transformations: src.transformations,
    licence: src.licence,
    caveats: src.caveats,
  };
}

function toIdentity(id: ApiPlatformIdentity): PlatformIdentity {
  return {
    wmo: id.wmo,
    dataCentre: id.data_centre,
    cycleNumber: id.cycle_number,
    dataMode: (id.data_mode as PlatformIdentity['dataMode']) ?? null,
    projectName: id.project_name,
    principalInvestigator: id.principal_investigator,
    positioningSystem: id.positioning_system,
    instrumentType: id.instrument_type,
    positionQc: id.position_qc as QualityFlag | null,
  };
}

function toBand(b: ApiCollocationResponse['bands'][number]): DepthBandAgreement {
  return {
    fromM: b.from_m,
    toM: b.to_m,
    meanDelta: b.mean_delta ?? Number.NaN,
    rmse: b.rmse ?? Number.NaN,
    verdict: b.verdict as DepthBandAgreement['verdict'],
    sampleCount: b.sample_count,
  };
}

export class ApiOceanDataAdapter implements OceanDataAdapter {
  /* -------------------------------------------------------------- */

  async getMetadata(): Promise<DatasetMetadata> {
    const [meta, provenance] = await Promise.all([
      apiGet<ApiDatasetMetadata>('/api/v1/metadata'),
      apiGet<ApiProvenanceResponse>('/api/v1/provenance'),
    ]);

    const sources = new Map<string, DataSourceDescriptor>();
    for (const layer of provenance.layers) {
      sources.set(layer.source.name, toDescriptor(layer.layer_id, layer.source));
    }

    return {
      title: meta.title,
      demonstrationWindow: {
        start: (meta.variables[0]?.source.temporal_start ?? meta.timestamps[0]) as string,
        end: (meta.variables[0]?.source.temporal_end ?? meta.timestamps.at(-1)) as string,
      },
      windowLabel: meta.window_label,
      region: {
        minLat: meta.region['minLat'] ?? Number.NaN,
        maxLat: meta.region['maxLat'] ?? Number.NaN,
        minLon: meta.region['minLon'] ?? Number.NaN,
        maxLon: meta.region['maxLon'] ?? Number.NaN,
      },
      regionName: meta.region_name,
      sources: [...sources.values()],
      viewId: meta.view_id,
      generatedAt: provenance.generated_at,
    };
  }

  async getLayerRegistry(): Promise<LayerRegistry> {
    const provenance = await apiGet<ApiProvenanceResponse>('/api/v1/provenance');
    const byId = new Map(provenance.layers.map((l) => [l.layer_id, l]));

    const reg = {} as Record<LayerId, EvidenceLayer>;
    for (const id of ALL_LAYER_IDS) {
      const api: ApiLayerProvenance | undefined = byId.get(id);
      if (!api) {
        reg[id] = {
          id,
          kind: 'GEOGRAPHIC_CONTEXT',
          label: id,
          description: 'Not reported by the backend provenance endpoint.',
          variable: null,
          platformType: null,
          collocatable: false,
          source: unavailable(id, id, 'NOT_AVAILABLE_MVP', ['Missing from /api/v1/provenance response.']),
        };
        continue;
      }
      reg[id] = {
        id,
        kind: api.kind as LayerKind,
        label: api.label,
        description: api.source.notes ?? api.label,
        variable: (api.variable as OceanVariable | null) ?? null,
        platformType: (api.platform_type as PlatformType | null) ?? null,
        collocatable: api.collocatable,
        source: toDescriptor(id, api.source),
      };
    }
    return reg as LayerRegistry;
  }

  async getAvailableTimes(variable: OceanVariable): Promise<readonly string[]> {
    const res = await apiGet<{ available: boolean; timestamps: readonly string[] }>(
      '/api/v1/times',
      { variable },
    );
    return res.available ? res.timestamps : [];
  }

  async getAvailableDepths(_variable: OceanVariable): Promise<readonly number[]> {
    const meta = await apiGet<ApiDatasetMetadata>('/api/v1/metadata');
    return meta.depths_m;
  }

  /* -------------------------------------------------------------- */

  async getVolumeSlice(q: SliceQuery): Promise<VolumeSlice> {
    const res = await apiGet<ApiSliceResponse>('/api/v1/slice', {
      variable: q.variable,
      timestamp: q.timestamp,
      depth_m: q.depthM,
    });
    const ny = res.values.length;
    const nx = res.values[0]?.length ?? 0;
    const values = new Float32Array(nx * ny);
    const valid = new Uint8Array(nx * ny);
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < ny; y++) {
      const row = res.values[y]!;
      for (let x = 0; x < nx; x++) {
        const v = row[x];
        const i = y * nx + x;
        if (v == null) {
          values[i] = Number.NaN;
        } else {
          values[i] = v;
          valid[i] = 1;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return {
      gridId: 'api',
      variable: q.variable,
      timestamp: res.actual_timestamp,
      depthM: res.actual_depth_m,
      nx,
      ny,
      bounds: {
        minLat: res.latitudes[0] ?? Number.NaN,
        maxLat: res.latitudes.at(-1) ?? Number.NaN,
        minLon: res.longitudes[0] ?? Number.NaN,
        maxLon: res.longitudes.at(-1) ?? Number.NaN,
      },
      values,
      valid,
      range: Number.isFinite(min) ? [min, max] : [0, 1],
    };
  }

  async getModelColumn(q: ColumnQuery): Promise<ModelColumn> {
    const res = await apiGet<{
      actual_timestamp: string;
      depths_m: readonly number[];
      values: readonly (number | null)[];
    }>('/api/v1/model-column', {
      variable: q.variable,
      timestamp: q.timestamp,
      latitude: q.latitude,
      longitude: q.longitude,
    });
    return {
      gridId: 'api',
      variable: q.variable,
      timestamp: res.actual_timestamp,
      at: { latitude: q.latitude, longitude: q.longitude },
      depthsM: res.depths_m,
      values: res.values,
    };
  }

  /* -------------------------------------------------------------- */

  /**
   * Returns lightweight profiles from the list endpoint — id, position, time,
   * QC, identity — WITHOUT depth/value arrays (the list endpoint doesn't
   * carry them, to keep a many-observation query cheap). Call
   * `getObservation(id)` for the full depth-resolved profile once a specific
   * observation is selected. This mirrors how the product actually uses the
   * two calls: a list for markers, a detail fetch on selection.
   */
  async getObservations(q: ObservationQuery): Promise<readonly ObservationProfile[]> {
    const res = await apiGet<ApiObservationsListResponse>('/api/v1/observations', {
      platform_type: q.platformTypes,
      dac: q.dataCentres,
      from_time: q.from,
      to_time: q.to,
      min_lat: q.bounds?.minLat,
      max_lat: q.bounds?.maxLat,
      min_lon: q.bounds?.minLon,
      max_lon: q.bounds?.maxLon,
      collocated_only: q.collocatedOnly,
    });
    const argoSource = toDescriptor('argo.incois', res.source);
    return res.observations.map((o) => ({
      id: o.id,
      platformType: o.platform_type as PlatformType,
      platformName: o.platform_name,
      latitude: o.latitude,
      longitude: o.longitude,
      observedAt: o.observed_at,
      qc: o.qc as QualityFlag,
      depthsM: [],
      variables: {},
      qcByVariable: {},
      unitByVariable: {},
      identity: toIdentity(o.identity),
      provenance: argoSource,
    }));
  }

  /** Full depth-resolved profile (temperature + salinity) for one observation. */
  async getObservation(id: string): Promise<ObservationProfile | null> {
    let summary: { platform_type: string; platform_name: string; latitude: number; longitude: number; observed_at: string; qc: string; identity: ApiPlatformIdentity };
    try {
      summary = await apiGet(`/api/v1/observations/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }

    const [temp, sal] = await Promise.all([
      apiGet<ApiProfileResponse>(`/api/v1/profile/${encodeURIComponent(id)}`, {
        variable: 'temperature',
      }),
      apiGet<ApiProfileResponse>(`/api/v1/profile/${encodeURIComponent(id)}`, {
        variable: 'salinity',
      }),
    ]);

    // Both profile calls return the same depth axis (the observation's own);
    // use temperature's as canonical.
    const depthsM = temp.levels.map((l) => l.depth_m);

    return {
      id,
      platformType: summary.platform_type as PlatformType,
      platformName: summary.platform_name,
      latitude: summary.latitude,
      longitude: summary.longitude,
      observedAt: summary.observed_at,
      qc: summary.qc as QualityFlag,
      depthsM,
      variables: {
        temperature: temp.levels.map((l) => l.value),
        salinity: sal.levels.map((l) => l.value),
      },
      qcByVariable: {
        temperature: temp.levels.map((l) => l.qc as QualityFlag | null),
        salinity: sal.levels.map((l) => l.qc as QualityFlag | null),
      },
      unitByVariable: { temperature: temp.unit, salinity: sal.unit },
      identity: toIdentity(summary.identity),
      provenance: toDescriptor('argo.incois', temp.source),
    };
  }

  /* -------------------------------------------------------------- */

  async getCollocation(q: CollocationQuery): Promise<CollocationResult | null> {
    let res: ApiCollocationResponse;
    try {
      res = await apiGet<ApiCollocationResponse>(
        `/api/v1/collocation/${encodeURIComponent(q.observationId)}`,
        { variable: q.variable, timestamp: q.timestamp },
      );
    } catch (e) {
      // A 404 here is a real, honest answer — the backend's
      // ObservationNotFoundError/NoModelColumnError both surface as 404 —
      // meaning "no collocation exists for this id", not a failure. Any
      // other error (backend unreachable, 5xx, an unexpected status) is a
      // genuine failure and must propagate so the caller can show a real
      // error state rather than silently rendering "no collocation".
      if (e instanceof ApiResponseError && e.status === 404) return null;
      throw e;
    }

    return {
      observationId: res.observation_id,
      variable: q.variable,
      modelSource: res.model_source,
      modelTimestamp: res.model_timestamp,
      horizontalDistanceKm: res.horizontal_distance_km,
      timeOffsetHours: res.time_offset_hours,
      rmse: res.rmse ?? Number.NaN,
      meanBias: res.mean_bias ?? Number.NaN,
      depthsM: res.depths_m,
      observedValues: res.observed_values,
      modeledValues: res.modeled_values,
      sampleCount: res.sample_count,
      bands: res.bands.map(toBand),
      interpretation: res.interpretation,
      unit: res.unit,
      observationTimestamp: res.observation_timestamp,
      observationSource: res.observation_source,
      source: toDescriptor('collocation', res.source),
    };
  }
}
