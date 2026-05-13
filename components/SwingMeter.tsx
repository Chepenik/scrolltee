"use client";

import type { SwingDebugSnapshot } from "@/lib/game/types";

type SwingMeterProps = {
  swing: SwingDebugSnapshot;
};

export function SwingMeter({ swing }: SwingMeterProps) {
  const fill = Math.round(Math.max(swing.backswing, swing.power) * 100);
  const velocity = Math.round(swing.downswingVelocity * 100);
  const spin = swing.spin.toFixed(2);
  const smooth = Math.round(swing.smoothness * 100);

  return (
    <section className="panel swing-meter" aria-label="Swing meter">
      <div className="meter-header">
        <span>Trackball Swing</span>
        <strong>{swing.phase}</strong>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${fill}%` }} />
        <div className="meter-ideal" />
      </div>
      <div className="meter-readout">
        <span>Power {fill}%</span>
        <span>Rip {velocity}%</span>
        <span>Spin {spin}</span>
        <span>Clean {smooth}%</span>
      </div>
    </section>
  );
}
