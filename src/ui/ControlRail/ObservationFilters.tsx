import { PLATFORM_TYPES, PLATFORMS } from '@/domain/platforms';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import styles from './ControlRail.module.css';

const DACS = [
  { code: 'IN' as const, label: 'INCOIS' },
  { code: 'HZ' as const, label: 'China Argo' },
];

export function ObservationFilters() {
  const observations = useDataStore((s) => s.observations);
  const filters = useAnalysisStore((s) => s.filters);
  const togglePlatformType = useAnalysisStore((s) => s.togglePlatformType);
  const toggleDataCentre = useAnalysisStore((s) => s.toggleDataCentre);
  const setGoodQualityOnly = useAnalysisStore((s) => s.setGoodQualityOnly);
  const setCollocatedOnly = useAnalysisStore((s) => s.setCollocatedOnly);

  const platformCounts = Object.fromEntries(
    PLATFORM_TYPES.map((p) => [p, observations.filter((o) => o.platformType === p).length]),
  );
  const dacCounts = Object.fromEntries(
    DACS.map((d) => [d.code, observations.filter((o) => o.identity?.dataCentre === d.code).length]),
  );

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.caption}>OBSERVATION FILTERS</span>
        <span className={styles.count}>{observations.length} total</span>
      </div>

      <div className={styles.stack}>
        {PLATFORM_TYPES.map((p) => {
          const meta = PLATFORMS[p];
          const count = platformCounts[p] ?? 0;
          const on = filters.platformTypes[p];
          const hasData = count > 0;
          return (
            <button
              key={p}
              type="button"
              className={styles.layerRow}
              data-on={on}
              disabled={!hasData}
              title={hasData ? undefined : 'No real observations of this type in the demo window.'}
              onClick={() => togglePlatformType(p)}
            >
              <span className={styles.checkbox} data-on={on} aria-hidden="true" />
              <span className={styles.symbol} style={{ color: `var(${meta.colorVar})` }}>
                {meta.glyph}
              </span>
              <span className={styles.layerLabel}>{meta.label}</span>
              <span className={styles.layerMeta}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.subCaption}>ARGO DATA CENTRE</div>
      <div className={styles.stack}>
        {DACS.map((d) => (
          <button
            key={d.code}
            type="button"
            className={styles.layerRow}
            data-on={filters.dataCentres[d.code]}
            disabled={(dacCounts[d.code] ?? 0) === 0}
            onClick={() => toggleDataCentre(d.code)}
          >
            <span className={styles.checkbox} data-on={filters.dataCentres[d.code]} aria-hidden="true" />
            <span className={styles.layerLabel}>{d.label}</span>
            <span className={styles.layerMeta}>{dacCounts[d.code] ?? 0}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.toggleRow}
        onClick={() => setGoodQualityOnly(!filters.goodQualityOnly)}
      >
        <span className={styles.track} data-on={filters.goodQualityOnly}>
          <span className={styles.knob} data-on={filters.goodQualityOnly} />
        </span>
        <span className={styles.toggleLabel}>Good quality observations only</span>
      </button>
      <button
        type="button"
        className={styles.toggleRow}
        onClick={() => setCollocatedOnly(!filters.collocatedOnly)}
      >
        <span className={styles.track} data-on={filters.collocatedOnly}>
          <span className={styles.knob} data-on={filters.collocatedOnly} />
        </span>
        <span className={styles.toggleLabel}>Show only collocated observations</span>
      </button>
    </section>
  );
}
