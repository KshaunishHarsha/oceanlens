import { SCENE_LAYER_ORDER } from '@/domain/layers';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { UnavailableNote } from '@/ui/states/StatusStates';
import styles from './ControlRail.module.css';

export function LayerToggles() {
  const layers = useDataStore((s) => s.layers);
  const activeLayers = useAnalysisStore((s) => s.layers);
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer);
  // A source may be real/precomputed yet still be a future renderer. Never
  // present a live checkbox unless this version of the scene consumes it.
  const sceneImplemented = (id: string) =>
    id === 'model.temperature' || id === 'model.salinity' || id === 'model.currents' || id === 'obs.argo';

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.caption}>VISUAL ANALYTICS</span>
      </div>
      <div className={styles.stack}>
        {SCENE_LAYER_ORDER.map((id) => {
          const layer = layers?.[id];
          const renderable =
            layer?.source.status === 'REAL_CACHED' ||
            layer?.source.status === 'PRECOMPUTED_FROM_REAL' ||
            layer?.source.status === 'DERIVED_FROM_REAL';
          const on = Boolean(activeLayers[id]);
          const interactive = Boolean(renderable && sceneImplemented(id));
          const status = !renderable
            ? 'UNAVAILABLE'
            : !sceneImplemented(id)
              ? 'NOT DRAWN'
              : on
                ? 'VISIBLE'
                : 'HIDDEN';
          const row = (
            <button
              key={id}
              type="button"
              className={styles.layerRow}
              data-on={on && interactive}
              disabled={!interactive}
              onClick={() => toggleLayer(id)}
              title={layer?.label ?? id}
            >
              <span className={styles.checkbox} data-on={on && interactive} aria-hidden="true" />
              <span className={styles.layerText}>
                <span className={styles.layerLabel}>{layer?.label ?? id}</span>
              </span>
              <span className={styles.layerMeta} data-status={status}>{status}</span>
            </button>
          );
          return interactive ? (
            row
          ) : (
            <UnavailableNote
              key={id}
              reason={!renderable
                ? (layer?.source.caveats?.[0] ?? 'Not available in MVP.')
                : 'This source is registered, but its scene renderer is a finals extension. It is intentionally not presented as an active visual control.'}
            >
              {row}
            </UnavailableNote>
          );
        })}
      </div>
    </section>
  );
}
