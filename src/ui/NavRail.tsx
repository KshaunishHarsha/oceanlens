import styles from './NavRail.module.css';

const SECTIONS = [
  { id: 'operations', label: 'Operations' },
  { id: 'explore', label: 'Explore' },
  { id: 'investigations', label: 'Investigations' },
  { id: 'catalog', label: 'Data Catalog' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'reports', label: 'Reports' },
  { id: 'admin', label: 'Administration' },
] as const;

/** Only "Operations" is wired in the MVP; the rest are visibly present
 * (matching the artboard) but inert — never a dead control pretending to
 * work, always a control honestly marked not-yet-active. */
export function NavRail() {
  return (
    <nav className={styles.rail} aria-label="Primary">
      <div className={styles.mark} title="OceanLens India" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#4FC3D9" strokeWidth="1.2">
          <circle cx="13" cy="13" r="10.2" stroke="#2A4761" />
          <path d="M3.4 10.4c3.2 0 3.2 2.2 6.4 2.2s3.2-2.2 6.4-2.2 3.2 2.2 6.4 2.2" />
          <path d="M5.2 16c2.6 0 2.6 1.9 5.2 1.9s2.6-1.9 5.2-1.9 2.6 1.9 5.2 1.9" stroke="#2C7F92" />
        </svg>
      </div>
      <ul className={styles.sections}>
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={styles.section}
              data-active={i === 0}
              title={i === 0 ? s.label : `${s.label} — planned extension`}
              disabled={i !== 0}
              aria-current={i === 0 ? 'page' : undefined}
            >
              <span className={styles.dot} aria-hidden="true" />
              {s.label[0]}
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.spacer} />
      <span className={styles.incois}>INCOIS</span>
    </nav>
  );
}
