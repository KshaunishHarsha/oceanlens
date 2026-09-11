import { useDataStore } from '@/state/dataStore';
import styles from './ProvenanceStrip.module.css';

export function ProvenanceStrip() {
  const metadata = useDataStore((s) => s.metadata);
  const status = useDataStore((s) => s.status);

  if (status !== 'ready' || !metadata) {
    return (
      <div className={styles.strip}>
        <span className={styles.dim}>
          {status === 'error' ? 'Provenance unavailable — data service unreachable' : 'Loading provenance…'}
        </span>
      </div>
    );
  }

  const modelSource = metadata.sources.find((s) => s.id.startsWith('hycom'));

  return (
    <div className={styles.strip}>
      <span className={styles.name}>{modelSource?.datasetName ?? metadata.title}</span>
      <span className={styles.sep}>/</span>
      <span>Window: {metadata.demonstrationWindow.start.slice(0, 10)}</span>
      <span className={styles.sep}>/</span>
      <span>{metadata.windowLabel}</span>
      <span className={styles.sep}>/</span>
      <span>
        Processing status: <span className={styles.good}>locally validated</span>
      </span>
      <span className={styles.sep}>/</span>
      <span>View ID: {metadata.viewId}</span>
      <span className={styles.grow} />
      <span className={styles.dim}>{metadata.region ? 'Bay of Bengal subset · Argo + HYCOM' : ''}</span>
    </div>
  );
}
