/* 金馬桶專案 — 辦公室實況（奶油陶瓷 × 玩具辦公室）
 * 等角 3D 小公司：可自由旋轉、平移、縮放，點人看狀態。
 * 每位玩家是一個小人，行為跟著他在遊戲裡的真實動作：
 * 認真工作、摸魚（休息室／廁所／滑手機）、生氣理論、老闆巡視、主管指點、全員集合。 */
(function () {
  'use strict';
  const G = window.GAME, T = window.THREE, esc = window.U.esc;
  const PI = Math.PI;

  // ---------------------------------------------------------------- 平面配置（公尺）
  const BLD = { x0: -17, x1: 17, z0: -11, z1: 12 };
  const ROOMS = {
    toilet:  { name: '廁所', sub: 'WC・躲起來', x0: -17, x1: -11, z0: -11, z1: -4.4, floor: 0xecf3eb, door: -14 },
    break:   { name: '休息室', sub: '咖啡・零食・八卦', x0: -11, x1: -2, z0: -11, z1: -4.4, floor: 0xead2b0, door: -6.5 },
    meeting: { name: '會議室', sub: '提案・決策', x0: -2, x1: 8, z0: -11, z1: -4.4, floor: 0xc8d9d6, door: 3 },
    boss:    { name: '董事長室', sub: '閒人勿進', x0: 8, x1: 17, z0: -11, z1: -4.4, floor: 0xe6c99c, door: 12.5 },
    hall:    { x0: -17, x1: 17, z0: -4.4, z1: -2.8, floor: 0xe9e5d7 },
    A:       { name: '第一研發部', sub: '方案 A', x0: -17, x1: -3.4, z0: -2.8, z1: 7.4, floor: 0xc3d9c9 },
    B:       { name: '第二研發部', sub: '方案 B', x0: -3.4, x1: 10.2, z0: -2.8, z1: 7.4, floor: 0xc6d6e3 },
    M:       { name: '行銷處', sub: '上市推廣', x0: 10.2, x1: 17, z0: -2.8, z1: 7.4, floor: 0xe3cede },
    lobby:   { name: '大廳', sub: '全員集合', x0: -17, x1: 17, z0: 7.4, z1: 12, floor: 0xf0e9d9 }
  };
  const COLS = { A: [-14.6, -12.2, -9.8, -7.4, -5.0], B: [-1.0, 1.4, 3.8, 6.2, 8.6], M: [11.6, 13.7, 15.8] };
  const ROWS = [0.2, 2.2, 4.2, 6.2];
  const LEAD_X = { A: -9.8, B: 3.8, M: 13.7 }, LEAD_Z = -1.75;
  const DOOR = { x0: 3, x1: 5.6 };
  const ENTRANCE = { x: 4.3, z: 16.1 };
  const VIEW = { x0: -18.8, x1: 18.8, z0: -12.1, z1: 15.9 };
  const C = {
    lawn: 0xb7c9b0, base: 0xcbbfaa, road: 0x839395, path: 0xf5e9d0, wall: 0xfff6e6, wallTop: 0xe5caa1, fence: 0xc3cbb7, post: 0xe4e3cf,
    trunk: 0x9a8360, leafA: 0x779c7e, leafB: 0x91ad87, pot: 0xc9b8a0, leaf: 0x6e9576,
    deskTop: 0xeac89d, deskLeg: 0x647e78, monitor: 0x293e47, chair: 0x4e8c85, chairLeg: 0x667774, wood: 0xcbac7d, darkWood: 0x6b4f38
  };
  const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const lerpAngle = (a, b, t) => { const d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * t; };

  // ---------------------------------------------------------------- 合併幾何（大幅減少繪製次數）
  const TPL = {
    box: new T.BoxGeometry(1, 1, 1).toNonIndexed(),
    cyl: new T.CylinderGeometry(.5, .5, 1, 16).toNonIndexed(),
    sph: new T.SphereGeometry(.5, 14, 10).toNonIndexed(),
    cone: new T.CylinderGeometry(.35, .5, 1, 16).toNonIndexed()
  };
  class Batch {
    constructor() { this.parts = []; }
    add(kind, x, y, z, sx, sy, sz, color, ry, rx, rz) { this.parts.push({ kind, x, y, z, sx, sy, sz, color, ry: ry || 0, rx: rx || 0, rz: rz || 0 }); return this; }
    // 以 (ox,oz) 為原點、旋轉 ry 的區域座標加入
    put(kind, ox, oz, ry, lx, ly, lz, sx, sy, sz, color, ex) {
      const c = Math.cos(ry), s = Math.sin(ry);
      return this.add(kind, ox + lx * c + lz * s, ly, oz - lx * s + lz * c, sx, sy, sz, color, ry + ((ex && ex.ry) || 0), ex && ex.rx, ex && ex.rz);
    }
    geometry() {
      let n = 0;
      for (const p of this.parts) n += TPL[p.kind].attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const m = new T.Matrix4(), nm = new T.Matrix3(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), c = new T.Color();
      let o = 0;
      for (const p of this.parts) {
        const g = TPL[p.kind], gp = g.attributes.position, gn = g.attributes.normal;
        q.setFromEuler(e.set(p.rx, p.ry, p.rz, 'YXZ'));
        m.compose(v.set(p.x, p.y, p.z), q, new T.Vector3(p.sx, p.sy, p.sz));
        nm.getNormalMatrix(m);
        c.set(p.color);
        for (let i = 0; i < gp.count; i++, o++) {
          v.fromBufferAttribute(gp, i).applyMatrix4(m); pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
          v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize(); nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z;
          col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      return geo;
    }
    mesh(material, shadow = true) { const me = new T.Mesh(this.geometry(), material); me.castShadow = shadow; me.receiveShadow = true; return me; }
  }

  // ---------------------------------------------------------------- 尋路格子（0.5m）
  const CELL = 0.5, GX0 = -18, GZ0 = -11.5, GW = 74, GH = 58;
  class Grid {
    constructor() { this.block = new Uint8Array(GW * GH); }
    idx(cx, cz) { return cz * GW + cx; }
    cx(x) { return Math.floor((x - GX0) / CELL); }
    cz(z) { return Math.floor((z - GZ0) / CELL); }
    wx(cx) { return GX0 + (cx + .5) * CELL; }
    wz(cz) { return GZ0 + (cz + .5) * CELL; }
    inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < GW && cz < GH; }
    free(cx, cz) { return this.inside(cx, cz) && !this.block[this.idx(cx, cz)]; }
    rect(x0, z0, x1, z1, pad = 0.16, val = 1) {
      const a = this.cx(Math.min(x0, x1) - pad), b = this.cx(Math.max(x0, x1) + pad - 1e-6);
      const c = this.cz(Math.min(z0, z1) - pad), d = this.cz(Math.max(z0, z1) + pad - 1e-6);
      for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) if (this.inside(x, z)) this.block[this.idx(x, z)] = val;
    }
    nearestFree(cx, cz) {
      if (this.free(cx, cz)) return [cx, cz];
      for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
      }
      return null;
    }
    los(x0, z0, x1, z1) {
      const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.2);
      for (let i = 1; i < n; i++) { const t = i / n; if (!this.free(this.cx(x0 + (x1 - x0) * t), this.cz(z0 + (z1 - z0) * t))) return false; }
      return true;
    }
    path(x0, z0, x1, z1) {
      const s = this.nearestFree(this.cx(x0), this.cz(z0)), e = this.nearestFree(this.cx(x1), this.cz(z1));
      if (!s || !e) return [[x1, z1]];
      const S = this.idx(s[0], s[1]), E = this.idx(e[0], e[1]);
      const g = new Float32Array(GW * GH).fill(Infinity), came = new Int32Array(GW * GH).fill(-1), closed = new Uint8Array(GW * GH);
      const heap = [];
      const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      const h = (cx, cz) => { const dx = Math.abs(cx - e[0]), dz = Math.abs(cz - e[1]); return Math.max(dx, dz) + .414 * Math.min(dx, dz); };
      g[S] = 0; push(S, h(s[0], s[1]));
      let found = false, guard = 0;
      while (heap.length && guard++ < 14000) {
        const [, i] = pop();
        if (closed[i]) continue;
        if (i === E) { found = true; break; }
        closed[i] = 1;
        const cx = i % GW, cz = (i / GW) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (!this.free(nx, nz)) continue;
          if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue;
          const j = this.idx(nx, nz), ng = g[i] + (dx && dz ? 1.414 : 1);
          if (ng < g[j]) { g[j] = ng; came[j] = i; push(j, ng + h(nx, nz)); }
        }
      }
      if (!found) return [[x1, z1]];
      const cells = [];
      for (let i = E; i !== -1; i = came[i]) cells.push(i);
      cells.reverse();
      const pts = cells.map(i => [this.wx(i % GW), this.wz((i / GW) | 0)]);
      const out = [];
      let cur = [x0, z0], k = 0;
      while (k < pts.length) {
        let far = k;
        for (let j = pts.length - 1; j > k; j--) if (this.los(cur[0], cur[1], pts[j][0], pts[j][1])) { far = j; break; }
        out.push(pts[far]); cur = pts[far]; k = far + 1;
      }
      out.push([x1, z1]);
      return out;
    }
  }

  // ---------------------------------------------------------------- 樣式
  const CSS = `
.of-root{position:absolute;inset:0;overflow:hidden;background:#dfe9de;user-select:none}
.of-root canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
.of-root canvas:active{cursor:grabbing}
.of-ui{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.of-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.of-room{position:absolute;left:0;top:0;background:#ffffffcf;border:1px solid #b9cdbd;color:#3b5c53;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;white-space:nowrap;text-align:center;line-height:1.3;box-shadow:0 2px 7px #2c44331c}
.of-room small{display:block;font-size:9px;font-weight:500;opacity:.8}
.of-room.A{color:#1f5f5e}.of-room.B{color:#2a5c94}.of-room.M{color:#71468a}
.of-card{position:absolute;left:0;top:0;background:#24484eef;color:#fffefa;border-radius:9px;padding:7px 12px;font-size:12px;line-height:1.4;max-width:250px;box-shadow:0 5px 18px #163c3426;white-space:normal;pointer-events:none}
.of-card b{display:block;font-size:11px;font-weight:600;opacity:.82;letter-spacing:.02em;white-space:nowrap}
.of-card.slack{background:#6e5413ee}
.of-card.angry,.of-card.evil{background:#9a3328f0}
.of-card.boss{background:linear-gradient(180deg,#f6d77b,#e3b24a);color:#3a2604}
.of-card.boss b{opacity:.75}
.of-card.shout{background:#5d3b74ef}
.of-card.talk{background:#24484eef}
.of-card.sel{outline:2px solid #efbd5d;outline-offset:2px}
.of-emo{position:absolute;left:0;top:0;font-size:20px;line-height:1;pointer-events:none;filter:drop-shadow(0 2px 3px #0003)}
.of-name{position:absolute;left:0;top:0;background:#fffefa;border:1px solid #bed0c1;color:#24484e;font-size:10px;line-height:1.25;padding:2px 6px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 7px #2c44331c;pointer-events:none}
.of-name small{display:block;font-size:9px;color:#5e7875}
.of-addr{position:absolute;left:14px;top:12px;background:#fffefaee;border-radius:10px;padding:9px 13px;box-shadow:0 4px 14px #1d38401f;font-size:12px;line-height:1.5;color:#24484e;pointer-events:none}
.of-addr b{font-size:13px;letter-spacing:.02em}
.of-addr .ph{color:#ad8036;font-weight:700}
.of-chips{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}
.of-chip{font-size:11px;padding:1px 8px;border-radius:999px;background:#edf2ee;font-weight:700}
.of-chip.w{color:#1f6b5f}.of-chip.s{color:#a06d10;background:#fbf0d4}.of-chip.a{color:#c4493d;background:#fbe3df}.of-chip.m{color:#5b6b7a}
.of-tools{position:absolute;right:14px;top:12px;display:flex;gap:7px;pointer-events:auto}
.of-tools button,.of-zoom button{font:inherit;font-size:12px;border:1px solid #d8e1dc;border-radius:8px;background:#fffefa;color:#24484e;padding:7px 11px;cursor:pointer;box-shadow:0 2px 8px #1d384014}
.of-tools button[aria-pressed=true]{background:#24484e;color:#fff;border-color:#24484e}
.of-zoom{position:absolute;right:14px;bottom:44px;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
.of-zoom button{width:34px;height:34px;padding:0;font-size:18px}
.of-hint{position:absolute;left:14px;bottom:12px;font-size:11px;color:#4e6962;background:#ffffffe0;padding:4px 8px;border-radius:5px}
.of-status{position:absolute;right:14px;bottom:12px;font-size:11px;color:#4e6962;background:#ffffffe0;padding:4px 8px;border-radius:5px}
.of-board{position:absolute;right:14px;top:56px;width:220px;background:#fffef8ee;border:1px solid #e2d6b3;border-radius:11px;padding:8px 10px;font-size:12px;box-shadow:0 6px 18px #1d384022;pointer-events:none}
.of-bt{font-weight:800;margin-bottom:3px;color:#24484e}
.of-br{display:flex;gap:6px;align-items:center;padding:1px 0}
.of-br span{width:15px;color:#a06d10;font-weight:800}
.of-br b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.of-br em{font-style:normal;color:#a06d10;font-variant-numeric:tabular-nums}
.of-br.muted{color:#6b7e82}
.of-king{margin-top:5px;padding-top:5px;border-top:1px dashed #e2d6b3;color:#7a4f9a}
.of-root.compact .of-addr{left:8px;top:6px;padding:5px 9px;font-size:11px}.of-root.compact .of-addr b{font-size:12px}
.of-root.compact .of-tools{right:8px;top:6px}.of-root.compact .of-tools button{padding:4px 8px;font-size:11px}
.of-root.compact .of-board{right:8px;top:40px;width:180px;font-size:11px;padding:5px 8px}
.of-root.compact .of-zoom{right:8px;bottom:8px}.of-root.compact .of-zoom button{width:28px;height:28px;font-size:15px}
.of-root.compact .of-hint,.of-root.compact .of-status{display:none}
.of-root.compact .of-card{font-size:11px;padding:4px 8px;max-width:200px}.of-root.compact .of-card b{font-size:10px}
.of-root.compact .of-room{font-size:10px;padding:2px 6px}.of-root.compact .of-room small{display:none}
.of-root.compact .of-emo{font-size:16px}

/* Warm ceramic UI, with the office itself kept as the visual focus. */
.of-root{background:#e8e9dc;font-family:var(--font);border-radius:0}
.of-addr{background:#fffdf4f2;border:1px solid #e5ddc6;border-left:4px solid #dcb361;box-shadow:0 5px 20px #25433d12;color:#25433d;padding:10px 14px;border-radius:3px 12px 12px 3px}
.of-addr b{font-size:15px;letter-spacing:.08em}
.of-addr b small{font-size:8px;letter-spacing:.12em;margin-left:8px;opacity:.6}
.of-addr .ph{font-size:10px;color:#847150}
.of-chip{background:#eff2e8;font-size:10px;padding:2px 7px}
.of-room{background:#fffdf0eb;border:0;box-shadow:0 3px 0 #25433d15,0 5px 12px #25433d0a;border-radius:5px;font-size:10px;padding:4px 9px;border-bottom:2px solid #bbbdad}
.of-room.A{border-color:#579a82}.of-room.B{border-color:#6595bd}.of-room.M{border-color:#b27f9f}
.of-room small{font-size:8px;letter-spacing:.02em}
.of-tools button,.of-zoom button{border-color:#dcdcc9;background:#fffbee;box-shadow:0 3px 0 #bbc4b24d;border-radius:7px;font-size:11px}
.of-card{border:2px solid #fff9ec;box-shadow:0 4px 0 #25433d25,0 8px 16px #25433d12;font-size:11px;max-width:220px;padding:7px 10px}
.of-card.slack{background:#937341}.of-card.angry,.of-card.evil{background:#b55b49}
.of-board{top:54px;width:182px;font-size:10px;border:1px solid #e2dac4;box-shadow:0 5px 18px #25433d0e;background:#fffdf0e8}
.of-hint{font-size:9px;bottom:9px;padding:4px 7px;background:#fffdf2d6}
.of-nav{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:5px;padding:5px;background:#fffbedee;border:1px solid #dddecb;border-radius:12px;pointer-events:auto;box-shadow:0 5px 20px #25433d18}
.of-nav button{font:inherit;font-size:10px;padding:5px 9px;white-space:nowrap;border:0;border-radius:7px;background:transparent;color:#395952;cursor:pointer}
.of-nav button:hover{background:#e6eee0}.of-nav button[aria-pressed=true]{background:#315c58;color:#fff}
.of-root.compact .of-addr{padding:5px 9px;max-width:260px}
.of-root.compact .of-chips{margin-top:3px;gap:3px}
.of-root.compact .of-nav{bottom:8px;padding:4px;gap:2px}
.of-root.compact .of-nav button{font-size:9px;padding:4px 7px}
@media(max-width:700px){.of-addr{max-width:190px}.of-addr b small{display:none}.of-chips{max-width:170px}.of-tools button{padding:5px 7px}.of-board{display:none!important}.of-hint{display:none}.of-nav{max-width:calc(100% - 70px);overflow-x:auto;justify-content:flex-start;left:12px;transform:none}.of-room{font-size:9px}.of-tools{right:8px;top:8px}}
`;
  let cssDone = false;
  function injectCSS() { if (cssDone) return; cssDone = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

  function signTexture(text, sub, fg, bg) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 192;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 72px "Microsoft JhengHei","PingFang TC",sans-serif'; x.fillText(text, 384, sub ? 78 : 96);
    if (sub) { x.globalAlpha = .75; x.font = '500 38px "Microsoft JhengHei","PingFang TC",sans-serif'; x.fillText(sub, 384, 146); }
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    return tx;
  }

  // ---------------------------------------------------------------- 辦公室
  class OfficeView {
    constructor(container) {
      injectCSS();
      this.el = container;
      this.root = document.createElement('div'); this.root.className = 'of-root';
      container.appendChild(this.root);
      this.agents = new Map();
      this.S = null;
      this.grid = new Grid();
      this.pools = {};
      this.used = new Map();
      this.showNames = false;
      this.follow = false;
      this.selected = null;
      this.yaw = 0.42; this.pitch = 0.95; this.zoom = 1; this.pan = new T.Vector3(0, 0, 0);
      this.look = new T.Vector3(0, 0, 2.5);
      this.phaseAt = Date.now();
      this.awardSlack = new Map();
      this.placements = new Map();

      const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      this.dpr = Math.min(1.6, window.devicePixelRatio || 1);
      r.setPixelRatio(this.dpr);
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      r.outputColorSpace = T.SRGBColorSpace;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      this.root.appendChild(r.domElement);

      this.ui = document.createElement('div'); this.ui.className = 'of-ui';
      this.ui.innerHTML = `<svg class="of-lines"></svg>
        <div class="of-addr"></div>
        <div class="of-tools"><button data-o="follow" aria-pressed="false">跟著董事長</button><button data-o="names" aria-pressed="false">人名</button><button data-o="home">全景</button></div>
        <div class="of-board" style="display:none"></div>
        <div class="of-zoom"><button data-o="in" aria-label="放大">+</button><button data-o="out" aria-label="縮小">−</button></div>
        <div class="of-nav" aria-label="公司區域"><button data-o="room-A">第一研發部</button><button data-o="room-B">第二研發部</button><button data-o="room-M">行銷處</button><button data-o="room-break">休息室</button><button data-o="room-boss">董事長室</button></div>
        <div class="of-hint">拖曳旋轉 · 右鍵平移 · 滾輪縮放 · 點人看狀態</div>
        <div class="of-status" style="display:none"></div>`;
      this.root.appendChild(this.ui);
      this.lines = this.ui.querySelector('.of-lines');
      this.addr = this.ui.querySelector('.of-addr');
      this.board = this.ui.querySelector('.of-board');
      this.statusEl = this.ui.querySelector('.of-status');
      this.ui.querySelector('.of-tools').addEventListener('click', e => this.onTool(e));
      this.ui.querySelector('.of-zoom').addEventListener('click', e => this.onTool(e));
      this.ui.querySelector('.of-nav').addEventListener('click', e => this.onTool(e));

      const sc = this.scene = new T.Scene();
      sc.background = new T.Color(0xe8e9dc);
      this.camera = new T.OrthographicCamera(-20, 20, 15, -15, .1, 200);
      sc.add(new T.HemisphereLight(0xfff5e3, 0x78958c, 2.2));
      const sun = this.sun = new T.DirectionalLight(0xffeed4, 2.8);
      sun.position.set(-12, 26, 14);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
      sun.shadow.normalBias = .04; sun.shadow.bias = -.0004;
      sc.add(sun);

      this.mats = {
        std: new T.MeshStandardMaterial({ vertexColors: true, roughness: .9 }),
        metal: new T.MeshStandardMaterial({ vertexColors: true, metalness: .72, roughness: .25, emissive: 0x6f4200, emissiveIntensity: .12 }),
        glow: new T.MeshBasicMaterial({ vertexColors: true }),
        glass: new T.MeshStandardMaterial({ color: 0x759ea3, roughness: .15, transparent: true, opacity: .55 }),
        person: new T.MeshStandardMaterial({ vertexColors: true, roughness: .7 })
      };
      this.ringMats = {};
      this.geoCache = new Map();

      this.labels = [];
      this.buildWorld();
      this.bindInput();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.root);
      this.resize();
      this.alive = true;
      this.lastT = performance.now();
      this.directorAt = 0;
      this.perf = { n: 0, t0: performance.now(), level: 0 };
      const loop = t => { if (!this.alive) return; requestAnimationFrame(loop); this.frame(t); };
      requestAnimationFrame(loop);
    }

    // ---------------- 建造場景
    spot(pool, x, z, face, pose, extra) {
      const list = (this.pools[pool] = this.pools[pool] || []);
      const s = Object.assign({ id: pool + ':' + list.length, pool, x, z, face, pose }, extra || {});
      list.push(s);
      return s;
    }
    block(x0, z0, x1, z1, pad) { this.grid.rect(x0, z0, x1, z1, pad); }

    buildWorld() {
      const S = new Batch(), M = new Batch(), L = new Batch();
      const sc = this.scene, g = this.grid;
      this.S_ = S;
      // 地面：草地、地基、馬路、步道
      S.add('box', 0, -.4, 3, 48, .3, 42, C.lawn);
      S.add('box', 0, -.135, .5, 35.2, .27, 24.2, C.base);
      S.add('box', 0, -.24, 18.2, 48, .04, 4.2, C.road);
      for (let x = -22; x < 23; x += 3.2) S.add('box', x, -.215, 18.2, 1.6, .012, .09, 0xddded0);
      S.add('box', 0, -.235, 15.4, 48, .05, 1.4, 0xd8d7c3);
      S.add('box', 4.3, -.2, 13.4, 2.8, .07, 2.8, C.path);
      S.add('box', 4.3, -.06, 12.25, 3.2, .12, .5, 0xe7dbc3);
      for (const [k, r] of Object.entries(ROOMS)) S.add('box', (r.x0 + r.x1) / 2, .012, (r.z0 + r.z1) / 2, r.x1 - r.x0 - .02, .024, r.z1 - r.z0 - .02, r.floor);
      // 地毯
      S.add('box', 12.5, .03, -7.7, 6.6, .012, 4.6, 0xb8473d);
      S.add('box', -6.5, .03, -7.2, 5.6, .012, 3.4, 0xe6c79b);

      // 牆（剖面矮牆）
      const WH = .62, WT = .2;
      const wall = (x0, z0, x1, z1, h = WH, t = WT) => {
        const w = Math.abs(x1 - x0) || t, d = Math.abs(z1 - z0) || t;
        S.add('box', (x0 + x1) / 2, h / 2, (z0 + z1) / 2, w, h, d, C.wall);
        S.add('box', (x0 + x1) / 2, h + .02, (z0 + z1) / 2, w + .02, .04, d + .02, C.wallTop);
        g.rect(Math.min(x0, x1) - (x0 === x1 ? t / 2 : 0), Math.min(z0, z1) - (z0 === z1 ? t / 2 : 0), Math.max(x0, x1) + (x0 === x1 ? t / 2 : 0), Math.max(z0, z1) + (z0 === z1 ? t / 2 : 0), .12);
      };
      wall(BLD.x0, BLD.z0, BLD.x1, BLD.z0, 2.45, .26);
      wall(BLD.x0, BLD.z0, BLD.x0, BLD.z1, WH, .26);
      wall(BLD.x1, BLD.z0, BLD.x1, BLD.z1, WH, .26);
      wall(BLD.x0, BLD.z1, DOOR.x0, BLD.z1, WH, .26);
      wall(DOOR.x1, BLD.z1, BLD.x1, BLD.z1, WH, .26);
      // 門框
      for (const x of [DOOR.x0 - .05, DOOR.x1 + .05]) S.add('box', x, 1.45, BLD.z1, .14, 2.9, .2, 0x8eaa9a);
      S.add('box', (DOOR.x0 + DOOR.x1) / 2, 2.9, BLD.z1, DOOR.x1 - DOOR.x0 + .3, .12, .22, 0x8eaa9a);
      // 窗（左右外牆與前牆）
      const glassMeshes = new Batch();
      const win = (x, z, w, d) => {
        glassMeshes.add('box', x, 1.25, z, w || .04, 1.1, d || .04, 0x759ea3);
        S.add('box', x, .7, z, (w || 0) + .12, .06, (d || 0) + .12, 0xe9eddf);
        S.add('box', x, 1.82, z, (w || 0) + .12, .06, (d || 0) + .12, 0xe9eddf);
      };
      for (const z of [-7.7, -.5, 3.5]) { win(BLD.x0, z, 0, 2.6); win(BLD.x1, z, 0, 2.6); }
      for (const x of [-12.5, -7, 9, 14]) win(x, BLD.z1, 2.6, 0);
      // 上排房間牆與門
      for (const k of ['toilet', 'break', 'meeting', 'boss']) {
        const r = ROOMS[k];
        if (r.x1 < BLD.x1) wall(r.x1, r.z0, r.x1, r.z1);
        wall(r.x0, r.z1, r.door - .95, r.z1);
        wall(r.door + .95, r.z1, r.x1, r.z1);
      }
      // 部門之間的矮隔板
      for (const x of [ROOMS.A.x1, ROOMS.B.x1]) { S.add('box', x, .35, 2.2, .1, .7, 8.4, 0xcfd9cf); g.rect(x - .05, -2, x + .05, 6.4, .1); }
      for (const t of ['A', 'B', 'M']) { const r = ROOMS[t]; S.add('box', (r.x0 + r.x1) / 2, .03, 7.35, r.x1 - r.x0 - .4, .02, .08, new T.Color(G.TEAMS[t].color).getHex()); }

      // ---- 戶外：圍牆、樹、車
      const fx0 = -20, fx1 = 20, fz0 = -13.4, fz1 = 14.7;
      S.add('box', fx0, .13, (fz0 + fz1) / 2, .22, .72, fz1 - fz0, C.fence);
      S.add('box', fx1, .13, (fz0 + fz1) / 2, .22, .72, fz1 - fz0, C.fence);
      S.add('box', 0, .13, fz0, fx1 - fx0, .72, .22, C.fence);
      S.add('box', (fx0 + DOOR.x0 - .6) / 2, .13, fz1, DOOR.x0 - .6 - fx0, .72, .22, C.fence);
      S.add('box', (DOOR.x1 + .6 + fx1) / 2, .13, fz1, fx1 - DOOR.x1 - .6, .72, .22, C.fence);
      for (let z = fz0; z <= fz1 + .01; z += 2.8) { S.add('box', fx0, .25, z, .36, .98, .36, C.post); S.add('box', fx1, .25, z, .36, .98, .36, C.post); }
      for (let x = fx0; x <= fx1 + .01; x += 2.8) { S.add('box', x, .25, fz0, .36, .98, .36, C.post); if (x < DOOR.x0 - 1 || x > DOOR.x1 + 1) S.add('box', x, .25, fz1, .36, .98, .36, C.post); }
      for (const x of [DOOR.x0 - .7, DOOR.x1 + .7]) S.add('box', x, .35, fz1, .4, 1.2, .42, 0xd8d2b9);
      const tree = (x, z, s = 1) => { S.add('cyl', x, .45 * s - .25, z, .3 * s, 1.4 * s, .3 * s, C.trunk); S.add('sph', x, 1.9 * s - .25, z, 2 * s, 2 * s, 2 * s, C.leafA); S.add('sph', x - .5 * s, 1.55 * s - .25, z + .35 * s, 1.44 * s, 1.44 * s, 1.44 * s, C.leafB); };
      [[-18.6, -12.2], [18.6, -12.2], [-18.6, -3], [18.7, -2.5], [-18.5, 6], [18.6, 7], [-12, 13.6], [12.5, 13.6], [-18.5, 13.5], [18.5, 13.5]].forEach(([x, z], i) => tree(x, z, i % 3 ? .9 : 1.05));
      // 水池與花
      S.add('box', 18.7, -.12, 2.2, 1.3, .16, 5.6, 0xb5c8bc); L.add('box', 18.7, -.03, 2.2, 1.05, .02, 5.3, 0x7db1b1);
      for (let x = -16; x < 2; x += 2.1) S.add('box', x, -.05, 13.4, .14, .45, .14, 0xe7cc8a);
      // 招牌
      const sign = new T.Mesh(new T.PlaneGeometry(3.6, .9), new T.MeshBasicMaterial({ map: signTexture('GOLDEN TOILET', '金馬桶公司', '#3b5c53', '#e9e2c9') }));
      sign.position.set(-1.8, .55, fz1 + .13); sc.add(sign);
      this.makeCar();

      // ---- 廁所
      const tr = ROOMS.toilet;
      [-16.1, -14.6, -13.1].forEach((sx, i) => {
        S.add('box', sx - .74, .65, -9.8, .06, 1.3, 2.4, 0xc9d9e2);
        if (i === 2) S.add('box', sx + .74, .65, -9.8, .06, 1.3, 2.4, 0xc9d9e2);
        S.add('box', sx - .5, .65, -8.62, .45, 1.3, .06, 0xc9d9e2);
        g.rect(sx - .78, -11, sx - .7, -8.6, .05); g.rect(sx - .74, -8.66, sx - .3, -8.58, .05);
        const gold = i === 1, B2 = gold ? M : S, col = gold ? 0xefb936 : 0xffffff;
        B2.add('cyl', sx, .18, -10.37, .30, .36, .38, col);
        B2.add('sph', sx, .40, -10.35, .60, .36, .70, col);
        B2.add('box', sx, .67, -10.69, .52, .62, .24, col);
        B2.add('sph', sx, .568, -10.28, .39, .025, .43, gold ? 0x9b681c : 0x91b8b0);
        this.spot('toilet', sx, -9.9, 0, 'hide', { label: '🚽 躲廁所' });
      });
      g.rect(-12.3, -11, -12.24, -8.6, .05);
      S.add('box', -16.65, .45, -6.5, .5, .9, 2.6, 0xeaeaea); g.rect(-16.9, -7.8, -16.4, -5.2, .05);
      glassMeshes.add('box', -16.84, 1.4, -6.5, .03, .7, 2.4, 0xbfd6e0);
      this.spot('toilet', -15.9, -7.3, -PI / 2, 'stand', { label: '🧼 洗手洗很久' });
      this.spot('toilet', -15.9, -5.8, -PI / 2, 'stand', { label: '🪞 照鏡子' });
      [[-12.6, -7.6], [-12.6, -6.7], [-12.6, -5.8], [-13.6, -6.2]].forEach(([x, z]) => this.spot('toilet', x, z, PI, 'stand', { label: '🧍 排廁所' }));
      this.wallSign('廁所', 'WC', -14, -10.86, 0xdbe8ee);

      // ---- 休息室
      S.add('box', -8.5, .38, -10.5, 4.2, .76, .6, 0xc86b4f); S.add('box', -8.5, .22, -9.9, 4.2, .44, .7, 0xd97b5d);
      g.rect(-10.6, -10.95, -6.4, -9.55, .05);
      [-9.9, -8.5, -7.1].forEach(x => this.spot('break', x, -9.4, 0, 'sit', { label: '🛋 躺沙發' }));
      S.add('box', -5.2, .55, -10.55, 1.1, 1.1, .7, 0x3a3f44); L.add('box', -5.2, 1.0, -10.19, .2, .16, .02, 0xff4d3d);
      g.rect(-5.75, -10.9, -4.65, -10.2, .05);
      this.spot('break', -5.2, -9.5, PI, 'stand', { label: '☕ 泡咖啡' });
      S.add('box', -3.6, .95, -10.5, 1.3, 1.9, .8, 0xd6453b); L.add('box', -3.6, 1.2, -10.09, .95, .95, .02, 0x9fd7ff);
      g.rect(-4.25, -10.9, -2.95, -10.1, .05);
      this.spot('break', -3.6, -9.4, PI, 'stand', { label: '🍫 買零食' });
      S.add('cyl', -6.5, .74, -6.9, 1.1, .06, 1.1, 0xf3ead8); S.add('cyl', -6.5, .37, -6.9, .14, .74, .14, 0x8b8f8a);
      g.rect(-7.05, -7.45, -5.95, -6.35, .05);
      [[-7.6, -6.9, PI / 2], [-5.4, -6.9, -PI / 2], [-6.5, -8, 0], [-6.5, -5.8, PI]].forEach(([x, z, f]) => { S.add('cyl', x, .22, z, .4, .44, .4, 0xe3a64a); this.spot('break', x, z, f, 'sit', { label: '🍪 吃點心', y: .02, low: true }); });
      [[-10.2, -6, PI / 2], [-9.2, -6, -PI / 2], [-3.2, -7, PI / 2], [-2.6, -5.6, PI], [-9.8, -7.8, PI / 4]].forEach(([x, z, f]) => this.spot('break', x, z, f, 'stand', { label: '💬 聊八卦' }));
      this.plant(-10.4, -10.4, .9, S); this.plant(-2.6, -4.9, .8, S);
      this.wallSign('休息室', 'BREAK', -6.5, -10.86, 0xf1e2c9);

      // ---- 會議室
      S.add('box', 3, .74, -7.7, 6.4, .1, 2.2, C.wood);
      for (const x of [.2, 5.8]) for (const z of [-8.5, -6.9]) S.add('box', x, .37, z, .12, .74, .12, 0x7a8d78);
      g.rect(-.2, -8.8, 6.2, -6.6, .05);
      S.add('box', 3, 1.5, -10.85, 4.6, 1.5, .08, 0x1e2b30);
      const screenMat = new T.MeshBasicMaterial({ color: 0x2f8f8b });
      this.meetScreen = new T.Mesh(new T.PlaneGeometry(4.3, 1.3), screenMat); this.meetScreen.position.set(3, 1.5, -10.8); sc.add(this.meetScreen);
      [.6, 1.8, 3, 4.2, 5.4].forEach(x => { this.chair(S, x, -9.15, 0); this.spot('meeting', x, -9.15, 0, 'sit'); });
      [.6, 1.8, 3, 4.2, 5.4].forEach(x => { this.chair(S, x, -6.25, PI); this.spot('meeting', x, -6.25, PI, 'sit'); });
      this.chair(S, 7, -7.7, -PI / 2, 0x2c3e46); this.meetHead = this.spot('meetingHead', 7, -7.7, -PI / 2, 'sit');
      this.chair(S, -1, -7.7, PI / 2); this.spot('meeting', -1, -7.7, PI / 2, 'sit');
      for (const p of [[1.5, -7.9], [3.4, -7.5], [4.8, -7.95]]) { S.add('box', p[0], .8, p[1], .55, .02, .4, 0xf6efcd); }
      this.plant(7.4, -10.4, .85, S); this.plant(-1.4, -10.4, .85, S);

      // ---- 董事長室
      S.add('box', 12.5, .39, -8.6, 3, .1, 1.3, 0x5a3b26); S.add('box', 12.5, .2, -8.6, 2.8, .4, 1.1, 0x5a3b26);
      g.rect(11, -9.25, 14, -7.95, .05);
      S.add('box', 12.9, 1.0, -8.85, .9, .5, .06, 0x1d2427); S.add('box', 12.9, .8, -8.85, .1, .2, .06, 0x1d2427);
      this.chair(S, 12.5, -9.75, 0, 0x2a1d17, true); this.bossChair = this.spot('bossChair', 12.5, -9.75, 0, 'sit');
      S.add('box', 9.4, 1.05, -10.7, 2.4, 2.1, .5, 0x7a5a3e); g.rect(8.2, -10.95, 10.6, -10.45, .05);
      [0xd6453b, 0x3977bc, 0xe9c46a, 0x297c7b, 0x9566ac, 0xd6453b].forEach((c, i) => S.add('box', 8.6 + i * .32, 1.45 + (i % 2) * .5, -10.43, .22, .42, .05, c));
      S.add('box', 15.8, .4, -10.3, 1, .8, 1, 0xf1ede2); g.rect(15.3, -10.8, 16.3, -9.8, .05);
      M.add('box', 15.8, 1.02, -10.3, .45, .45, .55, 0xefb936); M.add('box', 15.8, 1.35, -10.58, .45, .45, .15, 0xefb936);
      S.add('box', 16.4, .25, -6.6, .9, .5, 2.6, 0x3c2f2a); g.rect(15.9, -7.9, 16.9, -5.3, .05);
      [[11.8, -7.1, PI], [13.2, -7.1, PI]].forEach(([x, z, f]) => { this.chair(S, x, z, f, 0x6b5a4e); this.spot('bossGuest', x, z, f, 'sit'); });
      this.plant(16.4, -4.9, 1, S);
      this.wallSign('董事長室', 'CEO', 12.5, -10.86, 0xf2dcae);

      // ---- 工作區
      this.desks = { A: [], B: [], M: [] };
      for (const t of ['A', 'B', 'M']) {
        const glow = new T.Color(G.TEAMS[t].color).lerp(new T.Color(0xffffff), .45).getHex();
        for (const z of ROWS) for (const x of COLS[t]) {
          this.desk(S, L, x, z, 0, glow);
          this.desks[t].push(this.spot('desk' + t, x, z + .82, PI, 'sit', { desk: true }));
          this.spot('point' + t, x + 1.0, z + .55, -PI / 2, 'stand');
        }
        const lx = LEAD_X[t];
        this.desk(S, L, lx, LEAD_Z, PI, new T.Color(G.TEAMS[t].color).getHex(), true);
        this.spot('lead' + t, lx, LEAD_Z - .82, 0, 'sit');
        this.spot('front' + t, lx - 2.1, LEAD_Z - .1, 0, 'stand', { label: '📣' });
        this.spot('visit' + t, lx + 2.1, LEAD_Z - .1, 0, 'stand');
      }
      this.plant(-16.4, -2.2, .85, S); this.plant(-3.8, -2.2, .7, S); this.plant(9.8, -2.2, .7, S); this.plant(16.4, -2.2, .85, S);
      // 白板
      S.add('box', -16.85, 1.1, 3.2, .06, 1.1, 2.2, 0xfffae4); g.rect(-16.95, 2.1, -16.75, 4.3, .05);
      [0xedc46c, 0xa9c3ae, 0xa9c8d5, 0xedc46c].forEach((c, i) => S.add('box', -16.8, .95 + (i % 2) * .4, 2.6 + Math.floor(i / 2) * .7, .02, .28, .4, c));
      // 行銷處展示台
      S.add('box', 16.5, .45, 5.6, .7, .9, 1.6, 0xc0b9a1); g.rect(16.15, 4.8, 16.85, 6.4, .05);
      // 觀察位置（走廊）
      [-15.5, -13, -11, -8.6, -6.4, -4.2, -1.8, .6, 2.6, 5, 7.2, 9.2].forEach(x => this.spot('observe', x, -3.6, 0, 'stand', { label: '👀 觀察' }));

      // ---- 大廳
      S.add('box', -15.3, .15, 9.7, 3, .3, 4.2, 0xd8c9a7);
      S.add('box', -16.85, 1.75, 9.7, .1, 2, 3.4, 0x1e2b30);
      this.stageScreen = new T.Mesh(new T.PlaneGeometry(3.1, 1.75), new T.MeshBasicMaterial({ color: 0x2f8f8b }));
      this.stageScreen.position.set(-16.79, 1.75, 9.7); this.stageScreen.rotation.y = PI / 2; sc.add(this.stageScreen);
      this.stageSpot = this.spot('stage', -15.2, 9.7, PI / 2, 'stand', { y: .3 });
      S.add('box', 13.8, .48, 11.3, 2.8, .96, .7, C.deskTop); S.add('box', 13.8, .97, 11.3, 2.9, .04, .8, 0xe9dcc4);
      S.add('box', 13.8, 1.3, 11.62, 1.6, .45, .05, 0x24484e);
      g.rect(12.4, 10.95, 15.2, 11.65, .05);
      [[-6, 11.5], [0, 11.5]].forEach(([x, z]) => { S.add('box', x, .23, z, 2.4, .1, .55, 0x4c6e66); S.add('box', x, .12, z, 2.2, .24, .4, 0x7d8e83); g.rect(x - 1.2, z - .28, x + 1.2, z + .28, .05); });
      this.plant(11.8, 11.5, .9, S); this.plant(-13.2, 11.5, .9, S); this.plant(16.4, 8, .9, S);
      // 金馬桶獎座
      this.trophy = new T.Group();
      const tb = new Batch();
      tb.add('cyl',0,.10,0,1.15,.2,1.15,0x355c60).add('cyl',0,.33,0,.42,.4,.48,0xf5c757)
        .add('sph',0,.58,.08,.94,.47,1.02,0xf5c757).add('box',0,.90,-.34,.78,.82,.28,0xf5c757)
        .add('sph',0,.80,.15,.60,.035,.66,0xb8862b).add('box',.22,1.26,-.34,.15,.05,.12,0xffefb3);
      this.trophy.add(tb.mesh(this.mats.metal)); this.trophy.position.set(-15.9, .3, 8.4); this.trophy.visible = true; sc.add(this.trophy);
      // 集合位置：面向舞台
      for (let col = 0; col < 30; col++) {
        const x = -12.6 + col * 1.0;
        if (x > 11.2) break;
        [8.3, 9.3, 10.3].forEach((z, k) => this.spot('gather', x + (k % 2 ? .45 : 0), z, -PI / 2, 'stand'));
      }
      this.spot('entrance', ENTRANCE.x, ENTRANCE.z, PI, 'stand');
      // 戶外路徑可走，其餘戶外擋起來
      g.rect(-18, 12.15, DOOR.x0 - .2, 16.5, 0);
      g.rect(DOOR.x1 + .2, 12.15, 18.5, 16.5, 0);
      g.rect(DOOR.x0 - .2, 12.3, DOOR.x1 + .2, 16.5, 0, 0);

      this.addArtDetails(S, M, L);

      // 建立合併網格
      sc.add(S.mesh(this.mats.std));
      if (M.parts.length) sc.add(M.mesh(this.mats.metal));
      if (L.parts.length) sc.add(L.mesh(this.mats.glow, false));
      const gm = new T.Mesh(glassMeshes.geometry(), this.mats.glass); gm.castShadow = false; sc.add(gm);

      // 房間標籤
      for (const [k, r] of Object.entries(ROOMS)) {
        if (!r.name) continue;
        const el = document.createElement('div');
        el.className = 'of-room ' + (k === 'A' || k === 'B' || k === 'M' ? k : '');
        el.innerHTML = `${esc(r.name)}<small>${esc(r.sub || '')}</small>`;
        this.ui.appendChild(el);
        const pos = k === 'lobby' ? new T.Vector3(1, .3, 11.4) : (k === 'A' || k === 'B' || k === 'M') ? new T.Vector3((r.x0 + r.x1) / 2, .3, 7.0) : new T.Vector3((r.x0 + r.x1) / 2, .3, r.z1 - .9);
        this.labels.push({ el, pos });
      }
    }


    // All static details share the existing merged meshes and collision grid.
    addArtDetails(S, M, L) {
      const rooms = ROOMS;
      // Inlaid wood planks and a clean ceramic checkerboard.
      for (const key of ['break', 'boss', 'lobby', 'hall']) {
        const r = rooms[key];
        let row = 0;
        for (let z = r.z0 + .08; z < r.z1 - .1; z += .5, row++) {
          for (let x = r.x0 + .06 - (row % 2) * 1.25; x < r.x1 - .05; x += 2.5) {
            const left = Math.max(r.x0 + .05, x), right = Math.min(r.x1 - .05, x + 2.46);
            if (right - left < .02) continue;
            S.add('box', (left + right) / 2, .027, z + .22, right - left, .007, Math.min(.46, r.z1 - z - .02), [0xe4c9a3,0xecd4b0,0xf0ddbe][(row + Math.floor(x * 2 + 100)) % 3]);
          }
        }
      }
      const r = rooms.toilet;
      for (let z = r.z0 + .08, row = 0; z + .65 < r.z1; z += .7, row++) {
        for (let x = r.x0 + .1, col = 0; x + .65 < r.x1; x += .7, col++) {
          S.add('box', x + .32, .03, z + .32, .66, .008, .66, (row + col) % 2 ? 0xc0d9cd : 0xfffbeb);
        }
      }
      // Department carpets and stitched borders keep A/B/M legible at a glance.
      for (const [key, tint] of [['A',0x77a896],['B',0x85a9c5],['M',0xcaa0bc]]) {
        const d = rooms[key], cx = (d.x0 + d.x1) / 2;
        for (const z of [-2.55, 7.15]) S.add('box', cx, .04, z, d.x1 - d.x0 - .45, .012, .09, tint);
        for (const x of [d.x0 + .24, d.x1 - .24]) S.add('box', x, .04, 2.3, .07, .012, 9.65, tint);
        for (const z of [1.15,3.15,5.15]) S.add('box', cx, .028, z, d.x1 - d.x0 - .7, .006, .32, new T.Color(tint).lerp(new T.Color(d.floor), .78).getHex());
      }
      // Color-blocked back walls; fixtures sit in front of these panels.
      for (const [key, col] of [['toilet',0x79a797],['break',0xdba96d],['meeting',0x447b7d],['boss',0x35575c]]) {
        const d = rooms[key];
        S.add('box', (d.x0 + d.x1) / 2, 1.3, -10.82, d.x1 - d.x0 - .25, 2.1, .035, col);
        S.add('box', (d.x0 + d.x1) / 2, .16, -10.75, d.x1 - d.x0 - .25, .24, .08, C.wallTop);
      }
      // Cushions, coffee cups and lounge furniture.
      for (const x of [-9.9,-7.1]) S.add('sph', x, .64, -10.13, .64, .55, .21, x < -9 ? 0xf6d781 : 0x8caaa1);
      S.add('cyl', -6.6, .82, -6.9, .24, .12, .24, 0xfff6df);
      S.add('cyl', -6.6, .89, -6.9, .18, .008, .18, 0x70513c);
      S.add('box', -6.1, .795, -6.9, .4, .025, .35, 0xd69b63);
      // Artwork panels and a product-development board.
      const art = (x,y,z,w,h,title,sub,bg,fg) => {
        S.add('box', x,y,z-.018,w+.12,h+.12,.075,0xe8d2ad);
        const mesh = new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:signTexture(title,sub,fg,bg)}));
        mesh.position.set(x,y,z+.035); this.scene.add(mesh);
      };
      art(-8.5,1.72,-10.72,2.55,.62,'COFFEE FIRST','靈感補給站','#fff2d0','#86643e');
      art(12.5,1.72,-10.72,3.5,.74,'GOLDEN TOILET','一座馬桶的誕生','#35575c','#f8d27c');
      art(3,2.17,-10.72,3.5,.28,'MAKE IT HAPPEN','','#447b7d','#fff6de');
      // The marketing corner gets a magazine rack and bright creative supplies.
      for (let i=0;i<5;i++) {
        S.add('box',16.35,.98+i*.10,5.1+i*.21,.42,.09,.25,[0xf6d483,0xc588a7,0x7dadb1,0xfff5dd,0xa9bca0][i]);
      }
      // Entrance carpet and a clear reception identity.
      S.add('box',4.3,.035,11.02,2.5,.018,1.45,0x356962);
      for (const x of [3.2,5.4]) S.add('box',x,.05,11.02,.05,.01,1.22,0xf5d784);
      art(13.8,1.3,11.66,1.6,.42,'HELLO!','','#24484e','#f2ce7b');
      // Twin model blocks on the meeting table announce the two-proposal format.
      for (let i=0;i<3;i++) {
        S.add('box',2.35+(i%2)*.2,.86+Math.floor(i/2)*.16,-7.7,.18,.16,.22,0x72ac99);
        S.add('box',3.7+(i%2)*.2,.86+Math.floor(i/2)*.16,-7.7,.18,.16,.22,0x76a3c9);
      }
    }

    wallSign(text, sub, x, z, bg) {
      const m = new T.Mesh(new T.PlaneGeometry(2.4, .6), new T.MeshBasicMaterial({ map: signTexture(text, sub, '#47655c', '#fffdf4') }));
      m.position.set(x, 1.35, z); this.scene.add(m);
      void bg;
    }
    plant(x, z, s, B) {
      B.add('cyl', x, .21, z, .46 * s, .42, .34 * s, C.pot);
      B.add('cyl', x, .62, z, .09, .55, .09, 0x867755);
      for (let k = 0; k < 4; k++) B.add('sph', x + Math.sin(k * 2.2) * .19 * s, .82 + k * .08, z + Math.cos(k * 2.2) * .19 * s, .78 * s, .78 * s, .78 * s, C.leaf);
      this.grid.rect(x - .3 * s, z - .3 * s, x + .3 * s, z + .3 * s, .05);
    }
    chair(B, x, z, face, color, big) {
      const col = color || C.chair, ry = face;
      B.put('box', x, z, ry, 0, .46, 0, .52, .1, .5, col);
      B.put('box', x, z, ry, 0, big ? .95 : .74, -.24, .52, big ? .95 : .5, .08, col);
      B.put('cyl', x, z, ry, 0, .22, 0, .12, .42, .12, C.chairLeg);
      B.put('box', x, z, ry, 0, .035, 0, .62, .04, .06, C.chairLeg);
      B.put('box', x, z, ry, 0, .035, 0, .06, .04, .62, C.chairLeg);
    }
    desk(B, L, x, z, ry, glow, lead) {
      const w = lead ? 2.0 : 1.5, top = lead ? C.darkWood : C.deskTop;
      B.put('box', x, z, ry, 0, .74, 0, w, .07, .72, top);
      for (const dx of [-w / 2 + .08, w / 2 - .08]) for (const dz of [-.28, .28]) B.put('box', x, z, ry, dx, .37, dz, .06, .72, .06, C.deskLeg);
      B.put('box', x, z, ry, 0, 1.06, -.18, .64, .4, .05, C.monitor);
      B.put('box', x, z, ry, 0, .85, -.18, .08, .16, .06, 0x607675);
      L.put('box', x, z, ry, 0, 1.06, -.15, .57, .33, .012, glow);
      B.put('box', x, z, ry, 0, .79, .12, .46, .03, .16, 0x526662);
      B.put('box', x, z, ry, .36, .79, .14, .1, .03, .13, 0x748883);
      // Desk-scale accents are batched with the furniture.
      B.put('cyl', x, z, ry, -.53, .86, .1, .13, .16, .13, 0xfff8e6);
      B.put('cyl', x, z, ry, -.53, .943, .1, .09, .008, .09, 0x715846);
      B.put('box', x, z, ry, .56, .80, .10, .20, .04, .28, 0xf3d584);
      for (let row=0;row<3;row++) L.put('box',x,z,ry,-.08,1.14-row*.07,-.112,.3-row*.045,.022,.008,0xf3fff2);
      if (lead) B.put('box', x, z, ry, -.7, .84, .05, .18, .14, .14, 0xe9c46a);
      this.chair(B, x + Math.sin(ry) * .82, z + Math.cos(ry) * .82, ry + PI, lead ? 0x2c3e46 : C.chair);
      const hw = Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * .36, hd = Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * .36;
      this.grid.rect(x - hw, z - hd, x + hw, z + hd, .14);
    }
    makeCar() {
      const car = this.car = new T.Group();
      const B = new Batch();
      B.add('box', 0, .68, 0, 4.1, .68, 1.85, 0x3d5656).add('box', -.15, 1.28, 0, 2.35, .65, 1.65, 0x536c69);
      B.add('box', -.17, 1.3, -.84, 1.8, .45, .02, 0x8eb1b5).add('box', -.17, 1.3, .84, 1.8, .45, .02, 0x8eb1b5);
      for (const x of [-1.3, 1.3]) for (const z of [-.91, .91]) { B.add('cyl', x, .38, z, .72, .18, .72, 0x344541, 0, PI / 2); B.add('cyl', x, .38, z, .38, .185, .38, 0x91a3a0, 0, PI / 2); }
      for (const z of [-.65, .65]) B.add('box', 2.065, .83, z, .035, .18, .38, 0xf5eccb);
      B.add('box', 0, 1.62, 0, .5, .08, .5, 0xefb936);
      car.add(B.mesh(this.mats.std));
      car.position.set(-1.2, -.22, 17.6);
      this.carAnim = null;
      this.scene.add(car);
    }

    // ---------------- 小人
    partGeo(key, build) {
      if (!this.geoCache.has(key)) { const b = new Batch(); build(b); this.geoCache.set(key, b.geometry()); }
      return this.geoCache.get(key);
    }
    ringMat(color) { if (!this.ringMats[color]) this.ringMats[color] = new T.MeshBasicMaterial({ color }); return this.ringMats[color]; }
    makeAvatar(p) {
      const root = new T.Group();
      const seed = [...String(p.id)].reduce((a, c) => a + c.charCodeAt(0), 0);
      const skin = [0xf0c5a7, 0xe8bf9a, 0xd9a77e, 0xf6dcc4][seed % 4];
      const hair = [0x514b40, 0x665b49, 0x9d7954, 0x2b2420, 0x3b2f28][seed % 5];
      const team = p.team && G.TEAMS[p.team] ? new T.Color(G.TEAMS[p.team].color) : new T.Color(0x6b7e82);
      const shirt = p.rank === 'boss' ? 0x384c60 : team.clone().lerp(new T.Color(0xffffff), .12 + (seed % 3) * .06).getHex();
      const pants = p.rank === 'boss' ? 0x2a2b30 : [0x53635e, 0x4a5560, 0x5e5a52][seed % 3];
      const isBot = !!p.bot;
      const body = new T.Group(); root.add(body);
      const torso = new Batch();
      torso.add('cyl', 0, .92, 0, .45, .48, .30, shirt).add('cyl', 0, 1.19, 0, .24, .17, .24, skin);
      if (p.rank === 'boss') torso.add('box', 0, .93, .13, .07, .32, .014, 0xc7a15b);
      if (p.rank === 'lead') torso.add('box', 0, .93, .13, .07, .32, .014, 0xc4493d);
      if (p.rank === 'intern') torso.add('box', .1, 1.02, .13, .1, .12, .012, 0xfffefa);
      const tm = new T.Mesh(torso.geometry(), this.mats.person); tm.castShadow = true; body.add(tm);
      const headG = new T.Group(); headG.position.set(0, 1.27, 0); headG.scale.setScalar(1.28); body.add(headG);
      const hb = new Batch();
      hb.add('sph', 0, .15, 0, .46, .46, .46, skin);
      hb.add('sph', 0, .24, -.028, .47, .27, .47, hair);
      for (const x of [-.076, .076]) hb.add('sph', x, .16, .212, .046, .046, .046, 0x39483e);
      hb.add('box', 0, .065, .221, .095, .03, .024, 0xbb866b);
      for (const x of [-.145,.145]) hb.add('sph',x,.09,.197,.068,.04,.032,0xeab2a1);
      if (p.rank === 'manager') { hb.add('box', 0, .17, .225, .3, .05, .02, 0x1d1d1d); }
      if (isBot) { hb.add('cyl', .1, .45, -.02, .025, .2, .025, 0x8a9399).add('sph', .1, .56, -.02, .07, .07, .07, 0xff4d3d); }
      if (p.rank === 'boss') { hb.add('cyl', 0, .45, 0, .34, .12, .34, 0xffc93c); for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; hb.add('box', Math.sin(a) * .15, .54, Math.cos(a) * .15, .05, .09, .05, 0xffc93c); } }
      const hm = new T.Mesh(hb.geometry(), this.mats.person); hm.castShadow = true; headG.add(hm);
      const legGeoU = this.partGeo('lu' + pants, b => b.add('box', 0, -.15, 0, .145, .3, .16, pants));
      const legGeoL = this.partGeo('ll' + pants, b => b.add('box', 0, -.145, 0, .14, .29, .15, pants).add('box', 0, -.275, .06, .17, .09, .27, 0x3d4f49));
      const armGeoU = this.partGeo('au' + shirt, b => b.add('cyl', 0, -.13, 0, .16, .26, .16, shirt));
      const armGeoL = this.partGeo('al' + skin, b => b.add('cyl', 0, -.11, 0, .13, .24, .13, skin).add('sph', 0, -.24, 0, .14, .14, .14, skin));
      const legs = [], arms = [];
      for (const side of [-1, 1]) {
        const up = new T.Group(); up.position.set(side * .105, .69, 0); body.add(up);
        const um = new T.Mesh(legGeoU, this.mats.person); um.castShadow = true; up.add(um);
        const lo = new T.Group(); lo.position.y = -.3; up.add(lo);
        const lm = new T.Mesh(legGeoL, this.mats.person); lm.castShadow = true; lo.add(lm);
        legs.push({ upper: up, lower: lo });
        const au = new T.Group(); au.position.set(side * .245, 1.1, 0); body.add(au);
        const am = new T.Mesh(armGeoU, this.mats.person); am.castShadow = true; au.add(am);
        const fo = new T.Group(); fo.position.y = -.26; au.add(fo);
        const fm = new T.Mesh(armGeoL, this.mats.person); fm.castShadow = true; fo.add(fm);
        arms.push({ upper: au, lower: fo });
      }
      const ringColor = p.rank === 'boss' ? 0xd9a437 : team.getHex();
      const ring = new T.Mesh(this.ringGeo || (this.ringGeo = new T.TorusGeometry(.39, .028, 8, 28)), this.ringMat(ringColor));
      ring.rotation.x = -PI / 2; ring.position.y = .02; root.add(ring);
      root.traverse(m => { if (m.isMesh) m.userData.aid = p.id; });
      const beacon = new T.Mesh(this.beaconGeo || (this.beaconGeo = new T.OctahedronGeometry(.17)), this.ringMat(0xf9c761));
      beacon.position.y = 2.13; beacon.visible = false; root.add(beacon);
      root.userData = { body, headG, legs, arms, ring, beacon, hit: [tm, hm] };
      this.scene.add(root);
      return root;
    }

    spawn(p) {
      const g = this.makeAvatar(p);
      const card = document.createElement('div'); card.className = 'of-card'; card.style.display = 'none';
      const emo = document.createElement('div'); emo.className = 'of-emo'; emo.style.display = 'none';
      const nm = document.createElement('div'); nm.className = 'of-name'; nm.style.display = 'none';
      this.ui.appendChild(card); this.ui.appendChild(emo); this.ui.appendChild(nm);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', '#24484e'); line.setAttribute('stroke-opacity', '.55'); line.setAttribute('stroke-width', '1.2'); line.style.display = 'none';
      this.lines.appendChild(line);
      const t = Date.now();
      const lobby = this.S && this.S.phase === 'lobby';
      let start = lobby ? [ENTRANCE.x + (Math.random() - .5) * 1.5, ENTRANCE.z + .4] : this.initialPos(p);
      let hiddenUntil = 0;
      if (lobby && p.rank === 'boss' && !this.bossArrived) {
        this.bossArrived = true;
        this.carAnim = { t0: t, from: -27, to: 1.2 };
        start = [2.4, 16.6]; hiddenUntil = t + 2600;
      }
      g.position.set(start[0], 0, start[1]);
      const a = {
        id: p.id, p, g, card, emo, nm, line, x: start[0], z: start[1], face: PI, path: [], speed: 2.4,
        target: null, mode: 'idle', pose: 'stand', lastActive: 0, bubble: null, pulseUntil: 0, seat: 0,
        slackSince: null, slackTotal: 0, slackPlan: null, override: null, pretendUntil: 0, mood: null, surveyDone: false,
        step: Math.random() * 6, rank: p.rank, team: p.team, bot: p.bot, jitter: Math.random() * 15000, slackRank: 99, hiddenUntil
      };
      this.agents.set(p.id, a);
      return a;
    }
    initialPos(p) { const d = this.deskOf(p); return d ? [d.x, d.z] : [ENTRANCE.x, ENTRANCE.z]; }
    despawn(a) {
      this.release(a);
      this.scene.remove(a.g);
      a.card.remove(); a.emo.remove(); a.nm.remove(); a.line.remove();
      this.agents.delete(a.id);
      if (this.selected === a.id) this.selected = null;
    }

    // ---------------- 位置分配
    release(a) { if (a.held) { if (this.used.get(a.held.id) === a.id) this.used.delete(a.held.id); a.held = null; } }
    take(a, pool, prefer) {
      const list = this.pools[pool] || [];
      if (a.held && a.held.pool === pool) return a.held;
      const free = list.filter(s => !this.used.has(s.id) || this.used.get(s.id) === a.id);
      if (!free.length) return null;
      let s = free[0];
      if (prefer === 'random') s = free[Math.floor(Math.random() * free.length)];
      else if (typeof prefer === 'number') s = free[Math.min(prefer, free.length - 1)];
      this.release(a);
      this.used.set(s.id, a.id); a.held = s;
      return s;
    }
    assignDesks() {
      this.deskMap = new Map();
      if (!this.S) return;
      const order = { lead: 0, manager: 1, staff: 2, intern: 3 };
      for (const t of ['A', 'B', 'M']) {
        const mem = this.S.players.filter(p => p.team === t && p.rank !== 'boss').sort((a, b) => order[a.rank] - order[b.rank] || a.joinIdx - b.joinIdx);
        let i = 0;
        for (const p of mem) {
          if (p.rank === 'lead') { this.deskMap.set(p.id, this.pools['lead' + t][0]); continue; }
          const d = this.desks[t][i++];
          this.deskMap.set(p.id, d || this.pools['point' + t][(i - 1) % this.pools['point' + t].length]);
        }
      }
      const boss = this.S.players.find(p => p.rank === 'boss');
      if (boss) this.deskMap.set(boss.id, this.bossChair);
    }
    deskOf(p) { return this.deskMap ? this.deskMap.get(p.id) : null; }

    // ---------------- 遊戲事件
    setState(S) {
      const prev = this.S;
      this.S = S;
      if (!prev || prev.phase !== S.phase) { this.phaseAt = Date.now(); this.onPhase(prev && prev.phase, S.phase); }
      if (prev && prev.gameId !== S.gameId) { this.bossArrived = false; this.awardSlack.clear(); }
      const rosterKey = S.players.map(p => p.id + p.rank + p.team).join('|');
      if (rosterKey !== this.rosterKey) { this.rosterKey = rosterKey; this.assignDesks(); }
      const ids = new Set(S.players.map(p => p.id));
      for (const p of S.players) {
        let a = this.agents.get(p.id);
        if (!a) a = this.spawn(p);
        else if (a.rank !== p.rank || a.team !== p.team) {
          this.scene.remove(a.g); a.g = this.makeAvatar(p); a.g.position.set(a.x, 0, a.z); a.rank = p.rank; a.team = p.team; a.targetKey = null;
        }
        a.p = p;
      }
      for (const a of [...this.agents.values()]) if (!ids.has(a.id)) this.despawn(a);
      this.trophy.visible = true;
      this.trophy.scale.setScalar(S.phase === 'launch' ? 1.25 : 1);
      const off = S.phase === 'launch' && S.launch && S.launch.official ? S.launch.official : (S.phase === 'gallery' && S.gallery.bossPick) || null;
      if (off !== this.screenPoster) {
        this.screenPoster = off;
        if (off) {
          const v = (S.poster.posters.find(q => q.author === off) || {}).v || 0;
          new T.TextureLoader().load('/poster/' + off + '.jpg?v=' + v, tex => {
            tex.colorSpace = T.SRGBColorSpace;
            this.stageScreen.material = new T.MeshBasicMaterial({ map: tex }); this.stageScreen.scale.set(.42, 1, 1);
            this.meetScreen.material = this.stageScreen.material; this.meetScreen.scale.set(.25, 1, 1);
          });
        } else {
          this.stageScreen.material = new T.MeshBasicMaterial({ color: 0x2f8f8b }); this.stageScreen.scale.set(1, 1, 1);
          this.meetScreen.material = this.stageScreen.material; this.meetScreen.scale.set(1, 1, 1);
        }
      }
    }
    onPhase(prev, ph) {
      const t = Date.now();
      for (const a of this.agents.values()) {
        this.endSlack(a, t);
        a.slackPlan = null; a.override = null; a.pretendUntil = 0;
        if (ph === 'poster') a.surveyDone = false;
        if (ph === 'roles' && Math.random() < .5) this.say(a, '📜', 2500, 'emoji');
        if (ph === 'launch') a.mood = { type: 'party', until: t + 9000 };
      }
      if (ph === 'lobby') { this.awardSlack.clear(); this.bossArrived = false; }
    }
    say(a, text, ms, cls) { if (a) a.bubble = { text, until: Date.now() + (ms || 3000), cls: cls || '' }; }
    active(id) { const a = this.agents.get(id); if (a) a.lastActive = Date.now(); return a; }

    onOps(team, ops) {
      const t = Date.now();
      for (const o of ops) {
        if (o[0] === 1) { const a = this.active(o[5]); if (a) a.pulseUntil = t + 700; }
        else if (o[4]) {
          const a = this.active(o[4]);
          const victim = o[5] && o[5] !== o[4] ? this.agents.get(o[5]) : null;
          if (a && victim) {
            this.say(a, '😈 拆掉！', 3500, 'evil'); a.mood = { type: 'evil', until: t + 5000 };
            if (!victim.override || victim.override.kind !== 'argue') {
              this.say(victim, '💢 誰拆我的積木！', 6000, 'angry');
              victim.mood = { type: 'angry', until: t + 7000 };
              victim.override = { kind: 'argue', until: t + 7000, near: a.id };
            }
          }
        }
      }
    }
    onFx(f) {
      const t = Date.now();
      const by = f.by ? this.agents.get(f.by) : null;
      const bossA = () => [...this.agents.values()].find(a => a.p.rank === 'boss');
      switch (f.kind) {
        case 'sticker':
          if (!by) return;
          by.lastActive = t;
          this.say(by, f.text, 5500, by.p.rank === 'boss' ? 'boss' : 'talk');
          if (by.p.rank !== 'boss' && this.S && this.S.phase === 'build') {
            const mates = [...this.agents.values()].filter(x => x.p.team === f.team && x.p.rank !== 'lead' && x.p.rank !== 'boss' && x !== by);
            const victim = mates[Math.floor(Math.random() * mates.length)];
            if (victim) { by.override = { kind: 'point', until: t + 7000, at: victim.id }; setTimeout(() => this.say(victim, Math.random() < .5 ? '😑' : '🙄', 2500, 'emoji'), 1500); }
          }
          return;
        case 'banner':
          if (!by) return;
          by.lastActive = t;
          this.say(by, '📣 ' + f.text, 7000, 'shout');
          by.override = { kind: 'front', until: t + 8000, team: f.team };
          for (const a of this.agents.values()) if (a.p.team === f.team && a !== by && Math.random() < .5) this.say(a, pick(['😩', '😵', '🤦']), 2600, 'emoji');
          return;
        case 'visit': {
          const boss = bossA();
          if (boss) { this.say(boss, '👀 巡視中，大家辛苦了', 6000, 'boss'); boss.override = { kind: 'visit', until: t + 10000, team: f.team }; }
          for (const a of this.agents.values()) {
            if (a.p.team !== f.team || a.p.rank === 'boss') continue;
            if (a.mode === 'slack') { a.pretendUntil = t + 15000; this.say(a, '😱 老闆來了！', 2500, 'angry'); }
            else if (Math.random() < .5) this.say(a, '😰', 2000, 'emoji');
          }
          return;
        }
        case 'react': if (by) { by.lastActive = t; this.say(by, f.emoji, 2500, 'emoji'); } return;
        case 'quote': if (by) { by.lastActive = t; by.surveyDone = true; this.say(by, '「' + f.quote + '」', 5000, 'talk'); } return;
        case 'posterDone': if (by) { by.lastActive = t; this.say(by, '🎨 海報交件！', 4000, 'talk'); } return;
        case 'brief': { const b = bossA(); if (b) this.say(b, '就賣給' + G.BRIEFS[f.choice].name + '！', 4500, 'boss'); return; }
        case 'bossPick': {
          const b = bossA();
          if (b) this.say(b, '就決定是方案 ' + f.team + '！', 4500, 'boss');
          const tl = this.S ? this.S.review.tally : { A: 0, B: 0 };
          const against = tl[f.team === 'A' ? 'B' : 'A'] > tl[f.team];
          for (const a of this.agents.values()) {
            if (a.p.team === f.team) { a.mood = { type: 'party', until: t + 6000 }; if (Math.random() < .5) this.say(a, '🎉', 3000, 'emoji'); }
            else if (a.p.team === 'A' || a.p.team === 'B') { a.mood = { type: 'angry', until: t + 4000 }; if (Math.random() < .35) this.say(a, against ? '💢 無視民意？！' : '😭', 3500, against ? 'angry' : 'emoji'); }
          }
          return;
        }
        case 'gpick': { const a = this.agents.get(f.author); if (a) { a.mood = { type: 'party', until: t + 6000 }; this.say(a, '🎉 我的海報上了！', 5000, 'talk'); } return; }
        case 'timeup': for (const a of this.agents.values()) if (Math.random() < .4) this.say(a, '⏰', 1600, 'emoji'); return;
      }
    }
    onAct(m) {
      const a = this.active(m.id); if (!a) return;
      const t = Date.now();
      switch (m.k) {
        case 'vote': this.say(a, '🗳️', 1600, 'emoji'); break;
        case 'gvote': this.say(a, '❤️', 1600, 'emoji'); break;
        case 'survey': a.surveyDone = true; if (!a.bubble || a.bubble.until < t) this.say(a, '📝', 1800, 'emoji'); break;
        case 'price': this.say(a, '💰 就賣 ' + U.money(m.x) + '！', 4500, 'boss'); break;
        case 'poster': if (Math.random() < .25) this.say(a, '🎨', 1400, 'emoji'); break;
        case 'err': a.mood = { type: 'angry', until: t + 3500 }; this.say(a, m.x === 'budget' ? '😤 積木用完了！' : '😤 不能拆別人的？！', 3500, 'angry'); break;
      }
    }

    // ---------------- 決定每個人該在哪裡
    decide(a, t) {
      const S = this.S, p = a.p, ph = S.phase;
      const desk = this.deskOf(p);
      if (a.override && t < a.override.until) {
        const o = a.override;
        if (o.kind === 'argue') { const b = this.agents.get(o.near); if (b) return { key: 'argue:' + b.id + ':' + Math.round(b.x) + ':' + Math.round(b.z), x: b.x + .8, z: b.z + .3, face: -PI / 2, pose: 'stand', mode: 'angry', run: true }; }
        if (o.kind === 'point') { const b = this.agents.get(o.at); const d = b && this.deskOf(b.p); if (d) return { key: 'point:' + d.id, x: d.x + 1.0, z: d.z - .25, face: -PI / 2, pose: 'stand', mode: 'boss' }; }
        if (o.kind === 'front') { const s = this.pools['front' + o.team][0]; return { key: s.id, spot: s, mode: 'boss' }; }
        if (o.kind === 'visit') { const s = this.pools['visit' + o.team][0]; return { key: s.id, spot: s, mode: 'boss' }; }
      }
      a.override = a.override && t < a.override.until ? a.override : null;
      if (!S.rolesPublished || ph === 'lobby') {
        const i = [...S.players].sort((x, y) => x.joinIdx - y.joinIdx).findIndex(x => x.id === p.id);
        if (i === 0) return { key: 'stage', spot: this.stageSpot, mode: 'meet', run: true };
        const s = this.pools.gather[Math.max(0, i - 1)] || this.pools.gather[0];
        return { key: s.id, spot: s, mode: 'meet', run: true };
      }
      if (!p.online && !p.bot) return { key: 'off:' + (desk ? desk.id : 'x'), spot: desk || this.pools.entrance[0], mode: 'offline' };
      if (ph === 'review' || ph === 'gallery' || ph === 'launch') {
        if (p.rank === 'boss') return { key: 'stage', spot: this.stageSpot, mode: 'meet' };
        const order = [...S.players].filter(x => x.rank !== 'boss').sort((x, y) => (x.rank === 'lead' ? 0 : 1) - (y.rank === 'lead' ? 0 : 1) || x.joinIdx - y.joinIdx);
        const i = order.findIndex(x => x.id === p.id);
        const s = this.pools.gather[i % this.pools.gather.length];
        return { key: s.id, spot: s, mode: a.mood && a.mood.type === 'party' && a.mood.until > t ? 'party' : 'meet' };
      }
      if (ph === 'roles') return { key: 'desk:' + (desk && desk.id), spot: desk, mode: 'idle' };
      if (ph === 'brief') {
        if (p.rank === 'boss') return { key: 'mh', spot: this.meetHead, mode: 'meet' };
        if (p.rank === 'lead') { const s = this.take(a, 'meeting', ['A', 'B', 'M'].indexOf(p.team) * 2); return { key: s.id, spot: s, mode: 'meet', held: true }; }
        return { key: 'desk:' + (desk && desk.id), spot: desk, mode: 'idle' };
      }
      if (p.rank === 'boss') return { key: 'bossChair', spot: this.bossChair, mode: 'boss' };
      let expected = false, threshold = 25000, restOK = false;
      if (ph === 'build') {
        if (p.team === 'M') {
          const win = Math.floor((t - this.phaseAt) / 20000);
          const list = this.pools.observe;
          const s = list[(win + (p.joinIdx || 0)) % list.length];
          return { key: s.id + ':' + win, spot: s, mode: 'observe', jitter: true };
        }
        expected = true;
      } else if (ph === 'poster') {
        const maker = S.poster.makers.includes(p.id);
        if (maker) { expected = true; threshold = 35000; } else if (!a.surveyDone) { expected = true; threshold = 35000; } else restOK = true;
      }
      if (restOK) { const s = this.take(a, 'break', 'random') || this.take(a, 'gather', 'random'); return { key: 'rest:' + (s && s.id), spot: s, mode: 'rest', held: true }; }
      if (!expected) return { key: 'desk:' + (desk && desk.id), spot: desk, mode: 'idle' };
      if (t < a.pretendUntil) return { key: 'desk:' + (desk && desk.id), spot: desk, mode: 'pretend', run: true };
      const idle = t - Math.max(a.lastActive, this.phaseAt);
      if (idle < threshold + a.jitter) return { key: 'desk:' + (desk && desk.id), spot: desk, mode: idle < 9000 ? 'work' : 'idle', run: a.mode === 'slack' };
      if (!a.slackPlan) { const r = Math.random(); a.slackPlan = r < .42 ? 'break' : r < .72 ? 'toilet' : 'phone'; }
      if (a.slackPlan === 'phone') return { key: 'desk:' + (desk && desk.id) + ':phone', spot: desk, mode: 'slack', label: '📱 滑手機' };
      const s = this.take(a, a.slackPlan, 'random') || this.take(a, 'break', 'random');
      if (!s) return { key: 'desk:' + (desk && desk.id) + ':phone', spot: desk, mode: 'slack', label: '📱 滑手機' };
      return { key: 'slack:' + s.id, spot: s, mode: 'slack', label: s.label || '☕ 摸魚', held: true };
    }
    endSlack(a, t) {
      if (a.slackSince != null) {
        const d = t - a.slackSince;
        a.slackTotal += d;
        this.awardSlack.set(a.id, (this.awardSlack.get(a.id) || 0) + d);
        a.slackSince = null;
      }
    }
    director() {
      if (!this.S) return;
      const t = Date.now();
      for (const a of this.agents.values()) {
        if (t < a.hiddenUntil) continue;
        const w = this.decide(a, t);
        if (!w || (!w.spot && w.x == null)) continue;
        if (!w.held && a.held && (!w.spot || w.spot.id !== a.held.id)) this.release(a);
        const prev = a.mode;
        if (w.mode !== 'slack' && prev === 'slack') { this.endSlack(a, t); a.slackPlan = null; if (w.mode === 'pretend') this.say(a, '😅 我在忙！', 2000, 'talk'); }
        if (w.mode === 'slack' && prev !== 'slack') a.slackSince = t;
        a.mode = w.mode; a.label = w.label || (w.spot && w.spot.label) || null;
        if (w.key !== a.targetKey) {
          a.targetKey = w.key;
          const tx = w.spot ? w.spot.x : w.x, tz = w.spot ? w.spot.z : w.z;
          const j = w.jitter ? [(Math.random() - .5) * .6, (Math.random() - .5) * .3] : [0, 0];
          a.target = { x: tx + j[0], z: tz + j[1], face: w.spot ? w.spot.face : w.face, pose: w.spot ? w.spot.pose : w.pose, y: (w.spot && w.spot.y) || 0, low: w.spot && w.spot.low };
          a.path = this.grid.path(a.x, a.z, a.target.x, a.target.z);
          const far = Math.hypot(a.target.x - a.x, a.target.z - a.z) > 14;
          a.speed = w.run ? 4.6 : far ? 3.6 : 2.3;
        }
      }
    }

    // ---------------- 互動：旋轉、平移、縮放、點選
    onTool(e) {
      const b = e.target.closest('button'); if (!b) return;
      const o = b.dataset.o;
      const room = o && o.startsWith('room-') ? ROOMS[o.slice(5)] : null;
      if (room) {
        this.follow = false; this.selected = null; this.zoom = 2.15;
        this.pan.set((room.x0+room.x1)/2,0,(room.z0+room.z1)/2-2.6);
        this.ui.querySelector('[data-o=follow]').setAttribute('aria-pressed','false');
      }
      this.ui.querySelectorAll('.of-nav button').forEach(button => button.setAttribute('aria-pressed',String(button === b && !!room)));
      if (o === 'names') { this.showNames = !this.showNames; b.setAttribute('aria-pressed', String(this.showNames)); }
      if (o === 'follow') { this.follow = !this.follow; b.setAttribute('aria-pressed', String(this.follow)); if (this.follow) this.zoom = Math.max(this.zoom, 2.3); else this.zoom = 1; this.pan.set(0, 0, 0); }
      if (o === 'home') { this.follow = false; this.ui.querySelector('[data-o=follow]').setAttribute('aria-pressed', 'false'); this.yaw = .42; this.pitch = .95; this.zoom = 1; this.pan.set(0, 0, 0); this.selected = null; }
      if (o === 'in') this.zoom = Math.min(5, this.zoom * 1.25);
      if (o === 'out') this.zoom = Math.max(.7, this.zoom / 1.25);
    }
    bindInput() {
      const cv = this.renderer.domElement;
      let down = null;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, pan: this.pan.clone(), moved: false, panMode: e.button === 2 || e.shiftKey };
        cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 4) down.moved = true;
        if (!down.moved) return;
        if (down.panMode) {
          const s = 1 / this.pxPerUnit;
          const right = new T.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), fwd = new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
          this.pan.copy(down.pan).addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s / Math.max(.35, Math.sin(this.pitch)));
          this.pan.x = Math.max(-18, Math.min(18, this.pan.x)); this.pan.z = Math.max(-14, Math.min(16, this.pan.z));
          if (this.follow) { this.follow = false; this.ui.querySelector('[data-o=follow]').setAttribute('aria-pressed', 'false'); }
        } else {
          this.yaw = down.yaw - dx * .006;
          this.pitch = Math.max(.32, Math.min(1.42, down.pitch + dy * .005));
        }
      });
      const up = e => {
        if (!down) return;
        const d = down; down = null;
        if (!d.moved && e && e.button === 0) this.pickAt(e.clientX, e.clientY);
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { down = null; });
      cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(.7, Math.min(5, this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); }, { passive: false });
      cv.addEventListener('dblclick', () => { this.zoom = Math.min(5, this.zoom * 1.6); });
    }
    pickAt(cx, cy) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      const ray = new T.Raycaster(); ray.setFromCamera(ndc, this.camera);
      const objs = [];
      for (const a of this.agents.values()) if (a.g.visible) a.g.traverse(m => { if (m.isMesh && m !== a.g.userData.ring) objs.push(m); });
      const hit = ray.intersectObjects(objs, false)[0];
      if (hit) { this.selected = hit.object.userData.aid; return; }
      // 小人很小時：選螢幕上最接近的人
      const px = cx - rect.left, py = cy - rect.top;
      let best = null, bd = 26;
      for (const a of this.agents.values()) {
        if (!a.g.visible) continue;
        const sp = this.screen(new T.Vector3(a.x, .9, a.z));
        const d = Math.hypot(sp.x - px, sp.y - py);
        if (d < bd) { bd = d; best = a.id; }
      }
      this.selected = best;
    }

    resize() {
      const w = Math.max(10, this.root.clientWidth), h = Math.max(10, this.root.clientHeight);
      this.w = w; this.h = h;
      this.renderer.setSize(w, h, false);
      this.root.classList.toggle('compact', h < 470);
    }
    cameraUpdate(dt) {
      const cam = this.camera;
      let target = new T.Vector3(0, 0, 2.6).add(this.pan);
      if (this.follow) { const b = [...this.agents.values()].find(a => a.p.rank === 'boss'); if (b) target = new T.Vector3(b.x, .8, b.z); }
      else if (this.selected && this.zoom > 1.6) { const s = this.agents.get(this.selected); if (s) target = new T.Vector3(s.x, .6, s.z); }
      this.look.lerp(target, 1 - Math.exp(-dt * 5));
      const d = 60, cp = Math.cos(this.pitch);
      cam.position.set(this.look.x + Math.sin(this.yaw) * d * cp, this.look.y + Math.sin(this.pitch) * d, this.look.z + Math.cos(this.yaw) * d * cp);
      cam.lookAt(this.look);
      cam.updateMatrixWorld();
      // 依目前視角算出能完整看到整塊地的大小
      const inv = cam.matrixWorldInverse, v = new T.Vector3();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const x of [VIEW.x0, VIEW.x1]) for (const z of [VIEW.z0, VIEW.z1]) for (const y of [-.3, 1.4]) {
        v.set(x, y, z).applyMatrix4(inv);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const aspect = this.w / this.h;
      const base = Math.max((y1 - y0) / 2, (x1 - x0) / 2 / aspect) * (this.root.classList.contains('compact') ? .98 : 1.02);
      const half = base / this.zoom;
      const k = this.follow ? 1 : Math.max(0, Math.min(1, (this.zoom - 1) / .6));
      const cx = (1 - k) * (x0 + x1) / 2, cy = (1 - k) * (y0 + y1) / 2;
      cam.left = cx - half * aspect; cam.right = cx + half * aspect; cam.top = cy + half; cam.bottom = cy - half;
      cam.updateProjectionMatrix();
      this.pxPerUnit = this.h / (2 * half);
    }

    // ---------------- 每一格
    frame(now) {
      if (!this.root.isConnected || this.root.offsetParent === null) { this.lastT = now; return; }
      const dt = Math.min(.25, (now - this.lastT) / 1000); this.lastT = now;
      if (now - this.directorAt > 250) { this.directorAt = now; this.director(); this.updateHud(); }
      const t = Date.now();
      this.stepCar(t);
      for (const a of this.agents.values()) this.step(a, dt, t);
      this.cameraUpdate(dt);
      this.renderer.render(this.scene, this.camera);
      this.place2d(t);
      this.adapt(now);
    }
    adapt(now) {
      if (OfficeView.hq) return;
      const p = this.perf; p.n++;
      if (now - p.t0 < 4000) return;
      const fps = p.n * 1000 / (now - p.t0); p.n = 0; p.t0 = now;
      this.fps = fps;
      if (fps < 24 && p.level === 0) { p.level = 1; this.renderer.shadowMap.enabled = false; this.scene.traverse(m => { if (m.material) m.material.needsUpdate = true; }); }
      else if (fps < 20 && p.level === 1) { p.level = 2; this.renderer.setPixelRatio(1); this.resize(); }
      this.statusEl.textContent = p.level ? '效能模式' : '';
      this.statusEl.style.display = p.level ? '' : 'none';
    }
    stepCar(t) {
      const ca = this.carAnim; if (!ca) return;
      const k = Math.min(1, (t - ca.t0) / 2400), e = 1 - Math.pow(1 - k, 3);
      this.car.position.x = ca.from + (ca.to - ca.from) * e;
      if (k >= 1) this.carAnim = null;
    }
    step(a, dt, t) {
      const g = a.g, u = g.userData;
      if (t < a.hiddenUntil) { g.visible = false; return; }
      let walking = false;
      if (a.path && a.path.length) {
        const [nx, nz] = a.path[0];
        const dx = nx - a.x, dz = nz - a.z, d = Math.hypot(dx, dz), mv = a.speed * dt;
        if (d <= mv) { a.x = nx; a.z = nz; a.path.shift(); }
        else { a.x += dx / d * mv; a.z += dz / d * mv; a.face = lerpAngle(a.face, Math.atan2(dx, dz), Math.min(1, dt * 12)); }
        walking = a.path.length > 0;
      }
      if (!walking && a.target) a.face = lerpAngle(a.face, a.target.face, Math.min(1, dt * 8));
      const arrived = !walking && a.target;
      const pose = arrived ? a.target.pose : 'walk';
      a.pose = pose;
      const wantSeat = pose === 'sit' ? 1 : 0;
      a.seat += (wantSeat - a.seat) * Math.min(1, dt * 7);
      const seat = a.seat;
      const mood = a.mood && a.mood.until > t ? a.mood.type : null;
      a.step += dt * (walking ? (a.speed > 3 ? 15 : 10) : 3);
      g.visible = pose !== 'hide';
      let y = (arrived && a.target.y) || 0;
      const meeting = a.target && /^(meeting|bossGuest)/.test((a.held && a.held.pool) || '') || a.mode === 'meet';
      const typing = a.mode === 'work' || a.mode === 'pretend' || t < a.pulseUntil;
      // 身體
      u.body.position.y = -.14 * seat - (a.target && a.target.low ? .12 * seat : 0) + (walking ? Math.abs(Math.sin(a.step)) * .035 : Math.sin(a.step * .4) * .008);
      u.body.position.z = -.06 * seat;
      u.legs.forEach((l, j) => {
        l.upper.rotation.x = seat * -1.4 + (walking ? Math.sin(a.step + j * PI) * .55 : 0);
        l.lower.rotation.x = seat * 1.4 + (walking ? Math.max(0, -Math.sin(a.step + j * PI)) * .4 : 0);
      });
      let head = 0;
      u.arms.forEach((r, j) => {
        r.upper.rotation.set(walking ? Math.sin(a.step + j * PI + PI) * .45 : 0, 0, 0);
        r.lower.rotation.set(0, 0, 0);
        if (seat > .1) {
          if (typing) { r.upper.rotation.x = -1.6 * seat + Math.sin(a.step * 6 + j * 2) * .05; r.lower.rotation.x = .3 * seat; r.upper.rotation.z = (j ? -.12 : .12) * seat; head = .12; }
          else if (meeting) { r.upper.rotation.x = -1.0 * seat + Math.sin(a.step * .5 + j * 2) * .2; r.lower.rotation.x = .4 * seat; }
          else { r.upper.rotation.x = -.5 * seat; r.lower.rotation.x = -.2; }
        }
      });
      const R = u.arms[1], Lf = u.arms[0];
      if (a.mode === 'slack' && !walking) {
        if (a.label && a.label.startsWith('📱')) { R.upper.rotation.x = -.7; R.lower.rotation.x = -1.6; head = .4; }
        else if (a.label && /☕|🍪|🍫/.test(a.label)) { R.upper.rotation.x = -.5; R.lower.rotation.x = -1.4; head = -.08; }
        else if (a.label && /💬/.test(a.label)) { R.upper.rotation.x = -.6 + Math.sin(a.step * 2) * .3; R.lower.rotation.x = -.6; head = Math.sin(a.step) * .1; }
        else if (seat > .5) { R.upper.rotation.x = -1.3; R.lower.rotation.x = -1.2; Lf.upper.rotation.x = -1.3; Lf.lower.rotation.x = -1.2; head = -.25; }
      }
      if (a.mode === 'rest' && !walking && !seat) { R.upper.rotation.x = -.5; R.lower.rotation.x = -1.4; }
      if (mood === 'angry' || a.mode === 'angry') {
        y += walking ? 0 : Math.abs(Math.sin(t / 90)) * .16;
        u.arms.forEach((r, j) => { r.upper.rotation.z = (j ? 1 : -1) * (2.5 + Math.sin(t / 80) * .3); r.upper.rotation.x = 0; r.lower.rotation.x = -.5; });
      } else if (mood === 'evil') { R.upper.rotation.z = 2.4; R.upper.rotation.x = 0; R.lower.rotation.x = -.8; }
      else if (mood === 'party' || a.mode === 'party') { if (!walking) y += Math.abs(Math.sin(t / 140 + a.step)) * .22; u.arms.forEach((r, j) => { r.upper.rotation.z = (j ? 1 : -1) * 2.7; r.upper.rotation.x = 0; }); }
      else if (a.override && a.override.kind === 'point' && !walking) { R.upper.rotation.x = -1.5; R.lower.rotation.x = 0; }
      else if (a.override && a.override.kind === 'front' && !walking) { R.upper.rotation.x = -2.8 + Math.sin(t / 150) * .15; R.lower.rotation.x = -.3; }
      else if (a.override && a.override.kind === 'visit' && !walking) { u.arms.forEach(r => { r.upper.rotation.x = .25; r.upper.rotation.z = 0; }); head = -.05; }
      u.headG.rotation.x = head;
      g.position.set(a.x, y, a.z);
      g.rotation.y = a.face;
      u.ring.scale.setScalar(this.selected === a.id || this.selfId === a.id ? 1.3 : 1);
      u.beacon.visible = this.selfId === a.id;
      u.beacon.rotation.y = t * .001;
    }

    // ---------------- 2D 標示：對話卡片＋指引線、人名、房間
    screen(v3) { const v = v3.clone().project(this.camera); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, z: v.z }; }
    place2d(t) {
      for (const l of this.labels) {
        const p = this.screen(l.pos);
        l.el.style.transform = `translate(-50%,-50%) translate(${p.x | 0}px,${p.y | 0}px)`;
      }
      const compact = this.root.classList.contains('compact');
      const cards = [], placed = [];
      const reserved = [...this.ui.querySelectorAll('.of-addr,.of-tools,.of-board,.of-zoom')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(), R = this.root.getBoundingClientRect(); return { l: r.left - R.left, r: r.right - R.left, t: r.top - R.top, b: r.bottom - R.top }; });
      for (const a of this.agents.values()) {
        const vis = a.g.visible || a.pose === 'hide';
        const headY = a.pose === 'hide' ? 1.5 : (1.85 - .14 * a.seat);
        const anchor = this.screen(new T.Vector3(a.x, headY + (a.g.position.y || 0), a.z));
        a._anchor = anchor;
        let txt = null, cls = '', title = '';
        const name = a.p.name.replace(/^🤖/, '');
        if (a.bubble && a.bubble.until > t) { txt = a.bubble.text; cls = a.bubble.cls; }
        else if (a.mode === 'slack') {
          const lim = compact ? 4 : 8;
          if (a.slackRank < lim) { txt = (a.label || '☕ 摸魚') + ' ' + fmt(t - (a.slackSince || t)); cls = 'slack'; }
          else { txt = (a.label || '☕').split(' ')[0]; cls = 'emoji'; }
        } else if (a.mode === 'offline') { txt = '🔌'; cls = 'emoji'; }
        else if (t < a.pulseUntil && !compact) { txt = '⌨️'; cls = 'emoji'; }
        if (this.selected === a.id) {
          const r = G.RANKS[a.p.rank] || {};
          const status = a.mode === 'slack' ? '摸魚中 ' + fmt(t - (a.slackSince || t)) : a.mode === 'work' || a.mode === 'pretend' ? '認真工作中' : a.mode === 'angry' ? '生氣中' : a.mode === 'offline' ? '離線' : a.mode === 'meet' || a.mode === 'party' ? '集合中' : a.mode === 'observe' ? '觀察市場' : a.mode === 'rest' ? '休息中' : '待命';
          const slackSum = (this.awardSlack.get(a.id) || 0) + (a.slackSince != null ? t - a.slackSince : 0);
          title = `${name} · ${a.p.title || r.name || ''}`;
          txt = (txt && cls !== 'emoji' ? txt + '｜' : '') + `${status}・放了 ${a.p.placed || 0} 塊・累計摸魚 ${fmt(slackSum)}`;
          cls = (cls === 'emoji' ? '' : cls) + ' sel';
        }
        if (!vis || anchor.z > 1 || anchor.x < -40 || anchor.x > this.w + 40 || anchor.y < -40 || anchor.y > this.h + 40) txt = null;
        if (txt && cls === 'emoji') {
          if (a._emo !== txt) { a.emo.textContent = txt; a._emo = txt; }
          a.emo.style.display = ''; a.emo.style.transform = `translate(-50%,-100%) translate(${anchor.x | 0}px,${(anchor.y - 4) | 0}px)`;
          a.card.style.display = 'none'; a.line.style.display = 'none';
        } else {
          a.emo.style.display = 'none';
          if (txt) cards.push({ a, txt, cls, title: title || `${name} · ${a.p.title || ''}`, prio: /sel/.test(cls) ? 0 : /angry|evil|boss|shout/.test(cls) ? 1 : cls === 'talk' ? 2 : 3 });
          else { a.card.style.display = 'none'; a.line.style.display = 'none'; }
        }
        // 人名
        if (this.showNames && vis && !txt && anchor.z <= 1) {
          if (a._nm !== name) { a.nm.innerHTML = `${esc(name)}<small>${esc(a.p.title || '')}</small>`; a._nm = name; }
          a.nm.style.display = ''; a.nm.style.transform = `translate(-50%,-100%) translate(${anchor.x | 0}px,${(anchor.y - 2) | 0}px)`;
        } else a.nm.style.display = 'none';
      }
      cards.sort((x, y) => x.prio - y.prio);
      const maxCards = compact ? 4 : 7;
      const overlap = (p, q, gap) => p.l < q.r + gap && p.r > q.l - gap && p.t < q.b + gap && p.b > q.t - gap;
      cards.forEach((c, i) => {
        const a = c.a;
        if (i >= maxCards) { a.card.style.display = 'none'; a.line.style.display = 'none'; return; }
        const html = `<b>${esc(c.title)}</b>${esc(c.txt)}`;
        if (a._card !== html) { a.card.innerHTML = html; a._card = html; a._w = 0; }
        if (a._cls !== c.cls) { a.card.className = 'of-card ' + c.cls; a._cls = c.cls; a._w = 0; }
        a.card.style.display = '';
        if (!a._w) { a._w = a.card.offsetWidth; a._h = a.card.offsetHeight; }
        const w = a._w, h = a._h, an = a._anchor;
        const lift = compact ? 22 : 34;
        const prior = this.placements.get(a.id);
        let best = null;
        const tryAt = (x, bottom) => {
          x = Math.max(w / 2 + 6, Math.min(this.w - w / 2 - 6, x));
          const r = { l: x - w / 2, r: x + w / 2, t: bottom - h, b: bottom };
          if (r.t < 4 || r.b > this.h - 4) return null;
          if (placed.some(q => overlap(r, q, 4)) || reserved.some(q => overlap(r, q, 6))) return null;
          const sc = Math.abs(x - an.x) * .8 + Math.abs(an.y - lift - bottom) * 1.2 + (prior ? Math.abs(x - an.x - prior.dx) * .15 + Math.abs(bottom - an.y - prior.dy) * .12 : 0);
          return { x, bottom, r, sc };
        };
        if (prior) { const c0 = tryAt(an.x + prior.dx, an.y + prior.dy); if (c0) best = c0; }
        if (!best) {
          for (const up of [0, 30, 60, 95, 135, 180]) for (const dx of [0, -50, 50, -110, 110, -180, 180]) {
            const c1 = tryAt(an.x + dx, an.y - lift - up);
            if (c1 && (!best || c1.sc < best.sc)) best = c1;
          }
        }
        if (!best) { a.card.style.display = 'none'; a.line.style.display = 'none'; this.placements.delete(a.id); return; }
        placed.push(best.r);
        this.placements.set(a.id, { dx: best.x - an.x, dy: best.bottom - an.y });
        a.card.style.transform = `translate(${best.r.l | 0}px,${best.r.t | 0}px)`;
        const lx = Math.max(best.r.l + 10, Math.min(best.r.r - 10, an.x));
        a.line.setAttribute('x1', lx | 0); a.line.setAttribute('y1', best.r.b | 0);
        a.line.setAttribute('x2', an.x | 0); a.line.setAttribute('y2', (an.y + 2) | 0);
        a.line.style.display = '';
      });
    }

    updateHud() {
      if (!this.S) return;
      const t = Date.now();
      let work = 0, slack = 0, angry = 0, meet = 0;
      const slackers = [];
      for (const a of this.agents.values()) {
        const mood = a.mood && a.mood.until > t ? a.mood.type : null;
        if (mood === 'angry' || a.mode === 'angry' || mood === 'evil') angry++;
        else if (a.mode === 'slack') { slack++; slackers.push(a); }
        else if (a.mode === 'work' || a.mode === 'pretend') work++;
        else meet++;
      }
      const ph = this.S.phase;
      const phaseName = (G.PHASES.find(x => x.id === ph) || {}).long || '';
      const html = `<b>金桶公司 <small>LIVE OFFICE</small></b><br><span class="ph">辦公室實況・${esc(phaseName)}</span><div class="of-chips"><span class="of-chip w">🧑‍💻 認真 ${work}</span><span class="of-chip s">😴 摸魚 ${slack}</span><span class="of-chip a">💢 生氣 ${angry}</span><span class="of-chip m">👥 其他 ${meet}</span></div>`;
      if (html !== this._addr) { this.addr.innerHTML = html; this._addr = html; }
      slackers.sort((x, y) => (x.slackSince || t) - (y.slackSince || t));
      for (const a of this.agents.values()) a.slackRank = 99;
      slackers.forEach((a, i) => { a.slackRank = i; });
      const top = slackers.slice(0, this.root.classList.contains('compact') ? 3 : 5);
      const king = this.slackKing();
      const showBoard = ph === 'build' || ph === 'poster' || (king && king.ms > 20000);
      this.board.style.display = showBoard ? '' : 'none';
      if (showBoard) {
        this.board.innerHTML = `<div class="of-bt">🐟 摸魚排行榜</div>` + (top.length ? top.map((a, i) => `<div class="of-br"><span>${i + 1}</span><b>${esc(a.p.name.replace(/^🤖/, ''))}</b><em>${esc((a.label || '☕').split(' ')[0])} ${fmt(t - a.slackSince)}</em></div>`).join('') : '<div class="of-br muted">大家都很認真（目前）</div>')
          + (king && king.ms > 20000 ? `<div class="of-king">👑 累計偷懶王：<b>${esc(king.name)}</b> ${fmt(king.ms)}</div>` : '');
      }
    }
    slackKing() {
      const t = Date.now();
      let best = null;
      for (const a of this.agents.values()) {
        const ms = (this.awardSlack.get(a.id) || 0) + (a.slackSince != null ? t - a.slackSince : 0);
        if (!best || ms > best.ms) best = { id: a.id, name: a.p.name.replace(/^🤖/, ''), title: a.p.title, ms };
      }
      return best;
    }
    dispose() {
      this.alive = false;
      this.ro.disconnect();
      this.renderer.dispose();
      this.renderer.forceContextLoss && this.renderer.forceContextLoss();
      this.root.remove();
    }
  }

  OfficeView.hq = /[?&]hq=1/.test(location.search);
  window.OfficeView = OfficeView;
})();

