/* Phase 5A step 3 — provenance: data origin, timing, processing, quality.
 *
 * Deliberately does NOT repeat RMSE, mean bias, the profile line, or
 * depth-band agreement — those are ProfileChart's and CollocationPanel's
 * job. This tab answers a different question: where did this data come
 * from, when was it retrieved, what was done to it before it reached the
 * screen, and what should a scientist know before trusting it. Every field
 * is read from provenance already loaded by dataStore (the observation's
 * own `.provenance`, and `dataStore.layers` from the existing
 * getLayerRegistry() call) — no new fetch, no recomputation. */

import { DATA_STATUS, type DataSourceDescriptor } from '@/domain/provenance';
import { variableMeta } from '@/domain/variables';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { EmptyState } from '@/ui/states/StatusStates';
import {
  formatRetrievedAt,
  formatSourceVariables,
  formatTemporalCoverage,
  modelLayerIdForVariable,
} from './provenanceView';
import styles from './ProvenancePanel.module.css';

function StatusBadge({ source }: { source: DataSourceDescriptor }) {
  const d = DATA_STATUS[source.status];
  return (
    <span className={styles.statusBadge} style={{ color: `var(${d.colorVar})` }}>
      {d.label}
    </span>
  );
}

function SourceBlock({ title, source }: { title: string; source: DataSourceDescriptor }) {
  const unavailable = source.status === 'NOT_AVAILABLE_MVP' || source.status === 'PLANNED_EXTENSION';
  return (
    <section className={styles.block}>
      <div className={styles.blockHeader}>
        <span className={styles.blockTitle}>{title}</span>
        <StatusBadge source={source} />
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Dataset</span>
        <span className={styles.rowValue}>{source.datasetName}</span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Originator</span>
        <span className={styles.rowValue}>{source.originator}</span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Source URL</span>
        <span className={styles.rowValue}>
          {source.sourceUrl ? (
            <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
              {source.sourceUrl}
            </a>
          ) : (
            '—'
          )}
        </span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Retrieved</span>
        <span className={styles.rowValue}>{formatRetrievedAt(source.retrievedAt)}</span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Variable(s)</span>
        <span className={styles.rowValue}>{formatSourceVariables(source)}</span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Coordinate system</span>
        <span className={styles.rowValue}>{source.coordinateSystem}</span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>Temporal coverage</span>
        <span className={styles.rowValue}>{formatTemporalCoverage(source.temporal)}</span>
      </div>
      <div className={styles.blockRow}>
        <span className={styles.rowKey}>QC convention</span>
        <span className={styles.rowValue}>{source.qcConvention ?? '—'}</span>
      </div>

      {source.transformations.length > 0 && (
        <div className={styles.stepsWrap}>
          <span className={styles.rowKey}>Processing steps</span>
          <ol className={styles.stepsList}>
            {source.transformations.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      {source.caveats.length > 0 && (
        <div className={styles.stepsWrap}>
          <span className={styles.rowKey}>Caveats</span>
          <ul className={styles.caveatsList}>
            {source.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {source.licence && (
        <div className={styles.blockRow}>
          <span className={styles.rowKey}>Licence</span>
          <span className={styles.rowValue}>{source.licence}</span>
        </div>
      )}

      {unavailable && (
        <p className={styles.unavailableNote}>
          {source.caveats[0] ??
            'Investigated; no usable real source found for this build. Not shown as live or forecast data.'}
        </p>
      )}
    </section>
  );
}

export function ProvenancePanel({ observationId }: { observationId: string }) {
  const variable = useAnalysisStore((s) => s.variable);
  const observations = useDataStore((s) => s.observations);
  const layers = useDataStore((s) => s.layers);
  const metadata = useDataStore((s) => s.metadata);

  const obs = observations.find((o) => o.id === observationId);
  if (!obs) {
    return <EmptyState label="No provenance available for this observation" />;
  }

  const modelLayerId = modelLayerIdForVariable(variable);
  const modelLayer = layers?.[modelLayerId];
  const meta = variableMeta(variable);

  return (
    <div className={styles.wrap}>
      {metadata && (
        <div className={styles.window}>
          <span className={styles.windowLabel}>{metadata.windowLabel}</span>
          <span className={styles.windowDates}>
            {metadata.demonstrationWindow.start.slice(0, 10)} →{' '}
            {metadata.demonstrationWindow.end.slice(0, 10)} · {metadata.regionName}
          </span>
        </div>
      )}

      <SourceBlock title="OBSERVATION SOURCE — this float's real data" source={obs.provenance} />

      {modelLayer ? (
        <SourceBlock title={`MODEL SOURCE — ${meta.name}`} source={modelLayer.source} />
      ) : (
        <EmptyState label={`No registry entry for ${meta.name}'s model source`} />
      )}
    </div>
  );
}
