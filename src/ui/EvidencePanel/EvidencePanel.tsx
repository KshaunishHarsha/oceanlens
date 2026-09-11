import { QUALITY } from '@/domain/quality';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { filterObservations } from '@/state/filterObservations';
import { EmptyState, ErrorState, LoadingState } from '@/ui/states/StatusStates';
import styles from './EvidencePanel.module.css';

function ObservationPicker() {
  const observations = useDataStore((s) => s.observations);
  const collocatedIds = useDataStore((s) => s.collocatedObservationIds);
  const filters = useAnalysisStore((s) => s.filters);
  const selectObservation = useAnalysisStore((s) => s.selectObservation);

  // Shared with the scene's markers (src/ui/scene/ThreeSceneCanvas.tsx) so
  // the panel's list and the clickable markers never disagree about which
  // real observations the current filters allow.
  const filtered = filterObservations(observations, filters, collocatedIds);

  if (filtered.length === 0) {
    return (
      <EmptyState
        label="No observations match the current filters"
        detail="Adjust the platform, DAC, or QC filters in the control rail."
      />
    );
  }

  return (
    <div className={styles.picker}>
      <div className={styles.pickerHeader}>
        <span className={styles.caption}>SELECT AN OBSERVATION</span>
        <span className={styles.count}>{filtered.length} shown</span>
      </div>
      <p className={styles.pickerHint}>
        Click a marker in the scene, or pick a real observation here — both select the
        same record.
      </p>
      <ul className={styles.pickerList}>
        {filtered.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className={styles.pickerRow}
              onClick={() => selectObservation(o.id)}
            >
              <span className={styles.pickerId}>{o.platformName}</span>
              <span className={styles.pickerPos}>
                {o.latitude.toFixed(2)}°N {o.longitude.toFixed(2)}°E
              </span>
              <span
                className={styles.pickerQc}
                style={{ color: `var(${QUALITY[o.qc].colorVar})` }}
              >
                {o.qc}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ObservationHeader({ id }: { id: string }) {
  const observations = useDataStore((s) => s.observations);
  const selectObservation = useAnalysisStore((s) => s.selectObservation);
  const obs = observations.find((o) => o.id === id);

  if (!obs) {
    return (
      <EmptyState label="Observation no longer in the filtered list" />
    );
  }

  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        <span className={styles.caption}>OBSERVATION RECORD</span>
        <button type="button" className={styles.clear} onClick={() => selectObservation(null)}>
          Clear
        </button>
      </div>
      <div className={styles.headerTitle}>
        <span className={styles.platformName}>{obs.platformName}</span>
        <span className={styles.platformKind}>{obs.platformType}</span>
      </div>
      <div className={styles.headerMeta}>
        {obs.latitude.toFixed(3)}°N, {obs.longitude.toFixed(3)}°E · {obs.observedAt.slice(0, 16).replace('T', ' ')} UTC
      </div>
      <div className={styles.headerMeta}>
        QC: <span style={{ color: `var(${QUALITY[obs.qc].colorVar})` }}>{QUALITY[obs.qc].label}</span>
        {obs.identity && (
          <>
            {' '}
            · DAC: {obs.identity.dataCentre} · WMO {obs.identity.wmo} · cycle {obs.identity.cycleNumber}
          </>
        )}
      </div>
    </div>
  );
}

function TabBody({ tab, id }: { tab: string; id: string }) {
  const observations = useDataStore((s) => s.observations);
  const obs = observations.find((o) => o.id === id);

  if (tab === 'profile') {
    return (
      <EmptyState
        label="Profile chart — implemented in a later phase"
        detail="Depth-resolved temperature/salinity curves and the RMSE/bias tiles render here once the evidence-panel phase begins."
      />
    );
  }
  if (tab === 'comparison') {
    return (
      <EmptyState
        label="Model-vs-observation comparison — implemented in a later phase"
        detail="Depth-band agreement and collocation diagrams render here once the evidence-panel phase begins."
      />
    );
  }
  // provenance — real, simple field list; not the full processing-chain diagram
  const src = obs?.provenance;
  if (!src) return <EmptyState label="No provenance available for this observation" />;
  const rows: [string, string][] = [
    ['Dataset', src.datasetName],
    ['Originator', src.originator],
    ['Status', src.status],
    ['Source URL', src.sourceUrl ?? '—'],
    ['Retrieved', src.retrievedAt ?? '—'],
    ['Coordinate system', src.coordinateSystem],
    ['QC convention', src.qcConvention ?? '—'],
  ];
  return (
    <div className={styles.provList}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.provRow}>
          <span className={styles.provKey}>{k}</span>
          <span className={styles.provValue}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function EvidencePanel() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const retry = useDataStore((s) => s.retry);

  const mode = useAnalysisStore((s) => s.mode);
  const evidenceTab = useAnalysisStore((s) => s.evidenceTab);
  const setEvidenceTab = useAnalysisStore((s) => s.setEvidenceTab);
  const selectedId = useAnalysisStore((s) => s.selectedObservationId);

  if (status === 'loading' || status === 'idle') {
    return (
      <aside className={styles.panel} aria-label="Evidence">
        <LoadingState label="Loading real observations…" />
      </aside>
    );
  }
  if (status === 'error') {
    return (
      <aside className={styles.panel} aria-label="Evidence">
        <ErrorState message={error ?? 'Unknown error'} onRetry={retry} />
      </aside>
    );
  }

  if (mode === 'briefing') {
    return (
      <aside className={styles.panel} aria-label="Evidence">
        <div className={styles.header}>
          <span className={styles.caption}>BRIEFING MODE — SHELL</span>
        </div>
        <div className={styles.provList}>
          <p className={styles.pickerHint}>
            A generated situation/evidence/confidence/relevance briefing renders here in a
            later phase, built from the selected observation&apos;s real collocation result.
          </p>
        </div>
      </aside>
    );
  }
  if (mode === 'outreach') {
    return (
      <aside className={styles.panel} aria-label="Evidence">
        <div className={styles.header}>
          <span className={styles.caption}>OCEAN EXPLORER — SHELL</span>
        </div>
        <div className={styles.provList}>
          <p className={styles.pickerHint}>
            A public, plain-language explanation of the selected view renders here in a later
            phase — real data, no jargon, no operational chrome.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Evidence">
      {selectedId ? <ObservationHeader id={selectedId} /> : <ObservationPicker />}

      {selectedId && (
        <>
          <div className={styles.tabs}>
            {(['profile', 'comparison', 'provenance'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={styles.tab}
                data-active={evidenceTab === t}
                onClick={() => setEvidenceTab(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={styles.tabBody}>
            <TabBody tab={evidenceTab} id={selectedId} />
          </div>
        </>
      )}
    </aside>
  );
}
