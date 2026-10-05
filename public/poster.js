/* 金馬桶專案 — 行銷處海報編輯器 */
(function () {
  'use strict';
  const G = window.GAME, { $, $$, esc, h } = U;
  const W = 600, H = 800;

  const FONTS = {
    hei: { name: '黑體', css: '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif' },
    ming: { name: '明體', css: '"PMingLiU","MingLiU","Noto Serif TC","Songti TC",serif' },
    round: { name: '圓體', css: '"Yuanti TC","jf open 粉圓","Microsoft YaHei UI","Microsoft JhengHei",sans-serif' },
    impact: { name: '粗體招牌', css: 'Impact,"Arial Black","Microsoft JhengHei",sans-serif' }
  };
  const TEXT_COLORS = ['#213c43', '#ffffff', '#111111', '#d6453b', '#e9c46a', '#c88d2e', '#297c7b', '#3977bc', '#9566ac', '#3df2ff', '#ff3df0', '#f0a7b9'];
  const PEN_COLORS = ['#111111', '#ffffff', '#d6453b', '#e9c46a', '#297c7b', '#3977bc', '#ff3df0', '#3fbf5a'];
  const EMOJIS = ['🔥', '✨', '💯', '👑', '🚽', '🧻', '💩', '😍', '🎮', '🐱', '🚀', '💰', '👵', '⭐', '❤️', '👍', '🎉', '💎', '⚡', '🆕'];

  function lin(ctx, a, b) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const BGS = [
    { name: '型錄白', sw: 'linear-gradient(#fff,#e9ece6)', draw: c => lin(c, '#ffffff', '#e6eae3') },
    { name: '奢華黑金', sw: 'radial-gradient(#3a3020,#0d0b07)', draw: c => { const g = c.createRadialGradient(W / 2, H * .45, 40, W / 2, H * .45, 620); g.addColorStop(0, '#3d3322'); g.addColorStop(1, '#0b0906'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.strokeRect(22, 22, W - 44, H - 44); c.lineWidth = 1; c.strokeRect(32, 32, W - 64, H - 64); } },
    { name: '夜市放射', sw: 'repeating-conic-gradient(#ffd23f 0 15deg,#ffb020 15deg 30deg)', draw: c => { c.fillStyle = '#ffcf3a'; c.fillRect(0, 0, W, H); c.save(); c.translate(W / 2, H * .5); c.fillStyle = '#ffaa1f'; for (let i = 0; i < 24; i++) { c.rotate(Math.PI / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(900, -110); c.lineTo(900, 110); c.closePath(); if (i % 2) c.fill(); } c.restore(); } },
    { name: '電競霓虹', sw: 'linear-gradient(#1a0b3a,#0b2a4a)', draw: c => { lin(c, '#1b0b3c', '#08243f'); c.strokeStyle = '#3df2ff33'; c.lineWidth = 1; for (let y = 420; y < H; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } for (let x = -600; x < W + 600; x += 60) { c.beginPath(); c.moveTo(W / 2, 420); c.lineTo(x, H); c.stroke(); } } },
    { name: '品牌青綠', sw: 'linear-gradient(#297c7b,#173f45)', draw: c => lin(c, '#2c8584', '#163a40') },
    { name: '甜甜粉', sw: 'linear-gradient(#ffe8ef,#ffc9d8)', draw: c => lin(c, '#fff0f4', '#ffc5d5') },
    { name: '晴空藍', sw: 'linear-gradient(#e3f2ff,#6fa8e0)', draw: c => lin(c, '#e6f3ff', '#79afe3') },
    { name: '牛皮紙', sw: '#e8d5b0', draw: c => { c.fillStyle = '#e9d6b0'; c.fillRect(0, 0, W, H); c.fillStyle = '#c9b48a55'; for (let i = 0; i < 900; i++) c.fillRect((i * 97) % W, (i * 233) % H, 2, 2); } }
  ];

  function templates(name, slogan) {
    const n = name || '金馬桶', s = slogan || '坐上去，就是人生勝利組';
    return {
      catalog: { name: '經典型錄', bg: 0, items: [
        { type: 'text', role: 'name', text: n, x: 300, y: 105, size: 66, color: '#213c43', font: 'hei', weight: 900 },
        { type: 'text', role: 'slogan', text: s, x: 300, y: 172, size: 26, color: '#6b7e82', font: 'hei', weight: 500 },
        { type: 'img', role: 'toilet', x: 300, y: 470, w: 470, h: 470 },
        { type: 'text', role: 'price', text: '', x: 478, y: 690, size: 30, color: '#ffffff', font: 'hei', weight: 900, badge: '#d6453b' }
      ] },
      luxury: { name: '奢華極簡', bg: 1, items: [
        { type: 'img', role: 'toilet', x: 300, y: 370, w: 500, h: 500 },
        { type: 'text', role: 'name', text: n, x: 300, y: 655, size: 58, color: '#e9c46a', font: 'ming', weight: 700 },
        { type: 'text', role: 'slogan', text: s, x: 300, y: 715, size: 22, color: '#d9cfb8', font: 'ming', weight: 400 }
      ] },
      market: { name: '夜市叫賣', bg: 2, items: [
        { type: 'text', text: '限時特價！！', x: 300, y: 92, size: 72, color: '#d6453b', font: 'impact', weight: 900, stroke: '#ffffff' },
        { type: 'img', role: 'toilet', x: 300, y: 420, w: 430, h: 430 },
        { type: 'emoji', text: '🔥', x: 90, y: 250, size: 80 },
        { type: 'emoji', text: '💯', x: 515, y: 290, size: 72 },
        { type: 'text', role: 'name', text: n, x: 300, y: 670, size: 58, color: '#1a1a1a', font: 'impact', weight: 900, stroke: '#ffffff' },
        { type: 'text', role: 'slogan', text: s, x: 300, y: 735, size: 26, color: '#ffffff', font: 'hei', weight: 800, stroke: '#a33a00' },
        { type: 'text', role: 'price', text: '', x: 470, y: 545, size: 34, color: '#ffffff', font: 'impact', weight: 900, badge: '#d6453b' }
      ] },
      esports: { name: '電競狂潮', bg: 3, items: [
        { type: 'text', role: 'name', text: n, x: 300, y: 115, size: 68, color: '#3df2ff', font: 'impact', weight: 900, glow: '#3df2ff' },
        { type: 'text', role: 'slogan', text: s, x: 300, y: 182, size: 26, color: '#ff8af5', font: 'hei', weight: 700, glow: '#ff3df0' },
        { type: 'img', role: 'toilet', x: 300, y: 470, w: 480, h: 480 },
        { type: 'emoji', text: '⚡', x: 85, y: 690, size: 64 },
        { type: 'emoji', text: '🎮', x: 520, y: 690, size: 64 }
      ] }
    };
  }

  function mount(root, ctx) {
    const { net, getState, getYou, getBuild, who } = ctx;
    const S0 = getState();
    const storeKey = 'gt_poster_' + S0.gameId + '_' + (getYou() || {}).id;
    const brief = S0.brief.choice != null ? G.BRIEFS[S0.brief.choice] : null;

    let doc;
    try { doc = JSON.parse(U.store.get(storeKey, '')); } catch (e) { doc = null; }
    if (!doc || !doc.items) { const t = templates('', '').catalog; doc = { bg: t.bg, items: JSON.parse(JSON.stringify(t.items)), strokes: [], name: '', slogan: '' }; }
    let sel = -1, mode = 'select', pen = { color: '#d6453b', width: 8 };
    const undo = [];
    let dirty = true, lastSent = 0, lastSave = 0, finalSent = false;
    const imgs = { toilet: null };

    root.innerHTML = `
      <style>
        .pe{display:grid;grid-template-columns:300px minmax(0,1fr) 300px;gap:14px;height:100%;padding:14px}
        .pe .col{overflow:auto;display:flex;flex-direction:column;gap:10px;min-height:0}
        .pe .card{padding:13px;box-shadow:none}
        .pe h4{margin:0 0 8px;font-size:13px;color:#4e6962;display:flex;justify-content:space-between;align-items:center}
        .pe .tpl{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .pe .tpl button{font-size:12px;padding:8px 4px}
        .pe .bgs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
        .pe .bgs button{aspect-ratio:1;padding:0;border-radius:8px;border:2px solid #0000;box-shadow:inset 0 0 0 1px #0002}
        .pe .bgs button[aria-pressed=true]{border-color:#24484e}
        .pe .emojis{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
        .pe .emojis button{font-size:20px;padding:4px 0}
        .pe .cols{display:flex;flex-wrap:wrap;gap:5px}
        .pe .cols button{width:24px;height:24px;border-radius:50%;padding:0;border:2px solid #fff;box-shadow:0 0 0 1px #0003}
        .pe .cols button[aria-pressed=true]{box-shadow:0 0 0 2px #24484e}
        .pe .center{display:flex;flex-direction:column;gap:10px;min-height:0;align-items:center}
        .pe .cwrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;width:100%}
        .pe canvas.poster{height:100%;max-height:100%;aspect-ratio:3/4;max-width:100%;border-radius:10px;box-shadow:0 14px 40px #1d384033;background:#fff;touch-action:none}
        .pe .acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
        .pe .acts button{padding:10px 18px}
        .pe label.f{display:block;font-size:12px;color:#4e6962;margin:6px 0 3px}
        .pe input[type=text]{width:100%}
        .pe .cam{height:230px;border:1px solid #cbd8cd}
        .pe .quote{background:#f3f6f1;border-radius:10px;padding:7px 10px;font-size:12px;cursor:pointer;text-align:left;border:1px solid #0000;width:100%}
        .pe .quote:hover{border-color:#9cac9e}
        .pe .quote small{color:var(--muted);display:block;font-size:10px}
        .pe .seltools{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
      </style>
      <div class="pe">
        <div class="col">
          <div class="card" style="background:#f4ecf8;border-color:#e0cdea"><div class="eyebrow" style="color:#7a4f9a">行銷處任務</div><b style="font-size:16px">做一張讓人想買的上市海報！</b><div class="small muted" style="margin-top:4px">${brief ? `目標客群：${brief.icon} ${esc(brief.name)}（${esc(brief.tag)}）` : ''}</div></div>
          <div class="card"><h4>① 選範本</h4><div class="tpl" id="tpl"></div></div>
          <div class="card"><h4>② 產品命名</h4>
            <label class="f">產品名稱（最多 16 字）</label><input type="text" id="pn" maxlength="16" placeholder="例如：御座 Pro Max">
            <label class="f">標語（最多 30 字）</label><input type="text" id="ps" maxlength="30" placeholder="例如：一坐就不想起來">
          </div>
          <div class="card"><h4>③ 背景</h4><div class="bgs" id="bgs"></div></div>
          <div class="card"><h4>④ 加東西</h4>
            <div class="row" style="flex-wrap:wrap"><button id="addText">＋ 文字</button><button id="addPrice">＋ 價格標籤</button><button id="addToilet">＋ 馬桶</button></div>
            <div class="emojis" id="emo" style="margin-top:8px"></div>
          </div>
          <div class="card"><h4><span>⑤ 畫筆塗鴉</span><button id="penToggle" style="padding:4px 10px;font-size:12px">開啟畫筆</button></h4>
            <div class="cols" id="penc"></div>
            <input type="range" id="penw" min="2" max="30" value="8" style="margin-top:6px">
            <button id="clearPen" style="font-size:12px;padding:4px 10px;margin-top:4px">清除塗鴉</button>
          </div>
        </div>
        <div class="center">
          <div class="cwrap"><canvas class="poster" id="cv" width="${W}" height="${H}"></canvas></div>
          <div class="acts">
            <button id="undo">↶ 復原</button>
            <span class="small muted" id="st">自動存檔中</span>
            <button class="primary" id="send" style="font-size:16px">✅ 完成送出</button>
          </div>
        </div>
        <div class="col">
          <div class="card" id="selcard"><h4>選取的物件</h4><div id="selbody" class="small muted">點海報上的文字、貼圖或馬桶來編輯。<br>拖曳移動，滾輪縮放，Delete 刪除。</div></div>
          <div class="card"><h4><span>📸 馬桶拍照</span><label class="small"><input type="checkbox" id="gnd"> 底座</label></h4>
            <div class="cam" id="cam"></div>
            <button id="snap" class="primary" style="width:100%;margin-top:8px">用這個角度</button>
          </div>
          ${U.store.get('gt_notes_' + S0.gameId, '') ? `<div class="card" style="background:#f6eff9"><h4>📝 你的靈感筆記</h4><div class="small" style="white-space:pre-wrap">${esc(U.store.get('gt_notes_' + S0.gameId, ''))}</div></div>` : ''}
          <div class="card"><h4><span>💬 市調金句</span><span class="small muted" id="qc"></span></h4><div class="small muted" style="margin-bottom:6px">點一下放進海報</div><div id="qs" style="display:flex;flex-direction:column;gap:5px;max-height:260px;overflow:auto"></div></div>
          <div class="card small"><div>市調平均願付：<b id="avg">—</b></div><div>董事長定價：<b id="off">—</b></div></div>
        </div>
      </div>`;

    const cv = $('#cv', root), c2 = cv.getContext('2d');
    $('#pn', root).value = doc.name || '';
    $('#ps', root).value = doc.slogan || '';

    // 範本
    const tplBox = $('#tpl', root);
    const T0 = templates();
    tplBox.innerHTML = Object.entries(T0).map(([k, t]) => `<button data-k="${k}">${esc(t.name)}</button>`).join('');
    $$('button', tplBox).forEach(b => b.onclick = () => {
      pushUndo();
      const t = templates(doc.name, doc.slogan)[b.dataset.k];
      const strokes = doc.strokes;
      doc = { bg: t.bg, items: JSON.parse(JSON.stringify(t.items)), strokes, name: doc.name, slogan: doc.slogan };
      sel = -1; syncRoles(); changed();
    });
    // 背景
    const bgBox = $('#bgs', root);
    bgBox.innerHTML = BGS.map((b, i) => `<button data-i="${i}" title="${esc(b.name)}" style="background:${b.sw}"></button>`).join('');
    $$('button', bgBox).forEach(b => b.onclick = () => { pushUndo(); doc.bg = +b.dataset.i; changed(); });
    // 貼圖
    const emo = $('#emo', root);
    emo.innerHTML = EMOJIS.map(e => `<button>${e}</button>`).join('');
    $$('button', emo).forEach(b => b.onclick = () => { pushUndo(); doc.items.push({ type: 'emoji', text: b.textContent, x: 300 + (Math.random() - .5) * 200, y: 400 + (Math.random() - .5) * 200, size: 70 }); sel = doc.items.length - 1; setMode('select'); changed(); });
    $('#addText', root).onclick = () => { pushUndo(); doc.items.push({ type: 'text', text: '在右側修改文字', x: 300, y: 560, size: 34, color: '#213c43', font: 'hei', weight: 800 }); sel = doc.items.length - 1; setMode('select'); changed(); setTimeout(() => { const i = $('#seltext', root); if (i) { i.focus(); i.select(); } }, 30); };
    $('#addPrice', root).onclick = () => { pushUndo(); doc.items.push({ type: 'text', role: 'price', text: '', x: 470, y: 640, size: 32, color: '#ffffff', font: 'hei', weight: 900, badge: '#d6453b' }); sel = doc.items.length - 1; setMode('select'); changed(); };
    $('#addToilet', root).onclick = () => { pushUndo(); doc.items.push({ type: 'img', role: 'toilet', x: 300, y: 420, w: 300, h: 300 }); sel = doc.items.length - 1; setMode('select'); changed(); };
    // 畫筆
    const penc = $('#penc', root);
    penc.innerHTML = PEN_COLORS.map(c => `<button data-c="${c}" style="background:${c}" aria-pressed="${c === pen.color}"></button>`).join('');
    $$('button', penc).forEach(b => b.onclick = () => { pen.color = b.dataset.c; $$('button', penc).forEach(x => x.setAttribute('aria-pressed', String(x === b))); setMode('draw'); });
    $('#penw', root).oninput = e => { pen.width = +e.target.value; };
    $('#penToggle', root).onclick = () => setMode(mode === 'draw' ? 'select' : 'draw');
    $('#clearPen', root).onclick = () => { pushUndo(); doc.strokes = []; changed(); };
    function setMode(m) { mode = m; $('#penToggle', root).textContent = m === 'draw' ? '關閉畫筆' : '開啟畫筆'; $('#penToggle', root).setAttribute('aria-pressed', String(m === 'draw')); cv.style.cursor = m === 'draw' ? 'crosshair' : 'default'; }

    // 命名
    let inputUndoT = 0;
    const onName = () => {
      if (Date.now() - inputUndoT > 1500) pushUndo();
      inputUndoT = Date.now();
      doc.name = $('#pn', root).value.trim(); doc.slogan = $('#ps', root).value.trim(); syncRoles(); changed();
    };
    $('#pn', root).oninput = onName; $('#ps', root).oninput = onName;

    function priceText() {
      const s = getState();
      const v = s.poster.officialPrice != null ? s.poster.officialPrice : s.poster.avgPrice;
      return v != null ? 'NT$' + Math.round(v).toLocaleString('zh-TW') : 'NT$ ??';
    }
    function syncRoles() {
      for (const it of doc.items) {
        if (it.role === 'name') it.text = doc.name || '產品名稱';
        if (it.role === 'slogan') it.text = doc.slogan || '在這裡寫標語';
        if (it.role === 'price' && !it.custom) it.text = priceText();
      }
    }

    // 馬桶拍照
    const camEl = $('#cam', root);
    const cam = new VoxelView(camEl, { preserve: true, ground: false, radius: 25, pitch: 0.42, overlay: false });
    cam.setBlocks(getBuild());
    camEl.style.background = 'repeating-conic-gradient(#eef1ec 0 25%,#fff 0 50%) 0 0/20px 20px';
    const snap = () => {
      const url = cam.snapshot(700);
      const im = new Image();
      im.onload = () => { imgs.toilet = im; render(); dirty = true; };
      im.src = url;
    };
    $('#snap', root).onclick = snap;
    $('#gnd', root).onchange = e => { cam.setGround(e.target.checked); };
    setTimeout(snap, 400);

    // 撤銷
    function pushUndo() { undo.push(JSON.stringify(doc)); if (undo.length > 40) undo.shift(); }
    $('#undo', root).onclick = () => { if (!undo.length) return; doc = JSON.parse(undo.pop()); sel = -1; $('#pn', root).value = doc.name || ''; $('#ps', root).value = doc.slogan || ''; changed(); };

    function changed() { dirty = true; render(); renderSel(); U.store.set(storeKey, JSON.stringify(doc)); }

    // 繪製
    function fontCss(it) { return `${it.weight || 700} ${it.size}px ${(FONTS[it.font] || FONTS.hei).css}`; }
    function textBox(ctx2, it) {
      ctx2.font = fontCss(it);
      let w = ctx2.measureText(it.text || ' ').width;
      let size = it.size;
      if (!it.badge && w > 570) { size = it.size * 570 / w; w = 570; }
      if (it.badge) { const r = Math.max(w / 2 + 22, size * 1.25); return { w: r * 2, h: r * 2, size, r }; }
      return { w, h: size * 1.15, size };
    }
    function drawItem(ctx2, it) {
      if (it.type === 'img') {
        const im = imgs[it.role];
        if (im) ctx2.drawImage(im, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h);
        else { ctx2.fillStyle = '#0001'; ctx2.fillRect(it.x - it.w / 2, it.y - it.h / 2, it.w, it.h); ctx2.fillStyle = '#0006'; ctx2.font = '20px sans-serif'; ctx2.textAlign = 'center'; ctx2.fillText('拍照中…', it.x, it.y); }
        return;
      }
      if (it.type === 'emoji') {
        ctx2.font = `${it.size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillText(it.text, it.x, it.y);
        return;
      }
      const bx = textBox(ctx2, it);
      ctx2.save();
      ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
      if (it.badge) {
        ctx2.translate(it.x, it.y); ctx2.rotate(-0.18);
        ctx2.fillStyle = it.badge;
        ctx2.beginPath();
        const spikes = 18, r1 = bx.r, r2 = bx.r * 0.84;
        for (let i = 0; i < spikes * 2; i++) { const r = i % 2 ? r2 : r1, a = i * Math.PI / spikes; ctx2.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx2.closePath(); ctx2.fill();
        ctx2.font = `${it.weight || 900} ${bx.size}px ${(FONTS[it.font] || FONTS.hei).css}`;
        ctx2.fillStyle = it.color;
        ctx2.fillText(it.text, 0, 2);
        ctx2.restore();
        return;
      }
      ctx2.font = `${it.weight || 700} ${bx.size}px ${(FONTS[it.font] || FONTS.hei).css}`;
      if (it.glow) { ctx2.shadowColor = it.glow; ctx2.shadowBlur = 18; }
      if (it.stroke) { ctx2.lineJoin = 'round'; ctx2.lineWidth = Math.max(3, bx.size * 0.14); ctx2.strokeStyle = it.stroke; ctx2.strokeText(it.text, it.x, it.y); }
      ctx2.fillStyle = it.color;
      ctx2.fillText(it.text, it.x, it.y);
      ctx2.restore();
    }
    function drawAll(ctx2, withSel) {
      ctx2.save();
      ctx2.clearRect(0, 0, W, H);
      (BGS[doc.bg] || BGS[0]).draw(ctx2);
      ctx2.restore();
      for (const it of doc.items) { ctx2.save(); drawItem(ctx2, it); ctx2.restore(); }
      ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
      for (const s of doc.strokes) {
        ctx2.strokeStyle = s.color; ctx2.lineWidth = s.width;
        ctx2.beginPath();
        s.pts.forEach((p, i) => i ? ctx2.lineTo(p[0], p[1]) : ctx2.moveTo(p[0], p[1]));
        if (s.pts.length === 1) ctx2.lineTo(s.pts[0][0] + .1, s.pts[0][1]);
        ctx2.stroke();
      }
      if (withSel && sel >= 0 && doc.items[sel]) {
        const b = bounds(doc.items[sel]);
        ctx2.save(); ctx2.setLineDash([8, 6]); ctx2.strokeStyle = '#2f8f8b'; ctx2.lineWidth = 2.5;
        ctx2.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx2.restore();
      }
    }
    function render() { drawAll(c2, true); }
    function bounds(it) {
      if (it.type === 'img') return { x: it.x - it.w / 2, y: it.y - it.h / 2, w: it.w, h: it.h };
      if (it.type === 'emoji') return { x: it.x - it.size * .6, y: it.y - it.size * .6, w: it.size * 1.2, h: it.size * 1.2 };
      const b = textBox(c2, it);
      return { x: it.x - b.w / 2, y: it.y - b.h / 2, w: b.w, h: b.h };
    }
    function hitTest(x, y) {
      for (let i = doc.items.length - 1; i >= 0; i--) {
        const b = bounds(doc.items[i]);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
      }
      return -1;
    }
    const toPoster = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };

    let drag = null;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const [x, y] = toPoster(e);
      if (mode === 'draw') { pushUndo(); const s = { color: pen.color, width: pen.width, pts: [[x, y]] }; doc.strokes.push(s); drag = { stroke: s }; render(); return; }
      const i = hitTest(x, y);
      sel = i;
      if (i >= 0) { pushUndo(); drag = { i, dx: x - doc.items[i].x, dy: y - doc.items[i].y }; }
      render(); renderSel();
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const [x, y] = toPoster(e);
      if (drag.stroke) { const pts = drag.stroke.pts, l = pts[pts.length - 1]; if (Math.hypot(l[0] - x, l[1] - y) > 2) pts.push([Math.round(x), Math.round(y)]); render(); return; }
      const it = doc.items[drag.i];
      it.x = Math.max(0, Math.min(W, x - drag.dx)); it.y = Math.max(0, Math.min(H, y - drag.dy));
      render();
    });
    const end = () => { if (drag) { drag = null; changed(); } };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => {
      if (sel < 0) return;
      e.preventDefault();
      scaleSel(e.deltaY < 0 ? 1.07 : 1 / 1.07);
    }, { passive: false });
    function scaleSel(f) {
      const it = doc.items[sel]; if (!it) return;
      if (it.type === 'img') { it.w = Math.max(60, Math.min(900, it.w * f)); it.h = it.w; }
      else it.size = Math.max(10, Math.min(220, it.size * f));
      changed();
    }
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0) { pushUndo(); doc.items.splice(sel, 1); sel = -1; changed(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { $('#undo', root).click(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    // 右側：選取物件設定
    function renderSel() {
      const body = $('#selbody', root);
      const it = doc.items[sel];
      if (!it) { body.innerHTML = '點海報上的文字、貼圖或馬桶來編輯。<br>拖曳移動，滾輪縮放，Delete 刪除。'; body.className = 'small muted'; return; }
      body.className = '';
      let html = '';
      if (it.type === 'text') {
        const roleNote = it.role === 'name' ? '（連動產品名稱）' : it.role === 'slogan' ? '（連動標語）' : it.role === 'price' ? '（價格標籤）' : '';
        html += `<label class="f">文字 ${roleNote}</label><input type="text" id="seltext" maxlength="30" value="${esc(it.text)}" ${it.role === 'name' || it.role === 'slogan' ? 'disabled' : ''}>`;
        html += `<label class="f">顏色</label><div class="cols" id="selcol">${TEXT_COLORS.map(c => `<button data-c="${c}" style="background:${c}" aria-pressed="${c === it.color}"></button>`).join('')}</div>`;
        html += `<label class="f">字體</label><select id="selfont" style="width:100%">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${k === it.font ? 'selected' : ''}>${f.name}</option>`).join('')}</select>`;
        html += `<div class="row small" style="margin-top:6px"><label><input type="checkbox" id="selstroke" ${it.stroke ? 'checked' : ''}> 描邊</label><label><input type="checkbox" id="selglow" ${it.glow ? 'checked' : ''}> 發光</label></div>`;
      }
      html += `<div class="seltools"><button id="selbig">放大 ＋</button><button id="selsmall">縮小 －</button><button id="selfront">移到最上層</button><button id="seldel" class="danger">刪除</button></div>`;
      body.innerHTML = html;
      const ti = $('#seltext', body);
      if (ti) ti.oninput = () => { if (Date.now() - inputUndoT > 1500) pushUndo(); inputUndoT = Date.now(); it.text = ti.value; if (it.role === 'price') it.custom = true; dirty = true; render(); U.store.set(storeKey, JSON.stringify(doc)); };
      $$('#selcol button', body).forEach(b => b.onclick = () => { pushUndo(); it.color = b.dataset.c; changed(); });
      const sf = $('#selfont', body); if (sf) sf.onchange = () => { pushUndo(); it.font = sf.value; changed(); };
      const ss = $('#selstroke', body); if (ss) ss.onchange = () => { pushUndo(); it.stroke = ss.checked ? (isLight(it.color) ? '#111111' : '#ffffff') : null; changed(); };
      const sg = $('#selglow', body); if (sg) sg.onchange = () => { pushUndo(); it.glow = sg.checked ? it.color : null; changed(); };
      $('#selbig', body).onclick = () => { pushUndo(); scaleSel(1.15); };
      $('#selsmall', body).onclick = () => { pushUndo(); scaleSel(1 / 1.15); };
      $('#selfront', body).onclick = () => { pushUndo(); doc.items.push(doc.items.splice(sel, 1)[0]); sel = doc.items.length - 1; changed(); };
      $('#seldel', body).onclick = () => { pushUndo(); doc.items.splice(sel, 1); sel = -1; changed(); };
    }
    function isLight(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) > 160; }

    // 金句
    $('#qs', root).addEventListener('click', e => {
      const b = e.target.closest('button[data-q]'); if (!b) return;
      pushUndo();
      doc.items.push({ type: 'text', text: '「' + b.dataset.q + '」', x: 300, y: 600, size: 28, color: '#213c43', font: 'hei', weight: 800, stroke: '#ffffff' });
      sel = doc.items.length - 1; setMode('select'); changed();
    });

    // 送出
    function exportImg() {
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o2 = off.getContext('2d');
      drawAll(o2, false);
      return off.toDataURL('image/jpeg', 0.86);
    }
    function sendPoster(final) {
      if (!imgs.toilet && !final) return;
      const img = exportImg();
      net.send({ t: 'poster', img, name: doc.name || '', slogan: doc.slogan || '', final: !!final });
      lastSent = Date.now(); dirty = false;
      $('#st', root).textContent = final ? '已送出 ✓（還可以再改、再送）' : '草稿已存 ' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    $('#send', root).onclick = () => { if (!doc.name) { U.toast('先幫產品取個名字吧！', 'warn'); $('#pn', root).focus(); return; } sendPoster(true); U.toast('海報送出！大螢幕上看得到 🎉'); };

    let lastQuotes = '';
    return {
      update() {
        const s = getState();
        $('#avg', root).textContent = U.money(s.poster.avgPrice);
        $('#off', root).textContent = U.money(s.poster.officialPrice);
        const qkey = s.poster.quotes.map(q => q.by + q.at).join('|');
        if (qkey !== lastQuotes) {
          lastQuotes = qkey;
          $('#qc', root).textContent = s.poster.quotes.length + ' 則';
          $('#qs', root).innerHTML = s.poster.quotes.map(q => `<button class="quote" data-q="${esc(q.quote)}">「${esc(q.quote)}」<small>${esc(who(q.by))} · 願付 ${U.money(q.price)}</small></button>`).join('') || '<div class="small muted">等其他同仁送出市調…</div>';
        }
        // 價格標籤跟著定價更新
        let pc = false;
        for (const it of doc.items) if (it.role === 'price' && !it.custom) { const t = priceText(); if (it.text !== t) { it.text = t; pc = true; } }
        if (pc) { dirty = true; render(); }
        const yv = getYou();
        const locked = s.timeUp;
        $('#send', root).disabled = locked && yv && yv.poster && yv.poster.submitted;
        if (locked && !finalSent) {
          finalSent = true;
          if (!(yv && yv.poster && yv.poster.submitted)) { sendPoster(true); U.toast('時間到！已自動幫你送出海報'); }
          $('#st', root).textContent = '時間到，海報已鎖定';
        }
      },
      tick() {
        const s = getState();
        if (s.timeUp) return;
        if (dirty && Date.now() - lastSent > 12000 && imgs.toilet) sendPoster(false);
        if (Date.now() - lastSave > 3000) { lastSave = Date.now(); }
      },
      refreshModel() { cam.setBlocks(getBuild()); },
      unmount() { window.removeEventListener('keydown', onKey); cam.dispose(); }
    };
  }

  window.PosterEditor = { mount };
})();

