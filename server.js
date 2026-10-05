'use strict';
/* 金馬桶專案 — 辦公室美術版。網頁與場景原始碼位於 public/，供雲端與本機共用。 */
/*
 * 金馬桶專案 — 部門連線小遊戲伺服器
 * 不需要安裝任何套件：只要 Node.js 18 以上。
 *   node server.js            （預設埠 3000）
 *   node server.js 8080       （指定埠）
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const zlib = require('zlib');

// 雲端版會把 public/ 的檔案內嵌在這個檔案最前面（EMBEDDED）；區網版直接讀資料夾
const EMB = typeof EMBEDDED !== 'undefined' ? EMBEDDED : null; // eslint-disable-line no-undef
function loadShared() {
  if (!EMB) return require('./public/shared.js');
  const m = { exports: {} };
  new Function('module', 'exports', Buffer.from(EMB['/shared.js'], 'base64').toString('utf8'))(m, m.exports);
  return m.exports;
}
const G = loadShared();

const CLOUD = !!(process.env.RENDER || process.env.CLOUD || process.env.HOST_KEY);
const argPort = /^\d+$/.test(process.argv[2] || '') ? process.argv[2] : null;
const PORT = parseInt(argPort || process.env.PORT || '3000', 10);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, '活動成果');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const HOST_KEY_FILE = path.join(DATA_DIR, 'host-key.txt');
const NO_BROWSER = CLOUD || process.argv.includes('--no-browser') || process.env.NO_BROWSER === '1';

fs.mkdirSync(DATA_DIR, { recursive: true });

// 主持人密碼：雲端版用環境變數 HOST_KEY；區網版存在 data/host-key.txt，重開也不變
let HOST_KEY = (process.env.HOST_KEY || '').trim();
if (!HOST_KEY) {
  try { HOST_KEY = fs.readFileSync(HOST_KEY_FILE, 'utf8').trim(); } catch (e) { /* none */ }
  if (!HOST_KEY || !/^[a-z0-9]{4,}$/i.test(HOST_KEY)) {
    HOST_KEY = crypto.randomBytes(3).toString('hex');
    fs.writeFileSync(HOST_KEY_FILE, HOST_KEY);
  }
}

const now = () => Date.now();
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const clampStr = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const cellKey = (x, y, z) => x + ',' + y + ',' + z;

// ---------------------------------------------------------------- 遊戲狀態
function freshGame() {
  return {
    schemaVersion: 2,
    board: {members:[],votes:{},chair:null,round:1,tied:false},
    ai: {mode:'STANDBY',progress:0,cycles:0,plan:null,strategy:null},
    gameId: rid(4),
    phase: 'lobby',
    phaseEndsAt: null,
    pausedRemaining: null,
    timeUp: false,
    settings: Object.assign({}, G.DEFAULT_SETTINGS),
    lobby: { open: false, openAt: null },
    rolesPublished: false,
    players: {},            // id -> player
    joinCounter: 0,
    brief: { choice: null, auto: false },
    builds: { A: {}, B: {}, C: {} }, // key -> {c, by}
    stickers: [],           // 最近的貼紙
    banners: { A: null, B: null },
    review: { votes: {}, bossPick: null, changes: 0, winner: null },
    poster: { posters: {}, survey: {}, officialPrice: null },
    gallery: { votes: {}, bossPick: null },
    launch: null,
    stats: {}               // id -> {placed, removed, stickers, reactions, visits}
  };
}

let game = freshGame();
try {
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (saved && saved.schemaVersion === 2 && saved.gameId && saved.players) {
    game = Object.assign(freshGame(), saved);
    for (const p of Object.values(game.players)) p.online = false;
    console.log('  已載入上次的遊戲進度（主持人可在控制台按「重置遊戲」重新開始）');
  }
} catch (e) { /* 沒有存檔 */ }

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = STATE_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(game), err => { if (!err) fs.rename(tmp, STATE_FILE, () => {}); });
  }, 2500);
}

function stat(id) {
  if (!game.stats[id]) game.stats[id] = { placed: 0, removed: 0, stickers: 0, reactions: 0, visits: 0 };
  return game.stats[id];
}

function activePlayers() {
  return Object.values(game.players).filter(p => !p.kicked).sort((a, b) => a.joinIdx - b.joinIdx);
}

// 依報到順序決定職級與隊伍
function computeRoles() {
  sim.boardReady();
  const list = activePlayers().filter((p,i) => i<3 || p.rank !== 'intern' || !game.rolesPublished);
  const n = list.length;
  const mgrCount = Math.max(0, Math.round((n - 6) * 0.15));
  const counts = { A: 0, B: 0, M: 0 };
  const weight = { A: 2, B: 2, M: 1 };
  const titleIdx = { manager: { A: 0, B: 0, M: 0 }, staff: { A: 0, B: 0, M: 0 } };
  const pickTeam = () => {
    let best = 'A', bestScore = Infinity;
    for (const t of ['A', 'B', 'M']) {
      const s = counts[t] / weight[t];
      if (s < bestScore - 1e-9) { best = t; bestScore = s; }
    }
    return best;
  };
  list.forEach((p, i) => {
    if (i < 3) { p.rank = p.id === game.board.chair ? 'boss' : 'board'; p.team = null; p.title = p.rank === 'boss' ? '董事長' : '董事'; return; }
    if (i <= 5) {
      const t = ['A', 'B', 'M'][i - 3];
      p.rank = 'lead'; p.team = t; p.title = G.TITLES.lead[t]; counts[t]++; return;
    }
    const isMgr = i < 6 + mgrCount;
    const t = pickTeam();
    counts[t]++;
    const r = isMgr ? 'manager' : 'staff';
    const pool = G.TITLES[r][t];
    p.rank = r; p.team = t; p.title = pool[titleIdx[r][t]++ % pool.length];
  });
}

function assignIntern(p) {
  const counts = { A: 0, B: 0, M: 0 };
  for (const q of activePlayers()) if (q.team && q !== p) counts[q.team]++;
  const weight = { A: 2, B: 2, M: 1 };
  let best = 'A', bs = Infinity;
  for (const t of ['A', 'B', 'M']) { const s = counts[t] / weight[t]; if (s < bs - 1e-9) { bs = s; best = t; } }
  p.rank = 'intern'; p.team = best; p.title = G.TEAMS[best].name + ' 約聘實習生';
}

function ownedCount(team, pid) {
  let c = 0;
  const b = game.builds[team];
  for (const k in b) if (b[k].by === pid) c++;
  return c;
}

function posterMakers() {
  const ps = activePlayers();
  const m = ps.filter(p => p.team === 'M');
  return m.length ? m : ps.filter(p => p.rank !== 'boss');
}
function canMakePoster(p) { return posterMakers().some(q => q.id === p.id); }

function winnerTeam() {
  if (game.review.bossPick) return game.review.bossPick;
  const t = tallyReview();
  return ['A','B','C'].sort((a,b)=>t[b]-t[a])[0];
}
function tallyReview() {
  const t = { A: 0, B: 0, C: 0 };
  for (const v of Object.values(game.review.votes)) if (t[v] != null) t[v]++;
  return t;
}
function tallyGallery() {
  const t = {};
  for (const v of Object.values(game.gallery.votes)) t[v] = (t[v] || 0) + 1;
  return t;
}

function timedPhase(ph) {
  return ph === 'brief' ? game.settings.briefSec : ph === 'build' ? game.settings.buildSec : ph === 'poster' ? game.settings.posterSec : 0;
}

function setPhase(ph) {
  if (!G.PHASE_IDS.includes(ph)) return;
  if (!['lobby','roles'].includes(ph) && !game.board.chair) { broadcast({t:'toast',msg:'請先由三位董事互選董事長（不能投自己）'},c=>c.host); return; }
  const prev = game.phase;
  game.phase = ph;
  game.timeUp = false;
  game.pausedRemaining = null;
  const sec = timedPhase(ph);
  game.phaseEndsAt = sec ? now() + sec * 1000 : null;
  game.phaseStartedAt = now();

  if (ph === 'roles' && !game.rolesPublished) { computeRoles(); game.rolesPublished = true; }
  if (ph !== 'lobby' && !game.rolesPublished) { computeRoles(); game.rolesPublished = true; }
  if (ph === 'poster' || ph === 'gallery' || ph === 'launch') {
    if (!game.review.winner || prev === 'review') game.review.winner = winnerTeam();
  }
  if (ph === 'launch') finalizeLaunch();
  broadcastState(true);
  scheduleSave();
}

function finalizeLaunch() {
  const posters = game.poster.posters;
  const ids = Object.keys(posters).filter(id => posters[id].img);
  const gt = tallyGallery();
  let official = game.gallery.bossPick && posters[game.gallery.bossPick] ? game.gallery.bossPick : null;
  if (!official && ids.length) official = ids.slice().sort((a, b) => (gt[b] || 0) - (gt[a] || 0))[0];
  let popular = ids.length ? ids.slice().sort((a, b) => (gt[b] || 0) - (gt[a] || 0))[0] : null;
  if (popular && !gt[popular]) popular = null;

  const ps = activePlayers();
  const best = (fn, filter) => {
    let top = null, v = 0;
    for (const p of ps) { if (filter && !filter(p)) continue; const x = fn(p); if (x > v) { v = x; top = p.id; } }
    return top ? { id: top, value: v } : null;
  };
  const survey = Object.entries(game.poster.survey);
  const prices = survey.map(([, s]) => s.price).filter(x => typeof x === 'number');
  const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const rich = best(p => (game.poster.survey[p.id] || {}).price || 0);

  game.launch = {
    winner: game.review.winner,
    official,
    popular,
    avgPrice: avg,
    price: game.poster.officialPrice != null ? game.poster.officialPrice : avg,
    awards: {
      worker: best(p => stat(p.id).placed, p => p.rank === 'staff' || p.rank === 'intern'),
      micromanager: best(p => stat(p.id).stickers, p => p.rank === 'manager' || p.rank === 'lead'),
      rich,
      cheer: best(p => stat(p.id).reactions)
    },
    blocks: Object.keys(game.builds[game.review.winner] || {}).length
  };
  saveOutputs();
}

// 活動成果：海報、摘要、積木（存到資料夾；雲端版可從主持人頁下載 zip）
function collectOutputs() {
  const files = [];
  const nameOf = id => (game.players[id] || {}).name || '未知';
  for (const [id, pst] of Object.entries(game.poster.posters)) {
    if (!pst.img) continue;
    const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(pst.img);
    if (!m) continue;
    const tag = id === (game.launch && game.launch.official) ? '官方海報_' : '';
    files.push({ name: `${tag}海報_${safeName(nameOf(id))}_${id.slice(0, 4)}.${m[1] === 'png' ? 'png' : 'jpg'}`, data: Buffer.from(m[2], 'base64') });
  }
  const ps = activePlayers();
  const summary = {
    日期: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    開案方向: game.brief.choice != null ? G.BRIEFS[game.brief.choice].name : null,
    上市方案: game.review.winner && G.TEAMS[game.review.winner].plan,
    民意投票: tallyReview(),
    董事長: (ps.find(p => p.rank === 'boss') || {}).name,
    官方售價: game.launch && game.launch.price,
    市調平均願付: game.launch && game.launch.avgPrice,
    組織: ps.map(p => ({ 順序: p.joinIdx, 姓名: p.name, 職稱: p.title, 隊伍: p.team && G.TEAMS[p.team].name, 放置積木: stat(p.id).placed })),
    市調金句: Object.entries(game.poster.survey).map(([id, s]) => ({ 姓名: nameOf(id), 願付: s.price, 一句話: s.quote }))
  };
  files.push({ name: '成果摘要.json', data: Buffer.from(JSON.stringify(summary, null, 2)) });
  const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = [['報到順序', '姓名', '職稱', '隊伍', '放置積木', '市調願付', '一句話'].map(csvCell).join(',')]
    .concat(ps.map(p => { const sv = game.poster.survey[p.id] || {}; return [p.joinIdx, p.name, p.title, p.team ? G.TEAMS[p.team].name : '董事會', stat(p.id).placed, sv.price, sv.quote].map(csvCell).join(','); }));
  files.push({ name: '組織與市調.csv', data: Buffer.from('\ufeff' + csv.join('\r\n')) });
  files.push({ name: '馬桶積木.json', data: Buffer.from(JSON.stringify(game.builds)) });
  return files;
}
function saveOutputs() {
  try {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const dir = path.join(OUT_DIR, stamp);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of collectOutputs()) fs.writeFileSync(path.join(dir, f.name), f.data);
    console.log('  活動成果已存到：' + dir);
  } catch (e) { console.log('  存檔失敗：', e.message); }
}

// 最小 ZIP 產生器（不壓縮，檔名 UTF-8）
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), data = f.data, crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(parts.concat([cd, end]));
}
function safeName(s) { return String(s).replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 20) || 'player'; }

// ---------------------------------------------------------------- 對外狀態
function publicState(includeHistory=false) {
  const ps = activePlayers().map(p => ({
    id: p.id, name: p.name, joinIdx: p.joinIdx, joinMs: p.joinMs, online: p.online || !!p.bot || !!p.aiControlled,
    rank: p.rank, team: p.team, title: p.title, bot: !!p.bot, appearance:p.appearance, dancing:!!p.dancing, aiControlled:!!p.aiControlled, indoorBanUntil:p.indoorBanUntil||0, expelPending:!!p.expelPending, sportsTeam:campus.side(p),
    owned: p.team === 'A' || p.team === 'B' ? ownedCount(p.team, p.id) : 0,
    motion: p.motion ? {...p.motion,path:undefined} : null, leisure: {score:p.leisure?.score||0,awaySeconds:Math.floor(p.leisure?.awaySeconds||0)},
    placed: stat(p.id).placed
  }));
  const survey = Object.entries(game.poster.survey);
  const prices = survey.map(([, s]) => s.price).filter(x => typeof x === 'number');
  return {
    gameId: game.gameId,
    phase: game.phase,
    phaseEndsAt: game.phaseEndsAt,
    pausedRemaining: game.pausedRemaining,
    timeUp: game.timeUp,
    serverNow: now(),
    settings: game.settings,
    lobby: game.lobby,
    rolesPublished: game.rolesPublished,
    players: ps,
    connected: clients.size,
    testPlayers: {active:ps.filter(p=>p.bot).length,pending:bots.filter(b=>!b.c.player).length,target:50},
    campus:campus.summary(includeHistory), recreation: recreation.summary(), board: game.board, ai:{mode:game.ai.mode,progress:game.ai.progress,cycles:game.ai.cycles},
    brief: game.brief,
    banners: game.banners,
    counts: { A: Object.keys(game.builds.A).length, B: Object.keys(game.builds.B).length, C:Object.keys(game.builds.C).length },
    review: { tally: tallyReview(), bossPick: game.review.bossPick, changes: game.review.changes, winner: game.review.winner },
    poster: {
      makers: posterMakers().map(p => p.id),
      posters: Object.entries(game.poster.posters).map(([id, x]) => ({ author: id, name: x.name, slogan: x.slogan, v: x.v, submitted: !!x.submitted, hasImg: !!x.img })),
      surveyCount: survey.length,
      avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      quotes: survey.filter(([, s]) => s.quote).map(([id, s]) => ({ by: id, quote: s.quote, price: s.price, at: s.at })).sort((a, b) => b.at - a.at).slice(0, 40),
      officialPrice: game.poster.officialPrice
    },
    gallery: { tally: tallyGallery(), bossPick: game.gallery.bossPick },
    launch: game.launch
  };
}

function youState(p) {
  if (!p) return null;
  return {
    id: p.id, token: p.token, name: p.name, mini:p.mini||null,
    arcade: p.motion?.room==='arcade'&&p.leisure?.round?.expires>now()?p.leisure.round:null,
    reviewVote: game.review.votes[p.id] || null,
    galleryVote: game.gallery.votes[p.id] || null,
    survey: game.poster.survey[p.id] || null,
    poster: game.poster.posters[p.id] ? { name: game.poster.posters[p.id].name, slogan: game.poster.posters[p.id].slogan, submitted: !!game.poster.posters[p.id].submitted, v: game.poster.posters[p.id].v } : null
  };
}

// ---------------------------------------------------------------- WebSocket（自製，免安裝套件）
const clients = new Set();

function wsAccept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { socket, buf: Buffer.alloc(0), frags: [], fragOp: 0, alive: true, player: null, host: false, open: true, ip: socket.remoteAddress, bucket: 20, lastFill: now(), cd: {} };
  clients.add(c);
  socket.on('data', d => { c.buf = c.buf.length ? Buffer.concat([c.buf, d]) : d; parseFrames(c); });
  socket.on('close', () => dropClient(c));
  socket.on('end', () => dropClient(c));
  socket.on('error', () => dropClient(c));
}

const MAX_MSG = 3 * 1024 * 1024;
function parseFrames(c) {
  while (c.open) {
    const b = c.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; const hi = b.readUInt32BE(2); len = hi * 4294967296 + b.readUInt32BE(6); off = 10; }
    if (len > MAX_MSG) { closeClient(c); return; }
    const maskOff = off; if (masked) off += 4;
    if (b.length < off + len) return;
    let payload = b.subarray(off, off + len);
    if (masked) {
      const m = b.subarray(maskOff, maskOff + 4);
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ m[i & 3];
      payload = out;
    }
    c.buf = b.subarray(off + len);
    if (op === 0x8) { closeClient(c); return; }
    if (op === 0x9) { sendRaw(c, payload, 0xA); continue; }
    if (op === 0xA) { c.alive = true; continue; }
    if (op === 0x1 || op === 0x2) { c.frags = [payload]; c.fragOp = op; }
    else if (op === 0x0) { c.frags.push(payload); }
    else continue;
    if (fin) {
      const msg = Buffer.concat(c.frags); c.frags = [];
      if (c.fragOp === 0x1) {
        let data; try { data = JSON.parse(msg.toString('utf8')); } catch (e) { continue; }
        try { onMessage(c, data); } catch (e) { console.error('訊息處理錯誤', e); }
      }
    }
  }
}

function sendRaw(c, payload, op = 0x1) {
  if (!c.open || c.bot) return;
  if (c.poll) { if (op === 0x1) pollPush(c, payload.toString('utf8')); return; }
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeUInt32BE(Math.floor(len / 4294967296), 2); head.writeUInt32BE(len >>> 0, 6); }
  head[0] = 0x80 | op;
  try { c.socket.write(Buffer.concat([head, payload])); } catch (e) { dropClient(c); }
}
function send(c, obj) {
  if (c.bot) return;
  const str = JSON.stringify(obj);
  if (c.poll) pollPush(c, str); else sendRaw(c, Buffer.from(str));
}
function broadcast(obj, filter) {
  const str = JSON.stringify(obj);
  let buf = null;
  for (const c of clients) {
    if (filter && !filter(c)) continue;
    if (c.poll) pollPush(c, str); else sendRaw(c, buf || (buf = Buffer.from(str)));
  }
}
function closeClient(c) {
  if (!c.open) return;
  if (!c.poll) { try { c.socket.write(Buffer.from([0x88, 0])); c.socket.end(); } catch (e) { /* ignore */ } }
  dropClient(c);
}
function dropClient(c) {
  if (!clients.has(c)) return;
  c.open = false;
  clients.delete(c);
  if (c.poll) {
    polls.delete(c.cid);
    if (c.waiter) { try { c.waiter.writeHead(410); c.waiter.end(); } catch (e) { /* ignore */ } c.waiter = null; }
    clearTimeout(c.waitTimer);
  } else {
    try { c.socket.destroy(); } catch (e) { /* ignore */ }
  }
  if (c.player) {
    const still = [...clients].some(o => o.player === c.player);
    if (!still) c.player.online = false;
  }
  stateDirty = true;
}

setInterval(() => {
  for (const c of clients) {
    if (c.poll) { if (now() - c.lastSeen > 45000) dropClient(c); continue; }
    if (!c.alive) { dropClient(c); continue; }
    c.alive = false;
    sendRaw(c, Buffer.alloc(0), 0x9);
  }
}, 20000);

// ---------------------------------------------------------------- HTTP 輪詢（公司 Proxy 擋 WebSocket 時的備援）
const polls = new Map();
function newPollClient(req) {
  const c = { poll: true, cid: rid(12), queue: [], waiter: null, waitTimer: null, flushing: false, open: true, alive: true, player: null, host: false, ip: req.socket.remoteAddress, bucket: 20, lastFill: now(), cd: {}, lastSeen: now() };
  clients.add(c); polls.set(c.cid, c);
  return c;
}
function pollPush(c, str) {
  c.queue.push(str);
  if (c.queue.length > 4000) { dropClient(c); return; }
  if (c.waiter && !c.flushing) { c.flushing = true; setImmediate(() => { c.flushing = false; pollFlush(c); }); }
}
function pollFlush(c) {
  if (!c.waiter || !c.queue.length) return;
  const res = c.waiter; c.waiter = null; clearTimeout(c.waitTimer);
  const body = '[' + c.queue.join(',') + ']'; c.queue = [];
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limit, cb) {
  const chunks = []; let size = 0, done = false;
  req.on('data', d => { if (done) return; size += d.length; if (size > limit) { done = true; cb(null); req.destroy(); return; } chunks.push(d); });
  req.on('end', () => { if (!done) { done = true; cb(Buffer.concat(chunks)); } });
  req.on('error', () => { if (!done) { done = true; cb(null); } });
}
function handleRealtime(req, res, u) {
  const p = u.pathname;
  if (p === '/rt/connect' && req.method === 'POST') {
    const c = newPollClient(req);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ cid: c.cid }));
    return true;
  }
  const c = polls.get(u.searchParams.get('cid') || '');
  if (p === '/rt/send' || p === '/rt/poll') {
    if (!c) { res.writeHead(410, { 'Cache-Control': 'no-store' }); res.end(); return true; }
    c.lastSeen = now();
  }
  if (p === '/rt/send' && req.method === 'POST') {
    readBody(req, MAX_MSG, buf => {
      if (!buf) { res.writeHead(413); res.end(); return; }
      let arr; try { arr = JSON.parse(buf.toString('utf8')); } catch (e) { res.writeHead(400); res.end(); return; }
      if (!Array.isArray(arr)) arr = [arr];
      for (const m of arr.slice(0, 200)) { if (!c.open) break; try { onMessage(c, m); } catch (e) { console.error('訊息處理錯誤', e); } }
      res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end();
    });
    return true;
  }
  if (p === '/rt/poll' && req.method === 'GET') {
    if (c.waiter) { try { c.waiter.writeHead(200, { 'Content-Type': 'application/json' }); c.waiter.end('[]'); } catch (e) { /* ignore */ } }
    c.waiter = res;
    clearTimeout(c.waitTimer);
    c.waitTimer = setTimeout(() => { if (c.waiter === res) { c.waiter = null; res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('[]'); } }, 25000);
    req.on('close', () => { if (c.waiter === res) { c.waiter = null; clearTimeout(c.waitTimer); } });
    if (c.queue.length) pollFlush(c);
    return true;
  }
  return false;
}

// 狀態廣播（節流）
let stateDirty = false;
function broadcastState(force) {
  if (!force) { stateDirty = true; return; }
  stateDirty = false;
  broadcast({ t: 'state', s: publicState() });
}
setInterval(() => { if (stateDirty) broadcastState(true); }, 200);

// 積木異動批次廣播
let pendingOps = { A: [], B: [], C: [] };
setInterval(() => {
  for (const team of ['A', 'B', 'C']) {
    if (!pendingOps[team].length) continue;
    broadcast({ t: 'ops', team, ops: pendingOps[team] });
    pendingOps[team] = [];
  }
}, 60);

function fx(obj) { broadcast(Object.assign({ t: 'fx', at: now() }, obj)); }
// 給大螢幕辦公室實況用的活動訊號（只送主持人／辦公室畫面）
function actHost(id, k, x) { broadcast({ t: 'act', id, k, x }, c => c.host || c.office); }

// 計時器
setInterval(() => {
  if (!game.phaseEndsAt || game.timeUp || game.pausedRemaining != null) return;
  if (now() >= game.phaseEndsAt) {
    game.timeUp = true;
    if (game.phase === 'brief' && game.brief.choice == null) {
      game.brief.choice = Math.floor(Math.random() * G.BRIEFS.length);
      game.brief.auto = true;
      fx({ kind: 'brief', choice: game.brief.choice, auto: true });
    }
    fx({ kind: 'timeup', phase: game.phase });
    broadcastState(true);
    scheduleSave();
  }
}, 250);

function rateOk(c, cost = 1) {
  const t = now();
  c.bucket = Math.min(20, c.bucket + (t - c.lastFill) / 1000 * 12);
  c.lastFill = t;
  if (c.bucket < cost) return false;
  c.bucket -= cost;
  return true;
}
function cooldown(c, key, ms) {
  const p = c.player; const k = (p ? p.id : 'x') + key;
  const t = now();
  if (cooldowns[k] && t - cooldowns[k] < ms) return false;
  cooldowns[k] = t; return true;
}
const cooldowns = {};

function buildOpen() { return game.phase === 'build' && !game.timeUp && game.pausedRemaining == null; }

const appearances=require('./appearance.cjs')({players:()=>Object.values(game.players),clients:()=>clients});
const recreation=require('./recreation.cjs')({externalSports:true,getGame:()=>game,broadcast,changed:()=>broadcastState(false),save:scheduleSave});
const sim = require('./simulation.cjs')({getGame:()=>game,G,broadcast,stateChanged:()=>broadcastState(false),save:scheduleSave,computeRoles,buildOpen,pending:()=>pendingOps,plan:toiletPlan});
const campus=require('./campus.cjs')({getGame:()=>game,G,broadcast,changed:()=>broadcastState(false),save:scheduleSave});
setInterval(()=>{sim.tick();recreation.tick();campus.tick();},50);

// ---------------------------------------------------------------- 訊息處理
function onMessage(c, m) {
  if (!m || typeof m.t !== 'string') return;
  const p = c.player;
  if(p&&!c.bot&&['input.active','chat.send','sports.hit','office.move','board.vote','place','remove','sticker','banner','visit','react','mini.start','mini.input','coffee.join','coffee.step','dance','arcade.start','arcade.hit','core.inspect','brief','vote','bossPick','poster','price','survey','gvote','gpick'].includes(m.t))campus.activity(p);
  if(['chat.send','input.active','sports.hit'].includes(m.t)){if(rateOk(c))campus.handle({player:p,host:c.host,reply:msg=>send(c,msg),get chatAt(){return c.chatAt;},set chatAt(v){c.chatAt=v;}},m);return;}
  if (['board.vote','office.move','arcade.start','arcade.hit','core.inspect'].includes(m.t)) { if(rateOk(c)) sim.handle({player:p,reply:msg=>send(c,msg)},m); return; }

  if (['mini.start','mini.input','coffee.join','coffee.step','dance'].includes(m.t)) {if(rateOk(c))recreation.handle({player:p,reply:msg=>send(c,msg)},m);return;}
  switch (m.t) {
    case 'appearance.roll': if(cooldown(c,'look',700)&&rateOk(c,2))send(c,{t:'appearance.offer',offer:appearances.offer(c)});return;
    case 'hello': {
      if (m.office) c.office = true;
      if (m.host) {
        if (m.key === HOST_KEY) { c.host = true; } else { send(c, { t: 'hostDenied' }); }
      }
      if (m.token) {
        const found = Object.values(game.players).find(q => q.token === m.token && !q.kicked);
        if (found) { c.player = found; found.online = true; }
      }
      send(c, { t: 'welcome', host: c.host, you: youState(c.player), s: publicState(true), builds: game.builds, stickers: game.stickers.filter(s => now() - s.at < 30000), net: c.host ? netInfo() : null, cloud: CLOUD });
      if(!c.player&&!c.host)send(c,{t:'appearance.offer',offer:appearances.offer(c)});
      stateDirty = true;
      return;
    }
    case 'ping': send(c, { t: 'pong', n: m.n, serverNow: now() }); return;

    case 'join': {
      if (p) { send(c, { t: 'you', you: youState(p) }); return; }
      const name = clampStr(m.name, G.LIMITS.name);
      if (!name) { send(c, { t: 'err', msg: '請輸入名字' }); return; }
      if (game.phase === 'lobby' && (!game.lobby.open || now() < game.lobby.openAt)) { send(c, { t: 'err', msg: '還沒開放報到，等主持人倒數！', code: 'notopen' }); return; }
      if (!rateOk(c, 5)) return;
      const appearance=appearances.choose(c,m);if(!appearance){send(c,{t:'err',msg:'造型已過期，請重新隨機產生三款'});send(c,{t:'appearance.offer',offer:appearances.offer(c)});return;}
      const id = rid(5);
      const player = { id, appearance, lastActionAt:now(), token: rid(12), name, joinIdx: ++game.joinCounter, joinMs: game.lobby.openAt ? Math.max(0, now() - game.lobby.openAt) : 0, online: true, bot:!!c.bot, rank: null, team: null, title: '', kicked: false };
      game.players[id] = player;
      c.player = player;
      if (game.rolesPublished) assignIntern(player);
      computeRoles();
      sim.init(player);
      stat(id);
      send(c, { t: 'you', you: youState(player) });
      fx({ kind: 'join', id, name, joinIdx: player.joinIdx });
      broadcastState(true);
      scheduleSave();
      return;
    }
    case 'place': {
      if (!p || !buildOpen()) return;
      if (!(p.team === 'A' || p.team === 'B')) return;
      if(p.motion?.room!==p.team) {send(c,{t:'err',msg:'請先回到自己的研發區才能施工'});return;}
      if (!rateOk(c)) return;
      const x = m.x | 0, y = m.y | 0, z = m.z | 0, col = m.c | 0;
      if (x < 0 || y < 0 || z < 0 || x >= G.GRID.x || y >= G.GRID.y || z >= G.GRID.z) return;
      if (col < 0 || col >= G.COLORS.length) return;
      const b = game.builds[p.team];
      const k = cellKey(x, y, z);
      if (b[k]) return;
      const budget = G.RANKS[p.rank] ? G.RANKS[p.rank].budget : 0;
      if (ownedCount(p.team, p.id) >= budget) { send(c, { t: 'err', msg: '你的積木額度用完了！拆掉一些自己的，或請基層幫忙 😅', code: 'budget' }); if (cooldown(c, 'errb', 4000)) actHost(p.id, 'err', 'budget'); return; }
      if (y > 0) {
        const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(d => b[cellKey(x + d[0], y + d[1], z + d[2])]);
        if (!nb) return;
      }
      b[k] = { c: col, by: p.id };
      stat(p.id).placed++;
      pendingOps[p.team].push([1, x, y, z, col, p.id]);
      scheduleSave();
      return;
    }
    case 'remove': {
      if (!p || !buildOpen()) return;
      if (!(p.team === 'A' || p.team === 'B')) return;
      if(p.motion?.room!==p.team) {send(c,{t:'err',msg:'請先回到自己的研發區才能施工'});return;}
      if (!rateOk(c)) return;
      const x = m.x | 0, y = m.y | 0, z = m.z | 0;
      const b = game.builds[p.team];
      const k = cellKey(x, y, z);
      const blk = b[k];
      if (!blk) return;
      const power = p.rank === 'manager' || p.rank === 'lead';
      if (blk.by !== p.id && !power) { send(c, { t: 'err', msg: '基層只能拆自己的積木（主管才能拆別人的 🙃）', code: 'perm' }); if (cooldown(c, 'errp', 4000)) actHost(p.id, 'err', 'perm'); return; }
      delete b[k];
      stat(p.id).removed++;
      pendingOps[p.team].push([0, x, y, z, p.id, blk.by]);
      if (blk.by !== p.id) {
        const victim = [...clients].filter(o => o.player && o.player.id === blk.by);
        for (const v of victim) send(v, { t: 'toast', msg: `${p.title} ${p.name} 拆了你的積木`, kind: 'warn' });
      }
      scheduleSave();
      return;
    }
    case 'sticker': {
      if (!p || game.phase !== 'build') return;
      const team = m.team === 'B' ? 'B' : 'A';
      const isBoss = p.rank === 'boss';
      if (!(isBoss || p.rank === 'manager' || p.rank === 'lead')) return;
      if (!cooldown(c, 'stk', isBoss ? 3000 : 2500)) { send(c, { t: 'err', msg: '貼紙冷卻中…（指導也要喘口氣）', code: 'cd' }); return; }
      const text = clampStr(m.text, G.LIMITS.sticker);
      if (!text) return;
      const pos = Array.isArray(m.pos) ? m.pos.slice(0, 3).map(v => Math.max(-2, Math.min(18, +v || 0))) : [7, 4, 7];
      const s = { id: rid(4), team, pos, text, by: p.id, boss: isBoss, at: now() };
      game.stickers.push(s); if (game.stickers.length > 60) game.stickers.shift();
      stat(p.id).stickers++;
      fx(Object.assign({ kind: 'sticker' }, s));
      return;
    }
    case 'banner': {
      if (!p || game.phase !== 'build' || p.rank !== 'lead' || !(p.team === 'A' || p.team === 'B')) return;
      if (!cooldown(c, 'ban', 45000)) { send(c, { t: 'err', msg: '方向調整每 45 秒一次，讓大家喘口氣', code: 'cd' }); return; }
      const text = clampStr(m.text, G.LIMITS.banner); if (!text) return;
      game.banners[p.team] = { text, by: p.id, at: now() };
      stat(p.id).stickers++;
      fx({ kind: 'banner', team: p.team, text, by: p.id });
      stateDirty = true;
      return;
    }
    case 'visit': {
      if (!p || p.rank !== 'boss' || game.phase !== 'build') return;
      const team = m.team === 'B' ? 'B' : 'A';
      if (!cooldown(c, 'visit', 12000)) { send(c, { t: 'err', msg: '巡視冷卻中，老闆也要喝口茶', code: 'cd' }); return; }
      stat(p.id).visits++;
      lastVisit[team] = now();
      fx({ kind: 'visit', team, by: p.id });
      return;
    }
    case 'react': {
      if (!p) return;
      if (!G.REACTIONS.includes(m.emoji)) return;
      if (!cooldown(c, 'react', 900)) return;
      stat(p.id).reactions++;
      fx({ kind: 'react', team: m.team === 'B' ? 'B' : m.team === 'A' ? 'A' : null, emoji: m.emoji, by: p.id });
      return;
    }
    case 'brief': {
      if (!p || p.rank !== 'boss' || game.phase !== 'brief') return;
      const i = m.choice | 0; if (i < 0 || i >= G.BRIEFS.length) return;
      game.brief.choice = i; game.brief.auto = false;
      fx({ kind: 'brief', choice: i });
      broadcastState(true); scheduleSave();
      return;
    }
    case 'vote': {
      if (!p || game.phase !== 'review') return;
      if (!['A','B','C'].includes(m.team)) return;
      game.review.votes[p.id] = m.team;
      send(c, { t: 'you', you: youState(p) });
      actHost(p.id, 'vote');
      stateDirty = true; scheduleSave();
      return;
    }
    case 'bossPick': {
      if (!p || p.rank !== 'boss' || game.phase !== 'review') return;
      if (!['A','B','C'].includes(m.team)) return;
      if (game.review.bossPick && game.review.bossPick !== m.team) game.review.changes++;
      game.review.bossPick = m.team;
      game.review.winner = m.team;
      fx({ kind: 'bossPick', team: m.team, changes: game.review.changes });
      broadcastState(true); scheduleSave();
      return;
    }
    case 'survey': {
      if (!p || game.phase !== 'poster' || canMakePoster(p)) return;
      const price = Math.max(0, Math.min(200000, Math.round(+m.price || 0)));
      const quote = clampStr(m.quote, G.LIMITS.quote);
      const isNew = !game.poster.survey[p.id];
      game.poster.survey[p.id] = { price, quote, at: now() };
      send(c, { t: 'you', you: youState(p) });
      if (quote) fx({ kind: 'quote', by: p.id, quote, isNew }); else actHost(p.id, 'survey');
      stateDirty = true; scheduleSave();
      return;
    }
    case 'price': {
      if (!p || p.rank !== 'boss' || (game.phase !== 'poster' && game.phase !== 'gallery')) return;
      game.poster.officialPrice = Math.max(0, Math.min(200000, Math.round(+m.price || 0)));
      actHost(p.id, 'price', game.poster.officialPrice);
      stateDirty = true; scheduleSave();
      return;
    }
    case 'poster': {
      if (!p || game.phase !== 'poster' || !canMakePoster(p)) return;
      if (game.timeUp && !m.final) { send(c, { t: 'err', msg: '時間到了，海報已鎖定', code: 'locked' }); return; }
      if (game.timeUp && game.poster.posters[p.id] && game.poster.posters[p.id].submitted) return;
      const img = typeof m.img === 'string' ? m.img : '';
      if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > G.LIMITS.posterBytes * 1.4) { send(c, { t: 'err', msg: '海報圖片太大或格式錯誤' }); return; }
      const prev = game.poster.posters[p.id];
      game.poster.posters[p.id] = {
        img, name: clampStr(m.name, G.LIMITS.posterName), slogan: clampStr(m.slogan, G.LIMITS.posterSlogan),
        v: (prev ? prev.v : 0) + 1, submitted: !!m.final || !!(prev && prev.submitted), at: now()
      };
      send(c, { t: 'you', you: youState(p) });
      actHost(p.id, 'poster');
      if (m.final && !(prev && prev.submitted)) fx({ kind: 'posterDone', by: p.id });
      stateDirty = true; scheduleSave();
      return;
    }
    case 'gvote': {
      if (!p || game.phase !== 'gallery') return;
      const a = String(m.author || '');
      if (!game.poster.posters[a] || !game.poster.posters[a].img) return;
      if (a === p.id) { send(c, { t: 'err', msg: '不能投自己啦 😆' }); return; }
      game.gallery.votes[p.id] = a;
      send(c, { t: 'you', you: youState(p) });
      actHost(p.id, 'gvote');
      stateDirty = true; scheduleSave();
      return;
    }
    case 'gpick': {
      if (!p || p.rank !== 'boss' || game.phase !== 'gallery') return;
      const a = String(m.author || '');
      if (!game.poster.posters[a] || !game.poster.posters[a].img) return;
      game.gallery.bossPick = a;
      fx({ kind: 'gpick', author: a });
      broadcastState(true); scheduleSave();
      return;
    }
  }

  // ---- 主持人指令
  if (!c.host) return;
  switch (m.t) {
    case 'h.openLobby': {
      game.lobby.open = true;
      game.lobby.openAt = now() + 3000;
      fx({ kind: 'countdown', openAt: game.lobby.openAt });
      broadcastState(true); scheduleSave();
      return;
    }
    case 'h.closeLobby': { game.lobby.open = false; broadcastState(true); return; }
    case 'h.phase': { setPhase(m.phase); return; }
    case 'h.next': { const i = G.PHASE_IDS.indexOf(game.phase); if (i < G.PHASE_IDS.length - 1) setPhase(G.PHASE_IDS[i + 1]); return; }
    case 'h.prev': { const i = G.PHASE_IDS.indexOf(game.phase); if (i > 0) setPhase(G.PHASE_IDS[i - 1]); return; }
    case 'h.time': {
      const d = (+m.sec || 0) * 1000;
      if (game.pausedRemaining != null) game.pausedRemaining = Math.max(0, game.pausedRemaining + d);
      else if (game.phaseEndsAt) { game.phaseEndsAt = Math.max(now(), game.phaseEndsAt + d); if (game.phaseEndsAt > now()) game.timeUp = false; }
      else if (d > 0) { game.phaseEndsAt = now() + d; game.timeUp = false; }
      broadcastState(true); return;
    }
    case 'h.endNow': {
      if (game.pausedRemaining != null) game.pausedRemaining = null;
      game.phaseEndsAt = now();
      broadcastState(true); return;
    }
    case 'h.pause': {
      if (game.pausedRemaining != null) { game.phaseEndsAt = now() + game.pausedRemaining; game.pausedRemaining = null; }
      else if (game.phaseEndsAt && !game.timeUp) { game.pausedRemaining = Math.max(0, game.phaseEndsAt - now()); }
      broadcastState(true); return;
    }
    case 'h.settings': {
      for (const k of ['briefSec', 'buildSec', 'posterSec']) if (m[k] != null) game.settings[k] = Math.max(10, Math.min(1800, m[k] | 0));
      broadcastState(true); scheduleSave(); return;
    }
    case 'h.kick': {
      const q = game.players[m.id]; if (!q) return;
      q.kicked = true;
      for (const k of ['A', 'B']) for (const key in game.builds[k]) if (game.builds[k][key].by === q.id) { delete game.builds[k][key]; }
      for (const o of clients) if (o.player === q) { send(o, { t: 'kicked' }); o.player = null; }
      computeRoles();
      broadcast({ t: 'builds', builds: game.builds });
      broadcastState(true); scheduleSave(); return;
    }
    case 'h.rename': {
      const q = game.players[m.id]; if (!q) return;
      const n = clampStr(m.name, G.LIMITS.name); if (n) q.name = n;
      broadcastState(true); scheduleSave(); return;
    }
    case 'h.makeBoss': { send(c,{t:'err',msg:'董事長必須由三位董事互選，不能指定'}); return; }
    case 'h.clearBuild': {
      const team = m.team === 'B' ? 'B' : 'A';
      game.builds[team] = {};
      broadcast({ t: 'builds', builds: game.builds });
      broadcastState(true); scheduleSave(); return;
    }
    case 'h.fillPlayers':
    case 'h.bots': {
      const available=Math.max(0,50-activePlayers().length-bots.filter(b=>!b.c.player).length);
      const n=m.t==='h.fillPlayers'?available:Math.min(available,Math.max(1,m.n|0));
      addBots(n);
      if(n&&game.phase==='lobby'&&!game.lobby.open){game.lobby={open:true,openAt:now()+3000};fx({kind:'countdown',openAt:game.lobby.openAt});}
      send(c, { t:'toast',msg:n?`補入 ${n} 位測試同仁，將自動投票、走動與參與遊戲`:'已達 50 人（含報到中），不用再補人'});
      broadcastState(true);scheduleSave();
      return;
    }
    case 'h.removeBots': {
      removeBots();
      broadcast({ t: 'builds', builds: game.builds });
      broadcastState(true); scheduleSave(); return;
    }
    case 'h.reset': {
      bots.length = 0;
      game = freshGame();
      pendingOps={A:[],B:[],C:[]};
      for (const o of clients) o.player = null;
      broadcast({ t: 'reset' });
      broadcast({ t: 'builds', builds: game.builds });
      broadcastState(true); scheduleSave(); return;
    }
  }
}


// ---------------------------------------------------------------- 測試機器人（一個人也能看到滿場效果）
const bots = [];
const BOT_NAMES = '王小明 陳怡君 林志豪 張雅婷 李建宏 黃淑芬 吳俊傑 劉佳穎 蔡宗翰 楊惠雯 許家豪 鄭雅雯 謝承恩 郭芷若 洪詩涵 邱冠宇 曾柏翰 廖心怡 賴品妤 周子瑜 徐偉倫 葉欣怡 蘇志明 莊雅琪 呂冠廷 江佩珊 何承翰 羅郁婷 高俊宏 潘思妤 簡志偉 朱怡安 鍾家瑋 彭雅筑 游子軒 詹宜蓁 胡建志 施佩君 沈冠霖 余若瑄 盧柏宇 梁筱涵 趙文傑 顏欣妤 柯宇翔 翁雅惠 魏志遠 孫家萱 戴宇恆 范雅涵 方志成 石佳蓉 杜明哲 溫書瑜 侯建廷 薛雅慧 傅冠廷 康家瑜 姚志豪 蕭雨晴'.split(' ');
const BOT_QUOTES = ['坐上去就不想起來', '我阿嬤說讚', '金到我眼睛痛', '貓咪很愛', '可以放在會議室嗎', 'RGB 太加分', '比我家沙發舒服', '老闆買單我就買', '想送給主管', '這才是旗艦', '可以分期嗎', '拍照一定很好看'];
const BOT_POSTER = [['御座 Pro', '一坐就不想起來'], ['金馬桶 Max', '越金越有面子'], ['蹲王', '蹲著也要贏'], ['皇家寶座', '每天都是國王'], ['雲端坐墊', '坐上雲端的感覺'], ['宇宙第一座', 'NASA 都想要'], ['電競王座', '連勝不中斷'], ['安心座', '阿嬤一看就會用'], ['喵喵共享座', '人貓一起用'], ['奇蹟 0.5', '小套房也放得下']];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function addBots(n) {
  const used = new Set(activePlayers().map(p => p.name));
  let i = 0;
  for (let k = 0; k < n; k++) {
    let name;
    do { name = '🤖' + BOT_NAMES[(bots.length + i++) % BOT_NAMES.length] + (i > BOT_NAMES.length ? i : ''); } while (used.has(name) && i < 500);
    used.add(name);
    bots.push({ name, lazy: Math.random() < 0.22, c: { bot: true, open: true, player: null, host: false, bucket: 20, lastFill: now(), cd: {} }, joinAt: 0, done: {}, at: {} });
  }
}
function removeBots() {
  for (const p of Object.values(game.players)) {
    if (!p.bot || p.kicked) continue;
    p.kicked = true;
    delete game.review.votes[p.id];delete game.gallery.votes[p.id];delete game.poster.survey[p.id];delete game.poster.posters[p.id];
    for(const voter of Object.keys(game.gallery.votes))if(game.gallery.votes[voter]===p.id)delete game.gallery.votes[voter];
    if(game.gallery.bossPick===p.id)game.gallery.bossPick=null;
    for (const k of ['A', 'B']) {
      for (const key in game.builds[k]) if (game.builds[k][key].by === p.id) delete game.builds[k][key];
      pendingOps[k]=pendingOps[k].filter(op=>op[5]!==p.id);
    }
  }
  bots.length = 0;
  computeRoles();
}
function botSend(b, m) {
  try { onMessage(b.c, m); } catch (e) { /* ignore */ }
  if (!b.assisted && b.c.player && !b.c.player.bot) { b.c.player.bot = true; }
}
// 每個機器人在每一關只做一次的動作：在「開始後 a~b 秒」之間的隨機時間做
function botOnce(b, key, a, bSec, fn) {
  if (b.done[key]) return;
  if (b.at[key] == null) b.at[key] = (game.phaseStartedAt || now()) + rnd(a, bSec) * 1000;
  if (now() >= b.at[key]) { b.done[key] = true; fn(); }
}

function toiletPlan(team) {
  const cells = [], add = (x, y, z, col) => cells.push([x, y, z, col]);
  const W = 0, GOLD = 4, BLACK = 2, RGB = 12, GLASS = 11, SILVER = 5;
  const seat = team === 'A' ? GOLD : BLACK, accent = team === 'A' ? GOLD : RGB;
  for (let y = 0; y <= 2; y++) for (let x = 5; x <= 8; x++) for (let z = 4; z <= 8; z++) add(x, y, z, team === 'B' && y === 0 ? RGB : W);
  for (let x = 4; x <= 9; x++) for (let z = 2; z <= 9; z++) add(x, 3, z, W);
  for (let x = 4; x <= 9; x++) for (let z = 2; z <= 9; z++) if (x === 4 || x === 9 || z === 2 || z === 9) add(x, 4, z, W);
  for (let x = 4; x <= 9; x++) for (let z = 2; z <= 9; z++) if (x === 4 || x === 9 || z === 2 || z === 9) add(x, 5, z, seat);
  for (let y = 4; y <= (team === 'A' ? 9 : 10); y++) for (let x = 4; x <= 9; x++) for (let z = 10; z <= 11; z++) add(x, y, z, team === 'B' && y === 7 ? GLASS : W);
  add(6, team === 'A' ? 10 : 11, 11, accent); add(7, team === 'A' ? 10 : 11, 11, accent);
  if (team === 'A') { add(4, 10, 10, GOLD); add(9, 10, 10, GOLD); }
  else { for (let x = 4; x <= 9; x++) add(x, 6, 9, RGB); add(3, 3, 5, SILVER); add(10, 3, 5, SILVER); }
  return cells.sort((a, b) => a[1] - b[1]);
}
const botPlans = { A: null, B: null };
const lastVisit = { A: 0, B: 0 };

function botBuild() {
  if (!buildOpen()) return;
  const dur = Math.max(20, game.settings.buildSec);
  for (const team of ['A', 'B']) {
    const plan = botPlans[team] || (botPlans[team] = toiletPlan(team));
    const visited = lastVisit[team] && now() - lastVisit[team] < 20000;
    const crew = controllers().filter(b => b.c.player && !b.c.player.kicked && b.c.player.team === team && b.c.player.motion?.room===team && (!b.lazy || visited));
    if (!crew.length) continue;
    const b0 = game.builds[team];
    const perTick = Math.max(1, Math.ceil(plan.length / Math.max(8, (dur * 0.6) / 0.5)));
    let placed = 0;
    for (const cell of plan) {
      if (placed >= perTick) break;
      const [x, y, z, col] = cell;
      if (b0[cellKey(x, y, z)]) continue;
      if (y > 0 && ![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(d => b0[cellKey(x + d[0], y + d[1], z + d[2])])) continue;
      const own = {}; for (const k in b0) own[b0[k].by] = (own[b0[k].by] || 0) + 1;
      const who = crew.map(b => ({ b, left: (G.RANKS[b.c.player.rank] || {}).budget - (own[b.c.player.id] || 0) })).filter(o => o.left > 0).sort((a, b) => b.left - a.left)[0];
      if (!who) break;
      botSend(who.b, { t: 'place', x, y, z, c: col });
      placed++;
    }
  }
  // 主管與老闆的互動
  const elapsed = (now() - (game.phaseStartedAt || now())) / 1000;
  for (const b of controllers()) {
    const p = b.c.player; if (!p || p.kicked) continue;
    const team = p.team === 'B' ? 'B' : p.team === 'A' ? 'A' : pick(['A', 'B']);
    if ((p.rank === 'manager' || p.rank === 'lead') && Math.random() < 0.012) botSend(b, { t: 'sticker', team, pos: [rnd(-4, 4), rnd(3, 9), rnd(-4, 4)], text: pick(G.STICKERS) });
    if (p.rank === 'lead' && (p.team === 'A' || p.team === 'B') && elapsed > dur * 0.3 && !b.done.banner) { b.done.banner = true; botSend(b, { t: 'banner', text: pick(G.BANNERS) }); }
    if ((p.rank === 'manager' || p.rank === 'lead') && (p.team === 'A' || p.team === 'B') && elapsed > 15 && Math.random() < 0.004) {
      const keys = Object.keys(game.builds[p.team]).filter(k => game.builds[p.team][k].by !== p.id);
      const top = keys.filter(k => !game.builds[p.team][k.split(',').map((v, i) => i === 1 ? +v + 1 : v).join(',')]);
      const k = pick(top.length ? top : keys);
      if (k) { const [x, y, z] = k.split(',').map(Number); botSend(b, { t: 'remove', x, y, z }); }
    }
    if (p.rank === 'boss') {
      if (Math.random() < 0.01) botSend(b, { t: 'visit', team: pick(['A', 'B']) });
      if (Math.random() < 0.01) botSend(b, { t: 'sticker', team: pick(['A', 'B']), pos: [rnd(-3, 3), rnd(4, 9), rnd(-3, 3)], text: pick(G.BOSS_STICKERS) });
    }
    if (p.team === 'M' && Math.random() < 0.02) botSend(b, { t: 'react', team: pick(['A', 'B']), emoji: pick(G.REACTIONS) });
  }
}

const assistants=new Map();
function controllers(){return [...bots,...[...assistants.values()].filter(b=>b.c.player.aiControlled&&!b.c.player.kicked&&game.players[b.c.player.id]===b.c.player)];}
function botTick() {
  for(const [id,b] of assistants)if(!b.c.player.aiControlled||b.c.player.kicked||game.players[id]!==b.c.player)assistants.delete(id);
  for(const p of activePlayers())if(!p.bot&&p.aiControlled&&!assistants.has(p.id))assistants.set(p.id,{assisted:true,lazy:false,c:{bot:true,open:true,player:p,host:false,bucket:20,lastFill:now(),cd:{}},done:{},at:{}});
  if (!controllers().length) return;
  const ph = game.phase, t = now();
  for (const b of controllers()) {
    const p = b.c.player;
    if (!p) {
      // Human arrivals win any race against queued test players.
      if(activePlayers().length>=50){b.cancelled=true;continue;}
      if (ph === 'lobby') {
        if (game.lobby.open && t >= game.lobby.openAt) {
          if (!b.joinAt) b.joinAt = Math.max(t, game.lobby.openAt) + rnd(400, 5000);
          if (t >= b.joinAt) botSend(b, { t: 'join', name: b.name });
        }
      } else botSend(b, { t: 'join', name: b.name });
      continue;
    }
    if (p.kicked) continue;
    const board=game.board;
    if(!board.chair&&board.members.length===3&&board.members.includes(p.id)&&!board.votes[p.id]) {
      const ballot='board:'+board.round;
      if(!b.at[ballot])b.at[ballot]=t+1200+p.joinIdx*150;
      if(t>=b.at[ballot]) {
        const options=board.members.filter(id=>id!==p.id);
        const candidate=options.find(id=>!game.players[id].bot)||options[0];
        botSend(b,{t:'board.vote',candidate,round:board.round});
      }
    }
    // Bots use the same movement, work-presence and arcade rules as real players.
    const phaseKey=ph+':'+game.phaseStartedAt;
    if(b.movementPhase!==phaseKey){b.movementPhase=phaseKey;b.nextMove=0;}
    if(!p.motion?.destination&&t>=(b.nextMove||0)) {
      const rest=['lounge','arcade','garden','courtyard','pool','terrace','smoking','forest'];
      const work=sim.home(p);
      const visit=b.visits||0;b.visits=visit+1;
      const destination=p.indoorBanUntil>t?'pool':ph==='build'&&!b.lazy?work:ph==='review'||ph==='roles'&&p.rank==='board'?'board':p.rank==='boss'&&ph==='build'?'core':b.lazy?rest[(p.joinIdx+visit)%rest.length]:(p.joinIdx+visit)%3===0?rest[(p.joinIdx+visit)%rest.length]:work;
      if(p.motion?.room!==destination)botSend(b,{t:'office.move',room:destination});
      b.nextMove=t+rnd(22000,40000);
    }
    if(p.motion?.room==='lounge'){
      const r=game.recreation?.coffee,e=r?.entries[p.id];
      if(p.joinIdx%3===0){if(!p.dancing)botSend(b,{t:'dance'});}
      else if(!r||r.finished||!e)botSend(b,{t:'coffee.join'});
      else if(!e.forfeited&&t>=e.ready&&t>=r.starts)botSend(b,{t:'coffee.step',round:r.id,step:e.step});
    }
    if(p.motion?.room==='courtyard'&&t>=(b.nextKick||0)){const ball=game.recreation.football;botSend(b,{t:'office.move',room:'courtyard',x:ball.x,z:ball.z});b.nextKick=t+2200;}
    if(p.motion?.room==='pool'&&t>=(b.nextVolley||0)){const ball=game.campus.volley;botSend(b,{t:'office.move',room:'pool',x:ball.x,z:ball.z});botSend(b,{t:'sports.hit',game:'volley'});b.nextVolley=t+1300;}
    if(p.motion?.room==='arcade'&&p.joinIdx%2){
      const r=p.mini;
      if(!r||r.expires<t)botSend(b,{t:'mini.start',game:p.joinIdx%4===1?'darts':'pinball'});
      else botSend(b,{t:'mini.input',round:r.id,action:r.type==='darts'?'throw':t%1000<500?'left':'right'});
    }
    if(p.motion?.room==='arcade'&&p.joinIdx%2===0&&['lobby','roles','build','poster'].includes(ph)) {
      const r=p.leisure?.round;
      if(!r||r.expires<t)botSend(b,{t:'arcade.start',game:'pulse'});
      else if(t>=r.ready)botSend(b,{t:'arcade.hit',round:r.id,tile:Math.random()<.8?r.target:(r.target+1)%4});
    }
    const key = ph + ':' + game.gameId + ':' + game.phaseStartedAt;
    if (ph === 'brief' && p.rank === 'boss') botOnce(b, key, 4, 9, () => botSend(b, { t: 'brief', choice: Math.floor(Math.random() * G.BRIEFS.length) }));
    if (ph === 'review') {
      botOnce(b, key, 1, 10, () => {
        const ranked=['A','B','C'].sort((a,b)=>Object.keys(game.builds[b]).length-Object.keys(game.builds[a]).length);
        botSend(b, { t: 'vote', team: Math.random()<.6?ranked[0]:pick(ranked) });
      });
      if (p.rank === 'boss') botOnce(b, key + ':boss', 12, 18, () => botSend(b, { t: 'bossPick', team: ['A','B','C'].sort((a,b)=>Object.keys(game.builds[b]).length-Object.keys(game.builds[a]).length)[0] }));
    }
    if (ph === 'poster') {
      const span = Math.max(20, game.settings.posterSec);
      if (canMakePoster(p)) botOnce(b, key, span * 0.15, span * 0.6, () => { const [nm, sl] = pick(BOT_POSTER); botSend(b, { t: 'poster', img: botPosterImage(p.id), name: nm, slogan: sl, final: true }); });
      else if (p.rank === 'boss') botOnce(b, key, span * 0.3, span * 0.5, () => { const avg = publicState().poster.avgPrice || 30000; botSend(b, { t: 'price', price: Math.max(990, Math.round(avg / 1000) * 1000 - 10) }); });
      else botOnce(b, key, 2, Math.min(40, span * 0.5), () => botSend(b, { t: 'survey', price: Math.round(rnd(3, 60)) * 1000, quote: Math.random() < 0.6 ? pick(BOT_QUOTES) : '' }));
    }
    if (ph === 'gallery') {
      const list = Object.keys(game.poster.posters).filter(id => game.poster.posters[id].img && id !== p.id);
      if (list.length) {
        botOnce(b, key, 2, 12, () => botSend(b, { t: 'gvote', author: pick(list) }));
        if (p.rank === 'boss') botOnce(b, key + ':boss', 14, 20, () => { const tl = tallyGallery(); const best = list.slice().sort((x, y) => (tl[y] || 0) - (tl[x] || 0))[0]; botSend(b, { t: 'gpick', author: Math.random() < 0.6 ? best : pick(list) }); });
      }
    }
  }
  for(let i=bots.length-1;i>=0;i--)if(bots[i].cancelled)bots.splice(i,1);
  if (ph === 'build') botBuild(); else { botPlans.A = null; botPlans.B = null; }
}
// Persisted test players resume after a process restart instead of becoming inert.
for(const p of activePlayers().filter(p=>p.bot))bots.push({name:p.name,lazy:p.joinIdx%5===0,c:{bot:true,open:true,player:p,host:false,bucket:20,lastFill:now(),cd:{}},joinAt:0,done:{},at:{}});
setInterval(botTick, 500);

// 機器人的海報：用上市馬桶的正面像素圖產生一張 PNG
function botPosterImage(seedId) {
  const W = 300, H = 400, buf = Buffer.alloc(W * H * 3);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const seed = parseInt(String(seedId).slice(0, 6), 16) || 7;
  const pal = [['#fff4d6', '#f2c552', '#d6453b'], ['#1b0b3c', '#08243f', '#3df2ff'], ['#2c8584', '#163a40', '#e9c46a'], ['#ffe8ef', '#ffc5d5', '#9566ac'], ['#e6f3ff', '#79afe3', '#24484e'], ['#3d3322', '#0b0906', '#c9a24a']][seed % 6];
  const c1 = hex(pal[0]), c2 = hex(pal[1]), acc = hex(pal[2]);
  const set = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
  for (let y = 0; y < H; y++) { const t = y / H; const c = [0, 1, 2].map(k => Math.round(c1[k] * (1 - t) + c2[k] * t)); for (let x = 0; x < W; x++) set(x, y, c); }
  const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
  // 上下色帶
  rect(0, 0, W, 34, acc); rect(0, H - 70, W, 70, acc);
  for (let x = 0; x < W; x += 24) rect(x + (seed % 12), H - 62, 12, 6, c1);
  // 星星
  for (let k = 0; k < 14; k++) { const sx = (seed * (k + 3) * 37) % W, sy = 50 + (seed * (k + 7) * 53) % 230; rect(sx, sy, 4, 4, acc); }
  // 馬桶正面圖
  const team = game.review.winner || 'A', b = game.builds[team];
  const GX = G.GRID.x, GY = G.GRID.y, cell = 16, ox = Math.round((W - GX * cell) / 2), oy = 60;
  for (let x = 0; x < GX; x++) for (let y = 0; y < GY; y++) {
    let col = null;
    for (let z = 0; z < G.GRID.z; z++) { const k = cellKey(x, y, z); if (b[k]) { col = b[k].c; break; } }
    if (col == null) continue;
    const info = G.COLORS[col] || G.COLORS[0];
    let c = hex(info.hex);
    if (info.kind === 'rgb') c = hex(['#ff4d4d', '#ffcc33', '#33dd66', '#33ccff', '#9966ff'][x % 5]);
    const px = ox + x * cell, py = oy + (GY - 1 - y) * cell;
    rect(px, py, cell, cell, c.map(v => Math.round(v * 0.72)));
    rect(px + 1, py + 1, cell - 2, cell - 2, c);
    rect(px + 4, py + 2, cell - 8, 3, c.map(v => Math.min(255, v + 30)));
  }
  return 'data:image/png;base64,' + pngEncode(W, H, buf).toString('base64');
}
function pngEncode(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- HTTP
const embCache = {};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webm':'video/webm','.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);

  if (p.startsWith('/poster/')) {
    const id = p.slice(8).replace(/\.jpg$/, '');
    const pst = game.poster.posters[id];
    if (!pst || !pst.img) { res.writeHead(404); res.end(); return; }
    const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(pst.img);
    res.writeHead(200, { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000' });
    res.end(Buffer.from(m[2], 'base64'));
    return;
  }
  if (p.startsWith('/rt/')) { if (handleRealtime(req, res, u)) return; }
  if (p === '/api/results.zip') {
    if (u.searchParams.get('key') !== HOST_KEY) { res.writeHead(403); res.end('需要主持人密碼'); return; }
    const zip = makeZip(collectOutputs());
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="golden-toilet-results-${new Date().toISOString().slice(0, 10)}.zip"`, 'Cache-Control': 'no-store' });
    res.end(zip);
    return;
  }
  if (p === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(netInfo()));
    return;
  }
  if (p === '/' || p === '/play') p = '/index.html';
  if (p === '/host' || p === '/screen') p = '/host.html';
  if (EMB) {
    const b64 = Object.prototype.hasOwnProperty.call(EMB, p) ? EMB[p] : null;
    if (!b64) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('找不到頁面'); return; }
    const ext = path.extname(p);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': p.includes('three') ? 'public, max-age=86400' : 'no-cache' });
    res.end(embCache[p] || (embCache[p] = Buffer.from(b64, 'base64')));
    return;
  }
  const file = path.normalize(path.join(PUBLIC, p));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('找不到頁面'); return; }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.js' && p.includes('three') ? 'public, max-age=86400' : 'no-cache' });
    res.end(data);
  });
});
server.on('upgrade', (req, socket) => {
  if (req.url.startsWith('/ws')) wsAccept(req, socket); else socket.destroy();
});

function netInfo() {
  const ips = [];
  const ifs = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifs)) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      let score = 0;
      if (/^192\.168\./.test(a.address)) score += 3;
      if (/^10\./.test(a.address)) score += 3;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 2;
      if (/^169\.254\./.test(a.address)) score -= 5;
      if (/vEthernet|VirtualBox|VMware|Hyper-V|WSL|docker|vbox|utun|Loopback|Tailscale|ZeroTier|VPN|PANGP|GlobalProtect|Cisco|AnyConnect|Forti|Juniper|Pulse|WireGuard|Zscaler|TAP|Npcap|Bluetooth/i.test(name)) score -= 4;
      if (/Wi-?Fi|WLAN|Ethernet|乙太網路|en0|en1|eth0|wlan0/i.test(name)) score += 1;
      ips.push({ name, address: a.address, score });
    }
  }
  ips.sort((a, b) => b.score - a.score);
  return { ips, port: PORT, release: 'summit-2026.10.05', layout:G.LAYOUT,workSeats:G.DESKS.length };
}

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\n  ⚠ 埠 ${PORT} 已被占用。請關掉另一個遊戲視窗，或改用：node server.js ${PORT + 1}\n`);
  } else console.log('伺服器錯誤：', e.message);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const info = netInfo();
  const best = info.ips[0] ? info.ips[0].address : 'localhost';
  const line = '─'.repeat(56);
  console.log('\n' + line);
  console.log('  🚽  金馬桶專案｜部門連線小遊戲  已啟動');
  console.log(line);
  if (CLOUD) {
    console.log('  雲端模式：大螢幕請開 https://你的網址/host?key=（你設定的 HOST_KEY）');
    console.log(line + '\n');
    return;
  }
  console.log(`  大螢幕／主持人（在這台電腦開）：`);
  console.log(`     http://localhost:${PORT}/host?key=${HOST_KEY}`);
  console.log(`  同仁加入網址（或掃大螢幕上的 QR code）：`);
  for (const ip of info.ips.slice(0, 4)) console.log(`     http://${ip.address}:${PORT}      (${ip.name})`);
  if (!info.ips.length) console.log('     ⚠ 找不到區網 IP，請確認電腦已連上公司網路');
  console.log(`  主持人密碼：${HOST_KEY}`);
  console.log('  關閉遊戲：直接關掉這個視窗（進度會自動存檔）');
  console.log('  同仁連不上（逾時）？先對 firewall-allow.bat 按右鍵「以系統管理員身分執行」；');
  console.log('  公司網路若不允許電腦互連，請改用雲端版（見 README）。');
  console.log(line + '\n');
  if (!NO_BROWSER) {
    const url = `http://localhost:${PORT}/host?key=${HOST_KEY}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
  void best;
});

process.on('SIGINT', () => {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(game)); } catch (e) { /* ignore */ }
  process.exit(0);
});
