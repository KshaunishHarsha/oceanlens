/* Real Argo-observation search — replaces the "planned extension" search
 * placeholder CommandBar previously showed. Searches only the already-
 * loaded real observation list (src/state/searchObservations.ts); never
 * fetches, never fabricates a result. Selecting a result calls the same
 * existing analysisStore.selectObservation() every other selection path
 * (a scene marker click, EvidencePanel's picker) already uses, so the
 * Profile/Comparison/Provenance tabs behave identically regardless of how
 * the observation was selected. */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QUALITY } from '@/domain/quality';
import { useAnalysisStore } from '@/state/analysisStore';
import { useDataStore } from '@/state/dataStore';
import { searchObservations } from '@/state/searchObservations';
import styles from './CommandSearch.module.css';

interface DropdownRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

export function CommandSearch() {
  const status = useDataStore((s) => s.status);
  const observations = useDataStore((s) => s.observations);
  const selectObservation = useAnalysisStore((s) => s.selectObservation);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const ready = status === 'ready';
  const results = ready ? searchObservations(observations, query) : [];

  // The dropdown is portalled to document.body (see the render below) so it
  // can never be silently clipped by an ancestor's overflow — CommandBar's
  // own .bar needs `overflow-x: auto` for its own reason (see
  // CommandBar.module.css's comment on .badgeInternal), and per the CSS
  // overflow spec a non-"visible" overflow-x forces overflow-y to compute
  // as "auto" too, even though it was never set — confirmed live
  // (`getComputedStyle(bar).overflowY === 'auto'`), which silently clipped
  // this dropdown vertically before the portal was added. Being portalled
  // means position must be computed manually from the real input's
  // bounding rect, recomputed whenever the dropdown opens/resizes.
  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setDropdownRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 320) });
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [open]);

  // Global ⌘K / Ctrl+K focuses the search, from anywhere in the app —
  // matches the kbd hint this control has always shown.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close the dropdown on an outside click — a plain input+listbox has no
  // native dismiss behaviour of its own.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // Results are portalled to document.body to avoid CommandBar overflow
      // clipping, so they are not descendants of wrapRef. Treat both pieces
      // of the composite control as "inside" or a result's pointer-down
      // unmounts it before its click handler can select the observation.
      if (
        wrapRef.current &&
        !wrapRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (id: string) => {
    selectObservation(id);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIndex] ?? results[0];
      if (hit) choose(hit.id);
    }
  };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.field} data-disabled={!ready}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
          className={styles.icon}
        >
          <circle cx="7" cy="7" r="4.6" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="command-search-results"
          aria-autocomplete="list"
          aria-label="Search for a real Argo observation by id, platform name, or WMO number"
          className={styles.input}
          placeholder={ready ? 'Find an Argo float…' : 'Loading real observations…'}
          disabled={!ready}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {!query && <kbd className={styles.kbd}>⌘K</kbd>}
      </div>

      {open &&
        query.trim() &&
        dropdownRect &&
        createPortal(
          <ul
            ref={dropdownRef}
            id="command-search-results"
            role="listbox"
            className={styles.results}
            style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
          >
            {results.length === 0 ? (
              <li className={styles.empty} role="presentation">
                No real observation matches “{query.trim()}”
              </li>
            ) : (
              results.map((o, i) => (
                <li key={o.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    className={styles.result}
                    data-active={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(o.id)}
                  >
                    <span className={styles.resultName}>{o.platformName}</span>
                    <span className={styles.resultPos}>
                      {o.latitude.toFixed(2)}°N {o.longitude.toFixed(2)}°E
                    </span>
                    <span
                      className={styles.resultQc}
                      style={{ color: `var(${QUALITY[o.qc].colorVar})` }}
                    >
                      {o.qc}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
