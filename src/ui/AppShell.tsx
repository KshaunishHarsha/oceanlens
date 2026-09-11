import { useEffect } from 'react';
import { useDataStore } from '@/state/dataStore';
import { NavRail } from './NavRail';
import { CommandBar } from './CommandBar';
import { ProvenanceStrip } from './ProvenanceStrip';
import { ControlRail } from './ControlRail';
import { SceneStage } from './SceneStage';
import { EvidencePanel } from './EvidencePanel/EvidencePanel';
import { TimelineRail } from './TimelineRail';
import styles from './AppShell.module.css';

export function AppShell() {
  const initialize = useDataStore((s) => s.initialize);
  const status = useDataStore((s) => s.status);

  useEffect(() => {
    if (status === 'idle') void initialize();
  }, [status, initialize]);

  return (
    <div className={styles.root}>
      <NavRail />
      <div className={styles.column}>
        <CommandBar />
        <ProvenanceStrip />
        <div className={styles.middle}>
          <ControlRail />
          <SceneStage />
          <EvidencePanel />
        </div>
        <TimelineRail />
      </div>
    </div>
  );
}
