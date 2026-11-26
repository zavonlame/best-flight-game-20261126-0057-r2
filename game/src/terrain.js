// Canyon Courier — the canyon itself. A seeded heightfield gives the valley
// floor, the steep walls and the far ridges; the same seed also lays out the
// river, the ring course and the runway, so a sortie is the same every time
// it is flown from the same seed.

import { WORLD } from './config.js';
import { makeRng, makeRidge, range } from './random.js';

/**
 * Build one canyon for a mission. `mission` is one of the MISSIONS entries,
 * `seed` is the sortie seed. Returns the terrain functions the flight model
 * and the renderer share.
 */
export function buildTerrain(seed, mission) {
  const rng = makeRng(seed * 7919 + 13);
  const floorRidge = makeRidge(rng, 48, 620);
  const wallRidge = makeRidge(rng, 36, 540);
  const farRidgeA = makeRidge(rng, 24, 900);
  const farRidgeB = makeRidge(rng, 24, 1300);
  const riverPhase = rng() * 6.28;
  const ringPhase = rng() * 6.28;

  /** Ground height in feet at lateral position x (-1..1) and distance z (m). */
  function heightAt(x, z) {
    const ax = Math.abs(x);
    const floor = 16 * floorRidge(z) + 26 * x * x;
    if (ax <= WORLD.wallStart) return floor;
    const t = Math.min(1, (ax - WORLD.wallStart) / (1 - WORLD.wallStart));
    const wall = 90 * t + 530 * t * t * (0.75 + 0.25 * wallRidge(z));
    return floor + wall;
  }

  /** Lateral centre of the river at distance z, in valley units. */
  function riverX(z) {
    return 0.16 * Math.sin(z * 0.0011 + riverPhase) + 0.05 * Math.sin(z * 0.0031);
  }

  /** Far ridge silhouettes, as functions of distance, for the backdrop. */
  const farRidges = [
    { at: farRidgeA, height: 300, tone: 0 },
    { at: farRidgeB, height: 210, tone: 1 },
  ];

  // The ring course: evenly spaced down the canyon, weaving side to side and
  // up and down so a good line is a smooth S, never a straight dash.
  const rings = [];
  const count = mission.rings;
  const firstZ = 650;
  // Landing and drop sorties end their ring course early: the landing
  // sortie needs the strip after the rings, the drop sortie needs the
  // target circle after them.
  const lastZ = mission.landing || mission.drop
    ? WORLD.courseLength - 2600
    : WORLD.courseLength - 900;
  for (let i = 0; i < count; i += 1) {
    const z = firstZ + ((lastZ - firstZ) * i) / Math.max(1, count - 1);
    const x = 0.52 * Math.sin(i * 0.95 + ringPhase);
    const y = 235 + 120 * Math.sin(i * 1.35 + 1.7) + 40 * Math.sin(i * 0.5);
    rings.push({ x, y, z, radius: WORLD.ringRadius, passed: false, hit: false });
  }

  // The runway: a short desert strip on the valley floor at the course end,
  // centreline x = 0, long enough to land on and short enough to matter.
  const runway = {
    zStart: WORLD.courseLength - 300,
    zEnd: WORLD.courseLength + 500,
    halfWidth: 0.09,
    heading: 0,
  };

  // The supply-drop target: a painted circle on the valley floor past the
  // last ring, so the pilot earns the drop by flying the course first.
  // The circle sits slightly off centreline so the drop needs a real line.
  const dropTarget = mission.drop
    ? {
        x: 0.18 * Math.sin(ringPhase + 2.1),
        z: WORLD.courseLength - 1400,
        radiusFeet: 120,
      }
    : null;

  return { heightAt, riverX, rings, runway, dropTarget, farRidges, seed };
}

/** Lateral distance from the canyon wall, 0 at the wall face, 1 at centre. */
export function wallClearance(x) {
  return Math.max(0, 1 - Math.abs(x));
}

/** True when the point (x, y, z) is inside ring `ring`. */
export function insideRing(ring, x, y) {
  const dx = (x - ring.x) * WORLD.lateralFeet;
  const dy = y - ring.y;
  return dx * dx + dy * dy < ring.radius * ring.radius;
}
