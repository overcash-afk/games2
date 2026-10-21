'use strict';
(() => {
// ============================================================================
// Tipsy Links: first-person party golf for up to four players.
// One player hosts; friends join with a six-character code or an invite link.
// The host's browser keeps the scorecard and moves everyone through the holes.
// Each player simulates their own shots and shares the ball's path so the
// others can watch it fly. Transport: WebRTC data channels introduced by the
// public PeerJS broker, or a BroadcastChannel between tabs of one browser.
// ============================================================================
const VERSION = 1, MAX_PLAYERS = 4, PEER_PREFIX = 'tipsylinks-';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const now = () => performance.now();
const D2R = Math.PI / 180, YD = 1.09361, FT = 3.28084, MPH = 2.23694;
const yds = m => Math.round(m * YD);
const fmtDist = m => m < 20 ? Math.max(1, Math.round(m * FT)) + ' ft' : yds(m) + ' yds';
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm(x, y, s, oct) { let t = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2.03; } return t / n; }

const SET = { name: '', snd: true, cam: false, fx: true };
try { Object.assign(SET, JSON.parse(localStorage.getItem('tipsylinks.set') || '{}')); } catch (e) {}
const saveSet = () => { try { localStorage.setItem('tipsylinks.set', JSON.stringify(SET)); } catch (e) {} };

// ============================ sound ============================
let AC = null, master = null, noiseBuf = null;
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC && SET.snd ? AC : null;
}
function tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0) {
  const a = audio(); if (!a) return; const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur, f0, f1, q, vol, type = 'bandpass', delay = 0, attack = 0.005) {
  const a = audio(); if (!a) return; const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = a.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const SFX = {
  whoosh: () => hiss(0.3, 400, 2600, 1.2, 0.3, 'bandpass', 0, 0.14),
  hit: () => { tone(1150, 280, 0.09, 'triangle', 0.5); hiss(0.06, 3200, 1600, 0.8, 0.35, 'highpass'); },
  putt: () => tone(720, 520, 0.06, 'triangle', 0.35),
  land: () => hiss(0.12, 320, 120, 1, 0.22, 'lowpass'),
  cup: () => { for (let i = 0; i < 3; i++) tone(1400 - i * 200, 900 - i * 100, 0.05, 'square', 0.1, 0.05 + i * 0.09); },
  lip: () => tone(1500, 1300, 0.05, 'square', 0.08),
  splash: () => { hiss(0.7, 2200, 260, 0.6, 0.4, 'lowpass', 0, 0.01); hiss(0.4, 800, 3000, 2, 0.12, 'bandpass', 0.05); },
  tree: () => { hiss(0.3, 1500, 4200, 0.7, 0.18, 'bandpass'); tone(210, 120, 0.08, 'square', 0.12); },
  glug: () => { for (let i = 0; i < 4; i++) tone(170 + Math.random() * 60, 85, 0.12, 'sine', 0.35, i * 0.16); },
  shot: () => { tone(150, 55, 0.3, 'sine', 0.4); tone(90, 50, 0.2, 'sine', 0.3, 0.32); hiss(0.4, 700, 200, 1, 0.12, 'lowpass', 0.55); },
  cheer: () => { hiss(1.5, 900, 1300, 0.5, 0.22, 'bandpass', 0, 0.3); hiss(1.3, 2100, 2500, 0.5, 0.1, 'bandpass', 0.1, 0.3); },
  chime: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.35, 'triangle', 0.18, i * 0.09)),
  clink: () => { tone(2600, 2500, 0.3, 'sine', 0.14); tone(3300, 3200, 0.22, 'sine', 0.09, 0.03); },
  aww: () => tone(420, 240, 0.7, 'sawtooth', 0.05),
  tick: () => tone(1800, 1800, 0.02, 'square', 0.05),
  thud: () => { tone(130, 45, 0.25, 'square', 0.3); hiss(0.25, 900, 200, 0.8, 0.3, 'lowpass'); },
  horn: () => { tone(392, 392, 0.22, 'square', 0.12); tone(494, 494, 0.22, 'square', 0.1); },
  hic: () => { tone(520, 980, 0.06, 'square', 0.08); tone(900, 380, 0.08, 'triangle', 0.08, 0.06); },
};

// ============================ clubs and surfaces ============================
// carry: metres on flat ground at full power, sober, no wind. The putter's is roll distance on the green.
const CLUBS = [
  { id: 'D', name: 'Driver', carry: 210, ang: 12, lift: 0.0026, bite: 0, side: 1 },
  { id: '3W', name: '3 Wood', carry: 190, ang: 13, lift: 0.0028, bite: 0.1, side: 0.95 },
  { id: '5I', name: '5 Iron', carry: 160, ang: 16, lift: 0.0030, bite: 0.35, side: 0.85 },
  { id: '7I', name: '7 Iron', carry: 140, ang: 19, lift: 0.0032, bite: 0.5, side: 0.8 },
  { id: '9I', name: '9 Iron', carry: 120, ang: 24, lift: 0.0033, bite: 0.6, side: 0.72 },
  { id: 'PW', name: 'Wedge', carry: 100, ang: 30, lift: 0.0033, bite: 0.7, side: 0.65 },
  { id: 'SW', name: 'Sand Wedge', carry: 70, ang: 38, lift: 0.0032, bite: 0.8, side: 0.55 },
  { id: 'PT', name: 'Putter', carry: 18, putt: true },
];
const PUTTER = CLUBS.length - 1;
const SURF = {
  tee: { name: 'Tee box', e: 0.3, f: 0.66, mu: 0.18, lie: 1 },
  fairway: { name: 'Fairway', e: 0.3, f: 0.66, mu: 0.18, lie: 1 },
  rough: { name: 'Rough', e: 0.2, f: 0.45, mu: 0.38, lie: 0.82 },
  fringe: { name: 'Fringe', e: 0.26, f: 0.66, mu: 0.11, lie: 0.97 },
  green: { name: 'Green', e: 0.2, f: 0.74, mu: 0.06, lie: 1 },
  sand: { name: 'Bunker', e: 0.05, f: 0.15, mu: 0.9, lie: 0.6 },
  water: { name: 'Water', e: 0, f: 0, mu: 1, lie: 1 },
  oob: { name: 'Out of bounds', e: 0.2, f: 0.5, mu: 0.35, lie: 0.8 },
};
const G = 9.81, KD = 0.0047, BR = 0.03, CUP_R = 0.1, SIM_DT = 1 / 240, SPIN_DECAY = Math.exp(-SIM_DT / 5);
function flatCarry(c, v0) {
  let pz = 0, py = 0, vy = v0 * Math.sin(c.ang * D2R), vz = -v0 * Math.cos(c.ang * D2R), L = c.lift;
  for (let i = 0; i < 30 / SIM_DT; i++) {
    const sp = Math.hypot(vy, vz) || 1e-6, uy = vy / sp, uz = vz / sp;
    let ly = 1 - uy * uy, lz = -uy * uz; const ll = Math.hypot(ly, lz) || 1; ly /= ll; lz /= ll;
    vy += (-G - KD * sp * vy + L * sp * sp * ly) * SIM_DT; vz += (-KD * sp * vz + L * sp * sp * lz) * SIM_DT; L *= SPIN_DECAY;
    py += vy * SIM_DT; pz += vz * SIM_DT; if (py < 0 && vy < 0) break;
  }
  return -pz;
}
for (const c of CLUBS) if (!c.putt) { c.tab = []; for (let v = 0; v <= 150; v++) c.tab.push(flatCarry(c, v)); }
function v0For(c, d) { const T = c.tab; for (let i = 1; i < T.length; i++) if (T[i] >= d) return i - 1 + (d - T[i - 1]) / (T[i] - T[i - 1]); return T.length - 1; }

// ============================ drinking ============================
// Buzz is in "drinks": a sip adds 1, a shot adds 3, and it wears off at one drink per four minutes.
const BUZZ = { b: 0, x: 0, at: now(), si: 0, sh: 0 };
const BUZZ_MAX = 20, BUZZ_DECAY_S = 240;
function buzz() { const t = now(), k = (t - BUZZ.at) / 1000 / BUZZ_DECAY_S; BUZZ.b = Math.max(0, BUZZ.b - k); BUZZ.x = Math.max(0, BUZZ.x - k); BUZZ.at = t; return BUZZ.b; }
// How drunk you play and look: your power buzz plus funnels, which wobble you without adding power.
function drunk() { buzz(); return Math.min(BUZZ_MAX, BUZZ.b + BUZZ.x); }
const powerMult = (putt) => 1 + (putt ? 0.075 : 0.15) * buzz();
const LEVELS = [[0, 'Sober'], [1.5, 'Warming up'], [3.5, 'Buzzed'], [6, 'Tipsy'], [9, 'Loose'], [12, 'Drunk'], [15, 'Hammered'], [18, 'Legendary']];
const buzzName = b => { let n = LEVELS[0][1]; for (const [v, s] of LEVELS) if (b >= v) n = s; return n; };
// skip: the sip that pays for skipping to your ball. It counts as a drink but adds no power.
function drink(kind, skip) {
  if (CART.driving && !skip) { toast('🚔 No drinking and driving! Park the cart first.'); return; }
  buzz(); if (!skip) BUZZ.b = Math.min(BUZZ_MAX, BUZZ.b + (kind === 'shot' ? 3 : 1));
  if (kind === 'shot') { BUZZ.sh++; SFX.shot(); } else { BUZZ.si++; SFX.glug(); }
  flash(); toHost({ t: 'drink', k: kind, bz: Math.round(drunk() * 10) / 10, skip: skip ? 1 : 0 });
}
let flashT = 0;
function flash() { flashT = now(); }

// ============================ course generation ============================
const PARS18 = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
const holePar = (idx, nh) => nh === 3 ? [4, 3, 5][idx] : PARS18[idx % 18];
function courseName(seed) {
  const A = ['Whiskey', 'Bourbon', 'Lager', 'Tipsy', 'Hangover', 'Barley', 'Shandy', 'Stumble', 'Pint', 'Last Call', 'Happy Hour', 'Mulligan', 'Bogey', 'Hazy'];
  const B = ['Pines', 'Links', 'Hollow', 'Dunes', 'Creek', 'National', 'Downs', 'Glen', 'Valley', 'Ridge', 'Meadows', 'Springs', 'Oaks', 'Bay'];
  const R = mulberry(seed ^ 0x5bd1e995); return A[Math.floor(R() * A.length)] + ' ' + B[Math.floor(R() * B.length)];
}
function ellD(e, x, z) { const dx = x - e.x, dz = z - e.z, c = Math.cos(e.rot), s = Math.sin(e.rot); const u = dx * c + dz * s, v = -dx * s + dz * c; return Math.sqrt((u / e.rx) ** 2 + (v / e.rz) ** 2); }
function distPoly(p, x, z) {
  let best = 1e18;
  for (let i = 0; i < p.length - 2; i += 2) {
    const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1e-9;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + dx * t - x, ez = az + dz * t - z, d = ex * ex + ez * ez; if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function resample(pts, step) {
  const out = [pts[0][0], pts[0][1]], S = [0]; let acc = 0, s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], seg = Math.hypot(bx - ax, bz - az); let d = step - acc;
    while (d <= seg) { const t = d / seg; s += step; out.push(ax + (bx - ax) * t, az + (bz - az) * t); S.push(s); d += step; }
    acc = seg - (d - step);
  }
  const lx = pts[pts.length - 1][0], lz = pts[pts.length - 1][1], last = Math.hypot(lx - out[out.length - 2], lz - out[out.length - 1]);
  if (last > 0.01) { out.push(lx, lz); S.push(s + last); }
  return { p: out, s: S };
}
// Point on the centre line at distance s from the tee, and the direction of play there.
function pathAt(H, s) {
  const S = H.ps, p = H.pp; s = clamp(s, 0, H.total);
  let i = 1; while (i < S.length - 1 && S[i] < s) i++;
  const t = (s - S[i - 1]) / ((S[i] - S[i - 1]) || 1), ax = p[2 * i - 2], az = p[2 * i - 1], bx = p[2 * i], bz = p[2 * i + 1];
  const l = Math.hypot(bx - ax, bz - az) || 1;
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / l, dz: (bz - az) / l };
}
function pathProject(H, x, z) {
  const p = H.pp; let best = 1e18, bs = 0;
  for (let i = 0; i < p.length - 2; i += 2) {
    const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1e-9;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = clamp(t, 0, 1);
    const ex = ax + dx * t - x, ez = az + dz * t - z, d = ex * ex + ez * ez; if (d < best) { best = d; bs = H.ps[i / 2] + t * (H.ps[i / 2 + 1] - H.ps[i / 2]); }
  }
  return { s: bs, d: Math.sqrt(best) };
}
function genHole(seed, idx, nh) {
  const par = holePar(idx, nh);
  const R = mulberry((seed * 7919 + idx * 104729 + 17) | 0);
  const rr = (a, b) => a + (b - a) * R(), sgn = () => R() < 0.5 ? -1 : 1;
  const L = par === 3 ? rr(125, 185) : par === 4 ? rr(300, 395) : rr(445, 525);
  let segs;
  if (par === 3) segs = [[L, rr(-0.12, 0.12)]];
  else if (par === 4) { const f = rr(0.52, 0.66), a0 = rr(-0.1, 0.1), turn = R() < 0.2 ? rr(-0.08, 0.08) : sgn() * rr(0.28, 0.6); segs = [[L * f, a0], [L * (1 - f), a0 + turn]]; }
  else { const a0 = rr(-0.08, 0.08), t1 = sgn() * rr(0.2, 0.45), t2 = (R() < 0.6 ? -1 : 1) * Math.sign(t1) * rr(0.15, 0.45); segs = [[L * 0.42, a0], [L * 0.33, a0 + t1], [L * 0.25, a0 + t1 + t2]]; }
  let pts = [[0, 0]], x = 0, z = 0;
  for (const [len, a] of segs) { x += Math.sin(a) * len; z -= Math.cos(a) * len; pts.push([x, z]); }
  for (let k = 0; k < 3; k++) {
    const n = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; n.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); }
    n.push(pts[pts.length - 1]); pts = n;
  }
  const rs = resample(pts, 4);
  const H = { seed, idx, par, pp: rs.p, ps: rs.s, total: rs.s[rs.s.length - 1], ns: (seed * 13 + idx * 31) & 0xffff, teeA: segs[0][1] };
  const gx = rs.p[rs.p.length - 2], gz = rs.p[rs.p.length - 1];
  // green, fringe and cup
  H.green = { x: gx, z: gz, rx: rr(11, 16), rz: rr(9, 13), rot: R() * Math.PI };
  H.fringe = { x: gx, z: gz, rx: H.green.rx + 2.2, rz: H.green.rz + 2.2, rot: H.green.rot };
  { const a = R() * Math.PI * 2, f = rr(0.15, 0.55), u = Math.cos(a) * H.green.rx * f, v = Math.sin(a) * H.green.rz * f, c = Math.cos(H.green.rot), s = Math.sin(H.green.rot);
    H.cup = { x: gx + u * c - v * s, z: gz + u * s + v * c }; }
  H.gTilt = [rr(-0.022, 0.022), rr(-0.022, 0.022)];
  H.gBump = { x: gx + rr(-6, 6), z: gz + rr(-5, 5), h: rr(-0.25, 0.3), r: rr(4, 7) };
  // fairway
  const w = par === 3 ? 9 : rr(13, 19), s0 = par === 3 ? Math.max(20, H.total - 34) : rr(45, 75), s1 = H.total - 6;
  const fp = []; for (let i = 0; i < rs.s.length; i++) if (rs.s[i] >= s0 && rs.s[i] <= s1) fp.push(rs.p[2 * i], rs.p[2 * i + 1]);
  if (fp.length < 4) fp.push(gx, gz);
  H.fw = { w, p: fp };
  H.tee = { a: H.teeA };
  // bunkers
  H.bunkers = [];
  const end = pathAt(H, H.total - 1), appA = Math.atan2(end.dz, end.dx);
  const nGb = par === 3 ? 2 + (R() < 0.5 ? 1 : 0) : 1 + Math.floor(R() * 3);
  const used = [];
  for (let i = 0; i < nGb; i++) {
    let th = 0; for (let k = 0; k < 8; k++) { th = R() < 0.25 ? Math.PI + rr(-0.4, 0.4) : sgn() * rr(0.55, 1.5); if (used.every(u => Math.abs(Math.atan2(Math.sin(u - th), Math.cos(u - th))) > 0.8)) break; }
    used.push(th);
    // th is measured from the direction of play, so pi is the far side of the green
    const ang = appA + Math.PI + th, ux = Math.cos(ang), uz = Math.sin(ang);
    const re = 1 / ellD(H.green, gx + ux, gz + uz), rx = rr(4, 7), rz = rr(2.5, 4);
    H.bunkers.push({ x: gx + ux * (re + 2.2 + rz + 0.6), z: gz + uz * (re + 2.2 + rz + 0.6), rx, rz, rot: ang + Math.PI / 2 });
  }
  if (par > 3) {
    const sets = par === 5 ? [rr(205, 250), H.total - rr(95, 125)] : [rr(200, 245)];
    for (const s of sets) {
      if (s > H.total - 60 || s < 120) continue;
      const pa = pathAt(H, s), side = sgn(), rx = rr(7, 11), rz = rr(3.5, 5.5), off = w + rr(-2, 3);
      H.bunkers.push({ x: pa.x - pa.dz * side * off, z: pa.z + pa.dx * side * off, rx, rz, rot: Math.atan2(pa.dz, pa.dx) });
      if (R() < 0.35) { const o2 = w + rr(-1, 4); H.bunkers.push({ x: pa.x + pa.dz * side * o2 + pa.dx * 15, z: pa.z - pa.dx * side * o2 + pa.dz * 15, rx: rr(5, 8), rz: rr(3, 4.5), rot: Math.atan2(pa.dz, pa.dx) }); }
    }
  }
  // water
  H.ponds = [];
  const gR = Math.max(H.green.rx, H.green.rz) + 2.2;
  if (R() < (par === 3 ? 0.55 : 0.45)) {
    let pd = null;
    if (par === 3) {
      const rz = rr(9, 15), s = clamp(H.total * rr(0.45, 0.62), 30 + rz, H.total - gR - 8 - rz), pa = pathAt(H, s);
      pd = { x: pa.x - pa.dz * rr(-8, 8), z: pa.z + pa.dx * rr(-8, 8), rx: rr(22, 34), rz, rot: Math.atan2(pa.dz, pa.dx) + Math.PI / 2 };
    } else if (par === 5 && R() < 0.45) {
      const s = rr(270, 330); if (s < H.total - 100) { const pa = pathAt(H, s); pd = { x: pa.x, z: pa.z, rx: rr(36, 50), rz: rr(8, 12), rot: Math.atan2(pa.dz, pa.dx) + Math.PI / 2 }; }
    } else {
      const s = H.total * rr(0.38, 0.75), pa = pathAt(H, s), side = sgn(), rx = rr(12, 20), off = w + rx * 0.7 + 2;
      pd = { x: pa.x - pa.dz * side * off, z: pa.z + pa.dx * side * off, rx, rz: rr(25, 45), rot: Math.atan2(pa.dz, pa.dx) + Math.PI / 2 };
    }
    if (pd && Math.hypot(pd.x, pd.z) > 30 + Math.max(pd.rx, pd.rz) * 0.6 && Math.hypot(pd.x - gx, pd.z - gz) > gR + 6 + Math.min(pd.rx, pd.rz)) H.ponds.push(pd);
  }
  H.bunkers = H.bunkers.filter(b => H.ponds.every(p => ellD(p, b.x, b.z) > 1.4));
  // wind (m/s)
  const ws = R() < 0.15 ? 0 : rr(1, 7), wa = R() * Math.PI * 2;
  H.wind = { x: Math.cos(wa) * ws, z: Math.sin(wa) * ws, s: ws };
  // bounds: inside is in play, the margin beyond is out of bounds scenery
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < rs.p.length; i += 2) { x0 = Math.min(x0, rs.p[i]); x1 = Math.max(x1, rs.p[i]); z0 = Math.min(z0, rs.p[i + 1]); z1 = Math.max(z1, rs.p[i + 1]); }
  for (const p of H.ponds) { const r = Math.max(p.rx, p.rz); x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r); z0 = Math.min(z0, p.z - r); z1 = Math.max(z1, p.z + r); }
  H.b = { x0: x0 - 70, x1: x1 + 70, z0: z0 - 105, z1: Math.max(z1, 0) + 30 };
  H.m = { x0: H.b.x0 - 110, x1: H.b.x1 + 110, z0: H.b.z0 - 110, z1: H.b.z1 + 90 };
  H.teeH = baseHeight(H, 0, 0);
  H.greenH = baseHeight(H, gx, gz);
  for (const p of H.ponds) p.wl = baseHeight(H, p.x, p.z) - 0.3;
  return H;
}
const inBounds = (H, x, z) => x > H.b.x0 && x < H.b.x1 && z > H.b.z0 && z < H.b.z1;
function teeLocal(H, x, z) { const a = H.tee.a, c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, x * Math.sin(a) - z * c]; } // [lateral, along]
function inTee(H, x, z) { const [u, v] = teeLocal(H, x, z); return Math.abs(u) < 5.5 && v > -6 && v < 4; }
function surfAt(H, x, z) {
  if (!inBounds(H, x, z)) return 'oob';
  for (const p of H.ponds) if (ellD(p, x, z) < 0.88) return 'water';
  for (const b of H.bunkers) if (ellD(b, x, z) < 1) return 'sand';
  if (ellD(H.green, x, z) < 1) return 'green';
  if (ellD(H.fringe, x, z) < 1) return 'fringe';
  if (inTee(H, x, z)) return 'tee';
  if (distPoly(H.fw.p, x, z) < H.fw.w) return 'fairway';
  return 'rough';
}
function baseHeight(H, x, z) {
  const big = fbm(x / 170, z / 170, H.ns, 3) * 6, small = fbm(x / 40, z / 40, H.ns + 50, 2) * 1.3;
  const near = smooth(H.fw.w + 32, H.fw.w, distPoly(H.pp, x, z));
  let h = big + small * (1 - 0.75 * near);
  if (H.b) { const ox = Math.max(H.b.x0 - x, x - H.b.x1, 0), oz = Math.max(H.b.z0 - z, z - H.b.z1, 0); h += smooth(0, 120, Math.hypot(ox, oz)) * 16; }
  return h;
}
function greenH(H, x, z) {
  const b = H.gBump, d = Math.hypot(x - b.x, z - b.z) / b.r;
  return H.greenH + H.gTilt[0] * (x - H.green.x) + H.gTilt[1] * (z - H.green.z) + b.h * Math.exp(-d * d);
}
function finalHeight(H, x, z) {
  let h = baseHeight(H, x, z);
  { const [u, v] = teeLocal(H, x, z), d = Math.max(Math.abs(u) - 5.5, v - 4, -6 - v, 0); h = lerp(h, H.teeH + 0.3, smooth(7, 0, d)); }
  { const d = ellD(H.fringe, x, z); if (d < 1.8) h = lerp(h, greenH(H, x, z), smooth(1.8, 1.0, d)); }
  for (const b of H.bunkers) { const d = ellD(b, x, z); if (d < 1.4) h += -0.7 * smooth(1.0, 0.25, d) + 0.18 * Math.max(0, 1 - Math.abs(d - 1.08) / 0.22); }
  for (const p of H.ponds) { const d = ellD(p, x, z); if (d < 2) { h = lerp(h, p.wl + 0.4, smooth(1.9, 1.15, d)); h -= 2.6 * smooth(1.0, 0.6, d); } }
  return h;
}
function buildGrid(H) {
  const cs = 2.5, nx = Math.ceil((H.m.x1 - H.m.x0) / cs), nz = Math.ceil((H.m.z1 - H.m.z0) / cs);
  const h = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) h[j * (nx + 1) + i] = finalHeight(H, H.m.x0 + i * cs, H.m.z0 + j * cs);
  H.grid = { cs, nx, nz, h };
}
function groundY(H, x, z) {
  const g = H.grid, fx = clamp((x - H.m.x0) / g.cs, 0, g.nx - 1e-6), fz = clamp((z - H.m.z0) / g.cs, 0, g.nz - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, w = g.nx + 1;
  const ha = g.h[j * w + i], hb = g.h[j * w + i + 1], hc = g.h[(j + 1) * w + i], hd = g.h[(j + 1) * w + i + 1];
  return u + v <= 1 ? ha + (hb - ha) * u + (hc - ha) * v : hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
}
function normalAt(H, x, z) {
  const g = H.grid, fx = clamp((x - H.m.x0) / g.cs, 0, g.nx - 1e-6), fz = clamp((z - H.m.z0) / g.cs, 0, g.nz - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, w = g.nx + 1;
  const ha = g.h[j * w + i], hb = g.h[j * w + i + 1], hc = g.h[(j + 1) * w + i], hd = g.h[(j + 1) * w + i + 1];
  let sx, sz; if (u + v <= 1) { sx = (hb - ha) / g.cs; sz = (hc - ha) / g.cs; } else { sx = (hd - hc) / g.cs; sz = (hd - hb) / g.cs; }
  const l = Math.hypot(sx, 1, sz); return [-sx / l, 1 / l, -sz / l];
}
function genTrees(H) {
  const R = mulberry(H.ns * 7 + 3), T = [], step = 6.5;
  for (let z = H.m.z0 + 3; z < H.m.z1 - 3; z += step) for (let x = H.m.x0 + 3; x < H.m.x1 - 3; x += step) {
    const px = x + (R() - 0.5) * step * 0.9, pz = z + (R() - 0.5) * step * 0.9, r = R();
    const inb = inBounds(H, px, pz);
    const edge = Math.min(px - H.b.x0, H.b.x1 - px, pz - H.b.z0, H.b.z1 - pz);
    let p;
    if (!inb) p = edge > -35 ? 0.62 : edge > -75 ? 0.3 : 0.12;
    else {
      if (distPoly(H.pp, px, pz) < H.fw.w + 9 || Math.hypot(px, pz) < 22 || ellD(H.fringe, px, pz) < 1.9) continue;
      if (H.bunkers.some(b => ellD(b, px, pz) < 1.5) || H.ponds.some(q => ellD(q, px, pz) < 1.25)) continue;
      p = edge < 12 ? 0.8 : 0.1 + smooth(-0.15, 0.35, fbm(px / 60, pz / 60, H.ns + 9, 2)) * 0.6;
    }
    if (r > p) continue;
    const pine = R() < 0.32, s = (inb ? 0.8 + R() * 0.6 : 0.9 + R() * 0.8), y = groundY(H, px, pz);
    const th = (pine ? 1.8 : 2.6) * s;
    T.push({ x: px, z: pz, y, s, pine, tr: 0.24 * s, th, fy: y + th + (pine ? 2.4 : 1.7) * s, fr: (pine ? 1.9 : 2.4) * s, rot: R() * 6.283, c: R() });
  }
  H.trees = T; H.tgrid = new Map();
  for (const t of T) { const k = Math.floor(t.x / 16) * 65536 + Math.floor(t.z / 16); let a = H.tgrid.get(k); if (!a) H.tgrid.set(k, a = []); a.push(t); }
}
function treeAt(H, x, y, z) {
  const bx = Math.floor(x / 16), bz = Math.floor(z / 16);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = H.tgrid.get((bx + i) * 65536 + bz + j); if (!a) continue;
    for (const t of a) {
      const dx = x - t.x, dz = z - t.z, d2 = dx * dx + dz * dz; if (d2 > 30) continue;
      if (y < t.y + t.th + 0.3 && d2 < (t.tr + BR) ** 2) return { t, trunk: true, dx, dz, d: Math.sqrt(d2) };
      const fy = y - t.fy; if (d2 + fy * fy * (t.pine ? 0.45 : 1) < t.fr * t.fr) return { t, trunk: false };
    }
  }
  return null;
}

// ============================ ball physics ============================
// The whole shot is simulated up front, then played back, so everyone sees the same flight.
// o.M stretches the ball's flight horizontally: drinking makes every shot carry M times farther.
function simulate(H, from, o) {
  const REC = 8;
  let px = from.x, pz = from.z, py = groundY(H, px, pz) + BR;
  const dx = Math.sin(o.yaw), dz = -Math.cos(o.yaw);
  let vx, vy, vz, air;
  if (o.putt) { vx = dx * o.v0; vz = dz * o.v0; vy = 0; air = false; }
  else { const ca = Math.cos(o.ang), sa = Math.sin(o.ang); vx = dx * o.v0 * ca; vz = dz * o.v0 * ca; vy = o.v0 * sa; air = true; py += 0.02; }
  let L = o.lift || 0, Sd = o.side || 0, M = o.M || 1, landed = !air, bounces = 0, still = 0, t = 0, step = 0, lipped = false, inLeaves = false;
  const pts = [px, py, pz], ev = []; let out = 'rest', carry = 0, waterAt = null;
  const wx = H.wind.x, wz = H.wind.z, cx = H.cup.x, cz = H.cup.z;
  while (t < 40) {
    t += SIM_DT; step++;
    if (air) {
      const rx = vx - wx, ry = vy, rz = vz - wz, sp = Math.hypot(rx, ry, rz) || 1e-6, ux = rx / sp, uy = ry / sp, uz = rz / sp;
      let lx = -uy * ux, ly = 1 - uy * uy, lz = -uy * uz; const ll = Math.hypot(lx, ly, lz) || 1; lx /= ll; ly /= ll; lz /= ll;
      let sx = -uz, sz = ux; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
      const s2 = sp * sp;
      vx += (-KD * sp * rx + L * s2 * lx + Sd * s2 * sx) * SIM_DT;
      vy += (-G - KD * sp * ry + L * s2 * ly) * SIM_DT;
      vz += (-KD * sp * rz + L * s2 * lz + Sd * s2 * sz) * SIM_DT;
      L *= SPIN_DECAY; Sd *= SPIN_DECAY;
      px += vx * M * SIM_DT; py += vy * SIM_DT; pz += vz * M * SIM_DT;
      const th = H.trees.length && py < groundY(H, px, pz) + 22 ? treeAt(H, px, py, pz) : null;
      if (th && th.trunk) {
        const nx = th.dx / (th.d || 1), nz = th.dz / (th.d || 1), vn = vx * nx + vz * nz;
        if (vn < 0) { vx -= 2 * vn * nx; vz -= 2 * vn * nz; vx *= 0.45; vz *= 0.45; vy *= 0.6; if (M > 1) { const k = Math.sqrt(M); vx *= k; vz *= k; M = 1; } ev.push([t, 'tree']); }
        px = th.t.x + nx * (th.t.tr + BR + 0.01); pz = th.t.z + nz * (th.t.tr + BR + 0.01);
      } else if (th) {
        if (!inLeaves) { ev.push([t, 'tree']); if (M > 1) { const k = Math.sqrt(M); vx *= k; vz *= k; M = 1; } }
        vx = vx * 0.955 + (Math.random() - 0.5) * 0.5; vy *= 0.955; vz = vz * 0.955 + (Math.random() - 0.5) * 0.5;
      }
      inLeaves = !!(th && !th.trunk);
      const gy = groundY(H, px, pz);
      if (py - BR <= gy) {
        py = gy + BR;
        const sf = surfAt(H, px, pz);
        if (!landed) { landed = true; carry = Math.hypot(px - from.x, pz - from.z); }
        if (M > 1) { const k = Math.sqrt(M); vx *= k; vz *= k; M = 1; }
        if (sf === 'water') { out = 'water'; waterAt = [px, pz]; ev.push([t, 'splash']); break; }
        if (Math.hypot(px - cx, pz - cz) < CUP_R * 1.3 && Math.hypot(vx, vz) < 14) { out = 'holed'; px = cx; pz = cz; py = gy - 0.06; ev.push([t, 'cup']); break; }
        const n = normalAt(H, px, pz), vn = vx * n[0] + vy * n[1] + vz * n[2];
        let tx = vx - vn * n[0], ty = vy - vn * n[1], tz = vz - vn * n[2];
        const P = SURF[sf]; let fr = P.f; if (bounces === 0) fr *= 1 - (o.bite || 0) * 0.9;
        const up = -vn * P.e; bounces++;
        tx *= fr; ty *= fr; tz *= fr;
        if (up < 1.4 || bounces > 8) { air = false; vx = tx; vy = ty; vz = tz; } else { vx = tx + n[0] * up; vy = ty + n[1] * up; vz = tz + n[2] * up; }
        if (bounces === 1 || up > 2) ev.push([t, sf === 'sand' ? 'sand' : 'land']);
      }
    } else {
      const sf = surfAt(H, px, pz);
      if (sf === 'water') { out = 'water'; waterAt = [px, pz]; ev.push([t, 'splash']); break; }
      const P = SURF[sf], n = normalAt(H, px, pz);
      const gx = G * n[1] * n[0], gyy = -G * (1 - n[1] * n[1]), gz = G * n[1] * n[2];
      const vn = vx * n[0] + vy * n[1] + vz * n[2]; vx -= vn * n[0]; vy -= vn * n[1]; vz -= vn * n[2];
      let sp = Math.hypot(vx, vy, vz); const fric = P.mu * G * n[1], gt = Math.hypot(gx, gyy, gz);
      if (sp < 0.04 && gt < fric * 1.5) { vx = vy = vz = 0; if (++still > 20) break; }
      else {
        still = 0;
        vx += gx * SIM_DT; vy += gyy * SIM_DT; vz += gz * SIM_DT;
        sp = Math.hypot(vx, vy, vz);
        if (sp > 1e-6) { const k = Math.max(0, sp - fric * SIM_DT) / sp; vx *= k; vy *= k; vz *= k; }
        px += vx * SIM_DT; pz += vz * SIM_DT; py = groundY(H, px, pz) + BR;
        const dc = Math.hypot(px - cx, pz - cz);
        if (dc < CUP_R) {
          const hs = Math.hypot(vx, vz);
          if (hs < 1.6) { out = 'holed'; px = cx; pz = cz; py -= 0.06; ev.push([t, 'cup']); break; }
          if (hs < 2.7 && !lipped) { lipped = true; const a = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), c = Math.cos(a), s = Math.sin(a); const nx = (vx * c - vz * s) * 0.55, nz = (vx * s + vz * c) * 0.55; vx = nx; vz = nz; ev.push([t, 'lip']); }
        }
        const th = H.trees.length ? treeAt(H, px, py, pz) : null;
        if (th && th.trunk) { const nx = th.dx / (th.d || 1), nz = th.dz / (th.d || 1), v2 = vx * nx + vz * nz; if (v2 < 0) { vx = (vx - 2 * v2 * nx) * 0.4; vz = (vz - 2 * v2 * nz) * 0.4; } px = th.t.x + nx * (th.t.tr + BR + 0.01); pz = th.t.z + nz * (th.t.tr + BR + 0.01); }
      }
    }
    if (px < H.m.x0 + 3 || px > H.m.x1 - 3 || pz < H.m.z0 + 3 || pz > H.m.z1 - 3) { out = 'oob'; break; }
    if (step % REC === 0) pts.push(px, py, pz);
  }
  pts.push(px, py, pz);
  if (out === 'rest' && !inBounds(H, px, pz)) out = 'oob';
  return { pts, dt: SIM_DT * REC, end: [px, py, pz], out, carry: landed ? carry : Math.hypot(px - from.x, pz - from.z), total: Math.hypot(px - from.x, pz - from.z), ev, waterAt };
}

// ============================ rendering setup ============================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
const SKY_TOP = new THREE.Color(0x3b82d0), HORIZON = new THREE.Color(0xcde2ee);
scene.fog = new THREE.Fog(HORIZON, 280, 1350);
scene.background = HORIZON;
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 3000); camera.rotation.order = 'YXZ';
const SUN = new THREE.Vector3(-0.45, 0.78, 0.43).normalize();
scene.add(new THREE.HemisphereLight(0xd6ecff, 0x40602c, 0.62));
const sunL = new THREE.DirectionalLight(0xfff0d0, 0.85); sunL.position.copy(SUN).multiplyScalar(100); scene.add(sunL);
const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: SKY_TOP }, hor: { value: HORIZON }, sun: { value: SUN } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; varying vec3 vD;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
    void main(){ vec3 d = normalize(vD); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.55));
      float s = max(dot(d, sun), 0.0); c += vec3(1.0, 0.9, 0.7) * (pow(s, 700.0) * 1.6 + pow(s, 14.0) * 0.16);
      vec2 q = d.xz / (d.y + 0.12) * 2.2; float cl = vn(q) * 0.55 + vn(q * 2.1) * 0.3 + vn(q * 4.3) * 0.15;
      c = mix(c, vec3(1.0), smoothstep(0.55, 0.8, cl) * 0.75 * smoothstep(0.02, 0.2, d.y));
      if (d.y < 0.0) c = hor; gl_FragColor = vec4(c, 1.0); }`,
}));
sky.renderOrder = -1; scene.add(sky);

const detailTex = (() => {
  const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'), im = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, fine = Math.random(), blob = (fbm(x / 32, y / 32, 7, 3) + 1) / 2;
    im.data[i] = 90 + fine * 140; im.data[i + 1] = 40 + blob * 190; im.data[i + 2] = 128; im.data[i + 3] = 255;
  }
  // tileable blob channel: blend the edges
  g.putImageData(im, 0, 0);
  for (let i = 0; i < 1400; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,40,40' : '230,230,230'},0.35)`; const x = Math.random() * n, y = Math.random() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 5); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
})();
const terrainMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, detail: { value: detailTex }, sunDir: { value: SUN }, fogCol: { value: HORIZON }, fogNear: { value: 280 }, fogFar: { value: 1350 } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform sampler2D map; uniform sampler2D detail; uniform vec3 sunDir; uniform vec3 fogCol; uniform float fogNear; uniform float fogFar;
    varying vec2 vUv; varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 base = texture2D(map, vUv).rgb;
      float d1 = texture2D(detail, vW.xz * 0.5).r, d2 = texture2D(detail, vW.xz * 0.043).g;
      float dist = distance(vW, cameraPosition), near = 1.0 - smoothstep(8.0, 70.0, dist);
      base *= mix(0.9 + 0.2 * d2, 0.74 + 0.5 * d1, near * 0.75);
      vec3 n = normalize(vN); float diff = max(dot(n, sunDir), 0.0);
      vec3 hemi = mix(vec3(0.26, 0.31, 0.19), vec3(0.84, 0.92, 1.0), n.y * 0.5 + 0.5);
      vec3 col = base * (hemi * 0.62 + vec3(1.0, 0.94, 0.82) * diff * 0.82);
      col = mix(col, fogCol, smoothstep(fogNear, fogFar, dist));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 6); trunkGeo.translate(0, 0.5, 0);
const roundGeo = new THREE.IcosahedronGeometry(1, 1);
const pineGeo = new THREE.ConeGeometry(1, 1, 7); pineGeo.translate(0, 0, 0);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
const waterMat = new THREE.MeshPhongMaterial({ color: 0x2c6c98, specular: 0xbcd6ee, shininess: 70, transparent: true, opacity: 0.9 });
const PCOL = ['#ff5a5f', '#3ea6ff', '#ffc53d', '#52d273'];

// ============================ hole scene ============================
let HOLE = null, holeGroup = null;
function disposeGroup(g) { g.traverse(o => { if (o.geometry && o.geometry !== trunkGeo && o.geometry !== roundGeo && o.geometry !== pineGeo) o.geometry.dispose(); if (o.material && o.material.map && o.material !== terrainMat) o.material.map.dispose(); }); }
function ellPath(g, e, k = 1) { g.beginPath(); g.ellipse(e.x, e.z, e.rx * k, e.rz * k, e.rot, 0, Math.PI * 2); }
function paintHole(H) {
  const MW = H.m.x1 - H.m.x0, MD = H.m.z1 - H.m.z0, sc = 2048 / Math.max(MW, MD);
  const cw = Math.round(MW * sc), ch = Math.round(MD * sc);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const g = cv.getContext('2d');
  const W = () => g.setTransform(sc, 0, 0, sc, -H.m.x0 * sc, -H.m.z0 * sc);
  W();
  g.fillStyle = '#2f5b26'; g.fillRect(H.m.x0, H.m.z0, MW, MD);
  g.fillStyle = '#3a7330'; g.fillRect(H.b.x0, H.b.z0, H.b.x1 - H.b.x0, H.b.z1 - H.b.z0);
  const R = mulberry(H.ns + 5);
  for (let i = 0; i < 1100; i++) { const x = H.m.x0 + R() * MW, z = H.m.z0 + R() * MD, r = 3 + R() * 16; g.fillStyle = R() < 0.5 ? 'rgba(20,50,15,.10)' : 'rgba(130,175,70,.08)'; g.beginPath(); g.arc(x, z, r, 0, 7); g.fill(); }
  const fw = H.fw;
  const strokeFw = (c, extra) => { c.beginPath(); c.moveTo(fw.p[0], fw.p[1]); for (let i = 2; i < fw.p.length; i += 2) c.lineTo(fw.p[i], fw.p[i + 1]); c.lineWidth = fw.w * 2 + extra; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };
  g.strokeStyle = '#4a8b3b'; strokeFw(g, 6);
  g.strokeStyle = '#64b14b'; strokeFw(g, 0);
  // mowing stripes, masked to the fairway
  const stripes = (c, band, alpha) => {
    c.save(); c.translate(0, 0); c.rotate(H.teeA);
    for (let k = -80; k < 80; k++) { if (k & 1) continue; c.fillStyle = `rgba(255,255,255,${alpha})`; c.fillRect(-1500, k * band, 3000, band); }
    c.restore();
  };
  {
    const lc = document.createElement('canvas'); lc.width = cw; lc.height = ch; const l = lc.getContext('2d');
    l.setTransform(sc, 0, 0, sc, -H.m.x0 * sc, -H.m.z0 * sc); stripes(l, 11, 0.09);
    l.globalCompositeOperation = 'destination-in'; l.strokeStyle = '#000'; strokeFw(l, 0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lc, 0, 0); W();
  }
  // tee
  g.save(); g.rotate(H.teeA); g.fillStyle = '#4f9440'; g.fillRect(-6.7, -5.2, 13.4, 12.4); g.fillStyle = '#76c75a'; g.fillRect(-5.5, -4, 11, 10);
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let k = -4; k < 6; k += 2) g.fillRect(-5.5, k, 11, 1); g.restore();
  // green
  g.fillStyle = '#5aa846'; ellPath(g, H.fringe, 1.06); g.fill();
  g.fillStyle = '#6dbf52'; ellPath(g, H.fringe); g.fill();
  g.fillStyle = '#84d561'; ellPath(g, H.green); g.fill();
  g.save(); ellPath(g, H.green); g.clip(); g.translate(H.green.x, H.green.z); g.rotate(H.teeA + 0.6);
  g.fillStyle = 'rgba(255,255,255,.07)'; for (let k = -20; k < 20; k += 2) g.fillRect(-30, k * 1.6, 60, 1.6); g.restore();
  // bunkers
  for (const b of H.bunkers) {
    g.fillStyle = '#c9b57e'; ellPath(g, b, 1.04); g.fill();
    g.fillStyle = '#e6d7a6'; ellPath(g, b); g.fill();
    g.fillStyle = 'rgba(255,255,240,.35)'; ellPath(g, b, 0.6); g.fill();
  }
  // ponds
  for (const p of H.ponds) { g.fillStyle = '#5d6b3b'; ellPath(g, p, 1.0); g.fill(); g.fillStyle = '#285d84'; ellPath(g, p, 0.9); g.fill(); }
  // out of bounds stakes line
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.35; g.setLineDash([2, 3]); g.strokeRect(H.b.x0, H.b.z0, H.b.x1 - H.b.x0, H.b.z1 - H.b.z0); g.setLineDash([]);
  // soft tree shadows
  for (const t of H.trees) {
    const r = t.fr * 1.1, sx = t.x - SUN.x / SUN.y * (t.fy - t.y) * 0.8, sz = t.z - SUN.z / SUN.y * (t.fy - t.y) * 0.8;
    const gr = g.createRadialGradient(sx, sz, 0, sx, sz, r); gr.addColorStop(0, 'rgba(10,30,5,.42)'); gr.addColorStop(1, 'rgba(10,30,5,0)');
    g.fillStyle = gr; g.fillRect(sx - r, sz - r, r * 2, r * 2);
  }
  // grain
  g.setTransform(1, 0, 0, 1, 0, 0);
  const im = g.getImageData(0, 0, cw, ch), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
  return cv;
}
function buildTerrainMesh(H, tex) {
  const g = H.grid, w = g.nx + 1, n = w * (g.nz + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const MW = H.m.x1 - H.m.x0, MD = H.m.z1 - H.m.z0;
  for (let j = 0; j <= g.nz; j++) for (let i = 0; i <= g.nx; i++) {
    const k = j * w + i, x = H.m.x0 + i * g.cs, z = H.m.z0 + j * g.cs;
    pos[k * 3] = x; pos[k * 3 + 1] = g.h[k]; pos[k * 3 + 2] = z; uv[k * 2] = (x - H.m.x0) / MW; uv[k * 2 + 1] = 1 - (z - H.m.z0) / MD;
  }
  const idx = new Uint32Array(g.nx * g.nz * 6); let q = 0;
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const tx = new THREE.CanvasTexture(tex); tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tx.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = terrainMat.clone(); mat.uniforms.map.value = tx; mat.uniforms.detail.value = detailTex;
  return new THREE.Mesh(geo, mat);
}
function buildTrees(H, group) {
  const T = H.trees, m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, T.length);
  const rounds = T.filter(t => !t.pine), pines = T.filter(t => t.pine);
  const rm = new THREE.InstancedMesh(roundGeo, leafMat, Math.max(1, rounds.length)), pm = new THREE.InstancedMesh(pineGeo, leafMat, Math.max(1, pines.length));
  T.forEach((t, i) => { q.setFromAxisAngle(up, t.rot); m.compose(p.set(t.x, t.y - 0.2, t.z), q, s.set(t.tr, t.th + 0.6, t.tr)); trunks.setMatrixAt(i, m); });
  rounds.forEach((t, i) => { q.setFromAxisAngle(up, t.rot); m.compose(p.set(t.x, t.fy, t.z), q, s.set(t.fr, t.fr * 0.85, t.fr)); rm.setMatrixAt(i, m); rm.setColorAt(i, col.setHSL(0.27 + t.c * 0.08, 0.5, 0.24 + t.c * 0.1)); });
  pines.forEach((t, i) => { q.setFromAxisAngle(up, t.rot); m.compose(p.set(t.x, t.fy, t.z), q, s.set(t.fr, t.fr * 3.2, t.fr)); pm.setMatrixAt(i, m); pm.setColorAt(i, col.setHSL(0.33 + t.c * 0.05, 0.45, 0.17 + t.c * 0.07)); });
  rm.count = rounds.length; pm.count = pines.length;
  group.add(trunks, rm, pm);
}
let cupMesh = null, flagGroup = null, flagCloth = null;
function buildHole(seed, idx, nh) {
  if (holeGroup) { scene.remove(holeGroup); disposeGroup(holeGroup); }
  const H = genHole(seed, idx, nh); buildGrid(H); genTrees(H);
  const cv = paintHole(H); H.canvas = cv;
  holeGroup = new THREE.Group();
  holeGroup.add(buildTerrainMesh(H, cv));
  buildTrees(H, holeGroup);
  for (const p of H.ponds) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat); w.geometry.rotateX(-Math.PI / 2);
    w.scale.set(p.rx, 1, p.rz); w.rotation.y = -p.rot; w.position.set(p.x, p.wl, p.z); holeGroup.add(w);
  }
  // cup, flag and tee markers
  const cy = groundY(H, H.cup.x, H.cup.z), n = normalAt(H, H.cup.x, H.cup.z);
  cupMesh = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R + 0.01, 24), new THREE.MeshBasicMaterial({ color: 0x0b0f0a, polygonOffset: true, polygonOffsetFactor: -4 }));
  const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R + 0.01, CUP_R + 0.03, 24), new THREE.MeshBasicMaterial({ color: 0xe8f0e0, polygonOffset: true, polygonOffsetFactor: -4 }));
  cupMesh.add(hole, rim); cupMesh.position.set(H.cup.x, cy + 0.01, H.cup.z); cupMesh.lookAt(H.cup.x + n[0], cy + 0.01 + n[1], H.cup.z + n[2]); holeGroup.add(cupMesh);
  flagGroup = new THREE.Group(); flagGroup.position.set(H.cup.x, cy, H.cup.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 6), new THREE.MeshLambertMaterial({ color: 0xf4f4f4 })); pole.position.y = 1.15;
  const fg = new THREE.PlaneGeometry(0.75, 0.48, 6, 1); fg.translate(0.375, 0, 0);
  flagCloth = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ color: 0xe8232e, side: THREE.DoubleSide })); flagCloth.position.y = 2.05;
  flagGroup.add(pole, flagCloth); holeGroup.add(flagGroup);
  const tm = new THREE.MeshLambertMaterial({ color: 0xc8322a }), c = Math.cos(H.teeA), s = Math.sin(H.teeA);
  for (const u of [-5, 5]) { const x = u * c + 2 * Math.sin(H.teeA), z = u * s - 2 * Math.cos(H.teeA); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16), tm); b.position.set(x, groundY(H, x, z) + 0.08, z); b.rotation.y = -H.teeA; holeGroup.add(b); }
  scene.add(holeGroup);
  HOLE = H; miniBg = null;
  for (const B of BALLS.values()) resetBallVisual(B);
  return H;
}

// ============================ balls, trails and avatars ============================
const BALLS = new Map(); // id -> ball record (mine included)
const ballGeo = new THREE.SphereGeometry(BR, 14, 10), shadowGeo = new THREE.CircleGeometry(0.05, 14); shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
function buildAvatar(color) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const cm = new THREE.MeshLambertMaterial({ color }), skin = new THREE.MeshLambertMaterial({ color: 0xe2b48c }), dark = new THREE.MeshLambertMaterial({ color: 0x2b2f3a });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const lg1 = box(0.16, 0.86, 0.18, dark, -0.11, 0.43, 0), lg2 = box(0.16, 0.86, 0.18, dark, 0.11, 0.43, 0);
  g.userData.legs = [lg1, lg2];
  box(0.46, 0.6, 0.26, cm, 0, 1.15, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin); head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.15, 0.09, 12), cm); cap.position.y = 1.72; g.add(cap);
  box(0.22, 0.02, 0.14, cm, 0, 1.69, -0.16);
  const la = box(0.1, 0.55, 0.1, cm, -0.2, 1.05, -0.12); la.rotation.x = 0.5; la.rotation.z = -0.25;
  const ra = box(0.1, 0.55, 0.1, cm, 0.2, 1.05, -0.12); ra.rotation.x = 0.5; ra.rotation.z = 0.25;
  const club = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), new THREE.MeshLambertMaterial({ color: 0xcfd6dd })); club.position.set(0, 0.42, -0.36); club.rotation.x = -0.42; g.add(club);
  return g;
}
function getBall(id) {
  let B = BALLS.get(id); if (B) return B;
  const info = S && S.pl.find(p => p.id === id), slot = info ? info.slot : 0, color = PCOL[slot] || '#fff';
  const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), id === ME.id ? 1 : 0.55), emissive: 0x222222 });
  const ball = new THREE.Mesh(ballGeo, mat), shadow = new THREE.Mesh(shadowGeo, shadowMat);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 1500), 3)); tg.setDrawRange(0, 0);
  const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })); trail.frustumCulled = false;
  const avatar = id === ME.id ? null : buildAvatar(color);
  const cart = buildCart(color); cart.visible = false;
  let seat = null; if (id !== ME.id) { seat = buildAvatar(color); seat.scale.setScalar(0.85); seat.position.set(-0.3, 0.32, 0.22); seat.visible = false; cart.userData.body.add(seat); }
  B = { id, slot, color, ball, shadow, trail, avatar, cart, seat, anim: null, rest: null, yaw: 0, driving: false, ct: null, cp: null, flatT: 0, flatDir: [0, 0] };
  scene.add(ball, shadow, trail, cart); if (avatar) scene.add(avatar);
  BALLS.set(id, B); return B;
}
function dropBall(id) { const B = BALLS.get(id); if (!B) return; scene.remove(B.ball, B.shadow, B.trail, B.cart); if (B.avatar) scene.remove(B.avatar); BALLS.delete(id); }

// ============================ getting to your ball ============================
// After every shot you travel to your ball yourself. Funnel a beer on the tee and you get a golf
// cart for the hole (and can run people over); otherwise you run, and can't hit anyone. Your own
// browser moves you and checks collisions, then shares your position ten times a second.
const CART = { driving: false, p: new THREE.Vector3(), yaw: 0, v: 0, steer: 0, look: 0, lastSend: 0, hitAt: 0, park: null, dry: null };
const RUN = { on: false, p: new THREE.Vector3(), yaw: 0, v: 0, phase: 0, stunUntil: 0, tripAt: -1e9, dry: null };
const FUN = { st: 'offer', t0: 0 }; // the tee-box funnel: offer | hold | declined | done
const cartIn = { gas: false, brake: false, left: false, right: false };
function buildCart(color) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.order = 'YXZ';
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  const white = M(0xf1f1ea), col = M(color), dark = M(0x26282c), tire = M(0x161616), metal = M(0xb8bec6);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); body.add(b); return b; };
  box(1.25, 0.32, 2.3, white, 0, 0.42, 0);
  box(1.22, 0.34, 0.7, col, 0, 0.72, -0.82);
  box(1.1, 0.12, 0.6, dark, 0, 0.8, 0.25);
  box(1.1, 0.5, 0.1, dark, 0, 1.08, 0.56);
  box(1.36, 0.06, 1.95, col, 0, 2.0, 0.05);
  for (const [x, z] of [[-0.6, -0.55], [0.6, -0.55], [-0.6, 0.62], [0.6, 0.62]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25, 6), metal); p.position.set(x, 1.38, z); body.add(p); }
  for (const [x, z] of [[-0.64, -0.75], [0.64, -0.75], [-0.64, 0.78], [0.64, 0.78]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.18, 12), tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.23, z); body.add(w); }
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 18), dark); sw.position.set(-0.3, 1.06, -0.32); sw.rotation.x = -1.0; body.add(sw);
  const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), dark); col2.position.set(-0.3, 0.88, -0.44); col2.rotation.x = 0.55; body.add(col2);
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.85, 10), col); bag.position.set(0.25, 0.95, 0.98); bag.rotation.x = -0.25; body.add(bag);
  g.userData.body = body; return g;
}
function placeCart(c, x, z, yaw) {
  const H = HOLE, dx = Math.sin(yaw), dz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
  const hf = groundY(H, x + dx * 0.8, z + dz * 0.8), hb = groundY(H, x - dx * 0.8, z - dz * 0.8), hr = groundY(H, x + rx * 0.6, z + rz * 0.6), hl = groundY(H, x - rx * 0.6, z - rz * 0.6);
  c.position.set(x, (hf + hb + hr + hl) / 4, z); c.rotation.set(Math.atan2(hf - hb, 1.6), -yaw, Math.atan2(hr - hl, 1.2));
}
function parkSpot(x, z, slot) {
  const H = HOLE, far = Math.hypot(H.cup.x - x, H.cup.z - z) > 1, yaw = far ? yawTo(x, z, H.cup.x, H.cup.z) : H.teeA;
  const dx = Math.sin(yaw), dz = -Math.cos(yaw), lat = (slot - 1.5) * 1.7;
  return { x: x - dx * 6 + Math.cos(yaw) * lat, z: z - dz * 6 + Math.sin(yaw) * lat, yaw };
}
function teePark(slot) { const ts = teeSpot(HOLE, slot); return parkSpot(ts.x, ts.z, slot); }
function updateCart(B, dt, t) {
  const c = B.cart, me = B.id === ME.id;
  if (V.mode === 'intro' || !(me ? P.hasCart : B.hc || B.driving)) { c.visible = false; if (B.seat) B.seat.visible = false; return; }
  if (me && CART.driving) { placeCart(c, CART.p.x, CART.p.z, CART.yaw); c.visible = true; return; }
  if (!me && B.driving && B.ct) {
    const lag = Math.min(0.25, (t - B.ct.at) / 1000), tx = B.ct.x + Math.sin(B.ct.yaw) * B.ct.v * lag, tz = B.ct.z - Math.cos(B.ct.yaw) * B.ct.v * lag;
    if (!B.cp) B.cp = { x: tx, z: tz, yaw: B.ct.yaw };
    const k = 1 - Math.exp(-dt * 10); B.cp.x = lerp(B.cp.x, tx, k); B.cp.z = lerp(B.cp.z, tz, k); B.cp.yaw = angLerp(B.cp.yaw, B.ct.yaw, k);
    placeCart(c, B.cp.x, B.cp.z, B.cp.yaw); c.visible = true; B.seat.visible = true; return;
  }
  if (B.seat) B.seat.visible = false; B.cp = null;
  const ps = (me ? CART.park : B.park) || teePark(B.slot); placeCart(c, ps.x, ps.z, ps.yaw); c.visible = true;
}
// Smoothed position of another player who is driving or running, from their last update.
function remotePose(B, dt, t) {
  const lag = Math.min(0.25, (t - B.ct.at) / 1000), tx = B.ct.x + Math.sin(B.ct.yaw) * B.ct.v * lag, tz = B.ct.z - Math.cos(B.ct.yaw) * B.ct.v * lag;
  if (!B.rp) B.rp = { x: tx, z: tz, yaw: B.ct.yaw, ph: 0 };
  const k = 1 - Math.exp(-dt * 10); B.rp.x = lerp(B.rp.x, tx, k); B.rp.z = lerp(B.rp.z, tz, k); B.rp.yaw = angLerp(B.rp.yaw, B.ct.yaw, k); B.rp.ph += B.ct.v * dt * 1.6;
  return B.rp;
}
let engine = null;
function engineOn() {
  const a = audio(); if (!a || engine) return;
  const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.value = 42; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0.045;
  o.connect(f).connect(g).connect(master); o.start(); engine = { o, g };
}
function engineOff() { if (!engine) return; try { engine.g.gain.setTargetAtTime(0, AC.currentTime, 0.05); engine.o.stop(AC.currentTime + 0.3); } catch (e) {} engine = null; }
const travelling = () => V.mode === 'cart' || V.mode === 'run';
const canTravel = () => !!(HOLE && S && S.phase === 'play' && ((V.mode === 'aim' && MT.st === 'idle') || V.mode === 'spec' || V.mode === 'done'));
const travelPos = () => CART.driving ? CART.p : RUN.p;
const ballDist = () => P.pos ? Math.hypot(P.pos.x - travelPos().x, P.pos.z - travelPos().z) : 1e9;
const nearBall = () => !P.done && ballDist() < (CART.driving ? 9 : 5);
// from: where you're standing ({x, z, yaw}); runners start a step behind it.
const cartSpot = () => CART.park || teePark(ME.slot);
const nearCart = () => RUN.on && P.hasCart && Math.hypot(cartSpot().x - RUN.p.x, cartSpot().z - RUN.p.z) < 4;
// Hop out wherever you like: the cart stays put and you can walk back and get in.
function getOutOfCart() {
  if (!CART.driving) return;
  CART.park = { x: CART.p.x, z: CART.p.z, yaw: CART.yaw }; engineOff();
  toHost({ t: 'cart', d: 0, mo: 'cart', p: [+CART.p.x.toFixed(2), +CART.p.z.toFixed(2)], y: +CART.yaw.toFixed(3) });
  CART.driving = false; CART.v = 0;
  RUN.p.set(CART.p.x - Math.cos(CART.yaw) * 1.5, 0, CART.p.z - Math.sin(CART.yaw) * 1.5); RUN.yaw = CART.yaw; RUN.v = 0; RUN.stunUntil = 0;
  RUN.dry = { x: RUN.p.x, z: RUN.p.z }; RUN.on = true; V.mode = 'run'; sendPose(true);
}
function getInCart() {
  if (!nearCart()) return;
  const ps = cartSpot(); RUN.on = false; RUN.v = 0;
  CART.p.set(ps.x, 0, ps.z); CART.yaw = ps.yaw; CART.v = 0; CART.steer = 0; CART.dry = { x: ps.x, z: ps.z }; CART.driving = true; V.mode = 'cart'; engineOn(); sendPose(true);
}
function startTravel(from) {
  if (!HOLE || !S || S.phase !== 'play' || CART.driving || RUN.on) return;
  V.zoom = false; V.look = 0; CART.look = 0; hideBanner(); for (const k in cartIn) cartIn[k] = false;
  // you start in the cart only if you left it nearby; otherwise you're on foot
  if (P.hasCart && Math.hypot(cartSpot().x - from.x, cartSpot().z - from.z) < 15) {
    const ps = cartSpot();
    CART.p.set(ps.x, 0, ps.z); CART.yaw = ps.yaw; CART.v = 0; CART.steer = 0; CART.dry = { x: ps.x, z: ps.z }; CART.driving = true; V.mode = 'cart'; engineOn();
  } else {
    RUN.p.set(from.x - Math.sin(from.yaw) * 1.5, 0, from.z + Math.cos(from.yaw) * 1.5);
    RUN.yaw = P.done || Math.hypot(P.pos.x - RUN.p.x, P.pos.z - RUN.p.z) < 3 ? from.yaw : yawTo(RUN.p.x, RUN.p.z, P.pos.x, P.pos.z);
    RUN.v = 0; RUN.stunUntil = 0; RUN.dry = { x: RUN.p.x, z: RUN.p.z }; RUN.on = true; V.mode = 'run';
  }
  sendPose(true);
}
function endTravel(quiet) {
  if (!CART.driving && !RUN.on) return;
  // park beside and behind the ball so the cart isn't in the way of your shot
  if (CART.driving) { CART.park = !quiet && !P.done && nearBall() ? parkSpot(P.pos.x, P.pos.z, ME.slot) : { x: CART.p.x, z: CART.p.z, yaw: CART.yaw }; CART.p.set(CART.park.x, 0, CART.park.z); CART.yaw = CART.park.yaw; engineOff(); toHost({ t: 'cart', d: 0, mo: 'cart', p: [+CART.p.x.toFixed(2), +CART.p.z.toFixed(2)], y: +CART.yaw.toFixed(3) }); }
  else toHost({ t: 'cart', d: 0, mo: 'run' });
  CART.driving = false; CART.v = 0; RUN.on = false; RUN.v = 0; for (const k in cartIn) cartIn[k] = false;
  if (quiet) return;
  if (P.done) { V.mode = 'spec'; pickSpec(0); return; }
  P.club = autoClub(); P.yaw = autoAim(); fade(true); setTimeout(() => fade(false), 220); beginAim();
}
function skipToBall() {
  if (!(CART.driving || RUN.on) || P.done) return;
  drink('sip', true); toast('⏭ Skipped to your ball. That cost a sip (no power for this one).');
  if (CART.driving) { const ps = parkSpot(P.pos.x, P.pos.z, ME.slot); CART.p.set(ps.x, 0, ps.z); CART.yaw = ps.yaw; }
  endTravel();
}
function sendPose(force) {
  const t = now(); if (!force && t - CART.lastSend < 100) return; CART.lastSend = t;
  const q = travelPos(), y = CART.driving ? CART.yaw : RUN.yaw, v = CART.driving ? CART.v : RUN.v;
  toHost({ t: 'cart', mo: CART.driving ? 'cart' : 'run', p: [+q.x.toFixed(2), +q.z.toFixed(2)], y: +y.toFixed(3), v: +v.toFixed(2), d: 1 });
}
// Driving into a pond sinks the cart: you swim out and run for the rest of the hole.
function sinkCart() {
  SFX.splash(); toast('🌊 Your cart sank! You\'re on foot for the rest of the hole.'); ev('cartwater');
  const d = CART.dry || { x: CART.p.x, z: CART.p.z }, yaw = CART.yaw;
  engineOff(); CART.driving = false; CART.v = 0; CART.park = null; P.hasCart = false; toHost({ t: 'nocart' });
  RUN.p.set(d.x, 0, d.z); RUN.yaw = yaw + Math.PI; RUN.v = 0; RUN.dry = { ...d }; RUN.stunUntil = now() + 900; RUN.tripAt = now(); RUN.on = true; V.mode = 'run';
  sendPose(true);
}
function cartTree(x, z) {
  const H = HOLE, bx = Math.floor(x / 16), bz = Math.floor(z / 16);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = H.tgrid.get((bx + i) * 65536 + bz + j); if (a) for (const t of a) if (Math.hypot(x - t.x, z - t.z) < t.tr + 0.8) return t; }
  return null;
}
function runStep(dt, t) {
  const H = HOLE, b = drunk();
  const fwd = keys.has('w') || keys.has('arrowup') || cartIn.gas, back = keys.has('s') || keys.has('arrowdown') || cartIn.brake;
  const left = keys.has('a') || keys.has('arrowleft') || cartIn.left, right = keys.has('d') || keys.has('arrowright') || cartIn.right;
  const stunned = t < RUN.stunUntil;
  RUN.yaw += ((right ? 1 : 0) - (left ? 1 : 0)) * 2.2 * dt;
  const sf = surfAt(H, RUN.p.x, RUN.p.z), vmax = 6.5 * (sf === 'sand' ? 0.55 : sf === 'rough' || sf === 'oob' ? 0.85 : 1);
  RUN.v = lerp(RUN.v, stunned ? 0 : fwd ? vmax : back ? -2.5 : 0, 1 - Math.exp(-dt * 6));
  // drunk running: your line wanders, you lurch sideways, and now and then you trip
  const sp = Math.abs(RUN.v) / 6.5;
  RUN.yaw += b * 0.035 * Math.sin(t * 0.0011 + 1) * sp * dt;
  const lurch = b * 0.09 * Math.sin(t * 0.0023) * sp;
  if (!stunned && b > 4 && RUN.v > 4 && Math.random() < dt * b * 0.004) {
    RUN.stunUntil = t + 1300; RUN.tripAt = t; RUN.v = 0; SFX.thud(); toast('🤕 You tripped!'); ev('trip'); V.shakeT = t; V.shakeA = 0.6;
  }
  const dx = Math.sin(RUN.yaw), dz = -Math.cos(RUN.yaw), rx = Math.cos(RUN.yaw), rz = Math.sin(RUN.yaw);
  const nx = RUN.p.x + (dx * RUN.v + rx * lurch) * dt, nz = RUN.p.z + (dz * RUN.v + rz * lurch) * dt;
  let blocked = !!cartTree(nx, nz) || nx < H.m.x0 + 8 || nx > H.m.x1 - 8 || nz < H.m.z0 + 8 || nz > H.m.z1 - 8;
  for (const B of BALLS.values()) if (B.cart.visible && Math.hypot(B.cart.position.x - nx, B.cart.position.z - nz) < 1.3) blocked = true;
  if (blocked) RUN.v *= 0.3; else RUN.p.set(nx, 0, nz);
  if (surfAt(H, RUN.p.x, RUN.p.z) === 'water') {
    SFX.splash(); toast('💦 You ran into the water!'); ev('swim');
    RUN.p.set(RUN.dry.x, 0, RUN.dry.z); RUN.v = 0; RUN.stunUntil = t + 900; RUN.tripAt = t;
  } else RUN.dry = { x: RUN.p.x, z: RUN.p.z };
  RUN.phase += RUN.v * dt * 1.6;
  sendPose(false);
}
function driveCart(dt, t) {
  const H = HOLE, b = drunk();
  const gas = keys.has('w') || keys.has('arrowup') || cartIn.gas, brake = keys.has('s') || keys.has('arrowdown') || cartIn.brake;
  const left = keys.has('a') || keys.has('arrowleft') || cartIn.left, right = keys.has('d') || keys.has('arrowright') || cartIn.right;
  const sf = surfAt(H, CART.p.x, CART.p.z), vmax = 13 * (sf === 'sand' ? 0.45 : sf === 'rough' || sf === 'oob' ? 0.8 : 1);
  if (gas) CART.v += (CART.v < 0 ? 12 : 6) * dt; else if (brake) CART.v -= (CART.v > 0 ? 12 : 4) * dt; else CART.v *= Math.exp(-dt * 0.8);
  CART.v = clamp(CART.v, -5, Math.max(vmax, CART.v - 10 * dt));
  CART.steer = lerp(CART.steer, (right ? 1 : 0) - (left ? 1 : 0), 1 - Math.exp(-dt * 8));
  const drift = b * (0.045 * Math.sin(t * 0.0013) + 0.025 * Math.sin(t * 0.0041 + 2)); // steering gets loose when you're drunk
  CART.yaw += (CART.steer * 1.5 + drift) * clamp(CART.v / 5, -1, 1) * dt;
  const dx = Math.sin(CART.yaw), dz = -Math.cos(CART.yaw), nx = CART.p.x + dx * CART.v * dt, nz = CART.p.z + dz * CART.v * dt;
  let blocked = !!cartTree(nx, nz) || nx < H.m.x0 + 8 || nx > H.m.x1 - 8 || nz < H.m.z0 + 8 || nz > H.m.z1 - 8;
  for (const B of BALLS.values()) if (B.id !== ME.id && B.cart.visible && Math.hypot(B.cart.position.x - nx, B.cart.position.z - nz) < 1.9) blocked = true;
  if (blocked) { if (Math.abs(CART.v) > 3) SFX.thud(); CART.v = -CART.v * 0.3; }
  else CART.p.set(nx, 0, nz);
  if (engine) engine.o.frequency.setTargetAtTime(40 + Math.abs(CART.v) * 9, AC.currentTime, 0.05);
  // run over anyone standing at their ball
  if (Math.abs(CART.v) > 3 && t - CART.hitAt > 800) for (const B of BALLS.values()) {
    if (B.id === ME.id || !B.standing || t - B.flatT < 3500) continue;
    if (Math.hypot(B.avatar.position.x - CART.p.x, B.avatar.position.z - CART.p.z) < 1.5) {
      const sg = Math.sign(CART.v); CART.hitAt = t; CART.v *= 0.6; SFX.thud();
      toHost({ t: 'runover', id: B.id, dx: +(dx * sg).toFixed(2), dz: +(dz * sg).toFixed(2) });
    }
  }
  if (surfAt(H, CART.p.x, CART.p.z) === 'water') { sinkCart(); return; }
  CART.dry = { x: CART.p.x, z: CART.p.z };
  sendPose(false);
}
function resetBallVisual(B) { B.anim = null; B.trail.geometry.setDrawRange(0, 0); }
function placeBall(B, x, y, z) {
  B.ball.position.set(x, y, z);
  if (HOLE) { const gy = groundY(HOLE, x, z), h = Math.max(0, y - gy); B.shadow.position.set(x, gy + 0.012, z); const k = 1 + h * 0.08; B.shadow.scale.set(k, 1, k); B.shadow.material.opacity = 0.35 / k; }
}
// Starts playing back a simulated shot for ball B.
function playShot(B, pts, dt, ev, origin) {
  B.anim = { pts, dt, ev: ev || [], ei: 0, t0: now(), dur: (pts.length / 3 - 1) * dt, speed: 1, done: false, origin };
  const arr = B.trail.geometry.attributes.position.array, n = Math.min(pts.length / 3, 1500);
  for (let i = 0; i < n * 3; i++) arr[i] = pts[i];
  B.trail.geometry.attributes.position.needsUpdate = true; B.trail.geometry.setDrawRange(0, 0); B.trail.geometry.computeBoundingSphere();
}
function animBall(B, t) {
  const A = B.anim; if (!A || A.done) return;
  const el = (t - A.t0) / 1000 * A.speed;
  const f = el / A.dt, n = A.pts.length / 3, i = Math.min(n - 1, Math.floor(f)), k = Math.min(1, f - i), j = Math.min(n - 1, i + 1), p = A.pts;
  placeBall(B, lerp(p[i * 3], p[j * 3], k), lerp(p[i * 3 + 1], p[j * 3 + 1], k), lerp(p[i * 3 + 2], p[j * 3 + 2], k));
  B.trail.geometry.setDrawRange(0, Math.min(1500, i + 1));
  while (A.ei < A.ev.length && A.ev[A.ei][0] <= el) { if (B.id === ME.id || B.id === V.spec) playEvent(A.ev[A.ei][1], B); A.ei++; }
  if (el >= A.dur) { A.done = true; placeBall(B, p[(n - 1) * 3], p[(n - 1) * 3 + 1], p[(n - 1) * 3 + 2]); }
}
function playEvent(e) { if (e === 'land' || e === 'sand') SFX.land(); else if (e === 'splash') SFX.splash(); else if (e === 'tree') SFX.tree(); else if (e === 'cup') SFX.cup(); else if (e === 'lip') SFX.lip(); }

// ============================ first-person club ============================
// Rig space: the ball sits at the origin, the golfer looks down -z, the eye is at EYE_FULL / EYE_PUTT.
// The hands are just below the bottom of the view, so the shaft rises out of the screen to the ball.
const rig = new THREE.Group(); scene.add(rig);
const EYE_FULL = [2.6, 1.6], EYE_PUTT = [1.6, 1.35], PITCH_FULL = -0.3, PITCH_PUTT = -0.5;
const CLUB_RIG = {};
let sleeveMat = null;
{
  const metal = new THREE.MeshPhongMaterial({ color: 0xc9d1d9, specular: 0xffffff, shininess: 90 }), dark = new THREE.MeshPhongMaterial({ color: 0x23262b, specular: 0x888888, shininess: 60 });
  sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3ea6ff });
  const up = new THREE.Vector3(0, 1, 0), HEAD = new THREE.Vector3(0.06, 0.035, 0.1);
  const build = (kind, hands, pivot) => {
    const grp = new THREE.Group(); grp.position.copy(pivot); rig.add(grp);
    const seg = (a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), l = d.length(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), m); c.scale.set(1, l, 1); c.position.copy(a).addScaledVector(d, 0.5).sub(pivot); c.quaternion.setFromUnitVectors(up, d.normalize()); grp.add(c); };
    const along = new THREE.Vector3().subVectors(hands, HEAD).normalize();
    seg(HEAD, hands, 0.0085, metal);
    seg(hands.clone().addScaledVector(along, 0.05), new THREE.Vector3().lerpVectors(hands, HEAD, 0.2), 0.016, dark);
    let hm;
    if (kind === 'putter') hm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.035), metal);
    else if (kind === 'wood') { hm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), dark); hm.scale.set(1.25, 0.6, 1); }
    else { hm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.05, 0.014), metal); hm.rotation.x = -0.3; }
    hm.position.copy(HEAD).sub(pivot); grp.add(hm);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), sleeveMat); gl.scale.set(1, 1.4, 1); gl.position.copy(hands).sub(pivot); grp.add(gl);
    const v = new THREE.Vector3().subVectors(HEAD, pivot).normalize();
    grp.visible = false;
    return { grp, axis: new THREE.Vector3().crossVectors(v, new THREE.Vector3(1, 0, 0)).normalize(), max: kind === 'putter' ? 0.22 : 2.5, follow: kind === 'putter' ? 0.28 : 2.6 };
  };
  CLUB_RIG.wood = build('wood', new THREE.Vector3(-0.06, 0.86, 2.16), new THREE.Vector3(-0.02, 1.3, 2.4));
  CLUB_RIG.iron = build('iron', new THREE.Vector3(-0.06, 0.84, 2.1), new THREE.Vector3(-0.02, 1.3, 2.4));
  CLUB_RIG.putter = build('putter', new THREE.Vector3(-0.03, 0.74, 1.26), new THREE.Vector3(-0.02, 1.1, 1.45));
}
const clubKind = ci => ci <= 1 ? 'wood' : ci === PUTTER ? 'putter' : 'iron';
function showClub(ci) { const k = clubKind(ci); for (const n in CLUB_RIG) CLUB_RIG[n].grp.visible = n === k; return CLUB_RIG[k]; }

// ============================ game state ============================
const ME = { id: 0, name: 'Player', slot: 0 };
let S = null; // last state from the host
const P = { atk: 5, key: '', strokes: 0, putts: 0, pos: null, prev: null, lie: 'tee', done: false, yaw: 0, club: 0, firstShot: true, pend: null };
const V = { mode: 'none', t0: 0, look: 0, zoom: false, fov: 60, spec: 0, camPos: new THREE.Vector3(0, 30, 60), camYaw: 0, camPitch: -0.2, post: 0, walkAt: 0, banner: 0, introDur: 4200 };
const MT = { st: 'idle', x: 0, disp: 0, pow: 0, acc: 0, t: 0, swingA: 0, follow: 0, msg: '', msgT: 0 };
const myPar = () => HOLE ? HOLE.par : 4;
const playerColor = id => { const p = S && S.pl.find(q => q.id === id); return p ? PCOL[p.slot] : '#fff'; };
const playerName = id => { const p = S && S.pl.find(q => q.id === id); return p ? p.n : 'Player'; };
function teeSpot(H, slot) { const c = Math.cos(H.teeA), s = Math.sin(H.teeA), u = (slot - 1.5) * 2.4; return { x: u * c, z: u * s }; }
function distToPin(x, z) { return Math.hypot(HOLE.cup.x - x, HOLE.cup.z - z); }
function yawTo(x0, z0, x1, z1) { return Math.atan2(x1 - x0, -(z1 - z0)); }
function lieMult(ci, lie) { if (CLUBS[ci].putt) return 1; if (lie === 'sand') return CLUBS[ci].id === 'SW' ? 0.88 : 0.6; return SURF[lie] ? SURF[lie].lie : 1; }
const clubReach = ci => CLUBS[ci].carry * lieMult(ci, P.lie) * powerMult(CLUBS[ci].putt);
function autoClub() {
  const d = distToPin(P.pos.x, P.pos.z);
  if (P.lie === 'green' || (P.lie === 'fringe' && d < 16) || d < 7) return PUTTER;
  let best = 0; for (let i = PUTTER - 1; i >= 0; i--) { if (clubReach(i) >= d * 0.97) { best = i; break; } }
  if (P.lie === 'sand' && best < 6 && d < 60) best = 6;
  return best;
}
function autoAim() {
  const x = P.pos.x, z = P.pos.z, d = distToPin(x, z), reach = clubReach(P.club);
  if (CLUBS[P.club].putt || d <= reach + 25) return yawTo(x, z, HOLE.cup.x, HOLE.cup.z);
  const me = pathProject(HOLE, x, z);
  let target = null;
  for (let s = HOLE.total; s > me.s; s -= 4) { const p = pathAt(HOLE, s); if (Math.hypot(p.x - x, p.z - z) <= reach * 0.95) { target = p; break; } }
  return target ? yawTo(x, z, target.x, target.z) : yawTo(x, z, HOLE.cup.x, HOLE.cup.z);
}
function startHole(s) {
  const key = s.seed + ':' + s.game + ':' + s.hole;
  if (!HOLE || HOLE.seed !== s.seed || HOLE.idx !== s.hole) buildHole(s.seed, s.hole, s.nh);
  P.key = key; P.strokes = 0; P.putts = 0; P.done = false; P.lie = 'tee'; P.firstShot = true; P.pend = null;
  const ts = teeSpot(HOLE, ME.slot); P.pos = { x: ts.x, y: groundY(HOLE, ts.x, ts.z) + BR, z: ts.z }; P.prev = { ...P.pos };
  if (CART.driving || RUN.on) endTravel(true);
  P.hasCart = false; CART.park = null; FUN.st = 'offer'; P.atk = 5; ATK.armed = false; for (const A of ATKS) A.dead = true;
  for (const B of BALLS.values()) { resetBallVisual(B); B.rest = null; B.driving = false; B.running = false; B.ct = null; B.rp = null; B.park = null; B.flatT = 0; }
  P.club = autoClub(); P.yaw = autoAim(); V.look = 0;
  MT.st = 'idle'; MT.follow = 0; MT.swingA = 0;
  V.mode = 'intro'; V.t0 = now(); V.spec = 0;
  const yd = yds(HOLE.total);
  showBanner('Hole ' + (s.hole + 1), 'Par ' + HOLE.par + ' · ' + yd + ' yds', V.introDur);
  closeOverlays();
}
function beginAim() {
  V.mode = 'aim'; V.look = 0; MT.st = 'idle'; MT.follow = 0; MT.swingA = 0; hideBanner();
  sendAim(true);
}

// ----- swinging -----
const ZONE = 0.04, ZONE_OK = 0.1, METER_MIN = -0.15;
function swingPress() {
  if (ATK.armed) { fireAtk(); return; }
  if (V.mode !== 'aim') { if (V.mode === 'intro') beginAim(); return; }
  audio();
  if (MT.st === 'idle') { MT.st = 'up'; MT.x = 0; MT.t = 0; MT.pow = 0; MT.msg = ''; }
  else if (MT.st === 'up') { MT.pow = clamp(MT.disp, 0.02, 1); MT.st = 'down'; SFX.whoosh(); }
  else if (MT.st === 'down') { MT.acc = MT.disp; takeShot(); }
}
function updateMeter(dt) {
  if (MT.st !== 'up' && MT.st !== 'down') return;
  const b = drunk(), sp = 1 + 0.05 * b; MT.t += dt;
  const putt = CLUBS[P.club].putt;
  if (MT.st === 'up') { MT.x += dt * (putt ? 0.585 : 0.72) * sp; if (MT.x >= 1) { MT.x = 1; MT.pow = 1; MT.st = 'down'; SFX.whoosh(); } }
  else { MT.x -= dt * 1.125 * sp; }
  const jit = (Math.sin(MT.t * 13.1) * 0.6 + Math.sin(MT.t * 7.3 + 1) * 0.4) * 0.006 * b;
  MT.disp = clamp(MT.x + jit, METER_MIN, 1);
  if (MT.st === 'down' && MT.x <= METER_MIN) { MT.acc = METER_MIN; takeShot(); }
}
function swayYaw(t, putt) { const b = drunk(); return b * 0.009 * (putt ? 0.5 : 1) * (Math.sin(t * 0.00083) * 0.65 + Math.sin(t * 0.00191 + 1.3) * 0.35); }
function takeShot() {
  const club = CLUBS[P.club], b = drunk(), putt = !!club.putt, t = now();
  let e = MT.acc, verdict;
  if (Math.abs(e) < ZONE) { e = 0; verdict = 'Perfect!'; } else if (Math.abs(e) < ZONE_OK) verdict = e > 0 ? 'Slight push' : 'Slight pull'; else verdict = e > 0 ? (putt ? 'Pushed it!' : 'Slice!') : (putt ? 'Pulled it!' : 'Hook!');
  const topped = !putt && Math.abs(MT.acc) > 0.13;
  if (topped) verdict = 'Topped it!';
  // the drunker you are, the likelier a shank (or a yipped putt)
  const shank = b >= 2 && Math.random() < Math.min(putt ? 0.15 : 0.3, b * (putt ? 0.008 : 0.015));
  if (shank) verdict = putt ? 'Yipped it!' : 'SHANK!';
  MT.msg = verdict; MT.msgT = t;
  const M = powerMult(putt);
  let yaw = P.yaw + swayYaw(t, putt) + e * (putt ? 0.05 : 0.06) + gauss() * 0.004 * b * (putt ? 0.4 : 1);
  if (shank) yaw += (Math.random() < 0.75 ? 1 : -1) * (putt ? 0.15 + Math.random() * 0.2 : 0.6 + Math.random() * 0.5);
  let res;
  if (putt) {
    const d = club.carry * MT.pow * M * (P.lie === 'green' ? 1 : 0.85);
    res = simulate(HOLE, P.pos, { putt: true, v0: Math.sqrt(2 * SURF.green.mu * G * d), yaw });
    SFX.putt();
  } else {
    let d = club.carry * MT.pow * lieMult(P.club, P.lie), ang = club.ang * D2R;
    if (topped) { d *= 0.45; ang *= 0.35; }
    if (shank) { d *= 0.55; ang *= 0.6; }
    const side = (e * 0.012 + gauss() * 0.0002 * b) * club.side;
    res = simulate(HOLE, P.pos, { v0: v0For(club, d), ang, lift: club.lift * (topped ? 0.3 : 1), side, bite: club.bite, M, yaw });
    SFX.hit();
  }
  MT.st = 'hit'; MT.follow = 0.0001;
  P.prev = { ...P.pos }; P.pend = { res, club: P.club, putt, shank, wasGreen: P.lie === 'green' };
  const B = getBall(ME.id); playShot(B, res.pts, res.dt, res.ev, { ...P.pos, yaw: P.yaw });
  V.mode = 'flight'; V.t0 = t; V.flyYaw = V.camYaw; V.flyPitch = V.camPitch;
  // share a lighter copy of the path (15 samples a second) so friends can watch
  const sp = []; for (let i = 0; i < res.pts.length / 3; i += 2) sp.push(+res.pts[i * 3].toFixed(2), +res.pts[i * 3 + 1].toFixed(2), +res.pts[i * 3 + 2].toFixed(2));
  const n = res.pts.length / 3; if ((n - 1) % 2) sp.push(+res.end[0].toFixed(2), +res.end[1].toFixed(2), +res.end[2].toFixed(2));
  toHost({ t: 'shot', pts: sp, dt: res.dt * 2, y: P.yaw, ev: res.ev.filter(x => x[1] !== 'land').map(x => [+x[0].toFixed(2), x[1]]) });
}
function finishShot() {
  const R = P.pend; if (!R) return; P.pend = null;
  const res = R.res, H = HOLE, par = H.par;
  P.strokes++; if (R.putt || R.wasGreen) P.putts++;
  let feed = '', water = false, ob = false, drive = 0;
  if (res.out === 'holed') {
    P.done = true; P.pos = { x: H.cup.x, y: groundY(H, H.cup.x, H.cup.z) - 0.05, z: H.cup.z };
  } else if (res.out === 'water') {
    water = true; P.strokes++;
    const sx = P.prev.x, sz = P.prev.z; let x = res.waterAt[0], z = res.waterAt[1]; const L = Math.hypot(x - sx, z - sz) || 1, ux = (sx - x) / L, uz = (sz - z) / L;
    for (let k = 0; k < 400 && surfAt(H, x, z) === 'water'; k++) { x += ux; z += uz; }
    x += ux * 2.5; z += uz * 2.5; if (surfAt(H, x, z) === 'water' || !inBounds(H, x, z)) { x = sx; z = sz; }
    P.pos = { x, y: groundY(H, x, z) + BR, z };
    toast('💦 Water! One-stroke penalty, drop by the hazard'); ev('water');
  } else if (res.out === 'oob') {
    ob = true; P.strokes++; P.pos = { ...P.prev };
    toast('🚫 Out of bounds! Stroke and distance'); ev('oob');
  } else {
    P.pos = { x: res.end[0], y: res.end[1], z: res.end[2] };
    if (P.firstShot && par > 3 && !R.putt) drive = res.total;
  }
  P.firstShot = false;
  P.lie = P.done ? 'green' : surfAt(H, P.pos.x, P.pos.z);
  if (R.shank) ev('shank');
  if (res.ev.some(x => x[1] === 'tree')) ev('tree');
  if (res.out === 'rest' && P.lie === 'sand' && !R.putt) ev('bunker');
  if (!P.done && P.lie === 'green' && distToPin(P.pos.x, P.pos.z) < 0.6) {
    P.strokes++; P.putts++; P.done = true; toast('Tap-in'); SFX.cup(); P.pos = { x: H.cup.x, y: groundY(H, H.cup.x, H.cup.z) - 0.05, z: H.cup.z };
  }
  if (!P.done && !timeMode() && P.strokes >= par + 4) { P.done = true; P.strokes = par + 4; toast('Picked up at ' + P.strokes); }
  const dist = res.out === 'rest' && !R.putt ? ' · ' + yds(res.total) + ' yds' : '';
  if (!P.done && res.out === 'rest') toast((R.putt ? '' : SURF[P.lie].name) + dist + (R.putt ? fmtDist(distToPin(P.pos.x, P.pos.z)) + ' left' : ''));
  if (P.done) holeOut();
  toHost({ t: 'ball', p: [P.pos.x, P.pos.y, P.pos.z], k: P.strokes, lie: P.lie, dn: P.done, drive, water, ob, feed });
  if (!P.done) startTravel({ x: P.prev.x, z: P.prev.z, yaw: P.yaw });
}
function scoreName(k, par) {
  if (k === 1) return 'Hole in one!';
  const d = k - par;
  return d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : d === 3 ? 'Triple bogey' : '+' + d;
}
function holeOut() {
  const par = HOLE.par, d = P.strokes - par, nm = scoreName(P.strokes, par);
  showBanner(nm, P.strokes + (P.strokes === 1 ? ' stroke' : ' strokes'), 3500);
  if (d < 0) { SFX.cheer(); SFX.chime(); } else if (d > 1) SFX.aww();
  if (P.strokes === 1) ev('ace'); else if (d < 0) ev('birdie');
  if (P.putts >= 3) ev('threeputt');
  if (d >= 2) ev('blowup');
  V.mode = 'done'; V.t0 = now();
}
const ev = e => toHost({ t: 'ev', e });
function pickUp() {
  if (!HOLE || P.done || !S || S.phase !== 'play') return;
  if (CART.driving || RUN.on) endTravel(true);
  P.done = true; if (!timeMode()) P.strokes = HOLE.par + 4; toast(timeMode() ? 'Picked up: ' + fmtTime(TIME_CAP) + ' for this hole' : 'Picked up at ' + P.strokes);
  toHost({ t: 'ball', p: [P.pos.x, P.pos.y, P.pos.z], k: P.strokes, lie: P.lie, dn: true, pu: 1 });
  V.mode = 'done'; V.t0 = now();
}
let lastAimSent = 0, lastAimVal = 1e9;
function sendAim(force) { const t = now(); if (!force && (t - lastAimSent < 250 || Math.abs(lastAimVal - P.yaw) < 0.004)) return; lastAimSent = t; lastAimVal = P.yaw; toHost({ t: 'aim', y: +P.yaw.toFixed(3) }); }

// ============================ camera ============================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function eyeFor(x, y, z, yaw, putt) {
  const [back, up] = putt ? EYE_PUTT : EYE_FULL, gy = HOLE ? groundY(HOLE, x, z) : y;
  return _v.set(x - Math.sin(yaw) * back, gy + up, z + Math.cos(yaw) * back);
}
function lookFrom(pos, tgt) { const dx = tgt.x - pos.x, dy = tgt.y - pos.y, dz = tgt.z - pos.z; return [Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; }
const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function updateCamera(dt, t) {
  const b = drunk(), fx = SET.fx ? 1 : 0.35;
  let roll = Math.sin(t * 0.00061) * 0.0065 * b * fx, wob = Math.sin(t * 0.00113 + 0.5) * 0.0045 * b * fx;
  const baseFov = camera.aspect < 1 ? 74 : 58;
  const H = HOLE;
  if (!H) { camera.position.set(0, 40, 80); camera.rotation.set(-0.3, 0, 0); }
  else if (V.mode === 'intro') {
    const k = clamp((t - V.t0) / V.introDur, 0, 1), e = k * k * (3 - 2 * k);
    const s = e * H.total * 0.92, p = pathAt(H, s), ahead = pathAt(H, Math.min(H.total, s + 90));
    const hgt = 28 + Math.sin(k * Math.PI) * 26;
    V.camPos.set(p.x - p.dx * 40, groundY(H, p.x, p.z) + hgt, p.z - p.dz * 40);
    const tg = _v2.set(ahead.x, groundY(H, ahead.x, ahead.z), ahead.z); [V.camYaw, V.camPitch] = lookFrom(V.camPos, tg);
    roll = 0; wob = 0;
    if (k >= 1) beginAim();
  } else if (V.mode === 'cart') {
    const c = BALLS.get(ME.id).cart; c.updateMatrixWorld(true);
    V.camPos.set(-0.3, 1.5, 0.12).applyMatrix4(c.matrixWorld);
    if (drag.id == null) CART.look *= Math.exp(-dt * 2.5);
    V.camYaw = CART.yaw + CART.look; V.camPitch = -0.1 + c.rotation.x + V.look * 0.5; roll += c.rotation.z;
  } else if (V.mode === 'run') {
    const sp = Math.abs(RUN.v) / 6.5, tr = (t - RUN.tripAt) / 1300;
    let eye = 1.65 + Math.sin(RUN.phase * 2) * 0.06 * sp;
    if (tr < 1) { const k = smooth(0.45, 1, tr); eye = lerp(0.4, eye, k); roll += 0.5 * (1 - k); }
    V.camPos.set(RUN.p.x, groundY(H, RUN.p.x, RUN.p.z) + eye, RUN.p.z);
    V.camYaw = RUN.yaw; V.camPitch = -0.08 + V.look; roll += Math.sin(RUN.phase) * 0.015 * sp;
  } else if (V.mode === 'aim' || V.mode === 'walk' || (V.mode === 'flight' && !SET.cam) || V.mode === 'done' && V.t0 + 600 > t) {
    const putt = CLUBS[P.club].putt, origin = V.mode === 'flight' || V.mode === 'done' ? (P.prev || P.pos) : P.pos;
    const yaw = V.mode === 'aim' ? P.yaw + swayYaw(t, putt) : P.yaw;
    V.camPos.copy(eyeFor(origin.x, origin.y, origin.z, P.yaw, putt));
    if (V.mode === 'flight') {
      const B = BALLS.get(ME.id), el = t - V.t0;
      if (B && el > 350) { const [yw, pt] = lookFrom(V.camPos, B.ball.position); const k = 1 - Math.exp(-dt * 5); V.camYaw = angLerp(V.camYaw, yw, k); V.camPitch = lerp(V.camPitch, clamp(pt, -0.9, 0.9), k); }
    } else { V.camYaw = yaw; V.camPitch = (putt ? PITCH_PUTT : PITCH_FULL) + V.look; }
  } else if (V.mode === 'flight' && SET.cam) {
    const B = BALLS.get(ME.id); if (B) chaseCam(B, dt);
  } else if (V.mode === 'spec' || V.mode === 'done') {
    specCam(dt, t);
  } else {
    // menus and scorecards: drift around the green
    const a = t * 0.00006, gx = H.green.x, gz = H.green.z;
    V.camPos.set(gx + Math.sin(a) * 70, H.greenH + 26, gz + Math.cos(a) * 70);
    [V.camYaw, V.camPitch] = lookFrom(V.camPos, _v2.set(gx, H.greenH, gz)); roll = 0; wob = 0;
  }
  camera.position.copy(V.camPos);
  camera.rotation.set(V.camPitch + wob, -V.camYaw, roll);
  const sh = V.shakeT ? Math.max(0, 1 - (t - V.shakeT) / 700) * (V.shakeA || 0.3) : 0;
  if (sh > 0) { camera.position.x += (Math.random() - 0.5) * sh * 0.3; camera.position.y += (Math.random() - 0.5) * sh * 0.3; camera.rotation.z += (Math.random() - 0.5) * sh * 0.2; }
  const fov = V.zoom && (V.mode === 'aim' || V.mode === 'spec') ? baseFov / 3.2 : baseFov;
  V.fov = lerp(V.fov, fov, 1 - Math.exp(-dt * 8));
  if (Math.abs(camera.fov - V.fov) > 0.01) { camera.fov = V.fov; camera.updateProjectionMatrix(); }
}
function chaseCam(B, dt) {
  const A = B.anim, p = B.ball.position;
  let dx = 0, dz = -1;
  if (A && A.origin) { dx = p.x - A.origin.x; dz = p.z - A.origin.z; const l = Math.hypot(dx, dz); if (l > 3) { dx /= l; dz /= l; } else { dx = Math.sin(A.origin.yaw); dz = -Math.cos(A.origin.yaw); } }
  const want = _v2.set(p.x - dx * 8, Math.max(p.y, groundY(HOLE, p.x, p.z)) + 2.8, p.z - dz * 8);
  want.y = Math.max(want.y, groundY(HOLE, want.x, want.z) + 1.5);
  V.camPos.lerp(want, 1 - Math.exp(-dt * 6));
  [V.camYaw, V.camPitch] = lookFrom(V.camPos, p);
}
function specCam(dt, t) {
  const id = V.spec, B = id && BALLS.get(id);
  if (!B || !B.rest && !B.anim) {
    const gx = HOLE.green.x, gz = HOLE.green.z, a = t * 0.00008;
    V.camPos.lerp(_v2.set(gx + Math.sin(a) * 40, HOLE.greenH + 18, gz + Math.cos(a) * 40), 1 - Math.exp(-dt * 2));
    [V.camYaw, V.camPitch] = lookFrom(V.camPos, _v2.set(gx, HOLE.greenH, gz)); return;
  }
  if (B.anim && !B.anim.done && SET.cam) { chaseCam(B, dt); return; }
  const o = B.anim && !B.anim.done ? B.anim.origin : B.rest;
  const yaw = B.anim && !B.anim.done ? B.anim.origin.yaw : B.yaw;
  const putt = HOLE && surfAt(HOLE, o.x, o.z) === 'green';
  V.camPos.lerp(eyeFor(o.x, o.y, o.z, yaw, putt), 1 - Math.exp(-dt * 6));
  if (B.anim && !B.anim.done) { const [yw, pt] = lookFrom(V.camPos, B.ball.position); const k = 1 - Math.exp(-dt * 5); V.camYaw = angLerp(V.camYaw, yw, k); V.camPitch = lerp(V.camPitch, clamp(pt, -0.9, 0.9), k); }
  else { const k = 1 - Math.exp(-dt * 6); V.camYaw = angLerp(V.camYaw, yaw, k); V.camPitch = lerp(V.camPitch, putt ? PITCH_PUTT : PITCH_FULL, k); }
}
function specCandidates() { return S ? S.pl.filter(p => p.id !== ME.id && !p.dn).map(p => p.id) : []; }
function pickSpec(dir) {
  const c = specCandidates(); if (!c.length) { V.spec = 0; return; }
  const i = c.indexOf(V.spec); V.spec = c[((i < 0 ? 0 : i + dir) % c.length + c.length) % c.length];
}

// ============================ per-frame game update ============================
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 45, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc53d, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false }));
beacon.geometry.translate(0, 22.5, 0); beacon.visible = false; scene.add(beacon);
const tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
tgtRing.geometry.rotateX(-Math.PI / 2); tgtRing.renderOrder = 2; scene.add(tgtRing);
const dotGeo = new THREE.CircleGeometry(1, 10); dotGeo.rotateX(-Math.PI / 2);
const aimDots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), 24); aimDots.renderOrder = 2; aimDots.frustumCulled = false; scene.add(aimDots);
let targetInfo = null;
function updateAimGuides(t) {
  const show = V.mode === 'aim' && HOLE;
  tgtRing.visible = show; aimDots.visible = show; targetInfo = null;
  if (!show) return;
  const putt = CLUBS[P.club].putt, yaw = P.yaw + swayYaw(t, putt), dx = Math.sin(yaw), dz = -Math.cos(yaw);
  const pw = MT.st === 'down' || MT.st === 'hit' ? MT.pow : 1;
  let reach = clubReach(P.club) * pw; if (putt && P.lie !== 'green') reach *= 0.85;
  const x = P.pos.x + dx * reach, z = P.pos.z + dz * reach, y = groundY(HOLE, x, z);
  const sc = putt ? 0.35 : Math.max(1.2, reach / 45);
  tgtRing.position.set(x, y + 0.06, z); tgtRing.scale.set(sc, 1, sc);
  const m = new THREE.Matrix4(), n = putt ? 24 : 16;
  for (let i = 0; i < 24; i++) {
    const f = (i + 1) / (n + 1), px = P.pos.x + dx * reach * f, pz = P.pos.z + dz * reach * f, r = putt ? 0.035 : 0.08 + reach * f * 0.006;
    m.makeScale(r, 1, r); m.setPosition(px, groundY(HOLE, px, pz) + 0.04, pz); aimDots.setMatrixAt(i, i < n ? m : m.makeScale(0, 0, 0));
  }
  aimDots.instanceMatrix.needsUpdate = true;
  targetInfo = { x, y, z, d: reach };
}
function updateGame(dt, t) {
  const H = HOLE;
  // own swing rig
  const putt = CLUBS[P.club].putt;
  const CR = showClub(P.club);
  rig.visible = (V.mode === 'aim' || (V.mode === 'flight' && t - V.t0 < 1400)) && !P.done && !SET.cam || (V.mode === 'flight' && SET.cam && t - V.t0 < 300);
  if (rig.visible) {
    const o = V.mode === 'flight' ? P.prev : P.pos; const gy = groundY(H, o.x, o.z);
    const yaw = V.mode === 'aim' ? P.yaw + swayYaw(t, putt) : P.yaw;
    rig.position.set(o.x, gy, o.z); rig.rotation.set(0, -yaw, 0);
    let a = 0;
    if (MT.st === 'up' || MT.st === 'down') { MT.swingA = lerp(MT.swingA, Math.max(0, MT.x) * CR.max, 1 - Math.exp(-dt * 18)); a = MT.swingA; }
    else if (MT.st === 'hit') { MT.follow = Math.min(1, MT.follow + dt * 3.2); a = -MT.follow * CR.follow; }
    CR.grp.quaternion.setFromAxisAngle(CR.axis, a);
  }
  updateMeter(dt);
  // balls
  for (const B of BALLS.values()) {
    if (B.anim && !B.anim.done) animBall(B, t);
    else if (B.id === ME.id) { if (P.pos && !P.done) placeBall(B, P.pos.x, groundY(H, P.pos.x, P.pos.z) + BR, P.pos.z); }
    else if (B.rest) placeBall(B, B.rest.x, B.rest.y, B.rest.z);
    const holed = B.id === ME.id ? P.done && !(B.anim && !B.anim.done) : B.dn && !(B.anim && !B.anim.done);
    const has = B.id === ME.id ? !!P.pos : !!(B.rest || (B.anim && !B.anim.done));
    B.ball.visible = has && !holed && V.mode !== 'intro'; B.shadow.visible = B.ball.visible;
    B.trail.visible = !!B.anim && V.mode !== 'intro';
    if (B.avatar) {
      if ((B.driving || B.running) && B.ct && t - B.ct.at > 3000) { B.driving = B.running = false; B.ct = null; }
      const run = B.running && B.ct ? remotePose(B, dt, t) : null; if (!run) B.rp = null;
      const st = run || (B.anim && !B.anim.done ? B.anim.origin : B.rest), yw = run ? run.yaw : B.anim && !B.anim.done ? B.anim.origin.yaw : B.yaw;
      B.standing = !!(st && (run || !B.dn) && !B.driving && V.mode !== 'intro');
      if (B.standing) {
        const ax = run ? run.x : st.x - Math.sin(yw) * 0.9, az = run ? run.z : st.z + Math.cos(yw) * 0.9;
        B.avatar.position.set(ax, groundY(H, ax, az), az); B.avatar.rotation.set(0, -yw, 0);
        const sw = run ? Math.sin(run.ph) * 0.75 * Math.min(1, Math.abs(B.ct.v) / 3) : 0; B.avatar.userData.legs[0].rotation.x = sw; B.avatar.userData.legs[1].rotation.x = -sw;
        const ft = (t - B.flatT) / 1000;
        if (B.flatKind === 'bonk' && ft < 1.6) { // knocked over by an attack ball, then straight back up
          B.avatar.rotation.x = -Math.min(1, ft / 0.25) * Math.PI / 2 * (ft < 1.3 ? 1 : (1.6 - ft) / 0.3); B.avatar.position.y += 0.1;
        } else if (B.flatKind !== 'bonk' && ft < 3.2) { // launched by a cart, then flat on the grass, then back up
          const e = Math.min(ft, 0.9); B.avatar.position.x += B.flatDir[0] * e * 5; B.avatar.position.z += B.flatDir[1] * e * 5;
          if (ft < 0.9) { B.avatar.position.y += 4.4 * ft - 4.9 * ft * ft; B.avatar.rotation.x = -ft * 9; } else { B.avatar.rotation.x = -Math.PI / 2; B.avatar.position.y += 0.15; }
        }
        B.avatar.visible = V.mode === 'cart' || Math.hypot(B.avatar.position.x - camera.position.x, B.avatar.position.z - camera.position.z) > 2.2;
      } else B.avatar.visible = false;
    }
    updateCart(B, dt, t);
  }
  if (V.mode === 'cart') driveCart(dt, t); else if (V.mode === 'run') runStep(dt, t);
  updateAtks(dt);
  // your ball's beacon while you're travelling to it
  beacon.visible = travelling() && !P.done && !!P.pos;
  if (beacon.visible) { beacon.position.set(P.pos.x, groundY(H, P.pos.x, P.pos.z), P.pos.z); beacon.material.opacity = 0.22 + Math.sin(t * 0.005) * 0.08; beacon.material.color.set(PCOL[ME.slot]); }
  // flag flutter
  if (flagCloth) { const p = flagCloth.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(t * 0.006 + x * 6) * 0.06 * x); } p.needsUpdate = true; flagCloth.rotation.y = Math.atan2(-H.wind.z, H.wind.x) + Math.PI * 0; }
  if (flagGroup) flagGroup.visible = !(V.mode === 'aim' && CLUBS[P.club].putt && distToPin(P.pos.x, P.pos.z) < 2.5);
  updateAimGuides(t);
  // own shot finished?
  if (V.mode === 'flight') {
    const B = BALLS.get(ME.id);
    if (!B || !B.anim || B.anim.done) { if (!V.post) V.post = t; if (t - V.post > 900) { V.post = 0; finishShot(); } }
  }
  if (V.mode === 'walk' && t - V.t0 > 420) {
    P.club = autoClub(); P.yaw = autoAim(); fade(false); beginAim();
  }
  if (V.mode === 'done' && t - V.t0 > 3200) { V.mode = 'spec'; pickSpec(0); hideBanner(); }
  if (V.mode === 'spec') { const c = specCandidates(); if (!c.includes(V.spec)) pickSpec(0); }
  if (V.mode === 'aim') sendAim(false);
}

// ============================ attack balls ============================
// Five per hole, in either mode; they never count as strokes. Arm one and a crosshair appears;
// fire and it flies fast and flat straight where you're looking. The shooter's browser decides
// hits, with a generous hit zone; a hit knocks the player down for a moment.
const ATK = { armed: false, armT: 0 };
const ATKS = [];
const atkGeo = new THREE.SphereGeometry(0.2, 14, 10), atkMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a });
const canAtk = () => !!(HOLE && S && S.phase === 'play' && P.atk > 0 && ((V.mode === 'aim' && MT.st === 'idle') || V.mode === 'run' || V.mode === 'cart' || V.mode === 'spec' || V.mode === 'done'));
function armAtk() {
  if (ATK.armed) { fireAtk(); return; }
  if (!canAtk()) return;
  ATK.armed = true; ATK.armT = now(); SFX.tick();
  if (V.mode === 'aim') V.look = -(CLUBS[P.club].putt ? PITCH_PUTT : PITCH_FULL) - 0.03; // eyes up to the horizon
}
function disarmAtk() { if (!ATK.armed) return; ATK.armed = false; if (V.mode === 'aim') V.look = 0; }
function fireAtk() {
  if (!ATK.armed || !canAtk()) { disarmAtk(); return; }
  disarmAtk(); P.atk--;
  const pitch = V.camPitch + 0.07, cp = Math.cos(pitch), d = [Math.sin(V.camYaw) * cp, Math.sin(pitch), -Math.cos(V.camYaw) * cp];
  const o = camera.position, p0 = [o.x + d[0] * 1.2, o.y - 0.2 + d[1] * 1.2, o.z + d[2] * 1.2], v = d.map(x => x * 60);
  const id = Math.random().toString(36).slice(2, 8);
  spawnAtk(id, p0, v, true); SFX.hit();
  toHost({ t: 'atk', a: id, p: p0.map(x => +x.toFixed(2)), v: v.map(x => +x.toFixed(2)) });
}
function spawnAtk(id, p0, v, mine) {
  if (!Array.isArray(p0) || !Array.isArray(v) || p0.length < 3 || v.length < 3) return;
  const mesh = new THREE.Mesh(atkGeo, atkMat); mesh.position.set(p0[0], p0[1], p0[2]); scene.add(mesh);
  ATKS.push({ id, p: new THREE.Vector3(p0[0], p0[1], p0[2]), v: new THREE.Vector3(v[0], v[1], v[2]), t: 0, mine, mesh, dead: false });
}
function updateAtks(dt) {
  for (const A of ATKS) {
    for (let k = 0; k < 4 && !A.dead; k++) {
      const h = dt / 4; A.v.y -= G * h; A.p.addScaledVector(A.v, h); A.t += h;
      if (A.mine) for (const B of BALLS.values()) {
        if (B.id === ME.id) continue;
        let c = null, r = 1.6;
        if (B.driving && B.cart.visible) { c = B.cart.position; r = 2.1; } else if (B.standing && B.avatar) c = B.avatar.position;
        if (!c || Math.hypot(A.p.x - c.x, A.p.y - (c.y + 1), A.p.z - c.z) > r) continue;
        A.dead = true; SFX.thud(); const l = Math.hypot(A.v.x, A.v.z) || 1;
        toHost({ t: 'bonk', id: B.id, a: A.id, dx: +(A.v.x / l).toFixed(2), dz: +(A.v.z / l).toFixed(2) }); break;
      }
      const gy = groundY(HOLE, A.p.x, A.p.z);
      if (A.p.y < gy + 0.2 || A.t > 2.5 || (A.p.y < gy + 8 && cartTree(A.p.x, A.p.z))) A.dead = true;
    }
    A.mesh.position.copy(A.p); A.mesh.scale.setScalar(1 + Math.sin(A.t * 30) * 0.12);
  }
  for (let i = ATKS.length - 1; i >= 0; i--) if (ATKS[i].dead) { scene.remove(ATKS[i].mesh); ATKS.splice(i, 1); }
  if (ATK.armed && (!canAtk() || now() - ATK.armT > 10000)) disarmAtk();
}

// ============================ HUD ============================
const txtCache = new Map();
function setText(el, s) { if (txtCache.get(el) !== s) { txtCache.set(el, s); el.textContent = s; } }
function setHTML(el, s) { if (txtCache.get(el) !== s) { txtCache.set(el, s); el.innerHTML = s; } }
const meterPct = x => (x - METER_MIN) / (1 - METER_MIN) * 100;
{ $('mZone').style.left = meterPct(-ZONE) + '%'; $('mZone').style.width = (meterPct(ZONE) - meterPct(-ZONE)) + '%'; $('mZoneOk').style.left = meterPct(-ZONE_OK) + '%'; $('mZoneOk').style.width = (meterPct(ZONE_OK) - meterPct(-ZONE_OK)) + '%'; }
function updateHud(t) {
  if (!HOLE || !S || $('hud').hidden) return;
  const H = HOLE, b = drunk();
  setText($('iHole'), String(S.hole + 1)); setText($('iPar'), String(H.par));
  const me = S.pl.find(q => q.id === ME.id), el = t - S.holeStart;
  const clock = timeMode() ? (P.done && me && me.tm && me.tm[S.hole] != null ? '⏱ ' + fmtTime(me.tm[S.hole]) + ' · ' : el < 0 ? '⏱ starts in ' + Math.ceil(-el / 1000) + ' · ' : '⏱ <b>' + fmtTime(el) + '</b> · ') : '';
  if (P.done) { setHTML($('iLine1'), clock + 'Holed out · ' + P.strokes + (P.strokes === 1 ? ' stroke' : ' strokes')); setText($('iLine2'), V.spec ? 'Watching ' + playerName(V.spec) : 'Waiting for the others'); }
  else if (P.pos) {
    const d = distToPin(P.pos.x, P.pos.z);
    setHTML($('iLine1'), clock + 'Shot <b>' + (P.strokes + 1) + '</b> · <b>' + fmtDist(d) + '</b> to pin');
    const lm = lieMult(P.club, P.lie);
    setHTML($('iLine2'), 'Lie: <b>' + SURF[P.lie].name + '</b>' + (lm < 0.99 ? ' (−' + Math.round((1 - lm) * 100) + '% distance)' : ''));
  }
  const ws = H.wind.s * MPH;
  setText($('windTxt'), ws < 1 ? 'Calm' : Math.round(ws) + ' mph');
  const rel = Math.atan2(H.wind.x, -H.wind.z) - V.camYaw;
  $('windArrow').style.transform = 'rotate(' + rel.toFixed(3) + 'rad)'; $('windArrow').style.opacity = ws < 1 ? 0.3 : 1;
  // club
  const c = CLUBS[P.club], reach = clubReach(P.club), base = c.carry * lieMult(P.club, P.lie), m = powerMult(c.putt);
  setText($('clubName').firstChild, c.name);
  setHTML($('clubName').lastChild, (c.putt ? fmtDist(reach) + ' max' : yds(reach) + ' yds') + (m > 1.04 ? ' <b>🍺 +' + Math.round((m - 1) * 100) + '%</b>' : ''));
  // buzz
  setText($('buzzLvl'), buzzName(b)); setText($('buzzPow'), 'Power ×' + powerMult(false).toFixed(1));
  $('buzzFill').style.width = (b / BUZZ_MAX * 100).toFixed(1) + '%';
  // meter
  const aiming = V.mode === 'aim';
  $('swingBtn').disabled = !(aiming || V.mode === 'intro');
  setText($('swingBtn'), MT.st === 'up' ? 'POWER' : MT.st === 'down' ? 'HIT!' : 'SWING');
  $('clubPrev').disabled = $('clubNext').disabled = !(aiming && MT.st === 'idle');
  const disp = MT.st === 'up' || MT.st === 'down' ? MT.disp : MT.st === 'hit' ? MT.acc : 0;
  $('mNeedle').style.left = meterPct(disp) + '%';
  $('mFill').style.width = MT.st === 'up' ? (meterPct(disp) - meterPct(0)) + '%' : '0%';
  $('mFill').style.left = meterPct(0) + '%';
  const showPow = MT.st === 'down' || MT.st === 'hit'; $('mPow').hidden = !showPow; if (showPow) $('mPow').style.left = meterPct(MT.pow) + '%';
  setText($('mHint'), MT.st === 'up' ? 'Press to set power' : MT.st === 'down' ? 'Press on the white line!' : aiming ? 'Press SWING (Space) to start' : '');
  setText($('mMsg'), t - MT.msgT < 2200 ? MT.msg : '');
  $('meterWrap').style.opacity = aiming || V.mode === 'flight' ? 1 : 0.35;
  $('skipBtn').hidden = !(V.mode === 'flight' && t - V.t0 > 600);
  const spec = V.mode === 'spec' && V.spec; $('specBar').hidden = !(V.mode === 'spec' && specCandidates().length);
  if (spec) setText($('specName'), 'Watching ' + playerName(V.spec));
  else if (V.mode === 'spec') setText($('specName'), 'Waiting for the others');
  $('bZoom').classList.toggle('on', V.zoom); $('bCam').classList.toggle('on', !!SET.cam);
  const tr = travelling();
  $('bottom').hidden = tr; $('cartCtl').hidden = !tr; $('bCart').disabled = !canTravel() && !tr; $('bCart').classList.toggle('on', tr);
  setText($('bCart'), P.hasCart ? '🚗' : '🏃'); $('bCart').title = P.hasCart ? 'Drive your cart (F)' : 'Run (F)';
  if (tr) {
    setText($('cSpeed'), (CART.driving ? '' : '🏃 ') + Math.round(Math.abs(CART.driving ? CART.v : RUN.v) * MPH) + ' mph');
    setText($('cDist'), P.done ? 'Holed out' : nearBall() ? 'You made it!' : 'Your ball: ' + fmtDist(ballDist()));
    $('cExit').hidden = !(P.done || nearBall()); setText($('cExit'), P.done ? '👀 Watch' : '⛳ Play shot');
    $('cSkip').hidden = P.done || nearBall(); $('cHonk').hidden = !CART.driving;
    $('cOut').hidden = !CART.driving; $('cIn').hidden = !nearCart();
    if (RUN.on && P.hasCart && !nearCart()) setText($('cDist'), $('cDist').textContent + ' · cart ' + fmtDist(Math.hypot(cartSpot().x - RUN.p.x, cartSpot().z - RUN.p.z)));
  }
  // attack balls
  $('bAtk').hidden = !(S.phase === 'play' && (canAtk() || ATK.armed)); $('bAtk').classList.toggle('armed', ATK.armed);
  setHTML($('bAtk'), ATK.armed ? 'FIRE' : '🎯<small>' + P.atk + '</small>'); $('xhair').hidden = !ATK.armed;
  // tee-box funnel
  const fa = S.phase === 'play' && V.mode === 'aim' && !P.hasCart && P.strokes === 0 && P.lie === 'tee' && FUN.st !== 'done';
  $('funnel').hidden = !(fa && (FUN.st === 'offer' || FUN.st === 'hold')); $('fnChip').hidden = !(fa && FUN.st === 'declined');
  if (FUN.st === 'hold') { const ms = t - FUN.t0; setText($('fnTime'), (ms / 1000).toFixed(1) + ' s'); if (ms > 90000 || !fa) funnelRelease(); }
  else setText($('fnTime'), 'Ready?');
  $('fnHold').classList.toggle('holding', FUN.st === 'hold'); setText($('fnHold'), FUN.st === 'hold' ? 'Funneling… let go when it\'s empty' : 'Hold while you funnel');
}
function renderBoard() {
  if (!S) return;
  const rows = S.pl.map(p => ({ p, tp: rankKey(p) })).sort((a, b) => a.tp - b.tp);
  setHTML($('board'), rows.map(({ p, tp }) => {
    const cur = S.phase === 'play' ? (p.dn ? '✓' : !timeMode() && p.k ? '(' + p.k + ')' : '') : '';
    return '<div class="' + (p.dn ? 'dn' : '') + '"><span class="dot" style="background:' + PCOL[p.slot] + '"></span><span class="n">' + esc(p.n) + '</span><span class="v">' + (timeMode() ? '⏱' + fmtTime(tp) : fmtPar(tp)) + ' ' + cur + '</span></div>';
  }).join(''));
}
const toPar = p => { let t = 0; for (let i = 0; i < S.nh; i++) if (p.sc[i] != null) t += p.sc[i] - holePar(i, S.nh); return t; };
const strokesTotal = p => p.sc.reduce((a, v) => a + (v || 0), 0);
const fmtPar = v => v === 0 ? 'E' : v > 0 ? '+' + v : String(v);
const TIME_CAP = 300000, INTRO_MS = 4200;
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const timeMode = () => !!(S && S.mode === 'time');
const totalTime = p => (p.tm || []).reduce((a, v) => a + (v || 0), 0);
// what the leaderboard sorts by: strokes over par, or total time in time mode
const rankKey = p => timeMode() ? totalTime(p) : toPar(p);
let toastN = 0;
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; const f = $('feed'); f.appendChild(el);
  while (f.children.length > 4) f.removeChild(f.firstChild);
  setTimeout(() => el.remove(), 4200); toastN++;
}
let bannerTimer = 0;
function showBanner(a, b, ms) { $('bn1').textContent = a; $('bn2').textContent = b || ''; const el = $('banner'); el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); clearTimeout(bannerTimer); bannerTimer = setTimeout(hideBanner, ms || 2500); }
function hideBanner() { $('banner').hidden = true; }
function fade(on) { $('fade').style.opacity = on ? 1 : 0; }
// prompts
const PQ = []; let curPrompt = null, promptTimer = 0;
function queuePrompt(p) { PQ.push(p); if (!curPrompt) nextPrompt(); }
function nextPrompt() {
  clearTimeout(promptTimer); curPrompt = PQ.shift() || null; const el = $('prompt'); el.hidden = !curPrompt; if (!curPrompt) return;
  setText($('prE'), curPrompt.e); setText($('prT'), curPrompt.t); setText($('prS'), curPrompt.s); setText($('prC'), curPrompt.c ? '“' + curPrompt.c + '”' : ''); setText($('prYes'), curPrompt.k === 'shot' ? 'Done 🥃' : 'Done 🍺');
  el.classList.remove('pop'); void el.offsetWidth; promptTimer = setTimeout(nextPrompt, 25000);
}
// world-space labels
const markerEls = new Map();
function marker(key, cls, html, color) {
  let el = markerEls.get(key); if (!el) { el = document.createElement('div'); el.className = 'mk ' + cls; $('markers').appendChild(el); markerEls.set(key, el); }
  if (el._h !== html) { el.innerHTML = html; el._h = html; } el.style.color = color || '#fff'; el._used = true; return el;
}
function placeMarker(el, x, y, z) {
  _v.set(x, y, z).project(camera);
  const off = _v.z > 1 || _v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.2;
  el.style.display = off ? 'none' : ''; if (off) return;
  el.style.left = ((_v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; el.style.top = ((1 - _v.y) / 2 * innerHeight).toFixed(1) + 'px';
}
function updateMarkers() {
  for (const el of markerEls.values()) el._used = false;
  const live = HOLE && S && S.phase === 'play' && V.mode !== 'intro' && !$('hud').hidden;
  if (live) {
    const H = HOLE, cy = groundY(H, H.cup.x, H.cup.z);
    const ref = P.pos && !P.done ? P.pos : camera.position;
    const d = Math.hypot(H.cup.x - ref.x, H.cup.z - ref.z);
    if (d > 6) placeMarker(marker('pin', 'flag', '<span class="lab">⛳ ' + fmtDist(d) + '</span><span class="pin"></span>'), H.cup.x, cy + 2.4, H.cup.z);
    for (const B of BALLS.values()) {
      if (!B.ball.visible) continue;
      const p = B.ball.position, dc = p.distanceTo(camera.position), mine = B.id === ME.id;
      if (!mine && B.avatar && B.avatar.visible && !(B.anim && !B.anim.done)) placeMarker(marker('n' + B.id, 'name', '<span class="lab">' + esc(playerName(B.id)) + '</span>', B.color), B.avatar.position.x, B.avatar.position.y + 2.15, B.avatar.position.z);
      else if (dc > 14 && !(mine && travelling())) placeMarker(marker('b' + B.id, 'ball', '<span class="lab">' + (mine ? 'You' : esc(playerName(B.id))) + '</span><span class="ring"></span>', B.color), p.x, p.y, p.z);
    }
  }
  // pop-up over your own ball while you travel to it; pinned to the screen edge when it's out of view
  const pop = $('ballPop');
  if (live && P.pos && !P.done && travelling()) {
    _v.set(P.pos.x, groundY(HOLE, P.pos.x, P.pos.z) + 1.2, P.pos.z).project(camera);
    let x = _v.x, y = _v.y; const behind = _v.z > 1; if (behind) { x = -x; y = -y; if (Math.hypot(x, y) < 0.05) y = -1; }
    const edge = behind || Math.abs(x) > 0.9 || Math.abs(y) > 0.8;
    if (edge) { const k = 1 / Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.72, 1e-3); x *= k; y *= k; }
    pop.hidden = false; pop.classList.toggle('edge', edge); pop.style.left = ((x + 1) / 2 * innerWidth).toFixed(1) + 'px'; pop.style.top = ((1 - y) / 2 * innerHeight).toFixed(1) + 'px';
    $('bpArrow').style.transform = 'rotate(' + Math.atan2(-y, x).toFixed(3) + 'rad)';
    setText($('bpDist'), fmtDist(ballDist()));
  } else pop.hidden = true;
  const tg = $('target');
  if (live && targetInfo && !CLUBS[P.club].putt) { _v.set(targetInfo.x, targetInfo.y + 0.5, targetInfo.z).project(camera); tg.hidden = _v.z > 1; tg.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; tg.style.top = ((1 - _v.y) / 2 * innerHeight + 14) + 'px'; setText(tg, yds(targetInfo.d) + ' yds'); }
  else tg.hidden = true;
  for (const el of markerEls.values()) if (!el._used) el.style.display = 'none';
}
// minimap
let miniBg = null, miniT = null;
function miniXf(H, W, Hh) {
  const gx = H.green.x, gz = H.green.z, L = Math.hypot(gx, gz) || 1, a = Math.atan2(gz, gx), rho = -Math.PI / 2 - a;
  const s = Math.min(Hh * 0.8 / (L + 40), W * 0.9 / 120), cx = gx / 2, cz = gz / 2, c = Math.cos(rho), sn = Math.sin(rho);
  return { s, c, sn, cx, cz, W, Hh, rho, f: (x, z) => { const dx = x - cx, dz = z - cz; return [W / 2 + s * (dx * c - dz * sn), Hh / 2 + s * (dx * sn + dz * c)]; } };
}
function drawMini() {
  const cv = $('mini'); if (!HOLE || $('hud').hidden) return;
  const W = cv.width, Hh = cv.height, H = HOLE, g = cv.getContext('2d');
  if (!miniBg || miniBg.width !== W || miniBg.height !== Hh) {
    miniBg = document.createElement('canvas'); miniBg.width = W; miniBg.height = Hh; const m = miniBg.getContext('2d');
    miniT = miniXf(H, W, Hh); const X = miniT;
    m.fillStyle = '#2f5b26'; m.fillRect(0, 0, W, Hh);
    m.setTransform(X.s * X.c, X.s * X.sn, -X.s * X.sn, X.s * X.c, W / 2 - X.s * (X.cx * X.c - X.cz * X.sn), Hh / 2 - X.s * (X.cx * X.sn + X.cz * X.c));
    m.drawImage(H.canvas, H.m.x0, H.m.z0, H.m.x1 - H.m.x0, H.m.z1 - H.m.z0);
    m.fillStyle = 'rgba(20,60,20,.85)'; for (const t of H.trees) { if (!inBounds(H, t.x, t.z)) continue; m.beginPath(); m.arc(t.x, t.z, t.fr * 0.9, 0, 7); m.fill(); }
    m.setTransform(1, 0, 0, 1, 0, 0);
  }
  const X = miniT;
  g.drawImage(miniBg, 0, 0);
  const [px, pz] = X.f(H.cup.x, H.cup.z);
  g.fillStyle = '#fff'; g.fillRect(px - 1, pz - 9, 2, 9); g.fillStyle = '#e8232e'; g.fillRect(px + 1, pz - 9, 6, 4);
  if (V.mode === 'aim' && targetInfo && P.pos) {
    const [ax, az] = X.f(P.pos.x, P.pos.z), [tx, tz] = X.f(targetInfo.x, targetInfo.z);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(ax, az); g.lineTo(tx, tz); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(tx, tz, Math.max(3, CLUBS[P.club].putt ? 2 : targetInfo.d * 0.05 * X.s), 0, 7); g.stroke();
  }
  if (travelling()) {
    const q = travelPos(), yw = (CART.driving ? CART.yaw : RUN.yaw) + X.rho, [qx, qz] = X.f(q.x, q.z);
    g.save(); g.translate(qx, qz); g.rotate(yw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  for (const B of BALLS.values()) {
    if (!B.ball.visible) continue; const [bx, bz] = X.f(B.ball.position.x, B.ball.position.z);
    g.fillStyle = B.color; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(bx, bz, B.id === ME.id ? 5 : 4, 0, 7); g.fill(); g.stroke();
  }
}
// Past five drinks you get hiccups: they jolt your aim and the swing meter.
function hiccups(t) {
  const b = drunk();
  if (b <= 5 || !HOLE || !S || S.phase !== 'play') { V.hicAt = 0; return; }
  if (!V.hicAt) { V.hicAt = t + 4000 + Math.random() * 8000; return; }
  if (t < V.hicAt) return;
  V.hicAt = t + (7000 + Math.random() * 12000) * 8 / b;
  SFX.hic(); V.shakeT = t; V.shakeA = 0.25;
  if (V.mode === 'aim') { MT.msg = '*hic*'; MT.msgT = t; if (MT.st === 'idle') P.yaw += (Math.random() - 0.5) * 0.12 * b / 10; else MT.x += (Math.random() - 0.5) * 0.14; }
}
function drunkFx(t) {
  const b = drunk(), on = SET.fx && b > 2.5 && V.mode !== 'none';
  const blur = on ? Math.min(1.8, Math.max(0, (b - 3) * 0.1)) : 0;
  const f = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
  if (canvas._f !== f) { canvas.style.filter = f; canvas._f = f; }
  const dbl = $('dbl');
  if (on) {
    if (dbl.width !== Math.round(innerWidth / 2)) { dbl.width = Math.round(innerWidth / 2); dbl.height = Math.round(innerHeight / 2); }
    dbl.getContext('2d').drawImage(canvas, 0, 0, dbl.width, dbl.height);
    dbl.style.opacity = Math.min(0.6, (b - 2.5) * 0.045).toFixed(3);
    const k = Math.min(1.4, b / 10);
    dbl.style.transform = 'translate(' + (Math.sin(t * 0.0008) * 26 * k).toFixed(1) + 'px,' + (Math.cos(t * 0.00057) * 10 * k).toFixed(1) + 'px) rotate(' + (Math.sin(t * 0.0005) * 1.5 * k).toFixed(2) + 'deg)';
  } else if (dbl.style.opacity !== '0') dbl.style.opacity = '0';
  const fl = Math.max(0, 1 - (t - flashT) / 600);
  $('vig').style.opacity = (Math.min(0.7, b / 22) * (SET.fx ? 1 : 0.4) + fl * 0.5).toFixed(3);
}

// ============================ scorecard ============================
function showCard(kind) {
  if (!S) return;
  $('cardOv').hidden = false; $('cardOv').dataset.kind = kind; renderCard();
}
function renderCard() {
  if (!S || $('cardOv').hidden) return;
  const kind = $('cardOv').dataset.kind, nh = S.nh, cur = S.phase === 'play' ? S.hole : -1;
  setText($('cardTitle'), kind === 'final' ? '🏆 Final scores · ' + courseName(S.seed) : kind === 'hole' ? 'After hole ' + (S.hole + 1) + ' · ' + courseName(S.seed) : 'Scorecard · ' + courseName(S.seed));
  const tmode = timeMode();
  let h = '<tr><th class="nm">Hole</th>'; for (let i = 0; i < nh; i++) h += '<th class="' + (i === cur ? 'cur' : '') + '">' + (i + 1) + '</th>'; h += tmode ? '<th>Time</th><th>Strokes</th><th>🍺</th></tr>' : '<th>Tot</th><th>±</th><th>🍺</th></tr>';
  h += '<tr><th class="nm">Par</th>'; let tp = 0; for (let i = 0; i < nh; i++) { tp += holePar(i, nh); h += '<th class="' + (i === cur ? 'cur' : '') + '">' + holePar(i, nh) + '</th>'; } h += '<th>' + tp + '</th><th></th><th></th></tr>';
  const rows = S.pl.slice().sort((a, b) => rankKey(a) - rankKey(b));
  for (const p of rows) {
    h += '<tr><td class="nm"><span style="color:' + PCOL[p.slot] + '">●</span> ' + esc(p.n) + '</td>';
    if (tmode) {
      for (let i = 0; i < nh; i++) { const v = p.tm && p.tm[i]; h += '<td class="' + (i === cur ? 'cur' : '') + '">' + (v != null ? fmtTime(v) : '–') + '</td>'; }
      h += '<td><b>' + (totalTime(p) ? fmtTime(totalTime(p)) : '–') + '</b></td><td>' + (strokesTotal(p) || '–') + '</td><td>' + (p.si + p.sh + (p.fn || 0)) + '</td></tr>';
      continue;
    }
    for (let i = 0; i < nh; i++) {
      const v = p.sc[i], par = holePar(i, nh); let cls = '';
      if (v != null) { const d = v - par; cls = d <= -2 ? 'e' : d === -1 ? 'b' : d === 1 ? 'o' : d >= 2 ? 'oo' : ''; }
      const live = i === cur && v == null && p.k ? '<span class="muted">' + p.k + '</span>' : '';
      h += '<td class="' + (i === cur ? 'cur' : '') + '">' + (v != null ? '<span class="sc ' + cls + '">' + v + '</span>' : live || '–') + '</td>';
    }
    const t = toPar(p);
    h += '<td><b>' + (strokesTotal(p) || '–') + '</b></td><td class="tp ' + (t < 0 ? 'u' : t > 0 ? 'o' : '') + '">' + fmtPar(t) + '</td><td>' + (p.si + p.sh + (p.fn || 0)) + '</td></tr>';
  }
  setHTML($('cardTable'), h);
  const fin = kind === 'final';
  $('awards').hidden = !fin; $('finalBtns').hidden = !fin; $('cardClose').hidden = fin;
  $('againBtn').hidden = !(fin && NET.role === 'host');
  if (fin) setHTML($('awards'), awardsHtml());
}
function awardsHtml() {
  const pl = S.pl; if (!pl.length) return '';
  const A = [];
  const best = Math.min(...pl.map(rankKey)), champs = pl.filter(p => rankKey(p) === best);
  A.push(['🏆', 'Champion', champs.map(p => p.n).join(' & '), (timeMode() ? fmtTime(best) : fmtPar(best)) + ' · ' + strokesTotal(champs[0]) + ' strokes']);
  const drinks = p => p.si + p.sh + (p.fn || 0), mx = Math.max(...pl.map(drinks));
  if (mx > 0) { const w = pl.filter(p => drinks(p) === mx); A.push(['🍺', 'Thirstiest', w.map(p => p.n).join(' & '), [[w[0].si, 'sip'], [w[0].sh, 'shot'], [w[0].fn || 0, 'funnel']].filter(x => x[0]).map(x => x[0] + ' ' + x[1] + (x[0] === 1 ? '' : 's')).join(', ')]); }
  const fb = pl.filter(p => p.fb > 0).sort((a, b) => a.fb - b.fb)[0]; if (fb) A.push(['🍻', 'Fastest funnel', fb.n, (fb.fb / 1000).toFixed(1) + ' s']);
  const ld = Math.max(...pl.map(p => p.ld)); if (ld > 0) { const w = pl.find(p => p.ld === ld); A.push(['💥', 'Longest drive', w.n, yds(ld) + ' yds']); }
  const wt = Math.max(...pl.map(p => p.wt)); if (wt > 0) { const w = pl.filter(p => p.wt === wt); A.push(['🐟', 'Fish food', w.map(p => p.n).join(' & '), wt + ' water ball' + (wt > 1 ? 's' : '')]); }
  if (pl.length > 1) { const mn = Math.min(...pl.map(drinks)); if (mn < mx) { const w = pl.filter(p => drinks(p) === mn); A.push(['🚗', 'Designated driver', w.map(p => p.n).join(' & '), mn + ' drink' + (mn === 1 ? '' : 's')]); } }
  return A.map(([e, t, w, d]) => '<div class="award"><div class="em">' + e + '</div><div class="t">' + t + '</div><div class="w">' + esc(w) + '</div><div class="d">' + esc(d) + '</div></div>').join('');
}

// ============================ house rules ============================
// The host's rules: when something happens to a player, who drinks and how much.
const TRIG = {
  water: ['💦', 'Splash!', 'Ball in the water', 'found the water'],
  oob: ['🚫', 'Out of bounds!', 'Out of bounds', 'went out of bounds'],
  bunker: ['🏖️', 'Beach day', 'Lands in a bunker', 'landed in a bunker'],
  tree: ['🌳', 'Timber!', 'Hits a tree', 'hit a tree'],
  shank: ['🙈', 'SHANK!', 'Shanks it', 'shanked it'],
  threeputt: ['😵', 'Three-putt', 'Three-putts', 'three-putted'],
  blowup: ['💀', 'Blow-up hole', 'Double bogey or worse', 'made double bogey or worse'],
  birdie: ['🐦', 'Birdie!', 'Birdie or better', 'made birdie or better'],
  ace: ['🎯', 'HOLE IN ONE!', 'Hole in one', 'made a hole in one'],
  worst: ['🥴', 'Worst on the hole', 'Worst score on a hole', 'had the worst score on the hole'],
  best: ['👑', 'Won the hole', 'Best score on a hole', 'won the hole outright'],
  longdrive: ['💥', 'Longest drive', 'Longest drive on a hole', 'hit the longest drive'],
  runover: ['🚗', 'Roadkill!', 'Gets run over', 'got run over'],
  runner: ['🏎️', 'Hit and run', 'Runs someone over', 'ran someone over'],
  cartwater: ['🌊', 'Cart overboard', 'Drives a cart into water', 'drove a cart into the water'],
  swim: ['🏊', 'Swim time', 'Runs into water', 'ran into the water'],
  trip: ['🤕', 'Faceplant', 'Trips while running', 'tripped and ate grass'],
  funnel: ['🍺', 'Funnel!', 'Funnels a beer', 'funneled a beer'],
  bonked: ['🎯', 'Bonk!', 'Gets hit by an attack ball', 'got beaned by an attack ball'],
  bonker: ['💥', 'Sniper', 'Hits someone with an attack ball', 'beaned someone with an attack ball'],
  hole: ['⛳', 'New hole', 'Start of every hole', ''],
};
const WHO = [['me', 'That player'], ['others', 'Everyone else'], ['all', 'Everyone']];
const AMT = [['sip', 'Sip 🍺'], ['shot', 'Shot 🥃']];
const defaultRules = () => [
  { w: 'water', who: 'me', k: 'sip', txt: '' }, { w: 'oob', who: 'me', k: 'sip', txt: '' }, { w: 'threeputt', who: 'me', k: 'sip', txt: '' },
  { w: 'blowup', who: 'me', k: 'sip', txt: '' }, { w: 'worst', who: 'me', k: 'sip', txt: '' }, { w: 'birdie', who: 'others', k: 'sip', txt: '' },
  { w: 'ace', who: 'others', k: 'shot', txt: '' }, { w: 'runover', who: 'me', k: 'shot', txt: '' }, { w: 'cartwater', who: 'me', k: 'shot', txt: '' }, { w: 'swim', who: 'me', k: 'sip', txt: '' },
];
function cleanRules(a) {
  if (!Array.isArray(a)) return [];
  return a.slice(0, 12).filter(r => r && TRIG[r.w]).map(r => ({ w: r.w, who: WHO.some(x => x[0] === r.who) ? r.who : 'me', k: r.k === 'shot' ? 'shot' : 'sip', txt: String(r.txt || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 80) }));
}
function ruleSentence(r) {
  const w = TRIG[r.w][2], who = r.w === 'hole' ? 'everyone' : WHO.find(x => x[0] === r.who)[1].toLowerCase();
  return w + ' → ' + who + ' takes a ' + r.k + (r.txt ? ' · “' + r.txt + '”' : '');
}
// Host: something happened to player `sid` (0 for everyone); prompt whoever the matching rules name.
function hostRule(e, sid) {
  const T = TRIG[e], subj = HS.players.get(sid), name = subj ? subj.n : '';
  for (const r of HS.rules) {
    if (r.w !== e) continue;
    const who = e === 'hole' ? 'all' : r.who;
    for (const q of HS.players.values()) {
      if (!(who === 'all' || (who === 'me' ? q.id === sid : q.id !== sid))) continue;
      const what = e === 'hole' ? 'Hole ' + (HS.hole + 1) + '. Everyone drinks.' : (q.id === sid ? 'You ' : name + ' ') + T[3] + '.';
      const order = e === 'hole' ? '' : who === 'me' ? 'Take a ' + r.k + '.' : who === 'others' ? (q.id === sid ? '' : 'Everyone else takes a ' + r.k + '.') : 'Everyone takes a ' + r.k + '.';
      sendTo(q.id, { t: 'prompt', p: { e: T[0], t: T[1], s: (what + ' ' + order).trim(), c: r.txt, k: r.k } });
    }
  }
}
const ruleOpts = (list, v) => list.map(([k, l]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
function renderRules() {
  if (!S) return;
  const R = S.rules || [], sig = JSON.stringify(R), host = NET.role === 'host';
  const list = R.length ? '<ul class="rlist">' + R.map(r => '<li>' + esc(ruleSentence(r)) + '</li>').join('') + '</ul>' : '<p class="muted">No house rules: drink whenever you like.</p>';
  setHTML($('rulesList'), list);
  for (const el of [$('rulesEd'), $('rulesEd2')]) {
    if (!host) { setHTML(el, list); continue; }
    if (el._sig === sig) continue; el._sig = sig; txtCache.delete(el);
    el.innerHTML = R.map((r, i) => '<div class="rule" data-i="' + i + '"><select data-f="w" aria-label="When">' + ruleOpts(Object.keys(TRIG).map(k => [k, TRIG[k][2]]), r.w) + '</select>'
      + '<select data-f="who" aria-label="Who drinks"' + (r.w === 'hole' ? ' disabled' : '') + '>' + ruleOpts(WHO, r.who) + '</select>'
      + '<select data-f="k" aria-label="How much">' + ruleOpts(AMT, r.k) + '</select>'
      + '<input data-f="txt" maxlength="80" placeholder="Custom words (optional)" value="' + esc(r.txt) + '"><button class="ib" data-x="' + i + '" title="Remove rule">✕</button></div>').join('')
      + (R.length ? '' : '<p class="muted">No house rules yet.</p>')
      + '<div class="row"><button class="btn small" data-add="1">+ Add rule</button><button class="btn small" data-reset="1">Defaults</button><button class="btn small" data-clear="1">Clear all</button></div>';
  }
}
function rulesFromEditor(el) {
  return [...el.querySelectorAll('.rule')].map(row => ({ w: row.querySelector('[data-f=w]').value, who: row.querySelector('[data-f=who]').value, k: row.querySelector('[data-f=k]').value, txt: row.querySelector('[data-f=txt]').value }));
}
function wireRules(el) {
  const send = rules => { rules = cleanRules(rules); el._sig = null; toHost({ t: 'cfg', rules }); };
  el.addEventListener('change', e => { if (NET.role === 'host' && e.target.dataset.f) send(rulesFromEditor(el)); });
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || NET.role !== 'host') return;
    const cur = rulesFromEditor(el);
    if (b.dataset.x != null) { cur.splice(+b.dataset.x, 1); send(cur); }
    else if (b.dataset.add) { cur.push({ w: 'hole', who: 'all', k: 'sip', txt: '' }); send(cur); }
    else if (b.dataset.reset) send(defaultRules());
    else if (b.dataset.clear) send([]);
  });
}

// ============================ networking ============================
const NET = { role: null, code: '', peer: null, bc: null, links: new Map(), bcLinks: new Map(), link: null, tok: '', lastHostMsg: 0, lastPing: 0, online: '', solo: false, retry: 0 };
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randCode(n = 6) { let s = ''; const r = new Uint32Array(n); crypto.getRandomValues(r); for (const v of r) s += CODE_ALPHA[v % CODE_ALPHA.length]; return s; }
function peerCfg() {
  return Object.assign({ debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }] } }, window.__PEER_CFG || {});
}
function peerErr(e) {
  const t = e && e.type;
  return t === 'peer-unavailable' ? 'No game is open on that code. Check it with the host.'
    : t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' ? 'Could not reach the matchmaking server. Check your internet connection.'
    : t === 'browser-incompatible' ? 'This browser cannot make peer-to-peer connections. Try Chrome, Safari, Edge or Firefox.'
    : 'Connection failed' + (t ? ' (' + t + ')' : '') + '.';
}
const inviteLink = () => location.href.split(/[?#]/)[0] + '?join=' + NET.code;
// ----- host -----
const HS = { seed: 0, nh: 9, hole: 0, phase: 'lobby', mode: 'stroke', holeStart: 0, rules: [], until: 0, game: 0, nextId: 1, players: new Map(), lastState: 0 };
const cleanName = n => (String(n || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 14)) || 'Golfer';
function newRec(id, n, slot) { return { id, n, slot, sc: Array(18).fill(null), tm: Array(18).fill(null), k: 0, dn: false, p: null, y: 0, lie: 'tee', si: 0, sh: 0, bz: 0, ld: 0, wt: 0, ob: 0, fn: 0, fb: 0, hc: false, cp: null }; }
function freeSlot() { const used = new Set([...HS.players.values()].map(p => p.slot)); for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i; return 0; }
function stateObj() {
  return { seed: HS.seed, nh: HS.nh, hole: HS.hole, phase: HS.phase, mode: HS.mode, hel: HS.phase === 'play' ? now() - HS.holeStart : 0, rules: HS.rules, game: HS.game, left: Math.max(0, HS.until - now()), code: NET.code, solo: NET.solo,
    pl: [...HS.players.values()].map(r => ({ id: r.id, n: r.n, slot: r.slot, sc: r.sc.slice(0, HS.nh), tm: r.tm.slice(0, HS.nh), k: r.k, dn: r.dn, p: r.p, y: r.y, lie: r.lie, si: r.si, sh: r.sh, bz: r.bz, ld: r.ld, wt: r.wt, fn: r.fn || 0, fb: r.fb || 0, hc: !!r.hc, cp: r.cp || null })) };
}
function hostGame(solo) {
  leaveNet(); NET.role = 'host'; NET.solo = solo;
  HS.seed = (Math.random() * 2147483647) | 0; HS.nh = 9; HS.hole = 0; HS.phase = 'lobby'; HS.rules = cleanRules(SET.houseRules || defaultRules()); HS.game = 0; HS.nextId = 1; HS.players.clear();
  ME.id = 1; HS.players.set(1, newRec(1, ME.name, 0));
  if (!solo) hostOpen(randCode()); else NET.code = '';
  clientRecv({ t: 'welcome', id: 1, s: stateObj() });
}
function hostOpen(code) {
  NET.code = code; NET.online = 'Opening code…';
  try { NET.bc && NET.bc.close(); } catch (e) {}
  try { NET.bc = new BroadcastChannel(PEER_PREFIX + code); NET.bc.onmessage = e => bcHostRx(e.data); } catch (e) { NET.bc = null; }
  try { NET.peer && NET.peer.destroy(); } catch (e) {}
  if (typeof window.Peer !== 'function' || !window.RTCPeerConnection) { NET.online = 'Internet play is unavailable in this browser.'; renderNet(); return; }
  const peer = new window.Peer(PEER_PREFIX + code.toLowerCase(), peerCfg()); NET.peer = peer;
  peer.on('open', () => { if (NET.peer !== peer) return; NET.online = 'online'; NET.retry = 0; renderNet(); });
  peer.on('connection', c => hostAccept(c));
  peer.on('error', e => {
    if (NET.peer !== peer) return;
    if (e.type === 'unavailable-id') { hostOpen(randCode()); bcastState(); return; }
    if (e.type === 'peer-unavailable') return;
    NET.online = peerErr(e); renderNet();
  });
  peer.on('disconnected', () => {
    if (NET.peer !== peer || NET.role !== 'host') return; NET.retry++;
    setTimeout(() => { if (NET.peer === peer && !peer.destroyed) try { peer.reconnect(); } catch (e) {} }, Math.min(30000, 1000 * Math.pow(2, NET.retry)));
  });
  renderNet();
}
function hostAccept(c) {
  const L = { kind: 'peer', c, pid: 0, last: now() };
  c.on('data', m => hostLinkRx(L, m));
  c.on('close', () => dropLink(L));
  c.on('error', () => {});
}
function bcHostRx(d) {
  if (!d || !d.from || d.to) return;
  if (d.ping) { NET.bc.postMessage({ to: d.from, m: { t: 'bcpong' } }); return; }
  let L = NET.bcLinks.get(d.from); if (!L) { L = { kind: 'bc', tok: d.from, pid: 0, last: now() }; NET.bcLinks.set(d.from, L); }
  if (d.m && d.m.t === 'leave') { dropLink(L); return; }
  hostLinkRx(L, d.m);
}
function linkSend(L, m) { try { if (L.kind === 'bc') { if (NET.bc) NET.bc.postMessage({ to: L.tok, m }); } else if (L.c && L.c.open) L.c.send(m); } catch (e) {} }
function hostLinkRx(L, m) {
  if (!m || typeof m !== 'object') return; L.last = now();
  if (!L.pid) { if (m.t === 'hello') hostHello(L, m); return; }
  hostRecv(L.pid, m);
}
function hostHello(L, m) {
  if (m.v !== VERSION) { linkSend(L, { t: 'bye', why: 'The host is on a different version. Both of you, reload the page.' }); return; }
  if (HS.players.size >= MAX_PLAYERS) { linkSend(L, { t: 'bye', why: 'That game is full (four players max).' }); return; }
  const id = ++HS.nextId, rec = newRec(id, cleanName(m.n), freeSlot());
  HS.players.set(id, rec); L.pid = id; NET.links.set(id, L);
  linkSend(L, { t: 'welcome', id, s: stateObj() });
  bcastState(); bcast({ t: 'feed', m: '👋 ' + rec.n + ' joined' });
}
function dropLink(L) {
  if (L.kind === 'bc') NET.bcLinks.delete(L.tok);
  if (!L.pid || NET.links.get(L.pid) !== L) return;
  NET.links.delete(L.pid); const r = HS.players.get(L.pid); HS.players.delete(L.pid);
  try { L.c && L.c.close(); } catch (e) {}
  if (r) { bcast({ t: 'feed', m: r.n + ' left' }); bcastState(); hostCheck(); }
}
function bcast(m) { for (const L of NET.links.values()) linkSend(L, m); clientRecv(m); }
function bcastExcept(id, m) { for (const [pid, L] of NET.links) if (pid !== id) linkSend(L, m); if (id !== ME.id) clientRecv(m); }
function sendTo(id, m) { if (id === ME.id) clientRecv(m); else { const L = NET.links.get(id); if (L) linkSend(L, m); } }
function bcastState() { HS.lastState = now(); bcast({ t: 'st', s: stateObj() }); }
function hostRecv(id, m) {
  const r = HS.players.get(id); if (!r) return;
  switch (m.t) {
    case 'ball': {
      if (HS.phase !== 'play') return;
      r.k = m.k | 0; r.p = Array.isArray(m.p) ? m.p.slice(0, 3).map(Number) : r.p; r.lie = String(m.lie || ''); r.dn = !!m.dn;
      if (r.dn) { r.sc[HS.hole] = r.k; r.tm[HS.hole] = m.pu ? TIME_CAP : clamp(now() - HS.holeStart, 0, TIME_CAP); }
      if (m.drive > 0) r.hd = Math.max(r.hd || 0, +m.drive);
      if (m.drive > r.ld) { r.ld = +m.drive; if (m.drive > 0 && yds(m.drive) >= 250) bcast({ t: 'feed', m: '💥 ' + r.n + ' crushed it ' + yds(m.drive) + ' yds' }); }
      if (m.water) r.wt++;
      if (r.dn) { const d = r.k - holePar(HS.hole, HS.nh); bcastExcept(id, { t: 'feed', m: r.n + ': ' + scoreName(r.k, holePar(HS.hole, HS.nh)) + (d === 0 || r.k === 1 ? '' : ' (' + r.k + ')') }); }
      else if (m.water) bcastExcept(id, { t: 'feed', m: '💦 ' + r.n + ' found the water' });
      else if (m.ob) bcastExcept(id, { t: 'feed', m: '🚫 ' + r.n + ' went out of bounds' });
      bcastState(); break;
    }
    case 'shot': bcastExcept(id, { t: 'shot', id, pts: Array.isArray(m.pts) ? m.pts : [], dt: +m.dt || 1 / 15, y: +m.y || 0, ev: Array.isArray(m.ev) ? m.ev : [] }); r.y = +m.y || 0; break;
    case 'aim': r.y = +m.y || 0; bcastExcept(id, { t: 'aim', id, y: r.y }); break;
    case 'drink': {
      if (m.k === 'shot') r.sh++; else r.si++; r.bz = +m.bz || 0;
      bcast({ t: 'feed', m: m.k === 'shot' ? '🥃 ' + r.n + ' took a shot!' : m.skip ? '⏭ ' + r.n + ' took a sip to skip to their ball' : '🍺 ' + r.n + ' took a sip' }); bcastState(); break;
    }
    case 'bz': r.bz = +m.bz || 0; break;
    case 'ev': {
      if (HS.phase !== 'play' || !TRIG[m.e] || ['worst', 'best', 'longdrive', 'hole', 'runover', 'runner', 'funnel', 'bonked', 'bonker'].includes(m.e)) break;
      if (m.e === 'cartwater') bcast({ t: 'feed', m: '🌊 ' + r.n + ' drove a cart into the water' });
      hostRule(m.e, id); break;
    }
    case 'cart': {
      const p = Array.isArray(m.p) ? [+m.p[0] || 0, +m.p[1] || 0] : null, mo = m.mo === 'run' ? 'run' : 'cart';
      if (!m.d && p && mo === 'cart') r.cp = [p[0], p[1], +m.y || 0];
      bcastExcept(id, { t: 'cart', id, p, y: +m.y || 0, v: +m.v || 0, d: m.d ? 1 : 0, mo }); break;
    }
    case 'funnel': {
      if (HS.phase !== 'play' || r.hc) break;
      const ms = clamp(+m.ms || 0, 2000, 90000); r.hc = true; r.fn = (r.fn || 0) + 1; r.fb = r.fb ? Math.min(r.fb, ms) : ms;
      bcast({ t: 'feed', m: '🍺 ' + r.n + ' funneled a beer in ' + (ms / 1000).toFixed(1) + ' s and grabbed a cart!' });
      hostRule('funnel', id); bcastState(); break;
    }
    case 'nocart': r.hc = false; r.cp = null; bcastState(); break;
    case 'atk': {
      if (HS.phase !== 'play' || !Array.isArray(m.p) || !Array.isArray(m.v)) break;
      bcastExcept(id, { t: 'atk', id, a: String(m.a || '').slice(0, 8), p: m.p.slice(0, 3).map(Number), v: m.v.slice(0, 3).map(Number) }); break;
    }
    case 'bonk': {
      if (HS.phase !== 'play') break;
      const v = HS.players.get(m.id); if (!v || v.id === id || now() - (v.bonkAt || 0) < 1500) break;
      v.bonkAt = now();
      bcast({ t: 'bonk', id: v.id, by: id, a: String(m.a || '').slice(0, 8), dx: +m.dx || 0, dz: +m.dz || 0 });
      bcast({ t: 'feed', m: '🎯 ' + r.n + ' beaned ' + v.n + '!' });
      hostRule('bonked', v.id); hostRule('bonker', id); break;
    }
    case 'honk': if (now() - (r.honkAt || 0) > 600) { r.honkAt = now(); bcastExcept(id, { t: 'honk', id }); } break;
    case 'runover': {
      if (HS.phase !== 'play') break;
      const v = HS.players.get(m.id); if (!v || v.id === id || now() - (v.flatAt || 0) < 4000) break;
      v.flatAt = now();
      bcast({ t: 'flat', id: v.id, by: id, dx: +m.dx || 0, dz: +m.dz || 0 });
      bcast({ t: 'feed', m: '🚗💥 ' + r.n + ' ran over ' + v.n + '!' });
      hostRule('runover', v.id); hostRule('runner', id); break;
    }
    case 'cheers': if (now() - (r.cheersAt || 0) > 2500) { r.cheersAt = now(); bcast({ t: 'cheers', id, n: r.n }); } break;
    case 'ping': break;
    // host-only controls
    case 'cfg':
      if (id !== ME.id) break;
      if (m.rules) { HS.rules = cleanRules(m.rules); SET.houseRules = HS.rules; saveSet(); }
      if (m.mode && HS.phase === 'lobby') HS.mode = m.mode === 'time' ? 'time' : 'stroke';
      if (HS.phase === 'lobby') { if (m.nh) HS.nh = [3, 9, 18].includes(m.nh) ? m.nh : 9; if (m.reseed) HS.seed = (Math.random() * 2147483647) | 0; }
      bcastState(); break;
    case 'start': if (id !== ME.id || HS.phase !== 'lobby') break; hostStart(); break;
    case 'skip': if (id !== ME.id || HS.phase !== 'play') break; for (const q of HS.players.values()) if (!q.dn) { q.dn = true; if (HS.mode !== 'time') q.k = holePar(HS.hole, HS.nh) + 4; q.sc[HS.hole] = q.k; q.tm[HS.hole] = TIME_CAP; } bcast({ t: 'feed', m: 'The host ended the hole' }); hostCheck(); bcastState(); break;
    case 'again': if (id !== ME.id || HS.phase !== 'final') break; HS.seed = (Math.random() * 2147483647) | 0; HS.phase = 'lobby'; bcastState(); break;
  }
  hostCheck();
}
function hostStart() {
  HS.game++; HS.hole = 0; HS.phase = 'play'; HS.holeStart = now() + INTRO_MS;
  for (const r of HS.players.values()) { r.sc = Array(18).fill(null); r.k = 0; r.dn = false; r.p = null; r.tm = Array(18).fill(null); r.si = 0; r.sh = 0; r.ld = 0; r.wt = 0; r.hd = 0; r.fn = 0; r.fb = 0; r.hc = false; r.cp = null; }
  bcastState(); hostRule('hole', 0);
}
function hostCheck() {
  if (HS.phase === 'play' && HS.players.size && [...HS.players.values()].every(r => r.dn)) {
    HS.phase = 'card'; HS.until = now() + (HS.players.size > 1 ? 11000 : 7000);
    // hole-wide house rules: worst score, outright winner, longest drive
    if (HS.players.size > 1) {
      const hv = r => HS.mode === 'time' ? r.tm[HS.hole] : r.sc[HS.hole];
      const pl = [...HS.players.values()], sc = pl.map(hv), worst = Math.max(...sc), best = Math.min(...sc);
      if (worst !== best) { for (const r of pl) if (hv(r) === worst) hostRule('worst', r.id); const b = pl.filter(r => hv(r) === best); if (b.length === 1) hostRule('best', b[0].id); }
      const ld = Math.max(...pl.map(r => r.hd || 0)), lw = pl.filter(r => (r.hd || 0) === ld);
      if (ld > 0 && lw.length === 1) hostRule('longdrive', lw[0].id);
    }
    bcastState();
  }
}
function hostTick(t) {
  // time mode: anyone still out there after five minutes is timed out
  if (HS.phase === 'play' && HS.mode === 'time' && t - HS.holeStart > TIME_CAP) {
    let changed = false;
    for (const r of HS.players.values()) if (!r.dn) { r.dn = true; r.sc[HS.hole] = r.k; r.tm[HS.hole] = TIME_CAP; changed = true; sendTo(r.id, { t: 'timeout' }); bcast({ t: 'feed', m: '⏱ ' + r.n + ' ran out of time' }); }
    if (changed) { bcastState(); hostCheck(); }
  }
  if (HS.phase === 'card' && t >= HS.until) {
    if (HS.hole + 1 < HS.nh) { HS.hole++; HS.phase = 'play'; HS.holeStart = now() + INTRO_MS; for (const r of HS.players.values()) { r.k = 0; r.dn = false; r.p = null; r.lie = 'tee'; r.hd = 0; r.hc = false; r.cp = null; } }
    else HS.phase = 'final';
    bcastState();
    if (HS.phase === 'play') hostRule('hole', 0);
  }
  for (const [id, L] of NET.links) if (t - L.last > 20000) dropLink(L);
  if (t - HS.lastState > 4000) bcastState();
}
// ----- guest -----
function joinGame(code) {
  leaveNet(); NET.role = 'guest'; NET.code = code; NET.tok = randCode(10);
  setMenuStatus('Looking for game ' + code + '…');
  let settled = false, fail = 0;
  const giveUp = msg => { if (settled || NET.role !== 'guest') return; settled = true; clearTimeout(fail); setMenuStatus(msg); leaveNet(); };
  const connected = link => { if (settled) return false; settled = true; clearTimeout(fail); NET.link = link; guestHello(); return true; };
  try {
    const bc = new BroadcastChannel(PEER_PREFIX + code); NET.bc = bc;
    bc.onmessage = e => {
      const d = e.data; if (!d || d.to !== NET.tok) return;
      if (d.m && d.m.t === 'bcpong') { if (connected({ kind: 'bc' })) { try { NET.peer && NET.peer.destroy(); } catch (x) {} NET.peer = null; } return; }
      if (NET.link && NET.link.kind === 'bc') guestRx(d.m);
    };
    bc.postMessage({ from: NET.tok, ping: 1 });
  } catch (e) {}
  setTimeout(() => {
    if (settled || NET.role !== 'guest') return;
    if (typeof window.Peer !== 'function' || !window.RTCPeerConnection) { giveUp('This browser cannot make peer-to-peer connections.'); return; }
    const peer = new window.Peer(peerCfg()); NET.peer = peer;
    fail = setTimeout(() => giveUp('Found no game on ' + code + ', or this network blocks peer-to-peer play. Check the code, or try another network (mobile data usually works).'), 16000);
    peer.on('open', () => {
      if (settled) return;
      const c = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
      c.on('open', () => { if (!connected({ kind: 'peer', c })) c.close(); });
      c.on('data', guestRx);
      c.on('close', () => { if (NET.role === 'guest' && NET.link && NET.link.c === c) hostLost('The host left the game.'); });
      c.on('error', () => {});
    });
    peer.on('error', e => { if (NET.role !== 'guest' || NET.link) return; giveUp(peerErr(e)); });
  }, 350);
}
function guestHello() { setMenuStatus('Connected. Joining…'); NET.lastHostMsg = now(); guestSend({ t: 'hello', v: VERSION, n: ME.name }); }
function guestSend(m) {
  const L = NET.link; if (!L) return;
  try { if (L.kind === 'bc') NET.bc.postMessage({ from: NET.tok, m }); else if (L.c && L.c.open) L.c.send(m); } catch (e) {}
}
function guestRx(m) { if (!m || typeof m !== 'object') return; NET.lastHostMsg = now(); clientRecv(m); }
function hostLost(msg) { if (NET.role !== 'guest') return; leaveGame(); setMenuStatus(msg); }
function toHost(m) { if (NET.role === 'host') hostRecv(ME.id, m); else if (NET.role === 'guest') guestSend(m); }
function netTick(t) {
  if (NET.role === 'guest' && NET.link) {
    if (t - NET.lastPing > 3000) { NET.lastPing = t; guestSend({ t: 'ping' }); toHost({ t: 'bz', bz: Math.round(drunk() * 10) / 10 }); }
    if (t - NET.lastHostMsg > 25000) hostLost('Lost the connection to the host.');
  }
  if (NET.role === 'host' && t - NET.lastPing > 3000) { NET.lastPing = t; const r = HS.players.get(ME.id); if (r) r.bz = Math.round(drunk() * 10) / 10; }
}
function leaveNet() {
  if (NET.role === 'guest' && NET.link && NET.link.kind === 'bc') try { NET.bc.postMessage({ from: NET.tok, m: { t: 'leave' } }); } catch (e) {}
  if (NET.role === 'host') for (const L of NET.links.values()) linkSend(L, { t: 'bye', why: 'The host ended the game.' });
  try { NET.link && NET.link.c && NET.link.c.close(); } catch (e) {}
  try { NET.peer && NET.peer.destroy(); } catch (e) {}
  try { NET.bc && NET.bc.close(); } catch (e) {}
  NET.peer = null; NET.bc = null; NET.link = null; NET.links.clear(); NET.bcLinks.clear(); NET.role = null; NET.online = ''; NET.solo = false;
}
// ----- everyone -----
function clientRecv(m) {
  switch (m.t) {
    case 'welcome': ME.id = m.id; S = null; for (const id of [...BALLS.keys()]) dropBall(id); applyState(m.s); setMenuStatus(''); break;
    case 'st': applyState(m.s); break;
    case 'bye': leaveGame(); setMenuStatus(m.why || 'Disconnected.'); break;
    case 'feed': toast(m.m); break;
    case 'shot': {
      if (m.id === ME.id || !HOLE || !S || S.phase !== 'play') break;
      const B = getBall(m.id), o = B.rest || { x: m.pts[0], y: m.pts[1], z: m.pts[2] };
      B.yaw = m.y; playShot(B, m.pts, m.dt, m.ev, { x: m.pts[0], y: m.pts[1], z: m.pts[2], yaw: m.y });
      if (V.spec === m.id || camera.position.distanceTo(B.ball.position) < 40) SFX.hit();
      void o; break;
    }
    case 'aim': { const B = BALLS.get(m.id); if (B) B.yaw = m.y; break; }
    case 'prompt': queuePrompt(m.p); break;
    case 'cheers': toast('🍻 ' + m.n + ' says cheers!'); SFX.clink(); break;
    case 'timeout':
      if (P.done || !S || S.phase !== 'play') break;
      if (CART.driving || RUN.on) endTravel(true);
      P.done = true; MT.st = 'idle'; ATK.armed = false; showBanner("⏱ Time's up!", fmtTime(TIME_CAP) + ' for this hole', 3000); SFX.aww(); V.mode = 'done'; V.t0 = now(); break;
    case 'atk': if (HOLE && S && S.phase === 'play' && m.id !== ME.id) spawnAtk(m.a, m.p, m.v, false, m.id); break;
    case 'bonk': {
      const A = ATKS.find(a => a.id === m.a); if (A) A.dead = true;
      const B = BALLS.get(m.id); if (B) { B.flatT = now(); B.flatKind = 'bonk'; B.flatDir = [m.dx, m.dz]; }
      if (m.id === ME.id) {
        showBanner('BONK! 🎯', 'by ' + playerName(m.by), 1800); V.shakeT = now(); V.shakeA = 0.7; SFX.thud();
        if (V.mode === 'aim' && (MT.st === 'up' || MT.st === 'down')) { MT.st = 'idle'; MT.msg = 'Interrupted!'; MT.msgT = now(); }
        if (V.mode === 'run') { RUN.stunUntil = now() + 1200; RUN.tripAt = now(); RUN.v = 0; }
        if (V.mode === 'cart') { CART.v *= 0.2; CART.yaw += (Math.random() - 0.5) * 0.9; }
      } else if (B && B.avatar && B.avatar.position.distanceTo(camera.position) < 60) SFX.thud();
      break;
    }
    case 'cart': {
      if (!HOLE || !S || S.phase !== 'play' || m.id === ME.id) break;
      const B = getBall(m.id), on = !!m.d && Array.isArray(m.p);
      B.driving = on && m.mo !== 'run'; B.running = on && m.mo === 'run';
      B.ct = on ? { x: m.p[0], z: m.p[1], yaw: m.y, v: m.v, at: now() } : null;
      if (!m.d && m.mo === 'cart' && Array.isArray(m.p)) B.park = { x: m.p[0], z: m.p[1], yaw: m.y };
      break;
    }
    case 'honk': { const B = BALLS.get(m.id); if (B && B.cart && B.cart.visible && B.cart.position.distanceTo(camera.position) < 80) SFX.horn(); break; }
    case 'flat': {
      const B = BALLS.get(m.id); if (B) { B.flatT = now(); B.flatKind = 'flat'; B.flatDir = [m.dx, m.dz]; }
      if (m.id === ME.id) {
        showBanner('RUN OVER! 🚗💥', 'by ' + playerName(m.by), 2400); V.shakeT = now(); V.shakeA = 1; SFX.thud(); SFX.aww();
        if (V.mode === 'aim') { MT.st = 'idle'; P.yaw += (Math.random() - 0.5) * 1.4; MT.msg = 'Knocked silly!'; MT.msgT = now(); }
        if (V.mode === 'run') { RUN.stunUntil = now() + 1600; RUN.tripAt = now(); RUN.v = 0; RUN.p.x += (m.dx || 0) * 3; RUN.p.z += (m.dz || 0) * 3; }
      } else if (B && B.avatar && B.avatar.position.distanceTo(camera.position) < 60) SFX.thud();
      break;
    }
  }
}
function applyState(s) {
  const prev = S; S = s; S.until = now() + (s.left || 0); S.holeStart = now() - (s.hel || 0);
  const me = s.pl.find(p => p.id === ME.id); if (me) { ME.slot = me.slot; sleeveMat.color.set(PCOL[me.slot]); }
  // balls for everyone in the game
  const ids = new Set(s.pl.map(p => p.id));
  for (const id of [...BALLS.keys()]) if (!ids.has(id)) dropBall(id);
  if (s.phase === 'lobby') {
    if (!HOLE || HOLE.seed !== s.seed || HOLE.idx !== 0) buildHole(s.seed, 0, s.nh);
    V.mode = 'none'; $('hud').hidden = true; closeOverlays(); $('menu').hidden = true; $('lobby').hidden = false; renderLobby();
  } else {
    $('menu').hidden = true; $('lobby').hidden = true; $('hud').hidden = false;
    if (s.phase === 'play') {
      if (P.key !== s.seed + ':' + s.game + ':' + s.hole) startHole(s);
      if (prev && prev.phase !== 'play') closeOverlays();
    } else if (s.phase === 'card' && (!prev || prev.phase !== 'card')) { V.mode = 'none'; showCard('hole'); }
    else if (s.phase === 'final' && (!prev || prev.phase !== 'final')) { V.mode = 'none'; P.key = ''; showCard('final'); SFX.cheer(); }
    if (HOLE) for (const p of s.pl) {
      const B = getBall(p.id); B.dn = p.dn; B.slot = p.slot; B.hc = !!p.hc;
      if (p.id !== ME.id && !B.driving) B.park = p.cp ? { x: p.cp[0], z: p.cp[1], yaw: p.cp[2] } : null;
      if (p.id === ME.id) continue;
      if (p.p) B.rest = { x: p.p[0], y: p.p[1], z: p.p[2] };
      else if (s.phase === 'play') { const ts = teeSpot(HOLE, p.slot); B.rest = { x: ts.x, y: groundY(HOLE, ts.x, ts.z) + BR, z: ts.z }; if (!B.anim) B.yaw = yawTo(ts.x, ts.z, HOLE.cup.x, HOLE.cup.z); }
      if (B.anim && B.anim.done && p.p) B.anim.origin = null;
    }
  }
  if (s.phase !== 'play' && (CART.driving || RUN.on)) endTravel(true);
  renderBoard(); renderCard(); renderLobby(); renderNet(); renderRules();
}
function setMenuStatus(s) { setText($('menuStatus'), s); }
function leaveGame() {
  if (CART.driving || RUN.on) endTravel(true);
  leaveNet(); S = null; P.key = ''; V.mode = 'none'; ME.id = 0;
  for (const id of [...BALLS.keys()]) dropBall(id);
  PQ.length = 0; curPrompt = null; $('prompt').hidden = true;
  $('hud').hidden = true; closeOverlays(); $('lobby').hidden = true; $('menu').hidden = false; fade(false);
}

// ============================ menus ============================
function closeOverlays() { $('cardOv').hidden = true; $('pause').hidden = true; }
function segSet(id, v) { for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === String(v)); }
function segOn(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (b) fn(b.dataset.v); }); }
function renderLobby() {
  if (!S || $('lobby').hidden) return;
  const host = NET.role === 'host';
  $('lobbyCodeBox').hidden = !!S.solo;
  setText($('lobbyCode'), NET.code || S.code || '------');
  setText($('pcount'), '(' + S.pl.length + '/' + MAX_PLAYERS + ')');
  let h = ''; for (const p of S.pl) h += '<div class="pl"><span class="dot" style="background:' + PCOL[p.slot] + '"></span>' + esc(p.n) + (p.id === 1 ? ' <span class="muted">· host</span>' : '') + (p.id === ME.id ? '<span class="you">you</span>' : '') + '</div>';
  if (!S.solo) for (let i = S.pl.length; i < MAX_PLAYERS; i++) h += '<div class="pl empty">Open spot: share the link</div>';
  setHTML($('lobbyPlayers'), h);
  $('hostOpts').hidden = !host; $('guestWait').hidden = host;
  setText($('courseName'), courseName(S.seed) + ' · par ' + Array.from({ length: S.nh }, (_, i) => holePar(i, S.nh)).reduce((a, b) => a + b, 0));
  setText($('courseNameG'), courseName(S.seed)); setText($('holesG'), S.nh + ' holes · ' + (S.mode === 'time' ? 'time trial ⏱' : 'stroke play'));
  segSet('holesSeg', S.nh); segSet('modeSeg', S.mode || 'stroke');
}
function renderNet() {
  const s = NET.solo ? 'Solo game.' : NET.role === 'host' ? (NET.online === 'online' ? 'Ready. Friends can join with the code or the link.' : NET.online) : NET.role === 'guest' ? 'Connected to the host.' : '';
  setText($('netStatus'), s); setText($('pNet'), s);
  setText($('lobbyCode'), NET.code || '------'); setText($('pauseCode'), NET.code || '------');
  $('pauseInvite').hidden = NET.solo || !NET.code; $('hostPause').hidden = NET.role !== 'host';
}
async function share() {
  const url = inviteLink(), text = 'Come play Tipsy Links with me! Game code ' + NET.code;
  if (navigator.share) { try { await navigator.share({ title: 'Tipsy Links', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyLink();
}
function copyLink() {
  const url = inviteLink();
  const done = () => toastOr('Invite link copied: ' + url);
  try { navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this invite link:', url)); } catch (e) { window.prompt('Copy this invite link:', url); }
}
function toastOr(msg) { if (!$('hud').hidden) toast(msg); else { setText($('netStatus'), msg); } }
function readName() { const n = cleanName($('nameInput').value); ME.name = n; SET.name = n; saveSet(); $('nameInput').value = n; return n; }

$('nameInput').value = SET.name || '';
{ const q = new URLSearchParams(location.search).get('join') || (location.hash.match(/join=([A-Za-z0-9]{6})/) || [])[1];
  if (q) { $('codeInput').value = q.toUpperCase(); $('joinHi').hidden = false; setText($('joinHiCode'), q.toUpperCase()); $('joinBtn').classList.add('primary'); $('hostBtn').classList.remove('primary'); } }
$('hostBtn').onclick = () => { audio(); readName(); hostGame(false); };
$('soloBtn').onclick = () => { audio(); readName(); hostGame(true); };
$('joinBtn').onclick = () => { audio(); readName(); const c = $('codeInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6) { setMenuStatus('Codes are six letters and numbers.'); return; } joinGame(c); };
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') ($('joinHi').hidden ? $('hostBtn') : $('joinBtn')).click(); });
$('shareBtn').onclick = share; $('copyBtn').onclick = copyLink; $('pShare').onclick = share; $('pCopy').onclick = copyLink;
segOn('holesSeg', v => toHost({ t: 'cfg', nh: +v }));
segOn('modeSeg', v => toHost({ t: 'cfg', mode: v }));
wireRules($('rulesEd')); wireRules($('rulesEd2'));
$('reseedBtn').onclick = () => toHost({ t: 'cfg', reseed: 1 });
$('startBtn').onclick = () => { audio(); toHost({ t: 'start' }); };
$('lobbyLeave').onclick = $('lobbyLeave2').onclick = $('finalLeave').onclick = $('leaveBtn').onclick = () => leaveGame();
$('againBtn').onclick = () => toHost({ t: 'again' });
$('cardClose').onclick = () => { $('cardOv').hidden = true; };
$('bCard').onclick = () => { if ($('cardOv').hidden) showCard(S && S.phase === 'final' ? 'final' : 'live'); else $('cardOv').hidden = true; };
$('bMenu').onclick = () => { $('pause').hidden = !$('pause').hidden; renderNet(); renderRules(); };
$('pauseClose').onclick = () => { $('pause').hidden = true; };
$('skipHoleBtn').onclick = () => { toHost({ t: 'skip' }); $('pause').hidden = true; };
$('pickupBtn').onclick = () => { pickUp(); $('pause').hidden = true; };
$('bSip').onclick = () => drink('sip');
$('bShot').onclick = () => drink('shot');
$('bCheers').onclick = () => toHost({ t: 'cheers' });
$('bZoom').onclick = () => { V.zoom = !V.zoom; };
function travelKey() {
  if (travelling()) { if (P.done || nearBall()) endTravel(); else toast('Get to your ball first, or skip for a sip.'); return; }
  if (!canTravel()) return;
  startTravel(V.mode === 'aim' ? { x: P.pos.x, z: P.pos.z, yaw: P.yaw } : { x: camera.position.x, z: camera.position.z, yaw: V.camYaw });
}
$('bCart').onclick = () => { audio(); travelKey(); };
$('cExit').onclick = () => endTravel();
$('cSkip').onclick = () => skipToBall();
$('cOut').onclick = () => getOutOfCart();
$('cIn').onclick = () => getInCart();
$('bAtk').addEventListener('pointerdown', e => { e.preventDefault(); audio(); armAtk(); });
function funnelRelease() {
  if (FUN.st !== 'hold') return;
  const ms = now() - FUN.t0;
  if (ms < 2000) { FUN.st = 'offer'; toast('That was way too fast. Hold the button the whole time you\'re funneling.'); return; }
  FUN.st = 'done'; P.hasCart = true; SFX.cheer(); flash();
  buzz(); BUZZ.x = Math.min(BUZZ_MAX, BUZZ.x + 3); // the funnel gets you drunk, not stronger
  showBanner('🍺 Cart unlocked!', 'Funneled in ' + (ms / 1000).toFixed(1) + ' s', 2200);
  toHost({ t: 'funnel', ms: Math.round(ms) });
}
$('fnHold').addEventListener('pointerdown', e => { e.preventDefault(); audio(); if ($('funnel').hidden || FUN.st === 'hold') return; FUN.st = 'hold'; FUN.t0 = now(); SFX.glug(); try { $('fnHold').setPointerCapture(e.pointerId); } catch (x) {} });
for (const ev2 of ['pointerup', 'pointercancel', 'lostpointercapture']) $('fnHold').addEventListener(ev2, () => funnelRelease());
$('fnHold').addEventListener('contextmenu', e => e.preventDefault());
$('fnNo').onclick = () => { FUN.st = 'declined'; };
$('fnChip').onclick = () => { FUN.st = 'offer'; };
function honk() { SFX.horn(); toHost({ t: 'honk' }); }
$('cHonk').onclick = honk;
for (const [id, k] of [['cGas', 'gas'], ['cBrake', 'brake'], ['cLeft', 'left'], ['cRight', 'right']]) {
  const el = $(id), set = on => e => { e.preventDefault(); cartIn[k] = on; el.classList.toggle('on', on); if (on) try { el.setPointerCapture(e.pointerId); } catch (x) {} };
  el.addEventListener('pointerdown', set(true)); el.addEventListener('pointerup', set(false)); el.addEventListener('pointercancel', set(false)); el.addEventListener('lostpointercapture', set(false));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
$('bCam').onclick = () => { SET.cam = !SET.cam; saveSet(); segSet('camSeg', SET.cam ? 1 : 0); };
$('swingBtn').addEventListener('pointerdown', e => { e.preventDefault(); swingPress(); });
$('clubPrev').onclick = () => changeClub(-1); $('clubNext').onclick = () => changeClub(1);
$('skipBtn').onclick = () => { const B = BALLS.get(ME.id); if (B && B.anim) B.anim.speed = 8; };
$('specPrev').onclick = () => pickSpec(-1); $('specNext').onclick = () => pickSpec(1);
$('mini').onclick = () => { const m = $('mini'); m.classList.toggle('big'); const r = m.getBoundingClientRect(); m.width = Math.round(r.width * 2); m.height = Math.round(r.height * 2); miniBg = null; };
$('prYes').onclick = () => { if (curPrompt) drink(curPrompt.k === 'shot' ? 'shot' : 'sip'); nextPrompt(); };
$('prNo').onclick = () => nextPrompt();
segSet('sndSeg', SET.snd ? 1 : 0); segSet('camSeg', SET.cam ? 1 : 0); segSet('fxSeg', SET.fx ? 1 : 0);
segOn('sndSeg', v => { SET.snd = v === '1'; saveSet(); segSet('sndSeg', v); });
segOn('camSeg', v => { SET.cam = v === '1'; saveSet(); segSet('camSeg', v); });
segOn('fxSeg', v => { SET.fx = v === '1'; saveSet(); segSet('fxSeg', v); });
function changeClub(d) {
  if (V.mode !== 'aim' || MT.st !== 'idle') return;
  P.club = (P.club + d + CLUBS.length) % CLUBS.length; SFX.tick();
}

// ============================ input ============================
const drag = { id: null, x: 0, y: 0, moved: 0 };
canvas.addEventListener('pointerdown', e => {
  audio();
  if (V.mode === 'intro') { beginAim(); return; }
  drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
});
canvas.addEventListener('pointermove', e => {
  if (drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (V.mode === 'cart') { CART.look = clamp(CART.look + dx * 0.004, -1.6, 1.6); V.look = clamp(V.look - dy * 0.003, -0.5, 0.5); return; }
  if (V.mode === 'run') { RUN.yaw += dx * 0.004; V.look = clamp(V.look - dy * 0.003, -0.6, 0.6); return; }
  if (V.mode === 'aim' && MT.st === 'idle') {
    const fine = e.shiftKey || V.zoom ? 0.3 : 1, k = (e.pointerType === 'touch' ? 0.0042 : 0.0026) * fine;
    P.yaw += dx * k; V.look = clamp(V.look - dy * k * 0.8, -0.6, 0.7);
  } else if (V.mode === 'spec' || V.mode === 'done') {
    const B = BALLS.get(V.spec); void B;
  }
});
const endDrag = e => { if (drag.id === e.pointerId) drag.id = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => { if (V.mode === 'aim') { e.preventDefault(); changeClub(e.deltaY > 0 ? 1 : -1); } }, { passive: false });
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { if (!$('hud').hidden && $('pause').hidden) { e.preventDefault(); if (!e.repeat) swingPress(); } return; }
  if (k === 'tab') { e.preventDefault(); if (S && !$('hud').hidden) $('bCard').click(); return; }
  if (k === 'escape') { if (!$('cardOv').hidden && $('cardOv').dataset.kind !== 'final') $('cardOv').hidden = true; else if (!$('hud').hidden) $('bMenu').click(); return; }
  if ($('hud').hidden || e.repeat) { keys.add(k); return; }
  keys.add(k);
  if (k === 'q') changeClub(-1);
  else if (k === 'e') { if (CART.driving) getOutOfCart(); else if (RUN.on) getInCart(); else changeClub(1); }
  else if (k === 'x') armAtk();
  else if (k === 'b') drink('sip'); else if (k === 'n') drink('shot');
  else if (k === 'f') travelKey();
  else if (k === 'g' && V.mode === 'cart') honk();
  else if (k === 'z') V.zoom = !V.zoom; else if (k === 'c') $('bCam').click(); else if (k === 'h') $('bCheers').click();
});
addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); if (e.key === ' ' && !$('hud').hidden) e.preventDefault(); });
// keep Space for swinging: don't leave HUD buttons focused after a click
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#hud button'); if (b) b.blur(); });
function keyAim(dt) {
  if (V.mode !== 'aim' || MT.st !== 'idle') return;
  const fine = keys.has('shift') ? 0.18 : 1, r = 0.55 * fine * dt;
  if (keys.has('a') || keys.has('arrowleft')) P.yaw -= r;
  if (keys.has('d') || keys.has('arrowright')) P.yaw += r;
  if (keys.has('w') || keys.has('arrowup')) V.look = clamp(V.look + r, -0.6, 0.7);
  if (keys.has('s') || keys.has('arrowdown')) V.look = clamp(V.look - r, -0.6, 0.7);
}
addEventListener('blur', () => keys.clear());

// ============================ main loop ============================
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = now();
function frame() {
  requestAnimationFrame(frame);
  const t = now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (NET.role === 'host') hostTick(t);
  netTick(t);
  keyAim(dt);
  if (HOLE && S && S.phase === 'play') updateGame(dt, t); else { rig.visible = false; tgtRing.visible = false; aimDots.visible = false; for (const B of BALLS.values()) { B.ball.visible = false; B.shadow.visible = false; B.trail.visible = false; if (B.avatar) B.avatar.visible = false; B.cart.visible = false; } }
  updateCamera(dt, t);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
  hiccups(t);
  drunkFx(t);
  updateMarkers();
  drawMini();
  updateHud(t);
  if (S && S.phase === 'card' && !$('cardOv').hidden) setText($('cardTimer'), S.hole + 1 < S.nh ? 'Next hole in ' + Math.max(0, Math.ceil((S.until - t) / 1000)) + 's' : 'Final results in ' + Math.max(0, Math.ceil((S.until - t) / 1000)) + 's');
  else setText($('cardTimer'), '');
}
buildHole((Math.random() * 1e9) | 0, 0, 9);
requestAnimationFrame(frame);
// for automated tests
window.__tipsy = { ATK, ATKS, armAtk, fireAtk, getOutOfCart, getInCart, drunk, P, V, MT, BUZZ, CART, RUN, FUN, cartIn, startTravel, endTravel, skipToBall, funnelRelease, S: () => S, HOLE: () => HOLE, NET, HS, simulate, swingPress, drink, CLUBS, buildHole, camera, renderer, BALLS };
})();
