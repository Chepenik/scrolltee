"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ArcadeAudio } from "@/lib/game/audio";
import { CLUB_BY_ID, autoSelectClub, estimateShot, effectiveShotType } from "@/lib/game/clubs";
import {
  BALL_RADIUS,
  CUP_RADIUS,
  SURFACE_COLORS,
  boostZoneAt,
  distanceToCup,
  holeDistance,
  surfaceAt,
  terrainHeightAt
} from "@/lib/game/course";
import { HOLES } from "@/lib/game/holes";
import { TrackballInput, createEmptySwingDebug } from "@/lib/game/input";
import { createBallState, launchBall, resetBallToLie, updateBallPhysics } from "@/lib/game/physics";
import { shotFeedback } from "@/lib/game/scoring";
import { clamp, horizontalDistance, normalizeAngle } from "@/lib/game/math";
import { windForShot } from "@/lib/game/wind";
import type { HoleConfig } from "@/lib/game/holes";
import type {
  CameraMode,
  ClubId,
  GameSettings,
  HudSnapshot,
  ShotSetup,
  ShotType,
  SurfaceType,
  SwingDebugSnapshot,
  SwingPhase,
  WindState
} from "@/lib/game/types";

type GolfSceneProps = {
  active: boolean;
  hole: HoleConfig;
  completedHoles: number;
  completedPar: number;
  completedStrokes: number;
  roundComplete: boolean;
  shotSetup: ShotSetup;
  selectedClubId: ClubId;
  settings: GameSettings;
  restartToken: number;
  cameraToken: number;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onClubChange: (clubId: ClubId) => void;
  onControlKey: (key: string) => void;
  onPauseToggle: () => void;
};

const TERRAIN_BASE_WIDTH = 230;
const TERRAIN_FRONT_MARGIN = 42;
const TERRAIN_BACK_MARGIN = 82;
const TERRAIN_X_SEGMENTS = 104;
const TERRAIN_Z_SEGMENTS = 196;
const TRAIL_LENGTH = 96;
const TRAIL_MOTE_COUNT = 42;
const WIND_STREAM_COUNT = 26;
const CUP_PARTICLE_COUNT = 34;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const IMPACT_COLORS: Record<SurfaceType, string> = {
  tee: "#fff1a6",
  fairway: "#d9ffd8",
  rough: "#6ff3a8",
  green: "#f8fbf4",
  sand: "#ffe0a3",
  cart: "#d5dde1"
};

function easeOutCubic(value: number) {
  const t = clamp(value, 0, 1);
  const inverse = 1 - t;
  return 1 - inverse * inverse * inverse;
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function colorForSurface(surface: SurfaceType, x: number, z: number) {
  const color = new THREE.Color(SURFACE_COLORS[surface]);
  const fleck = Math.sin(x * 0.37 + z * 0.19) * 0.025 + Math.sin(x * 0.11 - z * 0.23) * 0.018;
  color.multiplyScalar(0.96 + fleck);
  return color;
}

function terrainBoundsForHole(hole: HoleConfig) {
  const zMin = Math.min(hole.teePosition.z, hole.cupPosition.z) - TERRAIN_FRONT_MARGIN;
  const zMax = Math.max(hole.teePosition.z, hole.cupPosition.z) + TERRAIN_BACK_MARGIN;
  const width = Math.max(TERRAIN_BASE_WIDTH, hole.fairway.width * 5.2, Math.abs(hole.cupPosition.x - hole.teePosition.x) * 2 + 210);

  return { width, zMin, zMax };
}

function createTerrainMesh(hole: HoleConfig) {
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const { width, zMin, zMax } = terrainBoundsForHole(hole);
  const xMin = -width / 2;
  const zRange = zMax - zMin;

  for (let iz = 0; iz <= TERRAIN_Z_SEGMENTS; iz += 1) {
    const z = zMin + (iz / TERRAIN_Z_SEGMENTS) * zRange;
    for (let ix = 0; ix <= TERRAIN_X_SEGMENTS; ix += 1) {
      const x = xMin + (ix / TERRAIN_X_SEGMENTS) * width;
      const y = terrainHeightAt(x, z, hole);
      const color = colorForSurface(surfaceAt(x, z, hole), x, z);
      vertices.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = TERRAIN_X_SEGMENTS + 1;
  for (let iz = 0; iz < TERRAIN_Z_SEGMENTS; iz += 1) {
    for (let ix = 0; ix < TERRAIN_X_SEGMENTS; ix += 1) {
      const a = iz * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function createCup(hole: HoleConfig) {
  const cupY = terrainHeightAt(hole.cupPosition.x, hole.cupPosition.z, hole);
  const group = new THREE.Group();
  group.position.set(hole.cupPosition.x, cupY + 0.025, hole.cupPosition.z);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(CUP_RADIUS * 1.72, 48),
    new THREE.MeshBasicMaterial({
      color: "#07100b",
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.004;
  group.add(shadow);

  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(CUP_RADIUS * 0.78, CUP_RADIUS * 0.78, 0.055, 32),
    new THREE.MeshStandardMaterial({ color: "#050607", roughness: 0.8 })
  );
  disk.receiveShadow = true;
  group.add(disk);

  const cupGlow = new THREE.Mesh(
    new THREE.RingGeometry(CUP_RADIUS * 0.98, CUP_RADIUS * 1.24, 48),
    new THREE.MeshBasicMaterial({
      color: hole.accent,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  cupGlow.rotation.x = -Math.PI / 2;
  cupGlow.position.y = 0.026;
  group.add(cupGlow);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(CUP_RADIUS * 0.82, 0.075, 8, 36),
    new THREE.MeshStandardMaterial({ color: "#ecf5ea", roughness: 0.72 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  return group;
}

function createFlagstick(hole: HoleConfig) {
  const cupY = terrainHeightAt(hole.cupPosition.x, hole.cupPosition.z, hole);
  const group = new THREE.Group();
  group.position.set(hole.cupPosition.x, cupY, hole.cupPosition.z);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 21, 12),
    new THREE.MeshStandardMaterial({ color: "#f8faf4", roughness: 0.45 })
  );
  pole.position.y = 10.5;
  pole.castShadow = true;
  group.add(pole);

  const topCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#fff1a6", roughness: 0.34, metalness: 0.08 })
  );
  topCap.position.y = 21.2;
  topCap.castShadow = true;
  group.add(topCap);

  const flagGeometry = new THREE.PlaneGeometry(8.8, 4.8, 8, 1);
  flagGeometry.translate(4.4, 0, 0);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      color: hole.accent,
      roughness: 0.7,
      side: THREE.DoubleSide
    })
  );
  flag.position.set(0, 17.2, 0);
  flag.castShadow = true;
  group.add(flag);

  return { group, flagGeometry };
}

function createGreenPolish(hole: HoleConfig) {
  const group = new THREE.Group();
  const cupY = terrainHeightAt(hole.cupPosition.x, hole.cupPosition.z, hole);
  group.position.set(hole.cupPosition.x, cupY + 0.055, hole.cupPosition.z);

  for (let i = 0; i < 4; i += 1) {
    const radius = hole.greenRadius * (0.36 + i * 0.16);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.08, 88),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? "#d9ffd8" : hole.accent,
        transparent: true,
        opacity: i % 2 === 0 ? 0.16 : 0.1,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 0.82;
    group.add(ring);
  }

  const grainGeometry = new THREE.BufferGeometry();
  const grainPositions: number[] = [];
  const lineCount = 18;
  for (let i = 0; i < lineCount; i += 1) {
    const lane = -hole.greenRadius * 0.58 + (i / (lineCount - 1)) * hole.greenRadius * 1.16;
    const length = hole.greenRadius * (0.58 + Math.sin(i * 1.7) * 0.08);
    grainPositions.push(lane, -length * 0.82, 0, lane, length * 0.82, 0);
  }
  grainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(grainPositions, 3));
  const grain = new THREE.LineSegments(
    grainGeometry,
    new THREE.LineBasicMaterial({
      color: "#f2fff0",
      transparent: true,
      opacity: 0.13,
      depthWrite: false
    })
  );
  grain.rotation.x = -Math.PI / 2;
  grain.rotation.z = (hole.fairway.curveSeed % 1) * Math.PI;
  group.add(grain);

  return group;
}

function createTeeMarkers(hole: HoleConfig) {
  const group = new THREE.Group();
  const markerMaterial = new THREE.MeshStandardMaterial({ color: "#ffe08a", roughness: 0.5 });
  const aimAngle = Math.atan2(hole.cupPosition.x - hole.teePosition.x, hole.cupPosition.z - hole.teePosition.z);
  const sideX = Math.cos(aimAngle);
  const sideZ = -Math.sin(aimAngle);
  for (const offset of [-7.5, 7.5]) {
    const x = hole.teePosition.x + sideX * offset;
    const z = hole.teePosition.z + sideZ * offset;
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 16), markerMaterial);
    marker.position.set(x, terrainHeightAt(x, z, hole) + 0.6, z);
    marker.castShadow = true;
    group.add(marker);
  }
  return group;
}

function createBallMesh() {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
    new THREE.MeshStandardMaterial({ color: "#f9fff7", roughness: 0.36, metalness: 0.02 })
  );
  ball.castShadow = true;
  ball.receiveShadow = true;

  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(BALL_RADIUS * 1.01, 0.025, 8, 48),
    new THREE.MeshStandardMaterial({ color: "#69d2ff", roughness: 0.5 })
  );
  stripe.rotation.x = Math.PI / 2;
  ball.add(stripe);

  return ball;
}

function createFaceGrooves(width: number, rows: number, z: number) {
  const positions: number[] = [];
  for (let i = 0; i < rows; i += 1) {
    const y = -0.24 + i * (0.48 / Math.max(1, rows - 1));
    positions.push(-width / 2, y, z, width / 2, y, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: "#1f2930",
      transparent: true,
      opacity: 0.45
    })
  );
}

function createClubVisual() {
  const group = new THREE.Group();
  group.visible = false;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 13.4, 8),
    new THREE.MeshStandardMaterial({ color: "#d7e1df", roughness: 0.34, metalness: 0.48 })
  );
  shaft.position.set(2.1, 6.25, -4.7);
  shaft.rotation.x = -0.22;
  shaft.rotation.z = -0.2;
  shaft.castShadow = true;
  group.add(shaft);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.14, 2.4, 10),
    new THREE.MeshStandardMaterial({ color: "#15211f", roughness: 0.74 })
  );
  grip.position.set(0.88, 12.75, -6.15);
  grip.rotation.x = -0.22;
  grip.rotation.z = -0.2;
  grip.castShadow = true;
  group.add(grip);

  const heads: Record<"wood" | "iron" | "wedge" | "putter", THREE.Group> = {
    wood: new THREE.Group(),
    iron: new THREE.Group(),
    wedge: new THREE.Group(),
    putter: new THREE.Group()
  };

  const woodBody = new THREE.Mesh(
    new THREE.SphereGeometry(1, 22, 14),
    new THREE.MeshStandardMaterial({ color: "#223d48", roughness: 0.42, metalness: 0.16 })
  );
  woodBody.scale.set(2.2, 0.74, 1.5);
  woodBody.position.set(2.32, 0.74, -2.62);
  woodBody.rotation.y = -0.36;
  woodBody.castShadow = true;
  heads.wood.add(woodBody);

  const woodFace = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.72, 0.13),
    new THREE.MeshStandardMaterial({ color: "#dce8e7", roughness: 0.38, metalness: 0.32 })
  );
  woodFace.position.set(0.86, 0.7, -2.18);
  woodFace.rotation.y = 0.62;
  woodFace.castShadow = true;
  heads.wood.add(woodFace);

  const ironFace = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 1.08, 0.32),
    new THREE.MeshStandardMaterial({ color: "#c9d3d2", roughness: 0.28, metalness: 0.52 })
  );
  ironFace.position.set(1.92, 0.72, -2.42);
  ironFace.rotation.y = -0.42;
  ironFace.rotation.z = -0.08;
  ironFace.castShadow = true;
  heads.iron.add(ironFace);
  const ironGrooves = createFaceGrooves(2.46, 4, -2.2);
  ironGrooves.position.set(1.91, 0.73, 0);
  ironGrooves.rotation.y = -0.42;
  ironGrooves.rotation.z = -0.08;
  heads.iron.add(ironGrooves);

  const wedgeFace = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 1.24, 0.38),
    new THREE.MeshStandardMaterial({ color: "#eff5ef", roughness: 0.32, metalness: 0.45 })
  );
  wedgeFace.position.set(1.88, 0.78, -2.38);
  wedgeFace.rotation.x = -0.18;
  wedgeFace.rotation.y = -0.46;
  wedgeFace.rotation.z = -0.1;
  wedgeFace.castShadow = true;
  heads.wedge.add(wedgeFace);
  const wedgeGrooves = createFaceGrooves(2.18, 5, -2.16);
  wedgeGrooves.position.set(1.86, 0.82, 0);
  wedgeGrooves.rotation.x = -0.18;
  wedgeGrooves.rotation.y = -0.46;
  wedgeGrooves.rotation.z = -0.1;
  heads.wedge.add(wedgeGrooves);

  const putterHead = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.52, 0.95),
    new THREE.MeshStandardMaterial({ color: "#243335", roughness: 0.46, metalness: 0.28 })
  );
  putterHead.position.set(2.12, 0.45, -2.52);
  putterHead.castShadow = true;
  heads.putter.add(putterHead);
  const putterFace = new THREE.Mesh(
    new THREE.BoxGeometry(4.26, 0.34, 0.08),
    new THREE.MeshStandardMaterial({ color: "#f8fbf4", roughness: 0.42, metalness: 0.22 })
  );
  putterFace.position.set(2.12, 0.45, -1.99);
  heads.putter.add(putterFace);

  for (const head of Object.values(heads)) {
    head.visible = false;
    group.add(head);
  }

  return {
    group,
    heads,
    activeCategory: "" as "wood" | "iron" | "wedge" | "putter" | ""
  };
}

function createShotLine() {
  const positions = new Float32Array(30 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const line = new THREE.Line(
    geometry,
    new THREE.LineDashedMaterial({
      color: "#ffe08a",
      dashSize: 4,
      gapSize: 2.5,
      transparent: true,
      opacity: 0.74
    })
  );
  line.computeLineDistances();
  return line;
}

function createLandingMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.8, 0.12, 8, 48),
    new THREE.MeshBasicMaterial({ color: "#fff1a6", transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const crossMaterial = new THREE.LineBasicMaterial({ color: "#69d2ff", transparent: true, opacity: 0.86 });
  for (const rotation of [0, Math.PI / 2]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([-4.4, 0, 0, 4.4, 0, 0], 3));
    const line = new THREE.Line(geometry, crossMaterial);
    line.rotation.y = rotation;
    group.add(line);
  }

  group.visible = false;
  return group;
}

function createBoostZones(hole: HoleConfig) {
  const group = new THREE.Group();

  for (const [index, boost] of (hole.boostZones ?? []).entries()) {
    const y = terrainHeightAt(boost.x, boost.z, hole) + 0.18;
    const zone = new THREE.Group();
    zone.position.set(boost.x, y, boost.z);
    zone.userData.phase = index * 1.37 + hole.fairway.curveSeed;

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        color: "#fff1a6",
        transparent: true,
        opacity: 0.14,
        depthWrite: false
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.scale.set(boost.rx, boost.rz, 1);
    zone.add(fill);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 72),
      new THREE.MeshBasicMaterial({
        color: "#6ff3a8",
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(boost.rx, boost.rz, 1);
    ring.position.y = 0.04;
    zone.add(ring);

    const hotRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.32, 64),
      new THREE.MeshBasicMaterial({
        color: "#ffe08a",
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    hotRing.rotation.x = -Math.PI / 2;
    hotRing.scale.set(boost.rx, boost.rz, 1);
    hotRing.position.y = 0.08;
    zone.add(hotRing);

    const tickGeometry = new THREE.BufferGeometry();
    const tickPositions: number[] = [];
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const inner = 0.42 + (i % 3) * 0.05;
      const outer = 0.68 + (i % 2) * 0.08;
      tickPositions.push(Math.cos(angle) * inner, Math.sin(angle) * inner, 0, Math.cos(angle) * outer, Math.sin(angle) * outer, 0);
    }
    tickGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tickPositions, 3));
    const ticks = new THREE.LineSegments(
      tickGeometry,
      new THREE.LineBasicMaterial({
        color: "#f8fbf4",
        transparent: true,
        opacity: 0.36,
        depthWrite: false
      })
    );
    ticks.rotation.x = -Math.PI / 2;
    ticks.scale.set(boost.rx, boost.rz, 1);
    ticks.position.y = 0.12;
    zone.add(ticks);

    group.add(zone);
  }

  return group;
}

function createHoleBurst() {
  const burst = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 64),
    new THREE.MeshBasicMaterial({
      color: "#fff1a6",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  burst.rotation.x = -Math.PI / 2;
  burst.visible = false;
  return burst;
}

function createImpactPulse(color: string) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 72), material);
  pulse.rotation.x = -Math.PI / 2;
  pulse.visible = false;

  return { pulse, material };
}

function createCupParticles() {
  const positions = new Float32Array(CUP_PARTICLE_COUNT * 3);
  const velocities = new Float32Array(CUP_PARTICLE_COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#fff1a6",
    size: 1.15,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;

  return { points, positions, velocities, geometry, material };
}

function createTrail() {
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  const colors = new Float32Array(TRAIL_LENGTH * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88
    })
  );
  line.frustumCulled = false;

  const motePositions = new Float32Array(TRAIL_MOTE_COUNT * 3);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  moteGeometry.setDrawRange(0, 0);
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({
      color: "#fff1a6",
      size: 0.82,
      transparent: true,
      opacity: 0.48,
      depthWrite: false
    })
  );
  motes.frustumCulled = false;

  return { line, positions, colors, geometry, motes, motePositions, moteGeometry };
}

function createWindStreams() {
  const positions = new Float32Array(WIND_STREAM_COUNT * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const line = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: "#e7fbff",
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    })
  );
  line.frustumCulled = false;

  return { line, positions, geometry };
}

function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
  renderer.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isSceneControlTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(".mobile-touch-controls") !== null;
}

export function GolfScene(props: GolfSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const mobileSwingZoneRef = useRef<HTMLDivElement | null>(null);
  const mobileAimLeftRef = useRef<HTMLButtonElement | null>(null);
  const mobileAimRightRef = useRef<HTMLButtonElement | null>(null);
  const propsRef = useRef(props);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvasHost = canvasHostRef.current;
    if (!container || !canvasHost) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87c7e8");
    scene.fog = new THREE.Fog("#87c7e8", 155, 760);

    let activeHole = propsRef.current.hole;

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 1000);
    camera.position.set(0, 30, -58);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "scene-canvas";
    canvasHost.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight("#dff6ff", "#316d39", 1.45);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#fff3ca", 2.35);
    sun.position.set(-82, 120, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 25;
    sun.shadow.camera.far = 260;
    sun.shadow.camera.left = -145;
    sun.shadow.camera.right = 145;
    sun.shadow.camera.top = 180;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    let terrain = createTerrainMesh(activeHole);
    scene.add(terrain);

    let boostZones = createBoostZones(activeHole);
    scene.add(boostZones);

    let teeMarkers = createTeeMarkers(activeHole);
    scene.add(teeMarkers);

    let greenPolish = createGreenPolish(activeHole);
    scene.add(greenPolish);

    let cup = createCup(activeHole);
    scene.add(cup);

    let { group: flagstick, flagGeometry } = createFlagstick(activeHole);
    scene.add(flagstick);

    const holeBurst = createHoleBurst();
    scene.add(holeBurst);

    const cupParticles = createCupParticles();
    scene.add(cupParticles.points);

    const ballMesh = createBallMesh();
    scene.add(ballMesh);

    const clubVisual = createClubVisual();
    scene.add(clubVisual.group);

    const aimArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1.5, 0), 55, "#ffe08a", 7, 4);
    scene.add(aimArrow);

    const windVane = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 9, 0), 16, "#69d2ff", 3.4, 2.2);
    windVane.visible = false;
    scene.add(windVane);

    const shotLine = createShotLine();
    scene.add(shotLine);

    const landingMarker = createLandingMarker();
    scene.add(landingMarker);

    const trail = createTrail();
    scene.add(trail.line);
    scene.add(trail.motes);

    const landingPulse = createImpactPulse("#f8fbf4");
    scene.add(landingPulse.pulse);

    const boostPulse = createImpactPulse("#6ff3a8");
    scene.add(boostPulse.pulse);

    const windStreams = createWindStreams();
    scene.add(windStreams.line);

    const audio = new ArcadeAudio();
    const ball = createBallState(activeHole);
    const cameraLook = new THREE.Vector3(0, 8, 32);
    const desiredCamera = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    const aimDirection = new THREE.Vector3();
    const ballVector = new THREE.Vector3();
    const aimOrigin = new THREE.Vector3();
    const velocityDir = new THREE.Vector3();
    const windDirectionVector = new THREE.Vector3();
    const clubAimVector = new THREE.Vector3();
    const clubSideVector = new THREE.Vector3();
    const clubOffset = new THREE.Vector3();
    const clubHeadOffset = new THREE.Vector3();
    const trailPointBuffer = Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3());
    const trailLastPoint = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const trailTailColor = new THREE.Color("#6ff3a8");
    const trailHeadColor = new THREE.Color("#fff1a6");
    const trailTempColor = new THREE.Color();
    let trailPointCount = 0;
    let trailWriteIndex = 0;

    let aimAngle = Math.atan2(activeHole.cupPosition.x - activeHole.teePosition.x, activeHole.cupPosition.z - activeHole.teePosition.z);
    let activeClubId = propsRef.current.selectedClubId;
    let activeWind: WindState = windForShot(activeHole, 1);
    let lastShotWind: WindState = activeWind;
    let lastShotSetup: ShotSetup = propsRef.current.shotSetup;
    let lastShotType: ShotType = "normal";
    let lastShotStartDistance = holeDistance(activeHole);
    let lastShotWasBoosted = false;
    let boostUsedThisShot = false;
    let clubSyncGraceUntil = 0;
    let strokes = 0;
    let phase: SwingPhase = "IDLE";
    let shotResult = "READY TO RIP";
    let holed = false;
    let holedAt = 0;
    let cameraMode: CameraMode = "auto";
    let screenShake = 0;
    let lastHudAt = 0;
    let lastHudSignature = "";
    let lastBounceAt = 0;
    let lastLipOutAt = 0;
    let lastFlagHitAt = 0;
    let holeBurstStartedAt = 0;
    let landingPulseStartedAt = 0;
    let boostPulseStartedAt = 0;
    let landingPulseBaseScale = 1;
    let boostPulseBaseScaleX = 1;
    let boostPulseBaseScaleY = 1;
    let visualStrikeStartedAt = -1000;
    let visualStrikePower = 0;
    let visualStrikeBackswing = 0;
    let visualStrikeX = 0;
    let visualStrikeZ = 0;
    let visualStrikeShotType: ShotType = "normal";
    let visualFollowThroughUntil = -1000;
    let lastRestartToken = propsRef.current.restartToken;
    let lastCameraToken = propsRef.current.cameraToken;
    let lowSpeedControlSeconds = 0;
    let shotStartedAt = 0;
    let draggingAim = false;
    let lastPointerX = 0;
    let swingSnapshot: SwingDebugSnapshot = createEmptySwingDebug();

    const emitHud = (force = false) => {
      const now = performance.now();
      const hudInterval = phase === "BACKSWING" || phase === "DOWNSWING" ? 45 : ball.moving ? 85 : 110;
      if (!force && now - lastHudAt < hudInterval) {
        return;
      }
      const [x, , z] = ball.position;
      const [vx, vy, vz] = ball.velocity;
      const club = CLUB_BY_ID[activeClubId] ?? CLUB_BY_ID.driver;
      const setup = propsRef.current.shotSetup;
      const wind = ball.moving ? activeWind : windForShot(activeHole, strokes + 1);
      const estimate = estimateShot(club, setup, ball.surface, wind, aimAngle);
      const shotType = effectiveShotType(activeClubId, setup.shotType);
      const hudPhase: SwingPhase = holed ? "HOLED" : ball.moving ? "BALL_FLIGHT" : phase;
      const totalStrokes = propsRef.current.completedStrokes + strokes;
      const totalPar = propsRef.current.completedPar + activeHole.par;
      const snapshot: HudSnapshot = {
        phase: hudPhase,
        holeNumber: activeHole.holeNumber,
        holeCount: HOLES.length,
        holeName: activeHole.name,
        strokes,
        distanceToPin: distanceToCup(x, z, activeHole),
        shotResult,
        surface: ball.surface,
        ballSpeed: Math.hypot(vx, vy, vz),
        clubId: activeClubId,
        shotType,
        stanceOffset: setup.stanceOffset,
        ballForward: setup.ballForward,
        spin: setup.spin,
        wind,
        carryEstimate: estimate.carry,
        rollEstimate: estimate.roll,
        totalEstimate: estimate.total,
        aimDegrees: (aimAngle * 180) / Math.PI,
        holed,
        par: activeHole.par,
        totalStrokes,
        totalPar,
        roundScore: totalStrokes - totalPar,
        completedHoles: propsRef.current.completedHoles,
        roundComplete: propsRef.current.roundComplete,
        cameraMode,
        swing: {
          ...swingSnapshot,
          phase: hudPhase === "BALL_FLIGHT" || hudPhase === "HOLED" ? hudPhase : swingSnapshot.phase
        }
      };
      const signature = [
        snapshot.phase,
        snapshot.holeNumber,
        snapshot.strokes,
        Math.round(snapshot.distanceToPin),
        snapshot.shotResult,
        snapshot.surface,
        Math.round(snapshot.ballSpeed),
        snapshot.clubId,
        snapshot.shotType,
        Math.round(snapshot.stanceOffset * 100),
        Math.round(snapshot.ballForward * 100),
        Math.round(snapshot.spin * 100),
        Math.round(snapshot.wind.speed),
        Math.round(snapshot.wind.directionDeg),
        Math.round(snapshot.carryEstimate),
        Math.round(snapshot.rollEstimate),
        Math.round(snapshot.totalEstimate),
        Math.round(snapshot.aimDegrees),
        snapshot.holed ? 1 : 0,
        snapshot.cameraMode,
        snapshot.swing.phase,
        Math.round(snapshot.swing.backswing * 100),
        Math.round(snapshot.swing.downswingVelocity * 100),
        Math.round(snapshot.swing.power * 100),
        Math.round(snapshot.swing.spin * 100),
        Math.round(snapshot.swing.smoothness * 100)
      ].join("|");

      if (signature === lastHudSignature) {
        return;
      }

      lastHudAt = now;
      lastHudSignature = signature;
      propsRef.current.onHudUpdate(snapshot);
    };

    const updateBallMesh = (dt: number) => {
      ballMesh.position.set(ball.position[0], ball.position[1], ball.position[2]);
      const speed = Math.hypot(ball.velocity[0], ball.velocity[2]);
      if (holed && holedAt > 0) {
        const pulse = Math.max(0, 1 - (performance.now() - holedAt) / 950);
        const scale = 1 + Math.sin(pulse * Math.PI * 4) * 0.08 * pulse;
        ballMesh.scale.setScalar(scale);
      } else if (ballMesh.scale.x !== 1) {
        ballMesh.scale.setScalar(1);
      }
      if (speed > 0.01) {
        ballMesh.rotation.x += (ball.velocity[2] / BALL_RADIUS) * dt;
        ballMesh.rotation.z -= (ball.velocity[0] / BALL_RADIUS) * dt;
      }
    };

    const clearTrail = () => {
      trailPointCount = 0;
      trailWriteIndex = 0;
      trailLastPoint.set(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      trail.geometry.setDrawRange(0, 0);
      trail.moteGeometry.setDrawRange(0, 0);
      trail.line.visible = false;
      trail.motes.visible = false;
    };

    const pushTrailPoint = () => {
      ballVector.set(ball.position[0], ball.position[1], ball.position[2]);
      if (trailPointCount > 0 && trailLastPoint.distanceTo(ballVector) <= (ball.airborne ? 2.2 : 1.5)) {
        return;
      }

      trailPointBuffer[trailWriteIndex].copy(ballVector);
      trailLastPoint.copy(ballVector);
      trailWriteIndex = (trailWriteIndex + 1) % TRAIL_LENGTH;
      trailPointCount = Math.min(TRAIL_LENGTH, trailPointCount + 1);
    };

    const rebuildCourseGeometry = () => {
      for (const object of [terrain, boostZones, teeMarkers, greenPolish, cup, flagstick]) {
        scene.remove(object);
        disposeObject(object);
      }

      terrain = createTerrainMesh(activeHole);
      boostZones = createBoostZones(activeHole);
      teeMarkers = createTeeMarkers(activeHole);
      greenPolish = createGreenPolish(activeHole);
      cup = createCup(activeHole);
      const flag = createFlagstick(activeHole);
      flagstick = flag.group;
      flagGeometry = flag.flagGeometry;

      scene.add(terrain);
      scene.add(boostZones);
      scene.add(teeMarkers);
      scene.add(greenPolish);
      scene.add(cup);
      scene.add(flagstick);
    };

    const resetHole = () => {
      resetBallToLie(ball, activeHole, activeHole.teePosition.x, activeHole.teePosition.z);
      strokes = 0;
      phase = "IDLE";
      shotResult = "READY TO RIP";
      holed = false;
      holedAt = 0;
      screenShake = 0;
      activeWind = windForShot(activeHole, 1);
      lastShotWind = activeWind;
      lastShotSetup = propsRef.current.shotSetup;
      lastShotType = "normal";
      lastShotStartDistance = holeDistance(activeHole);
      lastShotWasBoosted = false;
      boostUsedThisShot = false;
      lowSpeedControlSeconds = 0;
      shotStartedAt = 0;
      lastLipOutAt = 0;
      lastFlagHitAt = 0;
      lastBounceAt = 0;
      holeBurstStartedAt = 0;
      landingPulseStartedAt = 0;
      boostPulseStartedAt = 0;
      visualStrikeStartedAt = -1000;
      visualStrikePower = 0;
      visualStrikeBackswing = 0;
      visualStrikeX = activeHole.teePosition.x;
      visualStrikeZ = activeHole.teePosition.z;
      visualStrikeShotType = "normal";
      visualFollowThroughUntil = -1000;
      holeBurst.visible = false;
      landingPulse.pulse.visible = false;
      boostPulse.pulse.visible = false;
      cupParticles.points.visible = false;
      cupParticles.material.opacity = 0;
      aimAngle = Math.atan2(activeHole.cupPosition.x - activeHole.teePosition.x, activeHole.cupPosition.z - activeHole.teePosition.z);
      clearTrail();
      input.reset(300);
      selectActiveClub(autoSelectClub(holeDistance(activeHole)), false);
      updateBallMesh(0);
      emitHud(true);
    };

    const selectActiveClub = (clubId: ClubId, playSound = true) => {
      activeClubId = clubId;
      clubSyncGraceUntil = performance.now() + 120;
      if (playSound) {
        audio.playUi();
      }
      propsRef.current.onClubChange(clubId);
      emitHud(true);
    };

    const cycleCamera = () => {
      cameraMode = cameraMode === "auto" ? "follow" : cameraMode === "follow" ? "pin" : "auto";
      audio.playUi();
      emitHud(true);
    };

    const input = new TrackballInput(container, {
      canSwing: () => propsRef.current.active && !ball.moving && !holed,
      getSettings: () => propsRef.current.settings,
      onStrike: (strike) => {
        if (!propsRef.current.active || ball.moving || holed) {
          return;
        }

        const club = CLUB_BY_ID[activeClubId] ?? CLUB_BY_ID.driver;
        const setup = propsRef.current.shotSetup;
        const shotType = effectiveShotType(activeClubId, setup.shotType);
        activeWind = windForShot(activeHole, strokes + 1);
        lastShotWind = activeWind;
        lastShotSetup = setup;
        lastShotType = shotType;
        lastShotStartDistance = distanceToCup(ball.position[0], ball.position[2], activeHole);
        lastShotWasBoosted = false;
        boostUsedThisShot = false;
        lastBounceAt = 0;
        const strikeStartedAt = performance.now();
        visualStrikeStartedAt = strikeStartedAt;
        visualStrikePower = strike.power;
        visualStrikeBackswing = strike.backswing;
        visualStrikeX = ball.position[0];
        visualStrikeZ = ball.position[2];
        visualStrikeShotType = shotType;
        visualFollowThroughUntil = strikeStartedAt + (shotType === "putt" ? 520 : 760 + strike.power * 260);
        audio.playHit(strike.power);
        strokes += 1;
        phase = "BALL_FLIGHT";
        shotStartedAt = strikeStartedAt;
        launchBall(ball, strike, club, aimAngle, propsRef.current.settings.arcadePhysics, setup, ball.surface);
        shotResult = shotFeedback(strike, club, ball.surface, setup.shotType, setup, activeWind);
        setTrailStyle(shotType, setup);
        screenShake = strike.power > 0.74 ? 1.5 : 0.72;
        lowSpeedControlSeconds = 0;
        clearTrail();
        emitHud(true);
      },
      onUpdate: (snapshot) => {
        const phaseChanged = snapshot.phase !== swingSnapshot.phase;
        swingSnapshot = snapshot;
        if (!ball.moving && !holed) {
          phase = snapshot.phase;
        }
        emitHud(phaseChanged || snapshot.phase === "STRIKE");
      }
    });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const updateAimVisuals = () => {
      const club = CLUB_BY_ID[activeClubId] ?? CLUB_BY_ID.driver;
      const setup = propsRef.current.shotSetup;
      const wind = ball.moving ? activeWind : windForShot(activeHole, strokes + 1);
      const estimate = estimateShot(club, setup, ball.surface, wind, aimAngle);
      const [x, , z] = ball.position;
      const previewAngle = aimAngle + estimate.curve * (effectiveShotType(activeClubId, setup.shotType) === "punch" ? 0.12 : 0.1);
      aimDirection.set(Math.sin(previewAngle), 0, Math.cos(previewAngle)).normalize();
      aimOrigin.set(x, terrainHeightAt(x, z, activeHole) + 1.05, z);
      aimArrow.position.copy(aimOrigin);
      aimArrow.setDirection(aimDirection);
      aimArrow.setLength(Math.min(120, 24 + estimate.total * 0.28), 7, 4);
      aimArrow.visible = !ball.moving && !holed;

      const positions = shotLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      const points = positions.count;
      const length = Math.min(190, Math.max(32, estimate.total * 0.82));
      for (let i = 0; i < points; i += 1) {
        const t = i / (points - 1);
        const px = x + aimDirection.x * length * t;
        const pz = z + aimDirection.z * length * t;
        const liftPreview = Math.sin(Math.PI * t) * Math.min(24, estimate.launchDeg * 0.34);
        positions.setXYZ(i, px, terrainHeightAt(px, pz, activeHole) + 0.18 + liftPreview, pz);
      }
      positions.needsUpdate = true;
      shotLine.computeLineDistances();
      shotLine.visible = !ball.moving && !holed;

      const landingDistance = effectiveShotType(activeClubId, setup.shotType) === "putt" ? estimate.total : estimate.carry;
      const markerX = x + aimDirection.x * landingDistance;
      const markerZ = z + aimDirection.z * landingDistance;
      landingMarker.position.set(markerX, terrainHeightAt(markerX, markerZ, activeHole) + 0.24, markerZ);
      landingMarker.scale.setScalar(clamp(0.78 + estimate.roll / 80, 0.78, 1.65));
      landingMarker.visible = !ball.moving && !holed;
    };

    const updateTrail = (now: number) => {
      if (ball.moving) {
        pushTrailPoint();
      }

      const attribute = trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttribute = trail.geometry.getAttribute("color") as THREE.BufferAttribute;
      const moteAttribute = trail.moteGeometry.getAttribute("position") as THREE.BufferAttribute;
      const start = (trailWriteIndex - trailPointCount + TRAIL_LENGTH) % TRAIL_LENGTH;
      const spin = lastShotSetup.spin;
      const moteStride = Math.max(1, Math.floor(Math.max(1, trailPointCount) / TRAIL_MOTE_COUNT));
      let moteCount = 0;

      for (let i = 0; i < trailPointCount; i += 1) {
        const point = trailPointBuffer[(start + i) % TRAIL_LENGTH];
        const t = trailPointCount <= 1 ? 1 : i / (trailPointCount - 1);
        attribute.setXYZ(i, point.x, point.y, point.z);
        trailTempColor.copy(trailTailColor).lerp(trailHeadColor, t);
        colorAttribute.setXYZ(i, trailTempColor.r, trailTempColor.g, trailTempColor.b);

        if (i % moteStride === 0 && moteCount < TRAIL_MOTE_COUNT) {
          const swirl = Math.sin(now * 0.012 + i * 0.72) * (0.18 + Math.abs(spin) * 0.78);
          const lift = Math.cos(now * 0.01 + i * 0.53) * (0.12 + Math.abs(spin) * 0.28);
          moteAttribute.setXYZ(moteCount, point.x + swirl, point.y + lift, point.z - swirl * 0.45);
          moteCount += 1;
        }
      }

      attribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
      moteAttribute.needsUpdate = true;
      trail.geometry.setDrawRange(0, trailPointCount);
      trail.moteGeometry.setDrawRange(0, moteCount);
      trail.line.visible = trailPointCount > 1;
      trail.motes.visible = moteCount > 1 && (ball.moving || trailPointCount > 10);
    };

    const setTrailStyle = (shotType: ShotType, setup: ShotSetup) => {
      const material = trail.line.material as THREE.LineBasicMaterial;
      const moteMaterial = trail.motes.material as THREE.PointsMaterial;
      if (setup.spin < -0.42) {
        trailTailColor.set("#214c70");
        trailHeadColor.set("#69d2ff");
      } else if (setup.spin > 0.42) {
        trailTailColor.set("#5b1f18");
        trailHeadColor.set("#ff795d");
      } else if (shotType === "punch") {
        trailTailColor.set("#5b5120");
        trailHeadColor.set("#f5d547");
      } else if (shotType === "flop") {
        trailTailColor.set("#85d7ff");
        trailHeadColor.set("#f8fbf4");
      } else if (shotType === "chip") {
        trailTailColor.set("#1f6b4c");
        trailHeadColor.set("#6ff3a8");
      } else {
        trailTailColor.set("#715f26");
        trailHeadColor.set("#fff1a6");
      }
      moteMaterial.color.copy(trailHeadColor);
      moteMaterial.size = shotType === "flop" ? 1.05 : shotType === "punch" ? 0.62 : 0.82;
      moteMaterial.opacity = setup.spin === 0 ? 0.36 : clamp(0.42 + Math.abs(setup.spin) * 0.2, 0.42, 0.64);
      material.opacity = shotType === "flop" ? 0.94 : 0.88;
    };

    const updateClubVisual = (now: number) => {
      const club = CLUB_BY_ID[activeClubId] ?? CLUB_BY_ID.driver;
      const category = club.category;
      const setup = propsRef.current.shotSetup;
      const currentShotType = effectiveShotType(activeClubId, setup.shotType);
      const shotType = now < visualFollowThroughUntil ? visualStrikeShotType : currentShotType;
      const putterStroke = shotType === "putt";

      if (clubVisual.activeCategory !== category) {
        for (const [headCategory, head] of Object.entries(clubVisual.heads)) {
          head.visible = headCategory === category;
        }
        clubVisual.activeCategory = category;
      }

      const swingSize = putterStroke ? 0.72 : shotType === "chip" ? 0.74 : shotType === "punch" ? 0.86 : shotType === "flop" ? 1.08 : 1;
      const backDistance = (putterStroke ? 2.8 : shotType === "chip" ? 4.2 : shotType === "punch" ? 5.2 : shotType === "flop" ? 6.8 : 6.2) * swingSize;
      const followDistance = (putterStroke ? 3.1 : shotType === "chip" ? 4.3 : shotType === "punch" ? 5.1 : shotType === "flop" ? 6.1 : 5.8) * swingSize;
      const arcHeight = (putterStroke ? 0.18 : shotType === "chip" ? 0.9 : shotType === "punch" ? 1.35 : shotType === "flop" ? 3 : 2.15) * swingSize;
      const followDuration = Math.max(1, visualFollowThroughUntil - visualStrikeStartedAt);
      const followT = clamp((now - visualStrikeStartedAt) / followDuration, 0, 1);
      const followActive = now < visualFollowThroughUntil;
      const [ballX, , ballZ] = ball.position;
      const originX = followActive ? visualStrikeX : ballX;
      const originZ = followActive ? visualStrikeZ : ballZ;
      const groundY = terrainHeightAt(originX, originZ, activeHole);
      const idleBob = Math.sin(now * 0.004) * 0.025;
      const backAmount = easeOutCubic(swingSnapshot.backswing);
      const topLoad = smoothStep(0.78, 1, backAmount);
      const downAmount = phase === "DOWNSWING" ? smoothStep(0.06, 0.82, swingSnapshot.downswingVelocity) : 0;
      const visualPower = followActive ? visualStrikePower : clamp(swingSnapshot.power + swingSnapshot.backswing * 0.45, 0.16, 1);

      let pathT = -0.42;
      let lift = idleBob;
      let planeTilt = putterStroke ? -0.08 : -0.2;
      let faceRelease = 0;

      if (followActive) {
        const strikeBack = easeOutCubic(Math.max(visualStrikeBackswing, 0.04));
        const strikeTopLoad = smoothStep(0.78, 1, strikeBack);
        const loadHoldT = putterStroke ? 0.035 : 0.06;
        const impactT = putterStroke ? 0.24 : 0.27;
        const downswingT = smoothStep(loadHoldT, impactT, followT);
        const followEase = easeOutCubic(smoothStep(impactT, 1, followT));
        const followStrength = 0.42 + visualStrikePower * 0.72;
        const remainingBack = strikeBack * (1 - downswingT);
        pathT =
          -0.42 -
          backDistance * remainingBack -
          strikeTopLoad * 0.18 * (1 - downswingT) +
          followDistance * followEase * followStrength;
        lift +=
          arcHeight * Math.sin(remainingBack * Math.PI * 0.5) +
          arcHeight * Math.sin(followEase * Math.PI * 0.5) * (putterStroke ? 0.55 : 0.78 + visualStrikePower * 0.24);
        planeTilt = putterStroke
          ? -0.08 + remainingBack * 0.14 - followEase * 0.14
          : -0.2 + remainingBack * 0.72 - followEase * (0.5 + visualStrikePower * 0.34);
        faceRelease = -strikeTopLoad * 0.05 * (1 - downswingT) + followEase * (putterStroke ? 0.06 : 0.2);
      } else if (phase === "DOWNSWING") {
        const topBack = easeOutCubic(Math.max(visualStrikeBackswing, swingSnapshot.backswing));
        const remainingBack = topBack * (1 - downAmount);
        pathT = -0.42 - backDistance * remainingBack + followDistance * 0.12 * downAmount * visualPower;
        lift += arcHeight * Math.sin(remainingBack * Math.PI * 0.5);
        planeTilt = putterStroke ? -0.08 + remainingBack * 0.12 : -0.2 + remainingBack * 0.72 - downAmount * 0.28;
        faceRelease = downAmount * (putterStroke ? 0.04 : 0.1);
      } else if (phase === "BACKSWING") {
        pathT = -0.42 - backDistance * backAmount - topLoad * 0.22;
        lift += arcHeight * Math.sin(backAmount * Math.PI * 0.5) - topLoad * 0.12;
        planeTilt = putterStroke ? -0.08 + backAmount * 0.16 : -0.2 + backAmount * 0.78 + topLoad * 0.08;
        faceRelease = -topLoad * 0.06;
      }

      clubAimVector.set(Math.sin(aimAngle), 0, Math.cos(aimAngle));
      clubSideVector.set(Math.cos(aimAngle), 0, -Math.sin(aimAngle));
      clubOffset.copy(clubAimVector).multiplyScalar(pathT);
      clubOffset.addScaledVector(clubSideVector, putterStroke ? -0.18 : -0.34);

      const yaw = aimAngle + faceRelease;
      const headLocalX = category === "putter" ? 2.12 : category === "wood" ? 1.95 : 1.9;
      const headLocalY = category === "putter" ? 0.45 : category === "wood" ? 0.7 : 0.76;
      const headLocalZ = category === "putter" ? -2.25 : category === "wood" ? -2.35 : -2.28;
      clubHeadOffset.set(
        Math.cos(yaw) * headLocalX + Math.sin(yaw) * headLocalZ,
        0,
        -Math.sin(yaw) * headLocalX + Math.cos(yaw) * headLocalZ
      );

      clubVisual.group.visible = !holed && (!ball.moving || followActive);
      clubVisual.group.position.set(
        originX + clubOffset.x - clubHeadOffset.x,
        groundY + lift + (putterStroke ? 0.45 : 0.68) - headLocalY,
        originZ + clubOffset.z - clubHeadOffset.z
      );
      clubVisual.group.rotation.set(planeTilt, yaw, putterStroke ? 0.02 : -0.04 + topLoad * 0.08);
      clubVisual.group.scale.setScalar(category === "putter" ? 0.86 : category === "wood" ? 1 : 0.94);
    };

    const updateWindVane = () => {
      const wind = ball.moving ? activeWind : windForShot(activeHole, strokes + 1);
      if (wind.speed < 2.5 || holed) {
        windVane.visible = false;
        return;
      }

      const direction = (wind.directionDeg * Math.PI) / 180;
      windDirectionVector.set(Math.sin(direction), 0, Math.cos(direction)).normalize();
      const [x, , z] = ball.position;
      const groundY = terrainHeightAt(x, z, activeHole);
      const sideX = Math.cos(aimAngle);
      const sideZ = -Math.sin(aimAngle);
      windVane.position.set(x + sideX * 8.5, groundY + 9.8, z + sideZ * 8.5);
      windVane.setDirection(windDirectionVector);
      windVane.setLength(clamp(10 + wind.speed * 0.82, 10, 24), 3.4, 2.2);
      windVane.setColor(wind.speed >= 12 ? "#ff795d" : wind.speed >= 7 ? "#fff1a6" : "#69d2ff");
      windVane.visible = !ball.moving || ball.airborne;
    };

    const triggerLandingPulse = (surface: SurfaceType, speed: number, now: number) => {
      const [x, , z] = ball.position;
      const pulseScale = clamp(2.1 + speed * 0.045 + Math.abs(lastShotSetup.spin) * 0.9, 2.1, 6.4);
      landingPulseBaseScale = pulseScale;
      landingPulse.material.color.set(IMPACT_COLORS[surface] ?? "#f8fbf4");
      landingPulse.material.opacity = surface === "sand" ? 0.62 : 0.72;
      landingPulse.pulse.position.set(x, terrainHeightAt(x, z, activeHole) + 0.18, z);
      landingPulse.pulse.scale.setScalar(pulseScale);
      landingPulse.pulse.visible = true;
      landingPulseStartedAt = now;
    };

    const triggerBoostPulse = (x: number, z: number, rx: number, rz: number, now: number) => {
      boostPulse.material.opacity = 0.82;
      boostPulseBaseScaleX = rx * 1.05;
      boostPulseBaseScaleY = rz * 1.05;
      boostPulse.pulse.position.set(x, terrainHeightAt(x, z, activeHole) + 0.24, z);
      boostPulse.pulse.scale.set(boostPulseBaseScaleX, boostPulseBaseScaleY, 1);
      boostPulse.pulse.visible = true;
      boostPulseStartedAt = now;
    };

    const updateImpactPulses = (now: number) => {
      if (landingPulse.pulse.visible) {
        const age = (now - landingPulseStartedAt) / 1000;
        const fade = clamp(1 - age / 0.74, 0, 1);
        landingPulse.material.opacity = fade * 0.72;
        landingPulse.pulse.scale.setScalar(landingPulseBaseScale * (1 + age * 1.8));
        if (fade <= 0) {
          landingPulse.pulse.visible = false;
        }
      }

      if (boostPulse.pulse.visible) {
        const age = (now - boostPulseStartedAt) / 1000;
        const fade = clamp(1 - age / 0.92, 0, 1);
        boostPulse.material.opacity = fade * 0.82;
        boostPulse.pulse.rotation.z = age * 3.6;
        boostPulse.pulse.scale.set(boostPulseBaseScaleX * (1 + age * 0.34), boostPulseBaseScaleY * (1 + age * 0.34), 1);
        if (fade <= 0) {
          boostPulse.pulse.visible = false;
        }
      }
    };

    const updateFlag = (now: number) => {
      const positions = flagGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        positions.setZ(i, Math.sin(now * 0.006 + x * 0.9) * 0.23 * Math.max(0, x / 8.8));
      }
      positions.needsUpdate = true;
    };

    const updateBoostZoneVisuals = (now: number) => {
      for (const zone of boostZones.children) {
        const phaseOffset = typeof zone.userData.phase === "number" ? zone.userData.phase : 0;
        const pulse = (Math.sin(now * 0.0038 + phaseOffset) + 1) * 0.5;
        zone.rotation.y = Math.sin(now * 0.0016 + phaseOffset) * 0.08;
        zone.scale.setScalar(1 + pulse * 0.025);

        for (let i = 0; i < zone.children.length; i += 1) {
          const child = zone.children[i];
          if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) {
            continue;
          }
          const material = child.material as THREE.Material;
          if ("opacity" in material) {
            const transparentMaterial = material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
            transparentMaterial.opacity =
              i === 0 ? 0.1 + pulse * 0.06 : i === 1 ? 0.5 + pulse * 0.25 : i === 2 ? 0.24 + pulse * 0.2 : 0.26 + pulse * 0.16;
          }
        }
      }
    };

    const updateWindStreams = (now: number) => {
      const wind = ball.moving ? activeWind : windForShot(activeHole, strokes + 1);
      if (wind.speed < 1.6 || holed) {
        windStreams.line.visible = false;
        return;
      }

      const direction = (wind.directionDeg * Math.PI) / 180;
      const windX = Math.sin(direction);
      const windZ = Math.cos(direction);
      const crossX = windZ;
      const crossZ = -windX;
      const centerX = ball.moving ? ball.position[0] : (ball.position[0] + activeHole.cupPosition.x) * 0.5;
      const centerZ = ball.moving ? ball.position[2] : ball.position[2] + Math.min(175, distanceToCup(ball.position[0], ball.position[2], activeHole) * 0.42);
      const flow = now * (0.008 + wind.speed * 0.0009);
      const segmentLength = 5.5 + wind.speed * 0.65;
      const positions = windStreams.geometry.getAttribute("position") as THREE.BufferAttribute;

      for (let i = 0; i < WIND_STREAM_COUNT; i += 1) {
        const lane = (i % 7 - 3) * 18;
        const stack = Math.floor(i / 7) * 29 - 38;
        const drift = ((flow * 30 + i * 17) % 94) - 47;
        const wobble = Math.sin(now * 0.002 + i * 1.9) * 5.5;
        const x = centerX + crossX * (lane + wobble) + windX * drift;
        const z = centerZ + crossZ * (lane + wobble) + windZ * drift + stack;
        const y = terrainHeightAt(x, z, activeHole) + 7.5 + (i % 4) * 1.7;
        positions.setXYZ(i * 2, x - windX * segmentLength, y, z - windZ * segmentLength);
        positions.setXYZ(i * 2 + 1, x + windX * segmentLength, y + Math.sin(flow + i) * 0.22, z + windZ * segmentLength);
      }

      const material = windStreams.line.material as THREE.LineBasicMaterial;
      material.opacity = clamp(0.16 + wind.speed / 34, 0.18, 0.52);
      positions.needsUpdate = true;
      windStreams.line.visible = true;
    };

    const triggerCupParticles = (now: number) => {
      const cupX = activeHole.cupPosition.x;
      const cupZ = activeHole.cupPosition.z;
      const cupY = terrainHeightAt(cupX, cupZ, activeHole) + 0.7;

      for (let i = 0; i < CUP_PARTICLE_COUNT; i += 1) {
        const index = i * 3;
        const angle = i * GOLDEN_ANGLE + activeHole.fairway.curveSeed;
        const radius = 0.4 + (i % 5) * 0.17;
        const speed = 5.2 + (i % 7) * 0.58;
        cupParticles.positions[index] = cupX + Math.sin(angle) * radius;
        cupParticles.positions[index + 1] = cupY;
        cupParticles.positions[index + 2] = cupZ + Math.cos(angle) * radius;
        cupParticles.velocities[index] = Math.sin(angle) * speed;
        cupParticles.velocities[index + 1] = 7.2 + (i % 6) * 0.72;
        cupParticles.velocities[index + 2] = Math.cos(angle) * speed;
      }

      cupParticles.material.opacity = 0.88;
      cupParticles.points.visible = true;
      (cupParticles.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      holeBurstStartedAt = now;
    };

    const updateHoleBurst = (now: number, dt: number) => {
      if (!holeBurst.visible || holeBurstStartedAt <= 0) {
        if (!cupParticles.points.visible) {
          return;
        }
      }

      const age = (now - holeBurstStartedAt) / 1000;
      if (holeBurst.visible) {
        const material = holeBurst.material as THREE.MeshBasicMaterial;
        const pulse = clamp(1 - age / 1.1, 0, 1);
        holeBurst.scale.setScalar(1 + age * 8.5);
        material.opacity = pulse * 0.72;
        if (pulse <= 0) {
          holeBurst.visible = false;
        }
      }

      if (cupParticles.points.visible) {
        const particleFade = clamp(1 - age / 1.35, 0, 1);
        const cupY = terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole) + 0.16;
        for (let i = 0; i < CUP_PARTICLE_COUNT; i += 1) {
          const index = i * 3;
          cupParticles.velocities[index + 1] -= 19 * dt;
          cupParticles.positions[index] += cupParticles.velocities[index] * dt;
          cupParticles.positions[index + 1] = Math.max(cupY, cupParticles.positions[index + 1] + cupParticles.velocities[index + 1] * dt);
          cupParticles.positions[index + 2] += cupParticles.velocities[index + 2] * dt;
          cupParticles.velocities[index] *= 0.988;
          cupParticles.velocities[index + 2] *= 0.988;
        }
        cupParticles.material.opacity = particleFade * 0.88;
        (cupParticles.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        if (particleFade <= 0) {
          cupParticles.points.visible = false;
        }
      }
    };

    const updateCamera = (now: number, dt: number) => {
      const [x, y, z] = ball.position;
      const impactHoldMs = visualStrikeShotType === "putt" ? 420 : 820;
      const holdImpactView = ball.moving && cameraMode === "auto" && now - visualStrikeStartedAt < impactHoldMs;
      const moving = (ball.moving && !holdImpactView) || cameraMode === "follow";
      const pinMode = cameraMode === "pin";
      const cameraAnchorX = holdImpactView ? visualStrikeX : x;
      const cameraAnchorZ = holdImpactView ? visualStrikeZ : z;
      const cameraAnchorY = holdImpactView ? terrainHeightAt(cameraAnchorX, cameraAnchorZ, activeHole) : y;
      aimDirection.set(Math.sin(aimAngle), 0, Math.cos(aimAngle)).normalize();
      velocityDir.set(ball.velocity[0], 0, ball.velocity[2]);
      if (velocityDir.lengthSq() > 1) {
        velocityDir.normalize();
      } else {
        velocityDir.copy(aimDirection);
      }

      if (pinMode) {
        desiredCamera.set(
          activeHole.cupPosition.x + 58,
          terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole) + 58,
          activeHole.cupPosition.z - 94
        );
        desiredLook.set(
          activeHole.cupPosition.x,
          terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole) + 7,
          activeHole.cupPosition.z
        );
      } else if (moving) {
        desiredCamera.set(x - velocityDir.x * 40, y + (ball.airborne ? 24 : 15), z - velocityDir.z * 42);
        desiredLook.set(x + velocityDir.x * 18, y + (ball.airborne ? 8 : 5), z + velocityDir.z * 22);
      } else {
        desiredCamera.set(cameraAnchorX - aimDirection.x * 48, cameraAnchorY + 23, cameraAnchorZ - aimDirection.z * 52);
        desiredLook.set(cameraAnchorX + aimDirection.x * 36, cameraAnchorY + 5.5, cameraAnchorZ + aimDirection.z * 45);
      }

      if (screenShake > 0) {
        const amount = screenShake * 0.34;
        desiredCamera.x += (Math.random() - 0.5) * amount;
        desiredCamera.y += (Math.random() - 0.5) * amount;
        screenShake = Math.max(0, screenShake - dt * 2.9);
      }

      const cameraT = 1 - Math.exp(-(moving ? 2.4 : 4.8) * dt);
      camera.position.lerp(desiredCamera, cameraT);
      cameraLook.lerp(desiredLook, 1 - Math.exp(-5.5 * dt));
      camera.lookAt(cameraLook);
    };

    const scoreAwareSinkMessage = (message: string) => {
      if (message === "FLAG SAVE") {
        return message;
      }
      if (strokes === 1) {
        return activeHole.par === 3 ? "ACE" : "ACE RUN";
      }
      if (activeHole.par - strokes >= 2) {
        return "EAGLE DROP";
      }
      if (lastShotType === "putt" && lastShotStartDistance > 35) {
        return "LONG PUTT";
      }
      if (performance.now() - lastBounceAt < 1400) {
        return "BOUNCE-IN";
      }
      return message;
    };

    const sinkBall = (message: string) => {
      holed = true;
      holedAt = performance.now();
      phase = "HOLED";
      shotResult = scoreAwareSinkMessage(message);
      ball.position = [
        activeHole.cupPosition.x,
        terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole) + 0.45,
        activeHole.cupPosition.z
      ];
      ball.velocity = [0, 0, 0];
      ball.moving = false;
      ball.airborne = false;
      ball.spin = 0;
      ball.rollSpin = 0;
      ball.windInfluence = 0;
      ball.settleSeconds = 0;
      lowSpeedControlSeconds = 0;
      shotStartedAt = 0;
      triggerCupParticles(holedAt);
      holeBurst.position.set(
        activeHole.cupPosition.x,
        terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole) + 0.18,
        activeHole.cupPosition.z
      );
      holeBurst.scale.setScalar(1);
      holeBurst.visible = true;
      audio.playCup();
      input.reset(900);
      emitHud(true);
    };

    const handleCup = (now: number, dt: number) => {
      if (holed) {
        return;
      }

      const [x, y, z] = ball.position;
      const [vx, , vz] = ball.velocity;
      const speed = Math.hypot(vx, vz);
      const cupDistance = distanceToCup(x, z, activeHole);
      const cupY = terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole);
      const lowEnough = y <= cupY + BALL_RADIUS + 3.2 || !ball.airborne;
      const magnetRadius = CUP_RADIUS * 2.9;

      if (!lowEnough || cupDistance > magnetRadius) {
        return;
      }

      if (cupDistance <= CUP_RADIUS * 1.08 && speed < 10.4) {
        sinkBall("DROPPED");
        return;
      }

      if (cupDistance <= CUP_RADIUS * 0.58 && speed < 15.2) {
        sinkBall("CENTER CUT");
        return;
      }

      if (cupDistance <= CUP_RADIUS * 1.38 && speed < 3.4) {
        sinkBall("DROPPED");
        return;
      }

      if (speed > 0.1 && speed < 24) {
        const pull = clamp((magnetRadius - cupDistance) / magnetRadius, 0, 1);
        const dirX = (activeHole.cupPosition.x - x) / Math.max(cupDistance, 0.001);
        const dirZ = (activeHole.cupPosition.z - z) / Math.max(cupDistance, 0.001);
        const pullStrength = (speed < 12 ? 10.5 : 5.8) * pull * pull;
        const slow = 1 - clamp(pull * (speed < 16 ? 0.052 : 0.028), 0, 0.08);
        ball.velocity[0] = (ball.velocity[0] + dirX * pullStrength * dt) * slow;
        ball.velocity[2] = (ball.velocity[2] + dirZ * pullStrength * dt) * slow;
      }

      if (cupDistance <= CUP_RADIUS * 1.1 && speed >= 11.8 && now - lastLipOutAt > 850) {
        lastLipOutAt = now;
        shotResult = "LIP OUT";
        const angle = Math.atan2(x - activeHole.cupPosition.x, z - activeHole.cupPosition.z) + Math.PI / 2;
        ball.velocity[0] = ball.velocity[0] * 0.68 + Math.sin(angle) * 2.4;
        ball.velocity[2] = ball.velocity[2] * 0.68 + Math.cos(angle) * 2.4;
        ball.airborne = false;
        ball.settleSeconds = 0;
        audio.playBounce(0.35);
        emitHud(true);
      }
    };

    const distanceToSegment = (ax: number, az: number, bx: number, bz: number, px: number, pz: number) => {
      const dx = bx - ax;
      const dz = bz - az;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq <= 0.0001) {
        return horizontalDistance(ax, az, px, pz);
      }
      const t = clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1);
      return horizontalDistance(ax + dx * t, az + dz * t, px, pz);
    };

    const handleFlagstick = (now: number, previousX: number, previousZ: number) => {
      if (holed || now - lastFlagHitAt < 420) {
        return;
      }

      const [x, y, z] = ball.position;
      const [vx, vy, vz] = ball.velocity;
      const speed = Math.hypot(vx, vz);
      const cupY = terrainHeightAt(activeHole.cupPosition.x, activeHole.cupPosition.z, activeHole);
      const lowEnough = y <= cupY + 8.5 && vy < 8;
      const pinRadius = BALL_RADIUS + 0.92;
      const closest = distanceToSegment(previousX, previousZ, x, z, activeHole.cupPosition.x, activeHole.cupPosition.z);

      if (!lowEnough || speed < 1.2 || closest > pinRadius) {
        return;
      }

      lastFlagHitAt = now;
      const directDistance = Math.max(0.001, distanceToCup(x, z, activeHole));
      const normalX = (x - activeHole.cupPosition.x) / directDistance || 1;
      const normalZ = (z - activeHole.cupPosition.z) / directDistance || 0;
      const dot = vx * normalX + vz * normalZ;
      const reflectX = vx - 2 * dot * normalX;
      const reflectZ = vz - 2 * dot * normalZ;
      const tangentSign = Math.sign(vx * normalZ - vz * normalX) || (activeHole.holeNumber % 2 === 0 ? 1 : -1);
      const tangentX = normalZ * tangentSign;
      const tangentZ = -normalX * tangentSign;
      const savedSpeed = speed * (speed > 25 ? 0.42 : 0.32);

      ball.velocity[0] = reflectX * 0.34 + tangentX * savedSpeed * 0.22;
      ball.velocity[1] = Math.min(vy * 0.28, 2.2);
      ball.velocity[2] = reflectZ * 0.34 + tangentZ * savedSpeed * 0.22;
      ball.airborne = false;
      ball.settleSeconds = 0;
      screenShake = Math.max(screenShake, 0.45);

      if (speed < 14 && closest < CUP_RADIUS * 0.78) {
        sinkBall("FLAG SAVE");
        return;
      }

      shotResult = speed > 24 ? "PINBALL" : closest < CUP_RADIUS * 0.88 ? "FLAG SAVE" : "STICK CHECK";
      audio.playBounce(Math.min(0.8, speed / 34));
      emitHud(true);
    };

    const handleBoostZone = (now: number) => {
      if (boostUsedThisShot || holed || ball.airborne) {
        return;
      }

      const [x, , z] = ball.position;
      const speed = Math.hypot(ball.velocity[0], ball.velocity[2]);
      const boost = boostZoneAt(x, z, activeHole);
      if (!boost || speed < 8 || ball.surface === "sand") {
        return;
      }

      boostUsedThisShot = true;
      lastShotWasBoosted = true;
      const boostScale = clamp(1.08 + speed / 360, 1.08, 1.16);
      ball.velocity[0] *= boostScale;
      ball.velocity[2] *= boostScale;
      ball.rollSpin = Math.max(ball.rollSpin, 0.28);
      ball.settleSeconds = 0;
      shotResult = distanceToCup(x, z, activeHole) > 150 ? "HERO LINE" : "GREEN LIGHT";
      triggerBoostPulse(boost.x, boost.z, boost.rx, boost.rz, now);
      screenShake = Math.max(screenShake, 0.35);
      audio.playBounce(0.42);
      emitHud(true);
    };

    const stoppedShotMessage = (fallback: string) => {
      const pinDistance = distanceToCup(ball.position[0], ball.position[2], activeHole);
      const onGreen = ball.surface === "green";
      const approach = lastShotType !== "putt";

      if (onGreen && approach && pinDistance < 8) {
        return "PIN SEEKER";
      }

      if (onGreen && approach && lastShotSetup.spin < -0.48 && pinDistance < 30) {
        return "BACKSPIN BITE";
      }

      if (onGreen && approach && lastShotWind.speed >= 8 && pinDistance < 32) {
        return "WIND READ";
      }

      if (lastShotWasBoosted && pinDistance < 125) {
        return "HERO LINE";
      }

      return fallback;
    };

    const aimAtCupFromBall = () => {
      const [x, , z] = ball.position;
      aimAngle = normalizeAngle(Math.atan2(activeHole.cupPosition.x - x, activeHole.cupPosition.z - z));
    };

    const prepareNextShot = () => {
      const [x, , z] = ball.position;
      aimAtCupFromBall();
      const distance = distanceToCup(x, z, activeHole);
      selectActiveClub(autoSelectClub(distance, ball.surface), false);
    };

    const stopBallForNextShot = (message?: string) => {
      if (holed) {
        return;
      }

      const [x, , z] = ball.position;
      const safeX = Number.isFinite(x) ? x : activeHole.teePosition.x;
      const safeZ = Number.isFinite(z) ? z : activeHole.teePosition.z;
      ball.position = [safeX, terrainHeightAt(safeX, safeZ, activeHole) + BALL_RADIUS, safeZ];
      ball.velocity = [0, 0, 0];
      ball.moving = false;
      ball.airborne = false;
      ball.spin = 0;
      ball.rollSpin = 0;
      ball.windInfluence = 0;
      ball.settleSeconds = 0;
      ball.surface = surfaceAt(safeX, safeZ, activeHole);
      phase = "BALL_STOPPED";
      lowSpeedControlSeconds = 0;
      shotStartedAt = 0;
      if (message) {
        shotResult = message;
      }
      prepareNextShot();
      input.reset(460);
      emitHud(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        propsRef.current.onControlKey("R");
        resetHole();
        return;
      }

      if (key === "c") {
        event.preventDefault();
        propsRef.current.onControlKey("C");
        cycleCamera();
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        propsRef.current.onControlKey("Esc");
        propsRef.current.onPauseToggle();
        return;
      }

      if (!propsRef.current.active || ball.moving || holed) {
        return;
      }

      if (key === "a" || key === "d") {
        event.preventDefault();
        propsRef.current.onControlKey(key.toUpperCase());
        aimAngle = normalizeAngle(aimAngle + (key === "a" ? -0.058 : 0.058));
        emitHud(true);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      container.focus();
      if (isSceneControlTarget(event.target) || event.button !== 0 || ball.moving || holed) {
        return;
      }
      draggingAim = true;
      lastPointerX = event.clientX;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingAim || !propsRef.current.active || ball.moving || holed) {
        return;
      }
      const delta = event.clientX - lastPointerX;
      lastPointerX = event.clientX;
      aimAngle = normalizeAngle(aimAngle + delta * 0.0048);
      emitHud(true);
    };

    const handlePointerUp = () => {
      draggingAim = false;
    };

    const mobileSwingZone = mobileSwingZoneRef.current;
    const mobileAimLeft = mobileAimLeftRef.current;
    const mobileAimRight = mobileAimRightRef.current;
    const mobileControlCleanups: Array<() => void> = [];
    let mobileSwingActive = false;
    let mobileSwingPointerId = -1;
    let mobileSwingStartY = 0;
    let mobileSwingPeakY = 0;
    let mobileSwingLastX = 0;
    let mobileSwingLastY = 0;
    let mobileSwingLastAt = 0;
    let mobileAimInterval = 0;

    const setMobileSwingUi = (pull: number, release: number, activeSwing: boolean) => {
      if (!mobileSwingZone) {
        return;
      }

      mobileSwingZone.style.setProperty("--mobile-swing-pull", pull.toFixed(3));
      mobileSwingZone.style.setProperty("--mobile-swing-release", release.toFixed(3));
      mobileSwingZone.classList.toggle("is-active", activeSwing);
    };

    const handleMobileSwingPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const now = performance.now();
      if (!input.startTouchSwing(now)) {
        return;
      }

      mobileSwingActive = true;
      mobileSwingPointerId = event.pointerId;
      mobileSwingStartY = event.clientY;
      mobileSwingPeakY = event.clientY;
      mobileSwingLastX = event.clientX;
      mobileSwingLastY = event.clientY;
      mobileSwingLastAt = now;
      mobileSwingZone?.setPointerCapture(event.pointerId);
      setMobileSwingUi(0, 0, true);
    };

    const handleMobileSwingPointerMove = (event: PointerEvent) => {
      if (!mobileSwingActive || event.pointerId !== mobileSwingPointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const now = performance.now();
      const deltaX = event.clientX - mobileSwingLastX;
      const deltaY = event.clientY - mobileSwingLastY;
      mobileSwingPeakY = Math.max(mobileSwingPeakY, event.clientY);

      if (Math.abs(deltaX) + Math.abs(deltaY) > 0.5) {
        input.applyTouchSwing(deltaY, deltaX, now);
      }

      const pull = clamp((mobileSwingPeakY - mobileSwingStartY) / 280, 0, 1);
      const release = clamp((mobileSwingPeakY - event.clientY) / Math.max(92, mobileSwingPeakY - mobileSwingStartY), 0, 1);
      setMobileSwingUi(pull, release, true);
      mobileSwingLastX = event.clientX;
      mobileSwingLastY = event.clientY;
      mobileSwingLastAt = now;
    };

    const finishMobileSwing = (event?: PointerEvent) => {
      if (!mobileSwingActive) {
        return;
      }

      const now = performance.now();
      if (event && event.pointerId === mobileSwingPointerId) {
        event.preventDefault();
        event.stopPropagation();
        const releaseTravel = Math.max(0, mobileSwingPeakY - event.clientY);
        const releaseVelocity = Math.max(0, (mobileSwingLastY - event.clientY) / Math.max(12, now - mobileSwingLastAt));
        if (releaseTravel > 18) {
          const forwardDelta = Math.max(34, releaseTravel * 0.52 + releaseVelocity * 56);
          input.applyTouchSwing(-forwardDelta, event.clientX - mobileSwingLastX, now);
          input.releaseTouchSwing(now);
        }
        if (mobileSwingZone?.hasPointerCapture(event.pointerId)) {
          mobileSwingZone.releasePointerCapture(event.pointerId);
        }
      }

      mobileSwingActive = false;
      mobileSwingPointerId = -1;
      setMobileSwingUi(0, 0, false);
    };

    const nudgeMobileAim = (direction: -1 | 1) => {
      if (!propsRef.current.active || ball.moving || holed) {
        return false;
      }

      propsRef.current.onControlKey(direction < 0 ? "Mobile Aim Left" : "Mobile Aim Right");
      aimAngle = normalizeAngle(aimAngle + direction * 0.044);
      emitHud(true);
      return true;
    };

    const stopMobileAim = () => {
      if (mobileAimInterval !== 0) {
        window.clearInterval(mobileAimInterval);
        mobileAimInterval = 0;
      }
    };

    const startMobileAim = (direction: -1 | 1, event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      stopMobileAim();
      nudgeMobileAim(direction);
      mobileAimInterval = window.setInterval(() => {
        if (!nudgeMobileAim(direction)) {
          stopMobileAim();
        }
      }, 72);
    };

    if (mobileSwingZone) {
      mobileSwingZone.addEventListener("pointerdown", handleMobileSwingPointerDown);
      window.addEventListener("pointermove", handleMobileSwingPointerMove);
      window.addEventListener("pointerup", finishMobileSwing);
      window.addEventListener("pointercancel", finishMobileSwing);
      mobileControlCleanups.push(() => {
        mobileSwingZone.removeEventListener("pointerdown", handleMobileSwingPointerDown);
        window.removeEventListener("pointermove", handleMobileSwingPointerMove);
        window.removeEventListener("pointerup", finishMobileSwing);
        window.removeEventListener("pointercancel", finishMobileSwing);
      });
    }

    if (mobileAimLeft) {
      const handleAimLeftPointerDown = (event: PointerEvent) => startMobileAim(-1, event);
      mobileAimLeft.addEventListener("pointerdown", handleAimLeftPointerDown);
      mobileControlCleanups.push(() => mobileAimLeft.removeEventListener("pointerdown", handleAimLeftPointerDown));
    }

    if (mobileAimRight) {
      const handleAimRightPointerDown = (event: PointerEvent) => startMobileAim(1, event);
      mobileAimRight.addEventListener("pointerdown", handleAimRightPointerDown);
      mobileControlCleanups.push(() => mobileAimRight.removeEventListener("pointerdown", handleAimRightPointerDown));
    }

    window.addEventListener("pointerup", stopMobileAim);
    window.addEventListener("pointercancel", stopMobileAim);
    mobileControlCleanups.push(() => {
      stopMobileAim();
      window.removeEventListener("pointerup", stopMobileAim);
      window.removeEventListener("pointercancel", stopMobileAim);
    });

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointerdown", handlePointerDown);
    resize();
    updateBallMesh(0);
    updateAimVisuals();
    emitHud(true);

    let animationFrame = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animationFrame = window.requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (propsRef.current.selectedClubId !== activeClubId && now > clubSyncGraceUntil) {
        activeClubId = propsRef.current.selectedClubId;
        emitHud(true);
      }

      if (propsRef.current.hole.holeNumber !== activeHole.holeNumber) {
        activeHole = propsRef.current.hole;
        rebuildCourseGeometry();
        resetHole();
      }

      if (propsRef.current.restartToken !== lastRestartToken) {
        lastRestartToken = propsRef.current.restartToken;
        resetHole();
      }

      if (propsRef.current.cameraToken !== lastCameraToken) {
        lastCameraToken = propsRef.current.cameraToken;
        cycleCamera();
      }

      input.tick(now, dt);

      if (propsRef.current.active && ball.moving && !holed) {
        const previousX = ball.position[0];
        const previousZ = ball.position[2];
        const wasAirborne = ball.airborne;
        const update = updateBallPhysics(ball, activeHole, dt, propsRef.current.settings.arcadePhysics, activeWind);
        const landed = wasAirborne && !ball.airborne;
        if ((update.bounced || landed) && now - lastBounceAt > 130) {
          lastBounceAt = now;
          triggerLandingPulse(update.surface, update.speed, now);
          if (update.bounced) {
            audio.playBounce(Math.min(1, update.speed / 75));
          }
          if (update.surface === "cart") {
            shotResult = "CART PATH HERO";
            screenShake = Math.max(screenShake, 0.65);
          }
        }

        handleFlagstick(now, previousX, previousZ);
        handleBoostZone(now);
        handleCup(now, dt);

        if (update.stopped && !holed) {
          let stoppedMessage = "NEXT SHOT";
          if (ball.surface === "green") {
            stoppedMessage = distanceToCup(ball.position[0], ball.position[2], activeHole) < 12 ? "PIN HUNTING" : "DANCE FLOOR";
          } else if (ball.surface === "sand") {
            stoppedMessage = "BEACH DAY";
          } else if (ball.surface === "rough") {
            stoppedMessage = "IN THE CABBAGE";
          } else if (ball.surface === "cart") {
            stoppedMessage = "CART PATH HERO";
          }
          stopBallForNextShot(stoppedShotMessage(stoppedMessage));
        } else if (!holed && ball.moving) {
          const [x, y, z] = ball.position;
          const speed = Math.hypot(ball.velocity[0], ball.velocity[1], ball.velocity[2]);
          const groundY = terrainHeightAt(x, z, activeHole) + BALL_RADIUS;
          const nearGround = !ball.airborne || y <= groundY + 0.35;
          const shotAgeSeconds = shotStartedAt > 0 ? (now - shotStartedAt) / 1000 : 0;
          const courseDistance = holeDistance(activeHole);
          const wayOut =
            z < activeHole.teePosition.z - 85 ||
            z > activeHole.cupPosition.z + 135 ||
            Math.abs(x - activeHole.cupPosition.x) > Math.max(155, activeHole.fairway.width * 4.2);
          if (!Number.isFinite(x + y + z + speed)) {
            stopBallForNextShot("DROP RESET");
          } else if (wayOut) {
            stopBallForNextShot("GALLERY DROP");
          } else if (shotAgeSeconds > 30 || (shotAgeSeconds > 16 && nearGround && speed < 7.5)) {
            stopBallForNextShot(speed < 7.5 ? "NEXT SHOT" : courseDistance > 500 ? "LONG ROLL" : "NEXT SHOT");
          } else if (nearGround && speed < 2.05) {
            lowSpeedControlSeconds += dt;
            if (lowSpeedControlSeconds > 1.18) {
              stopBallForNextShot(stoppedShotMessage(ball.surface === "green" ? "PIN HUNTING" : "NEXT SHOT"));
            }
          } else {
            lowSpeedControlSeconds = 0;
          }
        }
      }

      updateBallMesh(dt);
      updateAimVisuals();
      updateTrail(now);
      updateFlag(now);
      updateBoostZoneVisuals(now);
      updateWindStreams(now);
      updateWindVane();
      updateClubVisual(now);
      updateImpactPulses(now);
      updateHoleBurst(now, dt);
      updateCamera(now, dt);
      renderer.render(scene, camera);
      emitHud(false);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      input.destroy();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointerdown", handlePointerDown);
      for (const cleanupMobileControls of mobileControlCleanups) {
        cleanupMobileControls();
      }
      disposeScene(scene, renderer);
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div aria-label="Scroll Tee 3D golf course" className="scene-wrap" ref={containerRef} tabIndex={0}>
      <div className="scene-canvas-layer" ref={canvasHostRef} />
      <div className="mobile-touch-controls" aria-label="Mobile touch controls">
        <div className="mobile-aim-pad" aria-label="Aim controls">
          <button aria-label="Aim left" ref={mobileAimLeftRef} type="button">
            &lt;
          </button>
          <span>Aim</span>
          <button aria-label="Aim right" ref={mobileAimRightRef} type="button">
            &gt;
          </button>
        </div>
        <div className="mobile-swing-zone" ref={mobileSwingZoneRef} role="application" aria-label="Touch swing zone">
          <div className="mobile-swing-fill" aria-hidden="true" />
          <div className="mobile-swing-release" aria-hidden="true" />
          <strong>Pull</strong>
          <span>Swipe up to swing</span>
        </div>
      </div>
    </div>
  );
}
