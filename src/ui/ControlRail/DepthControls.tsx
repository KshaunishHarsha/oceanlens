import { useRef } from 'react';
import {
  DEPTH_STOPS,
  MAX_EXAGGERATION,
  MIN_EXAGGERATION,
  useAnalysisStore,
} from '@/state/analysisStore';
import styles from './ControlRail.module.css';

function pctFromDepth(d: number): number {
  for (let i = 1; i < DEPTH_STOPS.length; i++) {
    const b = DEPTH_STOPS[i]!;
    if (d <= b) {
      const a = DEPTH_STOPS[i - 1]!;
      return ((i - 1 + (d - a) / (b - a)) / (DEPTH_STOPS.length - 1)) * 100;
    }
  }
  return 100;
}

function depthFromPct(p: number): number {
  const seg = Math.min(DEPTH_STOPS.length - 2, Math.floor((p / 100) * (DEPTH_STOPS.length - 1)));
  const segSpan = 100 / (DEPTH_STOPS.length - 1);
  const f = (p - seg * segSpan) / segSpan;
  const a = DEPTH_STOPS[seg]!;
  const b = DEPTH_STOPS[seg + 1]!;
  return Math.round((a + (b - a) * f) / 5) * 5;
}

export function DepthControls() {
  const depthM = useAnalysisStore((s) => s.depthM);
  const setDepth = useAnalysisStore((s) => s.setDepth);
  const exaggeration = useAnalysisStore((s) => s.verticalExaggeration);
  const setExaggeration = useAnalysisStore((s) => s.setVerticalExaggeration);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = pctFromDepth(depthM);

  const onDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const move = (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setDepth(depthFromPct(p));
    };
    move(e.clientX);
    const onMove = (ev: MouseEvent) => move(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.caption}>DEPTH &amp; VERTICAL PERCEPTION</span>
      </div>
      <div className={styles.depthReadout}>
        <span className={styles.depthValue}>{depthM}</span>
        <span className={styles.depthUnit}>m</span>
        <span className={styles.grow} />
        <span className={styles.mutedSmall}>below sea surface</span>
      </div>
      <div
        ref={trackRef}
        className={styles.depthTrack}
        onMouseDown={onDrag}
        role="slider"
        aria-label="Depth"
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-valuenow={depthM}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setDepth(Math.max(0, depthM - 5));
          if (e.key === 'ArrowRight') setDepth(Math.min(1000, depthM + 5));
        }}
      >
        <div className={styles.depthTrackBg} />
        <div className={styles.depthTrackFill} style={{ width: `${pct}%` }} />
        <div className={styles.depthKnob} style={{ left: `${pct}%` }} />
      </div>
      <div className={styles.depthTicks}>
        {['Surface', '50', '100', '250', '500', '1000'].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      <div className={styles.exagRow}>
        <span className={styles.mutedSmall}>Vertical exaggeration</span>
        <span className={styles.grow} />
        <div className={styles.stepper}>
          <button
            type="button"
            onClick={() => setExaggeration(Math.max(MIN_EXAGGERATION, exaggeration - 2))}
            aria-label="Decrease exaggeration"
          >
            −
          </button>
          <span className={styles.stepperValue}>{exaggeration}×</span>
          <button
            type="button"
            onClick={() => setExaggeration(Math.min(MAX_EXAGGERATION, exaggeration + 2))}
            aria-label="Increase exaggeration"
          >
            +
          </button>
        </div>
      </div>
      <p className={styles.footnote}>
        Visual exaggeration only. Depths and distances remain metrically labelled.
      </p>
    </section>
  );
}
