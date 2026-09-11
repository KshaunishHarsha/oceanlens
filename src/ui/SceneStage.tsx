import { VARIABLES } from '@/domain/variables';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { EmptyState, ErrorState, LoadingState } from '@/ui/states/StatusStates';
import styles from './SceneStage.module.css';

/**
 * Shell only — no rendering yet. Shows what the scene WILL be driven by
 * (real selected variable/depth/time from the store) and every state the
 * eventual renderer must handle, without drawing anything itself. The full
 * canvas/SVG scene is a later phase.
 */
export function SceneStage() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const retry = useDataStore((s) => s.retry);
  const metadata = useDataStore((s) => s.metadata);
  const availability = useDataStore((s) => s.variableAvailability);

  const variable = useAnalysisStore((s) => s.variable);
  const depthM = useAnalysisStore((s) => s.depthM);
  const timestamp = useAnalysisStore((s) => s.timestamp);
  const exaggeration = useAnalysisStore((s) => s.verticalExaggeration);
  const renderMode = useAnalysisStore((s) => s.renderMode);

  const meta = VARIABLES[variable];

  return (
    <div className={styles.stage}>
      {status === 'loading' || status === 'idle' ? (
        <LoadingState label="Loading regional grid and model volume…" />
      ) : status === 'error' ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={retry} />
      ) : !availability[variable] ? (
        <EmptyState
          label={`${meta.name} — not available in MVP`}
          detail="No real cached source exists for this variable. Select a different field."
        />
      ) : !timestamp ? (
        <EmptyState label="No timestamps loaded" detail="The real model timestamp axis is empty." />
      ) : (
        <>
          <div className={styles.headerLabels}>
            <div className={styles.title}>
              {metadata?.regionName ?? 'Regional'} analysis volume
            </div>
            <div className={styles.subtitle}>
              {metadata
                ? `${metadata.region.minLat}–${metadata.region.maxLat}°N · ${metadata.region.minLon}–${metadata.region.maxLon}°E`
                : ''}{' '}
              · 0–1000 m · {meta.name.toLowerCase()}
            </div>
          </div>

          <div className={styles.placeholder}>
            <span className={styles.placeholderLabel}>SCENE — shell only, rendering arrives next phase</span>
            <span className={styles.placeholderDetail}>
              {renderMode} · real data ready to draw
            </span>
          </div>

          <div className={styles.stateBadges}>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>VARIABLE</span>
              <span className={styles.readoutValue}>{meta.name}</span>
            </span>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>DEPTH</span>
              <span className={styles.readoutValue}>−{depthM} m</span>
            </span>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>TIME</span>
              <span className={styles.readoutValue}>{timestamp.slice(0, 16).replace('T', ' ')} UTC</span>
            </span>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>EXAGGERATION</span>
              <span className={styles.readoutValue}>{exaggeration}×</span>
            </span>
          </div>

          <div className={styles.legend}>
            <div className={styles.legendTitle}>
              {meta.name.toUpperCase()} ({meta.unit})
            </div>
            <div className={styles.ramp} style={{ background: `var(${meta.rampVar})` }} />
            <div className={styles.rampTicks}>
              <span>{meta.defaultRange[0]}</span>
              <span>{meta.defaultRange[1]}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
