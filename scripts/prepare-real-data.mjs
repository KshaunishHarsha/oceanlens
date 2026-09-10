#!/usr/bin/env node
/* Prepare the OceanLens real-data cache.
 *
 *   node scripts/prepare-real-data.mjs [--argo] [--hycom] [--normalise]
 *
 * With no flag, runs all three stages in order:
 *   1. --argo       download real Argo profile files      -> .cache/raw/argo/
 *   2. --hycom      download real HYCOM T/S/U/V subsets    -> .cache/raw/hycom/
 *   3. --normalise  parse, unit-normalise, subset, and     -> public/data/real/
 *                   write the app cache + manifest
 *
 * .cache/raw/ is git-ignored. public/data/real/ IS committed and is the only
 * thing the browser ever reads. Re-running is idempotent: existing raw files
 * are kept, the normalised cache is rebuilt from scratch.
 *
 * Everything downloaded here is real, public, and unauthenticated. */

import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  openNetCDF, unpackVariable, pressureToDepthM, decodeCfTime, decodeJuld, sha256,
} from './lib/netcdf.mjs';
import { ARGO, DEMO_WINDOW, HYCOM, PATHS, REGION } from './config.mjs';

const args = new Set(process.argv.slice(2));
const runAll = !args.has('--argo') && !args.has('--hycom') && !args.has('--normalise');
const log = (...m) => console.log(...m);
const ensure = (d) => mkdirSync(d, { recursive: true });

/* ---------------------------------------------------------------- *
 * download helper — NCSS in particular is flaky, so retry with backoff
 * ---------------------------------------------------------------- */
function download(url, out, { minBytes = 1, expectMagic = null, retries = 5 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      execFileSync('curl', ['-sS', '--fail', '--max-time', '300', url, '-o', out], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      const size = statSync(out).size;
      const magic = readFileSync(out).subarray(0, 4).toString('hex');
      if (size >= minBytes && (!expectMagic || magic === expectMagic)) return size;
      log(`    attempt ${attempt}: size=${size} magic=${magic} — retrying`);
    } catch (e) {
      log(`    attempt ${attempt}: ${String(e.message).split('\n')[0].slice(0, 90)}`);
    }
    if (attempt < retries) execFileSync('sleep', [String(attempt * 4)]);
  }
  throw new Error(`failed to download ${url}`);
}

/* ================================================================ *
 * STAGE 1 — Argo
 * ================================================================ */
function stageArgo() {
  log('\n== Stage 1: Argo profile files ==');
  ensure(PATHS.rawArgo);
  let got = 0;
  for (const rel of ARGO.profileFiles) {
    const out = join(PATHS.rawArgo, rel.replace(/\//g, '_'));
    if (existsSync(out) && statSync(out).size > 5000) { got++; continue; }
    download(`${ARGO.gdacBase}/dac/${rel}`, out, { minBytes: 5000, expectMagic: '43444601' });
    got++;
  }
  log(`   ${got}/${ARGO.profileFiles.length} Argo files present`);
}

/* ================================================================ *
 * STAGE 2 — HYCOM
 * ================================================================ */
function stageHycom() {
  log('\n== Stage 2: HYCOM T/S/U/V subsets ==');
  ensure(PATHS.rawHycom);
  const { north, south, west, east } = HYCOM.bbox;
  const bbox = `north=${north}&south=${south}&west=${west}&east=${east}`;
  let got = 0, total = DEMO_WINDOW.timestamps.length * HYCOM.datasets.length;
  for (const ts of DEMO_WINDOW.timestamps) {
    const day = ts.slice(0, 10);
    for (const ds of HYCOM.datasets) {
      const out = join(PATHS.rawHycom, `${ds.key}_${day}.nc`);
      if (existsSync(out) && statSync(out).size > 100_000) { got++; continue; }
      const varq = ds.vars.map((v) => `var=${v}`).join('&');
      const url = `${HYCOM.ncssBase}/${ds.path}?${varq}&${bbox}&time=${day}T00:00:00Z&accept=netcdf`;
      log(`   ${ds.key} ${day} ...`);
      // A killed download can leave a valid header but a truncated body; a full
      // BoB T/S or U/V subset is ~7.5 MB, so anything under 5 MB is partial.
      const size = download(url, out, { minBytes: 5_000_000, expectMagic: '43444601' });
      log(`     ${(size / 1e6).toFixed(1)} MB`);
      got++;
    }
  }
  log(`   ${got}/${total} HYCOM files present`);
}

/* ================================================================ *
 * STAGE 3 — normalise
 * ================================================================ */

const OUR_QC = ARGO.qcMap;
const flagFor = (ch) => OUR_QC[ch] ?? null;
const worst = (flags) => {
  const order = ['GOOD', 'PROBABLY_GOOD', 'SUSPECT', 'BAD'];
  let w = -1;
  for (const f of flags) if (f) w = Math.max(w, order.indexOf(f));
  return w < 0 ? null : order[w];
};

function normaliseArgo() {
  log('\n== Stage 3a: normalise Argo ==');
  // Only the files the config declares — a raw file left over from an earlier
  // harvest of a now-excluded float must not creep back into the cache.
  const wanted = new Set(ARGO.profileFiles.map((f) => f.replace(/\//g, '_')));
  const files = readdirSync(PATHS.rawArgo)
    .filter((f) => f.endsWith('.nc') && wanted.has(f))
    .sort();
  const profiles = [];
  const checksums = {};

  for (const file of files) {
    const path = join(PATHS.rawArgo, file);
    checksums[file] = sha256(path);
    const h = openNetCDF(path);
    const { N_PROF, N_LEVELS } = h.dims;

    const lat = h.raw('LATITUDE');
    const lon = h.raw('LONGITUDE');
    const juld = h.raw('JULD');
    const cycle = h.raw('CYCLE_NUMBER');
    const wmo = h.stringAt('PLATFORM_NUMBER');
    const dac = h.stringAt('DATA_CENTRE');
    const mode = h.stringAt('DATA_MODE');
    const project = h.stringAt('PROJECT_NAME');
    const pi = h.stringAt('PI_NAME');
    const posSys = h.stringAt('POSITIONING_SYSTEM');
    const instType = h.stringAt('WMO_INST_TYPE');
    const posQc = h.stringAt('POSITION_QC');
    const vss = h.stringAt('VERTICAL_SAMPLING_SCHEME');
    const pTQC = h.stringAt('PROFILE_TEMP_QC');
    const pSQC = h.stringAt('PROFILE_PSAL_QC');

    const PRES = h.raw('PRES'); const PRESa = h.raw('PRES_ADJUSTED');
    const TEMP = h.raw('TEMP'); const TEMPa = h.raw('TEMP_ADJUSTED');
    const PSAL = h.raw('PSAL'); const PSALa = h.raw('PSAL_ADJUSTED');
    const pQC = h.raw('PRES_QC'); const pQCa = h.raw('PRES_ADJUSTED_QC');
    const tQC = h.raw('TEMP_QC'); const tQCa = h.raw('TEMP_ADJUSTED_QC');
    const sQC = h.raw('PSAL_QC'); const sQCa = h.raw('PSAL_ADJUSTED_QC');
    const FILL = 99999;

    // A profile file can hold several N_PROF records (primary + near-surface
    // sampling schemes). Keep, per file, the record with the most levels.
    let bestByPrimary = -1, bestCount = -1;
    for (let i = 0; i < N_PROF; i++) {
      let c = 0;
      for (let k = 0; k < N_LEVELS; k++) if (PRES[i * N_LEVELS + k] < FILL) c++;
      if (c > bestCount) { bestCount = c; bestByPrimary = i; }
    }
    const i = bestByPrimary;
    if (i < 0) continue;

    const useAdj =
      (mode(i) === 'D' || mode(i) === 'A') && TEMPa && TEMPa[i * N_LEVELS] < FILL;
    const P = useAdj ? PRESa : PRES;
    const T = useAdj ? TEMPa : TEMP;
    const S = useAdj ? PSALa : PSAL;
    const PQ = useAdj ? (pQCa ?? pQC) : pQC;
    const TQ = useAdj ? (tQCa ?? tQC) : tQC;
    const SQ = useAdj ? (sQCa ?? sQC) : sQC;

    const rows = [];
    for (let k = 0; k < N_LEVELS; k++) {
      const p = P[i * N_LEVELS + k];
      if (p == null || p >= FILL) continue;
      const presQc = flagFor(PQ?.[i * N_LEVELS + k]);
      if (presQc === 'BAD') continue; // unusable position on the axis
      const t = T[i * N_LEVELS + k];
      const s = S[i * N_LEVELS + k];
      rows.push({
        depthM: Number(pressureToDepthM(p, lat[i]).toFixed(2)),
        temperature: t != null && t < FILL ? Number(t.toFixed(4)) : null,
        salinity: s != null && s < FILL ? Number(s.toFixed(4)) : null,
        tQc: flagFor(TQ?.[i * N_LEVELS + k]),
        sQc: flagFor(SQ?.[i * N_LEVELS + k]),
      });
    }
    rows.sort((a, b) => a.depthM - b.depthM);
    // Real profiles occasionally repeat a pressure (or two samples round to the
    // same 0.01 m). Keep the first at each depth so the axis is strictly
    // ascending downstream; the dropped count goes into the manifest caveats.
    const deduped = [];
    let dropped = 0;
    for (const r of rows) {
      if (deduped.length && Math.abs(r.depthM - deduped[deduped.length - 1].depthM) < 1e-6) {
        dropped++;
        continue;
      }
      deduped.push(r);
    }
    rows.length = 0;
    rows.push(...deduped);
    if (dropped) log(`   ${file}: dropped ${dropped} duplicate-depth level(s)`);

    // Summary QC comes from Argo's own PROFILE_<PARAM>_QC letter, not the worst
    // single level — one flagged salinity sample should not brand a whole
    // profile "BAD". A/B/C/D-F map onto our four flags.
    const letterFlag = (letter) => {
      const L = String(letter).trim().toUpperCase();
      if (L === 'A') return 'GOOD';
      if (L === 'B') return 'PROBABLY_GOOD';
      if (L === 'C') return 'SUSPECT';
      if (L === 'D' || L === 'E' || L === 'F') return 'BAD';
      return null;
    };
    const summaryFlag =
      worst([letterFlag(pTQC(i)), letterFlag(pSQC(i))]) ??
      worst([worst(rows.map((r) => r.tQc)), worst(rows.map((r) => r.sQc))]) ??
      'BAD';

    if (rows.length === 0) {
      // A real profile whose every level failed QC (e.g. INCOIS 4903776 cycle 2,
      // all PRES_QC = 4). Keep it as a position/identity shell with a BAD
      // summary so the platform still appears, honestly flagged, rather than
      // silently vanishing.
      log(`   ${file}: 0 usable levels — retained as a QC-failed shell (${summaryFlag})`);
    }

    profiles.push({
      id: `ARGO-${wmo(i)}-${cycle[i]}`,
      platformType: 'ARGO',
      platformName: `ARGO ${wmo(i)}`,
      latitude: Number(lat[i].toFixed(4)),
      longitude: Number(lon[i].toFixed(4)),
      observedAt: decodeJuld(juld[i]),
      qc: summaryFlag,
      depthsM: rows.map((r) => r.depthM),
      temperature: rows.map((r) => r.temperature),
      salinity: rows.map((r) => r.salinity),
      temperatureQc: rows.map((r) => r.tQc),
      salinityQc: rows.map((r) => r.sQc),
      identity: {
        wmo: wmo(i),
        dataCentre: dac(i),
        cycleNumber: cycle[i],
        dataMode: mode(i) || null,
        projectName: project(i) || null,
        principalInvestigator: pi(i) || null,
        positioningSystem: posSys(i) || null,
        instrumentType: instType(i) || null,
        positionQc: flagFor(posQc(i)),
        verticalSamplingScheme: vss(i) || null,
        profileTempQcLetter: pTQC(i) || null,
        profilePsalQcLetter: pSQC(i) || null,
        usedAdjustedFields: useAdj,
        sourceFile: file,
      },
    });
  }

  profiles.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  log(`   ${profiles.length} profiles from ${files.length} files`);
  log(`   INCOIS: ${profiles.filter((p) => p.identity.dataCentre === 'IN').length}`);
  log(`   delayed-mode: ${profiles.filter((p) => p.identity.dataMode === 'D').length}`);
  return { profiles, checksums };
}

function normaliseHycom() {
  log('\n== Stage 3b: normalise HYCOM ==');
  const stride = HYCOM.sliceStride;
  const wantDepths = HYCOM.sliceDepthsM;
  const checksums = {};
  const timestamps = [];

  // axes come from the first ts file; every file shares them
  const first = openNetCDF(join(PATHS.rawHycom, `ts_${DEMO_WINDOW.timestamps[0].slice(0, 10)}.nc`));
  const latAll = Array.from(first.raw('lat'));
  const lonAll = Array.from(first.raw('lon'));
  const depthAll = Array.from(first.raw('depth'));

  const latIdx = [];
  for (let j = 0; j < latAll.length; j += stride) latIdx.push(j);
  const lonIdx = [];
  for (let i = 0; i < lonAll.length; i += stride) lonIdx.push(i);
  const depthIdx = wantDepths.map((d) => {
    let best = 0;
    for (let k = 1; k < depthAll.length; k++) {
      if (Math.abs(depthAll[k] - d) < Math.abs(depthAll[best] - d)) best = k;
    }
    return best;
  });
  const keptDepths = depthIdx.map((k) => depthAll[k]);
  const latitudes = latIdx.map((j) => Number(latAll[j].toFixed(4)));
  const longitudes = lonIdx.map((i) => Number(lonAll[i].toFixed(4)));

  const nx = lonIdx.length, ny = latIdx.length, nz = depthIdx.length;
  const nt = DEMO_WINDOW.timestamps.length;

  /** var -> Float32Array [t][z][y][x], NaN for land/missing. */
  const slices = {
    temperature: new Float32Array(nt * nz * ny * nx),
    salinity: new Float32Array(nt * nz * ny * nx),
    currentU: new Float32Array(nt * nz * ny * nx),
    currentV: new Float32Array(nt * nz * ny * nx),
  };
  let haveCurrents = true;

  /** full-resolution model columns at every observation position. Filled by the
   *  caller after Argo is normalised (positions needed). Here just build slices. */

  for (let t = 0; t < nt; t++) {
    const day = DEMO_WINDOW.timestamps[t].slice(0, 10);
    const tsPath = join(PATHS.rawHycom, `ts_${day}.nc`);
    const uvPath = join(PATHS.rawHycom, `uv_${day}.nc`);
    const ts = openNetCDF(tsPath);
    checksums[`ts_${day}.nc`] = sha256(tsPath);
    const tv = ts.nc.variables.find((v) => v.name === 'time');
    timestamps.push(decodeCfTime(ts.raw('time')[0], ts.attr('time', 'units') ?? tv?.attributes?.[0]?.value));

    const fullNx = lonAll.length, fullNy = latAll.length;
    const temp = unpackVariable(ts, 'water_temp');
    const salt = unpackVariable(ts, 'salinity');

    let u = null, v = null;
    if (existsSync(uvPath)) {
      const uv = openNetCDF(uvPath);
      checksums[`uv_${day}.nc`] = sha256(uvPath);
      u = unpackVariable(uv, 'water_u');
      v = unpackVariable(uv, 'water_v');
    } else {
      haveCurrents = false;
    }

    for (let zk = 0; zk < nz; zk++) {
      const kFull = depthIdx[zk];
      for (let yj = 0; yj < ny; yj++) {
        const jFull = latIdx[yj];
        for (let xi = 0; xi < nx; xi++) {
          const iFull = lonIdx[xi];
          const src = kFull * fullNy * fullNx + jFull * fullNx + iFull;
          const dst = ((t * nz + zk) * ny + yj) * nx + xi;
          const tv2 = temp[src];
          const sv = salt[src];
          slices.temperature[dst] = tv2 == null ? Number.NaN : tv2;
          slices.salinity[dst] = sv == null ? Number.NaN : sv;
          if (u && v) {
            const uv2 = u[src], vv2 = v[src];
            slices.currentU[dst] = uv2 == null ? Number.NaN : uv2;
            slices.currentV[dst] = vv2 == null ? Number.NaN : vv2;
          } else {
            slices.currentU[dst] = Number.NaN;
            slices.currentV[dst] = Number.NaN;
          }
        }
      }
    }
    log(`   ${day}: ts${existsSync(uvPath) ? ' + uv' : ''} folded in`);
  }

  return {
    grid: { latitudes, longitudes, depthsM: keptDepths, timestamps, nx, ny, nz, nt },
    slices,
    haveCurrents,
    checksums,
    // keep the native axes for column extraction
    native: { latAll, lonAll, depthAll },
  };
}

/** Full-resolution model columns (all native depths) at each observation. */
function extractColumns(profiles, hycom) {
  log('\n== Stage 3c: model columns at observation positions ==');
  const { latAll, lonAll, depthAll } = hycom.native;
  const nearest = (axis, val) => {
    let b = 0;
    for (let k = 1; k < axis.length; k++) if (Math.abs(axis[k] - val) < Math.abs(axis[b] - val)) b = k;
    return b;
  };
  const fullNx = lonAll.length, fullNy = latAll.length;

  // cache unpacked temp/salt per day so we don't re-read
  const dayCache = new Map();
  const readDay = (day) => {
    if (dayCache.has(day)) return dayCache.get(day);
    const ts = openNetCDF(join(PATHS.rawHycom, `ts_${day}.nc`));
    const uvPath = join(PATHS.rawHycom, `uv_${day}.nc`);
    const rec = {
      temperature: unpackVariable(ts, 'water_temp'),
      salinity: unpackVariable(ts, 'salinity'),
      currentU: null, currentV: null,
    };
    if (existsSync(uvPath)) {
      const uv = openNetCDF(uvPath);
      rec.currentU = unpackVariable(uv, 'water_u');
      rec.currentV = unpackVariable(uv, 'water_v');
    }
    dayCache.set(day, rec);
    return rec;
  };

  const columns = [];
  for (const p of profiles) {
    const jFull = nearest(latAll, p.latitude);
    const iFull = nearest(lonAll, p.longitude);
    const perTime = hycom.grid.timestamps.map((tsIso) => {
      const day = tsIso.slice(0, 10);
      const rec = readDay(day);
      const pick = (arr) =>
        arr
          ? depthAll.map((_, k) => {
              const val = arr[k * fullNy * fullNx + jFull * fullNx + iFull];
              return val == null || !Number.isFinite(val) ? null : Number(val.toFixed(4));
            })
          : null;
      return {
        timestamp: tsIso,
        temperature: pick(rec.temperature),
        salinity: pick(rec.salinity),
        currentU: pick(rec.currentU),
        currentV: pick(rec.currentV),
      };
    });
    columns.push({
      observationId: p.id,
      gridLatitude: Number(latAll[jFull].toFixed(4)),
      gridLongitude: Number(lonAll[iFull].toFixed(4)),
      depthsM: depthAll,
      byTimestamp: perTime,
    });
  }
  log(`   ${columns.length} columns, ${depthAll.length} native levels each`);
  return columns;
}

function writeFloat32(path, arr) {
  writeFileSync(path, Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
}

function stageNormalise() {
  log('\n== Stage 3: normalise -> public/data/real ==');
  if (existsSync(PATHS.outRoot)) rmSync(PATHS.outRoot, { recursive: true });
  ensure(PATHS.outModel);
  ensure(PATHS.outObs);

  const { profiles, checksums: argoSums } = normaliseArgo();
  const hycom = normaliseHycom();
  const columns = extractColumns(profiles, hycom);

  // model grid + slices
  writeFileSync(
    join(PATHS.outModel, 'grid.json'),
    JSON.stringify(
      {
        latitudes: hycom.grid.latitudes,
        longitudes: hycom.grid.longitudes,
        depthsM: hycom.grid.depthsM,
        timestamps: hycom.grid.timestamps,
        shape: { nt: hycom.grid.nt, nz: hycom.grid.nz, ny: hycom.grid.ny, nx: hycom.grid.nx },
        layout: '[t][z][y][x] Float32LE, NaN = land/missing, row 0 = southernmost lat',
      },
      null,
      1,
    ),
  );
  for (const [v, arr] of Object.entries(hycom.slices)) {
    if (v.startsWith('current') && !hycom.haveCurrents) continue;
    writeFloat32(join(PATHS.outModel, `${v}.f32`), arr);
  }

  writeFileSync(
    join(PATHS.outObs, 'profiles.json'),
    JSON.stringify(profiles, null, 1),
  );
  writeFileSync(
    join(PATHS.outModel, 'columns.json'),
    JSON.stringify(columns, null, 1),
  );

  // manifest
  const manifest = buildManifest({ profiles, hycom, argoSums, haveCurrents: hycom.haveCurrents });
  writeFileSync(PATHS.manifest, JSON.stringify(manifest, null, 2));

  log('\n   wrote:');
  for (const f of readdirSync(PATHS.outModel)) log(`     model/${f}  ${(statSync(join(PATHS.outModel, f)).size / 1024).toFixed(0)} KB`);
  for (const f of readdirSync(PATHS.outObs)) log(`     observations/${f}  ${(statSync(join(PATHS.outObs, f)).size / 1024).toFixed(0)} KB`);
  log(`     manifest.json`);
}

function buildManifest({ profiles, hycom, argoSums, haveCurrents }) {
  const now = new Date().toISOString();
  const incois = profiles.filter((p) => p.identity.dataCentre === 'IN');
  const argoUrls = ARGO.profileFiles.map((f) => `${ARGO.gdacBase}/dac/${f}`);

  const argoSource = {
    id: 'argo.incois',
    datasetName: 'Argo global profiles — INCOIS & partner floats, Bay of Bengal',
    originator: 'International Argo Program; INCOIS (Indian Argo Project) and partners',
    status: 'REAL_CACHED',
    sourceUrl: `${ARGO.gdacBase}/dac/`,
    sourceFiles: ARGO.profileFiles.map((f) => f.split('/').pop()),
    sourceFileUrls: argoUrls,
    retrievedAt: now,
    checksums: argoSums,
    sourceVariables: ['PRES', 'TEMP', 'PSAL', 'PRES_ADJUSTED', 'TEMP_ADJUSTED', 'PSAL_ADJUSTED', '*_QC'],
    sourceUnits: { PRES: 'decibar', TEMP: 'degree_Celsius', PSAL: 'psu (PSS-78)' },
    coordinateSystem: 'WGS84 lat/lon; pressure decibar converted to depth (m, positive down) via UNESCO 1983',
    temporal: { start: DEMO_WINDOW.start, end: DEMO_WINDOW.end, cadence: 'per float cycle (~10 day), one profile per file' },
    depth: { minM: 0, maxM: 2010, levels: 'irregular, per float (37–242 usable levels)' },
    spatial: { minLat: REGION.minLat, maxLat: REGION.maxLat, minLon: REGION.minLon, maxLon: REGION.maxLon, resolution: 'irregular (float positions)' },
    qcConvention: 'Argo QC flag scale: 1 good, 2 probably good, 3 suspect, 4 bad, 5 changed, 8 interpolated, 9 missing. Delayed-mode (D) files use adjusted fields with their own QC.',
    transformations: [
      'Selected profile files by ar_index_global_prof.txt filtered to the demo window and region',
      'Per file, kept the N_PROF record with the most pressure levels (primary vertical sampling scheme)',
      'Used *_ADJUSTED fields where DATA_MODE is D or A and adjusted values are present',
      'Converted PRES (decibar) to depth (m) via UNESCO 1983, latitude-dependent',
      'Dropped levels with PRES_QC = 4 (bad)',
      'Mapped per-level QC to GOOD/PROBABLY_GOOD/SUSPECT/BAD; retained original per level',
      'Sorted levels shallow-to-deep',
    ],
    licence: 'Argo data are freely available (https://argo.ucsd.edu). Please acknowledge the Argo Program and the national programmes that contribute floats.',
    caveats: [
      `${incois.length} of ${profiles.length} profiles are INCOIS (DATA_CENTRE = IN); the rest are China Argo (DATA_CENTRE = HZ).`,
      'All included profiles are delayed-mode (DATA_MODE = D) and use adjusted fields.',
      'One profile (ARGO-4903776-2) has PROFILE_TEMP_QC = F: every level failed quality control. It is retained as a position/identity record with a BAD summary flag rather than hidden.',
      'Float 4903775 cycle 2 reports no data above ~184 m (genuine instrument behaviour).',
      'Duplicate-pressure levels are collapsed to keep each depth axis strictly ascending.',
    ],
  };

  const hycomBase = {
    originator: 'HYCOM Consortium / Naval Oceanographic Office (GOFS 3.1, GLBy0.08 expt_93.0)',
    status: 'PRECOMPUTED_FROM_REAL',
    coordinateSystem: 'WGS84 lat/lon on a 0.04° x 0.08° grid; depth (m, positive down), 40 z-levels',
    temporal: { start: DEMO_WINDOW.start, end: DEMO_WINDOW.end, cadence: 'daily snapshot at 00:00 UTC (native archive is 3-hourly)' },
    spatial: { minLat: HYCOM.bbox.south, maxLat: HYCOM.bbox.north, minLon: HYCOM.bbox.west, maxLon: HYCOM.bbox.east, resolution: `~${(0.08 * hycom.grid && HYCOM.sliceStride * 0.08).toFixed?.(2) ?? '0.24'}° in the slice cache; native in the column cache` },
    qcConvention: 'HYCOM analysis fields carry no per-cell QC; _FillValue -30000 marks land / below-bathymetry.',
    licence: 'Approved for public release; distribution unlimited (per file global attributes).',
  };

  const tsSource = {
    ...hycomBase,
    id: 'hycom.ts',
    datasetName: 'HYCOM GOFS 3.1 temperature & salinity — Bay of Bengal subset',
    sourceUrl: `${HYCOM.ncssBase}/ts3z`,
    sourceFiles: DEMO_WINDOW.timestamps.map((t) => `ts_${t.slice(0, 10)}.nc`),
    retrievedAt: now,
    checksums: Object.fromEntries(Object.entries(hycom.checksums).filter(([k]) => k.startsWith('ts_'))),
    sourceVariables: ['water_temp', 'salinity'],
    sourceUnits: { water_temp: 'degC', salinity: 'psu' },
    depth: { minM: 0, maxM: 1000, levels: `${HYCOM.sliceDepthsM.length} in slice cache; 40 native in column cache` },
    transformations: [
      `NCSS subset: bbox N${HYCOM.bbox.north}/S${HYCOM.bbox.south}/W${HYCOM.bbox.west}/E${HYCOM.bbox.east}, one file per day at 00:00 UTC, accept=netcdf (classic)`,
      'Unpacked short -> float via scale_factor 0.001, add_offset 20; _FillValue -30000 -> NaN',
      `Slice cache: decimated horizontally by stride ${HYCOM.sliceStride}, kept ${HYCOM.sliceDepthsM.length} depth levels`,
      'Column cache: nearest native grid column at each observation position, all 40 depth levels, all timestamps',
      'Depth already positive-down in source; no reorientation needed',
    ],
    caveats: [
      'Daily snapshots, not the observation instant. The true model-minus-observation time offset is computed and shown per collocation.',
      'Slice cache is decimated for rendering; all statistics use the native-resolution column cache.',
    ],
  };

  const uvSource = haveCurrents
    ? {
        ...hycomBase,
        id: 'hycom.uv',
        datasetName: 'HYCOM GOFS 3.1 u/v currents — Bay of Bengal subset',
        sourceUrl: `${HYCOM.ncssBase}/uv3z`,
        sourceFiles: DEMO_WINDOW.timestamps.map((t) => `uv_${t.slice(0, 10)}.nc`),
        retrievedAt: now,
        checksums: Object.fromEntries(Object.entries(hycom.checksums).filter(([k]) => k.startsWith('uv_'))),
        sourceVariables: ['water_u', 'water_v'],
        sourceUnits: { water_u: 'm/s', water_v: 'm/s' },
        depth: { minM: 0, maxM: 1000, levels: `${HYCOM.sliceDepthsM.length} in slice cache; 40 native in column cache` },
        transformations: tsSource.transformations,
        caveats: ['Current speed shown is sqrt(u^2 + v^2) derived from the real u/v fields.'],
      }
    : {
        id: 'hycom.uv',
        datasetName: 'HYCOM GOFS 3.1 u/v currents',
        originator: hycomBase.originator,
        status: 'NOT_AVAILABLE_MVP',
        sourceUrl: `${HYCOM.ncssBase}/uv3z`,
        sourceFiles: [],
        retrievedAt: null,
        checksums: {},
        sourceVariables: ['water_u', 'water_v'],
        sourceUnits: {},
        coordinateSystem: '—',
        temporal: null,
        depth: null,
        spatial: null,
        qcConvention: null,
        transformations: [],
        licence: null,
        caveats: ['uv3z subset could not be retrieved reliably during preparation; currents are disabled in the MVP.'],
      };

  return {
    title: 'OceanLens India — real-data cache',
    demonstrationWindow: { start: DEMO_WINDOW.start, end: DEMO_WINDOW.end },
    windowLabel: DEMO_WINDOW.label,
    region: { minLat: REGION.minLat, maxLat: REGION.maxLat, minLon: REGION.minLon, maxLon: REGION.maxLon },
    regionName: REGION.name,
    viewId: 'DEMO-OCN-2023-0925-BB',
    generatedAt: now,
    counts: {
      argoProfiles: profiles.length,
      incoisProfiles: incois.length,
      delayedModeProfiles: profiles.filter((p) => p.identity.dataMode === 'D').length,
      modelTimestamps: hycom.grid.timestamps.length,
      modelDepthsSlice: hycom.grid.nz,
      modelColumns: profiles.length,
      currentsAvailable: haveCurrents,
    },
    sources: [argoSource, tsSource, uvSource],
  };
}

/* ================================================================ */
try {
  if (runAll || args.has('--argo')) stageArgo();
  if (runAll || args.has('--hycom')) stageHycom();
  if (runAll || args.has('--normalise')) stageNormalise();
  log('\nDone.');
} catch (e) {
  console.error('\nprepare-real-data failed:', e.message);
  process.exit(1);
}
