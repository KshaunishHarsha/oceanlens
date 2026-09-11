/* Pure branch-selection logic for SceneStage, extracted so "which state is
 * the scene in" is unit-testable directly.
 *
 * This split exists because of a real finding while writing this phase's
 * tests: Zustand's React binding (`node_modules/zustand/esm/react.mjs`)
 * hard-codes `getServerSnapshot` to the store's state AT CREATION, by
 * design (it avoids SSR/hydration mismatches) — so `renderToString` on a
 * component reading a Zustand store ALWAYS sees the initial state, no
 * matter what `setState` was called beforehand. A `renderToString`-based
 * test can prove a component doesn't throw; it cannot prove which branch
 * rendered for a given store state. Testing the decision as a pure function
 * here is the honest way to get real "component state" coverage without a
 * browser. See sceneStageState.test.ts and the Phase 4A report. */

export type SceneStageView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly variableName: string }
  | { readonly kind: 'no-timestamps' }
  | { readonly kind: 'ready' };

export interface SceneStageInput {
  readonly dataStatus: 'idle' | 'loading' | 'ready' | 'error';
  readonly dataError: string | null;
  readonly variableAvailable: boolean;
  readonly variableName: string;
  readonly timestamp: string | null;
}

/** Mirrors SceneStage.tsx's branch order exactly — loading/idle first, then
 * error, then unavailable variable, then missing timestamps, else ready. */
export function selectSceneStageView(input: SceneStageInput): SceneStageView {
  if (input.dataStatus === 'loading' || input.dataStatus === 'idle') {
    return { kind: 'loading' };
  }
  if (input.dataStatus === 'error') {
    return { kind: 'error', message: input.dataError ?? 'Unknown error' };
  }
  if (!input.variableAvailable) {
    return { kind: 'unavailable', variableName: input.variableName };
  }
  if (!input.timestamp) {
    return { kind: 'no-timestamps' };
  }
  return { kind: 'ready' };
}
