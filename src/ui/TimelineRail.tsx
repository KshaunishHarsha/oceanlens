import { useEffect, useRef } from 'react';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import styles from './TimelineRail.module.css';

const STEP_MS = 900; // per-frame interval at 1x

export function TimelineRail() {
  const status = useDataStore((s) => s.status);
  const times = useAnalysisStore((s) => s.availableTimes);
  const timeIndex = useAnalysisStore((s) => s.timeIndex);
  const timestamp = useAnalysisStore((s) => s.timestamp);
  const playback = useAnalysisStore((s) => s.playback);
  const togglePlayback = useAnalysisStore((s) => s.togglePlayback);
  const setPlaybackSpeed = useAnalysisStore((s) => s.setPlaybackSpeed);
  const stepTime = useAnalysisStore((s) => s.stepTime);
  const setTimeIndex = useAnalysisStore((s) => s.setTimeIndex);

  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playback.playing || times.length === 0) return undefined;
    const id = window.setInterval(() => stepTime(1), STEP_MS / playback.speed);
    return () => window.clearInterval(id);
  }, [playback.playing, playback.speed, times.length, stepTime]);

  if (status !== 'ready') {
    return <div className={styles.rail} aria-label="Timeline" />;
  }
  if (times.length === 0) {
    return (
      <div className={styles.rail} aria-label="Timeline">
        <span className={styles.empty}>No real model timestamps available.</span>
      </div>
    );
  }

  const pct = (i: number) => (times.length <= 1 ? 0 : (i / (times.length - 1)) * 100);

  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const seek = (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setTimeIndex(Math.round(p * (times.length - 1)));
    };
    seek(e.clientX);
    const onMove = (ev: MouseEvent) => seek(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className={styles.rail} aria-label="Timeline">
      <div className={styles.transport}>
        <div className={styles.clock}>
          <span className={styles.clockValue}>
            {timestamp ? timestamp.slice(11, 16) : '--:--'}
          </span>
          <span className={styles.clockDate}>
            {timestamp ? `UTC · ${timestamp.slice(0, 10)}` : ''}
          </span>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.playBtn}
            data-active={playback.playing}
            onClick={togglePlayback}
            aria-label={playback.playing ? 'Pause' : 'Play'}
          >
            {playback.playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => stepTime(-1)}
            aria-label="Step back"
          >
            ◂
          </button>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => stepTime(1)}
            aria-label="Step forward"
          >
            ▸
          </button>
          <div className={styles.speedGroup}>
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={styles.speedBtn}
                data-active={playback.speed === s}
                onClick={() => setPlaybackSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.scrubZone}>
        <div className={styles.scrubMeta}>
          <span>REAL MODEL TIMESTAMPS · {times.length} steps</span>
        </div>
        <div
          ref={trackRef}
          className={styles.track}
          onMouseDown={onScrub}
          role="slider"
          aria-label="Model timestamp"
          aria-valuemin={0}
          aria-valuemax={times.length - 1}
          aria-valuenow={timeIndex}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') stepTime(-1);
            if (e.key === 'ArrowRight') stepTime(1);
          }}
        >
          <div className={styles.trackLine} />
          {times.map((t, i) => (
            <div key={t} className={styles.tick} style={{ left: `${pct(i)}%` }}>
              <span className={styles.tickLabel}>{t.slice(5, 10)}</span>
            </div>
          ))}
          <div className={styles.playhead} style={{ left: `${pct(timeIndex)}%` }} />
        </div>
      </div>

      <div className={styles.activeView}>
        <span className={styles.activeCaption}>ACTIVE VIEW</span>
        <span className={styles.activeMeta}>
          step {timeIndex + 1} / {times.length}
        </span>
      </div>
    </div>
  );
}
