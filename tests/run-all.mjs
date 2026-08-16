// Runs every suite in turn and prints one combined tally.
//
//   node tests/run-all.mjs            all four
//   node tests/run-all.mjs intake     just one (or several)
//
// Each suite boots its own copy of server.js on its own port, so they are run
// sequentially rather than in parallel.
//
// The pass/fail counts come from each suite's printed summary line, not from
// its exit code. On Windows, Node can abort during interpreter teardown
// (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) once process.exit
// races the still-listening server — that happens strictly after the suite has
// finished and printed its result, so the exit code is not trustworthy there.
// A suite that dies *before* printing a summary has genuinely failed, and is
// reported as such.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['contact', 'inbound', 'intake', 'limits'];

const wanted = process.argv.slice(2);
const unknown = wanted.filter(w => !ALL.includes(w));
if (unknown.length) {
  console.error(`unknown suite(s): ${unknown.join(', ')}\nknown: ${ALL.join(', ')}`);
  process.exit(2);
}
const suites = wanted.length ? wanted : ALL;

function run(name) {
  return new Promise((resolve) => {
    const file = path.join(here, `${name}.test.mjs`);
    const child = spawn(process.execPath, [file], { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });

    let out = '';
    child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });

    child.on('close', (code) => {
      const m = out.match(/^(\d+) passed, (\d+) failed$/m);
      if (!m) {
        resolve({ name, pass: 0, fail: 0, crashed: true, code });
        return;
      }
      resolve({ name, pass: Number(m[1]), fail: Number(m[2]), crashed: false, code });
    });
  });
}

const results = [];
for (const name of suites) {
  console.log(`\n${'='.repeat(60)}\n  ${name}\n${'='.repeat(60)}`);
  results.push(await run(name));
}

console.log(`\n${'='.repeat(60)}\n  summary\n${'='.repeat(60)}`);
let pass = 0, fail = 0, broken = 0;
for (const r of results) {
  if (r.crashed) {
    broken++;
    console.log(`  ${r.name.padEnd(9)} DID NOT FINISH (exit ${r.code}) — no summary line`);
    continue;
  }
  pass += r.pass;
  fail += r.fail;
  console.log(`  ${r.name.padEnd(9)} ${String(r.pass).padStart(3)} passed  ${r.fail} failed`);
}

console.log(`\n  total     ${String(pass).padStart(3)} passed  ${fail} failed`
  + (broken ? `  ${broken} suite(s) did not finish` : ''));

process.exit(fail || broken ? 1 : 0);
