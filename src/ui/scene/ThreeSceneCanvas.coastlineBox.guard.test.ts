/* Regression guard for the real-coastline + depth-box frame addition
 * (2026-09-12). Same rationale as ThreeSceneCanvas.contextLoss.test.ts:
 * this project's Vitest has no WebGL context, so a real render/dispose
 * cycle can't be exercised here — this is a source-level guard that the
 * groups this feature depends on are actually created, populated, and
 * disposed, so a future edit can't silently reintroduce a GPU resource
 * leak (the exact class of bug the WebGL-context-loss fix in this same
 * file was about) without a test failing. The actual visual behaviour was
 * verified in a real browser — see CLAUDE.md. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./ThreeSceneCanvas.tsx', import.meta.url)),
  'utf-8',
);

describe('coastline + depth-box groups are created, rebuilt, and disposed', () => {
  it('both groups are created once and added to the scene in the one-time setup effect', () => {
    expect(source).toMatch(/const coastlineGroup = new THREE\.Group\(\)/);
    expect(source).toMatch(/const boxGroup = new THREE\.Group\(\)/);
    expect(source).toMatch(/scene\.add\(coastlineGroup\)/);
    expect(source).toMatch(/scene\.add\(boxGroup\)/);
  });

  it('both groups are disposed on unmount, not just cleared', () => {
    const cleanup = source.match(/return \(\) => \{([\s\S]*?)\n {4}\};/)?.[1] ?? '';
    expect(cleanup).toMatch(/disposeGroupContents\(coastlineGroupRef\.current\)/);
    expect(cleanup).toMatch(/disposeGroupContents\(boxGroupRef\.current\)/);
  });

  it('the depth-box frame rebuilds on real bounds/exaggeration changes, using a FIXED max depth, not the currently selected one', () => {
    expect(source).toMatch(/MAX_BOX_DEPTH_M/);
    // the currently-selected depth (props.depthM) must NOT appear in the
    // box effect's own dependency array — only the plane/marker effects
    // should react to it, or the box would resize instead of staying a
    // fixed frame for the plane to move inside.
    const boxEffect = source.match(
      /rebuild the analysis-volume "box" frame[\s\S]*?\}, \[([\s\S]*?)\]\);/,
    )?.[1] ?? '';
    expect(boxEffect).not.toMatch(/props\.depthM/);
    expect(boxEffect).toMatch(/props\.exaggeration/);
  });

  it('the coastline rebuilds when the real coastline data or region bounds change, and never fabricates one when data is null', () => {
    const coastlineEffect = source.match(
      /rebuild the real coastline outline[\s\S]*?\}, \[([\s\S]*?)\]\);/,
    )?.[1] ?? '';
    expect(coastlineEffect).toMatch(/props\.coastline/);
    expect(coastlineEffect).toMatch(/props\.slice/);
    expect(source).toMatch(/if \(!coastline\) return;/);
  });
});
