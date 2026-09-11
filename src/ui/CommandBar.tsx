import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import styles from './CommandBar.module.css';

export function CommandBar() {
  const metadata = useDataStore((s) => s.metadata);
  const status = useDataStore((s) => s.status);
  const mode = useAnalysisStore((s) => s.mode);
  const setMode = useAnalysisStore((s) => s.setMode);

  const briefing = mode === 'briefing';

  return (
    <header className={styles.bar}>
      <div className={styles.identity}>
        <span className={styles.product}>OceanLens India</span>
        <span className={styles.sep}>/</span>
        <span className={styles.crumb}>Operations</span>
        <span className={styles.sep}>/</span>
        <span className={styles.crumbActive}>
          {metadata?.regionName ?? '—'} investigation
        </span>
      </div>

      <div className={styles.badges}>
        <span className={styles.badgeOperational}>HISTORICAL DEMONSTRATION</span>
        <span className={styles.badgeInternal}>REAL CACHED DATA</span>
      </div>

      <div className={styles.spacer} />

      <div className={styles.selectors}>
        <div className={styles.selector} title="Model source">
          <span className={styles.selectorLabel}>DATASET</span>
          <span className={styles.selectorValue}>
            {status === 'ready' ? 'HYCOM GOFS 3.1' : '—'}
          </span>
        </div>
        <div className={styles.selector} title="Demonstration window">
          <span className={styles.selectorLabel}>WINDOW</span>
          <span className={styles.selectorValue}>
            {metadata
              ? `${metadata.demonstrationWindow.start.slice(0, 10)} → ${metadata.demonstrationWindow.end.slice(0, 10)}`
              : '—'}
          </span>
        </div>
        <div className={styles.selector} title="Analysis region">
          <span className={styles.selectorLabel}>REGION</span>
          <span className={styles.selectorValue}>{metadata?.regionName ?? '—'}</span>
        </div>
      </div>

      <div className={styles.search} title="Search — planned extension" aria-disabled="true">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#5E7488" strokeWidth="1.4">
          <circle cx="7" cy="7" r="4.6" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <kbd className={styles.kbd}>⌘K</kbd>
      </div>

      <button
        type="button"
        className={styles.briefing}
        data-active={briefing}
        onClick={() => setMode(briefing ? 'workspace' : 'briefing')}
      >
        Briefing mode
      </button>
      <button
        type="button"
        className={styles.share}
        title="Share view — planned extension"
        disabled
      >
        Share view
      </button>
    </header>
  );
}
