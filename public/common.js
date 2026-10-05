/* 金馬桶專案 — 共用工具：連線、3D 積木視窗、小工具 */
(function () {
  'use strict';
  const G = window.GAME;

  // ---------------------------------------------------------------- 小工具
  const U = {};
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.money = n => n == null ? '—' : 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
  U.mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  U.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  U.toast = (msg, kind) => {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), 3200);
  };
  U.rankColor = p => p && p.rank === 'boss' ? G.RANKS.boss.color : p && p.team ? G.TEAMS[p.team].color : '#6b7e82';
  U.avatar = (p, size) => `<span class="av" style="background:${U.rankColor(p)};${size ? `width:${size}px;height:${size}px;font-size:${Math.round(size * .45)}px` : ''}">${U.esc(Array.from(String(p && p.name || '?').replace(/^\u{1F916}/u, '') || '?')[0] || '?')}</span>`;
  U.teamChip = t => t ? `<span class="chip ${t}">${U.esc(G.TEAMS[t].name)}</span>` : `<span class="chip boss">董事會</span>`;
  U.rankName = p => p && p.rank ? G.RANKS[p.rank].name : '';
  U.stepsHTML = phase => {
    const i = G.PHASE_IDS.indexOf(phase);
    return G.PHASES.map((p, j) => `<span class="${j < i ? 'done' : j === i ? 'on' : ''}">${j + 1}. ${p.name}</span>`).join('');
  };
  U.confetti = (container, n = 120) => {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90';
    (container || document.body).appendChild(cv);
    const ctx = cv.getContext('2d');
    const W = cv.width = innerWidth, H = cv.height = innerHeight;
    const cols = ['#e9bf5f', '#297c7b', '#3977bc', '#9566ac', '#d6453b', '#fffefa', '#f0a7b9'];
    const ps = Array.from({ length: n }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, r: Math.random() * 6, s: 5 + Math.random() * 7, c: cols[Math.random() * cols.length | 0], w: Math.random() * .2 }));
    let t0 = performance.now();
    (function tick(t) {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.w; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      if (t - t0 < 6000) requestAnimationFrame(tick); else cv.remove();
    })(t0);
  };

  // ---------------------------------------------------------------- 連線（WebSocket，失敗時自動改用 HTTP 輪詢）
  class Net {
    constructor(opts) {
      this.opts = opts || {};
      this.handlers = {};
      this.offset = 0;
      this.connected = false;
      this.retry = 0;
      this.gen = 0;
      this.wsFails = 0;
      this.banner = null;
      const q = new URLSearchParams(location.search).get('transport');
      let saved = null; try { saved = sessionStorage.getItem('gt_transport'); } catch (e) { /* ignore */ }
      this.mode = q === 'poll' || q === 'ws' ? q : saved === 'poll' ? 'poll' : (typeof WebSocket === 'undefined' ? 'poll' : 'ws');
      this.connect();
      // 心跳：讓雲端主機知道還有人在用（也幫忙偵測斷線）
      setInterval(() => { if (this.connected) this.send({ t: 'ping', n: Date.now() }); }, 45000);
    }
    on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); return this; }
    emit(t, m) { (this.handlers[t] || []).forEach(fn => fn(m)); }
    now() { return Date.now() + this.offset; }
    hello() {
      const hello = { t: 'hello', token: U.store.get('gt_token', '') || undefined };
      if (this.opts.host) { hello.host = true; hello.key = this.opts.key; }
      if (this.opts.office) hello.office = true;
      return hello;
    }
    _recv(m) {
      if (m.s && m.s.serverNow) this.offset = m.s.serverNow - Date.now();
      this.emit(m.t, m);
    }
    _opened() {
      this.connected = true; this.retry = 0;
      this.showBanner(false);
      this.emit('open');
    }
    _lost() {
      const gen = ++this.gen;
      if (this.connected) this.emit('close');
      this.connected = false;
      this.showBanner(true);
      const d = Math.min(4000, 600 + this.retry++ * 600);
      setTimeout(() => { if (gen === this.gen) this.connect(); }, d);
    }
    connect() { if (this.mode === 'poll') this._connectPoll(); else this._connectWS(); }
    _connectWS() {
      const gen = this.gen;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws, opened = false, welcomed = false;
      try { ws = this.ws = new WebSocket(proto + '//' + location.host + '/ws'); } catch (e) { this.mode = 'poll'; this._connectPoll(); return; }
      const timer = setTimeout(() => { if (!welcomed) { try { ws.close(); } catch (e) { /* ignore */ } } }, 6000);
      ws.onopen = () => { opened = true; ws.send(JSON.stringify(this.hello())); };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'welcome' && !welcomed) { welcomed = true; clearTimeout(timer); this.wsFails = 0; this._opened(); }
        this._recv(m);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (gen !== this.gen) return;
        if (!welcomed) {
          this.wsFails++;
          // WebSocket 連不上兩次（常見於公司 Proxy）→ 改用 HTTP 輪詢
          if (this.wsFails >= 2) { this.mode = 'poll'; try { sessionStorage.setItem('gt_transport', 'poll'); } catch (e) { /* ignore */ } }
        }
        this.ws = null;
        this._lost();
      };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* ignore */ } };
      void opened;
    }
    _connectPoll() {
      const gen = this.gen;
      this.sendq = []; this.sending = false;
      fetch('/rt/connect', { method: 'POST', cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error('connect ' + r.status); return r.json(); })
        .then(j => {
          if (gen !== this.gen) return;
          this.cid = j.cid;
          this.sendq.push(this.hello());
          this._flushSend();
          this._poll(gen, true);
        })
        .catch(() => { if (gen === this.gen) this._lost(); });
    }
    _poll(gen, first) {
      fetch('/rt/poll?cid=' + encodeURIComponent(this.cid), { cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error('poll ' + r.status); return r.json(); })
        .then(arr => {
          if (gen !== this.gen) return;
          for (const m of arr) {
            if (m.t === 'welcome' && !this.connected) this._opened();
            this._recv(m);
          }
          this._poll(gen, false);
        })
        .catch(() => { if (gen === this.gen) this._lost(); });
      void first;
    }
    _flushSend() {
      if (this.sending || !this.sendq || !this.sendq.length || !this.cid) return;
      this.sending = true;
      const gen = this.gen, batch = this.sendq.splice(0, 60);
      fetch('/rt/send?cid=' + encodeURIComponent(this.cid), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch), cache: 'no-store' })
        .then(r => { if (r.status === 410) throw new Error('gone'); })
        .catch(() => { if (gen === this.gen) this._lost(); })
        .finally(() => { this.sending = false; if (gen === this.gen) this._flushSend(); });
    }
    send(obj) {
      if (this.mode === 'poll') {
        if (!this.connected || !this.cid) return false;
        this.sendq.push(obj); this._flushSend(); return true;
      }
      if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; }
      return false;
    }
    showBanner(on) {
      if (on && !this.banner) { this.banner = document.createElement('div'); this.banner.className = 'conn'; this.banner.textContent = '連線中斷，正在重新連線…'; document.body.appendChild(this.banner); }
      if (!on && this.banner) { this.banner.remove(); this.banner = null; }
    }
  }

  // ---------------------------------------------------------------- 3D 積木視窗
  const T = window.THREE;
  const GX = G.GRID.x, GY = G.GRID.y, GZ = G.GRID.z;
  const views = new Set();
  let loopOn = false;
  let loopErrs = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    for (const v of views) {
      try { v._frame(t); } catch (e) { if (loopErrs++ < 5) console.error('3D 畫面錯誤', e); }
    }
  }
  function makeEnv(renderer) {
    const pm = new T.PMREMGenerator(renderer);
    const s = new T.Scene();
    const geo = new T.SphereGeometry(50, 32, 16);
    const cols = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50;
      const c = new T.Color().setHSL(0.12, 0.25, 0.55 + y * 0.4);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    s.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    const lightMat = new T.MeshBasicMaterial({ color: 0xffffff });
    [[20, 30, 10, 18, 6], [-25, 18, -10, 10, 10], [0, 10, -30, 20, 4]].forEach(([x, y, z, w, h]) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), lightMat); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    });
    const rt = pm.fromScene(s, 0.03);
    pm.dispose();
    geo.dispose();
    return rt;
  }

  const cellPos = (x, y, z, v) => (v || new T.Vector3()).set(x - GX / 2 + 0.5, y + 0.5, z - GZ / 2 + 0.5);

  class VoxelView {
    constructor(container, opts) {
      this.opts = Object.assign({ interactive: false, orbit: true, autoRotate: false, preserve: false, ground: true, radius: 27, overlay: true }, opts);
      this.el = container;
      container.classList.add('vox');
      this.blocks = new Map();
      this.dirty = true;
      this.color = 0;
      this.mode = 'place';
      this.yaw = this.opts.yaw != null ? this.opts.yaw : 0.75;
      this.pitch = this.opts.pitch != null ? this.opts.pitch : 0.5;
      this.radius = this.opts.radius;
      this.target = new T.Vector3(0, 4.5, 0);
      this.stickers = [];
      this.hasRGB = false;

      const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!this.opts.preserve });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.outputColorSpace = T.SRGBColorSpace;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      r.setClearColor(0x000000, 0);
      container.appendChild(r.domElement);
      if (this.opts.overlay) { this.overlay = document.createElement('div'); this.overlay.className = 'overlay'; container.appendChild(this.overlay); }

      const sc = this.scene = new T.Scene();
      this.envRT = makeEnv(r);
      sc.environment = this.envRT.texture;
      this.camera = new T.PerspectiveCamera(38, 1, 0.1, 400);
      sc.add(new T.HemisphereLight(0xfffbf0, 0x8a9a90, 0.9));
      const sun = new T.DirectionalLight(0xffffff, 1.6);
      sun.position.set(12, 24, 10);
      sc.add(sun);
      const fill = new T.DirectionalLight(0xdfe9ff, 0.45);
      fill.position.set(-14, 8, -10);
      sc.add(fill);

      // 底座
      this.groundGroup = new T.Group();
      const base = new T.Mesh(new T.BoxGeometry(GX + 1.2, 0.6, GZ + 1.2), new T.MeshStandardMaterial({ color: 0x2c4a4f, roughness: .6, metalness: .1 }));
      base.position.y = -0.38;
      this.groundGroup.add(base);
      const plate = new T.Mesh(new T.BoxGeometry(GX, 0.12, GZ), new T.MeshStandardMaterial({ color: 0xe9ece2, roughness: .8 }));
      plate.position.y = -0.06;
      this.groundGroup.add(plate);
      const grid = new T.GridHelper(GX, GX, 0xb7c4b8, 0xcbd5cb);
      grid.position.y = 0.005;
      grid.scale.z = GZ / GX;
      this.groundGroup.add(grid);
      sc.add(this.groundGroup);
      this.groundGroup.visible = this.opts.ground;

      // 積木
      this.boxGeo = new T.BoxGeometry(0.96, 0.96, 0.96);
      this.studGeo = new T.CylinderGeometry(0.24, 0.24, 0.16, 14);
      this.studGeo.translate(0, 0.56, 0);
      const mk = (mat, cap) => { const m = new T.InstancedMesh(this.boxGeo, mat, cap); m.count = 0; m.instanceMatrix.setUsage(T.DynamicDrawUsage); sc.add(m); return m; };
      this.groups = {
        std: mk(new T.MeshStandardMaterial({ roughness: .5, metalness: 0 }), GX * GY * GZ),
        metal: mk(new T.MeshStandardMaterial({ roughness: .22, metalness: .95 }), GX * GY * GZ),
        glass: mk(new T.MeshStandardMaterial({ roughness: .05, metalness: 0, transparent: true, opacity: .42, depthWrite: false }), GX * GY * GZ),
        rgb: mk(new T.MeshBasicMaterial({}), GX * GY * GZ)
      };
      this.studs = new T.InstancedMesh(this.studGeo, new T.MeshStandardMaterial({ roughness: .45, metalness: 0 }), GX * GY * GZ);
      this.studs.count = 0;
      sc.add(this.studs);
      this.index = { std: [], metal: [], glass: [], rgb: [] };
      // 初始化 instanceColor
      for (const k in this.groups) { this.groups[k].setColorAt(0, new T.Color(1, 1, 1)); }
      this.studs.setColorAt(0, new T.Color(1, 1, 1));

      // 預覽方塊
      this.ghost = new T.Mesh(new T.BoxGeometry(1.02, 1.02, 1.02), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .45, depthWrite: false }));
      this.ghostEdge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.04, 1.04, 1.04)), new T.LineBasicMaterial({ color: 0x24484e }));
      this.ghost.add(this.ghostEdge);
      this.ghost.visible = false;
      sc.add(this.ghost);

      this.ray = new T.Raycaster();
      this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
      this._bindInput();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
      this.resize();
      views.add(this);
      if (!loopOn) { loopOn = true; requestAnimationFrame(loop); }
    }

    resize() {
      const w = Math.max(10, this.el.clientWidth), h = Math.max(10, this.el.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.w = w; this.h = h;
      this.dirty = true;
    }

    setBlocks(obj) {
      this.blocks.clear();
      for (const k in obj) this.blocks.set(k, obj[k]);
      this.rebuild();
    }
    applyOps(ops) {
      for (const o of ops) {
        const k = o[1] + ',' + o[2] + ',' + o[3];
        if (o[0] === 1) this.blocks.set(k, { c: o[4], by: o[5] }); else this.blocks.delete(k);
      }
      this.rebuild();
    }
    rebuild() { this.needRebuild = true; this.dirty = true; }
    _rebuild() {
      this.needRebuild = false;
      const m = new T.Matrix4(), c = new T.Color(), p = new T.Vector3();
      const counts = { std: 0, metal: 0, glass: 0, rgb: 0 };
      for (const k in this.index) this.index[k].length = 0;
      let sc = 0;
      this.hasRGB = false;
      let maxY = 0;
      for (const [k, b] of this.blocks) {
        const [x, y, z] = k.split(',').map(Number);
        const col = G.COLORS[b.c] || G.COLORS[0];
        const g = col.kind;
        const i = counts[g]++;
        cellPos(x, y, z, p);
        m.makeTranslation(p.x, p.y, p.z);
        this.groups[g].setMatrixAt(i, m);
        c.set(col.hex);
        this.groups[g].setColorAt(i, c);
        this.index[g][i] = k;
        if (g === 'rgb') this.hasRGB = true;
        if (y > maxY) maxY = y;
        if ((g === 'std' || g === 'metal') && !this.blocks.has(x + ',' + (y + 1) + ',' + z)) {
          this.studs.setMatrixAt(sc, m);
          this.studs.setColorAt(sc, c);
          sc++;
        }
      }
      for (const g in this.groups) {
        const gm = this.groups[g];
        gm.count = counts[g];
        gm.instanceMatrix.needsUpdate = true;
        if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
        gm.computeBoundingSphere();
      }
      this.studs.count = sc;
      this.studs.instanceMatrix.needsUpdate = true;
      if (this.studs.instanceColor) this.studs.instanceColor.needsUpdate = true;
      this.maxY = maxY;
      if (this.opts.onCount) this.opts.onCount(this.blocks.size);
    }

    _bindInput() {
      const cv = this.renderer.domElement;
      let down = null;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, btn: e.button, moved: false, shift: e.shiftKey || e.altKey };
        cv.setPointerCapture(e.pointerId);
        this.lastInteract = performance.now();
      });
      cv.addEventListener('pointermove', e => {
        if (down) {
          const dx = e.clientX - down.x, dy = e.clientY - down.y;
          if (!down.moved && Math.hypot(dx, dy) > 5) down.moved = true;
          if (down.moved && this.opts.orbit) {
            this.yaw = down.yaw - dx * 0.008;
            this.pitch = Math.max(0.05, Math.min(1.45, down.pitch + dy * 0.006));
            this.dirty = true;
            this.lastInteract = performance.now();
            this.ghost.visible = false;
          }
        } else if (this.opts.interactive) {
          this._hover(e);
        }
      });
      const up = e => {
        if (!down) return;
        const d = down; down = null;
        if (!d.moved && this.opts.interactive) {
          const remove = d.btn === 2 || d.shift || this.mode === 'remove';
          const hit = this.pick(e.clientX, e.clientY);
          if (this.mode === 'sticker' && d.btn === 0) { if (hit && this.opts.onSticker) this.opts.onSticker(hit.point); }
          else if (remove) { if (hit && hit.cell && this.opts.onRemove) this.opts.onRemove(hit.cell); }
          else if (d.btn === 0) { if (hit && hit.place && this.opts.onPlace) this.opts.onPlace(hit.place); }
          this._hover(e);
        }
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { down = null; });
      cv.addEventListener('pointerleave', () => { if (!down) { this.ghost.visible = false; this.dirty = true; } });
      cv.addEventListener('wheel', e => {
        if (!this.opts.orbit) return;
        e.preventDefault();
        this.radius = Math.max(9, Math.min(55, this.radius * (1 + Math.sign(e.deltaY) * 0.08)));
        this.dirty = true;
        this.lastInteract = performance.now();
      }, { passive: false });
      this._keyRemove = false;
    }

    _hover(e) {
      if (!this.opts.interactive) return;
      const hit = this.pick(e.clientX, e.clientY);
      const removing = e.shiftKey || e.altKey || this.mode === 'remove';
      if (this.mode === 'sticker' || !hit) { this.ghost.visible = false; this.dirty = true; return; }
      if (removing) {
        if (!hit.cell) { this.ghost.visible = false; this.dirty = true; return; }
        cellPos(hit.cell[0], hit.cell[1], hit.cell[2], this.ghost.position);
        this.ghost.material.color.set(0xd6453b); this.ghost.material.opacity = .55;
        this.ghostEdge.material.color.set(0x8a1f15);
      } else {
        if (!hit.place) { this.ghost.visible = false; this.dirty = true; return; }
        cellPos(hit.place[0], hit.place[1], hit.place[2], this.ghost.position);
        this.ghost.material.color.set(G.COLORS[this.color].hex); this.ghost.material.opacity = .5;
        this.ghostEdge.material.color.set(0x24484e);
      }
      this.ghost.visible = true;
      this.dirty = true;
    }

    pick(cx, cy) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const objs = [this.groups.std, this.groups.metal, this.groups.glass, this.groups.rgb].filter(g => g.count > 0);
      const hits = this.ray.intersectObjects(objs, false);
      if (hits.length) {
        const h = hits[0];
        const g = Object.keys(this.groups).find(k => this.groups[k] === h.object);
        const key = this.index[g][h.instanceId];
        if (key) {
          const cell = key.split(',').map(Number);
          const n = h.face ? h.face.normal : new T.Vector3(0, 1, 0);
          const place = [cell[0] + Math.round(n.x), cell[1] + Math.round(n.y), cell[2] + Math.round(n.z)];
          const ok = place[0] >= 0 && place[1] >= 0 && place[2] >= 0 && place[0] < GX && place[1] < GY && place[2] < GZ && !this.blocks.has(place.join(','));
          return { cell, place: ok ? place : null, point: [h.point.x, h.point.y, h.point.z] };
        }
      }
      const pt = new T.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, pt)) {
        const x = Math.floor(pt.x + GX / 2), z = Math.floor(pt.z + GZ / 2);
        if (x >= 0 && z >= 0 && x < GX && z < GZ) {
          return { cell: null, place: this.blocks.has(x + ',0,' + z) ? null : [x, 0, z], point: [pt.x, 0.2, pt.z] };
        }
      }
      return null;
    }

    project(pos) {
      const v = new T.Vector3(pos[0], pos[1], pos[2]).project(this.camera);
      return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, vis: v.z < 1 };
    }

    addSticker(s, who) {
      if (!this.overlay) return;
      const el = document.createElement('div');
      el.className = 'sticker' + (s.boss ? ' boss' : '');
      el.innerHTML = U.esc(s.text) + (who ? `<small>${U.esc(who)}</small>` : '');
      this.overlay.appendChild(el);
      const item = { s, el, born: performance.now() };
      this.stickers.push(item);
      const age = Math.max(0, Date.now() - (s.localAt || Date.now()));
      const life = 22000 - age;
      setTimeout(() => el.classList.add('fade'), Math.max(0, life - 800));
      setTimeout(() => { el.remove(); this.stickers = this.stickers.filter(x => x !== item); }, Math.max(0, life));
      while (this.stickers.length > 14) { const o = this.stickers.shift(); o.el.remove(); }
      this.dirty = true;
    }
    clearStickers() { for (const s of this.stickers) s.el.remove(); this.stickers = []; }

    floatEmoji(emoji) {
      if (!this.overlay) return;
      const el = document.createElement('div');
      el.className = 'float-emoji';
      el.textContent = emoji;
      el.style.left = (10 + Math.random() * 80) + '%';
      this.overlay.appendChild(el);
      setTimeout(() => el.remove(), 2700);
    }
    banner(text, sub, cls) {
      if (!this.overlay) return;
      U.$$('.view-banner', this.overlay).forEach(e => e.remove());
      const el = document.createElement('div');
      el.className = 'view-banner' + (cls ? ' ' + cls : '');
      el.innerHTML = U.esc(text) + (sub ? `<small>${U.esc(sub)}</small>` : '');
      this.overlay.appendChild(el);
      setTimeout(() => el.remove(), 6100);
    }
    shake() { this.el.classList.remove('shake'); void this.el.offsetWidth; this.el.classList.add('shake'); }

    setColor(i) { this.color = i; }
    setMode(m) { this.mode = m; this.ghost.visible = false; this.dirty = true; }
    setGround(on) { this.groundGroup.visible = on; this.dirty = true; }

    fitHeight() {
      // 依作品高度調整視角中心
      const top = (this.maxY || 4) + 1;
      this.target.y += (Math.max(2.5, top * 0.45) - this.target.y) * 0.05;
    }

    _frame(t) {
      if (!this.el.isConnected) return;
      if (this.needRebuild) this._rebuild();
      let animate = false;
      if (this.opts.autoRotate && (!this.lastInteract || t - this.lastInteract > 4000)) { this.yaw += 0.004; animate = true; }
      if (this.hasRGB && t - (this._rgbT || 0) > 50) {
        this._rgbT = t;
        const g = this.groups.rgb, c = new T.Color();
        for (let i = 0; i < g.count; i++) {
          const k = this.index.rgb[i]; const [x, y, z] = k.split(',').map(Number);
          c.setHSL(((t / 2400) + (x + y * 0.7 + z) * 0.06) % 1, 0.95, 0.55);
          g.setColorAt(i, c);
        }
        g.instanceColor.needsUpdate = true;
        animate = true;
      }
      if (this.opts.autoFit) { this.fitHeight(); animate = true; }
      if (!this.dirty && !animate) return;
      this.dirty = false;
      const cp = Math.cos(this.pitch);
      this.camera.position.set(
        this.target.x + this.radius * cp * Math.sin(this.yaw),
        this.target.y + this.radius * Math.sin(this.pitch),
        this.target.z + this.radius * cp * Math.cos(this.yaw)
      );
      this.camera.lookAt(this.target);
      this.renderer.render(this.scene, this.camera);
      for (const it of this.stickers) {
        const p = this.project(it.s.pos);
        it.el.style.left = p.x + 'px';
        it.el.style.top = p.y + 'px';
        it.el.style.display = p.vis ? '' : 'none';
      }
    }

    snapshot(size) {
      const prevW = this.w, prevH = this.h;
      const s = size || 800;
      const prevGhost = this.ghost.visible;
      this.ghost.visible = false;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(s, s, false);
      this.camera.aspect = 1; this.camera.updateProjectionMatrix();
      if (this.needRebuild) this._rebuild();
      this.renderer.render(this.scene, this.camera);
      const url = this.renderer.domElement.toDataURL('image/png');
      this.ghost.visible = prevGhost;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(prevW, prevH, false);
      this.camera.aspect = prevW / prevH; this.camera.updateProjectionMatrix();
      this.dirty = true;
      return url;
    }

    dispose() {
      views.delete(this);
      this.ro.disconnect();
      if (this.envRT) this.envRT.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss && this.renderer.forceContextLoss();
      this.el.innerHTML = '';
    }
  }

  // 計時器顯示
  function timerText(s, net) {
    if (!s) return { text: '', cls: '' };
    if (s.pausedRemaining != null) return { text: '⏸ ' + U.mmss(s.pausedRemaining), cls: 'paused' };
    if (!s.phaseEndsAt) return { text: '', cls: '' };
    const left = s.phaseEndsAt - net.now();
    if (s.timeUp || left <= 0) return { text: '時間到', cls: 'warn' };
    return { text: U.mmss(left), cls: left < 30000 ? 'warn' : '' };
  }

  window.U = U;
  window.Net = Net;
  window.VoxelView = VoxelView;
  window.timerText = timerText;
})();

