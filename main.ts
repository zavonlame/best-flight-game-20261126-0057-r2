// Canyon Courier, round 2 — the hand-in program.
//
// Node 22, standard library only. It takes the game and the four
// screenshots from beside this file, lays them into the output directory
// the grader hands it, and writes the dossier the judge reads, through the
// vendored make.fun helper.
//
// The grader runs this twice and compares the two outputs byte for byte,
// so nothing here may depend on the clock, the network, or the machine:
// just copies, a size audit, and one dossier write.
//
// To try it at home:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// What the scorer allows, stated here so a bad hand-in fails at home
// with a readable message instead of failing quietly on the server.
const LIMITS = {
  dossierBytes: 163840,
  shotsAllowed: 4,
  shotBytes: 262144,
  gameFiles: 993,
  gameBytes: 50331648,
  pathBytes: 1000,
  shotsWanted: 4,
  indexBytes: 1048576,
};

class HandInError extends Error {
  constructor(what) {
    super(`canyon-courier round 2: ${what}`);
    this.name = 'HandInError';
  }
}

function abort(what) {
  throw new HandInError(what);
}

// Every file under a directory, as paths relative to that directory,
// directories first in the walk order so the list is stable.
function listUnder(dir, base = dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listUnder(full, base, acc);
    else if (entry.isFile()) acc.push(full.slice(base.length + 1));
  }
  return acc;
}

function byteLength(text) {
  return Buffer.byteLength(text, 'utf8');
}

// The audit pass: confirms the game and the screenshots are present and
// inside the scorer's caps, and returns the counts the log line reports.
function audit(root) {
  const gameDir = join(root, 'game');
  const shotsDir = join(root, 'screenshots');
  const index = join(gameDir, 'index.html');

  if (!existsSync(index)) abort('game/index.html is missing');
  if (statSync(index).size > LIMITS.indexBytes) {
    abort('game/index.html is over 1 MiB');
  }

  const files = listUnder(gameDir);
  if (files.length > LIMITS.gameFiles) {
    abort(`game/ holds ${files.length} files, the cap is ${LIMITS.gameFiles}`);
  }
  let bytes = 0;
  for (const rel of files) {
    if (byteLength(rel) > LIMITS.pathBytes) abort(`game path too long: ${rel}`);
    bytes += statSync(join(gameDir, rel)).size;
  }
  if (bytes > LIMITS.gameBytes) {
    abort(`game/ is ${bytes} bytes, the cap is ${LIMITS.gameBytes}`);
  }

  if (!existsSync(shotsDir)) abort('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length !== LIMITS.shotsWanted) {
    abort(`screenshots/ holds ${shots.length} images, this round ships ${LIMITS.shotsWanted}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > LIMITS.shotBytes) {
      abort(`screenshot ${name} is ${size} bytes, the cap is 256 KiB`);
    }
  }

  return { files: files.length, bytes, shots: shots.length };
}

// The delivery pass: copies the game and the screenshots, then writes
// dossier.json from the vendored helper.
function deliver(root, outDir) {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: LIMITS.dossierBytes,
    screenshots: { max: LIMITS.shotsAllowed, max_bytes: LIMITS.shotBytes },
    game_max_files: LIMITS.gameFiles,
    game_max_bytes: LIMITS.gameBytes,
    game_path_max_bytes: LIMITS.pathBytes,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  return byteLength(dossier);
}

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const counts = audit(root);
const dossierBytes = deliver(root, outDir);
console.log(
  `canyon-courier round 2: ${counts.files} game files (${counts.bytes} bytes), ` +
    `${counts.shots} screenshots, dossier.json ${dossierBytes} bytes.`,
);
