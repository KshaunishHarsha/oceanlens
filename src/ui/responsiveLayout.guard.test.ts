/* Regression guard for the responsive/layout QA pass (2026-09-12): four
 * real defects found by an actual browser check at the 300px control-rail
 * breakpoint (1440x900) — none of them showed up at the desktop breakpoint
 * (1600x1000), and none were caught by any existing test, since this
 * project's Vitest config has no jsdom/CSS-layout engine (see
 * ThreeSceneCanvas.contextLoss.test.ts's header comment for the same
 * constraint applied to a different fix). These are source-level guards:
 * they assert the specific CSS properties the fix depends on are still
 * present, so a future edit cannot silently revert one without a test
 * failing. They cannot catch a logic-only regression that keeps these
 * properties present but changes their values in a way that reintroduces
 * the bug — only a real browser check (as performed for this pass, see
 * CLAUDE.md) can do that. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), 'utf-8');
}

describe('ProvenanceStrip: trailing label never runs into the text before it', () => {
  it('the spacer has a minimum width, so it cannot collapse to 0 and merge two labels with no gap', () => {
    const css = read('./ProvenanceStrip.module.css');
    const growBlock = css.match(/\.grow\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(growBlock).toMatch(/flex:\s*1/);
    expect(growBlock).toMatch(/min-width:\s*12px/);
  });
});

describe('CommandBar: no action button silently scrolls out of the initial view at narrow widths', () => {
  it('the redundant "REAL CACHED DATA" badge is hidden at the same breakpoint the rails already narrow at, freeing room for the action buttons', () => {
    const css = read('./CommandBar.module.css');
    expect(css).toMatch(/@media \(max-width: 1599px\)/);
    const mediaBlock = css.match(/@media \(max-width: 1599px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(mediaBlock).toMatch(/\.badgeInternal\s*\{[^}]*display:\s*none/);
  });

  it('the honesty-critical "HISTORICAL DEMONSTRATION" badge is never hidden — only the redundant one', () => {
    const css = read('./CommandBar.module.css');
    const mediaBlock = css.match(/@media \(max-width: 1599px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(mediaBlock).not.toMatch(/badgeOperational/);
  });

  it('the bar still has a contained horizontal-scroll fallback for any width narrower than this pass tested', () => {
    const css = read('./CommandBar.module.css');
    const barBlock = css.match(/\.bar\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(barBlock).toMatch(/overflow-x:\s*auto/);
  });
});

describe('UnavailableNote: a disabled control-rail row\'s "UNAVAILABLE" badge is never silently clipped', () => {
  it('the fix is scoped to the button-row usage only, so ProfileChart/CollocationPanel\'s EmptyState usage is untouched', () => {
    const css = read('./states/StatusStates.module.css');
    expect(css).toMatch(/\.unavailableWrap:has\(> button\)\s*\{/);
    const scopedBlock = css.match(/\.unavailableWrap:has\(> button\)\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(scopedBlock).toMatch(/width:\s*100%/);
    expect(scopedBlock).toMatch(/flex-wrap:\s*wrap/);
  });

  it('the row button shares the line with the badge instead of claiming a fixed 100% width for itself', () => {
    const css = read('./states/StatusStates.module.css');
    const buttonBlock = css.match(/\.unavailableWrap > button\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(buttonBlock).toMatch(/flex:\s*1/);
    expect(buttonBlock).toMatch(/min-width:\s*0/);
  });

  it('the base .unavailableWrap rule (used everywhere, including EmptyState usages) is NOT itself forced to width:100%/flex-wrap — only the :has() scoped variant is', () => {
    const css = read('./states/StatusStates.module.css');
    const baseBlock = css.match(/\.unavailableWrap\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(baseBlock).not.toMatch(/width:\s*100%/);
    expect(baseBlock).not.toMatch(/flex-wrap/);
  });
});

describe('Truncated control-rail/picker labels always carry a title attribute for the full text', () => {
  it('LayerToggles rows expose the real layer label via title, for hover access to text an ellipsis may hide', () => {
    const source = read('./ControlRail/LayerToggles.tsx');
    expect(source).toMatch(/title=\{layer\?\.label\s*\?\?\s*id\}/);
  });

  it('FieldConfiguration rows expose the real variable name via title', () => {
    const source = read('./ControlRail/FieldConfiguration.tsx');
    expect(source).toMatch(/title=\{meta\.name\}/);
  });

  it('the observation picker rows expose the real platform name via title', () => {
    const source = read('./EvidencePanel/EvidencePanel.tsx');
    expect(source).toMatch(/title=\{o\.platformName\}/);
  });
});
