import { effectiveShotType } from "./clubs";
import { DEFAULT_HOLE, distanceToCup } from "./course";
import type { HoleConfig } from "./holes";
import type { Club, ShotSetup, ShotType, SurfaceType, SwingStrike, WindState } from "./types";

const SOLID_LINES = ["SMOKED IT", "PIN HUNTING", "SENT IT", "TRACKBALL ROCKET", "COIN SLOT CANNON"];
const CURVE_LINES = ["BABY DRAW", "SCROLL FADE", "SIDEWAYS SAUCE", "BANANA BALL"];
const WEAK_LINES = ["DINK", "BREAK ROOM BUNT", "HALF-SCROLLED", "TAP TAP TRAGEDY"];
const PATH_LINES = ["CART PATH HERO", "CONCRETE BONUS"];
const GREEN_LINES = ["DANCE FLOOR", "PUTTING FOR GLORY"];
const FLOP_LINES = ["SKY POP", "FLOP CITY", "ELEVATOR MUSIC"];
const PUNCH_LINES = ["STINGER", "LOW LASER", "PUNCH TICKET"];
const CHIP_LINES = ["CHIP CHECK", "SAUCY LITTLE CHIP", "BUMP AND RUN"];
const BACKSPIN_LINES = ["BACKSPIN BITE", "ZIP SAUCE", "CHECK MARK"];
const TOPSPIN_LINES = ["TOPSPIN RUNNER", "FAIRWAY SKIP", "GREEN LIGHT"];

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

  if (Math.abs(strike.spin) > 0.38) {
    return pick(CURVE_LINES);
  }

  if (surface === "green") {
    return pick(GREEN_LINES);
  }

  if (strike.power > 0.82 && strike.smoothness > 0.72) {
    return pick(SOLID_LINES);
  }

  if (strike.mishit > 0.48) {
    return "SPICY CONTACT";
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
