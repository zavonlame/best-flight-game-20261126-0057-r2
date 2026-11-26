// Canyon Courier — deterministic randomness. Every number the world needs
// comes from one seeded generator, so the same seed always builds the same
// canyon, the same rings and the same screenshots.

/** Mulberry32: a small, fast seeded PRNG with a full 32-bit period. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A uniform value in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of an array. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

/**
 * Smooth 1-D value noise: a fixed table of control points per seed, linearly
 * interpolated, so terrain ridges are smooth instead of jagged. The table is
 * built once per generator and shared by every caller that needs the same
 * shape at the same distance.
 */
export function makeRidge(rng, points, spacing) {
  const table = [];
  for (let i = 0; i < points; i += 1) table.push(rng() * 2 - 1);
  return function at(distance) {
    const scaled = distance / spacing;
    const i = Math.floor(scaled);
    const frac = scaled - i;
    const a = table[((i % points) + points) % points];
    const b = table[(((i + 1) % points) + points) % points];
    const smooth = frac * frac * (3 - 2 * frac);
    return a + (b - a) * smooth;
  };
}
