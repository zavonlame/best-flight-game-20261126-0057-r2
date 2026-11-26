// Canyon Courier — keyboard and mouse. The stick is the arrow keys or WASD,
// the throttle is W/S or Up/Down, the mouse steers gently and its wheel
// works the throttle. Every frame the game reads one plain object, so the
// autopilot can drive the same interface the player uses.

/** The live input state the game polls each frame. */
export function newInput() {
  return {
    bank: 0, // -1 left, +1 right
    pitch: 0, // -1 down, +1 up
    throttle: 0, // -1 close, +1 open (a delta, applied per second)
    brake: false,
    pause: false, // set true once when P or Escape is pressed
    confirm: false, // set true once when Enter or Space is pressed
    cockpit: false, // set true once when C is pressed: flip the camera
    drop: false, // set true once when F is pressed: release the crate
    anyKey: false,
    mouseX: 0, // -1..1 across the canvas
    mouseY: 0, // -1..1 down the canvas
    mouseActive: false,
  };
}

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'pitch-up',
  ArrowDown: 'pitch-down',
  KeyW: 'thr-up',
  KeyS: 'thr-down',
  Space: 'brake',
  KeyP: 'pause',
  Escape: 'pause',
  Enter: 'confirm',
  KeyR: 'confirm',
  KeyC: 'cockpit',
  KeyF: 'drop',
};

/** Wire the listeners; returns a function that polls the current state. */
export function attachInput(target, state) {
  const held = new Set();

  function refresh() {
    const left = held.has('left') ? 1 : 0;
    const right = held.has('right') ? 1 : 0;
    const pitchUp = held.has('pitch-up') ? 1 : 0;
    const pitchDown = held.has('pitch-down') ? 1 : 0;
    const thrUp = held.has('thr-up') ? 1 : 0;
    const thrDown = held.has('thr-down') ? 1 : 0;
    let bank = right - left;
    let pitch = pitchUp - pitchDown;
    // The mouse steers when it has moved recently: its offset from centre
    // is a gentle bank and pitch, blended under the keys.
    if (state.mouseActive) {
      bank += state.mouseX * 0.55;
      pitch += -state.mouseY * 0.45;
    }
    state.bank = Math.max(-1, Math.min(1, bank));
    state.pitch = Math.max(-1, Math.min(1, pitch));
    state.throttle = thrUp - thrDown;
    state.brake = held.has('brake');
  }

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    event.preventDefault();
    if (name === 'pause' && !event.repeat) state.pause = true;
    if (name === 'confirm' && !event.repeat) state.confirm = true;
    if (name === 'cockpit' && !event.repeat) state.cockpit = true;
    if (name === 'drop' && !event.repeat) state.drop = true;
    held.add(name);
    state.anyKey = true;
    refresh();
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    held.delete(name);
    refresh();
  }

  function onMouseMove(event) {
    const rect = target.getBoundingClientRect();
    state.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    state.mouseActive = true;
    refresh();
  }

  function onWheel(event) {
    event.preventDefault();
    state.throttle = event.deltaY < 0 ? 1 : -1;
    // The wheel is a nudge, not a hold: clear it after one frame.
    setTimeout(() => {
      state.throttle = 0;
      refresh();
    }, 90);
    refresh();
  }

  function onMouseLeave() {
    state.mouseActive = false;
    refresh();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('mouseleave', onMouseLeave);
  target.tabIndex = 0;
  return refresh;
}
