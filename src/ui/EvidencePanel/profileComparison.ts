/* Pure data-mapping and branch-selection logic for the Profile tab's
 * observed-vs-modelled vertical chart. No DOM/React/SVG here, so all of it
 * is directly unit-testable — same split as src/ui/scene/sliceTexture.ts
 * and src/ui/scene/sceneStageState.ts.
 *
 * "Closest real model column": the backend's `/api/v1/model-column`
 * endpoint does NOT snap to the nearest available timestamp on its own —
 * confirmed by reading backend/app/services/slice_service.py:
 * `actual_ts = timestamp if timestamp in cache.grid.timestamps else
 * cache.grid.timestamps[0]` — an inexact request silently falls back to the
 * FIRST cached timestamp, not the nearest one. `nearestTimestamp()` below
 * exists so the frontend always requests an exact, known-valid timestamp
 * (chosen from the same `availableTimes` axis the timeline already loads),
 * sidestepping that fallback entirely rather than working around it with a
 * backend change (out of this task's scope). */

import type { OceanVariable } from '@/domain/variables';
import type { QualityFlag } from '@/domain/quality';
import type { ModelColumn, ObservationProfile } from '@/domain/types';

/** Argo floats in this cache carry temperature and salinity only — no
 * current or chlorophyll sensor. Never invented for the other two. */
export const PROFILE_CHART_VARIABLES: readonly OceanVariable[] = ['temperature', 'salinity'];

export function isProfileChartVariable(v: OceanVariable): boolean {
  return PROFILE_CHART_VARIABLES.includes(v);
}

export interface ObservedPoint {
  readonly depthM: number;
  readonly value: number;
  readonly qc: QualityFlag;
}

export interface ModeledPoint {
  readonly depthM: number;
  readonly value: number;
}

/** Marker shape per QC flag — deliberately not colour-only, so the quality
 * distinction survives greyscale/colour-blind viewing too. */
export type QcMarkerShape = 'dot' | 'ring' | 'cross';

export function qcMarkerShape(qc: QualityFlag): QcMarkerShape {
  if (qc === 'GOOD' || qc === 'PROBABLY_GOOD') return 'dot';
  if (qc === 'SUSPECT') return 'ring';
  return 'cross'; // BAD
}

/** Nearest candidate timestamp to `targetIso` by absolute time difference.
 * `candidates` is expected non-empty and ISO 8601; returns null only when
 * empty (never fabricates a timestamp). */
export function nearestTimestamp(
  targetIso: string,
  candidates: readonly string[],
): string | null {
  if (candidates.length === 0) return null;
  const target = Date.parse(targetIso);
  let best = candidates[0] as string;
  if (!Number.isFinite(target)) return best;
  let bestDiff = Math.abs(Date.parse(best) - target);
  for (const c of candidates) {
    const diff = Math.abs(Date.parse(c) - target);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }
  return best;
}

/** Extracts real, non-null, QC-tagged levels for one variable from a full
 * observation profile. Levels with a missing value or missing QC are
 * skipped, never zero-filled or assigned an invented flag. */
export function buildObservedSeries(
  obs: ObservationProfile,
  variable: OceanVariable,
): readonly ObservedPoint[] {
  const values = obs.variables[variable];
  const qcs = obs.qcByVariable[variable];
  if (!values) return [];
  const out: ObservedPoint[] = [];
  for (let i = 0; i < obs.depthsM.length; i++) {
    const depthM = obs.depthsM[i];
    const v = values[i];
    const q = qcs?.[i];
    if (depthM == null || v == null || !Number.isFinite(v) || !q) continue;
    out.push({ depthM, value: v, qc: q });
  }
  return out;
}

/** Extracts real, non-null levels from a model column. `null` entries (no
 * data at that depth/position) are skipped, not interpolated across. */
export function buildModeledSeries(column: ModelColumn | null): readonly ModeledPoint[] {
  if (!column) return [];
  const out: ModeledPoint[] = [];
  for (let i = 0; i < column.depthsM.length; i++) {
    const depthM = column.depthsM[i];
    const v = column.values[i];
    if (depthM == null || v == null || !Number.isFinite(v)) continue;
    out.push({ depthM, value: v });
  }
  return out;
}

export interface ChartDomain {
  readonly depthMaxM: number;
  readonly valueMin: number;
  readonly valueMax: number;
}

/** Real data extent with a small visual pad — never the variable's broad
 * default range, so a single profile's actual shape is legible rather than
 * flattened inside a wide fixed scale. Returns null when there is nothing
 * to plot (caller must show an honest empty state, not a blank axis). */
export function computeChartDomain(
  observed: readonly ObservedPoint[],
  modeled: readonly ModeledPoint[],
): ChartDomain | null {
  const depths = [...observed.map((p) => p.depthM), ...modeled.map((p) => p.depthM)];
  const values = [...observed.map((p) => p.value), ...modeled.map((p) => p.value)];
  if (depths.length === 0 || values.length === 0) return null;
  const depthMaxRaw = Math.max(...depths);
  const valueMinRaw = Math.min(...values);
  const valueMaxRaw = Math.max(...values);
  const pad = (valueMaxRaw - valueMinRaw) * 0.08 || Math.max(0.5, Math.abs(valueMaxRaw) * 0.05) || 0.5;
  return {
    depthMaxM: depthMaxRaw <= 0 ? 10 : depthMaxRaw * 1.04,
    valueMin: valueMinRaw - pad,
    valueMax: valueMaxRaw + pad,
  };
}

/* ------------------------------------------------------------------ *
 * State branching — mirrors sceneStageState.ts's pure-function pattern
 * ------------------------------------------------------------------ */

export type ProfileChartView =
  | { readonly kind: 'unavailable-variable'; readonly variableName: string }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'no-valid-levels' }
  | { readonly kind: 'ready' };

export interface ProfileChartInput {
  readonly variableSupported: boolean;
  readonly variableName: string;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly observedCount: number;
}

/** Branch order: unsupported variable first (no fetch was even attempted),
 * then loading/idle, then a real fetch error, then a genuinely empty real
 * result (e.g. an all-QC-failed profile — see docs/api.md on
 * ARGO-4903776-2), else ready. */
export function selectProfileChartView(input: ProfileChartInput): ProfileChartView {
  if (!input.variableSupported) {
    return { kind: 'unavailable-variable', variableName: input.variableName };
  }
  if (input.status === 'loading' || input.status === 'idle') {
    return { kind: 'loading' };
  }
  if (input.status === 'error') {
    return { kind: 'error', message: input.error ?? 'Unknown error' };
  }
  if (input.observedCount === 0) {
    return { kind: 'no-valid-levels' };
  }
  return { kind: 'ready' };
}
