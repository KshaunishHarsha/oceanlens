/* Fetches the real-data cache from public/data/real/. Browser-side only. */

import type {
  CachedColumn,
  CachedGrid,
  CachedModelVariable,
  CachedProfile,
  LoadedCache,
} from './types';

const BASE = 'data/real';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`cache fetch failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

async function fetchFloat32(path: string): Promise<Float32Array | null> {
  const res = await fetch(`${BASE}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`cache fetch failed: ${path} (${res.status})`);
  const buf = await res.arrayBuffer();
  return new Float32Array(buf);
}

export async function loadRealDataCache(): Promise<LoadedCache> {
  const [manifest, grid, profiles, columnList] = await Promise.all([
    fetchJson<unknown>('manifest.json'),
    fetchJson<CachedGrid>('model/grid.json'),
    fetchJson<CachedProfile[]>('observations/profiles.json'),
    fetchJson<CachedColumn[]>('model/columns.json'),
  ]);

  const expected = grid.shape.nt * grid.shape.nz * grid.shape.ny * grid.shape.nx;
  const vars: CachedModelVariable[] = ['temperature', 'salinity', 'currentU', 'currentV'];
  const sliceEntries = await Promise.all(
    vars.map(async (v) => [v, await fetchFloat32(`model/${v}.f32`)] as const),
  );

  const slices: Partial<Record<CachedModelVariable, Float32Array>> = {};
  for (const [v, arr] of sliceEntries) {
    if (!arr) continue;
    if (arr.length !== expected) {
      throw new Error(
        `cache slice ${v} has ${arr.length} floats, grid shape implies ${expected}`,
      );
    }
    slices[v] = arr;
  }

  return {
    manifest,
    grid,
    profiles,
    columns: new Map(columnList.map((c) => [c.observationId, c])),
    slices,
    haveCurrents: Boolean(slices.currentU && slices.currentV),
  };
}
