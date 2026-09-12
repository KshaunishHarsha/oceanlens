import { useEffect, useState } from 'react';
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
  const [controlsOpen, setControlsOpen] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(true);

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
          <div className={styles.leftPane} data-collapsed={!controlsOpen}>
            <div className={styles.paneContent}><ControlRail /></div>
            <button
              type="button"
              className={styles.paneToggle}
              data-side="left"
              onClick={() => setControlsOpen((open) => !open)}
              aria-expanded={controlsOpen}
              aria-label={controlsOpen ? 'Collapse controls panel' : 'Expand controls panel'}
              title={controlsOpen ? 'Collapse controls' : 'Expand controls'}
            >{controlsOpen ? '‹' : '›'}</button>
          </div>
          <SceneStage />
          <div className={styles.rightPane} data-collapsed={!evidenceOpen}>
            <button
              type="button"
              className={styles.paneToggle}
              data-side="right"
              onClick={() => setEvidenceOpen((open) => !open)}
              aria-expanded={evidenceOpen}
              aria-label={evidenceOpen ? 'Collapse evidence panel' : 'Expand evidence panel'}
              title={evidenceOpen ? 'Collapse evidence' : 'Expand evidence'}
            >{evidenceOpen ? '›' : '‹'}</button>
            <div className={styles.paneContent}><EvidencePanel /></div>
          </div>
        </div>
        <TimelineRail />
      </div>
    </div>
  );
}
