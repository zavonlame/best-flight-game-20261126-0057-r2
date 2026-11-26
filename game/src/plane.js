// Canyon Courier — the flight model. An arcade model with real discipline:
// throttle sets speed, bank turns, pitch climbs and dives, speed decides
// whether the wing still flies. Every number comes from config.js.

import { PLANE, WORLD } from './config.js';

/** A fresh plane at the start of a sortie. */
export function newPlane() {
  return {
    x: 0, // lateral position, valley units (-1 west wall, +1 east wall)
    y: 260, // altitude above the valley floor, feet
    z: 0, // distance down the canyon, metres
    speed: 105, // knots
    pitch: 0, // radians, positive climbs
    bank: 0, // radians, positive banks right
    heading: 0, // degrees, 0 is straight down the canyon
    throttle: 0.62,
    fuel: 100,
    damage: 0,
    verticalSpeed: 0,
    stalled: false,
    landed: false,
  };
}

/**
 * Advance the plane one step of `dt` seconds under `input`
 * ({bank: -1..1, pitch: -1..1, throttle: -1..1 delta, brake: bool}) and the
 * canyon `terrain`. Returns an event string or '' when nothing notable
 * happened: 'stall', 'wall-scrape', 'ground-strike', 'landed', 'crashed'.
 */
export function stepPlane(plane, input, dt, terrain, wind) {
  // Throttle: the lever moves with the keys, then speed chases it.
  plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.9, 0, 1);
  const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  const pull = plane.throttle > 0.05 ? PLANE.accel : -PLANE.drag * plane.speed;
  plane.speed += clamp(targetSpeed - plane.speed, -PLANE.drag * plane.speed * dt, pull * dt);
  if (input.brake) plane.speed -= 34 * dt;
  plane.speed = Math.max(0, plane.speed);

  // Bank and pitch answer the stick, then ease back toward level.
  plane.bank = clamp(
    plane.bank + input.bank * PLANE.bankRate * dt,
    -PLANE.maxBank,
    PLANE.maxBank,
  );
  plane.bank *= Math.max(0, 1 - 0.55 * dt);
  plane.pitch = clamp(
    plane.pitch + input.pitch * PLANE.pitchRate * dt,
    -PLANE.maxPitch,
    PLANE.maxPitch,
  );
  plane.pitch *= Math.max(0, 1 - 0.5 * dt);

  // The wing: below minimum speed it stops lifting and the nose drops.
  plane.stalled = plane.speed < PLANE.minSpeed + 4;
  const effectivePitch = plane.stalled ? Math.min(plane.pitch, -0.22) : plane.pitch;

  // Wind gusts shove the plane sideways in slalom sorties.
  const gust = wind ? Math.sin(plane.z * 0.011) * WORLD.gustStrength : 0;

  // Move: forward speed down the canyon, bank turns, pitch climbs.
  const forward = plane.speed * 0.514444 * dt; // knots to metres per second
  plane.z += forward;
  plane.heading = (plane.heading + Math.sin(plane.bank) * 26 * dt * (plane.speed / PLANE.cruiseSpeed) + 360) % 360;
  plane.x += (Math.sin(plane.bank) * PLANE.turnPerBank + gust) * dt * (plane.speed / PLANE.cruiseSpeed);
  plane.x = clamp(plane.x, -0.98, 0.98);
  plane.verticalSpeed = Math.sin(effectivePitch) * PLANE.climbPerPitch * (plane.speed / PLANE.cruiseSpeed);
  plane.y += plane.verticalSpeed * dt;
  // No floor clamp here: the ground check below settles the plane onto the
  // local terrain, whose undulations run below the datum. Clamping to the
  // datum would hover the plane over a dip and never let it land.
  plane.y = Math.max(-60, plane.y);

  // Fuel: the lever drinks; an empty tank leaves only a glide.
  const drain = plane.throttle * WORLD.fuelDrain + WORLD.fuelIdleDrain;
  plane.fuel = Math.max(0, plane.fuel - drain * dt);
  if (plane.fuel <= 0) plane.throttle = Math.min(plane.throttle, 0.12);

  // The walls: scraping rock at speed hurts, and hurts more the faster you go.
  const clearance = 1 - Math.abs(plane.x);
  if (clearance < 0.06 && plane.speed > 70) {
    plane.damage = Math.min(100, plane.damage + 26 * dt * (plane.speed / 100));
    return 'wall-scrape';
  }

  // The ground: a gentle touchdown on the runway is a landing; anything
  // else at speed is a crash, and a hard hit is damage even when survived.
  const ground = terrain.heightAt(plane.x, plane.z);
  if (plane.y <= ground + 2) {
    const onRunway =
      plane.z >= terrain.runway.zStart &&
      plane.z <= terrain.runway.zEnd &&
      Math.abs(plane.x) < terrain.runway.halfWidth;
    const descent = -plane.verticalSpeed;
    if (onRunway && descent < PLANE.crashSpeed && plane.speed < 118) {
      plane.y = ground + 2;
      plane.landed = true;
      return 'landed';
    }
    if (descent >= PLANE.crashSpeed || plane.speed > 130) {
      plane.damage = 100;
      return 'crashed';
    }
    plane.damage = Math.min(100, plane.damage + 22 + descent);
    plane.y = ground + 2;
    plane.verticalSpeed = 0;
    plane.pitch = 0;
    return 'ground-strike';
  }
  return plane.stalled ? 'stall' : '';
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
