// Shared bits every suite needs.
//
// The suites import ../server.js directly and drive it over loopback, so the
// path has to be resolved from this file rather than hardcoded — that is the
// one thing that stopped these from living in the repo before.

import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(here, '..');

/** `import(SERVER)` boots the real server with whatever env the suite has set. */
export const SERVER = pathToFileURL(path.join(REPO_ROOT, 'server.js')).href;

/** Scratch space for upload fixtures, wiped at the start of each run. */
export function tmpDir(name) {
  const dir = path.join(here, '.tmp', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir.replace(/\\/g, '/');
}

/** Tally that prints as it goes, so a hang shows you the last thing that passed. */
export function tally() {
  const state = { pass: 0, fail: 0 };
  const check = (name, cond, extra = '') => {
    if (cond) { state.pass++; console.log(`  ok   ${name}`); }
    else { state.fail++; console.log(`  FAIL ${name} ${extra}`); }
  };
  const done = () => {
    console.log(`\n${state.pass} passed, ${state.fail} failed`);
    process.exit(state.fail ? 1 : 0);
  };
  return { check, done, state };
}
