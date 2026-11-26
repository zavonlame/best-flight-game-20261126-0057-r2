// Canyon Courier — screenshot scenes. Each shot plays the real rules forward
// from a fresh sortie for a fixed number of seconds, steered by an
// autopilot that chases the next ring (or the runway), so the frame is what
// a short game really looks like and the same seed always gives the same
// frame. No scene is posed by hand: the world steps, the pilot reacts.

import { SHOTS } from './config.js';
import { newWorld, stepWorld, nextRing, SCREEN_PLAY } from './world.js';
import { listMissions } from './missions.js';

const STEP = 1 / 60;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The autopilot's stick for one frame: bank toward the next ring's line,
 * pitch toward its height, throttle to hold the target speed. On a landing
 * sortie with no rings left it lines up on the runway and descends gently.
 * On a drop sortie with no rings left it lines up on the target and
 * releases the crate about 600 m short, letting the wind carry it in.
 */
function autopilotInput(world) {
  const plane = world.plane;
  const ring = nextRing(world);
  let targetX = 0;
  let targetY = 240;
  let targetSpeed = 125;
  let drop = false;
  if (ring) {
    targetX = ring.x;
    targetY = ring.y;
  } else if (world.mission.landing) {
    const landing = landingTarget(world);
    targetX = landing.x;
    targetY = landing.y;
    targetSpeed = landing.speed;
  } else if (world.mission.drop) {
    const target = world.terrain.dropTarget;
    targetX = target.x;
    targetY = 240;
    targetSpeed = 125;
    // Release ~400 m short of the circle: the crate keeps the plane's
    // forward speed for the six seconds it takes to fall.
    const dist = target.z - plane.z;
    if (dist > 0 && dist < 400 && Math.abs(plane.x - target.x) < 0.05) {
      drop = true;
    }
  }
  const bank = clamp((targetX - plane.x) * 3.5, -1, 1);
  const pitch = clamp((targetY - plane.y) / 90, -1, 1);
  const throttle = plane.speed < targetSpeed - 4 ? 1 : plane.speed > targetSpeed + 4 ? -1 : 0;
  return { bank, pitch, throttle, brake: false, pause: false, confirm: false, cockpit: false, drop, anyKey: false };
}

/**
 * The landing profile: hold altitude until the strip is close, then descend
 * onto it. A pilot who starts down two kilometres out arrives over the
 * threshold still sinking and floats past the far end.
 */
function landingTarget(world) {
  const plane = world.plane;
  const runway = world.terrain.runway;
  const distToStrip = runway.zStart - plane.z;
  const ground = world.terrain.heightAt(plane.x, plane.z);
  if (distToStrip > 500) return { x: 0, y: 130, speed: 100 };
  if (distToStrip > 150) return { x: 0, y: ground + 30, speed: 88 };
  return { x: 0, y: ground + 4, speed: 80 };
}

/**
 * Stage the named shot and return the world to draw. `name` is one of
 * cover, cockpit, drop, landing (any other name is cover). A shot may name
 * a view: the cockpit shot flies the same sortie from inside the plane.
 */
export function stageShot(name, seed) {
  const def = SHOTS[name] || SHOTS.cover;
  const missions = listMissions();
  const world = newWorld(seed, missions[def.mission], def.mission);
  world.screen = SCREEN_PLAY;
  if (def.view) world.view = def.view;
  const steps = Math.round(def.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, autopilotInput(world), STEP);
    if (world.screen !== SCREEN_PLAY) break;
  }
  return world;
}

/** The shot definitions, for the screenshot runner and the dossier. */
export function listShots() {
  return Object.entries(SHOTS).map(([name, def]) => ({
    name,
    file: `${name}.jpg`,
    mission: listMissions()[def.mission].id,
    seconds: def.seconds,
    seed: def.seed,
  }));
}
