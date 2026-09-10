#!/usr/bin/env node
/* Gate on the normalised real-data cache in public/data/real/.
 *
 *   node scripts/validate-real-data.mjs
 *
 * Exits non-zero (and prints every failure) if any of these hold:
 *   - a required variable / file is missing
 *   - units are missing or inconsistent with the domain model
 *   - a profile's depths are not strictly ascending
 *   - a coordinate falls outside the declared region
 *   - a timestamp cannot be parsed
 *   - per-level QC was silently discarded (profile has values but no QC arrays)
 *   - a source is classified real (REAL_CACHED / PRECOMPUTED_FROM_REAL) but
 *     carries no sourceUrl / retrievedAt / checksums
 *   - the model slice binary length disagrees with grid.json's shape
 *   - a model column's value array length disagrees with its depth axis
 *
 * This runs in CI-style: no network, reads only the committed cache. */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REGION } from './config.mjs';

const ROOT = 'public/data/real';
const problems = [];
const fail = (m) => problems.push(m);
const ok = (m) => console.log(`  ok  ${m}`);

/* ---- files present ---- */
const required = [
  'manifest.json',
  'model/grid.json',
  'model/temperature.f32',
  'model/salinity.f32',
  'model/columns.json',
  'observations/profiles.json',
];
for (const f of required) {
  if (!existsSync(join(ROOT, f))) fail(`missing required file: ${f}`);
}
if (problems.length) {
  console.error('\nVALIDATION FAILED (missing files):');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

const readJson = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const manifest = readJson('manifest.json');
const grid = readJson('model/grid.json');
const profiles = readJson('observations/profiles.json');
const columns = readJson('model/columns.json');

/* ---- manifest / provenance honesty ---- */
const REAL = new Set(['REAL_CACHED', 'PRECOMPUTED_FROM_REAL', 'DERIVED_FROM_REAL']);
for (const s of manifest.sources ?? []) {
  if (REAL.has(s.status)) {
    if (s.status !== 'DERIVED_FROM_REAL') {
      if (!s.sourceUrl) fail(`source "${s.id}" is ${s.status} but has no sourceUrl`);
      if (!s.retrievedAt) fail(`source "${s.id}" is ${s.status} but has no retrievedAt`);
      if (!s.checksums || Object.keys(s.checksums).length === 0)
        fail(`source "${s.id}" is ${s.status} but carries no checksums`);
    }
    if (!s.transformations || s.transformations.length === 0)
      fail(`source "${s.id}" is real but lists no transformations`);
  }
}
const FORBIDDEN = ['processing status: verified', 'verified source', 'live operational', 'incois real-time'];
const manifestText = JSON.stringify(manifest).toLowerCase();
for (const phrase of FORBIDDEN) {
  if (manifestText.includes(phrase)) fail(`manifest contains forbidden claim: "${phrase}"`);
}
if (!/^DEMO-/.test(manifest.viewId ?? '')) fail(`viewId "${manifest.viewId}" is not a DEMO- identifier`);
if (!manifest.windowLabel || /live|operational|real-time/i.test(manifest.windowLabel))
  fail(`windowLabel "${manifest.windowLabel}" must not imply live data`);

/* ---- grid + slice binaries ---- */
const { nt, nz, ny, nx } = grid.shape ?? {};
if (![nt, nz, ny, nx].every((n) => Number.isInteger(n) && n > 0)) fail('grid.shape is malformed');
if (grid.timestamps?.length !== nt) fail(`grid has ${grid.timestamps?.length} timestamps, shape says nt=${nt}`);
for (const t of grid.timestamps ?? []) {
  if (!Number.isFinite(Date.parse(t))) fail(`unparseable model timestamp: ${t}`);
}
const asc = (arr, name) => {
  for (let i = 1; i < arr.length; i++)
    if (!(arr[i] > arr[i - 1])) { fail(`${name} not strictly ascending at index ${i} (${arr[i - 1]} -> ${arr[i]})`); return; }
};
asc(grid.latitudes ?? [], 'grid.latitudes');
asc(grid.longitudes ?? [], 'grid.longitudes');
asc(grid.depthsM ?? [], 'grid.depthsM');

const expectFloats = nt * nz * ny * nx;
for (const v of ['temperature', 'salinity', 'currentU', 'currentV']) {
  const p = join(ROOT, `model/${v}.f32`);
  if (!existsSync(p)) {
    if (v === 'temperature' || v === 'salinity') fail(`missing model slice: ${v}.f32`);
    continue;
  }
  const bytes = statSync(p).size;
  if (bytes !== expectFloats * 4)
    fail(`${v}.f32 is ${bytes} bytes; grid shape implies ${expectFloats * 4}`);
  else ok(`${v}.f32 length matches grid shape (${expectFloats} floats)`);
}

/* ---- model column consistency ---- */
for (const c of columns) {
  if (!Array.isArray(c.depthsM) || c.depthsM.length === 0) { fail(`column ${c.observationId} has no depth axis`); continue; }
  for (const slot of c.byTimestamp ?? []) {
    if (!Number.isFinite(Date.parse(slot.timestamp))) fail(`column ${c.observationId}: bad timestamp ${slot.timestamp}`);
    for (const key of ['temperature', 'salinity']) {
      if (slot[key] && slot[key].length !== c.depthsM.length)
        fail(`column ${c.observationId} ${slot.timestamp}: ${key} length ${slot[key].length} != depths ${c.depthsM.length}`);
    }
  }
}
const colIds = new Set(columns.map((c) => c.observationId));

/* ---- observation profiles ---- */
if (!Array.isArray(profiles) || profiles.length === 0) fail('no observation profiles in cache');
let incois = 0;
for (const p of profiles) {
  if (!Number.isFinite(Date.parse(p.observedAt))) fail(`${p.id}: unparseable observedAt "${p.observedAt}"`);
  if (p.latitude < REGION.minLat || p.latitude > REGION.maxLat || p.longitude < REGION.minLon || p.longitude > REGION.maxLon)
    fail(`${p.id}: position ${p.latitude},${p.longitude} outside region`);
  // depths strictly ascending
  for (let i = 1; i < p.depthsM.length; i++)
    if (!(p.depthsM[i] > p.depthsM[i - 1])) { fail(`${p.id}: depths not ascending at ${i}`); break; }
  // parallel arrays
  const n = p.depthsM.length;
  for (const k of ['temperature', 'salinity', 'temperatureQc', 'salinityQc']) {
    if (!Array.isArray(p[k]) || p[k].length !== n) fail(`${p.id}: ${k} length ${p[k]?.length} != depths ${n}`);
  }
  // QC not silently dropped: if there are finite temps, there must be a QC verdict for them
  const finiteT = p.temperature.filter((v) => v != null && Number.isFinite(v)).length;
  const qcT = p.temperatureQc.filter((v) => v != null).length;
  if (finiteT > 0 && qcT === 0) fail(`${p.id}: has ${finiteT} temperature values but no per-level QC`);
  // every QC token is one of ours
  for (const f of [...p.temperatureQc, ...p.salinityQc]) {
    if (f != null && !['GOOD', 'PROBABLY_GOOD', 'SUSPECT', 'BAD'].includes(f))
      fail(`${p.id}: unknown QC token "${f}"`);
  }
  if (!p.identity || !p.identity.wmo) fail(`${p.id}: missing platform identity`);
  if (p.identity?.dataCentre === 'IN') incois++;
  if (!colIds.has(p.id)) fail(`${p.id}: no model column extracted for this profile`);
}

/* ---- units consistency with the domain model ---- */
const argoSrc = (manifest.sources ?? []).find((s) => s.id === 'argo.incois');
if (argoSrc) {
  if (argoSrc.sourceUnits?.TEMP !== 'degree_Celsius') fail(`Argo TEMP unit is "${argoSrc.sourceUnits?.TEMP}", expected degree_Celsius`);
  if (!/psu/i.test(argoSrc.sourceUnits?.PSAL ?? '')) fail(`Argo PSAL unit "${argoSrc.sourceUnits?.PSAL}" does not mention PSU`);
}
const tsSrc = (manifest.sources ?? []).find((s) => s.id === 'hycom.ts');
if (tsSrc) {
  if (tsSrc.sourceUnits?.water_temp !== 'degC') fail(`HYCOM water_temp unit is "${tsSrc.sourceUnits?.water_temp}", expected degC`);
}

/* ---- report ---- */
console.log(`\n  ${profiles.length} profiles (${incois} INCOIS), ${columns.length} model columns, ${nt} model timestamps`);
if (problems.length) {
  console.error('\nVALIDATION FAILED:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nVALIDATION PASSED — cache is internally consistent and honestly classified.');
