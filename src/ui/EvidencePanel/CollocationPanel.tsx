/* Phase 5A step 2 — real model-versus-observation collocation evidence.
 *
 * Every number here comes from the backend's own already-computed
 * CollocationResult (see useCollocation.ts / collocationView.ts's header
 * comments) — this component only formats and labels it. No statistic is
 * recalculated, no confidence score, forecast or anomaly is invented; the
 * "READING" text is the backend's own deterministic interpretation
 * sentence, shown verbatim. */

import { useState } from 'react';
import { DELTA_CONVENTION, formatDelta, formatValue, variableMeta } from '@/domain/variables';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { EmptyState, ErrorState, LoadingState, UnavailableNote } from '@/ui/states/StatusStates';
import {
  describeBiasDirection,
  formatHours,
  formatKm,
  selectCollocationView,
  verdictColorVar,
} from './collocationView';
import { useCollocation } from './useCollocation';
import styles from './CollocationPanel.module.css';

function isoLabel(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ') + ' UTC';
}

export function CollocationPanel({ observationId }: { observationId: string }) {
  const variable = useAnalysisStore((s) => s.variable);
  const observations = useDataStore((s) => s.observations);
  const metadata = useDataStore((s) => s.metadata);
  const [reloadToken, setReloadToken] = useState(0);

  const { status, error, result } = useCollocation(observationId, variable, reloadToken);
  const meta = variableMeta(variable);
  const obsSummary = observations.find((o) => o.id === observationId);

  const view = selectCollocationView({
    variableSupported: variable === 'temperature' || variable === 'salinity',
    variableName: meta.name,
    status,
    error,
    sampleCount: result?.sampleCount ?? null,
  });

  if (view.kind === 'unavailable-variable') {
    return (
      <div className={styles.wrap}>
        <UnavailableNote reason="Argo floats in this cache carry temperature and salinity only — no current or chlorophyll sensor to compare.">
          <EmptyState
            label={`${view.variableName} — not measured by Argo`}
            detail="Switch to sea-water temperature or salinity to see this observation's model comparison."
          />
        </UnavailableNote>
      </div>
    );
  }
  if (view.kind === 'loading') {
    return (
      <div className={styles.wrap}>
        <LoadingState label="Loading real collocation result…" />
      </div>
    );
  }
  if (view.kind === 'error') {
    return (
      <div className={styles.wrap}>
        <ErrorState message={view.message} onRetry={() => setReloadToken((n) => n + 1)} />
      </div>
    );
  }
  if (view.kind === 'no-collocation') {
    return (
      <div className={styles.wrap}>
        <EmptyState
          label="No model comparison available"
          detail="No real model column was ever extracted for this observation's position, so no observed-versus-modelled comparison can be shown — not a fabricated result."
        />
      </div>
    );
  }

  // view.kind is 'no-valid-levels' or 'ready' — both render the same real
  // meta/interpretation; only the stat tiles/bands differ (no-valid-levels
  // shows honest "—" values instead of hiding the whole panel).
  if (!result) {
    return (
      <div className={styles.wrap}>
        <EmptyState label="No plottable comparison" />
      </div>
    );
  }

  const biasDirection = describeBiasDirection(meta.biasWords, result.meanBias);
  const unit = result.unit ?? meta.unit;

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>FLOAT</span>
          <span className={styles.metaValue}>
            {obsSummary?.platformName ?? result.observationId}
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>VARIABLE</span>
          <span className={styles.metaValue}>
            {meta.name} ({unit})
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>OBSERVED</span>
          <span className={styles.metaValue}>
            {result.observationTimestamp ? isoLabel(result.observationTimestamp) : '—'}
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>MODEL TIME</span>
          <span className={styles.metaValue}>{isoLabel(result.modelTimestamp)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>DISTANCE</span>
          <span className={styles.metaValue}>
            {formatKm(result.horizontalDistanceKm)} (model grid cell to float position)
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>TIME OFFSET</span>
          <span className={styles.metaValue}>
            {formatHours(result.timeOffsetHours)} (observation − model)
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>SOURCE</span>
          <span className={styles.metaValue}>
            {result.observationSource ?? 'Argo GDAC'} · {result.modelSource}
          </span>
        </div>
        {metadata && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>WINDOW</span>
            <span className={styles.metaValue}>
              {metadata.windowLabel} ({metadata.demonstrationWindow.start.slice(0, 10)} →{' '}
              {metadata.demonstrationWindow.end.slice(0, 10)})
            </span>
          </div>
        )}
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>RMSE</span>
          <span className={styles.statValue}>{formatValue(variable, result.rmse)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>MEAN BIAS</span>
          <span className={styles.statValue}>{formatDelta(variable, result.meanBias)}</span>
          {biasDirection && <span className={styles.statCaption}>{biasDirection}</span>}
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>LEVELS COMPARED</span>
          <span className={styles.statValue}>{result.sampleCount}</span>
        </div>
      </div>
      <p className={styles.deltaConvention}>{DELTA_CONVENTION}</p>

      {view.kind === 'no-valid-levels' && (
        <p className={styles.noOverlap}>
          No quality-controlled levels from this profile overlap with the model column — RMSE
          and mean bias are unavailable (shown as “—”, not zero). Position and timing above are
          still real.
        </p>
      )}

      {result.bands.length > 0 && (
        <table className={styles.bandTable}>
          <caption className={styles.bandCaption}>Depth-band agreement</caption>
          <thead>
            <tr>
              <th scope="col">Band</th>
              <th scope="col">Mean Δ</th>
              <th scope="col">RMSE</th>
              <th scope="col">n</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {result.bands.map((b) => (
              <tr key={`${b.fromM}-${b.toM}`}>
                <td>
                  {b.fromM}–{b.toM} m
                </td>
                <td>{formatDelta(variable, b.meanDelta)}</td>
                <td>{formatValue(variable, b.rmse)}</td>
                <td>{b.sampleCount}</td>
                <td>
                  <span
                    className={styles.verdictBadge}
                    style={{ color: `var(${verdictColorVar(b.verdict)})` }}
                  >
                    {b.verdict.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.reading}>
        <span className={styles.readingLabel}>READING</span>
        <p className={styles.readingText}>{result.interpretation}</p>
      </div>

      <ul className={styles.caveats}>
        <li>
          Only GOOD / PROBABLY_GOOD-flagged levels of this profile contribute to RMSE, mean
          bias and the depth bands — SUSPECT and BAD levels are excluded from the statistics,
          the same way they are shown distinctly (not silently) on the Profile tab.
        </li>
        {obsSummary && (
          <li>
            This profile&apos;s own summary QC is <strong>{obsSummary.qc}</strong>.
          </li>
        )}
        {result.source?.caveats?.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  );
}
