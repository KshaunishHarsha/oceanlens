/* Real-render (SSR-safe) check for the Argo search control — mirrors the
 * pattern already used for SceneStage.smoke.test.tsx / ControlRail's
 * responsive test: renderToString only proves the default (idle) state,
 * since Zustand's SSR snapshot is pinned to store-creation state (see
 * SceneStage.smoke.test.tsx's header comment) — sufficient here because
 * the accessible label and disabled/placeholder wiring don't depend on
 * live data. */

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { CommandSearch } from './CommandSearch';

describe('CommandSearch', () => {
  it('renders without throwing during SSR — no window/document access at module scope', () => {
    expect(() => renderToString(createElement(CommandSearch))).not.toThrow();
  });

  it('is disabled with a real, honest placeholder before observations have loaded (idle state)', () => {
    const html = renderToString(createElement(CommandSearch));
    expect(html).toMatch(/disabled=""/);
    expect(html).toMatch(/Loading real observations…/);
  });

  it('carries an accessible label naming what it searches, not a bare icon button', () => {
    const html = renderToString(createElement(CommandSearch));
    expect(html).toMatch(/aria-label="Search for a real Argo observation/);
  });
});
