export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, value: number) {
  if (a === b) {
    return 0;
  }

  return clamp((value - a) / (b - a), 0, 1);
}

export function damp(current: number, target: number, smoothing: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

export function normalizeAngle(angle: number) {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

export function formatYards(value: number) {
  return `${Math.max(0, Math.round(value))} yd`;
}

export function horizontalDistance(ax: number, az: number, bx: number, bz: number) {
  return Math.hypot(ax - bx, az - bz);
}
