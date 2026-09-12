/* Model-only analysis for a deliberate click anywhere on the real slice.
 * It never presents a validation metric because no observation is implied. */
import { useEffect, useState } from 'react';
import type { ModelColumn, ModelAnalysisPoint } from '@/domain/types';
import { variableMeta } from '@/domain/variables';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { EmptyState, ErrorState, LoadingState } from '@/ui/states/StatusStates';
import styles from './ModelPointPanel.module.css';

export function ModelPointPanel({ point }: { point: ModelAnalysisPoint }) {
  const adapter = useDataStore((s) => s.adapter);
  const variable = useAnalysisStore((s) => s.variable);
  const timestamp = useAnalysisStore((s) => s.timestamp);
  const meta = variableMeta(variable);
  const [column, setColumn] = useState<ModelColumn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!adapter || !timestamp) return;
    let active = true;
    setLoading(true); setError(null); setColumn(null);
    adapter.getModelColumn({ variable, timestamp, ...point }).then((value) => {
      if (active) setColumn(value);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adapter, variable, timestamp, point.latitude, point.longitude, retry]);

  if (loading) return <LoadingState label="Loading real model column…" />;
  if (error) return <ErrorState message={error} onRetry={() => setRetry((n) => n + 1)} />;
  if (!column) return <EmptyState label="No model column available at this point" />;
  const levels = column.depthsM.map((depth, index) => ({ depth, value: column.values[index] })).filter((x) => x.value !== null);
  return <section className={styles.wrap} aria-label="Model-only location analysis">
    <span className={styles.caption}>MODEL-ONLY LOCATION ANALYSIS</span>
    <h2>{meta.name} profile</h2>
    <p className={styles.note}>No Argo observation is selected here, so this is a model result—not a validated comparison. RMSE and bias are intentionally not shown.</p>
    <dl className={styles.meta}><div><dt>LOCATION</dt><dd>{point.latitude.toFixed(3)}°N, {point.longitude.toFixed(3)}°E</dd></div><div><dt>MODEL TIME</dt><dd>{column.timestamp.slice(0, 16).replace('T', ' ')} UTC</dd></div><div><dt>GRID LEVELS</dt><dd>{levels.length} real values</dd></div></dl>
    <div className={styles.profile}>{levels.map(({ depth, value }) => <div key={depth}><span>{depth} m</span><strong>{value!.toFixed(2)} {meta.unit}</strong></div>)}</div>
  </section>;
}
