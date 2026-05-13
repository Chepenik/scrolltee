"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HUD } from "@/components/HUD";
import { CLUB_BY_ID, clubIdForKey, effectiveShotType, nextClubId } from "@/lib/game/clubs";
import { holeDistance } from "@/lib/game/course";
import { FIRST_HOLE, HOLES } from "@/lib/game/holes";
import { createEmptySwingDebug } from "@/lib/game/input";
import { completionText } from "@/lib/game/scoring";
import { windForShot } from "@/lib/game/wind";
import type { ClubId, GameSettings, HudSnapshot, ShotSetup, ShotType } from "@/lib/game/types";
import { GolfScene } from "./GolfScene";

const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1,
  invertSwing: false,
  arcadePhysics: true,
  debugInput: false
};

const DEFAULT_SHOT_SETUP: ShotSetup = {
  shotType: "normal",
  stanceOffset: 0,
  ballForward: 0,
  spin: 0
};

function formatScoreDiff(diff: number) {
  if (diff === 0) {
    return "E";
  }
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function createDefaultHud(hole = FIRST_HOLE): HudSnapshot {
  return {
    phase: "IDLE",
    holeNumber: hole.holeNumber,
    holeCount: HOLES.length,
    holeName: hole.name,
    strokes: 0,
    distanceToPin: holeDistance(hole),
    shotResult: "READY TO RIP",
    surface: "tee",
    ballSpeed: 0,
    clubId: "driver",
    shotType: "normal",
    stanceOffset: 0,
    ballForward: 0,
    spin: 0,
    wind: windForShot(hole, 1),
    carryEstimate: 245,
    rollEstimate: 47,
    totalEstimate: 292,
    aimDegrees: 0,
    holed: false,
    par: hole.par,
    totalStrokes: 0,
    totalPar: 0,
    roundScore: 0,
    completedHoles: 0,
    roundComplete: false,
    cameraMode: "auto",
    swing: createEmptySwingDebug()
  };
}

export function GameShell() {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [holeScores, setHoleScores] = useState<Array<number | null>>(() => Array<number | null>(HOLES.length).fill(null));
  const [selectedClubId, setSelectedClubId] = useState<ClubId>("driver");
  const [shotSetup, setShotSetup] = useState<ShotSetup>(DEFAULT_SHOT_SETUP);
  const [hud, setHud] = useState<HudSnapshot>(() => createDefaultHud());
  const [restartToken, setRestartToken] = useState(0);
  const [cameraToken, setCameraToken] = useState(0);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [lastControlKey, setLastControlKey] = useState("");
  const lastShotResultRef = useRef("READY TO RIP");
  const toastIdRef = useRef(0);
  const currentHole = HOLES[currentHoleIndex] ?? FIRST_HOLE;
  const completedHoles = holeScores.filter((score) => score !== null).length;
  const completedStrokes = holeScores.reduce<number>((total, score) => total + (score ?? 0), 0);
  const completedPar = holeScores.reduce<number>((total, score, index) => total + (score === null ? 0 : (HOLES[index]?.par ?? 0)), 0);
  const roundComplete = holeScores.every((score) => score !== null);

  useEffect(() => {
    const raw = window.localStorage.getItem("scroll-tee-settings");
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      window.setTimeout(() => {
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }, 0);
    } catch {
      window.localStorage.removeItem("scroll-tee-settings");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("scroll-tee-settings", JSON.stringify(settings));
  }, [settings]);

  const onRestartHole = useCallback(() => {
    setStarted(true);
    setPaused(false);
    setHoleScores((current) => current.map((score, index) => (index === currentHoleIndex ? null : score)));
    setShotSetup(DEFAULT_SHOT_SETUP);
    setRestartToken((value) => value + 1);
  }, [currentHoleIndex]);

  const onRestartRound = useCallback(() => {
    setStarted(true);
    setPaused(false);
    setCurrentHoleIndex(0);
    setHoleScores(Array<number | null>(HOLES.length).fill(null));
    setShotSetup(DEFAULT_SHOT_SETUP);
    setHud(createDefaultHud(FIRST_HOLE));
    setRestartToken((value) => value + 1);
    lastShotResultRef.current = "READY TO RIP";
  }, []);

  const onNextHole = useCallback(() => {
    if (!hud.holed || hud.holeNumber !== currentHole.holeNumber || roundComplete || currentHoleIndex >= HOLES.length - 1) {
      return;
    }

    const nextHoleIndex = Math.min(HOLES.length - 1, currentHoleIndex + 1);
    const nextHole = HOLES[nextHoleIndex] ?? FIRST_HOLE;
    setStarted(true);
    setPaused(false);
    setCurrentHoleIndex(nextHoleIndex);
    setShotSetup(DEFAULT_SHOT_SETUP);
    setHud(createDefaultHud(nextHole));
    lastShotResultRef.current = "READY TO RIP";
  }, [currentHole, currentHoleIndex, hud.holeNumber, hud.holed, roundComplete]);

  const onCameraToggle = useCallback(() => {
    setCameraToken((value) => value + 1);
  }, []);

  const updateSetting = useCallback(<K extends keyof GameSettings,>(key: K, value: GameSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const handleClubSelect = useCallback((clubId: ClubId) => {
    setSelectedClubId(clubId);
    setHud((current) =>
      current.clubId === clubId
        ? current
        : {
            ...current,
            clubId,
            shotType: effectiveShotType(clubId, shotSetup.shotType)
          }
    );
  }, [shotSetup.shotType]);

  const updateShotSetup = useCallback((next: Partial<ShotSetup>) => {
    setShotSetup((current) => ({
      ...current,
      ...next,
      stanceOffset: Math.max(-1, Math.min(1, next.stanceOffset ?? current.stanceOffset)),
      ballForward: Math.max(-1, Math.min(1, next.ballForward ?? current.ballForward)),
      spin: Math.max(-1, Math.min(1, next.spin ?? current.spin))
    }));
  }, []);

  const resetShotSetup = useCallback(() => {
    setShotSetup(DEFAULT_SHOT_SETUP);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const controlsLocked = hud.phase === "BALL_FLIGHT" || hud.phase === "HOLED" || hud.holed;
      if (controlsLocked) {
        return;
      }

      const clubId = clubIdForKey(event.key);
      if (clubId) {
        event.preventDefault();
        event.stopPropagation();
        handleClubSelect(clubId);
        setLastControlKey(event.key);
        return;
      }

      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        event.stopPropagation();
        handleClubSelect(nextClubId(selectedClubId, event.key === "]" ? 1 : -1));
        setLastControlKey(event.key);
        return;
      }

      const key = event.key.toLowerCase();
      const shotTypeForKey: Record<string, ShotType> = {
        n: "normal",
        p: "punch",
        f: "flop",
        v: "chip"
      };
      const shotType = shotTypeForKey[key];
      if (shotType) {
        event.preventDefault();
        event.stopPropagation();
        updateShotSetup({ shotType });
        setLastControlKey(event.key.toUpperCase());
        return;
      }

      if (key === "arrowleft" || key === "arrowright") {
        event.preventDefault();
        updateShotSetup({ stanceOffset: shotSetup.stanceOffset + (key === "arrowright" ? 0.14 : -0.14) });
        setLastControlKey(key === "arrowright" ? "ArrowRight" : "ArrowLeft");
        return;
      }

      if (key === "arrowup" || key === "arrowdown") {
        event.preventDefault();
        updateShotSetup({ ballForward: shotSetup.ballForward + (key === "arrowup" ? 0.14 : -0.14) });
        setLastControlKey(key === "arrowup" ? "ArrowUp" : "ArrowDown");
        return;
      }

      if (key === "z" || key === "x" || key === "pageup" || key === "pagedown") {
        event.preventDefault();
        const backspin = key === "z" || key === "pageup";
        updateShotSetup({ spin: shotSetup.spin + (backspin ? -0.16 : 0.16) });
        setLastControlKey(event.key);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
  }, [
    handleClubSelect,
    hud.phase,
    hud.holed,
    selectedClubId,
    shotSetup.ballForward,
    shotSetup.spin,
    shotSetup.stanceOffset,
    updateShotSetup
  ]);

  const handleHudUpdate = useCallback(
    (snapshot: HudSnapshot) => {
      setHud(snapshot);
      if (snapshot.holed) {
        const scoreIndex = snapshot.holeNumber - 1;
        setHoleScores((current) => {
          if (current[scoreIndex] !== null) {
            return current;
          }

          return current.map((score, index) => (index === scoreIndex ? snapshot.strokes : score));
        });
      }
      if (snapshot.shotResult === "READY TO RIP") {
        lastShotResultRef.current = snapshot.shotResult;
      }
      if (started && snapshot.shotResult !== "READY TO RIP" && snapshot.shotResult !== lastShotResultRef.current) {
        lastShotResultRef.current = snapshot.shotResult;
        toastIdRef.current += 1;
        const id = toastIdRef.current;
        setToasts((current) => [...current.slice(-2), { id, text: snapshot.shotResult }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 1250);
      }
    },
    [started]
  );

  const active = started && !paused;
  const selectedClub = CLUB_BY_ID[selectedClubId] ?? CLUB_BY_ID.driver;
  const displayHud = useMemo(() => {
    const hudBelongsToCurrentHole = hud.holeNumber === currentHole.holeNumber;
    const displayHoled = hudBelongsToCurrentHole && hud.holed;
    const recordedCurrentScore = holeScores[currentHoleIndex];
    const currentHoleScore = recordedCurrentScore ?? (hudBelongsToCurrentHole ? hud.strokes : 0);
    const includeCurrentHole = recordedCurrentScore !== null || displayHoled;
    const completedStrokesOutsideCurrent = holeScores.reduce<number>((total, score, index) => {
      if (index === currentHoleIndex) {
        return total;
      }
      return total + (score ?? 0);
    }, 0);
    const completedParOutsideCurrent = holeScores.reduce<number>((total, score, index) => {
      if (index === currentHoleIndex) {
        return total;
      }
      return total + (score === null ? 0 : (HOLES[index]?.par ?? 0));
    }, 0);
    const displayTotalStrokes = completedStrokesOutsideCurrent + currentHoleScore;
    const displayTotalPar = completedParOutsideCurrent + (includeCurrentHole ? currentHole.par : 0);
    const scoreStrokes = completedStrokesOutsideCurrent + (includeCurrentHole ? currentHoleScore : 0);
    const scorePar = completedParOutsideCurrent + (includeCurrentHole ? currentHole.par : 0);
    const displayCompletedHoles = completedHoles + (recordedCurrentScore === null && displayHoled ? 1 : 0);
    const displayRoundComplete = roundComplete || (currentHoleIndex === HOLES.length - 1 && displayHoled);

    return {
      ...hud,
      holeNumber: currentHole.holeNumber,
      holeCount: HOLES.length,
      holeName: currentHole.name,
      par: currentHole.par,
      shotType: effectiveShotType(selectedClubId, shotSetup.shotType),
      stanceOffset: shotSetup.stanceOffset,
      ballForward: shotSetup.ballForward,
      spin: shotSetup.spin,
      totalStrokes: displayTotalStrokes,
      totalPar: displayTotalPar,
      roundScore: scorePar > 0 ? scoreStrokes - scorePar : 0,
      holed: displayHoled,
      completedHoles: displayRoundComplete ? HOLES.length : displayCompletedHoles,
      roundComplete: displayRoundComplete
    };
  }, [completedHoles, currentHole, currentHoleIndex, holeScores, hud, roundComplete, selectedClubId, shotSetup]);

  const settingsPanel = useMemo(() => {
    if (!settingsOpen) {
      return null;
    }

    return (
      <section className="panel settings-card" aria-label="Settings">
        <h2>Settings</h2>
        <div className="setting-row">
          <label htmlFor="sensitivity">
            <span>Swing sensitivity</span>
            <strong>{settings.sensitivity.toFixed(2)}x</strong>
          </label>
          <input
            id="sensitivity"
            max="1.65"
            min="0.55"
            onChange={(event) => updateSetting("sensitivity", Number(event.target.value))}
            step="0.05"
            type="range"
            value={settings.sensitivity}
          />
        </div>
        <label className="toggle-row">
          <span>Invert swing direction</span>
          <input
            checked={settings.invertSwing}
            onChange={(event) => updateSetting("invertSwing", event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="toggle-row">
          <span>Arcade physics</span>
          <input
            checked={settings.arcadePhysics}
            onChange={(event) => updateSetting("arcadePhysics", event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="toggle-row">
          <span>Debug input overlay</span>
          <input
            checked={settings.debugInput}
            onChange={(event) => updateSetting("debugInput", event.target.checked)}
            type="checkbox"
          />
        </label>
        <button className="ui-button" onClick={() => setSettings(DEFAULT_SETTINGS)} type="button">
          Reset Settings
        </button>
      </section>
    );
  }, [settings, settingsOpen, updateSetting]);

  return (
    <main className="game-shell">
      <GolfScene
        active={active}
        cameraToken={cameraToken}
        completedHoles={completedHoles}
        completedPar={completedPar}
        completedStrokes={completedStrokes}
        hole={currentHole}
        onClubChange={handleClubSelect}
        onControlKey={setLastControlKey}
        onHudUpdate={handleHudUpdate}
        onPauseToggle={() => setPaused((value) => !value)}
        roundComplete={roundComplete}
        restartToken={restartToken}
        shotSetup={shotSetup}
        selectedClubId={selectedClubId}
        settings={settings}
      />
      <HUD
        hud={{ ...displayHud, clubId: selectedClub.id }}
        onCameraToggle={onCameraToggle}
        onClubSelect={handleClubSelect}
        onNextHole={onNextHole}
        onPauseToggle={() => setPaused((value) => !value)}
        onRestartHole={onRestartHole}
        onRestartRound={onRestartRound}
        onResetShotSetup={resetShotSetup}
        onSettingsToggle={() => setSettingsOpen((value) => !value)}
        onShotSetupChange={updateShotSetup}
        onShotTypeSelect={(shotType) => updateShotSetup({ shotType })}
        paused={paused}
        selectedClubId={selectedClubId}
        settingsOpen={settingsOpen}
      />
      {settingsPanel}
      {settings.debugInput ? (
        <section className="panel debug-card" aria-label="Input debug">
          <div className="debug-row">
            <span>phase</span>
            <strong>{hud.swing.phase}</strong>
          </div>
          <div className="debug-row">
            <span>device</span>
            <strong>{hud.swing.device}</strong>
          </div>
          <div className="debug-row">
            <span>raw deltaY</span>
            <strong>{hud.swing.rawDeltaY.toFixed(1)}</strong>
          </div>
          <div className="debug-row">
            <span>normalized</span>
            <strong>{hud.swing.deltaY.toFixed(1)}</strong>
          </div>
          <div className="debug-row">
            <span>swing dir</span>
            <strong>{hud.swing.swingDirection}</strong>
          </div>
          <div className="debug-row">
            <span>deltaX</span>
            <strong>{hud.swing.deltaX.toFixed(1)}</strong>
          </div>
          <div className="debug-row">
            <span>backswing</span>
            <strong>{hud.swing.backswing.toFixed(2)}</strong>
          </div>
          <div className="debug-row">
            <span>velocity</span>
            <strong>{hud.swing.downswingVelocity.toFixed(2)}</strong>
          </div>
          <div className="debug-row">
            <span>power</span>
            <strong>{hud.swing.power.toFixed(2)}</strong>
          </div>
          <div className="debug-row">
            <span>spin</span>
            <strong>{hud.swing.spin.toFixed(2)}</strong>
          </div>
          <div className="debug-row">
            <span>shot spin</span>
            <strong>{displayHud.spin.toFixed(2)}</strong>
          </div>
          <div className="debug-row">
            <span>wind</span>
            <strong>
              {displayHud.wind.speed.toFixed(1)} @ {displayHud.wind.directionDeg.toFixed(0)}
            </strong>
          </div>
          <div className="debug-row">
            <span>club</span>
            <strong>{selectedClub.name}</strong>
          </div>
          <div className="debug-row">
            <span>last key</span>
            <strong>{lastControlKey || hud.swing.lastKey || "-"}</strong>
          </div>
          <div className="debug-row">
            <span>aim</span>
            <strong>{hud.aimDegrees.toFixed(1)} deg</strong>
          </div>
          <div className="debug-row">
            <span>surface</span>
            <strong>{hud.surface}</strong>
          </div>
        </section>
      ) : null}
      {toasts.map((toast, index) => (
        <div className="floating-toast" key={toast.id} style={{ left: `${50 + index * 6}%`, top: `${42 - index * 5}%` }}>
          {toast.text}
        </div>
      ))}
      {!started ? (
        <section className="start-screen" aria-label="Start game">
          <div className="start-card">
            <h1>Scroll Tee</h1>
            <p>Trackball golf for the mouse wheel era. Scroll down to pull back, then scroll up fast to rip it.</p>
            <div className="start-actions">
              <button className="ui-button primary" onClick={() => setStarted(true)} type="button">
                Start Round
              </button>
              <button className="ui-button" onClick={() => setSettingsOpen(true)} type="button">
                Tune Swing
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {started && paused ? (
        <section className="pause-screen" aria-label="Paused">
          <div className="start-card">
            <h1>Paused</h1>
            <p>The ball is safe. The boss is still suspicious.</p>
            <div className="start-actions">
              <button className="ui-button primary" onClick={() => setPaused(false)} type="button">
                Resume
              </button>
              <button className="ui-button" onClick={onRestartHole} type="button">
                Restart Hole
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {displayHud.holed && !displayHud.roundComplete ? (
        <section className="panel complete-card" aria-label="Hole complete">
          <h2>{completionText(displayHud.strokes, displayHud.par)}</h2>
          <p>
            Hole {displayHud.holeNumber} finished in {displayHud.strokes} on a par {displayHud.par}. Round total:{" "}
            {displayHud.totalStrokes} ({formatScoreDiff(displayHud.roundScore)}).
          </p>
          <div className="start-actions">
            <button className="ui-button primary" onClick={onNextHole} type="button">
              Next Hole
            </button>
            <button className="ui-button" onClick={onRestartHole} type="button">
              Restart Hole
            </button>
            <button className="ui-button" onClick={onRestartRound} type="button">
              Restart Round
            </button>
          </div>
        </section>
      ) : null}
      {displayHud.roundComplete ? (
        <section className="panel complete-card round-card" aria-label="Round complete">
          <h2>Round Complete</h2>
          <p>
            Final score: {displayHud.totalStrokes} strokes, {formatScoreDiff(displayHud.roundScore)} to par.
          </p>
          <div className="final-scorecard">
            {HOLES.map((hole, index) => (
              <div className="scorecard-cell" key={hole.holeNumber}>
                <small>
                  {hole.holeNumber} / P{hole.par}
                </small>
                <strong>{holeScores[index] ?? "-"}</strong>
              </div>
            ))}
          </div>
          <button className="ui-button primary" onClick={onRestartRound} type="button">
            Restart Round
          </button>
        </section>
      ) : null}
    </main>
  );
}
