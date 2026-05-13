# Scroll Tee

Scroll Tee is an original browser arcade golf game built with Next.js, TypeScript, and Three.js. It uses mouse wheel and touchpad scroll input as a virtual trackball: scroll down to pull back, then scroll up fast to strike.

The game is an 18-hole arcade round with procedural lightweight course geometry, an expanded club bag, shot types, wind, pre-shot spin and lineup controls, flagstick interaction, scorecard flow, fairway boost strips, shot trails, cup bursts, wind streamers, visible club-head changes, and soft-lock guards around ball physics.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

Production checks:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

## Controls

- Scroll down: backswing
- Scroll up fast: downswing and strike
- S then W: keyboard swing fallback
- Horizontal scroll or Shift + wheel: curve/spin during swing
- Q / E during swing: fallback curve controls
- Mouse drag left/right: aim
- A / D: aim
- Left / Right arrows: open or close stance for draw/fade
- Up / Down arrows: ball forward/back in stance for higher carry or lower rollout
- Z / PageUp: add backspin
- X / PageDown: add topspin
- N / P / F / V: normal, punch, flop, chip
- 1-9, 0, -, =, \\, /: direct club selection through the bag
- [ / ]: cycle clubs
- R: restart hole
- C: cycle camera
- Esc: pause

## Club Bag

Driver, 3 Wood, 5 Wood, 3 Iron, 4 Iron, 5 Iron, 6 Iron, 7 Iron, 8 Iron, 9 Iron, Pitching Wedge, Sand Wedge, Lob Wedge, and Putter.

Auto-club selection runs after each stopped shot based on distance and lie, but manual selection always overrides it before the next swing. The club beside the ball changes head shape as you move between woods, irons, wedges, and the putter.

## Shot Types

- Normal: balanced arcade flight
- Punch: lower launch, more rollout
- Flop: high launch, shorter carry, soft landing
- Chip: short carry with controlled rollout
- Putt: automatic when the putter is selected

The lineup panel shows carry, roll, and total estimates for the selected club, lie, shot type, stance, spin, and current wind.

## Course Balance

The round stays at 18 holes and par 72: four par 3s, ten par 4s, and four par 5s. Par 3s still leave ace chances alive, a few short par 4s can be attacked, and most par 4s now ask for a drive plus approach. Par 5s are longer with wider landing zones, shortcut guards, and boost-strip risk lines so eagle is available with two great shots but routine par 5 hole-in-ones are out.

## Wind and Spin

Each hole has readable arcade wind with slight per-shot variation. Wind only affects airborne shots: flops and high approaches move more, normal shots move a moderate amount, punch shots cut through it, and putts ignore it.

Backspin shortens carry a little, increases stopping power, bites harder on greens, and can zip wedges back. Topspin lowers the flight tendency and adds rollout, especially on drives, punch shots, and running approaches.

Shot trails now change color and sparkle by shot type and spin. Wind streamers and a small floating wind arrow show the current wind direction over the course, boost strips pulse on the turf, landings throw a quick procedural impact ring, and holed shots trigger a lightweight procedural ring and particle burst.

## Code Map

- `lib/game/holes.ts`: 18-hole course data
- `lib/game/course.ts`: terrain, lie detection, surfaces, friction, cup constants
- `lib/game/clubs.ts`: club bag, shot type tuning, estimates, auto-club selection
- `lib/game/wind.ts`: wind labels, per-shot wind, wind vectors, and estimate helpers
- `lib/game/input.ts`: wheel/touchpad/keyboard swing input
- `lib/game/physics.ts`: ball launch, flight, bounce, roll, and soft-lock guards
- `lib/game/scoring.ts`: shot feedback and score text
- `components/GolfScene.tsx`: Three.js rendering and frame loop
- `components/GameShell.tsx`: round state, settings, scorecard flow
- `components/HUD.tsx`: score HUD, lineup controls, action controls
- `components/ClubSelector.tsx`: compact club bag UI

## Notes

- All visuals are procedural geometry and CSS; there are no external art or sound assets.
- Physics are tuned for arcade feel rather than simulation accuracy.
- Ball flight includes defensive guards for invalid state, tiny jitter, long rolls, lip-outs, and out-of-bounds movement so controls always return.
