// Canyon Courier — sound, synthesised, no audio files. A WebAudio engine
// hum follows the throttle, wind follows speed, a chime marks each ring and
// a thud marks a hard landing. Everything is created after the first user
// gesture; screenshot mode never starts audio at all.

/** Create the sound engine. Call `unlock()` from a user gesture. */
export function newAudio() {
  return {
    ctx: null,
    engine: null,
    engineGain: null,
    wind: null,
    windGain: null,
    enabled: true,
  };
}

/** Build the AudioContext and the looping voices. Safe to call twice. */
export function unlockAudio(audio) {
  if (!audio.enabled || audio.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    // Engine: two detuned sawtooths through a low-pass filter.
    audio.engine = audio.ctx.createOscillator();
    audio.engine.type = 'sawtooth';
    audio.engine.frequency.value = 68;
    const second = audio.ctx.createOscillator();
    second.type = 'sawtooth';
    second.frequency.value = 69.5;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    audio.engine.connect(filter);
    second.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.ctx.destination);
    audio.engine.start();
    second.start();
    audio.engineSecond = second;
    // Wind: looped noise through a band-pass filter.
    const length = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    audio.wind = audio.ctx.createBufferSource();
    audio.wind.buffer = buffer;
    audio.wind.loop = true;
    const windFilter = audio.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0.0;
    audio.wind.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.ctx.destination);
    audio.wind.start();
  } catch {
    audio.enabled = false;
  }
}

/** Follow the plane: engine pitch with throttle, wind with speed. */
export function updateAudio(audio, plane) {
  if (!audio.ctx || !audio.enabled) return;
  const t = audio.ctx.currentTime;
  const throttle = plane.throttle;
  audio.engine.frequency.setTargetAtTime(58 + throttle * 64, t, 0.08);
  if (audio.engineSecond) audio.engineSecond.frequency.setTargetAtTime(59.5 + throttle * 64, t, 0.08);
  audio.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.05, t, 0.1);
  audio.windGain.gain.setTargetAtTime(Math.max(0, (plane.speed - 70) / 220), t, 0.15);
}

/** A short two-note chime when a ring is flown. */
export function ringChime(audio) {
  blip(audio, 880, 0.09, 0.12);
  setTimeout(() => blip(audio, 1318, 0.14, 0.12), 90);
}

/** A low thud for a hard touchdown or a wall scrape. */
export function thud(audio) {
  if (!audio.ctx || !audio.enabled) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + 0.26);
}

function blip(audio, freq, duration, volume) {
  if (!audio.ctx || !audio.enabled) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}
