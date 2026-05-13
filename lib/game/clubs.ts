import { clamp } from "./math";
import { windComponents, windInfluenceForShot } from "./wind";
import type { Club, ClubId, ShotEstimate, ShotSetup, ShotType, SurfaceType, WindState } from "./types";

export const CLUBS: Club[] = [
  {
    id: "driver",
    name: "Driver",
    shortName: "DR",
    key: "1",
    maxDistance: 292,
    maxSpeed: 140,
    launchAngleDeg: 13,
    spinControl: 1,
    mishitFloor: 0.33,
    idealPower: 0.92,
    bagIndex: 0,
    category: "wood"
  },
  {
    id: "threeWood",
    name: "3 Wood",
    shortName: "3W",
    key: "2",
    maxDistance: 252,
    maxSpeed: 124,
    launchAngleDeg: 15.5,
    spinControl: 0.95,
    mishitFloor: 0.35,
    idealPower: 0.9,
    bagIndex: 1,
    category: "wood"
  },
  {
    id: "fiveWood",
    name: "5 Wood",
    shortName: "5W",
    key: "3",
    maxDistance: 226,
    maxSpeed: 114,
    launchAngleDeg: 18,
    spinControl: 0.92,
    mishitFloor: 0.36,
    idealPower: 0.88,
    bagIndex: 2,
    category: "wood"
  },
  {
    id: "threeIron",
    name: "3 Iron",
    shortName: "3I",
    key: "4",
    maxDistance: 205,
    maxSpeed: 106,
    launchAngleDeg: 19,
    spinControl: 0.86,
    mishitFloor: 0.37,
    idealPower: 0.87,
    bagIndex: 3,
    category: "iron"
  },
  {
    id: "fourIron",
    name: "4 Iron",
    shortName: "4I",
    key: "5",
    maxDistance: 190,
    maxSpeed: 101,
    launchAngleDeg: 21,
    spinControl: 0.84,
    mishitFloor: 0.38,
    idealPower: 0.86,
    bagIndex: 4,
    category: "iron"
  },
  {
    id: "fiveIron",
    name: "5 Iron",
    shortName: "5I",
    key: "6",
    maxDistance: 178,
    maxSpeed: 99,
    launchAngleDeg: 23,
    spinControl: 0.82,
    mishitFloor: 0.39,
    idealPower: 0.85,
    bagIndex: 5,
    category: "iron"
  },
  {
    id: "sixIron",
    name: "6 Iron",
    shortName: "6I",
    key: "7",
    maxDistance: 166,
    maxSpeed: 93,
    launchAngleDeg: 25.5,
    spinControl: 0.8,
    mishitFloor: 0.4,
    idealPower: 0.84,
    bagIndex: 6,
    category: "iron"
  },
  {
    id: "sevenIron",
    name: "7 Iron",
    shortName: "7I",
    key: "8",
    maxDistance: 154,
    maxSpeed: 87,
    launchAngleDeg: 28,
    spinControl: 0.77,
    mishitFloor: 0.41,
    idealPower: 0.82,
    bagIndex: 7,
    category: "iron"
  },
  {
    id: "eightIron",
    name: "8 Iron",
    shortName: "8I",
    key: "9",
    maxDistance: 142,
    maxSpeed: 80,
    launchAngleDeg: 31,
    spinControl: 0.74,
    mishitFloor: 0.42,
    idealPower: 0.8,
    bagIndex: 8,
    category: "iron"
  },
  {
    id: "nineIron",
    name: "9 Iron",
    shortName: "9I",
    key: "0",
    maxDistance: 130,
    maxSpeed: 74,
    launchAngleDeg: 35,
    spinControl: 0.7,
    mishitFloor: 0.43,
    idealPower: 0.78,
    bagIndex: 9,
    category: "iron"
  },
  {
    id: "pitchingWedge",
    name: "Pitching Wedge",
    shortName: "PW",
    key: "-",
    maxDistance: 112,
    maxSpeed: 68,
    launchAngleDeg: 40,
    spinControl: 0.64,
    mishitFloor: 0.44,
    idealPower: 0.76,
    bagIndex: 10,
    category: "wedge"
  },
  {
    id: "sandWedge",
    name: "Sand Wedge",
    shortName: "SW",
    key: "=",
    maxDistance: 88,
    maxSpeed: 58,
    launchAngleDeg: 46,
    spinControl: 0.58,
    mishitFloor: 0.46,
    idealPower: 0.74,
    bagIndex: 11,
    category: "wedge"
  },
  {
    id: "lobWedge",
    name: "Lob Wedge",
    shortName: "LW",
    key: "\\",
    maxDistance: 68,
    maxSpeed: 48,
    launchAngleDeg: 54,
    spinControl: 0.54,
    mishitFloor: 0.48,
    idealPower: 0.72,
    bagIndex: 12,
    category: "wedge"
  },
  {
    id: "putter",
    name: "Putter",
    shortName: "PT",
    key: "/",
    maxDistance: 42,
    maxSpeed: 40,
    launchAngleDeg: 1.5,
    spinControl: 0.18,
    mishitFloor: 0.24,
    idealPower: 0.58,
    bagIndex: 13,
    category: "putter"
  }
];

export const CLUB_BY_ID = Object.fromEntries(CLUBS.map((club) => [club.id, club])) as Record<ClubId, Club>;

const CLUB_KEY_MAP: Record<string, ClubId> = Object.fromEntries(CLUBS.map((club) => [club.key.toLowerCase(), club.id])) as Record<
  string,
  ClubId
>;

export function nextClubId(current: ClubId, direction: 1 | -1) {
  const index = CLUBS.findIndex((club) => club.id === current);
  return CLUBS[(Math.max(0, index) + direction + CLUBS.length) % CLUBS.length].id;
}

export function clubIdForKey(key: string): ClubId | undefined {
  return CLUB_KEY_MAP[key.toLowerCase()];
}

export function effectiveShotType(clubId: ClubId, requested: ShotType): ShotType {
  return clubId === "putter" ? "putt" : requested === "putt" ? "normal" : requested;
}

export function shotTypeLabel(type: ShotType) {
  switch (type) {
    case "punch":
      return "Punch";
    case "flop":
      return "Flop";
    case "chip":
      return "Chip";
    case "putt":
      return "Putt";
    case "normal":
    default:
      return "Normal";
  }
}

export function spinLabel(spin: number) {
  if (spin < -0.72) return "Full Backspin";
  if (spin < -0.22) return "Backspin";
  if (spin > 0.72) return "Full Topspin";
  if (spin > 0.22) return "Topspin";
  return "Neutral";
}

export function shotTypeTuning(type: ShotType) {
  switch (type) {
    case "punch":
      return {
        speed: 0.94,
        launch: 0.55,
        spin: 0.62,
        carry: 0.78,
        roll: 1.52,
        landing: 1.08,
        friction: 0.72,
        bounce: 0.78
      };
    case "flop":
      return {
        speed: 0.68,
        launch: 1.62,
        spin: 1.5,
        carry: 0.58,
        roll: 0.28,
        landing: 0.48,
        friction: 1.85,
        bounce: 0.58
      };
    case "chip":
      return {
        speed: 0.56,
        launch: 0.82,
        spin: 0.86,
        carry: 0.36,
        roll: 1.08,
        landing: 0.82,
        friction: 1.08,
        bounce: 0.62
      };
    case "putt":
      return {
        speed: 1,
        launch: 0.38,
        spin: 0.2,
        carry: 0,
        roll: 1,
        landing: 1,
        friction: 0.96,
        bounce: 0.1
      };
    case "normal":
    default:
      return {
        speed: 1,
        launch: 1,
        spin: 1,
        carry: 1,
        roll: 1,
        landing: 1,
        friction: 1,
        bounce: 1
      };
  }
}

function lieFactor(surface: SurfaceType, club: Club, shotType: ShotType) {
  if (surface === "sand") {
    return club.category === "wedge" ? 0.88 : 0.66;
  }

  if (surface === "rough") {
    if (shotType === "punch") {
      return club.category === "wood" ? 0.82 : club.category === "wedge" ? 0.92 : 0.88;
    }
    return club.category === "wood" ? 0.76 : club.category === "wedge" ? 0.9 : 0.84;
  }

  return 1;
}

export function estimateShot(club: Club, setup: ShotSetup, surface: SurfaceType, wind?: WindState, aimAngle = 0): ShotEstimate {
  const type = effectiveShotType(club.id, setup.shotType);
  const tuning = shotTypeTuning(type);
  const spin = type === "putt" ? 0 : clamp(setup.spin, -1, 1);
  const backspin = Math.max(0, -spin);
  const topspin = Math.max(0, spin);
  const forwardCarry = 1 + setup.ballForward * 0.1;
  const forwardRoll = 1 - setup.ballForward * 0.22;
  const lie = lieFactor(surface, club, type);
  const flopClubPenalty = type === "flop" && club.category !== "wedge" ? 0.78 : 1;
  const spinCarry = clamp(1 - backspin * 0.075 - topspin * 0.045, 0.86, 1.04);
  const spinRoll = clamp(1 - backspin * 0.68 + topspin * 0.42, 0.18, 1.54);
  const spinLaunch = clamp(1 + backspin * 0.12 - topspin * 0.08, 0.86, 1.16);
  const total = club.maxDistance * tuning.speed * lie * flopClubPenalty * (type === "putt" ? 1 : 0.96);
  const launchDeg = Math.max(0.5, club.launchAngleDeg * tuning.launch * spinLaunch * (1 + setup.ballForward * 0.18));
  const windInfluence = wind ? windInfluenceForShot(type, launchDeg) : 0;
  const windAlong = wind && type !== "putt" ? windComponents(wind, aimAngle).along : 0;
  const windCross = wind && type !== "putt" ? windComponents(wind, aimAngle).cross : 0;
  const windCarry = wind ? clamp(1 + windAlong * wind.speed * 0.0085 * windInfluence, 0.78, 1.2) : 1;
  const windRoll = wind ? clamp(1 + Math.max(0, windAlong) * wind.speed * 0.0035, 0.92, 1.08) : 1;
  const carry =
    type === "putt"
      ? 0
      : total * tuning.carry * forwardCarry * spinCarry * windCarry * (club.category === "wedge" ? 0.92 : 0.84);
  const roll = type === "putt" ? total : Math.max(4, total - carry) * tuning.roll * forwardRoll * spinRoll * windRoll;

  return {
    carry: clamp(carry, 0, club.maxDistance * 1.15),
    roll: clamp(roll, 0, club.maxDistance),
    total: clamp(carry + roll, 2, club.maxDistance * 1.35),
    launchDeg,
    curve: clamp(setup.stanceOffset + windCross * (wind?.speed ?? 0) * 0.012 * windInfluence, -1.4, 1.4)
  };
}

export function autoSelectClub(distanceToPin: number, surface: SurfaceType = "fairway"): ClubId {
  if (distanceToPin < 45 && surface === "green") {
    return "putter";
  }

  if (surface === "sand") {
    if (distanceToPin < 55) return "sandWedge";
    if (distanceToPin < 80) return "lobWedge";
  }

  if (distanceToPin < 38) return "lobWedge";
  if (distanceToPin < 72) return "sandWedge";
  if (distanceToPin < 105) return "pitchingWedge";

  const target = distanceToPin * 1.06;
  const playable = CLUBS.filter((club) => club.id !== "putter");
  return playable.reduce((best, club) => (Math.abs(club.maxDistance - target) < Math.abs(best.maxDistance - target) ? club : best)).id;
}
