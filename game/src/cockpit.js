// Canyon Courier — the cockpit. The view from inside the plane: the world
// through the windshield, a dashboard of round gauges that all read live
// from the flight model, and the nose cowling at the bottom of the frame.
// Press C to flip between this and the chase camera mid-flight. Every
// gauge here is a real instrument — airspeed, altitude, attitude and
// heading are the plane's own numbers, not decoration.

import { VIEW } from './config.js';

const PANEL = '#141c24';
const PANEL_EDGE = '#2c3a48';
const DIAL_FACE = '#0e1a24';
const DIAL_RIM = '#c8a24a';
const NEEDLE = '#ffcf5c';
const GLASS = 'rgba(190, 225, 255, 0.10)';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A round gauge bezel with a label under it; `face` draws the works. */
function dial(ctx, cx, cy, r, label, face) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = DIAL_FACE;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = DIAL_RIM;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  face(ctx, cx, cy, r);
  ctx.restore();
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#ffc857';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 17);
}

/** Tick marks around a dial, `count` of them, long ones every `major`. */
function ticks(ctx, cx, cy, r, count, major) {
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const long = i % major === 0;
    const r0 = r - (long ? 12 : 7);
    ctx.lineWidth = long ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.stroke();
  }
}

/** A needle from the dial centre at angle `a` (radians, 0 = up). */
function needle(ctx, cx, cy, r, a) {
  ctx.strokeStyle = NEEDLE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(a) * (r - 14), cy - Math.cos(a) * (r - 14));
  ctx.stroke();
  ctx.fillStyle = NEEDLE;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Airspeed dial: 0–180 kt, needle sweeps 270 degrees. */
function airspeedDial(ctx, cx, cy, r, speed) {
  dial(ctx, cx, cy, r, 'AIRSPEED KT', (c, x, y, rr) => {
    ticks(c, x, y, rr, 18, 3);
    const frac = clamp(speed / 180, 0, 1);
    needle(c, x, y, rr, -Math.PI * 0.75 + frac * Math.PI * 1.5);
    c.font = 'bold 26px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.fillText(`${Math.round(speed)}`, x, y + rr * 0.45);
  });
}

/** Altimeter dial: 0–600 ft, needle sweeps 270 degrees. */
function altimeterDial(ctx, cx, cy, r, altitude) {
  dial(ctx, cx, cy, r, 'ALT FT', (c, x, y, rr) => {
    ticks(c, x, y, rr, 12, 3);
    const frac = clamp(altitude / 600, 0, 1);
    needle(c, x, y, rr, -Math.PI * 0.75 + frac * Math.PI * 1.5);
    c.font = 'bold 26px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.fillText(`${Math.round(altitude)}`, x, y + rr * 0.45);
  });
}

/** Artificial horizon: sky and ground halves, banked with the plane. */
function attitudeDial(ctx, cx, cy, r, bank, pitch) {
  dial(ctx, cx, cy, r, 'ATTITUDE', (c, x, y, rr) => {
    c.save();
    c.translate(x, y);
    c.rotate(-bank);
    const pitchPx = clamp(pitch, -0.5, 0.5) * rr * 0.9;
    c.fillStyle = '#3f7fb5';
    c.fillRect(-rr, -rr - pitchPx, rr * 2, rr + pitchPx);
    c.fillStyle = '#7a5230';
    c.fillRect(-rr, -pitchPx, rr * 2, rr + pitchPx);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-rr, -pitchPx);
    c.lineTo(rr, -pitchPx);
    c.stroke();
    c.restore();
    // Fixed wings: the plane's own mark never moves.
    c.fillStyle = NEEDLE;
    c.fillRect(x - 22, y - 2, 14, 4);
    c.fillRect(x + 8, y - 2, 14, 4);
    c.beginPath();
    c.arc(x, y, 3, 0, Math.PI * 2);
    c.fill();
  });
}

/** Compass dial: a needle that points at the heading, N/E/S/W marked. */
function compassDial(ctx, cx, cy, r, heading) {
  dial(ctx, cx, cy, r, 'HEADING', (c, x, y, rr) => {
    const marks = [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']];
    c.font = 'bold 15px system-ui, sans-serif';
    c.textAlign = 'center';
    for (const [deg, label] of marks) {
      const a = ((deg - heading) * Math.PI) / 180;
      c.fillStyle = deg === 0 ? '#ffcf5c' : '#ffffff';
      c.fillText(label, x + Math.sin(a) * (rr - 18), y - Math.cos(a) * (rr - 18) + 5);
    }
    needle(c, x, y, rr, 0);
    c.font = 'bold 20px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText(`${Math.round(heading) % 360}°`, x, y + rr * 0.5);
  });
}

/** A labelled bar: throttle, fuel, damage — the small stuff, kept honest. */
function bar(ctx, x, y, w, label, frac, color) {
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#ffc857';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y + 6, w, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 6, Math.max(0, w * clamp(frac, 0, 1)), 10);
}

/**
 * The cockpit itself: dashboard panel with the four dials, the bars, the
 * nose cowling and the windshield struts over the world the caller drew.
 */
export function drawCockpit(ctx, world) {
  const plane = world.plane;
  const panelY = VIEW.height - 196;

  // Nose cowling: the engine cover at the bottom centre of the windshield.
  ctx.fillStyle = '#e8b64c';
  ctx.beginPath();
  ctx.moveTo(VIEW.width / 2 - 150, VIEW.height);
  ctx.lineTo(VIEW.width / 2 - 90, panelY + 30);
  ctx.quadraticCurveTo(VIEW.width / 2, panelY + 8, VIEW.width / 2 + 90, panelY + 30);
  ctx.lineTo(VIEW.width / 2 + 150, VIEW.height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath();
  ctx.ellipse(VIEW.width / 2, panelY + 26, 46, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Propeller blur, a disc the pilot sees edge-on over the nose.
  ctx.fillStyle = 'rgba(210, 225, 235, 0.30)';
  ctx.beginPath();
  ctx.ellipse(VIEW.width / 2, panelY + 22, 110, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dashboard panel.
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, panelY, VIEW.width, VIEW.height - panelY);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, panelY + 0.5);
  ctx.lineTo(VIEW.width, panelY + 0.5);
  ctx.stroke();

  const cy = panelY + 88;
  const r = 62;
  airspeedDial(ctx, 170, cy, r, plane.speed);
  attitudeDial(ctx, 400, cy, r, plane.bank, plane.pitch);
  altimeterDial(ctx, 630, cy, r, plane.y);
  compassDial(ctx, 860, cy, r, plane.heading);

  // Bars on the right of the dials.
  const bx = 1000;
  bar(ctx, bx, panelY + 42, 220, 'THROTTLE', plane.throttle, '#35f0d0');
  bar(ctx, bx, panelY + 82, 220, 'FUEL', plane.fuel / 100, plane.fuel < 25 ? '#ff6b5e' : '#7ec8ff');
  bar(ctx, bx, panelY + 122, 220, 'DAMAGE', plane.damage / 100, plane.damage > 60 ? '#ff6b5e' : '#ffb347');
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`FUEL ${Math.round(plane.fuel)}%`, bx, panelY + 168);
  if (plane.stalled) {
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText('STALL', bx + 120, panelY + 168);
  }

  // Windshield struts: two dark bars framing the view, plus a top glare.
  ctx.fillStyle = 'rgba(10, 18, 26, 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(120, 0);
  ctx.lineTo(60, panelY);
  ctx.lineTo(0, panelY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(VIEW.width, 0);
  ctx.lineTo(VIEW.width - 120, 0);
  ctx.lineTo(VIEW.width - 60, panelY);
  ctx.lineTo(VIEW.width, panelY);
  ctx.closePath();
  ctx.fill();
  const glare = ctx.createLinearGradient(0, 0, 0, 90);
  glare.addColorStop(0, 'rgba(255, 246, 230, 0.14)');
  glare.addColorStop(1, 'rgba(255, 246, 230, 0)');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, VIEW.width, 90);
}
