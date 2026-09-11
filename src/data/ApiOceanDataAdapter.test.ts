/* Fetch-mocked unit tests — always run, never require a live backend.
 * Prove response mapping, status-vocabulary translation, and error handling
 * without a network dependency. Real-HTTP coverage lives in
 * ApiOceanDataAdapter.integration.test.ts. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiOceanDataAdapter, mapApiStatus } from './ApiOceanDataAdapter';
import { ApiResponseError, ApiUnavailableError } from './api/client';

function mockFetchOnce(body: unknown, init?: Partial<Response>) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? 200;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    } as Response),
  );
}

const SOURCE = {
  name: 'Argo global profiles',
  status: 'REAL_SOURCE_LOCALLY_CACHED' as const,
  url: 'https://data-argo.ifremer.fr/dac/',
  retrieved_at: '2026-09-10T11:19:09.588Z',
  checksum: 'abc123',
  notes: null,
  originator: 'International Argo Program',
  source_files: ['D5907083_002.nc'],
  variables: ['TEMP', 'PSAL'],
  units: { TEMP: 'degree_Celsius' },
  coordinate_system: 'WGS84',
  temporal_start: '2023-09-25T00:00:00Z',
  temporal_end: '2023-10-05T00:00:00Z',
  temporal_cadence: 'per float cycle',
  depth_min_m: 0,
  depth_max_m: 2010,
  spatial_bounds: { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 },
  qc_convention: 'Argo QC flag scale',
  transformations: ['converted pressure to depth'],
  licence: 'freely available',
  caveats: ['19 of 28 profiles are INCOIS'],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mapApiStatus', () => {
  it('translates every API status to its frontend equivalent', () => {
    expect(mapApiStatus('REAL_SOURCE_LOCALLY_CACHED')).toBe('REAL_CACHED');
    expect(mapApiStatus('PRECOMPUTED_FROM_REAL_SOURCE')).toBe('PRECOMPUTED_FROM_REAL');
    expect(mapApiStatus('DERIVED_FROM_REAL_SOURCE')).toBe('DERIVED_FROM_REAL');
    expect(mapApiStatus('SYNTHETIC_TEST_FIXTURE')).toBe('SYNTHETIC_FIXTURE');
    expect(mapApiStatus('NOT_AVAILABLE_MVP')).toBe('NOT_AVAILABLE_MVP');
    expect(mapApiStatus('PLANNED_EXTENSION')).toBe('PLANNED_EXTENSION');
  });
});

describe('ApiOceanDataAdapter.getMetadata', () => {
  it('maps a real API response into DatasetMetadata with translated status', async () => {
    mockFetchOnce({
      dataset_id: 'oceanlens-india-bay-of-bengal',
      title: 'OceanLens India',
      region: { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 },
      region_name: 'Bay of Bengal',
      timestamps: ['2023-09-25T00:00:00.000Z'],
      depths_m: [0, 10, 20],
      variables: [
        {
          key: 'temperature',
          standard_name: 'sea_water_temperature',
          unit: '°C',
          available: true,
          source: SOURCE,
        },
      ],
      platforms: [],
      observation_count: 28,
      historical_window: true,
      window_label: 'Historical demonstration window',
      view_id: 'DEMO-OCN-2023-0925-BB',
      source: SOURCE,
    });
    // second call: /api/v1/provenance
    const adapter = new ApiOceanDataAdapter();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        dataset_id: 'x',
        title: 'OceanLens India',
        region: { minLat: 8, maxLat: 20.5, minLon: 81, maxLon: 93 },
        region_name: 'Bay of Bengal',
        timestamps: ['2023-09-25T00:00:00.000Z'],
        depths_m: [0, 10, 20],
        variables: [{ key: 'temperature', standard_name: null, unit: '°C', available: true, source: SOURCE }],
        platforms: [],
        observation_count: 28,
        historical_window: true,
        window_label: 'Historical demonstration window',
        view_id: 'DEMO-OCN-2023-0925-BB',
        source: SOURCE,
      }),
    }) as unknown as Response);
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        layers: [
          {
            layer_id: 'obs.argo',
            label: 'Argo profiles',
            kind: 'OBSERVATION_PROFILE',
            variable: null,
            platform_type: 'ARGO',
            collocatable: true,
            source: SOURCE,
          },
        ],
        generated_at: '2026-09-10T12:00:00Z',
        cache_id: 'abc',
      }),
    }) as unknown as Response);

    const meta = await adapter.getMetadata();
    expect(meta.viewId).toBe('DEMO-OCN-2023-0925-BB');
    expect(meta.windowLabel).toBe('Historical demonstration window');
    expect(meta.sources).toHaveLength(1);
    expect(meta.sources[0]!.status).toBe('REAL_CACHED'); // translated, not the raw API string
    expect(meta.sources[0]!.sourceUrl).toBe('https://data-argo.ifremer.fr/dac/');
  });
});

describe('ApiOceanDataAdapter.getAvailableTimes', () => {
  it('returns timestamps when available', async () => {
    mockFetchOnce({ variable: 'temperature', available: true, timestamps: ['2023-09-25T00:00:00Z'], reason: null });
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('temperature');
    expect(times).toEqual(['2023-09-25T00:00:00Z']);
  });

  it('returns an empty array for an unavailable variable, never fabricated timestamps', async () => {
    mockFetchOnce({
      variable: 'chlorophyll',
      available: false,
      timestamps: [],
      reason: "No real cached source exists for 'chlorophyll'.",
    });
    const adapter = new ApiOceanDataAdapter();
    const times = await adapter.getAvailableTimes('chlorophyll');
    expect(times).toEqual([]);
  });
});

describe('ApiOceanDataAdapter.getVolumeSlice', () => {
  it('converts the 2D JSON grid into a row-major Float32Array with a valid mask', async () => {
    mockFetchOnce({
      variable: 'temperature',
      unit: '°C',
      requested_timestamp: '2023-09-28T00:00:00Z',
      actual_timestamp: '2023-09-28T00:00:00.000Z',
      requested_depth_m: 100,
      actual_depth_m: 100,
      latitudes: [8, 9],
      longitudes: [81, 82, 83],
      values: [
        [20.1, null, 20.3],
        [21.1, 21.2, null],
      ],
      resolution: { nx: 3, ny: 2 },
      decimation: { horizontal_stride: 3 },
      source: SOURCE,
    });
    const adapter = new ApiOceanDataAdapter();
    const slice = await adapter.getVolumeSlice({
      variable: 'temperature',
      timestamp: '2023-09-28T00:00:00Z',
      depthM: 100,
    });
    expect(slice.nx).toBe(3);
    expect(slice.ny).toBe(2);
    expect(slice.values[0]).toBeCloseTo(20.1);
    expect(slice.valid[1]).toBe(0); // the null cell
    expect(Number.isNaN(slice.values[1])).toBe(true);
    expect(slice.range[0]).toBeCloseTo(20.1);
    expect(slice.range[1]).toBeCloseTo(21.2);
  });
});

describe('ApiOceanDataAdapter.getCollocation', () => {
  it('maps null rmse/bias (no overlap) to NaN, matching the local-cache adapter convention', async () => {
    mockFetchOnce({
      observation_id: 'ARGO-4903776-2',
      variable: 'temperature',
      unit: '°C',
      model_source: 'HYCOM',
      observation_source: 'Argo GDAC',
      model_timestamp: '2023-10-02T00:00:00Z',
      observation_timestamp: '2023-10-01T13:46:42Z',
      horizontal_distance_km: 0.36,
      time_offset_hours: -10.2,
      rmse: null,
      mean_bias: null,
      depths_m: [],
      observed_values: [],
      modeled_values: [],
      sample_count: 0,
      bands: [{ from_m: 0, to_m: 50, mean_delta: null, rmse: null, sample_count: 0, verdict: 'Low' }],
      interpretation: 'No quality-controlled levels overlap between this profile and the model column, so no comparison can be made.',
      source: SOURCE,
    });
    const adapter = new ApiOceanDataAdapter();
    const result = await adapter.getCollocation({
      observationId: 'ARGO-4903776-2',
      variable: 'temperature',
    });
    expect(result).not.toBeNull();
    expect(Number.isNaN(result!.rmse)).toBe(true);
    expect(Number.isNaN(result!.meanBias)).toBe(true);
    expect(Number.isNaN(result!.bands[0]!.rmse)).toBe(true);
  });

  it('returns null when the observation does not exist (404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "observation 'NOPE' not found" }),
      } as Response),
    );
    const adapter = new ApiOceanDataAdapter();
    const result = await adapter.getCollocation({ observationId: 'NOPE', variable: 'temperature' });
    expect(result).toBeNull();
  });
});

describe('error handling — no silent synthetic fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  });

  it('throws ApiUnavailableError rather than returning fabricated data when the backend is down', async () => {
    const adapter = new ApiOceanDataAdapter();
    await expect(adapter.getMetadata()).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it('never returns an empty-but-successful result on a network failure', async () => {
    const adapter = new ApiOceanDataAdapter();
    await expect(
      adapter.getObservations({}),
    ).rejects.toThrow();
  });
});

describe('error handling — API error responses surface, not swallowed', () => {
  it('throws ApiResponseError with the backend detail message on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'invalid variable' }),
      } as Response),
    );
    const adapter = new ApiOceanDataAdapter();
    try {
      await adapter.getVolumeSlice({ variable: 'temperature', timestamp: 'x', depthM: 0 });
      expect.unreachable('expected getVolumeSlice to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiResponseError);
      expect((e as ApiResponseError).status).toBe(422);
      expect((e as Error).message).toContain('invalid variable');
    }
  });
});
