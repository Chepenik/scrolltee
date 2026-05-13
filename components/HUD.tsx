"use client";

import { CLUBS, CLUB_BY_ID, shotTypeLabel, spinLabel } from "@/lib/game/clubs";
import { lieName } from "@/lib/game/course";
import { formatYards } from "@/lib/game/math";
import { windAimHint } from "@/lib/game/wind";
import type { ClubId, HudSnapshot, ShotSetup, ShotType } from "@/lib/game/types";
import { ClubSelector } from "./ClubSelector";
import { SwingMeter } from "./SwingMeter";

type HUDProps = {
  hud: HudSnapshot;
  selectedClubId: ClubId;
  settingsOpen: boolean;
  paused: boolean;
  onClubSelect: (clubId: ClubId) => void;
  onNextHole: () => void;
  onRestartHole: () => void;
  onRestartRound: () => void;
  onCameraToggle: () => void;
  onSettingsToggle: () => void;
  onPauseToggle: () => void;
  onShotTypeSelect: (shotType: ShotType) => void;
  onShotSetupChange: (setup: Partial<ShotSetup>) => void;
  onResetShotSetup: () => void;
};

const SHOT_TYPES: ShotType[] = ["normal", "punch", "flop", "chip", "putt"];
const FLIGHT_READ: Record<ShotType, string> = {
  normal: "Mid",
  punch: "Low cut",
  flop: "High soft",
  chip: "Run-up",
  putt: "Ground"
};

function compactWindHint(hint: string) {
  if (hint === "Neutral") {
    return "Calm";
  }

  const prefix = hint.startsWith("Helping") ? "H" : hint.startsWith("Into") ? "I" : "X";
  const side = hint.endsWith("right") ? " R" : hint.endsWith("left") ? " L" : "";
  return `${prefix}${side}`;
}

export function HUD({
  hud,
  selectedClubId,
  settingsOpen,
  paused,
  onClubSelect,
  onNextHole,
  onRestartHole,
  onRestartRound,
  onCameraToggle,
  onSettingsToggle,
  onPauseToggle,
  onShotTypeSelect,
  onShotSetupChange,
  onResetShotSetup
}: HUDProps) {
  const controlsLocked = hud.phase === "BALL_FLIGHT" || hud.phase === "HOLED";
  const scoreToPar = hud.roundScore === 0 ? "E" : hud.roundScore > 0 ? `+${hud.roundScore}` : `${hud.roundScore}`;
  const windHint = windAimHint(hud.wind, (hud.aimDegrees * Math.PI) / 180);
  const selectedClub = CLUB_BY_ID[selectedClubId];
  const spinRead =
    hud.shotType === "putt"
      ? "Pace"
      : hud.spin < -0.22
        ? "Bite"
        : hud.spin > 0.22
          ? "Run"
          : "Stock";

  return (
    <div className="hud" aria-label="Game HUD">
      <div className="top-rail">
        <section className="panel score-card" aria-label="Scoreboard">
          <div className="brand-row">
            <h1>Scroll Tee</h1>
            <span>
              HOLE {hud.holeNumber}/{hud.holeCount}
            </span>
          </div>
          <div className="hole-name">{hud.holeName}</div>
          <div className="score-grid">
            <div className="metric">
              <small>Par</small>
              <strong>{hud.par}</strong>
            </div>
            <div className="metric">
              <small>Stroke</small>
              <strong>{hud.strokes}</strong>
            </div>
            <div className="metric">
              <small>Total</small>
              <strong>{hud.totalStrokes}</strong>
            </div>
            <div className="metric">
              <small>To Par</small>
              <strong>{scoreToPar}</strong>
            </div>
            <div className="metric">
              <small>Pin</small>
              <strong>{formatYards(hud.distanceToPin)}</strong>
            </div>
            <div className="metric">
              <small>Lie</small>
              <strong>{lieName(hud.surface)}</strong>
            </div>
            <div className="metric wind-metric">
              <small>Wind</small>
              <strong>
                <span className="wind-arrow" style={{ transform: `rotate(${hud.wind.directionDeg}deg)` }} aria-hidden="true" />
                {hud.wind.speed.toFixed(0)} mph {hud.wind.label}
              </strong>
            </div>
            <div className="metric">
              <small>Aim</small>
              <strong>{hud.aimDegrees.toFixed(0)} deg</strong>
            </div>
          </div>
        </section>

        <section className="panel shot-banner" aria-live="polite">
          <strong>{hud.shotResult}</strong>
          <span>
            {hud.roundComplete
              ? "Eighteen down. The scorecard is official."
              : hud.holed
                ? "Cup claimed. The office productivity index drops again."
                : "Scroll down to pull back. Scroll up fast to rip it."}
          </span>
        </section>

        <section className="panel help-card" aria-label="Controls">
          <h2>Controls</h2>
          <p>Drag or press A/D to aim. Use Q/E or horizontal scroll during the swing for curve.</p>
          <div className="kbd-line">
            <kbd>Scroll</kbd>
            <span>Trackball swing</span>
          </div>
          <div className="kbd-line">
            <kbd>1</kbd>
            <kbd>0</kbd>
            <kbd>-</kbd>
            <kbd>=</kbd>
            <span>Bag</span>
          </div>
          <div className="kbd-line">
            <kbd>Left</kbd>
            <kbd>Right</kbd>
            <kbd>Up</kbd>
            <kbd>Down</kbd>
            <span>Lineup</span>
          </div>
          <div className="kbd-line">
            <kbd>Z</kbd>
            <kbd>X</kbd>
            <kbd>PgUp</kbd>
            <kbd>PgDn</kbd>
            <span>Spin</span>
          </div>
          <div className="kbd-line">
            <kbd>N</kbd>
            <kbd>P</kbd>
            <kbd>F</kbd>
            <kbd>V</kbd>
            <span>Shot type</span>
          </div>
          <div className="kbd-line">
            <kbd>S/W</kbd>
            <kbd>C</kbd>
            <kbd>Esc</kbd>
            <span>Swing / cam / pause</span>
          </div>
          <p>Sink it before your boss sees this tab.</p>
        </section>
      </div>

      <div />

      <section className="mobile-hud-tray" aria-label="Mobile shot controls">
        <div className="mobile-status-strip">
          <div>
            <small>Pin</small>
            <strong>{formatYards(hud.distanceToPin)}</strong>
          </div>
          <div>
            <small>Lie</small>
            <strong>{lieName(hud.surface)}</strong>
          </div>
          <div>
            <small>Wind</small>
            <strong>{compactWindHint(windHint)}</strong>
          </div>
          <div>
            <small>Aim</small>
            <strong>{hud.aimDegrees.toFixed(0)} deg</strong>
          </div>
        </div>

        <div className="mobile-shot-row" aria-label="Shot type">
          {SHOT_TYPES.map((shotType) => (
            <button
              className={`chip-button ${hud.shotType === shotType ? "is-active" : ""}`}
              disabled={controlsLocked || (shotType === "putt" && selectedClubId !== "putter")}
              key={shotType}
              onClick={() => onShotTypeSelect(shotType)}
              type="button"
            >
              {shotTypeLabel(shotType)}
            </button>
          ))}
        </div>

        <details className="mobile-setup-details">
          <summary>
            <span>Lineup</span>
            <strong>
              {selectedClub.shortName} / {spinRead}
            </strong>
          </summary>
          <label className="setup-slider">
            <span>
              Face <strong>{hud.stanceOffset > 0.05 ? "Draw" : hud.stanceOffset < -0.05 ? "Fade" : "Square"}</strong>
            </span>
            <input
              disabled={controlsLocked}
              max="1"
              min="-1"
              onChange={(event) => onShotSetupChange({ stanceOffset: Number(event.target.value) })}
              step="0.02"
              type="range"
              value={hud.stanceOffset}
            />
          </label>
          <label className="setup-slider">
            <span>
              Ball <strong>{hud.ballForward > 0.05 ? "Forward" : hud.ballForward < -0.05 ? "Back" : "Center"}</strong>
            </span>
            <input
              disabled={controlsLocked}
              max="1"
              min="-1"
              onChange={(event) => onShotSetupChange({ ballForward: Number(event.target.value) })}
              step="0.02"
              type="range"
              value={hud.ballForward}
            />
          </label>
          <label className="setup-slider">
            <span>
              Spin <strong>{spinLabel(hud.spin)}</strong>
            </span>
            <input
              disabled={controlsLocked}
              max="1"
              min="-1"
              onChange={(event) => onShotSetupChange({ spin: Number(event.target.value) })}
              step="0.02"
              type="range"
              value={hud.spin}
            />
          </label>
          <button className="ui-button setup-reset" disabled={controlsLocked} onClick={onResetShotSetup} type="button">
            Reset Alignment
          </button>
        </details>

        <div className="mobile-club-scroll" aria-label="Club selector">
          {CLUBS.map((club) => (
            <button
              className={`mobile-club-button club-button-${club.category} ${selectedClubId === club.id ? "is-active" : ""}`}
              disabled={controlsLocked}
              key={club.id}
              onClick={() => onClubSelect(club.id)}
              title={`${club.key}. ${club.name}`}
              type="button"
            >
              <strong>{club.shortName}</strong>
              <span>{club.maxDistance}</span>
            </button>
          ))}
        </div>

        <div className="mobile-actions">
          <button className="ui-button primary" disabled={!hud.holed || hud.roundComplete} onClick={onNextHole} type="button">
            Next
          </button>
          <button className="ui-button" onClick={onRestartHole} type="button">
            Hole
          </button>
          <button className="ui-button" onClick={onRestartRound} type="button">
            Round
          </button>
          <button className="ui-button" onClick={onCameraToggle} type="button">
            Cam
          </button>
          <button className="ui-button" onClick={onSettingsToggle} type="button">
            {settingsOpen ? "Hide" : "Tune"}
          </button>
          <button className="ui-button" onClick={onPauseToggle} type="button">
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </section>

      <div className="bottom-rail">
        <section className="panel setup-card" aria-label="Shot setup">
          <div className="selector-header">
            <span>Lineup</span>
            <strong>{shotTypeLabel(hud.shotType)}</strong>
          </div>
          <div className="shot-type-row">
            {SHOT_TYPES.map((shotType) => (
              <button
                className={`chip-button ${hud.shotType === shotType ? "is-active" : ""}`}
                disabled={controlsLocked || (shotType === "putt" && selectedClubId !== "putter")}
                key={shotType}
                onClick={() => onShotTypeSelect(shotType)}
                type="button"
              >
                {shotTypeLabel(shotType)}
              </button>
            ))}
          </div>
          <label className="setup-slider">
            <span>
              Face <strong>{hud.stanceOffset > 0.05 ? "Draw" : hud.stanceOffset < -0.05 ? "Fade" : "Square"}</strong>
            </span>
            <input
              disabled={controlsLocked}
              max="1"
              min="-1"
              onChange={(event) => onShotSetupChange({ stanceOffset: Number(event.target.value) })}
              step="0.02"
              type="range"
              value={hud.stanceOffset}
            />
          </label>
          <label className="setup-slider">
            <span>
              Ball <strong>{hud.ballForward > 0.05 ? "Forward" : hud.ballForward < -0.05 ? "Back" : "Center"}</strong>
            </span>
            <input
              disabled={controlsLocked}
              max="1"
              min="-1"
              onChange={(event) => onShotSetupChange({ ballForward: Number(event.target.value) })}
              step="0.02"
              type="range"
              value={hud.ballForward}
            />
          </label>
          <label className="setup-slider">
            <span>
              Spin <strong>{spinLabel(hud.spin)}</strong>
            </span>
            <input
              disabled={controlsLocked}
              max="1"
              min="-1"
              onChange={(event) => onShotSetupChange({ spin: Number(event.target.value) })}
              step="0.02"
              type="range"
              value={hud.spin}
            />
          </label>
          <div className="shot-read-grid">
            <div>
              <small>Wind</small>
              <strong>{compactWindHint(windHint)}</strong>
            </div>
            <div>
              <small>Club</small>
              <strong>{selectedClub.shortName}</strong>
            </div>
            <div>
              <small>Flight</small>
              <strong>{FLIGHT_READ[hud.shotType]}</strong>
            </div>
            <div>
              <small>Spin</small>
              <strong>{spinRead}</strong>
            </div>
          </div>
          <div className="estimate-grid">
            <div>
              <small>Carry</small>
              <strong>{formatYards(hud.carryEstimate)}</strong>
            </div>
            <div>
              <small>Roll</small>
              <strong>{formatYards(hud.rollEstimate)}</strong>
            </div>
            <div>
              <small>Total</small>
              <strong>{formatYards(hud.totalEstimate)}</strong>
            </div>
          </div>
          <button className="ui-button setup-reset" disabled={controlsLocked} onClick={onResetShotSetup} type="button">
            Reset Alignment
          </button>
        </section>
        <SwingMeter swing={hud.swing} />
        <ClubSelector disabled={controlsLocked} onSelect={onClubSelect} selectedClubId={selectedClubId} />
        <section className="panel action-card" aria-label="Actions">
          <div className="primary-actions">
            <button className="ui-button primary" disabled={!hud.holed || hud.roundComplete} onClick={onNextHole} type="button">
              Next Hole
            </button>
            <button className="ui-button" onClick={onRestartHole} type="button">
              Restart Hole
            </button>
          </div>
          <div className="primary-actions">
            <button className="ui-button" onClick={onRestartRound} type="button">
              Restart Round
            </button>
            <button className="ui-button" onClick={onCameraToggle} type="button">
              Camera: {hud.cameraMode}
            </button>
          </div>
          <div className="primary-actions">
            <button className="ui-button" onClick={onSettingsToggle} type="button">
              {settingsOpen ? "Hide Settings" : "Settings"}
            </button>
            <button className="ui-button" onClick={onPauseToggle} type="button">
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
          <div className="metric">
            <small>Ball Speed</small>
            <strong>{Math.round(hud.ballSpeed)} yd/s</strong>
          </div>
        </section>
      </div>
    </div>
  );
}
