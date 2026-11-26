// Canyon Courier — tuning constants. One place for every number that shapes
// how the plane flies, how the canyon looks and how a sortie is scored, so
// balancing the game never means hunting through the renderer or the world.

export const VIEW = {
  width: 1280,
  height: 720,
  horizon: 0.42, // fraction of the height where the horizon sits at level flight
  fov: 1.25, // vertical field of view in radians, used by the projector
};

export const PLANE = {
  maxSpeed: 165, // knots at full throttle, level flight
  cruiseSpeed: 118,
  minSpeed: 62, // below this the wing stalls and the nose drops
  accel: 26, // knots gained per second at full throttle
  drag: 0.14, // fraction of speed bled per second with throttle closed
  bankRate: 1.9, // radians per second of bank authority
  maxBank: 1.15, // radians, about 66 degrees
  pitchRate: 0.9, // radians per second of pitch authority
  maxPitch: 0.55,
  climbPerPitch: 62, // feet per second of climb at full up-pitch and cruise
  turnPerBank: 0.62, // lateral drift per second at full bank, in valley units
  crashSpeed: 34, // vertical speed (ft/s) above which a ground strike is fatal
};

export const WORLD = {
  valleyHalfWidth: 1.0, // lateral position runs -1 (west wall) to +1 (east wall)
  lateralFeet: 620, // feet across one valley unit; maps x to the world
  wallStart: 0.66, // beyond this the canyon walls rise steeply
  floorHeight: 0, // valley floor, feet
  wallHeight: 620, // canyon rim, feet
  courseLength: 9200, // metres of canyon per sortie
  ringRadius: 46, // feet; a generous ring so a good line always fits
  ringScore: 250,
  fuelDrain: 0.55, // percent of tank per second at full throttle
  fuelIdleDrain: 0.12,
  gustStrength: 0.22, // lateral push in slalom sorties
};

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'RING RUN',
    tagline: 'Twelve rings down the canyon. Smooth lines beat fast hands.',
    rings: 12,
    timeLimit: 180,
    fuel: 100,
    wind: 0,
    landing: false,
  },
  {
    id: 'slalom',
    name: 'CANYON SLALOM',
    tagline: 'Fourteen gates, alternating walls, gusts that shove you sideways.',
    rings: 14,
    timeLimit: 185,
    fuel: 100,
    wind: 1,
    landing: false,
  },
  {
    id: 'dusty-landing',
    name: 'DUSTY LANDING',
    tagline: 'Six rings, then put her down soft on a short desert strip.',
    rings: 6,
    timeLimit: 210,
    fuel: 100,
    wind: 0,
    landing: true,
  },
  {
    id: 'supply-drop',
    name: 'SUPPLY DROP',
    tagline: 'Four rings, then drop the crate on the painted circle. Wind decides the rest.',
    rings: 4,
    timeLimit: 210,
    fuel: 100,
    wind: 1,
    landing: false,
    drop: true,
  },
];

export const SCORE = {
  ring: 250,
  gateStreakBonus: 50, // extra per ring when the last three were all hit
  timeBonusPerSecond: 10, // seconds left on the clock at mission end
  fuelBonusPerPercent: 5, // fuel left at mission end
  landingAlignment: 400, // perfect centreline touchdown
  landingSoftness: 300, // gentle vertical speed at touchdown
  dropBullseye: 600, // crate dead centre on the painted circle
  dropRing: 300, // crate inside the circle at all
};

export const SHOTS = {
  // name -> seconds of autopilot flight before the frame is taken. The
  // landing sortie needs ~160 s to reach its runway (9,200 m at ~58 m/s),
  // so the approach and landing shots run long; the loop stops early when
  // the sortie ends on its own. Four shots, four different frames: the
  // cover chases a ring, the cockpit shot flies from inside the plane, the
  // drop shot catches the crate under its canopy, the landing shot ends on
  // the strip.
  cover: { mission: 0, seconds: 30, seed: 7 },
  cockpit: { mission: 0, seconds: 62, seed: 7, view: 'cockpit' },
  drop: { mission: 3, seconds: 119, seed: 7 },
  landing: { mission: 2, seconds: 200, seed: 7 },
};
