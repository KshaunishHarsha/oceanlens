# OceanLens India — intro video composition

**Deliverable:** one ~58s MP4 that plays *before* the live prototype walkthrough. It
carries the entire "what is this and why does it matter" load — Slide 1's content — so
that when it ends, the presenter cuts straight to driving the app with nothing left to
explain.

| | |
|---|---|
| Duration | **58.0s** |
| Format | 1920×1080, 30fps, MP4 |
| Audio | none in the render — presenter lays facecam + voiceover over it |
| Project | `videos/oceanlens-intro/` |
| Composition | `compositions/index.html` (replaces the current 6.5s sting; Scene 0 *is* the sting, retimed) |

**Framing rule (inherited from `slides/slide-01-proposed-solution.md`):** confident
present tense, full-system scope — every sensor type, near-real-time model feed,
INCOIS-wide operational use. No "planned", "proposed", "designed to". The screenshots
are here because they are real and look good, not as a disclaimer.

**Honesty rule (inherited from `CLAUDE.md`):** on-screen text near a screenshot never
labels the cached demo data as live, verified or official. Describe the *system* in
present tense; label the *capture* accurately. These do not conflict — Slide 1 already
resolved it this way.

---

## Assets to stage before build

Copy into `videos/oceanlens-intro/assets/` (the composition must not reach outside its
own project directory):

| Source | Destination | Used in |
|---|---|---|
| `slides/screenshots/slide1-fig1-3d-scene.png` | `assets/scene-3d.png` | Scene 2 |
| `slides/screenshots/slide1-fig2-profile-chart.png` | `assets/panel-profile.png` | Scene 3a |
| `slides/screenshots/slide1-fig3-comparison-stats.png` | `assets/panel-comparison.png` | Scene 3b |

No new assets need sourcing — every visual is either the existing screenshots or
code-drawn type/geometry.

**Palette** (already in the sting, keep as the single `:root` token set):
`--bg-deep #03101c` · `--bg-mid #061c30` · `--ink #eaf4fb` · `--ink-soft #8fb2c8` ·
`--cyan #35e0e8` · `--cyan-deep #1b8fa6` · `--amber #f5b544` · `--good #35c99a` ·
`--bad #f4736b`

**Type:** Inter — 104px/600 wordmark, 58px/600 scene headline, 30px/500 uppercase
0.26em label, 23px/400 body.

---

## Scene map

| # | Window | Beat | Hero visual |
|---|---|---|---|
| 0 | 0:00–0:06.5 | Sting (existing) | Depth slabs + float + wordmark |
| 1 | 0:06.5–0:15.5 | The problem | Split screen, two columns that never meet |
| 2 | 0:15.5–0:28.5 | The scene | `scene-3d.png` + animated callouts |
| 3 | 0:28.5–0:43.5 | The evidence loop | `panel-profile.png` → `panel-comparison.png` |
| 4 | 0:43.5–0:53.0 | What makes it different | Three principle cards |
| 5 | 0:53.0–0:58.0 | Handoff | Lockup + "Here it is, running" |

---

## Scene 0 · Sting — 0:00 – 0:06.5

Unchanged from the current render. Depth slabs stack in widest-first, cyan Argo float
descends through them and pulses a ring, wordmark wipes in, tagline *Model ·
Observation · Agreement*, SIH 2026 badge.

**On-screen text:** `OceanLens India` / `MODEL · OBSERVATION · AGREEMENT` /
`A browser-native 3D ocean evidence workspace` / `SMART INDIA HACKATHON 2026`

**Voiceover:** none — let it play clean.

**Exit:** the full lockup scales down and slides to a small top-left corner mark that
persists through Scenes 1–4 (continuity anchor). Cross-dissolve, 0.4s.

---

## Scene 1 · The problem — 0:06.5 – 0:15.5

**Visual:** the frame splits into two columns with a hard vertical cyan hairline down
the centre.

- **Left column** builds first: label `MODEL`, and beneath it a small animated HYCOM-ish
  grid of cells filling in with temperature colours, cell by cell.
- **Right column** builds second: label `OBSERVATION`, and beneath it a scatter of Argo
  dots dropping in with stems, mirroring the sting's float motion.
- Both columns then push *away* from the centre line by ~40px and dim to 55% — the
  gap between them widens. A question mark, or better, the word `?` rendered as a
  58px cyan glyph, fades in dead centre on the hairline.

**Motion:** grid cells `stagger: 0.02, ease: power2.out`. Dots `stagger: 0.06,
back.out(1.6)`. The push-apart is one `power3.inOut` move at 0.9s — it must read as
deliberate separation, not drift.

**On-screen text:**
- `MODEL` (left, 30px uppercase, `--ink-soft`)
- `OBSERVATION` (right, 30px uppercase, `--ink-soft`)
- Lower third, after the split: **`Two answers. No way to compare them.`** (58px/600, `--ink`)

**Voiceover (~23 words):**
> Ocean forecasting produces two separate answers. What the model predicts. What the
> instruments in the water actually measured. Nothing puts them in the same place.

---

## Scene 2 · The scene — 0:15.5 – 0:28.5

**Visual:** the split collapses — both columns slide inward and *become* the single 3D
scene. `assets/scene-3d.png` scales up from 0.94 into frame, positioned left-of-centre
at ~62% frame width, with a soft cyan rim and 24px radius.

Three callout pills then draw in, each on a thin leader line pointing at the real
feature in the screenshot:

| Callout | Points at | Timing |
|---|---|---|
| `Real model depth slice` | the blue plane | 17.8s |
| `Every marker is a real observation` | the green Argo dots | 19.6s |
| `Depth-referenced — 0 to 1000 m` | the depth-reference box, bottom-right | 21.4s |

At 24.0s the callouts fade to 30% and one summary line types on beneath the image.

**Motion:** leader lines are SVG paths drawn with `strokeDashoffset` (`power2.inOut`,
0.5s); the pill fades up +12px behind it. Image gets a slow 1.0 → 1.03 Ken Burns across
the whole scene, `sine.inOut`, so it never sits static.

**On-screen text:**
- Three callout pills as above
- Summary, bottom: **`One scene. Model field and every observation, together.`**

**Voiceover (~33 words):**
> OceanLens puts them in one 3D scene. The model's depth slice, and every observation
> in that volume — Argo floats, gliders, CTD casts, satellite — rendered in a
> depth-referenced frame you can fly through. Click any one of them.

---

## Scene 3 · The evidence loop — 0:28.5 – 0:43.5

The core of the video. A click on a marker opens the Evidence Panel; the panel has
three linked views. Show two of them for real, name the third.

### 3a · Profile — 28.5s – 35.0s

**Visual:** `assets/panel-profile.png` slides in from the right and settles at ~34%
frame width, right-of-centre. A cyan selection ring pulses once on a marker in the
now-dimmed (40%) scene image at left — cause and effect, in that order.

Two pull-out annotations animate beside the chart:
- `101 real measured levels` → leader to the plotted curve
- `Modelled column, same position and time` → leader to the dashed line

**On-screen text:** section label top-left, `01 — PROFILE` (30px uppercase, `--cyan`)

### 3b · Comparison — 35.0s – 41.0s

**Visual:** `panel-profile.png` cross-slides left and out; `panel-comparison.png` takes
its place with a 0.35s `power3.inOut` push. Three stat tiles lift *out* of the
screenshot as larger code-drawn overlays, so the numbers are legible at video scale:

| Tile | Value | Sub-label |
|---|---|---|
| RMSE | `0.41 °C` | — |
| MEAN BIAS | `−0.19 °C` | `model cooler than observed` |
| LEVELS | `101` | `compared` |

Each tile counts up from 0 via a seek-safe GSAP proxy tween (`onUpdate`, never
wall-clock), 0.7s, `power2.out`, staggered 0.15s.

Then the depth-band verdict column highlights: `FAIR` / `MODERATE` / `FAIR` / `HIGH` /
`HIGH` illuminate top-to-bottom, stagger 0.1s, each in its real colour.

**On-screen text:** `02 — COMPARISON` · and beneath the tiles,
**`Agreement isn't asserted. It's computed.`**

### 3c · Provenance — 41.0s – 43.5s

**Visual:** no screenshot — too text-dense to read at this size. Instead three lines
type on over a dimmed comparison panel:
`Source URL` → `Retrieval date` → `Every processing step`, each with a small cyan check
glyph landing after it.

**On-screen text:** `03 — PROVENANCE` · **`Where every number came from.`**

**Voiceover for all of Scene 3 (~48 words):**
> Clicking an observation opens its evidence panel. Profile: what the instrument
> measured, depth by depth, against the model's own column at that exact position and
> time. Comparison: RMSE, bias, and an agreement verdict for every depth band.
> Provenance: the source, the retrieval date, every processing step applied.

---

## Scene 4 · What makes it different — 0:43.5 – 0:53.0

**Visual:** everything clears. Three cards deal in from the bottom, staggered 0.18s,
`back.out(1.2)` — each 480px wide, `--bg-mid` fill, 1px `--cyan` 24% border, a small
icon glyph, a bold headline and one supporting line.

| Card | Headline | Supporting line | Icon |
|---|---|---|---|
| 1 | `Evidence-first` | Most tools show model **or** observations. This fuses them into one inspectable object. | two circles merging |
| 2 | `Radically honest` | Nothing is called verified or live unless it is. Unavailable capability is marked, never faked. | a shield / check |
| 3 | `Modular by design` | The same profile → comparison → provenance loop works for every sensor and feed. | three stacked slabs (echoes the sting mark) |

At 50.5s, card 2's supporting line gets an emphasis beat: the words `never faked` glow
to `--cyan` and scale 1.04 briefly. This is the line that wins the room — let it land.

**On-screen text:** as tabled.

**Voiceover (~29 words):**
> Three things make it different. It fuses model and observation into one object you
> can inspect. It never claims data is verified when it isn't. And the same loop
> generalizes to every sensor INCOIS operates.

---

## Scene 5 · Handoff — 0:53.0 – 0:58.0

**Visual:** cards clear downward. The corner mark from Scene 0 flies back to centre and
re-expands into the full lockup — closing the loop the sting opened. Below it, one line
fades up.

**On-screen text:** `OceanLens India` wordmark + **`Here it is, running.`**

**Voiceover (~9 words):**
> So let me show you the thing actually working.

**Exit:** hold the final frame for a full second with no motion, so the presenter has a
clean, unambiguous cut point into their screen recording. **Do not fade to black** —
a fade reads as "video over" and kills the momentum into the live demo.

---

## Build notes

- **One composition, one paused GSAP timeline** on `window.__timelines["main"]`, per the
  HyperFrames contract. Scenes are `.group` elements inside a single full-duration
  `.clip`; they do not each need timing attributes.
- Every entrance is an explicit `fromTo()` with a stated `autoAlpha: 0` start — no
  `gsap.from()` inside the clip, or the composition will not seek correctly.
- The three stat count-ups in Scene 3b must tween a proxy object through `onUpdate`.
  A wall-clock counter renders as 0 in every frame of the final MP4.
- Screenshots carry their own dark background, so they need no plate behind them — but
  they do need a 1px `--cyan` 18% border to separate from the page background, which is
  nearly the same colour.
- Run `npx hyperframes check .` after build. The vignette-over-text occlusion error
  from the sting build will recur if any dimming layer is placed above a text node —
  put dimmers *behind* content, not on top of it.
- Proof snapshots at `3, 11, 21, 26, 33, 38, 42, 48, 56` — one per beat, plus both
  panel states.

## Open choices for the presenter

1. **Runtime.** 58s leaves ~62s of a 2:00 video for the live walkthrough. If the
   walkthrough needs more room, Scene 1 compresses to 6s and Scene 4 to 7.5s without
   restructuring — call it before build.
2. **Voiceover or on-screen text carrying the load.** Written above assuming *both*.
   If you'd rather the video stand alone silently, the on-screen text is already
   sufficient; if you'd rather talk freely over it, cut the Scene 1 and Scene 4
   headlines so you aren't reading your own subtitles aloud.
