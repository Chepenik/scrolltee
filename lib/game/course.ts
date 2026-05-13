import { FIRST_HOLE } from "./holes";
import { clamp, horizontalDistance, invLerp, lerp } from "./math";
import type { HoleConfig } from "./holes";
import type { SurfaceType } from "./types";

export const DEFAULT_HOLE = FIRST_HOLE;
export const PAR = DEFAULT_HOLE.par;
export const BALL_RADIUS = 1.25;
export const TEE_POSITION = DEFAULT_HOLE.teePosition;
export const CUP_POSITION = DEFAULT_HOLE.cupPosition;
export const CUP_RADIUS = 3.05;

export const SURFACE_COLORS: Record<SurfaceType, string> = {
  tee: "#4aa757",
  fairway: "#54bd65",
  rough: "#287943",
  green: "#73df70",
  sand: "#d6be76",
  cart: "#8d979a"
};

export function holeDistance(hole: HoleConfig = DEFAULT_HOLE) {
  return horizontalDistance(hole.teePosition.x, hole.teePosition.z, hole.cupPosition.x, hole.cupPosition.z);
}

function progressAt(z: number, hole: HoleConfig) {
  const start = Math.min(hole.teePosition.z, hole.cupPosition.z);
  const end = Math.max(hole.teePosition.z, hole.cupPosition.z);
  return invLerp(start, end, z);
}

export function pointInEllipse(x: number, z: number, cx: number, cz: number, rx: number, rz: number) {
  const nx = (x - cx) / rx;
  const nz = (z - cz) / rz;
  return nx * nx + nz * nz <= 1;
}

export function fairwayCenterAt(z: number, hole: HoleConfig = DEFAULT_HOLE) {
  const p = progressAt(z, hole);
  const base = lerp(hole.teePosition.x, hole.cupPosition.x, p);
  const taper = Math.sin(Math.PI * p);
  const seed = hole.fairway.curveSeed;
  const primary = Math.sin((p * 2.45 + seed) * Math.PI) * hole.fairway.curveStrength;
  const secondary = Math.sin(z * 0.021 + seed * 1.7) * hole.fairway.curveStrength * 0.28;
  const lateKick = Math.sin((p - 0.18) * Math.PI * 3 + seed) * hole.fairway.curveStrength * 0.16;

  return base + (primary + secondary + lateKick) * taper;
}

export function fairwayWidthAt(z: number, hole: HoleConfig = DEFAULT_HOLE) {
  const p = progressAt(z, hole);
  const endFlare = clamp((p - 0.72) / 0.24, 0, 1) * 5;
  const teePinch = 1 - Math.sin(Math.PI * p) * 0.1;
  return Math.max(
    23,
    (hole.fairway.width + Math.sin(z * 0.027 + hole.fairway.curveSeed) * hole.fairway.widthVariation + endFlare) *
      teePinch
  );
}

export function terrainHeightAt(x: number, z: number, hole: HoleConfig = DEFAULT_HOLE) {
  const seed = hole.fairway.curveSeed;
  const p = progressAt(z, hole);
  const broadHill = Math.sin(z * 0.018 + seed) * 1.05 + Math.sin((x + z * 0.22 + seed * 14) * 0.035) * 0.72;
  const rightBank = Math.exp(-((x - 52) * (x - 52)) / 1800) * Math.sin(z * 0.016 + seed) * 1.45;
  const leftMound = Math.exp(-((x + 58) * (x + 58)) / 1300) * Math.cos(z * 0.023 + seed) * 1.25;
  const approachDip = -Math.exp(-((z - (hole.cupPosition.z - 72)) * (z - (hole.cupPosition.z - 72))) / 9000) * 0.95;
  const fairwayPlateau = Math.exp(-((x - fairwayCenterAt(z, hole)) * (x - fairwayCenterAt(z, hole))) / 1800) * 0.28;
  const greenBlend = clamp(1 - horizontalDistance(x, z, hole.cupPosition.x, hole.cupPosition.z) / (hole.greenRadius * 1.42), 0, 1);
  const teeBlend = clamp(1 - horizontalDistance(x, z, hole.teePosition.x, hole.teePosition.z) / 27, 0, 1);
  const natural = broadHill + rightBank + leftMound + approachDip;
  const greenPlateau =
    0.95 +
    p * 0.35 +
    Math.sin((x - hole.cupPosition.x) * 0.12 + seed) * 0.055 +
    Math.sin((z - hole.cupPosition.z) * 0.1) * 0.055;
  const teePlateau = 0.08 + Math.sin(seed) * 0.05;

  return lerp(lerp(natural + fairwayPlateau, greenPlateau, greenBlend * greenBlend), teePlateau, teeBlend * teeBlend);
}

export function surfaceAt(x: number, z: number, hole: HoleConfig = DEFAULT_HOLE): SurfaceType {
  if (pointInEllipse(x, z, hole.teePosition.x, hole.teePosition.z + 4, 24, 18)) {
    return "tee";
  }

  if (pointInEllipse(x, z, hole.cupPosition.x, hole.cupPosition.z, hole.greenRadius, hole.greenRadius * 0.82)) {
    return "green";
  }

  if (hole.bunkers.some((bunker) => pointInEllipse(x, z, bunker.x, bunker.z, bunker.rx, bunker.rz))) {
    return "sand";
  }

  if (hole.roughZones.some((rough) => pointInEllipse(x, z, rough.x, rough.z, rough.rx, rough.rz))) {
    return "rough";
  }

  if (hole.cartPath) {
    const cartX = fairwayCenterAt(z, hole) + hole.cartPath.xOffset + Math.sin(z * hole.cartPath.wave + hole.cartPath.phase) * 8;
    if (z > hole.cartPath.zStart && z < hole.cartPath.zEnd && Math.abs(x - cartX) < hole.cartPath.width) {
      return "cart";
    }
  }

  const center = fairwayCenterAt(z, hole);
  const width = fairwayWidthAt(z, hole);
  if (z > hole.teePosition.z + 18 && z < hole.cupPosition.z - 12 && Math.abs(x - center) < width) {
    return "fairway";
  }

  if (horizontalDistance(x, z, hole.cupPosition.x, hole.cupPosition.z) < hole.greenRadius * 1.35) {
    return "fairway";
  }

  return "rough";
}

export function lieName(surface: SurfaceType) {
  switch (surface) {
    case "tee":
      return "Tee Box";
    case "fairway":
      return "Fairway";
    case "green":
      return "Green";
    case "sand":
      return "Beach";
    case "cart":
      return "Cart Path";
    case "rough":
    default:
      return "Rough";
  }
}

export function frictionForSurface(surface: SurfaceType, arcadePhysics: boolean) {
  const arcadeBoost = arcadePhysics ? 0.88 : 1;

  switch (surface) {
    case "tee":
      return 6.0 * arcadeBoost;
    case "fairway":
      return 8.0 * arcadeBoost;
    case "green":
      return 4.7 * arcadeBoost;
    case "sand":
      return 19.5;
    case "cart":
      return 2.7;
    case "rough":
    default:
      return 14.5;
  }
}

export function bounceForSurface(surface: SurfaceType) {
  switch (surface) {
    case "green":
      return 0.33;
    case "fairway":
    case "tee":
      return 0.36;
    case "cart":
      return 0.63;
    case "sand":
      return 0.08;
    case "rough":
    default:
      return 0.21;
  }
}

export function rollLossForSurface(surface: SurfaceType) {
  switch (surface) {
    case "green":
      return 0.79;
    case "fairway":
    case "tee":
      return 0.72;
    case "cart":
      return 1.05;
    case "sand":
      return 0.35;
    case "rough":
    default:
      return 0.54;
  }
}

export function distanceToCup(x: number, z: number, hole: HoleConfig = DEFAULT_HOLE) {
  return horizontalDistance(x, z, hole.cupPosition.x, hole.cupPosition.z);
}

export function boostZoneAt(x: number, z: number, hole: HoleConfig = DEFAULT_HOLE) {
  return hole.boostZones?.find((boost) => pointInEllipse(x, z, boost.x, boost.z, boost.rx, boost.rz));
}
