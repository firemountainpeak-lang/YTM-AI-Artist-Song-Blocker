// Block-logic tests for content.js. Loads it in a vm with stub chrome/DOM.
// Run from the repo root: node tests/content.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const remote = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/artists.sample.json'), 'utf8'));

function makeCtx(local) {
  const ctx = {
    console: { log() {} },
    setTimeout, clearInterval, setInterval,
    MutationObserver: class { observe() {} disconnect() {} },
    MouseEvent: class {},
    window: {},
    document: { readyState: 'loading', addEventListener() {}, querySelector: () => null, getElementById: () => null },
    fetch: async () => ({ ok: true, json: async () => remote }),
    chrome: { storage: {
      local: { get: async () => local, set: async () => {} },
      onChanged: { addListener() {} },
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

async function blocked(local, artist, title) {
  const ctx = makeCtx(local);
  await vm.runInContext('updateBlockList()', ctx);
  ctx.__song = { artist, title };
  vm.runInContext('getSongInfo = () => __song; performDownvoteAndSkip = () => { __hit = true; }; __hit = false; checkAndSkip();', ctx);
  return ctx.__hit;
}

const none = {};
const cases = [
  // [label, local storage, artist (player-bar byline), title, expected blocked?]
  ['remote artist "10mm" blocked', none, '10mm', 'Some Song', true],
  ['remote artist "1950 SoulClub" blocked', none, '1950 SoulClub • Album • 2025', 'Night', true],
  ['remote artist marked removed is not blocked', none, 'Gone Artist', 'Song', false],
  ['unlisted artist not blocked', none, 'Real Band', 'Song', false],
  ['local artist', { blockedArtists: ['Drake'] }, 'Drake', 'Hotline', true],
  ['local artist case-insensitive', { blockedArtists: ['drake'] }, 'DRAKE', 'Hotline', true],
  ['keyword: no partial word ("After" vs "Afterpiece")', { blockedKeywords: ['After'] }, 'X', 'Afterpiece', false],
  ['keyword: whole word in title', { blockedKeywords: ['After'] }, 'X', 'After Dark', true],
  ['accented artist "Beyoncé"', { blockedArtists: ['Beyoncé'] }, 'Beyoncé', 'Halo', true],
  ['accented: no partial word ("Beyoncé" vs "Beyoncés")', { blockedArtists: ['Beyoncé'] }, 'Beyoncés', 'Halo', false],
  ['CJK artist "米津玄師"', { blockedArtists: ['米津玄師'] }, '米津玄師', 'Lemon', true],
  ['artist ending in "!" ("Panic!")', { blockedArtists: ['Panic!'] }, 'Panic! • Album', 'High Hopes', true],
  ['artist with "$" ("Ke$ha")', { blockedArtists: ['Ke$ha'] }, 'Ke$ha', 'Tik Tok', true],
  ['blocked song: same title + artist is blocked', { blockedTracks: [{ title: 'Love', artist: 'A • Album • 2020' }] }, 'A • Album • 2020', 'Love', true],
  ['blocked song: same artist, byline differs after "•"', { blockedTracks: [{ title: 'Love', artist: 'A • Album • 2020' }] }, 'A • 3.1M views', 'Love', true],
  ['blocked song: title case-insensitive', { blockedTracks: [{ title: 'Love', artist: 'A' }] }, 'A', 'LOVE', true],
  ['blocked song: other song with word "love" not blocked', { blockedTracks: [{ title: 'Love', artist: 'A' }] }, 'B', 'I Love You', false],
  ['blocked song: same title, other artist not blocked', { blockedTracks: [{ title: 'Love', artist: 'A' }] }, 'B', 'Love', false],
  ['blocked song: old plain-string entry matches exact title', { blockedTracks: ['Love'] }, 'B', 'Love', true],
  ['blocked song: old plain-string entry is not a keyword', { blockedTracks: ['Love'] }, 'B', 'I Love You', false],
];

let fail = 0;
for (const [label, local, artist, title, want] of cases) {
  const got = await blocked(local, artist, title);
  if (got !== want) fail++;
  console.log(`${got === want ? 'PASS' : 'FAIL'}  ${label}  (want ${want}, got ${got})`);
}
console.log(`\n${cases.length - fail}/${cases.length} pass`);
process.exit(fail ? 1 : 0);
