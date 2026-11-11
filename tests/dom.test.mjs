// Page-hookup tests for content.js against a fake DOM, for both YouTube Music
// layouts: the old `ytmusic-player-bar` and the 2026 `ytmusic-miniplayer`.
// Run from the repo root: node tests/dom.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'content.js'), 'utf8');

function el(name, text = '', attrs = {}) {
  const e = {
    name, textContent: text, attrs: { ...attrs }, children: [], parentNode: null, clicks: 0, style: {},
    getAttribute: k => (k in e.attrs ? e.attrs[k] : null),
    setAttribute: (k, v) => { e.attrs[k] = String(v); },
    dispatchEvent: ev => { if (ev.type === 'click') e.clicks++; },
    querySelector: sel => (sel === 'button' ? e.children.find(c => c.name === 'button') || null : null),
    appendChild: c => { c.parentNode = e; e.children.push(c); return c; },
    insertBefore: (c, ref) => { c.parentNode = e; e.children.splice(Math.max(0, e.children.indexOf(ref)), 0, c); return c; },
    get nextSibling() { const p = e.parentNode; if (!p) return null; return p.children[p.children.indexOf(e) + 1] || null; },
  };
  return e;
}

function layout(kind) {
  const m = {}; // selector -> element
  if (kind === 'new') {
    const bar = el('ytmusic-miniplayer');
    const right = bar.appendChild(el('div'));
    right.appendChild(el('like-button-view-model'));
    const dis = right.appendChild(el('dislike-button-view-model'));
    const disBtn = dis.appendChild(el('button', '', { 'aria-label': 'Dislike this video', 'aria-pressed': 'false' }));
    Object.assign(m, {
      'ytmusic-miniplayer': bar,
      'ytmusic-miniplayer .ytmusicTrackInfoTitle': el('div', "Gangsta's Paradise"),
      'ytmusic-miniplayer .ytmusicTrackInfoByline': el('div', '1950 SoulClub • Album'),
      'ytmusic-miniplayer button[aria-label="Next"]': el('button', '', { 'aria-label': 'Next' }),
      'ytmusic-miniplayer dislike-button-view-model': dis,
    });
    return { m, next: m['ytmusic-miniplayer button[aria-label="Next"]'], dislikeBtn: disBtn, anchorParent: right };
  }
  const bar = el('ytmusic-player-bar');
  const mid = bar.appendChild(el('div'));
  const dis = mid.appendChild(el('ytmusic-like-button-renderer'));
  const disBtn = dis.appendChild(el('button', '', { 'aria-pressed': 'false' }));
  const menu = mid.appendChild(el('ytmusic-menu-renderer'));
  Object.assign(m, {
    'ytmusic-player-bar': bar,
    'ytmusic-player-bar .title': el('div', 'Old Song'),
    'ytmusic-player-bar .byline': el('div', 'Old Artist • Album'),
    'ytmusic-player-bar .next-button': el('button'),
    'ytmusic-player-bar .dislike': dis,
    'ytmusic-player-bar .middle-controls-buttons': mid,
    'ytmusic-player-bar .middle-controls-buttons ytmusic-menu-renderer': menu,
    'ytmusic-player-bar ytmusic-menu-renderer': menu,
  });
  return { m, next: m['ytmusic-player-bar .next-button'], dislikeBtn: disBtn, anchorParent: mid };
}

function load(kind) {
  const L = layout(kind);
  let injected = null;
  const document = {
    readyState: 'loading', addEventListener() {}, body: {},
    // Comma-separated selector lists: first part that this layout knows wins.
    querySelector: sel => {
      for (const part of sel.split(',').map(s => s.trim())) if (L.m[part]) return L.m[part];
      return null;
    },
    getElementById: id => (injected && id === injected.id ? injected : null),
    createElement: name => { const e = el(name); if (name === 'div') injected = e; return e; },
  };
  const ctx = {
    console: { log() {} }, window: {}, document,
    setTimeout: () => 0, setInterval: () => 0, clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} },
    MouseEvent: class { constructor(type) { this.type = type; } },
    fetch: async () => ({ ok: false }),
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } } },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, L, getInjected: () => injected };
}

const run = (ctx, js) => vm.runInContext(js, ctx);
const cases = [];
for (const kind of ['old', 'new']) {
  const want = kind === 'new'
    ? { title: "Gangsta's Paradise", artist: '1950 SoulClub • Album' }
    : { title: 'Old Song', artist: 'Old Artist • Album' };
  cases.push([`${kind} layout: getSongInfo reads title and artist`, () => {
    const { ctx } = load(kind);
    const s = run(ctx, 'JSON.stringify(getSongInfo())');
    return s === JSON.stringify(want) || `got ${s}`;
  }]);
  cases.push([`${kind} layout: skipTrack clicks Next`, () => {
    const { ctx, L } = load(kind);
    run(ctx, 'skipTrack()');
    return L.next.clicks === 1 || `Next clicks = ${L.next.clicks}`;
  }]);
  cases.push([`${kind} layout: performDownvoteAndSkip clicks Dislike`, () => {
    const { ctx, L } = load(kind);
    run(ctx, 'performDownvoteAndSkip()');
    return L.dislikeBtn.clicks === 1 || `Dislike clicks = ${L.dislikeBtn.clicks}`;
  }]);
  cases.push([`${kind} layout: injectButtons adds the block buttons to the bar`, () => {
    const { ctx, L, getInjected } = load(kind);
    run(ctx, 'injectButtons()');
    const c = getInjected();
    return (c && c.id === 'ytm-ward-controls' && c.parentNode === L.anchorParent && c.children.length === 2)
      || `container ${c ? `id=${c.id} children=${c.children.length} placed=${c.parentNode === L.anchorParent}` : 'not created'}`;
  }]);
}

let fail = 0;
for (const [label, fn] of cases) {
  let r;
  try { r = fn(); } catch (e) { r = `threw ${e.message}`; }
  if (r !== true) fail++;
  console.log(`${r === true ? 'PASS' : 'FAIL'}  ${label}${r === true ? '' : `  (${r})`}`);
}
console.log(`\n${cases.length - fail}/${cases.length} pass`);
process.exit(fail ? 1 : 0);
