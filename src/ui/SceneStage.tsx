import { VARIABLES } from '@/domain/variables';
import { QUALITY } from '@/domain/quality';
import { DEPTH_STOPS, useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { filterObservations } from '@/state/filterObservations';
import { EmptyState, ErrorState, LoadingState } from '@/ui/states/StatusStates';
import { ThreeSceneCanvas } from '@/ui/scene/ThreeSceneCanvas';
import { useVolumeSlice } from '@/ui/scene/useVolumeSlice';
import { useCoastline } from '@/ui/scene/useCoastline';
import { selectSceneStageView } from '@/ui/scene/sceneStageState';
import styles from './SceneStage.module.css';

/**
 * A real Three.js/WebGL scene: one textured horizontal plane, at the
 * selected real depth, coloured from a real model depth slice fetched
 * through the existing OceanDataAdapter boundary, plus real Argo markers
 * (Phase 4A step 2) positioned by real lat/lon and filtered by the same
 * rules as EvidencePanel's observation list. Not volumetric — a single
 * slice plane, no volume/isosurface yet. Every loading/error/unavailable
 * state that existed in the Phase 3 shell is preserved.
 */
export function SceneStage() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const retry = useDataStore((s) => s.retry);
  const metadata = useDataStore((s) => s.metadata);
  const availability = useDataStore((s) => s.variableAvailability);
  const observations = useDataStore((s) => s.observations);
  const collocatedIds = useDataStore((s) => s.collocatedObservationIds);

  const variable = useAnalysisStore((s) => s.variable);
  const depthM = useAnalysisStore((s) => s.depthM);
  const timestamp = useAnalysisStore((s) => s.timestamp);
  const exaggeration = useAnalysisStore((s) => s.verticalExaggeration);
  const opacity = useAnalysisStore((s) => s.opacity);
  const filters = useAnalysisStore((s) => s.filters);
  const selectedObservationId = useAnalysisStore((s) => s.selectedObservationId);
  const selectedModelPoint = useAnalysisStore((s) => s.selectedModelPoint);
  const hoveredObservationId = useAnalysisStore((s) => s.hoveredObservationId);
  const selectObservation = useAnalysisStore((s) => s.selectObservation);
  const hoverObservation = useAnalysisStore((s) => s.hoverObservation);
  const selectModelPoint = useAnalysisStore((s) => s.selectModelPoint);

  // Shared with EvidencePanel's picker (src/state/filterObservations.ts) so
  // a marker clickable here is always the same set shown there.
  const filteredObservations = filterObservations(observations, filters, collocatedIds);
  const selectedObservation = selectedObservationId
    ? observations.find((o) => o.id === selectedObservationId)
    : undefined;

  const meta = VARIABLES[variable];
  const variableReady = status === 'ready' && Boolean(availability[variable]) && Boolean(timestamp);

  // Hooks must run unconditionally; the hook itself no-ops (status: 'idle')
  // until there is an adapter, a real timestamp, and this branch is reached.
  const sliceQuery = useVolumeSlice(variable, variableReady ? timestamp : null, depthM);
  // Real vendored coastline reference (scripts/prepare-coastline.mjs) —
  // fetched once regardless of which branch below ends up rendering;
  // ThreeSceneCanvas treats a still-loading/failed coastline (data: null)
  // as "draw nothing", never a fabricated placeholder outline.
  const coastlineQuery = useCoastline();

  // Branch selection is a pure function (sceneStageState.ts) rather than
  // inline ternaries, specifically so it's unit-testable independent of
  // Zustand's SSR snapshot behaviour — see that module's doc comment.
  const view = selectSceneStageView({
    dataStatus: status,
    dataError: error,
    variableAvailable: Boolean(availability[variable]),
    variableName: meta.name,
    timestamp,
  });

  return (
    <div className={styles.stage}>
      {view.kind === 'loading' ? (
        <LoadingState label="Loading regional grid and model volume…" />
      ) : view.kind === 'error' ? (
        <ErrorState message={view.message} onRetry={retry} />
      ) : view.kind === 'unavailable' ? (
        <EmptyState
          label={`${view.variableName} — not available in MVP`}
          detail="No real cached source exists for this variable. Select a different field."
        />
      ) : view.kind === 'no-timestamps' ? (
        <EmptyState label="No timestamps loaded" detail="The real model timestamp axis is empty." />
      ) : (
        <>
          {sliceQuery.status === 'loading' && !sliceQuery.slice ? (
            <LoadingState label={`Loading ${meta.name.toLowerCase()} depth slice…`} />
          ) : sliceQuery.status === 'error' ? (
            <ErrorState
              message={sliceQuery.error ?? 'Unknown error'}
              onRetry={() => {
                /* re-triggered by the effect when any dependency changes; a
                 * manual nudge here would require re-plumbing the request id,
                 * so point the user at the one control that always works. */
              }}
            />
          ) : sliceQuery.slice ? (
            <ThreeSceneCanvas
              slice={sliceQuery.slice}
              palette={meta.palette}
              domainRange={meta.defaultRange}
              depthM={depthM}
              exaggeration={exaggeration}
              opacity={opacity}
              observations={filteredObservations}
              selectedObservationId={selectedObservationId}
              hoveredObservationId={hoveredObservationId}
              onSelectObservation={selectObservation}
              onHoverObservation={hoverObservation}
              onSelectModelPoint={selectModelPoint}
              selectedModelPoint={selectedModelPoint}
              coastline={coastlineQuery.data}
            />
          ) : null}

          {/* Screen-reader announcement for marker selection — the canvas
              itself has no accessible fallback for clicking a marker, but
              EvidencePanel's observation list (always present, keyboard-
              operable) selects the same real record via the same store
              action, so this is a supplement to that path, not the only
              way in. */}
          <div className={styles.srAnnounce} role="status" aria-live="polite">
            {selectedObservation
              ? `Selected ${selectedObservation.platformName}, ${QUALITY[selectedObservation.qc].label} quality, at ${selectedObservation.latitude.toFixed(2)} degrees north, ${selectedObservation.longitude.toFixed(2)} degrees east.`
              : ''}
          </div>

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

          <div className={styles.stateBadges}>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>VARIABLE</span>
              <span className={styles.readoutValue}>{meta.name}</span>
            </span>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>DEPTH</span>
              <span className={styles.readoutValue}>
                −{sliceQuery.slice?.depthM ?? depthM} m
              </span>
            </span>
            <span className={styles.readout}>
              <span className={styles.readoutLabel}>TIME</span>
              <span className={styles.readoutValue}>
                {timestamp ? `${timestamp.slice(0, 16).replace('T', ' ')} UTC` : '—'}
              </span>
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
            <div className={styles.markerLegend}>
              <span className={styles.markerLegendItem}>
                <span className={styles.markerDot} data-qc="GOOD" /> Good / probably good
              </span>
              <span className={styles.markerLegendItem}>
                <span className={styles.markerDot} data-qc="SUSPECT" /> Suspect
              </span>
              <span className={styles.markerLegendItem}>
                <span className={styles.markerDot} data-qc="BAD" /> Bad
              </span>
              <span className={styles.markerLegendItem}>
                <span className={styles.markerRingSample} /> Selected
              </span>
            </div>
            <div className={styles.markerLegendNote}>
              {filteredObservations.length} of {observations.length} real observations shown
              (current filters)
            </div>
          </div>

          <div className={styles.depthRuler}>
            <div className={styles.depthRulerTitle}>DEPTH REFERENCE</div>
            <div className={styles.depthTickList}>
              {DEPTH_STOPS.map((d) => (
                <span key={d} className={styles.depthTick} data-active={d === depthM}>
                  <span className={styles.depthTickMark} aria-hidden="true" />
                  {d === 0 ? 'surface' : `${d} m`}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
