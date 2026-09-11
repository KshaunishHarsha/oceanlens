/* Phase 5A step 1 — real observed-vs-modelled vertical profile chart.
 *
 * Hand-rolled SVG, no charting dependency (per the project's locked "no
 * chart library" decision, src/state/analysisStore.ts's sibling docs and
 * CLAUDE.md's "Locked decisions" #5). Fetches through the existing
 * OceanDataAdapter boundary only — see useProfileComparison.ts — and never
 * fabricates a value: missing/QC-less levels are skipped, not zero-filled;
 * a missing model column degrades to "observed only", never an invented
 * curve. */

import { useState } from 'react';
import { QUALITY } from '@/domain/quality';
import { formatValue, variableMeta } from '@/domain/variables';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { EmptyState, ErrorState, LoadingState, UnavailableNote } from '@/ui/states/StatusStates';
import {
  buildModeledSeries,
  buildObservedSeries,
  computeChartDomain,
  qcMarkerShape,
  selectProfileChartView,
  type ObservedPoint,
} from './profileComparison';
import { useProfileComparison } from './useProfileComparison';
import styles from './ProfileChart.module.css';

const VIEW_W = 320;
const VIEW_H = 300;
const MARGIN = { top: 10, right: 14, bottom: 30, left: 46 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(min + ((max - min) * i) / count);
  return out;
}

function QcMarker({ x, y, qc }: { x: number; y: number; qc: ObservedPoint['qc'] }) {
  const color = `var(${QUALITY[qc].colorVar})`;
  const shape = qcMarkerShape(qc);
  if (shape === 'dot') {
    return <circle cx={x} cy={y} r={2.6} fill={color} stroke="none" />;
  }
  if (shape === 'ring') {
    return <circle cx={x} cy={y} r={3.4} fill="none" stroke={color} strokeWidth={1.6} />;
  }
  // cross — BAD
  return (
    <g stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <line x1={x - 3.2} y1={y - 3.2} x2={x + 3.2} y2={y + 3.2} />
      <line x1={x - 3.2} y1={y + 3.2} x2={x + 3.2} y2={y - 3.2} />
    </g>
  );
}

export function ProfileChart({ observationId }: { observationId: string }) {
  const variable = useAnalysisStore((s) => s.variable);
  const availableTimes = useAnalysisStore((s) => s.availableTimes);
  const metadata = useDataStore((s) => s.metadata);
  const [reloadToken, setReloadToken] = useState(0);

  const { status, error, observation, modelColumn, modelTimestamp } = useProfileComparison(
    observationId,
    variable,
    availableTimes,
    reloadToken,
  );

  const meta = variableMeta(variable);
  const observed = observation ? buildObservedSeries(observation, variable) : [];
  const modeled = buildModeledSeries(modelColumn);

  const view = selectProfileChartView({
    variableSupported: variable === 'temperature' || variable === 'salinity',
    variableName: meta.name,
    status,
    error,
    observedCount: observed.length,
  });

  if (view.kind === 'unavailable-variable') {
    return (
      <div className={styles.wrap}>
        <UnavailableNote reason="Argo floats in this cache carry temperature and salinity only — no current or chlorophyll sensor.">
          <EmptyState
            label={`${view.variableName} — not measured by Argo`}
            detail="Switch to sea-water temperature or salinity to see this observation's profile."
          />
        </UnavailableNote>
      </div>
    );
  }
  if (view.kind === 'loading') {
    return (
      <div className={styles.wrap}>
        <LoadingState label="Loading real profile and model column…" />
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
  if (view.kind === 'no-valid-levels') {
    const detail = observation
      ? `This profile's QC summary is ${observation.qc} — every level either failed quality control or was never assigned a flag, so nothing real is plotted here rather than showing a fabricated curve.`
      : undefined;
    return (
      <div className={styles.wrap}>
        <EmptyState
          label={`No valid quality-controlled ${meta.name.toLowerCase()} levels`}
          {...(detail ? { detail } : {})}
        />
      </div>
    );
  }

  // view.kind === 'ready'
  const domain = computeChartDomain(observed, modeled);
  if (!domain || !observation) {
    // Unreachable given observedCount > 0 gated 'ready', but keeps the
    // component honest (no rendering with nulled-out data).
    return (
      <div className={styles.wrap}>
        <EmptyState label="No plottable data" />
      </div>
    );
  }

  const xOf = (v: number) =>
    MARGIN.left + ((v - domain.valueMin) / (domain.valueMax - domain.valueMin || 1)) * PLOT_W;
  const yOf = (d: number) => MARGIN.top + (d / (domain.depthMaxM || 1)) * PLOT_H;

  const observedSorted = [...observed].sort((a, b) => a.depthM - b.depthM);
  const modeledSorted = [...modeled].sort((a, b) => a.depthM - b.depthM);

  const observedPath = observedSorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.value).toFixed(2)} ${yOf(p.depthM).toFixed(2)}`)
    .join(' ');
  const modeledPath = modeledSorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.value).toFixed(2)} ${yOf(p.depthM).toFixed(2)}`)
    .join(' ');

  const depthTicks = niceTicks(0, domain.depthMaxM, 4);
  const valueTicks = niceTicks(domain.valueMin, domain.valueMax, 4);

  const qcCounts = observedSorted.reduce(
    (acc, p) => ({ ...acc, [p.qc]: (acc[p.qc] ?? 0) + 1 }),
    {} as Partial<Record<ObservedPoint['qc'], number>>,
  );

  const obsTimeLabel = observation.observedAt.slice(0, 16).replace('T', ' ') + ' UTC';
  const modelTimeLabel = modelColumn
    ? modelColumn.timestamp.slice(0, 16).replace('T', ' ') + ' UTC'
    : modelTimestamp
      ? 'requested, unavailable at this position'
      : 'unavailable — no real model timestamp to compare';
  // Real dataset name from the same provenance the app already loads
  // (dataStore.metadata.sources), never a hardcoded guess.
  const modelSourceName = metadata?.sources.find((s) =>
    s.datasetName.toLowerCase().includes('hycom'),
  )?.datasetName;

  const ariaLabel =
    `Depth profile of ${meta.name} for ${observation.platformName}: ` +
    `${observedSorted.length} real observed level${observedSorted.length === 1 ? '' : 's'} from ` +
    `${observedSorted[0]?.depthM ?? 0} to ${observedSorted.at(-1)?.depthM ?? 0} metres` +
    (modeledSorted.length > 0
      ? `, compared against ${modeledSorted.length} modelled level(s) from ${modelColumn?.timestamp ?? 'the nearest real model snapshot'}.`
      : '. No real model column is available at this position/time.');

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>FLOAT</span>
          <span className={styles.metaValue}>{observation.platformName}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>VARIABLE</span>
          <span className={styles.metaValue}>
            {meta.name} ({meta.unit})
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>OBSERVED</span>
          <span className={styles.metaValue}>{obsTimeLabel}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>MODEL TIME</span>
          <span className={styles.metaValue}>{modelTimeLabel}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>SOURCE</span>
          <span className={styles.metaValue}>
            {observation.provenance.datasetName}
            {modelColumn && modelSourceName ? ` · ${modelSourceName}` : ''}
          </span>
        </div>
      </div>

      <p className={styles.qcSummary}>
        {observedSorted.length} real level{observedSorted.length === 1 ? '' : 's'} plotted —{' '}
        {(['GOOD', 'PROBABLY_GOOD', 'SUSPECT', 'BAD'] as const)
          .filter((q) => qcCounts[q])
          .map((q) => `${qcCounts[q]} ${QUALITY[q].label}`)
          .join(' · ')}
      </p>

      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={ariaLabel}
      >
        {/* plot background */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="var(--surface-strip)"
          stroke="var(--border-faint)"
        />

        {/* depth gridlines + labels (y axis, increases downward) */}
        {depthTicks.map((d) => (
          <g key={`d-${d}`}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={yOf(d)}
              y2={yOf(d)}
              stroke="var(--border-faint)"
              strokeDasharray="2 3"
            />
            <text x={MARGIN.left - 6} y={yOf(d) + 3} textAnchor="end" className={styles.axisTick}>
              {Math.round(d)} m
            </text>
          </g>
        ))}

        {/* value gridlines + labels (x axis) */}
        {valueTicks.map((v) => (
          <g key={`v-${v}`}>
            <line
              x1={xOf(v)}
              x2={xOf(v)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              stroke="var(--border-faint)"
              strokeDasharray="2 3"
            />
            <text
              x={xOf(v)}
              y={MARGIN.top + PLOT_H + 14}
              textAnchor="middle"
              className={styles.axisTick}
            >
              {formatValue(variable, v, { withUnit: false })}
            </text>
          </g>
        ))}
        <text
          x={MARGIN.left + PLOT_W / 2}
          y={VIEW_H - 4}
          textAnchor="middle"
          className={styles.axisCaption}
        >
          {meta.axisLabel}
        </text>

        {/* modelled line — dashed, drawn first so the observed line/markers
            sit above it */}
        {modeledSorted.length > 0 && (
          <path d={modeledPath} fill="none" stroke="var(--cyan-deep)" strokeWidth={2} strokeDasharray="5 4" />
        )}

        {/* observed line + per-level QC markers */}
        {observedSorted.length > 0 && (
          <path d={observedPath} fill="none" stroke="var(--cyan-bright)" strokeWidth={1.6} />
        )}
        {observedSorted.map((p) => (
          <QcMarker key={p.depthM} x={xOf(p.value)} y={yOf(p.depthM)} qc={p.qc} />
        ))}
      </svg>

      {modeledSorted.length === 0 && (
        <p className={styles.modelGap}>
          No real model column is available for this observation&apos;s position/time — showing
          the observed profile only, not a fabricated comparison.
        </p>
      )}

      <ul className={styles.legend} aria-label="Chart legend">
        <li className={styles.legendItem}>
          <span className={styles.legendSwatchLine} style={{ background: 'var(--cyan-bright)' }} />
          Observed (Argo)
        </li>
        <li className={styles.legendItem}>
          <span
            className={styles.legendSwatchLine}
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--cyan-deep) 0 5px, transparent 5px 9px)',
            }}
          />
          Modelled (HYCOM, nearest real snapshot)
        </li>
        <li className={styles.legendItem}>
          <span className={styles.legendSwatchDot} style={{ color: `var(${QUALITY.GOOD.colorVar})` }}>
            ●
          </span>
          Good / probably good
        </li>
        <li className={styles.legendItem}>
          <span className={styles.legendSwatchDot} style={{ color: `var(${QUALITY.SUSPECT.colorVar})` }}>
            ○
          </span>
          Suspect
        </li>
        <li className={styles.legendItem}>
          <span className={styles.legendSwatchDot} style={{ color: `var(${QUALITY.BAD.colorVar})` }}>
            ✕
          </span>
          Bad
        </li>
      </ul>
    </div>
  );
}
