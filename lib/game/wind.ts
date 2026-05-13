import { clamp, normalizeAngle } from "./math";
import type { HoleConfig } from "./holes";
import type { ShotType, WindLabel, WindState } from "./types";

export type WindConfig = {
  speed: number;
  directionDeg: number;
};

export const CALM_WIND: WindState = {
  speed: 0,
  directionDeg: 0,
  label: "Calm"
};

export function windLabel(speed: number): WindLabel {
  if (speed < 2.5) return "Calm";
  if (speed < 7.5) return "Breeze";
  if (speed < 12.5) return "Push";
  return "Gusty";
}

export function windForShot(hole: HoleConfig, shotNumber: number): WindState {
  const base = hole.wind ?? CALM_WIND;
  const seed = Math.sin(hole.holeNumber * 12.9898 + shotNumber * 78.233);
  const second = Math.sin(hole.holeNumber * 4.193 + shotNumber * 19.917);
  const speed = clamp(base.speed + seed * 1.2, 0, 18);
  const directionDeg = (base.directionDeg + second * 7 + 360) % 360;

  return {
    speed: Number(speed.toFixed(1)),
    directionDeg: Number(directionDeg.toFixed(1)),
    label: windLabel(speed)
  };
}

export function windVector(wind: WindState) {
  const direction = (wind.directionDeg * Math.PI) / 180;
  return {
    x: Math.sin(direction),
    z: Math.cos(direction)
  };
}

export function windComponents(wind: WindState, aimAngle: number) {
  const vector = windVector(wind);
  const aimX = Math.sin(aimAngle);
  const aimZ = Math.cos(aimAngle);
  const sideX = aimZ;
  const sideZ = -aimX;
  const along = vector.x * aimX + vector.z * aimZ;
  const cross = vector.x * sideX + vector.z * sideZ;

  return {
    along,
    cross
  };
}

export function windInfluenceForShot(shotType: ShotType, launchDeg: number) {
  const heightFactor = clamp((launchDeg - 8) / 42, 0.15, 1.35);

  switch (shotType) {
    case "flop":
      return heightFactor * 1.62;
    case "chip":
      return heightFactor * 0.72;
    case "punch":
      return heightFactor * 0.38;
    case "putt":
      return 0;
    case "normal":
    default:
      return heightFactor;
  }
}

export function windAimHint(wind: WindState, aimAngle: number) {
  if (wind.speed < 2.5) {
    return "Neutral";
  }

  const { along, cross } = windComponents(wind, aimAngle);
  const alongLabel = along > 0.32 ? "Helping" : along < -0.32 ? "Into" : "Across";
  const crossLabel = cross > 0.22 ? "right" : cross < -0.22 ? "left" : "";

  return crossLabel ? `${alongLabel} ${crossLabel}` : alongLabel;
}

export function normalizeWindDirection(directionDeg: number) {
  return normalizeAngle((directionDeg * Math.PI) / 180);
}
