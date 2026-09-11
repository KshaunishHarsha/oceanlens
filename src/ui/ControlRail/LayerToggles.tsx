import { SCENE_LAYER_ORDER } from '@/domain/layers';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { UnavailableNote } from '@/ui/states/StatusStates';
import styles from './ControlRail.module.css';

export function LayerToggles() {
  const layers = useDataStore((s) => s.layers);
  const activeLayers = useAnalysisStore((s) => s.layers);
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer);

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
          const row = (
            <button
              key={id}
              type="button"
              className={styles.layerRow}
              data-on={on && renderable}
              disabled={!renderable}
              onClick={() => toggleLayer(id)}
            >
              <span className={styles.checkbox} data-on={on && renderable} aria-hidden="true" />
              <span className={styles.layerLabel}>{layer?.label ?? id}</span>
              <span className={styles.layerMeta}>
                {renderable ? layer!.source.status : 'N/A'}
              </span>
            </button>
          );
          return renderable ? (
            row
          ) : (
            <UnavailableNote
              key={id}
              reason={layer?.source.caveats?.[0] ?? 'Not available in MVP.'}
            >
              {row}
            </UnavailableNote>
          );
        })}
      </div>
    </section>
  );
}
