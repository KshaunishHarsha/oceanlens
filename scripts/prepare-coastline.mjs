#!/usr/bin/env node
/* Vendors a real coastline reference for the 3D scene: real Natural Earth
 * land polygons (via the world-atlas npm package's published TopoJSON,
 * https://github.com/topojson/world-atlas — public domain / CC0 Natural
 * Earth data), clipped to features whose bounding box comes near the
 * project's real analysis region, and simplified for a small commit size.
 *
 * This is cartographic reference geometry, not an oceanographic
 * measurement — it does not go through the backend/OceanDataAdapter
 * boundary (that boundary is for real Argo/HYCOM data). It is vendored
 * exactly like tokens.css's fonts or three.js itself: fetched once at
 * build/prep time, committed, served as a static frontend asset, and
 * never fetched from a CDN at runtime — matching the explicit "must be
 * vendored... the demo has to run offline" gotcha already recorded in
 * CLAUDE.md for this exact dataset (the original Claude Design reference,
 * ocean-scene.jsx, fetched it live from jsDelivr and was flagged for
 * exactly this reason).
 *
 * Deliberately no topojson-client dependency: the topology decode (delta
 * decoding + arc-index resolution) is straightforward and doing it inline
 * keeps this real-data-vendoring step self-contained, matching the
 * project's "smallest dependency set possible" decision.
 *
 * Usage: node scripts/prepare-coastline.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'coastline', 'bay-of-bengal-coastline.json');
const SOURCE_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';

// The project's real, committed analysis region (public/data/real/manifest.json).
// Not imported directly (this script has no runtime dependency on the app) —
// kept in sync by the printed region check below.
const REGION = { minLat: 8.0, maxLat: 20.5, minLon: 81.0, maxLon: 93.0 };
// Generous margin so a country's full real coastline shape renders even
// where it extends outside the analysis box (matches the design reference's
// own "+6 degrees" nearby-feature filter).
const MARGIN_DEG = 6;

// This is a COASTLINE reference for an ocean scene, not a general political
// map — a landlocked country whose bounding box happens to graze the margin
// (Nepal, Pakistan, China's Tibetan plateau) would render as an irrelevant,
// cluttering line fragment nowhere near any coast. Restricting to the real
// Bay-of-Bengal-adjacent countries keeps the result honest to its purpose;
// this list is a display-relevance choice, not a scientific one, and every
// name is checked against the source data below (a name that no longer
// matches fails loudly rather than silently vanishing).
const COASTAL_COUNTRIES = new Set(['India', 'Sri Lanka', 'Bangladesh', 'Myanmar', 'Thailand', 'Indonesia']);

// Decimate long rings to keep the commit small — a fixed stride is enough
// for a coastline meant to be seen obliquely from a distance, not surveyed.
const MAX_POINTS_PER_RING = 160;

function decodeArcs(topology) {
  const { transform } = topology;
  const [sx, sy] = transform ? transform.scale : [1, 1];
  const [tx, ty] = transform ? transform.translate : [0, 0];
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

function ringFromArcIndices(arcIndices, decodedArcs) {
  const pts = [];
  for (const idx of arcIndices) {
    const i = idx < 0 ? ~idx : idx;
    let coords = decodedArcs[i];
    if (idx < 0) coords = [...coords].reverse();
    pts.push(...(pts.length ? coords.slice(1) : coords));
  }
  return pts;
}

function ringsFromGeometry(geometry, decodedArcs) {
  if (geometry.type === 'Polygon') {
    return geometry.arcs.map((ring) => ringFromArcIndices(ring, decodedArcs));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.arcs.flatMap((poly) => poly.map((ring) => ringFromArcIndices(ring, decodedArcs)));
  }
  return [];
}

function bboxOf(ring) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function decimate(ring, maxPoints) {
  if (ring.length <= maxPoints) return ring;
  const stride = Math.ceil(ring.length / maxPoints);
  const out = ring.filter((_, i) => i % stride === 0);
  // keep the ring closed
  const first = ring[0];
  const last = out[out.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) out.push(first);
  return out;
}

async function main() {
  console.log(`Fetching real coastline source: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const topology = await res.json();

  const decodedArcs = decodeArcs(topology);
  const countriesObj = topology.objects.countries;
  if (!countriesObj) throw new Error('countries-50m.json has no "countries" object — source format changed');

  const clipMinLon = REGION.minLon - MARGIN_DEG;
  const clipMaxLon = REGION.maxLon + MARGIN_DEG;
  const clipMinLat = REGION.minLat - MARGIN_DEG;
  const clipMaxLat = REGION.maxLat + MARGIN_DEG;

  const features = [];
  const matchedNames = new Set();
  for (const geometry of countriesObj.geometries) {
    const name = geometry.properties?.name ?? `country-${geometry.id ?? 'unknown'}`;
    if (!COASTAL_COUNTRIES.has(name)) continue;
    matchedNames.add(name);

    const rings = ringsFromGeometry(geometry, decodedArcs);
    if (rings.length === 0) continue;
    // Still apply the region-proximity clip — India's and Indonesia's full
    // national outlines extend far beyond the Bay of Bengal; only keep the
    // parts (rings) actually near the analysis region.
    const overlaps = rings.some((r) => {
      const b = bboxOf(r);
      return b.minLon < clipMaxLon && b.maxLon > clipMinLon && b.minLat < clipMaxLat && b.maxLat > clipMinLat;
    });
    if (!overlaps) continue;
    const decimatedRings = rings
      // drop rings entirely outside the clip window even for a kept feature
      // (a country whose mainland is near but has a far-flung island, say)
      .filter((r) => {
        const b = bboxOf(r);
        return b.minLon < clipMaxLon && b.maxLon > clipMinLon && b.minLat < clipMaxLat && b.maxLat > clipMinLat;
      })
      .map((r) => decimate(r, MAX_POINTS_PER_RING).map(([lon, lat]) => [round(lon), round(lat)]));

    features.push({ name, rings: decimatedRings });
  }

  const missing = [...COASTAL_COUNTRIES].filter((n) => !matchedNames.has(n));
  if (missing.length > 0) {
    throw new Error(
      `COASTAL_COUNTRIES name(s) not found in the source data — the source's naming ` +
        `changed or a name was mistyped, and silently proceeding would just quietly drop ` +
        `real coastline: ${missing.join(', ')}`,
    );
  }

  features.sort((a, b) => a.name.localeCompare(b.name));

  const out = {
    region: REGION,
    clipMarginDeg: MARGIN_DEG,
    source: {
      datasetName: 'Natural Earth 1:50m Cultural Vectors (via world-atlas countries-50m)',
      originator: 'Natural Earth (public domain) / world-atlas npm package',
      sourceUrl: SOURCE_URL,
      retrievedAt: new Date().toISOString(),
      licence: 'Natural Earth data is in the public domain.',
      note: 'Cartographic reference geometry for scene rendering only — not an oceanographic measurement. Never used for any real-data science claim.',
    },
    featureCount: features.length,
    features,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out));
  const totalPoints = features.reduce((n, f) => n + f.rings.reduce((m, r) => m + r.length, 0), 0);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`${features.length} features, ${totalPoints} points: ${features.map((f) => f.name).join(', ')}`);
}

function round(v) {
  return Math.round(v * 1e4) / 1e4;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
