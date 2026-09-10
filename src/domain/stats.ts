/* Scientific statistics.
 *
 * Every function here is pure and operates on the same arrays the UI displays.
 * Nothing in the product may show an RMSE, bias, distance, offset or agreement
 * figure that was not produced by one of these functions from real cached data.
 *
 * Bias convention throughout: `model - observation`. A positive bias means the
 * model reads higher than the instrument. */

import { haversineKm, type GeoPoint } from './types';

/** A paired sample: an observed value and the model value at the same depth. */
export interface Pair {
  readonly depthM: number;
  readonly observed: number;
  readonly modeled: number;
}

/**
 * Keep only levels where both series have a finite value.
 * The comparison must never be inflated by counting gaps as agreement.
 */
export function pairFinite(
  depthsM: readonly number[],
  observed: readonly (number | null | undefined)[],
  modeled: readonly (number | null | undefined)[],
): Pair[] {
  const out: Pair[] = [];
  const n = Math.min(depthsM.length, observed.length, modeled.length);
  for (let i = 0; i < n; i++) {
    const d = depthsM[i];
    const o = observed[i];
    const m = modeled[i];
    if (
      d != null &&
      o != null &&
      m != null &&
      Number.isFinite(d) &&
      Number.isFinite(o) &&
      Number.isFinite(m)
    ) {
      out.push({ depthM: d, observed: o, modeled: m });
    }
  }
  return out;
}

/** Root-mean-square error between observed and modeled. NaN if no pairs. */
export function calculateRMSE(
  observed: readonly number[],
  modeled: readonly number[],
): number {
  const n = Math.min(observed.length, modeled.length);
  if (n === 0) return Number.NaN;
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const o = observed[i];
    const m = modeled[i];
    if (o == null || m == null || !Number.isFinite(o) || !Number.isFinite(m)) continue;
    const d = m - o;
    sumSq += d * d;
    count++;
  }
  return count === 0 ? Number.NaN : Math.sqrt(sumSq / count);
}

/** Mean of (model - observation). NaN if no pairs. */
export function calculateMeanBias(
  observed: readonly number[],
  modeled: readonly number[],
): number {
  const n = Math.min(observed.length, modeled.length);
  if (n === 0) return Number.NaN;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const o = observed[i];
    const m = modeled[i];
    if (o == null || m == null || !Number.isFinite(o) || !Number.isFinite(m)) continue;
    sum += m - o;
    count++;
  }
  return count === 0 ? Number.NaN : sum / count;
}

export interface Level {
  readonly depthM: number;
  readonly value: number;
}

/**
 * Linearly interpolate a monotonically-deepening profile onto `targetDepths`.
 * Depths outside the profile's range yield null — we never extrapolate a
 * measurement the instrument did not make.
 *
 * `profile` must be sorted shallow-to-deep. Duplicate depths are tolerated
 * (the first wins).
 */
export function interpolateProfile(
  profile: readonly Level[],
  targetDepths: readonly number[],
): (number | null)[] {
  if (profile.length === 0) return targetDepths.map(() => null);

  const shallowest = profile[0]!.depthM;
  const deepest = profile[profile.length - 1]!.depthM;

  return targetDepths.map((z) => {
    if (z < shallowest || z > deepest) return null;

    // Exact or bracketing search. Profiles here are <= a few hundred levels,
    // so a linear scan is fine and keeps the code obvious.
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i]!;
      const b = profile[i + 1]!;
      if (z === a.depthM) return a.value;
      if (z > a.depthM && z <= b.depthM) {
        const span = b.depthM - a.depthM;
        if (span === 0) return a.value;
        const f = (z - a.depthM) / span;
        return a.value + f * (b.value - a.value);
      }
    }
    return profile[profile.length - 1]!.value;
  });
}

/** Signed time difference in hours: observation time minus model time. */
export function calculateTimeOffsetHours(
  observationIso: string,
  modelIso: string,
): number {
  const obs = Date.parse(observationIso);
  const mod = Date.parse(modelIso);
  if (!Number.isFinite(obs) || !Number.isFinite(mod)) return Number.NaN;
  return (obs - mod) / 3_600_000;
}

export { haversineKm as calculateHaversineDistance };

export interface BandDefinition {
  readonly fromM: number;
  readonly toM: number;
}

export interface BandAgreement extends BandDefinition {
  readonly meanDelta: number;
  readonly rmse: number;
  readonly sampleCount: number;
  readonly verdict: 'High' | 'Fair' | 'Moderate' | 'Low';
}

/**
 * Per-depth-band agreement.
 *
 * `tolerance` is the acceptance threshold in the variable's own unit; the
 * verdict is the band RMSE expressed as a fraction of it. This keeps the
 * thresholds explicit and per-variable rather than hidden magic numbers.
 */
export function calculateBandAgreement(
  pairs: readonly Pair[],
  bands: readonly BandDefinition[],
  tolerance: number,
): BandAgreement[] {
  return bands.map((band) => {
    const inBand = pairs.filter((p) => p.depthM >= band.fromM && p.depthM <= band.toM);
    const obs = inBand.map((p) => p.observed);
    const mod = inBand.map((p) => p.modeled);
    const rmse = calculateRMSE(obs, mod);
    const meanDelta = calculateMeanBias(obs, mod);
    const rel = Number.isFinite(rmse) && tolerance > 0 ? rmse / tolerance : Number.POSITIVE_INFINITY;
    const verdict: BandAgreement['verdict'] =
      rel < 0.4 ? 'High' : rel < 0.8 ? 'Fair' : rel < 1.4 ? 'Moderate' : 'Low';
    return {
      ...band,
      meanDelta,
      rmse,
      sampleCount: inBand.length,
      verdict,
    };
  });
}

export interface InterpretationInput {
  readonly variableName: string;
  readonly unit: string;
  readonly biasWords: readonly [string, string];
  readonly structureName: string;
  readonly overallRmse: number;
  readonly overallBias: number;
  readonly bands: readonly BandAgreement[];
  readonly sampleCount: number;
}

/**
 * A deterministic plain-language reading of a comparison. Same input, same
 * sentence. No hedging language beyond what the numbers support.
 */
export function buildScientificInterpretation(input: InterpretationInput): string {
  const { unit, biasWords, structureName, overallRmse, overallBias, bands, sampleCount } = input;

  if (sampleCount === 0) {
    return 'No quality-controlled levels overlap between this profile and the model column, so no comparison can be made.';
  }

  const agreeBands = bands.filter((b) => b.verdict === 'High' || b.verdict === 'Fair');
  const poorBands = bands.filter((b) => b.verdict === 'Moderate' || b.verdict === 'Low');

  const parts: string[] = [];

  if (agreeBands.length > 0) {
    const deepestAgree = Math.max(...agreeBands.map((b) => b.toM));
    parts.push(
      `Observed and modelled profiles agree through ${deepestAgree} m ` +
        `(overall RMSE ${overallRmse.toFixed(2)} ${unit}).`,
    );
  } else {
    parts.push(`Observed and modelled profiles disagree at all depths (overall RMSE ${overallRmse.toFixed(2)} ${unit}).`);
  }

  if (poorBands.length > 0) {
    const worst = poorBands.reduce((a, b) => (Math.abs(b.meanDelta) > Math.abs(a.meanDelta) ? b : a));
    const dir = worst.meanDelta >= 0 ? biasWords[0] : biasWords[1];
    parts.push(
      `A ${dir} model bias of ${Math.abs(worst.meanDelta).toFixed(2)} ${unit} emerges over ` +
        `${worst.fromM}–${worst.toM} m, near the ${structureName}.`,
    );
  }

  const dirOverall = overallBias >= 0 ? biasWords[0] : biasWords[1];
  parts.push(`Mean bias ${overallBias >= 0 ? '+' : '−'}${Math.abs(overallBias).toFixed(2)} ${unit} (model ${dirOverall} than observed), n = ${sampleCount} levels.`);

  return parts.join(' ');
}

/** Nearest grid index for a coordinate on a regular ascending axis. */
export function nearestIndex(axis: readonly number[], value: number): number {
  if (axis.length === 0) return -1;
  let lo = 0;
  let hi = axis.length - 1;
  if (value <= axis[lo]!) return lo;
  if (value >= axis[hi]!) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (axis[mid]! < value) lo = mid;
    else hi = mid;
  }
  return value - axis[lo]! <= axis[hi]! - value ? lo : hi;
}

export interface CollocationGrid {
  readonly latitudes: readonly number[];
  readonly longitudes: readonly number[];
  readonly bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

export interface CollocationResultLite {
  readonly gridPoint: GeoPoint;
  readonly horizontalDistanceKm: number;
  readonly latIndex: number;
  readonly lonIndex: number;
  readonly withinGrid: boolean;
}

/**
 * Find the nearest model grid point to an observation and the real distance to
 * it. This is the spatial half of collocation; the caller pulls the model
 * column at (latIndex, lonIndex) and pairs it against the observed profile.
 */
export function collocateObservationToModel(
  observation: GeoPoint,
  grid: CollocationGrid,
): CollocationResultLite {
  const latIndex = nearestIndex(grid.latitudes, observation.latitude);
  const lonIndex = nearestIndex(grid.longitudes, observation.longitude);
  const gridPoint: GeoPoint = {
    latitude: grid.latitudes[latIndex] ?? Number.NaN,
    longitude: grid.longitudes[lonIndex] ?? Number.NaN,
  };
  const withinGrid =
    observation.latitude >= grid.bounds.minLat &&
    observation.latitude <= grid.bounds.maxLat &&
    observation.longitude >= grid.bounds.minLon &&
    observation.longitude <= grid.bounds.maxLon;
  return {
    gridPoint,
    horizontalDistanceKm: haversineKm(observation, gridPoint),
    latIndex,
    lonIndex,
    withinGrid,
  };
}
