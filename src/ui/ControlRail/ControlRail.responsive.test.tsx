/* Real-render (not just source-grep) proof that the responsive-QA title-
 * attribute fix (see ../responsiveLayout.guard.test.ts and CLAUDE.md's
 * responsive-QA entry) actually reaches the rendered HTML, not just the
 * component source.
 *
 * Only the default (idle) store state is renderable via renderToString —
 * see SceneStage.smoke.test.tsx's header comment for why (Zustand's SSR
 * binding is pinned to initial state). That's sufficient here: both rows'
 * `title` comes from a fallback (`layer?.label ?? id`, `meta.name`) that
 * does not depend on live store data, so it is present even in the idle
 * render. */

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { LayerToggles } from './LayerToggles';
import { FieldConfiguration } from './FieldConfiguration';

describe('LayerToggles rows carry a title attribute (hover access to a label an ellipsis may truncate)', () => {
  it('renders a title on every layer row, even in the idle (no data yet) state', () => {
    const html = renderToString(createElement(LayerToggles));
    // Idle state has no loaded layer registry, so the label falls back to
    // the raw layer id — still proves the attribute mechanism is wired.
    expect(html).toMatch(/title="model\.temperature"/);
    expect(html).toMatch(/title="obs\.argo"/);
  });
});

describe('FieldConfiguration rows carry a title attribute with the real variable name', () => {
  it('renders title="Chlorophyll-a" on the chlorophyll row, not just a visible ellipsis', () => {
    const html = renderToString(createElement(FieldConfiguration));
    expect(html).toMatch(/title="Chlorophyll-a"/);
  });

  it('renders the real name for every variable, not only the longest one', () => {
    const html = renderToString(createElement(FieldConfiguration));
    expect(html).toMatch(/title="Sea-water temperature"/);
    expect(html).toMatch(/title="Sea-water salinity"/);
    expect(html).toMatch(/title="Ocean current speed"/);
  });
});
