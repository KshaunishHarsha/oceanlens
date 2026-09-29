# Slide 3 — Feasibility and Viability

*(Analysis of the feasibility of the idea / Potential challenges and risks / Strategies for overcoming these challenges)*

> Same deck-wide framing rule as Slides 1, 2 and 4: confident present tense, full system scope, no hedging on whether OceanLens *works*. The one difference on this slide: naming real risks honestly is the actual content, not something to soften — the credibility of this slide comes from citing risks that were genuinely hit and fixed during build, not hypothetical ones. Bullets kept to one line each so they paste cleanly into the slide template.

## Layout guide

- **Left ~50%:** `Why This Is Feasible` text block.
- **Right ~50%:** `Risks` / `Strategy` paired as a 3-row table (Risk → Mitigation), matching a compact two-column layout.
- **Below, full width:** `Proven in Build` callout box (cream/highlight style, matching Slide 1/4's callout boxes) — the evidence that mitigations aren't theoretical.

---

## Why This Is Feasible

*(Template section: "Analysis of the feasibility of the idea".)*

- Every data source is public and already flowing: Argo GDAC (INCOIS is itself a DAC, 625+ real floats) and HYCOM GOFS 3.1 NCSS both confirmed reachable with no auth, no licensing negotiation, no procurement delay.
- The stack is entirely open-source and browser-native — React, Three.js, FastAPI, NumPy — no proprietary GIS engine, no GPU cluster, no native install; it runs on standard INCOIS server hardware and any modern browser.
- The hardest technical risk — real-time 3D rendering of scientific volumes in-browser — is already solved and running against real cached data, not a rendering proof-of-concept; the remaining work is data-feed breadth, not a new architecture.
- The phased, test-gated build process (Technical Approach) means feasibility is demonstrated incrementally, phase by phase, rather than asserted once at the end.

## Risks and Mitigations

*(Template sections: "Potential challenges and risks" + "Strategies for overcoming these challenges", paired.)*

| Risk | Mitigation |
|---|---|
| Source downloads can drop or truncate | Validate file size/integrity before caching |
| Model archive has a fixed end date | Auto-pull the latest snapshot on schedule, label the real date range |
| A wrong timestamp/variable could return a bad number | Compute per-request, never hard-code, cross-check independently |
| WebGL can lose context mid-session | Auto-detect and rebuild the scene on recovery |
| A bad sensor can look like a bad model | Surface real QC flags directly in the UI |
| Adding sensors/variables at scale | Variable-agnostic layer registry — add a data adapter, not a redesign |

## Proven in Build

*(Not hypothetical — every mitigation above was exercised against a real, documented failure during development.)*

- A truncated HYCOM download was caught live by the validation gate before it reached the cache.
- A real timestamp bug returned the wrong day's data; found and fixed with a regression test.
- A real WebGL crash turned the scene black mid-session; fixed with an automatic recovery path.
- A real Argo sensor was drifting by ~2 PSU while passing its own QC flag — caught by the same evidence loop built to check the model.

---

## Explicitly kept off this slide (belongs elsewhere)

- The core idea, workflow, and why it matters → **Proposed Solution**
- Architecture, stack, and methodology → **Technical Approach**
- Who benefits and the instrument-fault discovery in full → **Impact and Benefits**
- Data source citations/links → **Research and References**
