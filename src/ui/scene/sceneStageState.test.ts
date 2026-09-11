import { describe, expect, it } from 'vitest';
import { selectSceneStageView } from './sceneStageState';

const BASE = {
  dataStatus: 'ready' as const,
  dataError: null,
  variableAvailable: true,
  variableName: 'Sea-water temperature',
  timestamp: '2023-09-25T00:00:00.000Z',
};

describe('selectSceneStageView', () => {
  it('shows loading while the data store is idle', () => {
    expect(selectSceneStageView({ ...BASE, dataStatus: 'idle' })).toEqual({ kind: 'loading' });
  });

  it('shows loading while the data store is loading', () => {
    expect(selectSceneStageView({ ...BASE, dataStatus: 'loading' })).toEqual({ kind: 'loading' });
  });

  it('shows the real error message when the data store failed', () => {
    expect(
      selectSceneStageView({ ...BASE, dataStatus: 'error', dataError: 'backend unreachable' }),
    ).toEqual({ kind: 'error', message: 'backend unreachable' });
  });

  it('falls back to "Unknown error" only when no message was captured', () => {
    expect(selectSceneStageView({ ...BASE, dataStatus: 'error', dataError: null })).toEqual({
      kind: 'error',
      message: 'Unknown error',
    });
  });

  it('shows unavailable for a variable with no real cached source', () => {
    expect(
      selectSceneStageView({ ...BASE, variableAvailable: false, variableName: 'Chlorophyll-a' }),
    ).toEqual({ kind: 'unavailable', variableName: 'Chlorophyll-a' });
  });

  it('checks variable availability before the timestamp axis', () => {
    // both conditions are false; unavailable must win, matching the
    // component's actual branch order (it never gets to the timestamp check)
    expect(
      selectSceneStageView({ ...BASE, variableAvailable: false, timestamp: null }),
    ).toEqual({ kind: 'unavailable', variableName: BASE.variableName });
  });

  it('shows no-timestamps when the real axis is empty for an available variable', () => {
    expect(selectSceneStageView({ ...BASE, timestamp: null })).toEqual({ kind: 'no-timestamps' });
  });

  it('reaches ready only when data is loaded, the variable is real, and a real timestamp exists', () => {
    expect(selectSceneStageView(BASE)).toEqual({ kind: 'ready' });
  });

  it('prioritises error over an unavailable variable', () => {
    expect(
      selectSceneStageView({
        ...BASE,
        dataStatus: 'error',
        dataError: 'x',
        variableAvailable: false,
      }),
    ).toEqual({ kind: 'error', message: 'x' });
  });
});
