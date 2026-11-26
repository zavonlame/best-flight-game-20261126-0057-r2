// Canyon Courier — the boot and the loop. It opens the canvas, owns the
// title/play/pause/end flow, polls the input once a frame and hands the
// world to the renderer. A ?shot= URL stages a deterministic screenshot
// scene instead of the title screen and draws it once, so a headless
// browser's first paint is already the shot.

import { VIEW } from './config.js';
import { listMissions } from './missions.js';
import { newWorld, resetWorld, stepWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_DONE } from './world.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { newInput, attachInput } from './input.js';
import { newAudio, unlockAudio, updateAudio, ringChime, thud } from './audio.js';

const SEED = 7;

function queryShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  return { name: shot, seed: Number(params.get('seed') || SEED) };
}

function main() {
  const canvas = document.getElementById('game');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');

  // Screenshot mode: stage the scene, draw it once, and stop. No loop, no
  // audio, no input — the frame is deterministic from the seed alone.
  const shot = queryShot();
  if (shot) {
    const world = stageShot(shot.name, shot.seed);
    render(ctx, world, world.missionIndex);
    document.title = `Canyon Courier — shot ${shot.name}`;
    return;
  }

  const missions = listMissions();
  let selectedMission = 0;
  let world = newWorld(SEED, missions[0], 0);
  const input = newInput();
  attachInput(window, input);
  const audio = newAudio();
  let last = performance.now();

  function startSortie(index) {
    selectedMission = index;
    world = newWorld(SEED, missions[index], index);
    world.screen = SCREEN_PLAY;
    unlockAudio(audio);
  }

  function onKey(event) {
    if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' || event.code === 'Digit4') {
      const index = Number(event.code.slice(-1)) - 1;
      if (index < missions.length && world.screen !== SCREEN_PLAY) {
        selectedMission = index;
        world = newWorld(SEED, missions[index], index);
      }
    }
    if (event.code === 'Enter' && world.screen === SCREEN_TITLE) startSortie(selectedMission);
    if ((event.code === 'KeyR') && (world.screen === SCREEN_OVER || world.screen === SCREEN_DONE || world.screen === SCREEN_PAUSED)) {
      world = resetWorld(world);
      world.screen = SCREEN_PLAY;
      unlockAudio(audio);
    }
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', () => unlockAudio(audio), { once: true });

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (input.pause) {
      input.pause = false;
      if (world.screen === SCREEN_PLAY) world.screen = SCREEN_PAUSED;
      else if (world.screen === SCREEN_PAUSED) world.screen = SCREEN_PLAY;
    }
    if (input.confirm && world.screen === SCREEN_TITLE) {
      input.confirm = false;
      startSortie(selectedMission);
    } else {
      input.confirm = false;
    }

    if (world.screen === SCREEN_PLAY) {
      stepWorld(world, input, dt);
      for (const event of world.events) {
        if (event.kind === 'ring') ringChime(audio);
        if (event.kind === 'warn') thud(audio);
      }
      updateAudio(audio, world.plane);
    }
    // One-shot keys are consumed by the step above: clear them so a single
    // press never flips the camera twice or drops two crates.
    input.cockpit = false;
    input.drop = false;
    render(ctx, world, selectedMission);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
