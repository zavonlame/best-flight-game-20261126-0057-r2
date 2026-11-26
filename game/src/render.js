// Canyon Courier — the renderer, part 1: the world. A pseudo-3D chase view
// over a seeded desert canyon: sky, sun and far ridges, then the canyon
// itself drawn as depth slices, the river, the runway and the glowing rings.
// The plane and the HUD live in render-hud.js's half of this file (below).

import { VIEW, WORLD } from './config.js';
import { makeRng } from './random.js';
import { drawCockpit } from './cockpit.js';

const SKY_TOP = '#1d4e79';
const SKY_HORIZON = '#f2b96a';
const HAZE = '#e0a468';
const ROCK_NEAR = '#a34d24';
const ROCK_MID = '#b25f31';
const ROCK_FAR = '#c07a48';
const FLOOR_NEAR = '#c1905a';
const FLOOR_FAR = '#cf9f68';
const RIVER = '#3f7fb5';
const RUNWAY = '#54595f';
const RUNWAY_EDGE = '#ffd76a';
const RING_GLOW = '#35f0d0';
const RING_CORE = '#eafffa';

const FEET_PER_METRE = 3.28084;
const SLICE_DEPTHS = [5, 8, 12, 18, 32, 55, 90, 140, 210, 310, 450, 640, 880, 1180, 1520, 1900];
const LATERAL_SAMPLES = 17;

// Desert scrub: fixed bushes scattered down the canyon floor, so the near
// ground reads as terrain instead of flat paint. Same bushes every frame.
const SCRUB = (() => {
  const rng = makeRng(1234);
  const points = [];
  for (let i = 0; i < 170; i += 1) {
    points.push({
      x: -0.88 + rng() * 1.76,
      z: 60 + i * 56 + rng() * 24,
      r: 3 + rng() * 6,
    });
  }
  return points;
})();

// Rock outcrops on the valley floor: grey boulders the pilot flies past,
// bigger than the scrub and pale enough to read at a distance.
const ROCKS = (() => {
  const rng = makeRng(777);
  const points = [];
  for (let i = 0; i < 46; i += 1) {
    points.push({
      x: -0.85 + rng() * 1.7,
      z: 150 + i * 198 + rng() * 60,
      r: 6 + rng() * 10,
    });
  }
  return points;
})();

/** Floor tone patches: slow deterministic noise so the valley floor is a
 * patchwork of sand and rock instead of one flat colour. */
function floorPatch(x, z) {
  const a = Math.sin(x * 6.3 + z * 0.021) * Math.sin(z * 0.013 + 2.1);
  const b = Math.sin(x * 11.7 - z * 0.007 + 0.8);
  return (a * 0.6 + b * 0.4) * 0.5 + 0.5; // 0..1
}

/** Focal length in pixels for the projector. */
function focal() {
  return VIEW.height / 2 / Math.tan(VIEW.fov / 2);
}

/** Mix two hex colours by t (0 = a, 1 = b). */
export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A deterministic brightness wobble so rock reads as rock, not flat card. */
function varyShade(hex, depth, segment) {
  const h = Math.sin(depth * 12.9898 + segment * 78.233) * 43758.5453;
  const wobble = (h - Math.floor(h) - 0.5) * 0.16;
  return mixHex(hex, wobble > 0 ? '#ffffff' : '#000000', Math.abs(wobble));
}

/** Project a world point to screen space. Returns null when behind camera. */
function project(cam, wxFeet, wyFeet, wzMetres, horizonY) {
  const dz = (wzMetres - cam.z) * FEET_PER_METRE;
  if (dz < 4) return null;
  const f = focal();
  return {
    x: VIEW.width / 2 + ((wxFeet - cam.x) * f) / dz,
    y: horizonY - ((wyFeet - cam.y) * f) / dz,
    scale: f / dz,
  };
}

/** Draw the sky, sun, drifting clouds and far ridge silhouettes. */
function drawSky(ctx, world, horizonY) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.42, '#7fa8c9');
  g.addColorStop(0.55, SKY_HORIZON);
  g.addColorStop(1, '#8a5a34');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Late-afternoon sun, low over the east wall.
  const sunX = VIEW.width * 0.78;
  const sunY = horizonY - 150;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 205, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 205, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Clouds: soft ellipses drifting with distance down the canyon.
  ctx.fillStyle = 'rgba(255, 246, 230, 0.5)';
  const z = world.plane.z;
  for (let i = 0; i < 7; i += 1) {
    const cx = ((i * 317 + z * 0.6) % 1500) - 110;
    const cy = 46 + ((i * 89) % 110) - world.plane.pitch * 120;
    const w = 70 + ((i * 53) % 70);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, 13 + ((i * 7) % 9), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far ridges: two silhouette layers sampled from the terrain's ridges.
  const ridges = world.terrain.farRidges;
  for (let layer = 0; layer < ridges.length; layer += 1) {
    const ridge = ridges[layer];
    const base = horizonY - (layer === 0 ? 34 : 12);
    const amp = ridge.height * 0.16 * (layer === 0 ? 1 : 0.7);
    ctx.fillStyle = layer === 0 ? 'rgba(122, 74, 52, 0.85)' : 'rgba(146, 94, 62, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, VIEW.height);
    for (let sx = 0; sx <= VIEW.width; sx += 32) {
      const sample = ridge.at(z * 0.02 + sx * 0.9 + layer * 500);
      ctx.lineTo(sx, base - (sample * 0.5 + 0.5) * amp);
    }
    ctx.lineTo(VIEW.width, VIEW.height);
    ctx.closePath();
    ctx.fill();
  }

  // Mesas: flat-top buttes on the far horizon, drifting slowly with the
  // canyon so the skyline never reads as a straight edge.
  ctx.fillStyle = 'rgba(150, 92, 58, 0.55)';
  for (let i = 0; i < 3; i += 1) {
    const mx = ((i * 520 + z * 0.35) % 1500) - 120;
    const mw = 150 + i * 60;
    const mh = 26 + ((i * 37) % 22);
    ctx.beginPath();
    ctx.moveTo(mx, horizonY);
    ctx.lineTo(mx + 18, horizonY - mh);
    ctx.lineTo(mx + mw - 18, horizonY - mh);
    ctx.lineTo(mx + mw, horizonY);
    ctx.closePath();
    ctx.fill();
  }
}

// Rock strata: the canyon walls are layered, so a slice reads as rock at a
// glance instead of one flat card. Bands repeat every 85 feet of height.
const STRATA = ['#7a3a1e', '#a34d24', '#c07a48', '#6e3a22', '#d98a4e'];

function strataColor(heightFeet) {
  if (heightFeet <= 90) return FLOOR_NEAR;
  return STRATA[Math.floor(heightFeet / 85) % STRATA.length];
}

/** Draw the canyon as depth slices from the camera forward. */
function drawCanyon(ctx, world, cam, horizonY) {
  const terrain = world.terrain;
  // Build one projected profile per slice: lateral samples -> screen points.
  const profiles = [];
  for (const depth of SLICE_DEPTHS) {
    const z = cam.z + depth;
    const points = [];
    for (let s = 0; s < LATERAL_SAMPLES; s += 1) {
      const x = -1 + (2 * s) / (LATERAL_SAMPLES - 1);
      const h = terrain.heightAt(x, z);
      const p = project(cam, x * WORLD.lateralFeet, h, z, horizonY);
      points.push(p);
    }
    profiles.push({ depth, z, points });
  }
  // Fill the ground between consecutive slices, near to far so far slices
  // paint first and near slices cover their lower edges. Each lateral
  // segment gets its own shade, so the canyon reads as rock, not flat card.
  for (let i = profiles.length - 1; i > 0; i -= 1) {
    const near = profiles[i - 1];
    const far = profiles[i];
    const haze = clamp(far.depth / 1900, 0, 0.85);
    for (let s = 0; s < LATERAL_SAMPLES - 1; s += 1) {
      const f0 = far.points[s];
      const f1 = far.points[s + 1];
      const n0 = near.points[s];
      const n1 = near.points[s + 1];
      if (!f0 || !f1 || !n0 || !n1) continue;
      const xMid = -1 + (2 * (s + 0.5)) / (LATERAL_SAMPLES - 1);
      const hMid = terrain.heightAt(xMid, far.z);
      // Strata by height, then the sun: the late sun stands in the east,
      // so the west wall catches warm light and the east wall sits in cool
      // shadow. The floor keeps its own colour, broken up by tone patches.
      let shade = varyShade(strataColor(hMid), far.depth, s);
      if (hMid > 90) {
        shade = xMid < 0 ? mixHex(shade, '#ffd9a0', 0.12) : mixHex(shade, '#2e2233', 0.18);
      } else {
        const patch = floorPatch(xMid, far.z);
        shade = mixHex(shade, patch > 0.5 ? '#d9a86e' : '#8a5a34', Math.abs(patch - 0.5) * 0.55);
      }
      ctx.fillStyle = mixHex(shade, HAZE, haze);
      ctx.beginPath();
      ctx.moveTo(f0.x, f0.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.lineTo(n1.x, n1.y);
      ctx.lineTo(n0.x, n0.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Desert scrub on the valley floor, drawn over the slices.
  ctx.fillStyle = 'rgba(90, 62, 32, 0.75)';
  for (const bush of SCRUB) {
    const dz = bush.z - cam.z;
    if (dz < 25 || dz > 1900) continue;
    const gy = terrain.heightAt(bush.x, bush.z);
    if (gy > 90) continue; // bushes grow on the floor, not the walls
    const p = project(cam, bush.x * WORLD.lateralFeet, gy + bush.r, bush.z, horizonY);
    if (!p) continue;
    const r = Math.max(1, Math.min(9, p.scale * bush.r));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rock outcrops on the valley floor, drawn over the slices.
  ctx.fillStyle = 'rgba(120, 96, 78, 0.85)';
  for (const rock of ROCKS) {
    const dz = rock.z - cam.z;
    if (dz < 25 || dz > 1900) continue;
    const gy = terrain.heightAt(rock.x, rock.z);
    if (gy > 90) continue;
    const p = project(cam, rock.x * WORLD.lateralFeet, gy + rock.r, rock.z, horizonY);
    if (!p) continue;
    const r = Math.max(1.5, Math.min(16, p.scale * rock.r));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The river: a blue ribbon down the valley floor, drawn over the slices.
  // Near segments are skipped: at arm's length a ribbon would fill the
  // frame, and the canyon floor already carries the picture there.
  // Sandy banks under the ribbon keep it readable at a distance.
  ctx.lineCap = 'round';
  for (let i = 0; i < profiles.length - 1; i += 1) {
    const a = profiles[i];
    const b = profiles[i + 1];
    if (a.depth < 55) continue;
    const rxA = terrain.riverX(a.z);
    const rxB = terrain.riverX(b.z);
    const pA = project(cam, rxA * WORLD.lateralFeet, terrain.heightAt(rxA, a.z) + 3, a.z, horizonY);
    const pB = project(cam, rxB * WORLD.lateralFeet, terrain.heightAt(rxB, b.z) + 3, b.z, horizonY);
    if (!pA || !pB) continue;
    ctx.strokeStyle = '#d9b078';
    ctx.lineWidth = Math.min(40, Math.max(3, pA.scale * 16));
    ctx.globalAlpha = 0.55 - clamp(b.depth / 1900, 0, 0.35);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }
  ctx.strokeStyle = RIVER;
  for (let i = 0; i < profiles.length - 1; i += 1) {
    const a = profiles[i];
    const b = profiles[i + 1];
    if (a.depth < 55) continue;
    const rxA = terrain.riverX(a.z);
    const rxB = terrain.riverX(b.z);
    const pA = project(cam, rxA * WORLD.lateralFeet, terrain.heightAt(rxA, a.z) + 3, a.z, horizonY);
    const pB = project(cam, rxB * WORLD.lateralFeet, terrain.heightAt(rxB, b.z) + 3, b.z, horizonY);
    if (!pA || !pB) continue;
    ctx.lineWidth = Math.min(36, Math.max(2, pA.scale * 12));
    ctx.globalAlpha = 0.95 - clamp(b.depth / 1900, 0, 0.6);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Draw the runway strip when it is in view ahead. */
function drawRunway(ctx, world, cam, horizonY) {
  const runway = world.terrain.runway;
  if (cam.z + 2000 < runway.zStart || cam.z > runway.zEnd + 100) return;
  const terrain = world.terrain;
  const hw = runway.halfWidth * WORLD.lateralFeet;
  const corners = [
    project(cam, -hw, terrain.heightAt(-runway.halfWidth, runway.zStart) + 2, runway.zStart, horizonY),
    project(cam, hw, terrain.heightAt(runway.halfWidth, runway.zStart) + 2, runway.zStart, horizonY),
    project(cam, hw, terrain.heightAt(runway.halfWidth, runway.zEnd) + 2, runway.zEnd, horizonY),
    project(cam, -hw, terrain.heightAt(-runway.halfWidth, runway.zEnd) + 2, runway.zEnd, horizonY),
  ];
  if (corners.some((c) => !c)) return;
  ctx.fillStyle = RUNWAY;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes, one per 90 metres of strip.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  for (let z = runway.zStart + 60; z < runway.zEnd; z += 90) {
    const a = project(cam, 0, terrain.heightAt(0, z) + 3, z, horizonY);
    const b = project(cam, 0, terrain.heightAt(0, z + 45) + 3, z + 45, horizonY);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at the near end.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const side of [-0.55, 0.55]) {
    const p = project(cam, side * hw, terrain.heightAt(side * runway.halfWidth, runway.zStart + 12) + 3, runway.zStart + 12, horizonY);
    if (!p) continue;
    ctx.fillRect(p.x - 8, p.y - 3, 16, 6);
  }
  // Edge lights down both sides, so the strip reads from a kilometre out.
  ctx.fillStyle = RUNWAY_EDGE;
  for (let z = runway.zStart; z < runway.zEnd; z += 100) {
    for (const side of [-1, 1]) {
      const p = project(cam, side * hw, terrain.heightAt(side * runway.halfWidth, z) + 3, z, horizonY);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, p.scale * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draw every ring still ahead, nearest last so near rings cover far ones. */
function drawRings(ctx, world, cam, horizonY) {
  const rings = [...world.terrain.rings].sort((a, b) => b.z - a.z);
  for (const ring of rings) {
    const dz = ring.z - cam.z;
    if (dz < 6 || dz > 2200) continue;
    const c = project(cam, ring.x * WORLD.lateralFeet, ring.y, ring.z, horizonY);
    if (!c) continue;
    const r = (ring.radius * focal()) / (dz * FEET_PER_METRE);
    if (r < 2) continue;
    const alpha = ring.passed ? (ring.hit ? 0.25 : 0.12) : Math.max(0.35, 1 - dz / 2200);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = RING_GLOW;
    ctx.shadowBlur = r * 0.45;
    ctx.strokeStyle = ring.passed ? '#9fb3ad' : RING_GLOW;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = RING_CORE;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // The nearest unflown ring gets its distance, above the ring where the
    // plane never covers it.
    if (!ring.passed && dz < 700) {
      ctx.fillStyle = 'rgba(234, 255, 250, 0.95)';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dz)} m`, c.x, c.y - r - 14);
    }
  }
}

/** Draw the supply crate under its canopy, when one is falling. */
function drawCrate(ctx, world, cam, horizonY) {
  const crate = world.crate;
  if (!crate || crate.landed) return;
  if (crate.z - cam.z > 2200) return;
  // The crate leaves the plane at the camera's own depth, where the
  // projector divides by ~0: clamp the depth to 12 m so it always renders
  // ahead of the nose, sinking as it falls, drifting as the wind takes it.
  const dzm = Math.max(12, crate.z - cam.z);
  const dzFt = dzm * FEET_PER_METRE;
  const f = focal();
  const p = {
    x: VIEW.width / 2 + ((crate.x * WORLD.lateralFeet - cam.x) * f) / dzFt,
    y: horizonY - ((crate.y - cam.y) * f) / dzFt,
    scale: f / dzFt,
  };
  // Capped size, like the rings' minimum: the crate sits metres from the
  // camera, so its true projected size would fill the frame, and at the
  // target's distance it would be a speck. Readable either way.
  const s = Math.min(2.2, Math.max(0.8, p.scale));
  // Canopy: an orange half-disc over the crate, drawn big enough to read
  // as a parachute at a glance, not a speck.
  ctx.fillStyle = 'rgba(255, 120, 40, 0.95)';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 24 * s, 30 * s, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.2, s);
  for (const off of [-20, 0, 20]) {
    ctx.beginPath();
    ctx.moveTo(p.x + off * s, p.y - 24 * s);
    ctx.lineTo(p.x + off * 0.4 * s, p.y);
    ctx.stroke();
  }
  // The crate itself.
  ctx.fillStyle = '#8a5a24';
  ctx.fillRect(p.x - 13 * s, p.y, 26 * s, 20 * s);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(p.x - 13 * s, p.y + 7 * s, 26 * s, 4 * s);
}

/** Draw the painted drop circle on the valley floor, while it matters. */
function drawDropTarget(ctx, world, cam, horizonY) {
  const target = world.terrain.dropTarget;
  if (!target || world.sheet.dropPoints > 0 || world.crate) return;
  const dz = target.z - cam.z;
  if (dz < 6 || dz > 2200) return;
  const ground = world.terrain.heightAt(target.x, target.z);
  const pts = [];
  for (let i = 0; i <= 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const px = target.x + (Math.cos(a) * target.radiusFeet) / WORLD.lateralFeet;
    const pz = target.z + (Math.sin(a) * target.radiusFeet) / 3.28084;
    const p = project(cam, px * WORLD.lateralFeet, ground + 3, pz, horizonY);
    if (p) pts.push(p);
  }
  if (pts.length < 8) return;
  ctx.fillStyle = 'rgba(255, 120, 40, 0.35)';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const c = project(cam, target.x * WORLD.lateralFeet, ground + 4, target.z, horizonY);
  if (c) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP ZONE', c.x, c.y - 12);
  }
}

/** Draw the courier herself: a bush plane seen from chase view, banked. */
function drawPlane(ctx, world) {
  const plane = world.plane;
  const cx = VIEW.width / 2;
  const cy = VIEW.height * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.85);
  // Propeller blur, seen edge-on from behind the nose: a spinning disc,
  // not a single blade, so the engine reads as running.
  ctx.fillStyle = 'rgba(210, 225, 235, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, -78, 30, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(210, 225, 235, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, -78, 8, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wings, with a warm cheatline and tip lights.
  ctx.fillStyle = '#e8b64c';
  roundRect(ctx, -104, -8, 208, 20, 9);
  ctx.fill();
  ctx.fillStyle = '#c98f2e';
  roundRect(ctx, -104, 6, 208, 6, 3);
  ctx.fill();
  // Fuselage: wide at the tail, tapering to the nose.
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath();
  ctx.moveTo(-17, 74);
  ctx.lineTo(-13, -58);
  ctx.quadraticCurveTo(0, -76, 13, -58);
  ctx.lineTo(17, 74);
  ctx.quadraticCurveTo(0, 84, -17, 74);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d96f32';
  ctx.beginPath();
  ctx.moveTo(-16, 40);
  ctx.lineTo(-14, -30);
  ctx.lineTo(14, -30);
  ctx.lineTo(16, 40);
  ctx.closePath();
  ctx.fill();
  // Cockpit windows, lit from inside.
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath();
  ctx.ellipse(0, -34, 10, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 225, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(-3, -38, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail fin and stabiliser.
  ctx.fillStyle = '#d96f32';
  ctx.beginPath();
  ctx.moveTo(-4, 62);
  ctx.lineTo(0, 30);
  ctx.lineTo(4, 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b64c';
  roundRect(ctx, -46, 58, 92, 12, 5);
  ctx.fill();
  // Navigation lights: red port, green starboard, white tail.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-104, 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e08a';
  ctx.beginPath();
  ctx.arc(104, 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 80, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A dark translucent panel with a thin amber edge. */
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 18, 28, 0.58)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 200, 87, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function text(ctx, str, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

/** The plane's shadow on the ground below: a soft dark ellipse that tells
 * the eye how high the plane really is. Fades as the plane climbs. */
function drawGroundShadow(ctx, world, cam, horizonY) {
  const plane = world.plane;
  const ground = world.terrain.heightAt(plane.x, plane.z);
  const height = plane.y - ground;
  if (height > 500) return;
  const p = project(cam, plane.x * WORLD.lateralFeet, ground + 2, plane.z, horizonY);
  if (!p) return;
  const alpha = Math.max(0.06, 0.3 - height / 1600);
  const r = Math.max(4, Math.min(46, p.scale * 26));
  ctx.fillStyle = `rgba(20, 10, 4, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The instruments and readouts, drawn over the world. In the cockpit the
 * dashboard gauges carry speed, altitude and heading, so the chase-only
 * tapes and the bottom panel stay out of the way. */
function drawHud(ctx, world, cockpit = false) {
  const plane = world.plane;
  const sheet = world.sheet;
  const cx = VIEW.width / 2;

  // Score, time, rings — top left.
  panel(ctx, 16, 14, 268, 108);
  text(ctx, 'SCORE', 30, 40, 15, '#ffc857');
  text(ctx, `${sheet.ringPoints + sheet.timePoints + sheet.fuelPoints + sheet.landingPoints + sheet.dropPoints}`, 30, 72, 32, '#ffffff');
  text(ctx, `TIME ${Math.ceil(world.timeLeft)}s`, 168, 40, 15, '#ffc857');
  text(ctx, `RINGS ${sheet.ringsHit}/${sheet.ringsTotal}`, 168, 72, 20, '#ffffff');
  text(ctx, `FUEL ${Math.round(plane.fuel)}%`, 168, 100, 15, plane.fuel < 25 ? '#ff6b5e' : '#bfe9ff');

  // Compass tape — top centre, heading under the caret.
  panel(ctx, cx - 210, 14, 420, 44);
  const heading = Math.round(plane.heading) % 360;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 210, 14, 420, 44);
  ctx.clip();
  for (let d = -60; d <= 60; d += 15) {
    const h = (heading + d + 360) % 360;
    const x = cx + d * 3.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = d === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x, d % 45 === 0 ? 28 : 36);
    ctx.stroke();
    if (d % 45 === 0) {
      const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : `${h}`;
      text(ctx, label, x, 26, 13, '#ffffff', 'center');
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffc857';
  ctx.beginPath();
  ctx.moveTo(cx - 7, 14);
  ctx.lineTo(cx + 7, 14);
  ctx.lineTo(cx, 24);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${heading}°`, cx, 72, 18, '#ffffff', 'center');

  // Next objective — top right.
  panel(ctx, VIEW.width - 284, 14, 268, 108);
  const ring = world.terrain.rings.find((r) => !r.passed);
  if (world.crate && !world.crate.landed) {
    const dist = Math.max(0, Math.round(world.terrain.dropTarget.z - world.crate.z));
    text(ctx, 'CRATE FALLING', VIEW.width - 270, 40, 15, '#ff7830');
    text(ctx, `${dist} m`, VIEW.width - 270, 72, 30, '#ffffff');
    text(ctx, 'WATCH THE WIND', VIEW.width - 270, 100, 15, '#bfe9ff');
  } else if (world.mission.drop && !ring) {
    const dist = Math.max(0, Math.round(world.terrain.dropTarget.z - plane.z));
    text(ctx, 'DROP ZONE', VIEW.width - 270, 40, 15, '#ff7830');
    text(ctx, `${dist} m`, VIEW.width - 270, 72, 30, '#ffffff');
    text(ctx, 'PRESS F TO DROP', VIEW.width - 270, 100, 15, '#bfe9ff');
  } else if (ring) {
    const dist = Math.max(0, Math.round(ring.z - plane.z));
    const dir = ring.x > plane.x + 0.08 ? '►' : ring.x < plane.x - 0.08 ? '◄' : '▲';
    text(ctx, 'NEXT RING', VIEW.width - 270, 40, 15, '#35f0d0');
    text(ctx, `${dist} m  ${dir}`, VIEW.width - 270, 72, 30, '#ffffff');
    text(ctx, `ALT ${Math.round(ring.y)} ft`, VIEW.width - 270, 100, 15, '#bfe9ff');
  } else {
    text(ctx, 'RUNWAY AHEAD', VIEW.width - 270, 40, 15, '#35f0d0');
    const dist = Math.max(0, Math.round(world.terrain.runway.zStart - plane.z));
    text(ctx, `${dist} m`, VIEW.width - 270, 72, 30, '#ffffff');
    text(ctx, 'LINE UP · SLOW DOWN', VIEW.width - 270, 100, 15, '#bfe9ff');
  }

  // Chase-only instruments: in the cockpit the dashboard gauges carry
  // these numbers, so the tapes and the bottom panel stay out of the way.
  if (!cockpit) {
  // Airspeed tape — left edge.
  panel(ctx, 16, 250, 74, 220);
  text(ctx, 'KT', 53, 272, 14, '#ffc857', 'center');
  for (let s = 60; s <= 180; s += 20) {
    const y = 440 - ((s - 60) / 120) * 180;
    text(ctx, `${s}`, 53, y + 5, 13, 'rgba(255,255,255,0.65)', 'center');
  }
  const speedY = 440 - ((clamp(plane.speed, 60, 180) - 60) / 120) * 180;
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(22, speedY - 2, 62, 4);
  text(ctx, `${Math.round(plane.speed)}`, 53, 500, 30, '#ffffff', 'center');

  // Altimeter tape — right edge.
  panel(ctx, VIEW.width - 90, 250, 74, 220);
  text(ctx, 'FT', VIEW.width - 53, 272, 14, '#ffc857', 'center');
  for (let a = 0; a <= 600; a += 150) {
    const y = 440 - (a / 600) * 180;
    text(ctx, `${a}`, VIEW.width - 53, y + 5, 13, 'rgba(255,255,255,0.65)', 'center');
  }
  const altY = 440 - (clamp(plane.y, 0, 600) / 600) * 180;
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(VIEW.width - 84, altY - 2, 62, 4);
  text(ctx, `${Math.round(plane.y)}`, VIEW.width - 53, 500, 30, '#ffffff', 'center');

  // Artificial horizon — bottom left: sky and ground halves, banked.
  const hx = 92;
  const hy = 600;
  const hr = 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-plane.bank);
  const pitchPx = clamp(plane.pitch, -0.5, 0.5) * 90;
  ctx.fillStyle = '#3f7fb5';
  ctx.fillRect(-hr, -hr - pitchPx, hr * 2, hr + pitchPx);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-hr, -pitchPx, hr * 2, hr + pitchPx);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hr, -pitchPx);
  ctx.lineTo(hr, -pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffc857';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(hx - 18, hy - 2, 12, 4);
  ctx.fillRect(hx + 6, hy - 2, 12, 4);
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Throttle, fuel, damage — bottom left, beside the horizon.
  panel(ctx, 168, 548, 150, 104);
  text(ctx, 'THROTTLE', 180, 570, 13, '#ffc857');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(180, 580, 126, 12);
  ctx.fillStyle = '#35f0d0';
  ctx.fillRect(180, 580, 126 * plane.throttle, 12);
  text(ctx, 'FUEL', 180, 614, 13, '#ffc857');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(180, 622, 126, 12);
  ctx.fillStyle = plane.fuel < 25 ? '#ff6b5e' : '#7ec8ff';
  ctx.fillRect(180, 622, 126 * (plane.fuel / 100), 12);
  text(ctx, 'DAMAGE', 330, 570, 13, '#ffc857');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(330, 580, 126, 12);
  ctx.fillStyle = plane.damage > 60 ? '#ff6b5e' : '#ffb347';
  ctx.fillRect(330, 580, 126 * (plane.damage / 100), 12);
  text(ctx, `${Math.round(plane.damage)}%`, 330, 614, 13, '#ffffff');

  // Mission name and controls — bottom right.
  text(ctx, world.mission.name, VIEW.width - 24, 668, 18, '#ffffff', 'right');
  text(ctx, 'A/D bank · ↑/↓ pitch · W/S throttle · mouse steers · C cockpit · F drop · P pause', VIEW.width - 24, 694, 14, 'rgba(255,255,255,0.75)', 'right');
  }

  // Centre reticle at the nose.
  if (!cockpit) {
  const retY = VIEW.height * 0.62 - 96;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, retY, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 20, retY);
  ctx.lineTo(cx - 8, retY);
  ctx.moveTo(cx + 8, retY);
  ctx.lineTo(cx + 20, retY);
  ctx.moveTo(cx, retY - 20);
  ctx.lineTo(cx, retY - 8);
  ctx.moveTo(cx, retY + 8);
  ctx.lineTo(cx, retY + 20);
  ctx.stroke();
  }

  // Toasts and warnings, centre screen — only while flying, never over an
  // end screen where they would fight the title.
  if (world.toast && world.elapsed < world.toastUntil && (world.screen === 'play' || world.screen === 'paused')) {
    ctx.font = 'bold 26px system-ui, sans-serif';
    const w = ctx.measureText(world.toast).width + 36;
    ctx.fillStyle = 'rgba(8, 18, 28, 0.6)';
    ctx.fillRect(cx - w / 2, 96, w, 44);
    text(ctx, world.toast, cx, 127, 26, '#ffe9b0', 'center');
  }
  if (plane.stalled && world.screen === 'play') {
    const flash = Math.floor(world.elapsed * 4) % 2 === 0;
    if (flash) text(ctx, 'STALL', cx, 210, 44, '#ff6b5e', 'center');
  }
  if (plane.damage > 60) {
    ctx.strokeStyle = 'rgba(255, 60, 40, 0.55)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
  }
}

/** A full-screen overlay panel for title, pause and end screens. */
function overlay(ctx, title, titleColor) {
  ctx.fillStyle = 'rgba(6, 14, 22, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  text(ctx, title, VIEW.width / 2, 150, 72, titleColor, 'center');
}

function scoreLines(sheet) {
  const lines = [
    [`RINGS ${sheet.ringsHit}/${sheet.ringsTotal}`, `+${sheet.ringPoints}`],
    ['TIME BONUS', `+${sheet.timePoints}`],
    ['FUEL BONUS', `+${sheet.fuelPoints}`],
    ['LANDING', `+${sheet.landingPoints}`],
  ];
  if (sheet.dropDetail) lines.push(['SUPPLY DROP', `+${sheet.dropPoints}`]);
  lines.push(['TOTAL', `${sheet.total}`]);
  return lines;
}

function drawScoreBreakdown(ctx, sheet, topY) {
  let y = topY;
  for (const [label, value] of scoreLines(sheet)) {
    const strong = label === 'TOTAL';
    text(ctx, label, VIEW.width / 2 - 190, y, strong ? 30 : 22, strong ? '#ffc857' : '#ffffff', 'left');
    text(ctx, value, VIEW.width / 2 + 190, y, strong ? 30 : 22, strong ? '#ffc857' : '#ffffff', 'right');
    y += strong ? 52 : 38;
  }
  return y;
}

/** Draw one frame for the world's current screen. */
export function render(ctx, world, selectedMission) {
  const plane = world.plane;
  const horizonY =
    VIEW.height * VIEW.horizon + clamp(plane.pitch, -0.5, 0.5) * 260 - (plane.y - 260) * 0.08;
  // The cockpit camera sits at the nose instead of behind the tail; the
  // title screen always flies chase, so the plane stays in the picture.
  const inCockpit = world.view === 'cockpit' && world.screen !== 'title';
  const cam = inCockpit
    ? { x: plane.x * WORLD.lateralFeet, y: plane.y + 2, z: plane.z }
    : {
        x: plane.x * WORLD.lateralFeet,
        y: plane.y + 12,
        z: plane.z - 26,
      };

  ctx.save();
  // The world banks against the pilot: roll the scene, not the HUD.
  ctx.translate(VIEW.width / 2, VIEW.height / 2);
  ctx.rotate(-plane.bank * 0.35);
  ctx.translate(-VIEW.width / 2, -VIEW.height / 2);
  drawSky(ctx, world, horizonY);
  drawCanyon(ctx, world, cam, horizonY);
  drawRunway(ctx, world, cam, horizonY);
  drawRings(ctx, world, cam, horizonY);
  drawDropTarget(ctx, world, cam, horizonY);
  drawCrate(ctx, world, cam, horizonY);
  if (!inCockpit) drawGroundShadow(ctx, world, cam, horizonY);
  ctx.restore();

  // Speed streaks at the edges when the throttle is open.
  if (plane.speed > 118 && world.screen === 'play') {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.4, (plane.speed - 118) / 200)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = ((i * 173 + Math.floor(world.elapsed * 900)) % 700) + 10;
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(8, y + 26);
      ctx.moveTo(VIEW.width - 8, y);
      ctx.lineTo(VIEW.width - 8, y + 26);
      ctx.stroke();
    }
  }

  if (world.screen === 'title') {
    drawPlane(ctx, world);
    overlay(ctx, 'CANYON COURIER', '#ffc857');
    text(ctx, 'A bush-pilot courier run through a desert canyon.', VIEW.width / 2, 196, 24, '#ffffff', 'center');
    text(ctx, 'Built by an AI agent for make.fun — a bounty entry by zavon-lame.', VIEW.width / 2, 228, 16, '#bfe9ff', 'center');
    const list = world.missionList || [];
    let y = 292;
    list.forEach((m, i) => {
      const selected = i === selectedMission;
      ctx.fillStyle = selected ? 'rgba(255, 200, 87, 0.22)' : 'rgba(8, 18, 28, 0.5)';
      ctx.fillRect(VIEW.width / 2 - 330, y - 30, 660, 62);
      if (selected) {
        ctx.strokeStyle = '#ffc857';
        ctx.lineWidth = 2;
        ctx.strokeRect(VIEW.width / 2 - 330, y - 30, 660, 62);
      }
      text(ctx, `${i + 1}. ${m.name}`, VIEW.width / 2 - 310, y - 2, 24, selected ? '#ffc857' : '#ffffff');
      text(ctx, m.tagline, VIEW.width / 2 - 310, y + 24, 15, 'rgba(255,255,255,0.8)');
      y += 76;
    });
    text(ctx, 'Press 1 / 2 / 3 / 4 to choose a sortie, ENTER to fly', VIEW.width / 2, y + 26, 22, '#ffffff', 'center');
    text(ctx, 'A/D or ←/→ bank · ↑/↓ pitch · W/S throttle · mouse steers · wheel throttle · C cockpit · F drop', VIEW.width / 2, y + 58, 16, 'rgba(255,255,255,0.8)', 'center');
    return;
  }

  if (inCockpit) {
    drawCockpit(ctx, world);
    drawHud(ctx, world, true);
  } else {
    drawPlane(ctx, world);
    drawHud(ctx, world, false);
  }

  if (world.screen === 'paused') {
    overlay(ctx, 'PAUSED', '#ffffff');
    text(ctx, 'P to resume · R to restart the sortie', VIEW.width / 2, 210, 22, '#ffffff', 'center');
  } else if (world.screen === 'over') {
    overlay(ctx, 'SORTIE LOST', '#ff6b5e');
    text(ctx, world.endReason, VIEW.width / 2, 196, 24, '#ffffff', 'center');
    const endY = drawScoreBreakdown(ctx, world.sheet, 268);
    text(ctx, `BEST ${world.best}`, VIEW.width / 2, endY + 26, 20, '#ffc857', 'center');
    text(ctx, 'Press R to fly again', VIEW.width / 2, endY + 62, 22, '#ffffff', 'center');
  } else if (world.screen === 'done') {
    overlay(ctx, 'SORTIE COMPLETE', '#35f0d0');
    text(ctx, world.endReason, VIEW.width / 2, 196, 24, '#ffffff', 'center');
    if (world.sheet.landingDetail) {
      text(ctx, world.sheet.landingDetail, VIEW.width / 2, 228, 17, '#bfe9ff', 'center');
    }
    if (world.sheet.dropDetail) {
      text(ctx, world.sheet.dropDetail, VIEW.width / 2, 228, 17, '#bfe9ff', 'center');
    }
    const endY = drawScoreBreakdown(ctx, world.sheet, 268);
    text(ctx, `BEST ${world.best}`, VIEW.width / 2, endY + 26, 20, '#ffc857', 'center');
    text(ctx, 'Press R to fly again · 1/2/3/4 for another sortie', VIEW.width / 2, endY + 62, 22, '#ffffff', 'center');
  }
}
