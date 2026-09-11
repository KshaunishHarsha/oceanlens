/* Regression test for the "black canvas after WebGL context loss" bug
 * (Phase 4A visual-QA fix, 2026-09-11).
 *
 * Why this is a source-level test, not a behavioural one: this project's
 * Vitest config runs in the `node` environment (see vitest.config.ts) with
 * no jsdom, no WebGL mock, and no @testing-library/react — there is
 * currently no harness capable of mounting ThreeSceneCanvas, constructing a
 * real (or stubbed) WebGLRenderingContext, and dispatching a synthetic
 * `webglcontextlost` event at it. Building that harness (jsdom + a WebGL
 * context double compatible enough for three.js's WebGLRenderer to
 * construct against) is a meaningfully sized addition on its own and is out
 * of scope for this bugfix. The actual behavioural verification for this
 * fix was done live, in a real headless Chromium (Playwright), where a
 * genuine `CONTEXT_LOST_WEBGL` / restore cycle occurred and the scene was
 * screenshotted rendering correctly afterward — see the fix's report and
 * CLAUDE.md's Phase 4A entry.
 *
 * What this test CAN and DOES guard: that the specific lines the fix
 * depends on are actually present in the component source, so that a
 * future edit cannot silently delete the recovery wiring (e.g. "clean up
 * unused listeners", a merge conflict, a refactor) without a test failing.
 * It cannot catch a *logic* regression that keeps all these strings present
 * but breaks their behaviour — only a real browser check (as done for this
 * fix) can do that.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./ThreeSceneCanvas.tsx', import.meta.url)),
  'utf-8',
);

describe('ThreeSceneCanvas WebGL context-loss recovery (source-level regression guard)', () => {
  it('listens for webglcontextlost and calls preventDefault (required by the WebGL spec for the browser to attempt automatic restoration)', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]webglcontextlost['"]/);
    // The listener body must call preventDefault — without it, the browser
    // will not attempt to restore the context at all (spec requirement).
    const lostHandlerMatch = source.match(
      /const onContextLost = \([^)]*\) => \{([\s\S]*?)\};/,
    );
    expect(lostHandlerMatch).not.toBeNull();
    expect(lostHandlerMatch?.[1]).toMatch(/preventDefault\(\)/);
  });

  it('listens for webglcontextrestored and forces a rebuild rather than assuming Three.js auto-restores app resources', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]webglcontextrestored['"]/);
    const restoredHandlerMatch = source.match(
      /const onContextRestored = \(\) => \{([\s\S]*?)\};/,
    );
    expect(restoredHandlerMatch).not.toBeNull();
    // Must bump the generation counter that the content-building effects
    // depend on, and must restart the render loop (which the loss handler
    // stops) — otherwise the canvas stays black forever after a real loss.
    expect(restoredHandlerMatch?.[1]).toMatch(/setRenderGeneration/);
    expect(restoredHandlerMatch?.[1]).toMatch(/startLoop\(\)/);
  });

  it('both listeners are removed in the effect cleanup (no leak, no stale closure re-firing after unmount)', () => {
    expect(source).toMatch(/removeEventListener\(\s*['"]webglcontextlost['"]/);
    expect(source).toMatch(/removeEventListener\(\s*['"]webglcontextrestored['"]/);
  });

  it('renderGeneration is a dependency of both the plane-rebuild and marker-rebuild effects, so a context restore fully re-uploads GPU resources', () => {
    // Two separate effects build GPU-side content (the depth-slice plane's
    // texture/geometry, and the marker sprites). Both must re-run after a
    // context restore, or one half of the scene would silently stay black.
    const depArrayBlocks = [...source.matchAll(/\}, \[([\s\S]*?)\]\);/g)];
    const blocksWithRenderGeneration = depArrayBlocks.filter((m) =>
      /renderGeneration/.test(m[1] ?? ''),
    );
    expect(blocksWithRenderGeneration.length).toBeGreaterThanOrEqual(2);
  });
});
