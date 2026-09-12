/* The 3D scene itself — a real model depth slice rendered as a
 * geographically-scaled horizontal plane, plus real Argo observation
 * markers positioned by the same projection. Deliberately not volumetric:
 * one textured plane, no ray marching, no isosurfaces (later phase).
 *
 * All Three.js/WebGL calls happen inside effects, so this component is safe
 * to render during SSR (App.smoke.test.tsx) — no canvas.getContext() call
 * ever runs outside a browser. */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ObservationProfile, VolumeSlice } from '@/domain/types';
import type { PaletteName } from '@/domain/variables';
import { DEPTH_STOPS } from '@/state/analysisStore';
import {
  buildSliceTexture,
  computePlaneWorldSize,
  depthToWorldY,
  projectGeoToWorld,
  projectWorldToGeo,
  sampleSliceNearest,
} from './sliceTexture';
import {
  computeMarkerAppearance,
  HOVERED_RING_COLOR_HEX,
  SELECTED_RING_COLOR_HEX,
} from './markerAppearance';
import { projectCoastline, type CoastlineData } from './coastline';
import styles from './ThreeSceneCanvas.module.css';

export interface ThreeSceneCanvasProps {
  readonly slice: VolumeSlice;
  readonly palette: PaletteName;
  readonly domainRange: readonly [number, number];
  readonly depthM: number;
  readonly exaggeration: number;
  readonly opacity: number;
  /** Already filtered (platform type / DAC / good-QC / collocated-only) by
   * the caller — see src/state/filterObservations.ts, shared with
   * EvidencePanel so the panel's list and the clickable markers always
   * agree on which real observations are shown. */
  readonly observations: readonly ObservationProfile[];
  readonly selectedObservationId: string | null;
  readonly hoveredObservationId: string | null;
  readonly onSelectObservation: (id: string) => void;
  readonly onHoverObservation: (id: string | null) => void;
  readonly onSelectModelPoint: (point: { latitude: number; longitude: number }) => void;
  readonly selectedModelPoint: { latitude: number; longitude: number } | null;
  /** Real vendored coastline reference (scripts/prepare-coastline.mjs) —
   * null while it's still loading or failed to load. A missing coastline
   * degrades to "no coastline drawn", never a fabricated placeholder
   * outline. */
  readonly coastline: CoastlineData | null;
}

const MARKER_BASE_SCALE = 1.3;
const RING_SCALE_MULTIPLIER = 1.7;
const CLICK_MOVE_THRESHOLD_PX = 6;
/** Fixed reference depth for the analysis-volume "box" frame — deliberately
 * NOT `props.depthM` (which is where the slice PLANE currently sits). The
 * box is a stable spatial frame the plane visibly moves inside as the user
 * changes depth; if the box itself resized to match the selected depth,
 * there would be nothing fixed left to see that motion against. Uses the
 * same DEPTH_STOPS the depth slider itself is built from (single source of
 * truth), not a separately hand-picked number. */
const MAX_BOX_DEPTH_M = Math.max(...DEPTH_STOPS);
/** Furthest the camera can zoom out — large enough that the analysis-volume
 * box (see MAX_BOX_DEPTH_M above) fits fully in frame with room to spare,
 * and the nearest real coastline (Bangladesh/Myanmar/Sri Lanka, all close
 * to the region) becomes visible around it. Verified empirically by
 * projecting the box's real corners through the camera at the old max (60)
 * — they landed far outside the canvas — and re-checking at this value. */
const MAX_ZOOM_OUT_RADIUS = 110;

/** Orbit camera: drag to rotate, wheel to zoom. Deliberately simple — no
 * external controls dependency, clamped ranges so the scene can't be
 * dragged inside-out or zoomed through the plane. */
class SimpleOrbitCamera {
  azimuth = Math.PI * 0.22;
  elevation = Math.PI * 0.32;
  radius: number;
  target = new THREE.Vector3(0, 0, 0);

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    initialRadius: number,
  ) {
    this.radius = initialRadius;
    this.apply();
  }

  apply(): void {
    const clampedElevation = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, this.elevation));
    const x = this.radius * Math.sin(clampedElevation) * Math.sin(this.azimuth);
    const y = this.radius * Math.cos(clampedElevation);
    const z = this.radius * Math.sin(clampedElevation) * Math.cos(this.azimuth);
    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.camera.lookAt(this.target);
  }

  drag(dx: number, dy: number): void {
    this.azimuth -= dx * 0.006;
    this.elevation -= dy * 0.006;
    this.apply();
  }

  zoom(delta: number, minRadius: number, maxRadius: number): void {
    this.radius = Math.max(minRadius, Math.min(maxRadius, this.radius * (1 + delta * 0.001)));
    this.apply();
  }
}

/** A soft-edged filled circle — the marker body. Tinted per-instance via
 * SpriteMaterial.color, so one texture serves every QC colour. */
function makeCircleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.72, 'rgba(255,255,255,1)');
  grad.addColorStop(0.82, 'rgba(8,17,29,1)');
  grad.addColorStop(1, 'rgba(8,17,29,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** A ring outline — the selection/hover indicator. Tinted per-instance. */
function makeRingTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.09;
  ctx.beginPath();
  ctx.arc(r, r, r - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface MarkerEntry {
  readonly id: string;
  readonly body: THREE.Sprite;
  readonly ring: THREE.Sprite | null;
  readonly stem: THREE.Line;
}

interface ProbeInfo { readonly latitude: number; readonly longitude: number; readonly value: number | null; }

export function ThreeSceneCanvas(props: ThreeSceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef<SimpleOrbitCamera | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const coastlineGroupRef = useRef<THREE.Group | null>(null);
  const boxGroupRef = useRef<THREE.Group | null>(null);
  const selectedPointGroupRef = useRef<THREE.Group | null>(null);
  const markerEntriesRef = useRef<MarkerEntry[]>([]);
  const circleTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const ringTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const rafRef = useRef<number | null>(null);
  const webglUnavailableRef = useRef(false);

  const propsRef = useRef(props);
  propsRef.current = props;

  // Bumped on `webglcontextrestored` to force the plane/marker effects
  // below to re-run and re-upload everything. This is not cosmetic: a lost
  // WebGL context invalidates every GPU-side resource (textures, geometry
  // buffers, compiled programs) that existed before the loss. Three.js's
  // own internal context-restore handler resets its bookkeeping but does
  // NOT re-upload application-created textures/geometries on its own —
  // without this, the canvas stays black forever after a context loss,
  // which is exactly the bug this fixes (see the diagnosis in the Phase 4A
  // "black canvas" report: React StrictMode's mount->cleanup->mount cycle
  // disposes the first WebGLRenderer, which force-loses the GL context;
  // the async restore event was landing with nothing listening for it).
  const [renderGeneration, setRenderGeneration] = useState(0);
  const [probe, setProbe] = useState<ProbeInfo | null>(null);

  // -- one-time scene setup ------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch {
      webglUnavailableRef.current = true;
      return undefined;
    }
    renderer.setClearColor(0x08111d, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    const orbit = new SimpleOrbitCamera(camera, 18);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(5, 10, 7);
    scene.add(key);

    const grid = new THREE.GridHelper(30, 20, 0x1c3247, 0x16283a);
    scene.add(grid);

    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const coastlineGroup = new THREE.Group();
    scene.add(coastlineGroup);
    const boxGroup = new THREE.Group();
    scene.add(boxGroup);
    const selectedPointGroup = new THREE.Group();
    scene.add(selectedPointGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    orbitRef.current = orbit;
    markerGroupRef.current = markerGroup;
    coastlineGroupRef.current = coastlineGroup;
    boxGroupRef.current = boxGroup;
    selectedPointGroupRef.current = selectedPointGroup;
    circleTextureRef.current = makeCircleTexture();
    ringTextureRef.current = makeRingTexture();
    raycasterRef.current = new THREE.Raycaster();

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let dragging = false;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;

    const pointerToNdc = (e: PointerEvent): THREE.Vector2 => {
      const rect = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };

    const raycastMarkerId = (e: PointerEvent): string | null => {
      const raycaster = raycasterRef.current;
      const group = markerGroupRef.current;
      const cam = cameraRef.current;
      if (!raycaster || !group || !cam) return null;
      raycaster.setFromCamera(pointerToNdc(e), cam);
      const bodies = markerEntriesRef.current.map((m) => m.body);
      const hits = raycaster.intersectObjects(bodies, false);
      const hit = hits[0]?.object as THREE.Sprite | undefined;
      return (hit?.userData['observationId'] as string | undefined) ?? null;
    };
    const raycastModelPoint = (e: PointerEvent) => {
      const raycaster = raycasterRef.current;
      const plane = planeRef.current;
      const cam = cameraRef.current;
      if (!raycaster || !plane || !cam) return null;
      raycaster.setFromCamera(pointerToNdc(e), cam);
      const hit = raycaster.intersectObject(plane, false)[0];
      return hit ? projectWorldToGeo(hit.point.x, hit.point.z, propsRef.current.slice.bounds) : null;
    };
    const updateProbe = (e: PointerEvent) => {
      const point = raycastModelPoint(e);
      if (!point) { setProbe(null); return; }
      setProbe({ ...point, value: sampleSliceNearest(propsRef.current.slice, point) });
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragging && (e.buttons & 1) === 1) {
        const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (moved > CLICK_MOVE_THRESHOLD_PX) {
          orbit.drag(e.clientX - lastX, e.clientY - lastY);
        }
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        const id = raycastMarkerId(e);
        canvas.style.cursor = 'crosshair';
        propsRef.current.onHoverObservation(id);
        updateProbe(e);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved <= CLICK_MOVE_THRESHOLD_PX) {
        const id = raycastMarkerId(e);
        if (id) propsRef.current.onSelectObservation(id);
        else {
          const point = raycastModelPoint(e);
          if (point) propsRef.current.onSelectModelPoint(point);
        }
      }
    };
    const onPointerLeave = () => {
      dragging = false;
      propsRef.current.onHoverObservation(null);
      setProbe(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Max radius raised from 60 to MAX_ZOOM_OUT_RADIUS: at 60 the analysis-
      // volume box (~70x75 world units, computePlaneWorldSize on the real
      // region) could not fully fit in frame even zoomed all the way out —
      // confirmed by projecting its corners through the real camera/canvas
      // (they landed far outside the canvas bounds) — so neither the box
      // frame nor any of the real coastline around it were ever reachable.
      // Default (18) and closest zoom (4) are untouched, preserving every
      // previously-verified marker/plane view exactly; this only extends
      // how far OUT the user can optionally go.
      orbit.zoom(e.deltaY, 4, MAX_ZOOM_OUT_RADIUS);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const tick = () => {
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    };
    const stopLoop = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // WebGL context loss is real and not rare — GPU driver resets, tab
    // backgrounding on mobile, and (as diagnosed) React StrictMode's dev-mode
    // double mount/cleanup can all trigger it. Per the WebGL spec,
    // preventDefault() on the "lost" event is required for the browser to
    // attempt automatic restoration at all; without it the context is gone
    // for good. On restore, every GPU resource this component created before
    // the loss is invalid, so force the content-building effects to run
    // again via renderGeneration rather than trying to selectively patch
    // individual textures/buffers.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      stopLoop();
    };
    const onContextRestored = () => {
      setRenderGeneration((g) => g + 1);
      startLoop();
    };
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);

    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false);

      planeRef.current?.geometry.dispose();
      const mat = planeRef.current?.material;
      if (mat) {
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
            m.map?.dispose();
          }
          m.dispose();
        }
      }
      disposeMarkers(markerEntriesRef.current);
      circleTextureRef.current?.dispose();
      ringTextureRef.current?.dispose();
      disposeGroupContents(coastlineGroupRef.current);
      disposeGroupContents(boxGroupRef.current);
      disposeGroupContents(selectedPointGroupRef.current);

      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      orbitRef.current = null;
      planeRef.current = null;
      markerGroupRef.current = null;
      markerEntriesRef.current = [];
      circleTextureRef.current = null;
      ringTextureRef.current = null;
      raycasterRef.current = null;
      coastlineGroupRef.current = null;
      boxGroupRef.current = null;
      selectedPointGroupRef.current = null;
    };
    // Scene/camera/renderer/controls/textures are constructed once; the
    // plane and markers are rebuilt by the effects below whenever real data
    // or selection state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- rebuild the plane whenever the real slice or its display params change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { slice, palette, domainRange, depthM, exaggeration, opacity } = propsRef.current;

    const texData = buildSliceTexture(slice, palette, domainRange);
    const texture = new THREE.DataTexture(
      texData.data,
      texData.width,
      texData.height,
      THREE.RGBAFormat,
    );
    // flipY=false: DataTexture row 0 is sampled at v=0, un-flipped.
    texture.flipY = false;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    const { width, depth } = computePlaneWorldSize(slice.bounds);
    // PlaneGeometry starts flat in local XY, with v=0 at local y=-depth/2 and
    // v=1 at local y=+depth/2. Rotating -90 deg about X carries local
    // (x, y, 0) -> world (x, 0, -y): local y=-depth/2 (v=0, texture row 0,
    // which buildSliceTexture fills from slice.values row 0 = bounds.minLat,
    // the SOUTH edge) lands at world Z=+depth/2. So +Z is south, -Z is
    // north — texture row 0 (south, per the corrected VolumeSlice contract
    // in src/domain/types.ts) ends up on the south side of the plane, verified
    // by construction rather than by eye (no browser was available to check
    // this visually — see the Phase 4A report). Marker positions use the
    // same +Z=south convention via projectGeoToWorld, sharing this file's
    // world-scale constants so a marker can never drift off its real plane.
    const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = depthToWorldY(depthM, exaggeration);
    mesh.renderOrder = 1;

    if (planeRef.current) {
      scene.remove(planeRef.current);
      planeRef.current.geometry.dispose();
      const oldMat = planeRef.current.material as THREE.MeshBasicMaterial;
      oldMat.map?.dispose();
      oldMat.dispose();
    }
    scene.add(mesh);
    planeRef.current = mesh;
  }, [
    props.slice,
    props.palette,
    props.domainRange,
    props.depthM,
    props.exaggeration,
    props.opacity,
    renderGeneration,
  ]);

  // -- rebuild markers whenever the real observation list, selection, hover,
  // depth or exaggeration changes. Positions come only from real lat/lon on
  // each ObservationProfile (never fabricated); nothing is drawn for an
  // observation this component wasn't handed.
  useEffect(() => {
    const group = markerGroupRef.current;
    const circleTex = circleTextureRef.current;
    const ringTex = ringTextureRef.current;
    if (!group || !circleTex || !ringTex) return;

    disposeMarkers(markerEntriesRef.current);
    group.clear();

    const { slice, observations, selectedObservationId, hoveredObservationId, depthM, exaggeration } =
      propsRef.current;
    const stemTopY = 0; // Argo floats surface to transmit — the real position is at the surface
    const stemBottomY = depthToWorldY(depthM, exaggeration);

    const entries: MarkerEntry[] = observations.map((obs) => {
      const { x, z } = projectGeoToWorld(obs.latitude, obs.longitude, slice.bounds);
      const isSelected = obs.id === selectedObservationId;
      const isHovered = obs.id === hoveredObservationId;
      const appearance = computeMarkerAppearance(obs.qc, isSelected, isHovered);

      const bodyMaterial = new THREE.SpriteMaterial({
        map: circleTex,
        color: appearance.colorHex,
        transparent: true,
        depthTest: false,
        sizeAttenuation: true,
      });
      const body = new THREE.Sprite(bodyMaterial);
      body.position.set(x, stemTopY, z);
      body.scale.setScalar(MARKER_BASE_SCALE * appearance.scale);
      body.renderOrder = 10 + appearance.renderOrder;
      body.userData['observationId'] = obs.id;

      let ring: THREE.Sprite | null = null;
      if (appearance.selected || appearance.hovered) {
        const ringMaterial = new THREE.SpriteMaterial({
          map: ringTex,
          color: appearance.selected ? SELECTED_RING_COLOR_HEX : HOVERED_RING_COLOR_HEX,
          transparent: true,
          depthTest: false,
          sizeAttenuation: true,
        });
        ring = new THREE.Sprite(ringMaterial);
        ring.position.set(x, stemTopY, z);
        ring.scale.setScalar(MARKER_BASE_SCALE * appearance.scale * RING_SCALE_MULTIPLIER);
        ring.renderOrder = 10 + appearance.renderOrder - 1;
        ring.userData['observationId'] = obs.id;
      }

      const stemColor = appearance.selected ? SELECTED_RING_COLOR_HEX : 0x4fc3d9;
      const stemGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, stemTopY, z),
        new THREE.Vector3(x, stemBottomY, z),
      ]);
      const stemMaterial = new THREE.LineBasicMaterial({
        color: stemColor,
        transparent: true,
        opacity: appearance.selected ? 0.85 : 0.35,
        depthTest: false,
      });
      const stem = new THREE.Line(stemGeometry, stemMaterial);
      stem.renderOrder = 9;

      group.add(stem);
      group.add(body);
      if (ring) group.add(ring);

      return { id: obs.id, body, ring, stem };
    });

    markerEntriesRef.current = entries;
  }, [
    props.observations,
    props.selectedObservationId,
    props.hoveredObservationId,
    props.slice,
    props.depthM,
    props.exaggeration,
    renderGeneration,
  ]);

  // -- rebuild the analysis-volume "box" frame whenever the real region
  // bounds or vertical exaggeration change. Its bottom is a FIXED reference
  // depth (MAX_BOX_DEPTH_M), deliberately not the currently selected depth
  // — this is what makes the slice plane's existing depth-based vertical
  // motion visible: a plane moving inside a fixed frame reads as motion; a
  // lone plane floating in an empty void does not, even though it was
  // always genuinely repositioning by real depth. South/east walls only
  // (matching the Claude Design reference this replicates) — the camera
  // can orbit freely, so which two of four walls are drawn doesn't limit
  // what's visible, only which sides are ever occluding.
  useEffect(() => {
    const group = boxGroupRef.current;
    if (!group) return;
    const { slice, exaggeration } = propsRef.current;

    disposeGroupContents(group);
    group.clear();

    const { width, depth } = computePlaneWorldSize(slice.bounds);
    const halfW = width / 2;
    const halfD = depth / 2;
    const topY = 0;
    const bottomY = depthToWorldY(MAX_BOX_DEPTH_M, exaggeration);

    // South=+Z / north=-Z / east=+X / west=-X — same convention as the
    // slice plane and projectGeoToWorld (see the plane-rebuild effect
    // above and sliceTexture.ts).
    const nwT = new THREE.Vector3(-halfW, topY, -halfD);
    const neT = new THREE.Vector3(halfW, topY, -halfD);
    const seT = new THREE.Vector3(halfW, topY, halfD);
    const swT = new THREE.Vector3(-halfW, topY, halfD);
    const nwB = new THREE.Vector3(-halfW, bottomY, -halfD);
    const neB = new THREE.Vector3(halfW, bottomY, -halfD);
    const seB = new THREE.Vector3(halfW, bottomY, halfD);
    const swB = new THREE.Vector3(-halfW, bottomY, halfD);

    const wallMaterial = (colorHex: number, opacity: number) =>
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

    const southGeom = new THREE.BufferGeometry().setFromPoints([swT, seT, seB, swT, seB, swB]);
    group.add(new THREE.Mesh(southGeom, wallMaterial(0x1b3a54, 0.22)));

    const eastGeom = new THREE.BufferGeometry().setFromPoints([seT, neT, neB, seT, neB, seB]);
    group.add(new THREE.Mesh(eastGeom, wallMaterial(0x16324a, 0.16)));

    const rimMaterial = new THREE.LineBasicMaterial({
      color: 0x789ebe,
      transparent: true,
      opacity: 0.35,
    });
    group.add(
      new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([nwB, neB, seB, swB]), rimMaterial),
    );

    const topRim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([nwT, neT, seT, swT, nwT]),
      new THREE.LineDashedMaterial({
        color: 0xa0c8e4,
        transparent: true,
        opacity: 0.5,
        dashSize: 0.25,
        gapSize: 0.2,
      }),
    );
    topRim.computeLineDistances();
    group.add(topRim);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x8cb4d2,
      transparent: true,
      opacity: 0.26,
    });
    for (const [top, bottom] of [
      [nwT, nwB],
      [neT, neB],
      [seT, seB],
      [swT, swB],
    ] as const) {
      group.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, bottom]), edgeMaterial),
      );
    }
  }, [props.slice, props.exaggeration, renderGeneration]);

  // -- rebuild the real coastline outline whenever it finishes loading or
  // the real region bounds change. Coordinates are real vendored Natural
  // Earth data (scripts/prepare-coastline.mjs), projected through the same
  // projectGeoToWorld the plane and markers use, so the coastline can never
  // drift from what it outlines. A still-loading or failed fetch (coastline
  // null) simply draws nothing — never a fabricated placeholder outline.
  useEffect(() => {
    const group = coastlineGroupRef.current;
    if (!group) return;

    disposeGroupContents(group);
    group.clear();

    const { coastline, slice } = propsRef.current;
    if (!coastline) return;

    const projected = projectCoastline(coastline, slice.bounds);
    const material = new THREE.LineBasicMaterial({
      color: 0x6f96b0,
      transparent: true,
      opacity: 0.55,
    });
    for (const feature of projected) {
      for (const ring of feature.rings) {
        if (ring.points.length < 2) continue;
        const points = ring.points.map((p) => new THREE.Vector3(p.x, 0.01, p.z));
        const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
        group.add(loop);
      }
    }
  }, [props.coastline, props.slice, renderGeneration]);

  // A persistent high-contrast reticle makes an arbitrary selected model
  // point unmistakable against any scientific colour ramp. WebGL line width
  // is effectively fixed at one pixel on most platforms, so use filled ring
  // geometry plus a beacon rather than relying on thin cross-lines alone.
  useEffect(() => {
    const group = selectedPointGroupRef.current;
    if (!group) return;
    disposeGroupContents(group); group.clear();
    const selected = propsRef.current.selectedModelPoint;
    if (!selected) return;
    const { x, z } = projectGeoToWorld(selected.latitude, selected.longitude, propsRef.current.slice.bounds);
    const y = depthToWorldY(propsRef.current.depthM, propsRef.current.exaggeration) + 0.03;
    const color = 0xff3dc8; // magenta contrasts both thermal and ocean ramps
    const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false });
    const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthTest: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.22, 40), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    ring.renderOrder = 30;
    group.add(ring);
    const size = 1.55;
    const crossA = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x - size, y + 0.01, z), new THREE.Vector3(x + size, y + 0.01, z)]), lineMaterial);
    const crossB = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y + 0.01, z - size), new THREE.Vector3(x, y + 0.01, z + size)]), lineMaterial);
    crossA.renderOrder = 31; crossB.renderOrder = 31;
    group.add(crossA); group.add(crossB);
    const beacon = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 2.4, z)]), lineMaterial);
    beacon.renderOrder = 31;
    group.add(beacon);
  }, [props.selectedModelPoint, props.slice, props.depthM, props.exaggeration, renderGeneration]);

  return (
    <div ref={containerRef} className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="3D ocean model scene" />
      {probe && <div className={styles.probe}>
        <span>PROBE · {probe.latitude.toFixed(3)}°N, {probe.longitude.toFixed(3)}°E</span>
        <strong>{props.slice.variable} · {props.depthM} m · {props.slice.timestamp.slice(0, 16).replace('T', ' ')} UTC</strong>
        <span>{probe.value === null ? 'Land or missing grid cell' : `${probe.value.toFixed(2)} (nearest real grid cell)`}</span>
      </div>}
    </div>
  );
}

function disposeMarkers(entries: readonly MarkerEntry[]): void {
  for (const entry of entries) {
    entry.body.material.dispose();
    entry.ring?.material.dispose();
    entry.stem.geometry.dispose();
    (entry.stem.material as THREE.Material).dispose();
  }
}

/** Disposes every child's geometry/material in a group — used for the
 * coastline and depth-box groups, whose contents are plain Line/Mesh
 * objects rebuilt wholesale on every real-data or generation change.
 * Materials may be shared across several children (the coastline draws
 * every ring with one material instance); Three.js's `dispose()` is
 * idempotent, so disposing it once per child that references it is safe,
 * if slightly redundant. */
function disposeGroupContents(group: THREE.Group | null): void {
  if (!group) return;
  for (const child of group.children) {
    const obj = child as THREE.Mesh | THREE.Line | THREE.LineLoop;
    obj.geometry?.dispose();
    const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) {
      for (const m of mat) m.dispose();
    } else {
      mat?.dispose();
    }
  }
}
