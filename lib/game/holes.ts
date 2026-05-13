import type { WindConfig } from "./wind";

export type CoursePoint = {
  x: number;
  z: number;
};

export type HazardZone = {
  x: number;
  z: number;
  rx: number;
  rz: number;
};

export type CartPathConfig = {
  xOffset: number;
  width: number;
  zStart: number;
  zEnd: number;
  wave: number;
  phase: number;
};

export type HoleConfig = {
  holeNumber: number;
  name: string;
  par: 3 | 4 | 5;
  teePosition: CoursePoint;
  cupPosition: CoursePoint;
  fairway: {
    length: number;
    width: number;
    curveSeed: number;
    curveStrength: number;
    widthVariation: number;
  };
  greenRadius: number;
  roughZones: HazardZone[];
  bunkers: HazardZone[];
  boostZones?: HazardZone[];
  cartPath?: CartPathConfig;
  wind: WindConfig;
  accent: string;
};

function zone(x: number, z: number, rx: number, rz: number): HazardZone {
  return { x, z, rx, rz };
}

export const HOLES: HoleConfig[] = [
  {
    holeNumber: 1,
    name: "Starter Bend",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 8, z: 438 },
    fairway: { length: 438, width: 38, curveSeed: 0.4, curveStrength: 20, widthVariation: 7 },
    greenRadius: 35,
    roughZones: [zone(-31, 255, 18, 38), zone(38, 324, 17, 34)],
    bunkers: [zone(39, 404, 17, 22), zone(-35, 381, 16, 20)],
    cartPath: { xOffset: 47, width: 4.1, zStart: 58, zEnd: 404, wave: 0.033, phase: 0.2 },
    wind: { speed: 5, directionDeg: 25 },
    accent: "#ff795d"
  },
  {
    holeNumber: 2,
    name: "Postage Stamp",
    par: 3,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -16, z: 156 },
    fairway: { length: 156, width: 30, curveSeed: 1.3, curveStrength: 8, widthVariation: 4 },
    greenRadius: 30,
    roughZones: [zone(18, 92, 18, 30)],
    bunkers: [zone(-37, 140, 13, 18), zone(11, 171, 17, 14)],
    wind: { speed: 4, directionDeg: 305 },
    accent: "#ffd166"
  },
  {
    holeNumber: 3,
    name: "Long Lunch",
    par: 5,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 42, z: 586 },
    fairway: { length: 586, width: 52, curveSeed: 2.1, curveStrength: 38, widthVariation: 10 },
    greenRadius: 40,
    roughZones: [zone(-39, 262, 18, 58), zone(32, 360, 20, 54), zone(72, 457, 18, 44)],
    bunkers: [zone(2, 315, 18, 23), zone(76, 548, 17, 25), zone(11, 564, 15, 20)],
    boostZones: [zone(-22, 286, 13, 38), zone(48, 414, 14, 42)],
    cartPath: { xOffset: -55, width: 4.2, zStart: 78, zEnd: 542, wave: 0.024, phase: 1.1 },
    wind: { speed: 9, directionDeg: 30 },
    accent: "#69d2ff"
  },
  {
    holeNumber: 4,
    name: "Printer Jam",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -35, z: 408 },
    fairway: { length: 408, width: 34, curveSeed: 2.9, curveStrength: 30, widthVariation: 8 },
    greenRadius: 33,
    roughZones: [zone(22, 218, 20, 45), zone(-58, 322, 17, 38)],
    bunkers: [zone(-58, 377, 16, 21), zone(-4, 391, 14, 18)],
    wind: { speed: 8, directionDeg: 210 },
    accent: "#6ff3a8"
  },
  {
    holeNumber: 5,
    name: "Break Room",
    par: 3,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 20, z: 198 },
    fairway: { length: 198, width: 30, curveSeed: 3.7, curveStrength: 11, widthVariation: 5 },
    greenRadius: 31,
    roughZones: [zone(-23, 124, 14, 34)],
    bunkers: [zone(45, 181, 14, 20), zone(-5, 210, 16, 13)],
    wind: { speed: 11, directionDeg: 75 },
    accent: "#ff9f6e"
  },
  {
    holeNumber: 6,
    name: "Dogleg Desk",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 50, z: 462 },
    fairway: { length: 462, width: 40, curveSeed: 4.4, curveStrength: 36, widthVariation: 8 },
    greenRadius: 35,
    roughZones: [zone(-38, 252, 18, 49), zone(69, 334, 17, 39)],
    bunkers: [zone(29, 423, 17, 20), zone(76, 444, 13, 20)],
    boostZones: [zone(48, 292, 13, 34)],
    cartPath: { xOffset: -48, width: 4, zStart: 90, zEnd: 430, wave: 0.029, phase: 2.8 },
    wind: { speed: 6, directionDeg: 330 },
    accent: "#f5d547"
  },
  {
    holeNumber: 7,
    name: "Payroll Par Five",
    par: 5,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -54, z: 620 },
    fairway: { length: 620, width: 54, curveSeed: 5.2, curveStrength: 42, widthVariation: 11 },
    greenRadius: 41,
    roughZones: [zone(41, 275, 22, 54), zone(-74, 438, 20, 48), zone(-6, 492, 18, 42)],
    bunkers: [zone(3, 352, 18, 25), zone(-82, 581, 17, 25), zone(-26, 598, 14, 19)],
    boostZones: [zone(34, 305, 14, 40), zone(-55, 454, 15, 44)],
    wind: { speed: 10, directionDeg: 140 },
    accent: "#baef75"
  },
  {
    holeNumber: 8,
    name: "Copy Room",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 20, z: 292 },
    fairway: { length: 292, width: 38, curveSeed: 6.0, curveStrength: 16, widthVariation: 8 },
    greenRadius: 34,
    roughZones: [zone(-30, 166, 17, 35), zone(42, 232, 14, 30)],
    bunkers: [zone(44, 268, 16, 18), zone(-10, 282, 13, 17)],
    boostZones: [zone(8, 198, 13, 30)],
    cartPath: { xOffset: 47, width: 4.2, zStart: 62, zEnd: 265, wave: 0.035, phase: 2.1 },
    wind: { speed: 4, directionDeg: 35 },
    accent: "#8dd8ff"
  },
  {
    holeNumber: 9,
    name: "Front Nine Finisher",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -18, z: 448 },
    fairway: { length: 448, width: 37, curveSeed: 6.7, curveStrength: 26, widthVariation: 7 },
    greenRadius: 36,
    roughZones: [zone(41, 246, 20, 46), zone(-49, 336, 17, 38)],
    bunkers: [zone(-49, 415, 17, 20), zone(15, 432, 15, 20)],
    wind: { speed: 7, directionDeg: 285 },
    accent: "#ff795d"
  },
  {
    holeNumber: 10,
    name: "Back Nine Bite",
    par: 3,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 26, z: 226 },
    fairway: { length: 226, width: 31, curveSeed: 7.5, curveStrength: 12, widthVariation: 5 },
    greenRadius: 32,
    roughZones: [zone(-30, 136, 16, 31)],
    bunkers: [zone(2, 203, 15, 17), zone(51, 220, 14, 18)],
    wind: { speed: 13, directionDeg: 250 },
    accent: "#ffd166"
  },
  {
    holeNumber: 11,
    name: "Spreadsheet Sweep",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -48, z: 488 },
    fairway: { length: 488, width: 42, curveSeed: 8.3, curveStrength: 31, widthVariation: 8 },
    greenRadius: 36,
    roughZones: [zone(46, 274, 20, 48), zone(-72, 382, 18, 42)],
    bunkers: [zone(-70, 456, 17, 23), zone(-16, 471, 16, 18)],
    cartPath: { xOffset: 54, width: 4, zStart: 88, zEnd: 454, wave: 0.027, phase: 0.6 },
    wind: { speed: 9, directionDeg: 185 },
    accent: "#6ff3a8"
  },
  {
    holeNumber: 12,
    name: "Status Meeting",
    par: 5,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 34, z: 602 },
    fairway: { length: 602, width: 55, curveSeed: 9.0, curveStrength: 37, widthVariation: 11 },
    greenRadius: 41,
    roughZones: [zone(-49, 292, 20, 56), zone(64, 438, 20, 48), zone(5, 480, 17, 40)],
    bunkers: [zone(23, 368, 18, 24), zone(65, 567, 16, 25), zone(-6, 580, 17, 19)],
    boostZones: [zone(-36, 318, 14, 41), zone(42, 456, 15, 45)],
    wind: { speed: 12, directionDeg: 20 },
    accent: "#ff9f6e"
  },
  {
    holeNumber: 13,
    name: "Lucky Bounce",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 38, z: 326 },
    fairway: { length: 326, width: 37, curveSeed: 9.8, curveStrength: 25, widthVariation: 7 },
    greenRadius: 34,
    roughZones: [zone(-28, 190, 18, 39), zone(61, 258, 14, 30)],
    bunkers: [zone(18, 296, 16, 18), zone(65, 314, 15, 19)],
    boostZones: [zone(33, 224, 12, 31)],
    cartPath: { xOffset: -48, width: 4.2, zStart: 52, zEnd: 300, wave: 0.031, phase: 1.8 },
    wind: { speed: 6, directionDeg: 115 },
    accent: "#69d2ff"
  },
  {
    holeNumber: 14,
    name: "Tiny Target",
    par: 3,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -18, z: 142 },
    fairway: { length: 142, width: 28, curveSeed: 10.6, curveStrength: 9, widthVariation: 4 },
    greenRadius: 30,
    roughZones: [zone(20, 86, 16, 29)],
    bunkers: [zone(-42, 128, 13, 18), zone(5, 151, 15, 14)],
    wind: { speed: 3, directionDeg: 65 },
    accent: "#baef75"
  },
  {
    holeNumber: 15,
    name: "Calendar Clash",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 18, z: 476 },
    fairway: { length: 476, width: 40, curveSeed: 11.4, curveStrength: 31, widthVariation: 8 },
    greenRadius: 35,
    roughZones: [zone(-42, 256, 18, 48), zone(55, 366, 18, 40)],
    bunkers: [zone(43, 442, 17, 21), zone(-13, 458, 14, 19)],
    boostZones: [zone(-12, 304, 14, 36)],
    wind: { speed: 10, directionDeg: 300 },
    accent: "#f5d547"
  },
  {
    holeNumber: 16,
    name: "Expense Report",
    par: 5,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -30, z: 645 },
    fairway: { length: 645, width: 56, curveSeed: 12.1, curveStrength: 43, widthVariation: 11 },
    greenRadius: 41,
    roughZones: [zone(54, 302, 20, 56), zone(-68, 438, 20, 48), zone(18, 518, 18, 43)],
    bunkers: [zone(8, 370, 18, 24), zone(-61, 607, 17, 24), zone(16, 625, 14, 19)],
    boostZones: [zone(50, 334, 14, 42), zone(-42, 486, 15, 45)],
    cartPath: { xOffset: 56, width: 4.1, zStart: 98, zEnd: 594, wave: 0.025, phase: 2.5 },
    wind: { speed: 8, directionDeg: 170 },
    accent: "#8dd8ff"
  },
  {
    holeNumber: 17,
    name: "Penultimate Putt",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: 32, z: 338 },
    fairway: { length: 338, width: 36, curveSeed: 12.9, curveStrength: 22, widthVariation: 7 },
    greenRadius: 34,
    roughZones: [zone(-32, 202, 18, 38), zone(56, 266, 16, 32)],
    bunkers: [zone(7, 310, 15, 18), zone(57, 324, 15, 20)],
    boostZones: [zone(24, 236, 12, 32)],
    wind: { speed: 9, directionDeg: 35 },
    accent: "#ff795d"
  },
  {
    holeNumber: 18,
    name: "Clock Out",
    par: 4,
    teePosition: { x: 0, z: 0 },
    cupPosition: { x: -10, z: 466 },
    fairway: { length: 466, width: 42, curveSeed: 13.7, curveStrength: 28, widthVariation: 8 },
    greenRadius: 38,
    roughZones: [zone(38, 270, 19, 46), zone(-54, 348, 18, 40)],
    bunkers: [zone(-39, 433, 17, 23), zone(23, 448, 16, 20)],
    boostZones: [zone(-20, 316, 14, 36)],
    cartPath: { xOffset: -54, width: 4.2, zStart: 82, zEnd: 432, wave: 0.03, phase: 1.3 },
    wind: { speed: 7, directionDeg: 225 },
    accent: "#6ff3a8"
  }
];

export const FIRST_HOLE = HOLES[0];
