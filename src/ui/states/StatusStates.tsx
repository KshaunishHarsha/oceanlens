/* Shared loading / empty / error / unavailable presentational states.
 * Used wherever a panel is waiting on, missing, or denied real data — never
 * silently blank, and never filled with a placeholder that could be mistaken
 * for a value. */

import type { ReactNode } from 'react';
import styles from './StatusStates.module.css';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export function EmptyState({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className={styles.state}>
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">
        ▲
      </span>
      <span className={styles.label}>Could not reach the data service</span>
      <span className={styles.detail}>{message}</span>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Inline badge marking a layer/control as not backed by real data. */
export function UnavailableNote({ reason, children }: { reason: string; children?: ReactNode }) {
  return (
    <span className={styles.unavailableWrap} title={reason}>
      {children}
      <span className={styles.unavailableBadge}>UNAVAILABLE</span>
    </span>
  );
}
