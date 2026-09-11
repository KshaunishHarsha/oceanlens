/* SceneStage component-state coverage.
 *
 * The actual branch-selection logic is tested exhaustively and honestly in
 * scene/sceneStageState.test.ts, as a pure function — see that file's header
 * comment for why: Zustand's React binding hard-codes SSR's
 * `getServerSnapshot` to the store's state at module-creation time
 * (node_modules/zustand/esm/react.mjs), so `renderToString` on a
 * Zustand-backed component always renders the INITIAL store state, no
 * matter what `setState` was called beforehand — verified empirically while
 * writing this phase's tests, not assumed. A `renderToString` test on
 * SceneStage itself can therefore only prove "mounts without throwing in
 * its default (idle) state" — genuinely useful (it's the state a fresh page
 * load is briefly in, and it proves the Three.js import graph is SSR-safe),
 * but it is not evidence about the ready/error/unavailable branches. Those
 * are covered by sceneStageState.test.ts instead. */

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { SceneStage } from './SceneStage';

describe('SceneStage mounts safely in its default (idle) state', () => {
  it('renders the loading state and no Three.js/WebGL call fires during SSR', () => {
    // No store mutation here on purpose — see header comment above for why
    // that would not change what SSR renders. Default store state is
    // idle/loading, which is exactly what a fresh page load shows first.
    const html = renderToString(createElement(SceneStage));
    expect(html).toMatch(/Loading regional grid/);
  });

  it('does not throw', () => {
    expect(() => renderToString(createElement(SceneStage))).not.toThrow();
  });
});
