// Canyon Courier — the supply drop. A crate released from the plane keeps
// the plane's forward speed and falls under gravity while the canyon wind
// shoves it sideways, so the drop is a judgement call: release early, let
// the wind carry it, watch the canopy. The module is pure state — the
// renderer draws the crate and the target, the world decides when it lands.

import { WORLD } from './config.js';

const GRAVITY_FTPS2 = 32.2; // feet per second squared
const CANOPY_DRAG = 0.3; // the parachute's drag on the fall, per second
const TERMINAL_FALL = 45; // feet per second under a full canopy
const WIND_FACTOR = 0.15; // the crate is heavy: the wind moves it far less than it moves the plane

/** A fresh crate at the plane's position, keeping its forward speed. */
export function releaseCrate(plane) {
  return {
    x: plane.x, // valley units
    y: plane.y, // feet above the floor
    z: plane.z, // metres down the canyon
    forwardMs: plane.speed * 0.514444, // knots to metres per second
    fallFts: 0, // vertical speed, feet per second, grows as it falls
    landed: false,
    missFeet: null,
  };
}

/**
 * Advance the crate one step. The wind gust is the same sine the plane
 * feels, so a pilot who learned the canyon can read the drift. Returns
 * 'landed' the step the crate touches the ground, '' otherwise.
 */
export function stepCrate(crate, dt, terrain, wind) {
  if (crate.landed) return 'landed';
  const gust = wind ? Math.sin(crate.z * 0.011) * WORLD.gustStrength : 0;
  crate.x += gust * dt * WIND_FACTOR;
  crate.z += crate.forwardMs * dt;
  crate.forwardMs = Math.max(0, crate.forwardMs - 0.4 * dt);
  crate.fallFts = Math.min(TERMINAL_FALL, crate.fallFts + GRAVITY_FTPS2 * dt * (1 - CANOPY_DRAG));
  crate.y -= crate.fallFts * dt;
  const ground = terrain.heightAt(crate.x, crate.z);
  if (crate.y <= ground + 3) {
    crate.y = ground + 3;
    crate.landed = true;
    return 'landed';
  }
  return '';
}

/** Feet from the crate to the centre of the painted target circle. */
export function dropMissFeet(crate, target) {
  const dx = (crate.x - target.x) * WORLD.lateralFeet;
  const dz = (crate.z - target.z) * 3.28084;
  return Math.sqrt(dx * dx + dz * dz);
}
