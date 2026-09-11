import { unavailableLayers } from '@/domain/layers';
import { useDataStore } from '@/state/dataStore';
import styles from './ControlRail.module.css';

/** Every layer the product could show but doesn't yet, with why — never
 * silently missing, never presented as though it might be active. */
export function PlannedExtensions() {
  const layers = useDataStore((s) => s.layers);
  if (!layers) return null;

  const planned = unavailableLayers(layers);
  if (planned.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.caption}>PLANNED EXTENSIONS</span>
        <span className={styles.count}>{planned.length}</span>
      </div>
      <div className={styles.stack}>
        {planned.map((layer) => (
          <div key={layer.id} className={styles.plannedRow} title={layer.source.caveats[0]}>
            <span
              className={styles.plannedStatus}
              data-status={layer.source.status}
            >
              {layer.source.status === 'PLANNED_EXTENSION' ? 'PLANNED' : 'N/A'}
            </span>
            <span className={styles.layerLabel}>{layer.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.footnote}>
        Not available in MVP — no real cached source exists for these layers yet.
      </p>
    </section>
  );
}
