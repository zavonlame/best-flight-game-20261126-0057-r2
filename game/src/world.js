// Canyon Courier — the world: one sortie's state machine. It owns the plane,
// the canyon, the rings and the score sheet, and steps them together. The
// renderer only reads this; the input only steers it.

import { WORLD } from './config.js';
import { buildTerrain, insideRing } from './terrain.js';
import { newPlane, stepPlane } from './plane.js';
import { releaseCrate, stepCrate, dropMissFeet } from './drop.js';
import { newScoreSheet, awardRing, missRing, awardLanding, awardDrop, closeScoreSheet, listMissions } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

/** A fresh sortie: mission `index` of the mission list, from `seed`. */
export function newWorld(seed, mission, missionIndex) {
  const terrain = buildTerrain(seed, mission);
  return {
    seed,
    mission,
    missionIndex,
    missionList: listMissions(),
    terrain,
    plane: newPlane(),
    sheet: newScoreSheet(mission),
    screen: SCREEN_TITLE,
    timeLeft: mission.timeLimit,
    elapsed: 0,
    view: 'chase', // chase or cockpit; C flips it while flying
    crate: null, // the supply crate, once released on a drop sortie
    crateDropped: false,
    events: [], // one-frame notices: {kind, text} for toasts and sound
    endReason: '',
    best: 0,
    toast: '',
    toastUntil: 0,
  };
}

/** Put a world back at its start line, keeping the same canyon and seed. */
export function resetWorld(world) {
  const fresh = newWorld(world.seed, world.mission, world.missionIndex);
  fresh.best = world.best;
  return fresh;
}

/** The next ring the pilot has not reached yet, or null past the last one. */
export function nextRing(world) {
  for (const ring of world.terrain.rings) {
    if (!ring.passed) return ring;
  }
  return null;
}

/** Metres from the plane to the next ring, or to the runway when none left. */
export function distanceToNext(world) {
  const ring = nextRing(world);
  if (ring) return Math.max(0, ring.z - world.plane.z);
  return Math.max(0, world.terrain.runway.zStart - world.plane.z);
}

/** Step the world one frame. `input` is the polled input state. */
export function stepWorld(world, input, dt) {
  world.events.length = 0;
  if (world.screen === SCREEN_TITLE) {
    // The title screen idles over the canyon: slow level flight, no score.
    world.plane.z += 12 * dt;
    if (world.plane.z > 4000) world.plane.z = 0;
    return;
  }
  if (world.screen !== SCREEN_PLAY) return;

  const plane = world.plane;
  const prevZ = plane.z;

  // C flips between the chase camera and the cockpit, mid-flight.
  if (input.cockpit) {
    world.view = world.view === 'cockpit' ? 'chase' : 'cockpit';
  }

  // F releases the crate on a drop sortie, once, after the rings are flown.
  if (input.drop && world.mission.drop && !world.crateDropped) {
    const ringsLeft = world.terrain.rings.some((r) => !r.passed);
    if (!ringsLeft) {
      world.crate = releaseCrate(plane);
      world.crateDropped = true;
      pushEvent(world, 'drop', 'CRATE AWAY — watch the wind');
    } else {
      pushEvent(world, 'warn', 'FLY THE RINGS FIRST — then drop');
    }
  }

  const event = stepPlane(plane, input, dt, world.terrain, world.mission.wind);
  world.elapsed += dt;
  world.timeLeft = Math.max(0, world.mission.timeLimit - world.elapsed);

  // The crate falls on its own clock while the plane flies on.
  if (world.crate && !world.crate.landed) {
    const landed = stepCrate(world.crate, dt, world.terrain, world.mission.wind);
    if (landed === 'landed') {
      const target = world.terrain.dropTarget;
      const miss = dropMissFeet(world.crate, target);
      const points = awardDrop(world.sheet, miss, target.radiusFeet);
      pushEvent(world, 'drop', points > 0 ? `CRATE DOWN — ${world.sheet.dropDetail.toUpperCase()}` : 'CRATE DOWN — OUTSIDE THE CIRCLE');
      finishWorld(world, 'done', points > 0 ? 'SUPPLY DELIVERED' : 'DROP COMPLETE — THE CRATE MISSED');
      return;
    }
  }

  if (event === 'wall-scrape') {
    pushEvent(world, 'warn', 'WALL SCRAPE — ease off the canyon wall');
  } else if (event === 'ground-strike') {
    pushEvent(world, 'warn', 'HARD HIT — check the damage gauge');
  } else if (event === 'stall') {
    pushEvent(world, 'warn', 'STALL — nose down, throttle up');
  }

  // Rings: the plane crosses a ring's plane when z passes its z. A ring
  // flown through scores; a ring flown past breaks the streak.
  for (const ring of world.terrain.rings) {
    if (ring.passed) continue;
    if (prevZ < ring.z && plane.z >= ring.z) {
      ring.passed = true;
      if (insideRing(ring, plane.x, plane.y)) {
        ring.hit = true;
        const points = awardRing(world.sheet);
        pushEvent(world, 'ring', `RING ${world.sheet.ringsHit}/${world.sheet.ringsTotal}  +${points}`);
      } else {
        missRing(world.sheet);
        pushEvent(world, 'miss', `RING MISSED — streak lost`);
      }
    }
  }

  if (event === 'landed') {
    awardLanding(world.sheet, plane, world.terrain.runway);
    finishWorld(world, 'done', 'TOUCHDOWN — sortie complete');
    return;
  }
  if (event === 'crashed' || plane.damage >= 100) {
    finishWorld(world, 'over', 'CRASHED — the canyon wins this one');
    return;
  }

  // A non-landing sortie ends at the course end; a landing sortie ends
  // only on the strip, so flying past it is a go-around, not a finish.
  // A drop sortie with the crate still in the air flies on past the end
  // until the crate lands — the drop is the sortie.
  const crateFlying = world.crate && !world.crate.landed;
  if (!world.mission.landing && plane.z >= WORLD.courseLength && !crateFlying) {
    finishWorld(world, 'done', 'COURSE COMPLETE');
    return;
  }
  // A drop sortie ends 900 m past the target if the crate never left the
  // plane: the village gets nothing and the sortie is a miss.
  if (world.mission.drop && !world.crateDropped && plane.z > world.terrain.dropTarget.z + 900) {
    finishWorld(world, 'over', 'NO DROP — the crate stayed aboard');
    return;
  }
  if (world.mission.landing && plane.z > WORLD.courseLength + 900 && !plane.landed) {
    finishWorld(world, 'over', 'OVERSHOT — the strip is behind you');
    return;
  }
  if (world.timeLeft <= 0) {
    finishWorld(world, 'over', 'OUT OF TIME');
  }
}

function finishWorld(world, screen, reason) {
  world.screen = screen;
  world.endReason = reason;
  closeScoreSheet(world.sheet, world.timeLeft, world.plane.fuel);
  if (world.sheet.total > world.best) world.best = world.sheet.total;
  pushEvent(world, screen === 'done' ? 'done' : 'over', reason);
}

function pushEvent(world, kind, text) {
  world.events.push({ kind, text });
  world.toast = text;
  world.toastUntil = world.elapsed + 2.4;
}
