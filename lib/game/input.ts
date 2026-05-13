import { clamp, damp } from "./math";
import type { DeviceGuess, GameSettings, SwingDebugSnapshot, SwingDirection, SwingPhase, SwingStrike } from "./types";

type TrackballInputOptions = {
  getSettings: () => GameSettings;
  canSwing: () => boolean;
  onUpdate: (snapshot: SwingDebugSnapshot) => void;
  onStrike: (strike: SwingStrike) => void;
};

type WheelSample = {
  t: number;
  forward: number;
  lateral: number;
};

const EMPTY_DEBUG: SwingDebugSnapshot = {
  phase: "IDLE",
  device: "wheel",
  rawDeltaY: 0,
  deltaY: 0,
  deltaX: 0,
  swingDirection: "neutral",
  lastKey: "",
  backswing: 0,
  downswingVelocity: 0,
  power: 0,
  spin: 0,
  smoothness: 1
};

const BACKSWING_PIXELS = 620;
const FORWARD_VELOCITY_TARGET = 1.45;
const STRIKE_FORWARD_PIXELS = 72;
const DOWNSWING_WINDOW_MS = 150;
const TOUCH_SWING_SCALE = 1.35;
const TOUCH_LATERAL_SCALE = 0.9;

export class TrackballInput {
  private readonly element: HTMLElement;
  private readonly options: TrackballInputOptions;
  private phase: SwingPhase = "IDLE";
  private device: DeviceGuess = "wheel";
  private backswing = 0;
  private forwardAccum = 0;
  private lateralAccum = 0;
  private downswingVelocity = 0;
  private lastRawDeltaY = 0;
  private lastDeltaY = 0;
  private lastDeltaX = 0;
  private swingDirection: SwingDirection = "neutral";
  private lastKey = "";
  private smoothness = 1;
  private power = 0;
  private spin = 0;
  private lastBackswingAt = 0;
  private reversalAt = 0;
  private lastInputAt = 0;
  private lockedUntil = 0;
  private signFlips = 0;
  private lastSign = 0;
  private curveKeyBias = 0;
  private samples: WheelSample[] = [];

  constructor(element: HTMLElement, options: TrackballInputOptions) {
    this.element = element;
    this.options = options;
    this.element.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  destroy() {
    this.element.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  reset(lockMs = 260) {
    this.phase = "IDLE";
    this.backswing = 0;
    this.forwardAccum = 0;
    this.lateralAccum = 0;
    this.downswingVelocity = 0;
    this.lastRawDeltaY = 0;
    this.lastDeltaY = 0;
    this.lastDeltaX = 0;
    this.swingDirection = "neutral";
    this.smoothness = 1;
    this.power = 0;
    this.spin = 0;
    this.samples = [];
    this.signFlips = 0;
    this.lastSign = 0;
    this.lockedUntil = performance.now() + lockMs;
    this.emit();
  }

  tick(now: number, dt: number) {
    if (this.phase === "BACKSWING" && now - this.lastInputAt > 420) {
      this.backswing = damp(this.backswing, 0, 1.7, dt);
      if (this.backswing < 0.01) {
        this.reset(0);
      } else {
        this.emit();
      }
    }

    if (this.phase === "DOWNSWING" && now - this.lastInputAt > 180) {
      this.strike(now, true);
    }
  }

  getSnapshot(): SwingDebugSnapshot {
    return {
      phase: this.phase,
      device: this.device,
      rawDeltaY: this.lastRawDeltaY,
      deltaY: this.lastDeltaY,
      deltaX: this.lastDeltaX,
      swingDirection: this.swingDirection,
      lastKey: this.lastKey,
      backswing: this.backswing,
      downswingVelocity: this.downswingVelocity,
      power: this.power,
      spin: this.spin,
      smoothness: this.smoothness
    };
  }

  startTouchSwing(now = performance.now()) {
    if (!this.options.canSwing() || now < this.lockedUntil) {
      return false;
    }

    this.device = "touch";
    this.lastKey = "Touch";
    this.lastInputAt = now;
    this.emit();
    return true;
  }

  applyTouchSwing(deltaY: number, deltaX: number, now = performance.now()) {
    if (!this.options.canSwing() || now < this.lockedUntil) {
      return false;
    }

    const settings = this.options.getSettings();
    const direction = settings.invertSwing ? -1 : 1;
    const sensitivity = settings.sensitivity;
    const dy = deltaY * direction * sensitivity * TOUCH_SWING_SCALE;
    const dx = deltaX * sensitivity * TOUCH_LATERAL_SCALE;

    this.device = "touch";
    this.lastRawDeltaY = deltaY;
    this.applyScroll(dy, dx, now);
    return true;
  }

  releaseTouchSwing(now = performance.now()) {
    if (!this.options.canSwing() || now < this.lockedUntil) {
      return false;
    }

    if (this.phase === "DOWNSWING") {
      const forced = this.forwardAccum < STRIKE_FORWARD_PIXELS && this.downswingVelocity <= 0.78;
      this.strike(now, forced);
      return true;
    }

    return false;
  }

  private handleWheel = (event: WheelEvent) => {
    const now = performance.now();
    event.preventDefault();

    if (!this.options.canSwing() || now < this.lockedUntil) {
      return;
    }

    const normalized = this.normalizeWheel(event);
    this.lastRawDeltaY = normalized.rawDy;
    this.device = this.guessDevice(normalized.dy, now);
    this.applyScroll(normalized.dy, normalized.dx, now);
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.options.canSwing()) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "q") {
      this.lastKey = "Q";
      this.curveKeyBias = -1;
      this.emit();
      return;
    }
    if (key === "e") {
      this.lastKey = "E";
      this.curveKeyBias = 1;
      this.emit();
      return;
    }

    if (key === "s") {
      event.preventDefault();
      this.lastKey = "S";
      this.lastRawDeltaY = 70;
      this.device = "keyboard";
      this.applyScroll(70, this.curveKeyBias * 16, performance.now());
      return;
    }

    if (key === "w") {
      event.preventDefault();
      this.lastKey = "W";
      this.lastRawDeltaY = -135;
      this.device = "keyboard";
      this.applyScroll(-135, this.curveKeyBias * 22, performance.now());
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if ((key === "q" && this.curveKeyBias < 0) || (key === "e" && this.curveKeyBias > 0)) {
      this.curveKeyBias = 0;
    }
  };

  private normalizeWheel(event: WheelEvent) {
    let multiplier = 1;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      multiplier = 16;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      multiplier = window.innerHeight;
    }

    const settings = this.options.getSettings();
    const direction = settings.invertSwing ? -1 : 1;
    const sensitivity = settings.sensitivity;

    const rawDx = event.deltaX * multiplier;
    const rawDy = event.deltaY * multiplier;
    let dx = rawDx * sensitivity;
    let dy = rawDy * sensitivity * direction;

    if (event.shiftKey && Math.abs(dx) < Math.abs(dy) * 0.25) {
      dx += dy * 0.42;
      dy *= 0.82;
    }

    return { dx, dy, rawDy };
  }

  private guessDevice(deltaY: number, now: number): DeviceGuess {
    const gap = now - this.lastInputAt;
    const abs = Math.abs(deltaY);
    if (gap < 28 && abs < 24) {
      return "touchpad";
    }

    if (abs < 12) {
      return "touchpad";
    }

    return "wheel";
  }

  private applyScroll(deltaY: number, deltaX: number, now: number) {
    const sign = Math.sign(deltaY);
    if (this.lastSign !== 0 && sign !== 0 && sign !== this.lastSign) {
      this.signFlips += 1;
    }
    if (sign !== 0) {
      this.lastSign = sign;
    }

    this.lastDeltaY = deltaY;
    this.lastDeltaX = deltaX;
    this.swingDirection = deltaY > 0 ? "backswing" : deltaY < 0 ? "downswing" : "neutral";
    this.lastInputAt = now;

    if (this.phase === "IDLE" || this.phase === "BALL_STOPPED") {
      if (deltaY > 1.5) {
        this.phase = "BACKSWING";
      } else {
        this.emit();
        return;
      }
    }

    if (this.phase === "BACKSWING") {
      if (deltaY > 0) {
        this.backswing = clamp(this.backswing + deltaY / BACKSWING_PIXELS, 0, 1);
        this.lastBackswingAt = now;
        this.power = this.backswing * 0.55;
        this.spin = clamp(this.spin + deltaX / 900, -1, 1);
        this.emit();
        return;
      }

      if (deltaY < -2 && this.backswing > 0.035) {
        this.phase = "DOWNSWING";
        this.reversalAt = now;
        this.forwardAccum = 0;
        this.lateralAccum = 0;
        this.samples = [];
      }
    }

    if (this.phase === "DOWNSWING") {
      if (deltaY < 0) {
        const forward = Math.abs(deltaY);
        this.forwardAccum += forward;
        this.lateralAccum += deltaX;
        this.samples.push({ t: now, forward, lateral: deltaX });
        this.samples = this.samples.filter((sample) => now - sample.t <= DOWNSWING_WINDOW_MS);
        this.recomputeDownswing(now);
      } else {
        this.lateralAccum += deltaX * 0.4;
      }

      if (
        (this.forwardAccum >= STRIKE_FORWARD_PIXELS && now - this.reversalAt >= 16) ||
        this.downswingVelocity > 0.78
      ) {
        this.strike(now, false);
      } else {
        this.emit();
      }
    }
  }

  private recomputeDownswing(now: number) {
    const windowForward = this.samples.reduce((total, sample) => total + sample.forward, 0);
    const first = this.samples[0]?.t ?? now;
    const elapsed = Math.max(28, now - first);
    const pixelsPerMs = windowForward / elapsed;
    this.downswingVelocity = clamp(pixelsPerMs / FORWARD_VELOCITY_TARGET, 0, 1.3);

    const reversalDelay = Math.max(0, this.reversalAt - this.lastBackswingAt);
    const reversalScore = clamp(1 - reversalDelay / 550, 0.55, 1);
    const sideways = Math.min(1, Math.abs(this.lateralAccum) / Math.max(this.forwardAccum, 60));
    const jitterPenalty = clamp((this.signFlips - 1) * 0.08, 0, 0.24);
    this.smoothness = clamp(reversalScore - sideways * 0.24 - jitterPenalty, 0.35, 1);
    this.spin = clamp(this.lateralAccum / Math.max(this.forwardAccum, 60) + this.curveKeyBias * 0.55, -1, 1);
    this.power = clamp(this.backswing * 0.55 + this.downswingVelocity * 0.45, 0, 1);
  }

  private strike(now: number, forced: boolean) {
    this.recomputeDownswing(now);
    const weak = this.forwardAccum < 28 || this.downswingVelocity < 0.14;
    const sideways = Math.min(1, Math.abs(this.spin));
    const overcook = clamp((this.downswingVelocity - 1.02) / 0.28, 0, 1);
    const mishit = clamp((1 - this.smoothness) * 0.62 + sideways * 0.2 + overcook * 0.25 + (weak ? 0.45 : 0), 0, 1);
    const power = weak ? this.power * 0.42 : this.power;

    this.phase = "STRIKE";
    this.power = clamp(power, 0, 1);
    this.lockedUntil = now + 720;
    this.emit();
    this.options.onStrike({
      power: this.power,
      backswing: this.backswing,
      forwardVelocity: this.downswingVelocity,
      spin: this.spin,
      smoothness: this.smoothness,
      mishit: forced ? clamp(mishit + 0.12, 0, 1) : mishit,
      device: this.device
    });
  }

  private emit() {
    this.options.onUpdate(this.getSnapshot());
  }
}

export function createEmptySwingDebug(): SwingDebugSnapshot {
  return { ...EMPTY_DEBUG };
}
