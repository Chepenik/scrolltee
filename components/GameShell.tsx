"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { HUD } from "@/components/HUD";
import { CLUB_BY_ID, clubIdForKey, effectiveShotType, nextClubId } from "@/lib/game/clubs";
import { BALL_RADIUS, holeDistance, surfaceAt, terrainHeightAt } from "@/lib/game/course";
import { FIRST_HOLE, HOLES } from "@/lib/game/holes";
import { createEmptySwingDebug } from "@/lib/game/input";
import { completionText } from "@/lib/game/scoring";
import { windForShot } from "@/lib/game/wind";
import type {
  ClubId,
  GameSettings,
  HudSnapshot,
  PlayerProfile,
  PlayerScoreSummary,
  PlayerTurnState,
  ShotSetup,
  ShotType
} from "@/lib/game/types";
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

const PLAYER_PRESETS: PlayerProfile[] = [
  { id: "p1", name: "Player 1", color: "#6ff3a8" },
  { id: "p2", name: "Player 2", color: "#69d2ff" },
  { id: "p3", name: "Player 3", color: "#ffd166" },
  { id: "p4", name: "Player 4", color: "#ff795d" }
];

type PlayerScores = Record<string, Array<number | null>>;

type RoundState = {
  players: PlayerProfile[];
  playerScores: PlayerScores;
  turnStates: Record<string, PlayerTurnState>;
  activePlayerIndex: number;
  turnToken: number;
};

type PlayerColorStyle = CSSProperties & {
  "--player-color"?: string;
};

function formatScoreDiff(diff: number) {
  if (diff === 0) {
    return "E";
  }
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function colorStyle(color: string): PlayerColorStyle {
  return { "--player-color": color };
}

function createDefaultHud(hole = FIRST_HOLE): HudSnapshot {
  return {
    playerId: "p1",
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

function createPlayerScores(players: PlayerProfile[]): PlayerScores {
  const scores: PlayerScores = {};
  for (const player of players) {
    scores[player.id] = Array<number | null>(HOLES.length).fill(null);
  }
  return scores;
}

function createInitialTurnState(playerId: string, hole = FIRST_HOLE): PlayerTurnState {
  const x = hole.teePosition.x;
  const z = hole.teePosition.z;

  return {
    playerId,
    holeNumber: hole.holeNumber,
    strokes: 0,
    holed: false,
    position: [x, terrainHeightAt(x, z, hole) + BALL_RADIUS, z],
    surface: surfaceAt(x, z, hole),
    aimAngle: Math.atan2(hole.cupPosition.x - x, hole.cupPosition.z - z),
    shotResult: "READY TO RIP"
  };
}

function createTurnStates(players: PlayerProfile[], hole = FIRST_HOLE) {
  const states: Record<string, PlayerTurnState> = {};
  for (const player of players) {
    states[player.id] = createInitialTurnState(player.id, hole);
  }
  return states;
}

function createRoundState(playerCount: number, hole = FIRST_HOLE): RoundState {
  const players = PLAYER_PRESETS.slice(0, Math.max(1, Math.min(4, playerCount)));

  return {
    players,
    playerScores: createPlayerScores(players),
    turnStates: createTurnStates(players, hole),
    activePlayerIndex: 0,
    turnToken: 0
  };
}

function scoreRowsWithResetHole(current: RoundState, holeIndex: number) {
  const playerScores: PlayerScores = {};
  for (const player of current.players) {
    const row = [...(current.playerScores[player.id] ?? Array<number | null>(HOLES.length).fill(null))];
    row[holeIndex] = null;
    playerScores[player.id] = row;
  }
  return playerScores;
}

function findNextUnfinishedPlayerIndex(players: PlayerProfile[], startIndex: number, playerScores: PlayerScores, holeIndex: number) {
  if (players.length <= 0) {
    return 0;
  }

  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (startIndex + offset) % players.length;
    const player = players[index];
    if (player && playerScores[player.id]?.[holeIndex] === null) {
      return index;
    }
  }

  return Math.max(0, Math.min(startIndex, players.length - 1));
}

export function GameShell() {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [setupPlayerCount, setSetupPlayerCount] = useState(1);
  const [roundState, setRoundState] = useState<RoundState>(() => createRoundState(1));
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
  const players = roundState.players;
  const activePlayer = players[roundState.activePlayerIndex] ?? players[0] ?? PLAYER_PRESETS[0];
  const activeTurnState = roundState.turnStates[activePlayer.id] ?? createInitialTurnState(activePlayer.id, currentHole);
  const activeScores = roundState.playerScores[activePlayer.id] ?? Array<number | null>(HOLES.length).fill(null);
  const multiplayer = players.length > 1;
  const holeComplete = players.every((player) => roundState.playerScores[player.id]?.[currentHoleIndex] !== null);
  const roundComplete = players.every((player) => (roundState.playerScores[player.id] ?? []).every((score) => score !== null));
  const activeCompletedHoles = activeScores.reduce<number>(
    (count, score, index) => (index !== currentHoleIndex && score !== null ? count + 1 : count),
    0
  );
  const activeCompletedStrokes = activeScores.reduce<number>((total, score, index) => {
    if (index === currentHoleIndex) {
      return total;
    }
    return total + (score ?? 0);
  }, 0);
  const activeCompletedPar = activeScores.reduce<number>((total, score, index) => {
    if (index === currentHoleIndex) {
      return total;
    }
    return total + (score === null ? 0 : (HOLES[index]?.par ?? 0));
  }, 0);

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

  const startConfiguredRound = useCallback(() => {
    setStarted(true);
    setPaused(false);
    setCurrentHoleIndex(0);
    setRoundState(createRoundState(setupPlayerCount, FIRST_HOLE));
    setShotSetup(DEFAULT_SHOT_SETUP);
    setHud(createDefaultHud(FIRST_HOLE));
    setRestartToken((value) => value + 1);
    lastShotResultRef.current = "READY TO RIP";
  }, [setupPlayerCount]);

  const onRestartHole = useCallback(() => {
    setStarted(true);
    setPaused(false);
    setRoundState((current) => ({
      ...current,
      playerScores: scoreRowsWithResetHole(current, currentHoleIndex),
      turnStates: createTurnStates(current.players, currentHole),
      activePlayerIndex: 0,
      turnToken: current.turnToken + 1
    }));
    setShotSetup(DEFAULT_SHOT_SETUP);
    setHud(createDefaultHud(currentHole));
    setRestartToken((value) => value + 1);
    lastShotResultRef.current = "READY TO RIP";
  }, [currentHole, currentHoleIndex]);

  const onRestartRound = useCallback(() => {
    const playerCount = Math.max(1, players.length || setupPlayerCount);
    setStarted(true);
    setPaused(false);
    setCurrentHoleIndex(0);
    setSetupPlayerCount(playerCount);
    setRoundState(createRoundState(playerCount, FIRST_HOLE));
    setShotSetup(DEFAULT_SHOT_SETUP);
    setHud(createDefaultHud(FIRST_HOLE));
    setRestartToken((value) => value + 1);
    lastShotResultRef.current = "READY TO RIP";
  }, [players.length, setupPlayerCount]);

  const onNextHole = useCallback(() => {
    if (!holeComplete || roundComplete || currentHoleIndex >= HOLES.length - 1) {
      return;
    }

    const nextHoleIndex = Math.min(HOLES.length - 1, currentHoleIndex + 1);
    const nextHole = HOLES[nextHoleIndex] ?? FIRST_HOLE;
    setStarted(true);
    setPaused(false);
    setCurrentHoleIndex(nextHoleIndex);
    setRoundState((current) => ({
      ...current,
      turnStates: createTurnStates(current.players, nextHole),
      activePlayerIndex: 0,
      turnToken: current.turnToken + 1
    }));
    setShotSetup(DEFAULT_SHOT_SETUP);
    setHud(createDefaultHud(nextHole));
    lastShotResultRef.current = "READY TO RIP";
  }, [currentHoleIndex, holeComplete, roundComplete]);

  const onCameraToggle = useCallback(() => {
    setCameraToken((value) => value + 1);
  }, []);

  const updateSetting = useCallback(<K extends keyof GameSettings,>(key: K, value: GameSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const handleClubSelect = useCallback(
    (clubId: ClubId) => {
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
    },
    [shotSetup.shotType]
  );

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

  const handleTurnStateChange = useCallback(
    (turnState: PlayerTurnState) => {
      if (turnState.holeNumber !== currentHole.holeNumber) {
        return;
      }

      setRoundState((current) => {
        if (!current.players.some((player) => player.id === turnState.playerId)) {
          return current;
        }

        return {
          ...current,
          turnStates: {
            ...current.turnStates,
            [turnState.playerId]: turnState
          }
        };
      });
    },
    [currentHole.holeNumber]
  );

  const handleTurnComplete = useCallback(
    (turnState: PlayerTurnState) => {
      if (turnState.holeNumber !== currentHole.holeNumber) {
        return;
      }

      setRoundState((current) => {
        const completedPlayerIndex = current.players.findIndex((player) => player.id === turnState.playerId);
        if (completedPlayerIndex === -1 || completedPlayerIndex !== current.activePlayerIndex) {
          return current;
        }

        const playerScores: PlayerScores = { ...current.playerScores };
        const currentRow = [...(playerScores[turnState.playerId] ?? Array<number | null>(HOLES.length).fill(null))];
        if (turnState.holed && currentRow[currentHoleIndex] === null) {
          currentRow[currentHoleIndex] = turnState.strokes;
        }
        playerScores[turnState.playerId] = currentRow;

        const activePlayerIndex = findNextUnfinishedPlayerIndex(current.players, completedPlayerIndex, playerScores, currentHoleIndex);
        const turnStates = {
          ...current.turnStates,
          [turnState.playerId]: turnState
        };

        return {
          ...current,
          playerScores,
          turnStates,
          activePlayerIndex,
          turnToken: activePlayerIndex === current.activePlayerIndex ? current.turnToken : current.turnToken + 1
        };
      });
    },
    [currentHole.holeNumber, currentHoleIndex]
  );

  const playerSummaries = useMemo<PlayerScoreSummary[]>(() => {
    return players.map((player) => {
      const scores = roundState.playerScores[player.id] ?? Array<number | null>(HOLES.length).fill(null);
      const turnState = roundState.turnStates[player.id] ?? createInitialTurnState(player.id, currentHole);
      const isActive = player.id === activePlayer.id;
      const hudBelongsToPlayer = isActive && hud.holeNumber === currentHole.holeNumber && hud.playerId === player.id;
      const recordedCurrentScore = scores[currentHoleIndex];
      const currentHoleStrokes = recordedCurrentScore ?? (hudBelongsToPlayer ? hud.strokes : turnState.strokes);
      const playerHoled = recordedCurrentScore !== null || turnState.holed || (hudBelongsToPlayer && hud.holed);
      const includeCurrentHole = recordedCurrentScore !== null || playerHoled;
      const completedStrokesOutsideCurrent = scores.reduce<number>((total, score, index) => {
        if (index === currentHoleIndex) {
          return total;
        }
        return total + (score ?? 0);
      }, 0);
      const completedParOutsideCurrent = scores.reduce<number>((total, score, index) => {
        if (index === currentHoleIndex) {
          return total;
        }
        return total + (score === null ? 0 : (HOLES[index]?.par ?? 0));
      }, 0);
      const scoreStrokes = completedStrokesOutsideCurrent + (includeCurrentHole ? currentHoleStrokes : 0);
      const scorePar = completedParOutsideCurrent + (includeCurrentHole ? currentHole.par : 0);
      const completedHoles =
        scores.filter((score) => score !== null).length + (recordedCurrentScore === null && playerHoled ? 1 : 0);
      const status: PlayerScoreSummary["status"] =
        isActive && !playerHoled ? "On turn" : playerHoled ? "Holed" : currentHoleStrokes > 0 ? "Waiting" : "Ready";

      return {
        ...player,
        active: isActive,
        currentHoleStrokes,
        completedHoles,
        holeScores: scores,
        totalStrokes: completedStrokesOutsideCurrent + currentHoleStrokes,
        totalPar: completedParOutsideCurrent + (includeCurrentHole ? currentHole.par : 0),
        roundScore: scorePar > 0 ? scoreStrokes - scorePar : 0,
        holed: playerHoled,
        status
      };
    });
  }, [activePlayer.id, currentHole, currentHoleIndex, hud, players, roundState.playerScores, roundState.turnStates]);

  const rankedPlayerSummaries = useMemo(() => {
    return [...playerSummaries].sort((a, b) => a.roundScore - b.roundScore || a.totalStrokes - b.totalStrokes || a.id.localeCompare(b.id));
  }, [playerSummaries]);

  const activePlayerSummary = playerSummaries.find((player) => player.id === activePlayer.id) ?? playerSummaries[0];
  const active = started && !paused && !roundComplete;
  const selectedClub = CLUB_BY_ID[selectedClubId] ?? CLUB_BY_ID.driver;
  const displayHud = useMemo(() => {
    const hudBelongsToCurrentHole = hud.holeNumber === currentHole.holeNumber && hud.playerId === activePlayer.id;
    const displayHoled = activePlayerSummary?.holed ?? (hudBelongsToCurrentHole && hud.holed);
    const recordedCurrentScore = activeScores[currentHoleIndex];
    const currentHoleScore = recordedCurrentScore ?? (hudBelongsToCurrentHole ? hud.strokes : activeTurnState.strokes);
    const includeCurrentHole = recordedCurrentScore !== null || displayHoled;
    const completedStrokesOutsideCurrent = activeScores.reduce<number>((total, score, index) => {
      if (index === currentHoleIndex) {
        return total;
      }
      return total + (score ?? 0);
    }, 0);
    const completedParOutsideCurrent = activeScores.reduce<number>((total, score, index) => {
      if (index === currentHoleIndex) {
        return total;
      }
      return total + (score === null ? 0 : (HOLES[index]?.par ?? 0));
    }, 0);
    const displayTotalStrokes = completedStrokesOutsideCurrent + currentHoleScore;
    const displayTotalPar = completedParOutsideCurrent + (includeCurrentHole ? currentHole.par : 0);
    const scoreStrokes = completedStrokesOutsideCurrent + (includeCurrentHole ? currentHoleScore : 0);
    const scorePar = completedParOutsideCurrent + (includeCurrentHole ? currentHole.par : 0);
    const displayCompletedHoles = activeCompletedHoles + (recordedCurrentScore === null && displayHoled ? 1 : 0);
    const fallbackWind = windForShot(currentHole, activeTurnState.strokes + 1);
    const fallbackDistance = activeTurnState.holed
      ? 0
      : holeDistance({
          ...currentHole,
          teePosition: {
            x: activeTurnState.position[0],
            z: activeTurnState.position[2]
          }
        });

    return {
      ...hud,
      playerId: activePlayer.id,
      phase: hudBelongsToCurrentHole ? hud.phase : activeTurnState.holed ? "HOLED" : "IDLE",
      holeNumber: currentHole.holeNumber,
      holeCount: HOLES.length,
      holeName: currentHole.name,
      par: currentHole.par,
      strokes: currentHoleScore,
      distanceToPin: hudBelongsToCurrentHole ? hud.distanceToPin : fallbackDistance,
      shotResult: hudBelongsToCurrentHole ? hud.shotResult : activeTurnState.shotResult,
      surface: hudBelongsToCurrentHole ? hud.surface : activeTurnState.surface,
      ballSpeed: hudBelongsToCurrentHole ? hud.ballSpeed : 0,
      shotType: effectiveShotType(selectedClubId, shotSetup.shotType),
      stanceOffset: shotSetup.stanceOffset,
      ballForward: shotSetup.ballForward,
      spin: shotSetup.spin,
      wind: hudBelongsToCurrentHole ? hud.wind : fallbackWind,
      totalStrokes: displayTotalStrokes,
      totalPar: displayTotalPar,
      roundScore: scorePar > 0 ? scoreStrokes - scorePar : 0,
      aimDegrees: hudBelongsToCurrentHole ? hud.aimDegrees : (activeTurnState.aimAngle * 180) / Math.PI,
      holed: displayHoled,
      completedHoles: roundComplete ? HOLES.length : displayCompletedHoles,
      roundComplete
    };
  }, [
    activeCompletedHoles,
    activePlayer.id,
    activePlayerSummary?.holed,
    activeScores,
    activeTurnState.aimAngle,
    activeTurnState.holed,
    activeTurnState.position,
    activeTurnState.shotResult,
    activeTurnState.strokes,
    activeTurnState.surface,
    currentHole,
    currentHoleIndex,
    hud,
    roundComplete,
    selectedClubId,
    shotSetup
  ]);

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
        activePlayer={activePlayer}
        cameraToken={cameraToken}
        completedHoles={activeCompletedHoles}
        completedPar={activeCompletedPar}
        completedStrokes={activeCompletedStrokes}
        hole={currentHole}
        onClubChange={handleClubSelect}
        onControlKey={setLastControlKey}
        onHudUpdate={handleHudUpdate}
        onPauseToggle={() => setPaused((value) => !value)}
        onRestartHole={onRestartHole}
        onTurnComplete={handleTurnComplete}
        onTurnStateChange={handleTurnStateChange}
        roundComplete={roundComplete}
        restartToken={restartToken}
        shotSetup={shotSetup}
        selectedClubId={selectedClubId}
        settings={settings}
        turnState={activeTurnState}
        turnToken={roundState.turnToken}
      />
      <HUD
        activePlayer={activePlayer}
        canAdvanceHole={holeComplete && !roundComplete}
        hud={{ ...displayHud, clubId: selectedClub.id }}
        multiplayer={multiplayer}
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
        playerSummaries={playerSummaries}
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
          <div className="debug-row">
            <span>player</span>
            <strong>{activePlayer.name}</strong>
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
            <div className="round-setup" aria-label="Round setup">
              <span>Players</span>
              <div className="player-count-row">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    aria-pressed={setupPlayerCount === count}
                    className={`player-count-button ${setupPlayerCount === count ? "is-active" : ""}`}
                    key={count}
                    onClick={() => setSetupPlayerCount(count)}
                    type="button"
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <div className="setup-player-preview" aria-label="Player colors">
              {PLAYER_PRESETS.slice(0, setupPlayerCount).map((player) => (
                <span className="setup-player-dot" key={player.id} style={colorStyle(player.color)}>
                  {player.name}
                </span>
              ))}
            </div>
            <div className="start-actions">
              <button className="ui-button primary" onClick={startConfiguredRound} type="button">
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
      {holeComplete && !displayHud.roundComplete ? (
        <section className="panel complete-card" aria-label="Hole complete">
          <h2>{multiplayer ? `Hole ${displayHud.holeNumber} Complete` : completionText(displayHud.strokes, displayHud.par)}</h2>
          <p>
            {multiplayer
              ? `All players finished the par ${displayHud.par}. Leader: ${rankedPlayerSummaries[0]?.name ?? activePlayer.name} (${formatScoreDiff(
                  rankedPlayerSummaries[0]?.roundScore ?? 0
                )}).`
              : `Hole ${displayHud.holeNumber} finished in ${displayHud.strokes} on a par ${displayHud.par}. Round total: ${
                  displayHud.totalStrokes
                } (${formatScoreDiff(displayHud.roundScore)}).`}
          </p>
          <div className="hole-results">
            {playerSummaries.map((player) => (
              <div className="hole-result-row" key={player.id} style={colorStyle(player.color)}>
                <span>{player.name}</span>
                <strong>{player.holeScores[currentHoleIndex] ?? "-"}</strong>
                <em>{formatScoreDiff(player.roundScore)}</em>
              </div>
            ))}
          </div>
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
            Winner: {rankedPlayerSummaries[0]?.name ?? activePlayer.name}. Final score{" "}
            {rankedPlayerSummaries[0]?.totalStrokes ?? displayHud.totalStrokes} strokes,{" "}
            {formatScoreDiff(rankedPlayerSummaries[0]?.roundScore ?? displayHud.roundScore)} to par.
          </p>
          <div className="round-scorecard" role="table" aria-label="Final scorecard">
            <div className="round-scorecard-header" role="row">
              <strong>Player</strong>
              {HOLES.map((hole) => (
                <span key={hole.holeNumber}>{hole.holeNumber}</span>
              ))}
              <strong>Total</strong>
              <strong>Par</strong>
            </div>
            {rankedPlayerSummaries.map((player) => (
              <div className="round-scorecard-row" key={player.id} role="row" style={colorStyle(player.color)}>
                <strong>{player.name}</strong>
                {HOLES.map((hole, index) => (
                  <span key={hole.holeNumber}>{player.holeScores[index] ?? "-"}</span>
                ))}
                <strong>{player.totalStrokes}</strong>
                <strong>{formatScoreDiff(player.roundScore)}</strong>
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
