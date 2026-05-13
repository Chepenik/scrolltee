import { BALL_RADIUS, bounceForSurface, frictionForSurface, rollLossForSurface, surfaceAt, terrainHeightAt } from "./course";
import { effectiveShotType, shotTypeTuning } from "./clubs";
import { clamp } from "./math";
import { windInfluenceForShot, windVector } from "./wind";
import type { HoleConfig } from "./holes";
import type { BallPhysicsState, BallUpdateResult, Club, ShotSetup, SurfaceType, SwingStrike, WindState } from "./types";

const GRAVITY = 38;
const AIR_DRAG = 0.034;
const AIR_CURVE = 0.72;
const ROLL_CURVE = 0.24;
const SLOPE_FORCE = 14;
const DEAD_SPEED = 0.28;
const LOW_SPEED = 1.95;

export function createBallState(hole: HoleConfig, x = hole.teePosition.x, z = hole.teePosition.z): BallPhysicsState {
  const surface = surfaceAt(x, z, hole);
  return {
    position: [x, terrainHeightAt(x, z, hole) + BALL_RADIUS, z],
    velocity: [0, 0, 0],
    spin: 0,
    moving: false,
    airborne: false,
    surface,
    lastSurface: surface,
    rollSpin: 0,
    windInfluence: 0,
    settleSeconds: 0,
    rollFrictionMultiplier: 1,
    landingSpeedMultiplier: 1,
    bounceMultiplier: 1
  };
}

export function resetBallToLie(ball: BallPhysicsState, hole: HoleConfig, x: number, z: number) {
  const surface = surfaceAt(x, z, hole);
  ball.position = [x, terrainHeightAt(x, z, hole) + BALL_RADIUS, z];
  ball.velocity = [0, 0, 0];
  ball.spin = 0;
  ball.moving = false;
  ball.airborne = false;
  ball.surface = surface;
  ball.lastSurface = surface;
  ball.rollSpin = 0;
  ball.windInfluence = 0;
  ball.settleSeconds = 0;
  ball.rollFrictionMultiplier = 1;
  ball.landingSpeedMultiplier = 1;
  ball.bounceMultiplier = 1;
}

function lieLaunchMultiplier(surface: SurfaceType, club: Club) {
  if (surface === "sand") {
    return club.category === "wedge" ? 0.86 : 0.62;
  }

  if (surface === "rough") {
    return club.category === "wood" ? 0.74 : club.category === "wedge" ? 0.88 : 0.82;
  }

  return 1;
}

function spinSpeedMultiplier(spin: number) {
  const backspin = Math.max(0, -spin);
  const topspin = Math.max(0, spin);
  return clamp(1 - backspin * 0.045 - topspin * 0.02, 0.9, 1.02);
}

export function launchBall(
  ball: BallPhysicsState,
  strike: SwingStrike,
  club: Club,
  aimAngle: number,
  arcadePhysics: boolean,
  setup: ShotSetup,
  surface: SurfaceType
) {
  const shotType = effectiveShotType(club.id, setup.shotType);
  const tuning = shotTypeTuning(shotType);
  const power = clamp(strike.power, 0.025, 1);
  const shotSpin = shotType === "putt" ? 0 : clamp(setup.spin, -1, 1);
  const backspin = Math.max(0, -shotSpin);
  const topspin = Math.max(0, shotSpin);
  const weakDribbler = power < 0.12 || strike.forwardVelocity < 0.16;
  const powerCurve = weakDribbler ? power * 0.55 : Math.pow(power, club.id === "putter" ? 1.2 : 0.82);
  const mishitLoss = 1 - strike.mishit * (club.id === "putter" ? 0.2 : 0.28);
  const stanceSpeed = 1 - Math.max(0, setup.ballForward) * 0.05 + Math.max(0, -setup.ballForward) * 0.035;
  const speed =
    club.maxSpeed *
    (club.mishitFloor + powerCurve * (1 - club.mishitFloor)) *
    mishitLoss *
    tuning.speed *
    stanceSpeed *
    spinSpeedMultiplier(shotSpin) *
    lieLaunchMultiplier(surface, club) *
    (arcadePhysics ? 1.04 : 0.96);
  const stanceLaunch = 1 + setup.ballForward * 0.22;
  const spinLaunch = clamp(1 + backspin * 0.12 - topspin * 0.08, 0.86, 1.16);
  const launchDeg = weakDribbler ? 2.5 : club.launchAngleDeg * tuning.launch * stanceLaunch * spinLaunch * (0.9 + power * 0.18);
  const launch = (launchDeg * Math.PI) / 180;
  const wild = (Math.random() - 0.5) * strike.mishit * (club.id === "putter" ? 0.08 : 0.18);
  const setupCurve = setup.stanceOffset * (shotType === "punch" ? 0.12 : shotType === "flop" ? 0.08 : 0.1);
  const spinStart = clamp((strike.spin + setup.stanceOffset * 0.52) * club.spinControl * tuning.spin + wild * 1.8, -1.45, 1.45);
  const shotAngle = aimAngle + setupCurve + spinStart * 0.025 + wild;
  const horizontalSpeed = Math.cos(launch) * speed;

  ball.velocity = [
    Math.sin(shotAngle) * horizontalSpeed,
    club.id === "putter" ? Math.max(0.6, Math.sin(launch) * speed) : Math.sin(launch) * speed,
    Math.cos(shotAngle) * horizontalSpeed
  ];
  ball.spin = spinStart;
  ball.rollSpin = shotSpin;
  ball.windInfluence = windInfluenceForShot(shotType, launchDeg);
  ball.moving = true;
  ball.airborne = club.id !== "putter" && !weakDribbler;
  ball.settleSeconds = 0;
  ball.rollFrictionMultiplier = clamp(tuning.friction * (1 - setup.ballForward * 0.14) * (1 + backspin * 0.78 - topspin * 0.12), 0.56, 2.55);
  ball.landingSpeedMultiplier = clamp(tuning.landing * (1 - setup.ballForward * 0.16) * (1 - backspin * 0.32 + topspin * 0.1), 0.28, 1.18);
  ball.bounceMultiplier = clamp(tuning.bounce * (1 - setup.ballForward * 0.08) * (1 - backspin * 0.22 + topspin * 0.06), 0.06, 1.1);
}

function stopBallAtGround(ball: BallPhysicsState, hole: HoleConfig, x: number, z: number, surface = surfaceAt(x, z, hole)): BallUpdateResult {
  const safeX = Number.isFinite(x) ? x : hole.teePosition.x;
  const safeZ = Number.isFinite(z) ? z : hole.teePosition.z;
  const safeSurface = surfaceAt(safeX, safeZ, hole) ?? surface;
  ball.position = [safeX, terrainHeightAt(safeX, safeZ, hole) + BALL_RADIUS, safeZ];
  ball.velocity = [0, 0, 0];
  ball.spin = 0;
  ball.moving = false;
  ball.airborne = false;
  ball.surface = safeSurface;
  ball.lastSurface = safeSurface;
  ball.rollSpin = 0;
  ball.windInfluence = 0;
  ball.settleSeconds = 0;
  ball.rollFrictionMultiplier = 1;
  ball.landingSpeedMultiplier = 1;
  ball.bounceMultiplier = 1;

  return {
    bounced: false,
    stopped: true,
    speed: 0,
    surface: safeSurface
  };
}

export function updateBallPhysics(
  ball: BallPhysicsState,
  hole: HoleConfig,
  rawDt: number,
  arcadePhysics: boolean,
  wind?: WindState
): BallUpdateResult {
  const dt = Math.min(0.033, rawDt);
  let [x, y, z] = ball.position;
  let [vx, vy, vz] = ball.velocity;
  let bounced = false;
  let stopped = false;

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return stopBallAtGround(ball, hole, hole.teePosition.x, hole.teePosition.z);
  }

  if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) {
    return stopBallAtGround(ball, hole, x, z);
  }

  const groundY = terrainHeightAt(x, z, hole) + BALL_RADIUS;
  ball.surface = surfaceAt(x, z, hole);

  if (ball.airborne || y > groundY + 0.08 || vy > 2.2) {
    ball.airborne = true;
    const horizontalSpeed = Math.hypot(vx, vz);
    if (horizontalSpeed > 0.01) {
      const sideX = vz / horizontalSpeed;
      const sideZ = -vx / horizontalSpeed;
      const curve = ball.spin * AIR_CURVE * (arcadePhysics ? 1.12 : 0.82);
      vx += sideX * curve * horizontalSpeed * 0.018 * dt;
      vz += sideZ * curve * horizontalSpeed * 0.018 * dt;
    }

    if (wind && ball.windInfluence > 0) {
      const vector = windVector(wind);
      const heightFactor = clamp((y - groundY) / 70, 0.22, 1.28);
      const windAccel = wind.speed * 0.12 * ball.windInfluence * heightFactor * (arcadePhysics ? 1.08 : 0.82);
      vx += vector.x * windAccel * dt;
      vz += vector.z * windAccel * dt;
    }

    vy -= GRAVITY * dt;
    const drag = Math.exp(-AIR_DRAG * dt);
    vx *= drag;
    vy *= Math.exp(-AIR_DRAG * 0.36 * dt);
    vz *= drag;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;

    const nextGroundY = terrainHeightAt(x, z, hole) + BALL_RADIUS;
    const nextSurface = surfaceAt(x, z, hole);
    if (y <= nextGroundY) {
      y = nextGroundY;
      ball.surface = nextSurface;
      const verticalImpact = Math.abs(vy);
      const bounce = bounceForSurface(nextSurface) * ball.bounceMultiplier;
      const loss = clamp(rollLossForSurface(nextSurface) * ball.landingSpeedMultiplier, 0.2, 1.12);
      const groundSpeed = Math.hypot(vx, vz);
      const rollDirX = groundSpeed > 0.001 ? vx / groundSpeed : 0;
      const rollDirZ = groundSpeed > 0.001 ? vz / groundSpeed : 1;
      const backspinBite = Math.max(0, -ball.rollSpin) * (nextSurface === "green" ? 1 : nextSurface === "fairway" ? 0.5 : 0.22);
      const topspinRun = Math.max(0, ball.rollSpin) * (nextSurface === "sand" ? 0.08 : nextSurface === "rough" ? 0.2 : 0.28);

      if (verticalImpact > 4.5 && bounce > 0.09) {
        vy = -vy * bounce;
        vx *= loss;
        vz *= loss;
        if (backspinBite > 0.05) {
          vx *= clamp(1 - backspinBite * 0.42, 0.38, 1);
          vz *= clamp(1 - backspinBite * 0.42, 0.38, 1);
        } else if (topspinRun > 0.05) {
          vx *= 1 + topspinRun * 0.12;
          vz *= 1 + topspinRun * 0.12;
        }
        ball.airborne = verticalImpact > 8;
        bounced = verticalImpact > 8;
      } else {
        vy = 0;
        vx *= loss;
        vz *= loss;
        if (backspinBite > 0.05) {
          const biteScale = clamp(1 - backspinBite * 0.5, 0.32, 1);
          vx = vx * biteScale - rollDirX * backspinBite * 2.4;
          vz = vz * biteScale - rollDirZ * backspinBite * 2.4;
        } else if (topspinRun > 0.05) {
          vx *= 1 + topspinRun * 0.14;
          vz *= 1 + topspinRun * 0.14;
        }
        ball.airborne = false;
      }
    }
  } else {
    ball.airborne = false;
    y = groundY;
    const surface = surfaceAt(x, z, hole);
    ball.surface = surface;

    const eps = 1.5;
    const gradX = (terrainHeightAt(x + eps, z, hole) - terrainHeightAt(x - eps, z, hole)) / (eps * 2);
    const gradZ = (terrainHeightAt(x, z + eps, hole) - terrainHeightAt(x, z - eps, hole)) / (eps * 2);
    vx -= gradX * SLOPE_FORCE * dt;
    vz -= gradZ * SLOPE_FORCE * dt;

    const speed = Math.hypot(vx, vz);
    if (speed > 0.001) {
      const sideX = vz / speed;
      const sideZ = -vx / speed;
      const curve = ball.spin * ROLL_CURVE * (arcadePhysics ? 1 : 0.65);
      vx += sideX * curve * speed * 0.028 * dt;
      vz += sideZ * curve * speed * 0.028 * dt;

      const spinFriction = clamp(1 + Math.max(0, -ball.rollSpin) * 0.48 - Math.max(0, ball.rollSpin) * 0.1, 0.82, 1.52);
      const friction = frictionForSurface(surface, arcadePhysics) * ball.rollFrictionMultiplier * spinFriction;
      const newSpeed = Math.max(0, speed - friction * dt);
      const scale = newSpeed / speed;
      vx *= scale;
      vz *= scale;
      ball.spin *= Math.exp(-1.65 * dt);
      ball.rollSpin *= Math.exp(-1.15 * dt);
    }

    x += vx * dt;
    z += vz * dt;
    y = terrainHeightAt(x, z, hole) + BALL_RADIUS;

    if (Math.hypot(vx, vz) < DEAD_SPEED && Math.abs(vy) < 0.1) {
      vx = 0;
      vy = 0;
      vz = 0;
      ball.moving = false;
      stopped = true;
    }
  }

  if (y < -50 || !Number.isFinite(x + y + z)) {
    return stopBallAtGround(ball, hole, hole.teePosition.x, hole.teePosition.z);
  }

  if (!Number.isFinite(vx + vy + vz)) {
    return stopBallAtGround(ball, hole, x, z);
  }

  const finalGroundY = terrainHeightAt(x, z, hole) + BALL_RADIUS;
  const totalSpeed = Math.hypot(vx, vy, vz);
  const horizontalSpeed = Math.hypot(vx, vz);
  const nearGround = !ball.airborne || y <= finalGroundY + 0.25;

  if (ball.moving && nearGround && totalSpeed < LOW_SPEED && Math.abs(vy) < 0.75) {
    ball.settleSeconds += dt;
    const settleLimit = horizontalSpeed < 0.75 ? 0.28 : 0.9;
    if (ball.settleSeconds >= settleLimit) {
      x = Number.isFinite(x) ? x : hole.teePosition.x;
      z = Number.isFinite(z) ? z : hole.teePosition.z;
      y = terrainHeightAt(x, z, hole) + BALL_RADIUS;
      vx = 0;
      vy = 0;
      vz = 0;
      ball.moving = false;
      ball.airborne = false;
      stopped = true;
    }
  } else if (totalSpeed > LOW_SPEED || !nearGround) {
    ball.settleSeconds = 0;
  }

  ball.position = [x, y, z];
  ball.velocity = [vx, vy, vz];
  ball.lastSurface = ball.surface;

  return {
    bounced,
    stopped,
    speed: Math.hypot(vx, vy, vz),
    surface: ball.surface
  };
}

export function ballSpeed(ball: BallPhysicsState) {
  return Math.hypot(ball.velocity[0], ball.velocity[1], ball.velocity[2]);
}
