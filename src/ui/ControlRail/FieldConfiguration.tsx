import { OCEAN_VARIABLES, VARIABLES } from '@/domain/variables';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { UnavailableNote } from '@/ui/states/StatusStates';
import styles from './ControlRail.module.css';

export function FieldConfiguration() {
  const variable = useAnalysisStore((s) => s.variable);
  const setVariable = useAnalysisStore((s) => s.setVariable);
  const availability = useDataStore((s) => s.variableAvailability);
  const status = useDataStore((s) => s.status);

  const available = OCEAN_VARIABLES.filter((v) => availability[v]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.caption}>FIELD CONFIGURATION</span>
        <span className={styles.count}>
          {status === 'ready' ? `${available.length} of ${OCEAN_VARIABLES.length} real` : '—'}
        </span>
      </div>
      <div className={styles.stack}>
        {OCEAN_VARIABLES.map((v) => {
          const meta = VARIABLES[v];
          const isAvailable = Boolean(availability[v]);
          const active = variable === v;
          const row = (
            <button
              key={v}
              type="button"
              className={styles.fieldRow}
              data-active={active}
              disabled={!isAvailable}
              onClick={() => setVariable(v)}
              title={meta.name}
            >
              <span className={styles.fieldAbbr}>{meta.abbr}</span>
              <span className={styles.fieldName}>{meta.name}</span>
              <span className={styles.fieldUnit}>{meta.unit}</span>
              <span className={styles.fieldBadge} data-real={isAvailable}>
                {isAvailable ? 'REAL' : 'N/A'}
              </span>
            </button>
          );
          return isAvailable ? (
            row
          ) : (
            <UnavailableNote
              key={v}
              reason="No real cached source exists for this variable."
            >
              {row}
            </UnavailableNote>
          );
        })}
      </div>
    </section>
  );
}
