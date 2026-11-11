// Speed test for content.js checkAndSkip with a remote list the size of
// Soul Over AI (1375 artists). Run from the repo root: node tests/perf.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const remote = Array.from({ length: 1375 }, (_, i) => ({ name: `Synthetic Artist ${i}`, removed: false }));

const ctx = {
  console: { log() {} },
  setTimeout, setInterval, clearInterval,
  MutationObserver: class { observe() {} disconnect() {} },
  MouseEvent: class {},
  window: {},
  document: { readyState: 'loading', addEventListener() {}, querySelector: () => null, getElementById: () => null },
  fetch: async () => ({ ok: true, json: async () => remote }),
  chrome: { storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } } },
};
vm.createContext(ctx);
vm.runInContext(code, ctx);
await vm.runInContext('updateBlockList()', ctx);
vm.runInContext('performDownvoteAndSkip = () => {}; __i = 0;', ctx);

function msPerCall(songExpr, n) {
  vm.runInContext(`getSongInfo = () => (${songExpr});`, ctx);
  const call = vm.runInContext('() => { __i++; checkAndSkip(); }', ctx);
  call(); // warm up
  const t = performance.now();
  for (let i = 0; i < n; i++) call();
  return (performance.now() - t) / n;
}

// Same song every call: the player bar mutating while one song plays.
const same = msPerCall('({ artist: "Real Band • Album • 2024", title: "Clean Song" })', 500);
// A different song every call: the full list must be scanned each time.
const diff = msPerCall('({ artist: "Real Band • Album • 2024", title: "Clean Song " + __i })', 200);

const checks = [
  ['same song repeated: under 0.5 ms per call', same, 0.5],
  ['new song each call: under 6 ms per call', diff, 6],
];
let fail = 0;
for (const [label, ms, max] of checks) {
  const ok = ms < max;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${ms.toFixed(3)} ms)`);
}
console.log(`\n${checks.length - fail}/${checks.length} pass`);
process.exit(fail ? 1 : 0);
