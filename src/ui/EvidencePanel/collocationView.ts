/* Pure data-formatting and branch-selection logic for the Comparison tab.
 * No DOM/React here, so all of it is directly unit-testable — same split as
 * profileComparison.ts and src/ui/scene/sceneStageState.ts.
 *
 * This module never computes a statistic. Every number it formats came from
 * the backend's own `CollocationResult` (RMSE, mean bias, distance, time
 * offset, per-band verdict, interpretation sentence) — see
 * backend/app/science/collocation.py, ported 1:1 from the same
 * src/domain/stats.ts this project used before the Phase 2.5 backend
 * refactor. Recomputing any of it here would violate the task's explicit
 * "do not recalculate statistics in the frontend" boundary. */

import type { DepthBandAgreement } from '@/domain/types';
import { isProfileChartVariable } from './profileComparison';

/** Argo floats in this cache carry temperature and salinity only. Reusing
 * ProfileChart's gate here matters for a second, independent reason too:
 * reading backend/app/science/collocation.py's compute_collocation() shows
 * that for any variable other than "salinity" it unconditionally uses the
 * profile's TEMPERATURE array as the "observed" series — so a currentSpeed
 * or chlorophyll collocation request would silently compare the model's
 * current speed against the float's temperature, a real backend
 * inconsistency. Gating here (never calling getCollocation for those
 * variables) avoids surfacing that, without patching the backend, which is
 * out of this task's scope. */
export const isCollocationVariable = isProfileChartVariable;

export type CollocationView =
  | { readonly kind: 'unavailable-variable'; readonly variableName: string }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  /** adapter.getCollocation() resolved to null — no real model column was
   * ever extracted for this observation (backend's NoModelColumnError /
   * ObservationNotFoundError both map here). Real, even though every
   * profile in the current cache happens to have a column (100% coverage,
   * per the Phase 4A step 2 finding) — a future, sparser cache could hit
   * this honestly. */
  | { readonly kind: 'no-collocation' }
  /** A real result, but zero QC-good levels overlapped (e.g. the
   * ARGO-4903776-2 all-BAD profile) — position/time metadata is still
   * real and shown; rmse/meanBias/bands are all null → "—", never 0. */
  | { readonly kind: 'no-valid-levels' }
  | { readonly kind: 'ready' };

export interface CollocationViewInput {
  readonly variableSupported: boolean;
  readonly variableName: string;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly sampleCount: number | null;
}

/** Branch order mirrors selectProfileChartView's: unsupported variable
 * first (no fetch attempted), then loading/idle, then a real fetch error,
 * then "no collocation exists at all", then "exists but zero valid
 * samples", else ready. */
export function selectCollocationView(input: CollocationViewInput): CollocationView {
  if (!input.variableSupported) {
    return { kind: 'unavailable-variable', variableName: input.variableName };
  }
  if (input.status === 'loading' || input.status === 'idle') {
    return { kind: 'loading' };
  }
  if (input.status === 'error') {
    return { kind: 'error', message: input.error ?? 'Unknown error' };
  }
  if (input.sampleCount == null) {
    return { kind: 'no-collocation' };
  }
  if (input.sampleCount === 0) {
    return { kind: 'no-valid-levels' };
  }
  return { kind: 'ready' };
}

/** Maps a band's real verdict word to an existing token colour. This is
 * styling of an already-computed categorical value, not a new score — the
 * verdict itself comes straight from the API's bands[].verdict, derived
 * server-side from real RMSE vs. the variable's own tolerance. */
export function verdictColorVar(verdict: DepthBandAgreement['verdict']): string {
  switch (verdict) {
    case 'High':
      return '--good';
    case 'Fair':
      return '--cyan';
    case 'Moderate':
      return '--warn';
    case 'Low':
      return '--bad';
  }
}

/** Distance formatting. "—" for a non-finite value — never fabricates a
 * zero-looking result for an unavailable one. */
export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '—';
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

/** Signed hour offset. Convention (matches src/domain/stats.ts and the
 * backend port): observation time minus model time — positive means the
 * observation was taken after the model snapshot. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  const sign = hours >= 0 ? '+' : '−';
  return `${sign}${Math.abs(hours).toFixed(1)} h`;
}

/** Short direction phrase for a signed bias using the variable's own
 * bias-word pair (e.g. ["warmer","cooler"] -> "model warmer than
 * observed"). Empty string when the statistic is unavailable — never
 * guesses a direction for a null/NaN value. */
export function describeBiasDirection(
  biasWords: readonly [string, string],
  meanDelta: number,
): string {
  if (!Number.isFinite(meanDelta)) return '';
  const word = meanDelta >= 0 ? biasWords[0] : biasWords[1];
  return `model ${word} than observed`;
}
