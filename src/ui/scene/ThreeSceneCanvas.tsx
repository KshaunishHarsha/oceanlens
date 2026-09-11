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
import {
  buildSliceTexture,
  computePlaneWorldSize,
  depthToWorldY,
  projectGeoToWorld,
} from './sliceTexture';
import {
  computeMarkerAppearance,
  HOVERED_RING_COLOR_HEX,
  SELECTED_RING_COLOR_HEX,
} from './markerAppearance';
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
}

const MARKER_BASE_SCALE = 1.3;
const RING_SCALE_MULTIPLIER = 1.7;
const CLICK_MOVE_THRESHOLD_PX = 6;

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

export function ThreeSceneCanvas(props: ThreeSceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef<SimpleOrbitCamera | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
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

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    orbitRef.current = orbit;
    markerGroupRef.current = markerGroup;
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
        canvas.style.cursor = id ? 'pointer' : 'grab';
        propsRef.current.onHoverObservation(id);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved <= CLICK_MOVE_THRESHOLD_PX) {
        const id = raycastMarkerId(e);
        if (id) propsRef.current.onSelectObservation(id);
      }
    };
    const onPointerLeave = () => {
      dragging = false;
      propsRef.current.onHoverObservation(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.zoom(e.deltaY, 4, 60);
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

  return (
    <div ref={containerRef} className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="3D ocean model scene" />
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
