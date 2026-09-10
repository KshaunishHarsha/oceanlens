/* Single source of truth for the real-data harvest and the demonstration window.
 *
 * The window was chosen after harvesting candidate dates in late Aug / early
 * Sep 2023 (see docs/data-provenance.md). Late September 2023 is when the Bay
 * of Bengal has the densest real INCOIS Argo coverage that also falls inside
 * HYCOM expt_93.0's time span (2018-12-04 .. 2024-09-05).
 *
 * This is a HISTORICAL window. Nothing in the product implies the model or the
 * observations are live. */

export const DEMO_WINDOW = {
  start: '2023-09-25T00:00:00Z',
  end: '2023-10-05T00:00:00Z',
  label: 'Historical demonstration window',
  /** Daily model snapshots at 00:00 UTC. */
  timestamps: [
    '2023-09-25T00:00:00Z',
    '2023-09-26T00:00:00Z',
    '2023-09-27T00:00:00Z',
    '2023-09-28T00:00:00Z',
    '2023-09-29T00:00:00Z',
    '2023-09-30T00:00:00Z',
    '2023-10-01T00:00:00Z',
    '2023-10-02T00:00:00Z',
    '2023-10-03T00:00:00Z',
    '2023-10-04T00:00:00Z',
    '2023-10-05T00:00:00Z',
  ],
};

/** Analysis region. Matches the artboard's stated volume (11–20°N, 82–92°E),
 *  slightly padded so edge floats still collocate. */
export const REGION = {
  minLat: 8,
  maxLat: 20.5,
  minLon: 81,
  maxLon: 93,
  name: 'Bay of Bengal',
};

/* -------------------------------------------------------------------------- *
 * Argo
 * -------------------------------------------------------------------------- */

export const ARGO = {
  gdacBase: 'https://data-argo.ifremer.fr',
  /** Exact profile files, resolved from ar_index_global_prof.txt for the window
   *  and region. "D" = delayed-mode (best QC), "R" = real-time. */
  profileFiles: [
    'incois/1902669/profiles/D1902669_002.nc',
    'incois/2903891/profiles/D2903891_002.nc',
    'incois/4903775/profiles/D4903775_002.nc',
    'incois/4903776/profiles/D4903776_002.nc',
    'incois/5907082/profiles/D5907082_002.nc',
    'incois/5907083/profiles/D5907083_002.nc',
    'incois/6990608/profiles/D6990608_001.nc',
    'incois/6990608/profiles/D6990608_002.nc',
    'incois/6990608/profiles/D6990608_003.nc',
    'incois/6990608/profiles/D6990608_004.nc',
    'incois/6990608/profiles/D6990608_005.nc',
    'incois/6990608/profiles/D6990608_006.nc',
    'incois/6990608/profiles/D6990608_007.nc',
    'incois/6990608/profiles/D6990608_008.nc',
    'incois/6990608/profiles/D6990608_009.nc',
    'incois/6990609/profiles/D6990609_002.nc',
    'incois/7901125/profiles/D7901125_002.nc',
    'incois/7901126/profiles/D7901126_002.nc',
    'incois/7901127/profiles/D7901127_002.nc',
    'csio/2902765/profiles/D2902765_134.nc',
    'csio/2902766/profiles/D2902766_136.nc',
    'csio/2902766/profiles/D2902766_137.nc',
    'csio/2902768/profiles/D2902768_133.nc',
    'csio/2902768/profiles/D2902768_134.nc',
    'csio/2902770/profiles/D2902770_132.nc',
    'csio/2902770/profiles/D2902770_133.nc',
    'csio/2902772/profiles/D2902772_132.nc',
    'csio/2902772/profiles/D2902772_133.nc',
    // coriolis/1902594 (French real-time float) is intentionally excluded: its
    // R-mode files carry no adjusted fields and a merged multi-scheme level
    // axis that does not normalise cleanly. 27 delayed-mode profiles (18
    // INCOIS) remain, which is ample for the demonstration.
  ],
  /** Argo real-time QC flag -> our QualityFlag. Verified against real files. */
  qcMap: { 1: 'GOOD', 2: 'PROBABLY_GOOD', 3: 'SUSPECT', 4: 'BAD' },
};

/* -------------------------------------------------------------------------- *
 * HYCOM (GOFS 3.1 GLBy0.08 expt_93.0)
 * -------------------------------------------------------------------------- */

export const HYCOM = {
  ncssBase: 'https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0',
  datasets: [
    { path: 'ts3z', vars: ['water_temp', 'salinity'], key: 'ts' },
    { path: 'uv3z', vars: ['water_u', 'water_v'], key: 'uv' },
  ],
  /** NCSS bbox. Slightly wider than REGION so interpolation has a margin. */
  bbox: { north: 20.5, south: 8, west: 81, east: 93 },
  varMap: {
    water_temp: 'temperature',
    salinity: 'salinity',
    water_u: 'currentU',
    water_v: 'currentV',
  },
  /** Depths kept in the normalised slice cache (m). The renderer only needs
   *  these; full-resolution columns at float positions keep all 40 levels. */
  sliceDepthsM: [0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
  /** Horizontal decimation of the slice cache. 1 = native (~0.04°/0.08°). */
  sliceStride: 3,
};

/* -------------------------------------------------------------------------- *
 * Local paths
 * -------------------------------------------------------------------------- */

export const PATHS = {
  rawArgo: '.cache/raw/argo',
  rawHycom: '.cache/raw/hycom',
  outRoot: 'public/data/real',
  outModel: 'public/data/real/model',
  outObs: 'public/data/real/observations',
  manifest: 'public/data/real/manifest.json',
  provenanceDoc: 'docs/data-provenance.md',
};
