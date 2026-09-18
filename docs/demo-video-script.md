# OceanLens India — 2-minute prototype video

Working script for the presenter. Structure: animated intro sting (no face), then
facecam + voiceover over a screen recording of the live prototype.

Target runtime **2:00**. Word counts assume ~155 wpm. Every number quoted below is a
real value this prototype actually produces — do not round or improve them on camera.

---

## Before you record

| | |
|---|---|
| Backend | `uvicorn` running — the scene is empty without it |
| Frontend | `npm run dev`, browser at 1920×1080, zoom 100% |
| Pre-set state | Variable = **Temperature**, depth = **surface**, timeline parked at **2023-09-25** |
| Zoom level | Default orbit distance (mark is framed, coastline just off-screen) |
| Have ready | WMO **5907083** to type; float **ARGO 2902770** for the stats beat |
| Close first | Devtools, notifications, second monitor popups |

Record the screen pass **once, clean, silently** — then lay voiceover over it. Do not
try to talk and drive at the same time; the pauses always land wrong.

---

## 0:00 – 0:07 · Animated intro

**Visual:** `videos/oceanlens-intro/renders/oceanlens-intro.mp4` plays full frame.
Depth slabs stack in, a cyan float descends through them, wordmark wipes in,
tagline *Model · Observation · Agreement*, SIH 2026 badge.

**Voiceover:** none. Let it breathe. Optionally start the first line at 0:05 over the
final hold so the cut into facecam isn't a hard stop.

**Cut:** hard cut on the last frame into facecam.

---

## 0:07 – 0:26 · Hook — facecam, full frame

> Every ocean forecast India issues rests on a question nobody can answer quickly:
> does the model actually match what the instruments in the water measured?
>
> Right now you answer that in a desktop GIS tool, offline, hours later, by a
> specialist. We built OceanLens India so you can answer it in a browser, in seconds.

**Visual cue:** you, centre frame, no overlay. Let the words carry it.
At *"in a browser"* — start a slow cross-dissolve to the app.

---

## 0:26 – 0:38 · What it is — screen in, facecam to corner

> This is an evidence workspace, not a dashboard. One 3D scene holding three things at
> once: what the model predicted, what the float observed, and how well they agree.

**Visual cue:** full app on screen. Facecam shrinks to bottom-right circle and stays
there for the rest of the video. Slow orbit-drag of the scene — one smooth move, don't
fidget.

---

## 0:38 – 0:58 · The scene

> This is the Bay of Bengal. The plane is a real HYCOM depth slice — actual model
> temperature, not a texture. I pull the depth slider, surface down to a thousand
> metres, and you watch the slice descend through the analysis box.
>
> Every dot is a real Argo float. Teal is good quality, amber is suspect, coral is bad.
> We never hide a bad float — we colour it.

**Visual cues, in order:**
1. Orbit slowly ~20° so the depth box reads as 3D.
2. Drag the **depth slider** from surface → 1000 m in one continuous motion. This is the
   money shot — the plane visibly sinking inside the fixed frame.
3. Hover briefly over a coral/amber marker so the QC colours register.

---

## 0:58 – 1:18 · Select a float, read the profile

> Let me find a specific float. Ctrl-K, type its WMO number, enter.
>
> Solid line is what that float actually measured — a hundred and two levels down
> through the water column. Dashed is the model's column at that exact position and
> time. And notice the dashed line stops early. That's where HYCOM's data genuinely
> ends. We don't extend it to make the chart look finished.

**Visual cues:**
1. **Ctrl-K**, type `5907083`, the dropdown appears, **Enter**. Cyan selection ring snaps
   onto the marker in the scene.
2. Panel opens on **Profile** tab. Pause 1s on the chart.
3. Mouse-trace down the solid line, then tap the point where the dashed line terminates.

---

## 1:18 – 1:38 · Comparison — the actual science

> The Comparison tab does the work. RMSE, zero point seven degrees. Mean bias, minus
> zero point two one — the model is running cooler than the float.
>
> And an agreement verdict per depth band: high near the surface, dropping off deeper.
> That mixed result is the point. If every band said the same thing, the thresholds
> wouldn't be doing anything.

**Visual cues:**
1. Click **Comparison**.
2. Cursor rests on the RMSE tile, then the bias tile — one beat each.
3. Slow scroll down the depth-band table so the HIGH / MODERATE / LOW verdicts read.

> *(These numbers are for **ARGO 2902770**. If you select a different float on the day,
> read whatever is on screen — never say a number the panel isn't showing.)*

---

## 1:38 – 1:52 · Provenance and the honesty rule

> Provenance answers "where did this come from." Source URL, retrieval date, every
> processing step we applied, the licence.
>
> And when we don't have data — chlorophyll, here — it says UNAVAILABLE. It doesn't
> guess, it doesn't interpolate, it doesn't invent a number to fill the box. For a
> government science tool that's the whole ballgame.

**Visual cues:**
1. Click **Provenance**. Scroll once to show both the Argo block and the HYCOM block.
2. Cut to the control rail — hover the **disabled Chlorophyll-a** row so the
   `UNAVAILABLE` badge is unmistakable.

---

## 1:52 – 2:00 · Close — facecam back to full frame

> Real Argo, real HYCOM, real statistics, running in a browser tab with nothing
> installed. Next is live INCOIS ingestion, gliders and satellite layers on the same
> scene.
>
> OceanLens India.

**Visual cue:** facecam scales back to full frame over the first line. Hold two beats
on your face after the last word, then cut to black — or freeze the intro's final
lockup frame as an end card.

---

## Optional beats — only if you're running short

Drop these in at **1:18** or **1:38**; each costs ~8 seconds.

**The broken float.** Select `ARGO 4903776` — every level failed QC. RMSE shows as an
em dash, not zero.
> A float whose data all failed quality control shows a dash, not a zero. A zero is a
> claim. A dash is the truth.

**The timeline.** Scrub the 11-step daily timeline.
> Eleven daily snapshots. Real dates, labelled as a historical demonstration window —
> we never dress cached data up as live.

---

## Things not to say on camera

- Don't call the data "live", "official", "verified", or "real-time". It is a
  **historical demonstration window, 2023-09-25 to 2023-10-05**, locally cached.
- Don't claim an INCOIS partnership or endorsement. The Argo data reaches us *through*
  the public Argo GDAC, where INCOIS is itself a data centre.
- Don't quote a statistic from memory. Read the panel.
