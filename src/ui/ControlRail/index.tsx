import { useDataStore } from '@/state/dataStore';
import { ErrorState, LoadingState } from '@/ui/states/StatusStates';
import { FieldConfiguration } from './FieldConfiguration';
import { LayerToggles } from './LayerToggles';
import { DepthControls } from './DepthControls';
import { ObservationFilters } from './ObservationFilters';
import { PlannedExtensions } from './PlannedExtensions';
import styles from './ControlRail.module.css';

export function ControlRail() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const retry = useDataStore((s) => s.retry);

  return (
    <aside className={styles.rail} aria-label="Controls">
      {status === 'loading' || status === 'idle' ? (
        <LoadingState label="Loading real data…" />
      ) : status === 'error' ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={retry} />
      ) : (
        <>
          <FieldConfiguration />
          <LayerToggles />
          <DepthControls />
          <ObservationFilters />
          <PlannedExtensions />
        </>
      )}
    </aside>
  );
}
