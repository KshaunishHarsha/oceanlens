/* Ocean variables.
 *
 * `OceanVariable` is fixed by the project contract and is deliberately not
 * widened: these four are the depth-resolved fields that share a profile /
 * volume / collocation workflow.
 *
 * Layers that do NOT share that shape — satellite SST, advisories, ML anomaly
 * fields — are modelled as evidence layers instead (see `layers.ts`), because
 * forcing them through a depth-profile workflow would misrepresent them. */

export type OceanVariable =
  | 'temperature'
  | 'salinity'
  | 'currentSpeed'
  | 'chlorophyll';

export const OCEAN_VARIABLES: readonly OceanVariable[] = [
  'temperature',
  'salinity',
  'currentSpeed',
  'chlorophyll',
];

export type PaletteName = 'thermal' | 'haline' | 'speed' | 'algae';

export interface VariableMeta {
  readonly id: OceanVariable;
  /** Short symbol used in the control rail, e.g. "T", "U,V". */
  readonly abbr: string;
  /** Full display name, sentence case. */
  readonly name: string;
  /** Scientific unit as displayed. */
  readonly unit: string;
  /** CF standard name. Used for provenance and future CF-aware ingestion. */
  readonly cfStandardName: string;
  /** Canonical unit string in CF/UDUNITS form, for provenance display. */
  readonly cfUnit: string;
  /** Default colour-scale domain. Real data may narrow this at load. */
  readonly defaultRange: readonly [number, number];
  /** Decimal places for value display. */
  readonly decimals: number;
  readonly palette: PaletteName;
  /** CSS variable naming the ramp, for legends and chips. */
  readonly rampVar: string;
  /** Axis caption on the profile chart. */
  readonly axisLabel: string;
  /** Plain-language description for the outreach view. */
  readonly plainLanguage: string;
  /** Contour value the scene can trace as a derived isosurface. */
  readonly isoValue: number;
  /** Display name of that isosurface, e.g. "26 °C isotherm". */
  readonly isoName: string;
  /**
   * Comparative words for bias direction, as [positive, negative].
   * Bias convention throughout the product is `model - observation`.
   */
  readonly biasWords: readonly [string, string];
}

export const VARIABLES: Readonly<Record<OceanVariable, VariableMeta>> = {
  temperature: {
    id: 'temperature',
    abbr: 'T',
    name: 'Sea-water temperature',
    unit: '°C',
    cfStandardName: 'sea_water_temperature',
    cfUnit: 'degree_Celsius',
    defaultRange: [16, 30],
    decimals: 2,
    palette: 'thermal',
    rampVar: '--ramp-thermal',
    axisLabel: 'Temperature (°C)',
    plainLanguage: 'How warm the sea water is',
    isoValue: 26,
    isoName: '26 °C isotherm',
    biasWords: ['warmer', 'cooler'],
  },
  salinity: {
    id: 'salinity',
    abbr: 'S',
    name: 'Sea-water salinity',
    unit: 'PSU',
    cfStandardName: 'sea_water_salinity',
    cfUnit: 'psu (PSS-78)',
    defaultRange: [32, 35.5],
    decimals: 2,
    palette: 'haline',
    rampVar: '--ramp-haline',
    axisLabel: 'Salinity (PSU)',
    plainLanguage: 'How salty the sea water is',
    isoValue: 34.5,
    isoName: '34.5 PSU isohaline',
    biasWords: ['saltier', 'fresher'],
  },
  currentSpeed: {
    id: 'currentSpeed',
    abbr: 'U,V',
    name: 'Ocean current speed',
    unit: 'm/s',
    cfStandardName: 'sea_water_speed',
    cfUnit: 'm s-1',
    defaultRange: [0, 1.6],
    decimals: 2,
    palette: 'speed',
    rampVar: '--ramp-speed',
    axisLabel: 'Current speed (m/s)',
    plainLanguage: 'How fast the water is moving',
    isoValue: 0.6,
    isoName: '0.6 m/s jet core',
    biasWords: ['faster', 'slower'],
  },
  chlorophyll: {
    id: 'chlorophyll',
    abbr: 'Chl',
    name: 'Chlorophyll-a',
    unit: 'mg/m³',
    cfStandardName: 'mass_concentration_of_chlorophyll_a_in_sea_water',
    cfUnit: 'mg m-3',
    defaultRange: [0.02, 1.2],
    decimals: 3,
    palette: 'algae',
    rampVar: '--ramp-algae',
    axisLabel: 'Chlorophyll-a (mg/m³)',
    plainLanguage: 'How much microscopic plant life is in the water',
    isoValue: 0.3,
    isoName: '0.30 mg/m³ surface',
    biasWords: ['higher', 'lower'],
  },
};

export function variableMeta(v: OceanVariable): VariableMeta {
  return VARIABLES[v];
}

/**
 * Format a value with its variable's precision and unit.
 * Returns an em dash for absent values so tables never show "NaN" or "null".
 */
export function formatValue(
  v: OceanVariable,
  value: number | null | undefined,
  opts?: { withUnit?: boolean },
): string {
  const meta = VARIABLES[v];
  if (value == null || !Number.isFinite(value)) return '—';
  const n = value.toFixed(meta.decimals);
  return opts?.withUnit === false ? n : `${n} ${meta.unit}`;
}

/** Signed difference, using the product-wide `model - observation` convention. */
export function formatDelta(v: OceanVariable, value: number | null): string {
  const meta = VARIABLES[v];
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value).toFixed(meta.decimals)} ${meta.unit}`;
}

export const DELTA_CONVENTION = 'Δ = model − observation';
