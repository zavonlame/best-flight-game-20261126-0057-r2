# Canyon Courier — Make the best flight game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zavonlame/best-flight-game-20261126-0057-r2/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zavonlame/best-flight-game-20261126-0057-r2/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush-pilot courier run through a desert canyon, built for the
[make.fun best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057).
An AI judge compares the games two at a time by their screenshots and an
outline of their source; the 50 best share $500.

## The game

You fly a single-prop courier plane down a seeded desert canyon. Four
sorties, each with a different goal:

1. **Ring Run** — twelve glowing rings down the canyon; smooth lines beat
   fast hands.
2. **Canyon Slalom** — fourteen gates on alternating walls, with gusts that
   shove you sideways.
3. **Dusty Landing** — six rings, then put her down soft on a short desert
   strip; the touchdown is scored on centreline and softness.
4. **Supply Drop** — four rings, then a crate under a canopy: release it
   ~400 m short of the painted circle and let its forward speed carry it
   in. Bullseye +600, inside the circle +300, and the wind pushes the
   crate sideways, so watch it drift.

Throttle discipline matters: the wing stalls below 62 knots, fuel drains
with the lever, and the canyon walls scrape. Score is rings flown plus the
time and fuel left at the end, plus landing marks where a landing is the
goal — every number is shown on the end screen so the arithmetic checks.

Press **C** any time to climb into the cockpit: four live round gauges
(airspeed, attitude, altimeter, compass) plus throttle, fuel and damage
bars, with the canyon ahead through the windshield struts.

## Controls

- **A / D** or **← / →** — bank
- **↑ / ↓** — pitch
- **W / S** — throttle
- **Mouse** — steer gently · **wheel** — throttle nudge
- **Space** — brake · **C** — cockpit view · **F** — drop the crate
  (Supply Drop only) · **P** — pause · **R** — fly again
  · **1 / 2 / 3 / 4** — sortie

## Play it

The game is plain static files under `game/` — no build step, no network
request, all sound synthesised with WebAudio:

```sh
node serve.ts
# open http://localhost:8080 in a desktop browser
```

Screenshots are deterministic renders of the game's own code:
`?shot=cover|cockpit|drop|landing&seed=7` stages each scene with the
autopilot and draws it once.

## Hand it in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the canvas shell
- `game/src/config.js` — every tuning number in one place
- `game/src/random.js` — the seeded generator behind the canyon
- `game/src/terrain.js` — canyon heightfield, river, ring course, runway
- `game/src/plane.js` — the flight model
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, wind, ring chime
- `game/src/missions.js` — sorties and scoring
- `game/src/world.js` — the sortie state machine
- `game/src/render.js` — pseudo-3D chase view, cockpit view, HUD and instruments
- `game/src/cockpit.js` — the cockpit dashboard and its four live gauges
- `game/src/drop.js` — the supply crate: canopy, fall, wind drift, scoring
- `game/src/shots.js` — deterministic screenshot scenes and the autopilot
- `game/src/main.js` — boot and the frame loop
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — four real renders of the game (the first is the cover)

Built by an AI agent for make.fun — a bounty entry by
[@zavon-lame](https://github.com/zavonlame). Original idea, art, sounds and
names; no commercial game was copied.
