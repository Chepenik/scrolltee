import { effectiveShotType } from "./clubs";
import { DEFAULT_HOLE, distanceToCup } from "./course";
import type { HoleConfig } from "./holes";
import type { Club, ShotSetup, ShotType, SurfaceType, SwingStrike, WindState } from "./types";

const SOLID_LINES = ["CLEAN STRIKE", "FULL POWER", "PIN HUNTING", "CENTER FACE", "GOOD LAUNCH"];
const WEAK_LINES = ["LOW POWER", "SHORT SWING", "SOFT CONTACT", "HALF SWING"];
const PATH_LINES = ["CART PATH HERO", "CONCRETE BONUS"];
const GREEN_LINES = ["DANCE FLOOR", "PUTTING FOR GLORY"];
const FLOP_LINES = ["HIGH FLOP", "SOFT LANDING", "SKY POP"];
const PUNCH_LINES = ["LOW PUNCH", "WIND CUTTER", "RUNNING PUNCH"];
const CHIP_LINES = ["CHIP CHECK", "BUMP AND RUN", "CONTROLLED CHIP"];
const BACKSPIN_LINES = ["BACKSPIN BITE", "CHECK SPIN", "SHORT ROLLOUT"];
const TOPSPIN_LINES = ["TOPSPIN RUNNER", "EXTRA ROLLOUT", "GREEN LIGHT"];

function pick(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function shotFeedback(
  strike: SwingStrike,
  club: Club,
  surface: SurfaceType,
  requestedShotType: ShotType,
  setup?: ShotSetup,
  wind?: WindState
) {
  const shotType = effectiveShotType(club.id, requestedShotType);

  if (surface === "cart") {
    return pick(PATH_LINES);
  }

  if (club.id === "putter") {
    return strike.power > 0.78 ? "HAMMER PUTT" : "ROLL THE ROCK";
  }

  if (strike.power < 0.18 || strike.forwardVelocity < 0.18) {
    return pick(WEAK_LINES);
  }

  if (wind && wind.speed >= 11 && shotType === "punch" && strike.power > 0.58) {
    return "WIND CUTTER";
  }

  if (shotType === "flop") {
    return pick(FLOP_LINES);
  }

  if (shotType === "punch") {
    return pick(PUNCH_LINES);
  }

  if (shotType === "chip") {
    return pick(CHIP_LINES);
  }

  if (setup && setup.spin < -0.62 && club.category === "wedge") {
    return pick(BACKSPIN_LINES);
  }

  if (setup && setup.spin > 0.62 && club.category !== "wedge") {
    return pick(TOPSPIN_LINES);
  }

  if (strike.spin < -0.38) {
    return "LEFT CURVE";
  }

  if (strike.spin > 0.38) {
    return "RIGHT CURVE";
  }

  if (surface === "green") {
    return pick(GREEN_LINES);
  }

  if (strike.power > 0.82 && strike.smoothness > 0.72) {
    return pick(SOLID_LINES);
  }

  if (strike.mishit > 0.48) {
    return "MISHIT - CHECK FACE";
  }

  return "GOOD THUMP";
}

export function completionText(strokes: number, par: number) {
  const diff = strokes - par;
  if (diff <= -3) return "Ridiculous";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  return `+${diff}`;
}

export function distanceFromPin(x: number, z: number, hole: HoleConfig = DEFAULT_HOLE) {
  return distanceToCup(x, z, hole);
}

export function isPastPin(z: number, hole: HoleConfig = DEFAULT_HOLE) {
  return z > hole.cupPosition.z + 10;
}
