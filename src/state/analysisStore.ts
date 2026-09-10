/* The single linked analysis state.
 *
 * Every control writes here; every panel reads from here. The brief's core
 * requirement is that selection, variable, depth and time stay synchronised
 * across the scene, the profile chart and the evidence panel — that only works
 * if there is exactly one place they live. */

import { create } from 'zustand';
import type { OceanVariable } from '@/domain/variables';
import type { PlatformType } from '@/domain/platforms';
import type { LayerId } from '@/domain/layers';

export type RenderMode = 'volume' | 'depthSlice' | 'transect' | 'isosurface';
export type CameraPreset = 'regional' | 'transect' | 'profile' | 'reset';
export type WorkspaceMode = 'workspace' | 'briefing' | 'outreach';
export type EvidenceTab = 'profile' | 'comparison' | 'provenance';
export type ColorScale = 'linear' | 'log';

export interface PlaybackState {
  readonly playing: boolean;
  /** Playback rate multiplier. */
  readonly speed: 1 | 2 | 4;
}

export interface Transect {
  readonly a: { readonly latitude: number; readonly longitude: number };
  readonly b: { readonly latitude: number; readonly longitude: number };
}

export interface ObservationFilters {
  readonly platformTypes: Readonly<Record<PlatformType, boolean>>;
  /** Hours either side of the model timestamp. */
  readonly timeWindowHours: 6 | 12 | 24;
  readonly goodQualityOnly: boolean;
  readonly collocatedOnly: boolean;
}

export interface AnalysisState {
  variable: OceanVariable;
  /** ISO 8601 UTC, or null before data loads. */
  timestamp: string | null;
  /** Index into the loaded timestamp array. Kept in sync with `timestamp`. */
  timeIndex: number;
  depthM: number;
  verticalExaggeration: number;
  renderMode: RenderMode;
  cameraPreset: CameraPreset;
  layers: Partial<Record<LayerId, boolean>>;
  selectedObservationId: string | null;
  hoveredObservationId: string | null;
  selectedTransect: Transect | null;
  transectEnabled: boolean;
  divergenceHighlighted: boolean;
  playback: PlaybackState;
  filters: ObservationFilters;
  mode: WorkspaceMode;
  evidenceTab: EvidenceTab;
  colorScale: ColorScale;
  /** Field opacity in the scene, 0..1. */
  opacity: number;
  /** Timestamps currently loaded, ascending. Owned by the data layer. */
  availableTimes: readonly string[];
}

export interface AnalysisActions {
  setVariable(v: OceanVariable): void;
  setTimeIndex(i: number): void;
  stepTime(delta: number): void;
  setAvailableTimes(times: readonly string[]): void;
  setDepth(m: number): void;
  setVerticalExaggeration(x: number): void;
  setRenderMode(m: RenderMode): void;
  setCameraPreset(p: CameraPreset): void;
  toggleLayer(id: LayerId): void;
  setLayer(id: LayerId, on: boolean): void;
  selectObservation(id: string | null): void;
  hoverObservation(id: string | null): void;
  setTransect(t: Transect | null): void;
  toggleTransect(): void;
  setDivergenceHighlighted(on: boolean): void;
  togglePlayback(): void;
  setPlaybackSpeed(s: 1 | 2 | 4): void;
  togglePlatformType(p: PlatformType): void;
  setTimeWindow(h: 6 | 12 | 24): void;
  setGoodQualityOnly(on: boolean): void;
  setCollocatedOnly(on: boolean): void;
  setMode(m: WorkspaceMode): void;
  setEvidenceTab(t: EvidenceTab): void;
  setColorScale(s: ColorScale): void;
  setOpacity(o: number): void;
  resetScientificDefaults(): void;
}

export type AnalysisStore = AnalysisState & AnalysisActions;

/** Depth slider stops. Non-linear, matching the artboard's scale. */
export const DEPTH_STOPS: readonly number[] = [0, 50, 100, 250, 500, 1000];

export const DEFAULT_DEPTH_M = 120;
export const DEFAULT_EXAGGERATION = 18;
export const MIN_EXAGGERATION = 2;
export const MAX_EXAGGERATION = 40;

export const INITIAL_STATE: AnalysisState = {
  variable: 'temperature',
  timestamp: null,
  timeIndex: 0,
  depthM: DEFAULT_DEPTH_M,
  verticalExaggeration: DEFAULT_EXAGGERATION,
  renderMode: 'depthSlice',
  cameraPreset: 'regional',
  layers: {
    'model.temperature': true,
    'derived.isosurface': true,
    'obs.argo': true,
    'context.bathymetry': true,
  },
  selectedObservationId: null,
  hoveredObservationId: null,
  selectedTransect: null,
  transectEnabled: false,
  divergenceHighlighted: false,
  playback: { playing: false, speed: 1 },
  filters: {
    platformTypes: { ARGO: true, GLIDER: true, CTD: true, BGC: true },
    timeWindowHours: 12,
    goodQualityOnly: true,
    collocatedOnly: false,
  },
  mode: 'workspace',
  evidenceTab: 'profile',
  colorScale: 'linear',
  opacity: 0.82,
  availableTimes: [],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  ...INITIAL_STATE,

  setVariable: (v) => set({ variable: v }),

  setAvailableTimes: (times) =>
    set((s) => {
      const i = clamp(s.timeIndex, 0, Math.max(0, times.length - 1));
      return { availableTimes: times, timeIndex: i, timestamp: times[i] ?? null };
    }),

  setTimeIndex: (i) =>
    set((s) => {
      if (s.availableTimes.length === 0) return { timeIndex: 0, timestamp: null };
      const idx = clamp(Math.round(i), 0, s.availableTimes.length - 1);
      return { timeIndex: idx, timestamp: s.availableTimes[idx] ?? null };
    }),

  /** Steps and wraps, so timeline playback loops rather than sticking. */
  stepTime: (delta) =>
    set((s) => {
      const n = s.availableTimes.length;
      if (n === 0) return {};
      const idx = ((Math.round(s.timeIndex + delta) % n) + n) % n;
      return { timeIndex: idx, timestamp: s.availableTimes[idx] ?? null };
    }),

  setDepth: (m) => set({ depthM: clamp(Math.round(m), 0, 1000) }),

  setVerticalExaggeration: (x) =>
    set({ verticalExaggeration: clamp(x, MIN_EXAGGERATION, MAX_EXAGGERATION) }),

  setRenderMode: (m) => set({ renderMode: m }),
  setCameraPreset: (p) => set({ cameraPreset: p }),

  toggleLayer: (id) =>
    set((s) => ({ layers: { ...s.layers, [id]: !(s.layers[id] ?? false) } })),

  setLayer: (id, on) => set((s) => ({ layers: { ...s.layers, [id]: on } })),

  /* Selecting an observation opens the profile tab — the brief requires the
     evidence panel to respond to a scene click without a second action. */
  selectObservation: (id) =>
    set({ selectedObservationId: id, evidenceTab: id ? 'profile' : get().evidenceTab }),

  hoverObservation: (id) => set({ hoveredObservationId: id }),

  setTransect: (t) => set({ selectedTransect: t, transectEnabled: t !== null }),
  toggleTransect: () => set((s) => ({ transectEnabled: !s.transectEnabled })),
  setDivergenceHighlighted: (on) => set({ divergenceHighlighted: on }),

  togglePlayback: () =>
    set((s) => ({ playback: { ...s.playback, playing: !s.playback.playing } })),
  setPlaybackSpeed: (speed) => set((s) => ({ playback: { ...s.playback, speed } })),

  togglePlatformType: (p) =>
    set((s) => ({
      filters: {
        ...s.filters,
        platformTypes: { ...s.filters.platformTypes, [p]: !s.filters.platformTypes[p] },
      },
    })),

  setTimeWindow: (h) => set((s) => ({ filters: { ...s.filters, timeWindowHours: h } })),
  setGoodQualityOnly: (on) =>
    set((s) => ({ filters: { ...s.filters, goodQualityOnly: on } })),
  setCollocatedOnly: (on) =>
    set((s) => ({ filters: { ...s.filters, collocatedOnly: on } })),

  setMode: (m) => set({ mode: m }),
  setEvidenceTab: (t) => set({ evidenceTab: t }),
  setColorScale: (s2) => set({ colorScale: s2 }),
  setOpacity: (o) => set({ opacity: clamp(o, 0.1, 1) }),

  resetScientificDefaults: () =>
    set({
      colorScale: 'linear',
      opacity: INITIAL_STATE.opacity,
      verticalExaggeration: DEFAULT_EXAGGERATION,
      depthM: DEFAULT_DEPTH_M,
    }),
}));

/** Reset helper for tests. Not used by the app. */
export function resetAnalysisStore(): void {
  useAnalysisStore.setState({ ...INITIAL_STATE }, false);
}
