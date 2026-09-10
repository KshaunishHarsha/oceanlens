/* Phase 1 foundation screen.
 *
 * This is scaffolding, not the product. It exists to prove the toolchain boots,
 * the tokens resolve, and the store is live. The real shell is Phase 3 and will
 * replace this file entirely. It is deliberately labelled so that nobody
 * mistakes it for a working interface. */

import { OCEAN_VARIABLES, VARIABLES } from '@/domain/variables';
import { PLATFORM_TYPES, PLATFORMS } from '@/domain/platforms';
import { QUALITY } from '@/domain/quality';
import { DATA_STATUS } from '@/domain/provenance';
import { useAnalysisStore } from '@/state/analysisStore';

const caption: React.CSSProperties = {
  fontSize: 'var(--fs-caption)',
  letterSpacing: 'var(--ls-caption)',
  color: 'var(--text-label)',
  fontWeight: 600,
  marginBottom: 10,
};

const card: React.CSSProperties = {
  background: 'var(--surface-panel)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 16px',
};

export function App() {
  const variable = useAnalysisStore((s) => s.variable);
  const depthM = useAnalysisStore((s) => s.depthM);
  const exaggeration = useAnalysisStore((s) => s.verticalExaggeration);
  const setVariable = useAnalysisStore((s) => s.setVariable);
  const setDepth = useAnalysisStore((s) => s.setDepth);

  const meta = VARIABLES[variable];

  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-stage)', padding: 28 }}>
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 'var(--fs-title)', fontWeight: 600 }}>OceanLens India</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              letterSpacing: 'var(--ls-badge)',
              color: 'var(--warn)',
              border: '1px solid var(--warn-edge)',
              borderRadius: 'var(--radius)',
              padding: '3px 6px',
            }}
          >
            PHASE 1 FOUNDATION — NOT THE PRODUCT UI
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body)', maxWidth: 720 }}>
          Toolchain, design tokens, domain model and analysis store only. No data is loaded
          and no scientific claim is made on this screen. The operational interface is built
          in Phase 3.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 14,
          maxWidth: 1400,
        }}
      >
        <section style={card}>
          <div style={caption}>LIVE STORE — VARIABLE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {OCEAN_VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => setVariable(v)}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--fs-body)',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  color: v === variable ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: v === variable ? 'var(--surface-selected)' : 'transparent',
                  border: `1px solid ${v === variable ? 'var(--cyan-edge)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius)',
                }}
              >
                {VARIABLES[v].abbr} · {VARIABLES[v].name}
              </button>
            ))}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-small)',
              color: 'var(--text-tertiary)',
              display: 'grid',
              gap: 3,
            }}
          >
            <div>unit: {meta.unit}</div>
            <div>CF: {meta.cfStandardName}</div>
            <div>
              range: {meta.defaultRange[0]} – {meta.defaultRange[1]}
            </div>
            <div>isosurface: {meta.isoName}</div>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 'var(--radius-sm)',
              marginTop: 10,
              border: '1px solid var(--border-faint)',
              background: `var(${meta.rampVar})`,
            }}
          />
        </section>

        <section style={card}>
          <div style={caption}>LIVE STORE — DEPTH</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-display)',
                color: 'var(--text-primary)',
              }}
            >
              {depthM}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>m</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>
              exaggeration {exaggeration}×
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={5}
            value={depthM}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{ width: '100%', marginTop: 12, accentColor: 'var(--cyan-edge)' }}
          />
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: '8px 0 0' }}>
            Linear slider is placeholder only. The product uses the artboard's non-linear
            depth scale (0 / 50 / 100 / 250 / 500 / 1000).
          </p>
        </section>

        <section style={card}>
          <div style={caption}>QUALITY VOCABULARY (ARGO-DERIVED)</div>
          <div style={{ display: 'grid', gap: 7 }}>
            {Object.values(QUALITY).map((q) => (
              <div key={q.flag} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-caption)',
                    letterSpacing: 'var(--ls-badge)',
                    color: `var(${q.colorVar})`,
                    border: `1px solid var(${q.colorVar})`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '1px 5px',
                    flex: 'none',
                  }}
                >
                  {q.label}
                </span>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                  {q.explanation}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section style={card}>
          <div style={caption}>DATA STATUS VOCABULARY</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {Object.values(DATA_STATUS).map((d) => (
              <div key={d.status} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: `var(${d.colorVar})`,
                    flex: 'none',
                  }}
                />
                <span style={{ fontSize: 'var(--fs-small)', color: 'var(--text-secondary)' }}>
                  {d.label}
                </span>
                <span style={{ flex: 1 }} />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-caption)',
                    color: d.renderable ? 'var(--good)' : 'var(--text-disabled)',
                  }}
                >
                  {d.renderable ? 'renderable' : 'shown as unavailable'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section style={card}>
          <div style={caption}>PLATFORM CLASSES</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {PLATFORM_TYPES.map((p) => {
              const m = PLATFORMS[p];
              return (
                <div key={p} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                  <span style={{ color: `var(${m.colorVar})`, width: 12, textAlign: 'center' }}>
                    {m.glyph}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-body)',
                      letterSpacing: 'var(--ls-badge)',
                    }}
                  >
                    {m.label}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                    {m.description}
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: '10px 0 0' }}>
            All classes are typed. Which are actually available is decided by the Phase 2 data
            build, not by this list.
          </p>
        </section>
      </div>
    </div>
  );
}
