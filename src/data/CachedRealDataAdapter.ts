/* The MVP data adapter. Reads the locally cached extract of real Argo and real
 * HYCOM data (public/data/real/) and answers every OceanDataAdapter query from
 * it. No network calls beyond the initial cache load; no synthetic values.
 *
 * Named for what it is: a cached *real*-data adapter, not a demo/mock. */

import type { OceanVariable } from '@/domain/variables';
import { VARIABLES } from '@/domain/variables';
import {
  ALL_LAYER_IDS,
  type EvidenceLayer,
  type LayerId,
  type LayerRegistry,
} from '@/domain/layers';
import {
  haversineKm,
  type CollocationResult,
  type DatasetMetadata,
  type DepthBandAgreement,
  type GeoBounds,
  type ModelColumn,
  type ObservationProfile,
  type VolumeSlice,
} from '@/domain/types';
import type { DataSourceDescriptor } from '@/domain/provenance';
import {
  buildScientificInterpretation,
  calculateBandAgreement,
  calculateMeanBias,
  calculateRMSE,
  calculateTimeOffsetHours,
  interpolateProfile,
  nearestIndex,
  pairFinite,
  type Level,
} from '@/domain/stats';
import type {
  CachedColumn,
  CachedModelVariable,
  CachedProfile,
  LoadedCache,
} from './cache/types';
import type {
  ColumnQuery,
  CollocationQuery,
  ObservationQuery,
  OceanDataAdapter,
  SliceQuery,
} from './adapter';

const MODEL_VAR: Record<OceanVariable, CachedModelVariable | 'derived'> = {
  temperature: 'temperature',
  salinity: 'salinity',
  currentSpeed: 'derived', // sqrt(u^2 + v^2)
  chlorophyll: 'derived', // not in cache
};

/** Depth-band definitions for the comparison tab, in metres. */
const BANDS = [
  { fromM: 0, toM: 50 },
  { fromM: 50, toM: 100 },
  { fromM: 100, toM: 150 },
  { fromM: 150, toM: 300 },
  { fromM: 300, toM: 1000 },
];

export class CachedRealDataAdapter implements OceanDataAdapter {
  private constructor(private readonly cache: LoadedCache) {}

  static async create(load: () => Promise<LoadedCache>): Promise<CachedRealDataAdapter> {
    return new CachedRealDataAdapter(await load());
  }

  /* ---------------------------------------------------------------- */

  async getMetadata(): Promise<DatasetMetadata> {
    const m = this.cache.manifest as {
      title: string;
      demonstrationWindow: { start: string; end: string };
      windowLabel: string;
      region: GeoBounds;
      regionName: string;
      viewId: string;
      generatedAt: string;
      sources: DataSourceDescriptor[];
    };
    return {
      title: m.title,
      demonstrationWindow: m.demonstrationWindow,
      windowLabel: m.windowLabel,
      region: m.region,
      regionName: m.regionName,
      sources: m.sources,
      viewId: m.viewId,
      generatedAt: m.generatedAt,
    };
  }

  async getLayerRegistry(): Promise<LayerRegistry> {
    const meta = await this.getMetadata();
    const src = (id: string): DataSourceDescriptor | undefined =>
      meta.sources.find((s) => s.id === id);

    const argo = src('argo.incois');
    const ts = src('hycom.ts');
    const uv = src('hycom.uv');

    const planned = (
      id: LayerId,
      name: string,
      why: string,
    ): DataSourceDescriptor => ({
      id,
      datasetName: name,
      originator: '—',
      status: 'PLANNED_EXTENSION',
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
      caveats: [why],
    });

    const notAvail = (
      id: LayerId,
      name: string,
      why: string,
    ): DataSourceDescriptor => ({
      ...planned(id, name, why),
      status: 'NOT_AVAILABLE_MVP',
    });

    const fallbackTs = ts ?? notAvail('model.temperature', 'HYCOM T/S', 'cache missing');

    const layer = (
      id: LayerId,
      partial: Omit<EvidenceLayer, 'id' | 'source'>,
      source: DataSourceDescriptor,
    ): EvidenceLayer => ({ id, ...partial, source });

    const reg = {
      'model.temperature': layer(
        'model.temperature',
        { kind: 'MODEL_VOLUME', label: 'Model temperature', description: 'HYCOM GOFS 3.1 sea-water temperature volume', variable: 'temperature', platformType: null, collocatable: true },
        fallbackTs,
      ),
      'model.salinity': layer(
        'model.salinity',
        { kind: 'MODEL_VOLUME', label: 'Model salinity', description: 'HYCOM GOFS 3.1 sea-water salinity volume', variable: 'salinity', platformType: null, collocatable: true },
        fallbackTs,
      ),
      'model.currents': layer(
        'model.currents',
        { kind: 'VECTOR_FIELD', label: 'Model currents', description: 'HYCOM GOFS 3.1 u/v current vectors', variable: 'currentSpeed', platformType: null, collocatable: true },
        uv ?? notAvail('model.currents', 'HYCOM u/v currents', 'uv3z subset not in cache'),
      ),
      'obs.argo': layer(
        'obs.argo',
        { kind: 'OBSERVATION_PROFILE', label: 'Argo profiles', description: 'Real Argo float profiles (INCOIS and partners)', variable: null, platformType: 'ARGO', collocatable: true },
        argo ?? notAvail('obs.argo', 'Argo profiles', 'cache missing'),
      ),
      'obs.bgc': layer(
        'obs.bgc',
        { kind: 'OBSERVATION_PROFILE', label: 'BGC floats', description: 'Biogeochemical Argo profiles', variable: null, platformType: 'BGC', collocatable: true },
        notAvail('obs.bgc', 'BGC-Argo profiles', 'No BGC float in the demo window and region carried usable T/S/BGC levels.'),
      ),
      'obs.glider': layer(
        'obs.glider',
        { kind: 'OBSERVATION_PROFILE', label: 'Gliders', description: 'Autonomous underwater glider sections', variable: null, platformType: 'GLIDER', collocatable: true },
        planned('obs.glider', 'Glider sections', 'No open real glider section identified for this region and window.'),
      ),
      'obs.ctd': layer(
        'obs.ctd',
        { kind: 'OBSERVATION_PROFILE', label: 'CTD casts', description: 'Shipborne CTD casts', variable: null, platformType: 'CTD', collocatable: true },
        planned('obs.ctd', 'CTD casts', 'No open real CTD cast identified for this region and window.'),
      ),
      'satellite.sst': layer(
        'satellite.sst',
        { kind: 'SURFACE_RASTER', label: 'Satellite SST', description: 'Satellite sea-surface temperature', variable: 'temperature', platformType: null, collocatable: false },
        planned('satellite.sst', 'Satellite SST', 'Real L4 SST is obtainable (e.g. GHRSST) but not yet prepared into the cache.'),
      ),
      'satellite.chlorophyll': layer(
        'satellite.chlorophyll',
        { kind: 'SURFACE_RASTER', label: 'Satellite chlorophyll', description: 'Ocean-colour chlorophyll-a', variable: 'chlorophyll', platformType: null, collocatable: false },
        planned('satellite.chlorophyll', 'Satellite chlorophyll-a', 'Real ocean-colour products exist but are not yet prepared into the cache.'),
      ),
      'derived.isosurface': layer(
        'derived.isosurface',
        { kind: 'DERIVED_CONTOUR', label: 'Isosurface', description: 'Contour traced from the model field at render time', variable: null, platformType: null, collocatable: false },
        {
          ...(ts ?? fallbackTs),
          id: 'derived.isosurface',
          datasetName: 'Isosurface derived from HYCOM temperature',
          status: ts ? 'DERIVED_FROM_REAL' : 'NOT_AVAILABLE_MVP',
          transformations: ['Marching-squares contour of the cached model field at the configured iso value, computed in the browser.'],
        },
      ),
      'context.coastline': layer(
        'context.coastline',
        { kind: 'GEOGRAPHIC_CONTEXT', label: 'Coastline', description: 'Natural Earth coastline', variable: null, platformType: null, collocatable: false },
        planned('context.coastline', 'Coastline (Natural Earth)', 'Vendored in Phase 4.'),
      ),
      'context.bathymetry': layer(
        'context.bathymetry',
        { kind: 'GEOGRAPHIC_CONTEXT', label: 'Bathymetry / EEZ', description: 'Generalised depth contours and EEZ line', variable: null, platformType: null, collocatable: false },
        planned('context.bathymetry', 'Bathymetry / EEZ', 'Derived generalisation added in Phase 4; not GEBCO.'),
      ),
      'advisory.incois': layer(
        'advisory.incois',
        { kind: 'ADVISORY', label: 'Advisories', description: 'Structured ocean-state advisories', variable: null, platformType: null, collocatable: false },
        planned('advisory.incois', 'INCOIS advisories', 'Stable public advisory feed not integrated in the MVP.'),
      ),
      'ml.anomaly': layer(
        'ml.anomaly',
        { kind: 'ML_DERIVED', label: 'ML anomaly', description: 'Learned anomaly field', variable: null, platformType: null, collocatable: false },
        planned('ml.anomaly', 'ML anomaly layer', 'No trained model; future extension only.'),
      ),
    } satisfies LayerRegistry;

    return reg;
  }

  async getAvailableTimes(_variable: OceanVariable): Promise<readonly string[]> {
    return this.cache.grid.timestamps;
  }

  async getAvailableDepths(_variable: OceanVariable): Promise<readonly number[]> {
    return this.cache.grid.depthsM;
  }

  /* ---------------------------------------------------------------- *
   * model volume
   * ---------------------------------------------------------------- */

  async getVolumeSlice(q: SliceQuery): Promise<VolumeSlice> {
    const { grid } = this.cache;
    const ti = Math.max(0, grid.timestamps.indexOf(q.timestamp));
    const zi = nearestIndex(grid.depthsM, q.depthM);
    const { nx, ny, nz } = grid.shape;

    const read = (v: CachedModelVariable): Float32Array | undefined => this.cache.slices[v];

    const out = new Float32Array(nx * ny);
    const valid = new Uint8Array(nx * ny);
    let min = Infinity;
    let max = -Infinity;

    const base = (ti * nz + zi) * ny * nx;
    const sliceAt = (arr: Float32Array, i: number) => arr[base + i]!;

    const modelVar = MODEL_VAR[q.variable];
    for (let i = 0; i < nx * ny; i++) {
      let value: number;
      if (modelVar === 'derived' && q.variable === 'currentSpeed') {
        const u = read('currentU');
        const v = read('currentV');
        if (!u || !v) {
          out[i] = Number.NaN;
          continue;
        }
        const uu = sliceAt(u, i);
        const vv = sliceAt(v, i);
        value = Math.sqrt(uu * uu + vv * vv);
      } else if (modelVar === 'derived') {
        out[i] = Number.NaN; // chlorophyll: not in cache
        continue;
      } else {
        const arr = read(modelVar);
        if (!arr) {
          out[i] = Number.NaN;
          continue;
        }
        value = sliceAt(arr, i);
      }
      if (Number.isFinite(value)) {
        out[i] = value;
        valid[i] = 1;
        if (value < min) min = value;
        if (value > max) max = value;
      } else {
        out[i] = Number.NaN;
      }
    }

    return {
      gridId: 'hycom.expt_93.0',
      variable: q.variable,
      timestamp: grid.timestamps[ti]!,
      depthM: grid.depthsM[zi]!,
      nx,
      ny,
      bounds: this.bounds(),
      values: out,
      valid,
      range: Number.isFinite(min) ? [min, max] : [0, 1],
    };
  }

  async getModelColumn(q: ColumnQuery): Promise<ModelColumn> {
    // Prefer an exact cached column if the query matches an observation position;
    // otherwise bilinear-interpolate the slice cache.
    const grid = this.cache.grid;
    const ts = grid.timestamps.includes(q.timestamp) ? q.timestamp : grid.timestamps[0]!;

    const exact = [...this.cache.columns.values()].find(
      (c) =>
        Math.abs(c.gridLatitude - q.latitude) < 0.05 &&
        Math.abs(c.gridLongitude - q.longitude) < 0.05,
    );
    if (exact) {
      const slot = exact.byTimestamp.find((b) => b.timestamp === ts) ?? exact.byTimestamp[0]!;
      return {
        gridId: 'hycom.expt_93.0',
        variable: q.variable,
        timestamp: ts,
        at: { latitude: q.latitude, longitude: q.longitude },
        depthsM: exact.depthsM,
        values: this.columnValues(slot, q.variable),
      };
    }

    // slice-cache bilinear fallback
    const depths = grid.depthsM;
    const values = depths.map((d) => this.bilinearFromSlices(q.variable, ts, d, q.latitude, q.longitude));
    return {
      gridId: 'hycom.expt_93.0',
      variable: q.variable,
      timestamp: ts,
      at: { latitude: q.latitude, longitude: q.longitude },
      depthsM: depths,
      values,
    };
  }

  private columnValues(
    slot: CachedColumn['byTimestamp'][number],
    variable: OceanVariable,
  ): (number | null)[] {
    if (variable === 'temperature') return slot.temperature;
    if (variable === 'salinity') return slot.salinity;
    if (variable === 'currentSpeed') {
      return slot.currentU.map((u, i) => {
        const v = slot.currentV[i];
        return u == null || v == null ? null : Math.sqrt(u * u + v * v);
      });
    }
    return slot.temperature.map(() => null); // chlorophyll
  }

  private bilinearFromSlices(
    variable: OceanVariable,
    timestamp: string,
    depthM: number,
    lat: number,
    lon: number,
  ): number | null {
    const { grid } = this.cache;
    const modelVar = MODEL_VAR[variable];
    if (modelVar === 'derived' && variable !== 'currentSpeed') return null;

    const ti = Math.max(0, grid.timestamps.indexOf(timestamp));
    const zi = nearestIndex(grid.depthsM, depthM);
    const { nx, ny, nz } = grid.shape;
    const xi = nearestIndex(grid.longitudes, lon);
    const yi = nearestIndex(grid.latitudes, lat);
    const idx = (ti * nz + zi) * ny * nx + yi * nx + xi;

    const at = (v: CachedModelVariable): number | null => {
      const arr = this.cache.slices[v];
      if (!arr) return null;
      const val = arr[idx];
      return val != null && Number.isFinite(val) ? val : null;
    };

    if (variable === 'currentSpeed') {
      const u = at('currentU');
      const v = at('currentV');
      return u == null || v == null ? null : Math.sqrt(u * u + v * v);
    }
    return at(modelVar as CachedModelVariable);
  }

  /* ---------------------------------------------------------------- *
   * observations
   * ---------------------------------------------------------------- */

  async getObservations(q: ObservationQuery): Promise<readonly ObservationProfile[]> {
    const bounds = q.bounds;
    const from = q.from ? Date.parse(q.from) : -Infinity;
    const to = q.to ? Date.parse(q.to) : Infinity;

    return this.cache.profiles
      .filter((p) => {
        if (q.platformTypes && !q.platformTypes.includes(p.platformType)) return false;
        if (bounds) {
          if (p.latitude < bounds.minLat || p.latitude > bounds.maxLat) return false;
          if (p.longitude < bounds.minLon || p.longitude > bounds.maxLon) return false;
        }
        const t = Date.parse(p.observedAt);
        if (t < from || t > to) return false;
        return true;
      })
      .map((p) => this.toProfile(p, q.goodQualityOnly ?? false));
  }

  async getObservation(id: string): Promise<ObservationProfile | null> {
    const p = this.cache.profiles.find((x) => x.id === id);
    return p ? this.toProfile(p, false) : null;
  }

  private toProfile(p: CachedProfile, goodOnly: boolean): ObservationProfile {
    const src = (this.cache.manifest as { sources: DataSourceDescriptor[] }).sources.find(
      (s) => s.id === 'argo.incois',
    )!;

    const keep = (i: number) => {
      if (!goodOnly) return true;
      const tf = p.temperatureQc[i];
      return tf === 'GOOD' || tf === 'PROBABLY_GOOD';
    };
    const idx = p.depthsM.map((_, i) => i).filter(keep);

    return {
      id: p.id,
      platformType: p.platformType,
      platformName: p.platformName,
      latitude: p.latitude,
      longitude: p.longitude,
      observedAt: p.observedAt,
      qc: p.qc,
      depthsM: idx.map((i) => p.depthsM[i]!),
      variables: {
        temperature: idx.map((i) => p.temperature[i] ?? null),
        salinity: idx.map((i) => p.salinity[i] ?? null),
      },
      qcByVariable: {
        temperature: idx.map((i) => p.temperatureQc[i] ?? null),
        salinity: idx.map((i) => p.salinityQc[i] ?? null),
      },
      unitByVariable: { temperature: '°C', salinity: 'PSU' },
      identity: {
        wmo: p.identity.wmo,
        dataCentre: p.identity.dataCentre,
        cycleNumber: p.identity.cycleNumber,
        dataMode: (p.identity.dataMode as 'R' | 'A' | 'D' | null) ?? null,
        projectName: p.identity.projectName,
        principalInvestigator: p.identity.principalInvestigator,
        positioningSystem: p.identity.positioningSystem,
        instrumentType: p.identity.instrumentType,
        positionQc: p.identity.positionQc,
      },
      provenance: src,
    };
  }

  /* ---------------------------------------------------------------- *
   * collocation — computed from cached arrays, never hard-coded
   * ---------------------------------------------------------------- */

  async getCollocation(q: CollocationQuery): Promise<CollocationResult | null> {
    const cachedProfile = this.cache.profiles.find((p) => p.id === q.observationId);
    const column = this.cache.columns.get(q.observationId);
    if (!cachedProfile || !column) return null;

    const grid = this.cache.grid;
    const modelTimestamp =
      q.timestamp && grid.timestamps.includes(q.timestamp)
        ? q.timestamp
        : this.nearestModelTime(cachedProfile.observedAt);
    const slot =
      column.byTimestamp.find((b) => b.timestamp === modelTimestamp) ?? column.byTimestamp[0]!;

    const obsValues = q.variable === 'salinity' ? cachedProfile.salinity : cachedProfile.temperature;
    const obsQc = q.variable === 'salinity' ? cachedProfile.salinityQc : cachedProfile.temperatureQc;
    const modelColDepths = column.depthsM;
    const modelColValues = this.columnValues(slot, q.variable);

    // Evaluate on the observation's own depth axis, QC-filtered to good levels.
    const obsOnAxis: (number | null)[] = [];
    const axis: number[] = [];
    for (let i = 0; i < cachedProfile.depthsM.length; i++) {
      const f = obsQc[i];
      const v = obsValues[i];
      if ((f === 'GOOD' || f === 'PROBABLY_GOOD') && v != null && Number.isFinite(v)) {
        axis.push(cachedProfile.depthsM[i]!);
        obsOnAxis.push(v);
      }
    }
    // model column -> observation depths
    const modelLevels: Level[] = [];
    for (let i = 0; i < modelColDepths.length; i++) {
      const v = modelColValues[i];
      if (v != null && Number.isFinite(v)) modelLevels.push({ depthM: modelColDepths[i]!, value: v });
    }
    const modeledOnAxis = interpolateProfile(modelLevels, axis);

    const pairs = pairFinite(axis, obsOnAxis, modeledOnAxis);
    const obs = pairs.map((p) => p.observed);
    const mod = pairs.map((p) => p.modeled);
    const rmse = calculateRMSE(obs, mod);
    const bias = calculateMeanBias(obs, mod);

    const meta = VARIABLES[q.variable];
    const tolerance = (meta.defaultRange[1] - meta.defaultRange[0]) / 14;
    const bandAgreement = calculateBandAgreement(pairs, BANDS, tolerance);
    const bands: DepthBandAgreement[] = bandAgreement.map((b) => ({
      fromM: b.fromM,
      toM: b.toM,
      meanDelta: b.meanDelta,
      rmse: b.rmse,
      verdict: b.verdict,
      sampleCount: b.sampleCount,
    }));

    const distanceKm = haversineKm(
      { latitude: cachedProfile.latitude, longitude: cachedProfile.longitude },
      { latitude: column.gridLatitude, longitude: column.gridLongitude },
    );
    const timeOffsetHours = calculateTimeOffsetHours(cachedProfile.observedAt, modelTimestamp);

    const interpretation = buildScientificInterpretation({
      variableName: meta.name,
      unit: meta.unit,
      biasWords: meta.biasWords,
      structureName: meta.id === 'salinity' ? 'halocline' : 'thermocline',
      overallRmse: rmse,
      overallBias: bias,
      bands: bandAgreement,
      sampleCount: pairs.length,
    });

    return {
      observationId: q.observationId,
      variable: q.variable,
      modelSource: 'HYCOM GOFS 3.1 (GLBy0.08 expt_93.0)',
      modelTimestamp,
      horizontalDistanceKm: distanceKm,
      timeOffsetHours,
      rmse,
      meanBias: bias,
      depthsM: pairs.map((p) => p.depthM),
      observedValues: pairs.map((p) => p.observed),
      modeledValues: pairs.map((p) => p.modeled),
      sampleCount: pairs.length,
      bands,
      interpretation,
    };
  }

  /* ---------------------------------------------------------------- */

  private bounds(): GeoBounds {
    const { latitudes, longitudes } = this.cache.grid;
    return {
      minLat: latitudes[0]!,
      maxLat: latitudes[latitudes.length - 1]!,
      minLon: longitudes[0]!,
      maxLon: longitudes[longitudes.length - 1]!,
    };
  }

  private nearestModelTime(iso: string): string {
    const t = Date.parse(iso);
    let best = this.cache.grid.timestamps[0]!;
    let bestDiff = Infinity;
    for (const ts of this.cache.grid.timestamps) {
      const d = Math.abs(Date.parse(ts) - t);
      if (d < bestDiff) {
        bestDiff = d;
        best = ts;
      }
    }
    return best;
  }
}

/** Layer ids that always exist, for callers that enumerate the registry. */
export const KNOWN_LAYER_IDS: readonly LayerId[] = ALL_LAYER_IDS;
