export type SurfaceType = "tee" | "fairway" | "rough" | "green" | "sand" | "cart";

export type ClubId =
  | "driver"
  | "threeWood"
  | "fiveWood"
  | "threeIron"
  | "fourIron"
  | "fiveIron"
  | "sixIron"
  | "sevenIron"
  | "eightIron"
  | "nineIron"
  | "pitchingWedge"
  | "sandWedge"
  | "lobWedge"
  | "putter";

export type ShotType = "normal" | "punch" | "flop" | "chip" | "putt";

export type SwingPhase =
  | "IDLE"
  | "BACKSWING"
  | "DOWNSWING"
  | "STRIKE"
  | "BALL_FLIGHT"
  | "BALL_STOPPED"
  | "HOLED";

export type DeviceGuess = "wheel" | "touchpad" | "keyboard";

export type CameraMode = "auto" | "follow" | "pin";

export type SwingDirection = "neutral" | "backswing" | "downswing";

export type Vec3Tuple = [number, number, number];

export type GameSettings = {
  sensitivity: number;
  invertSwing: boolean;
  arcadePhysics: boolean;
  debugInput: boolean;
};

export type SwingDebugSnapshot = {
  phase: SwingPhase;
  device: DeviceGuess;
  rawDeltaY: number;
  deltaY: number;
  deltaX: number;
  swingDirection: SwingDirection;
  lastKey: string;
  backswing: number;
  downswingVelocity: number;
  power: number;
  spin: number;
  smoothness: number;
};

export type SwingStrike = {
  power: number;
  backswing: number;
  forwardVelocity: number;
  spin: number;
  smoothness: number;
  mishit: number;
  device: DeviceGuess;
};

export type Club = {
  id: ClubId;
  name: string;
  shortName: string;
  key: string;
  maxDistance: number;
  maxSpeed: number;
  launchAngleDeg: number;
  spinControl: number;
  mishitFloor: number;
  idealPower: number;
  bagIndex: number;
  category: "wood" | "iron" | "wedge" | "putter";
};

export type ShotSetup = {
  shotType: ShotType;
  stanceOffset: number;
  ballForward: number;
  spin: number;
};

export type ShotEstimate = {
  carry: number;
  roll: number;
  total: number;
  launchDeg: number;
  curve: number;
};

export type WindLabel = "Calm" | "Breeze" | "Push" | "Gusty";

export type WindState = {
  speed: number;
  directionDeg: number;
  label: WindLabel;
};

export type HudSnapshot = {
  phase: SwingPhase;
  holeNumber: number;
  holeCount: number;
  holeName: string;
  strokes: number;
  distanceToPin: number;
  shotResult: string;
  surface: SurfaceType;
  ballSpeed: number;
  clubId: ClubId;
  shotType: ShotType;
  stanceOffset: number;
  ballForward: number;
  spin: number;
  wind: WindState;
  carryEstimate: number;
  rollEstimate: number;
  totalEstimate: number;
  aimDegrees: number;
  holed: boolean;
  par: number;
  totalStrokes: number;
  totalPar: number;
  roundScore: number;
  completedHoles: number;
  roundComplete: boolean;
  cameraMode: CameraMode;
  swing: SwingDebugSnapshot;
};

export type BallPhysicsState = {
  position: Vec3Tuple;
  velocity: Vec3Tuple;
  spin: number;
  moving: boolean;
  airborne: boolean;
  surface: SurfaceType;
  lastSurface: SurfaceType;
  rollSpin: number;
  windInfluence: number;
  settleSeconds: number;
  rollFrictionMultiplier: number;
  landingSpeedMultiplier: number;
  bounceMultiplier: number;
};

export type BallUpdateResult = {
  bounced: boolean;
  stopped: boolean;
  speed: number;
  surface: SurfaceType;
};
