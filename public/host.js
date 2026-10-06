/* 金馬桶專案 — 大螢幕／主持人 */
(function () {
  'use strict';
  const G = window.GAME, { $, $$, esc, h } = U;
  const qs = new URLSearchParams(location.search);
  const KEY = qs.get('key') || '';
  const stage = $('#stage'), ctl = $('#ctl');
  // 辦公室實況：off / split（下方）/ full（全螢幕）
  const viewQ = qs.get('view');
  let ovMode = viewQ === 'office' ? 'full' : (U.store.get('gt_office', 'split') || 'split');
  let office = null;
  function applyOv() {
    document.body.classList.remove('ov-split', 'ov-full', 'ov-off');
    document.body.classList.add('ov-' + ovMode);
    if (ovMode !== 'off' && !office && window.OfficeView) {
      try { office = new OfficeView($('#office')); window.__office = office; if (S) office.setState(S); } catch (e) { console.error('辦公室畫面無法啟動', e); }
    }
    if (ctl.dataset) { ctl.dataset.key = ''; }
  }
  const net = new Net({ host: !!KEY, key: KEY, office: true });

  let S = null, builds = { A: {}, B: {} }, isHost = false, netInfo = null, isCloud = false;
  setTimeout(applyOv, 0);
  let recentStickers = [];
  let cur = { key: null, ctl: null };
  const viewsByTeam = new Set();
  let drawer = null;

  const pById = id => (S ? S.players.find(p => p.id === id) : null);
  const who = id => { const p = pById(id); return p ? `${p.title} ${p.name}` : ''; };

  let welcomed = false;
  net.on('welcome', m => {
    if (isHost !== !!m.host) cur.key = null; // 權限改變就重畫
    welcomed = true;
    S = m.s; builds = m.builds || builds; isHost = !!m.host; isCloud = !!m.cloud; if (m.net) netInfo = m.net;
    recentStickers = (m.stickers || []).map(s => Object.assign({}, s, { localAt: Date.now() - Math.max(0, S.serverNow - s.at) }));
    for (const v of viewsByTeam) v.view.setBlocks(builds[v.team] || {});
    if (!netInfo) fetch('/api/info').then(r => r.json()).then(j => { netInfo = j; if (cur.ctl && cur.ctl.update) cur.ctl.update(); }).catch(() => {});
    render();
  });
  net.on('toast', m => U.toast(m.msg, m.kind));
  net.on('err', m => U.toast(m.msg, 'warn'));
  net.on('hostDenied', () => { U.toast('主持人密碼不對，只能觀看大螢幕', 'warn'); });
  net.on('state', m => { if (!welcomed) return; S = m.s; render(); });
  net.on('close', () => { welcomed = false; });
  net.on('ops', m => {
    const b = builds[m.team];
    for (const o of m.ops) { const k = o[1] + ',' + o[2] + ',' + o[3]; if (o[0] === 1) b[k] = { c: o[4], by: o[5] }; else delete b[k]; }
    for (const v of viewsByTeam) if (v.team === m.team) v.view.applyOps(m.ops);
    if (office) office.onOps(m.team, m.ops);
    if (!opsRaf && cur.ctl && cur.ctl.update) opsRaf = requestAnimationFrame(() => { opsRaf = 0; if (cur.ctl && cur.ctl.update) cur.ctl.update(); });
  });
  let opsRaf = 0;
  net.on('builds', m => { builds = m.builds; for (const v of viewsByTeam) v.view.setBlocks(builds[v.team] || {}); });
  net.on('reset', () => { recentStickers = []; builds = { A: {}, B: {} }; for (const v of viewsByTeam) v.view.setBlocks({}); });
  net.on('act', m => { if (office) office.onAct(m); });
  net.on('fx', f => {
    if (office) office.onFx(f);
    if (f.kind === 'countdown') return countdown(f.openAt);
    if (f.kind === 'sticker') {
      const s = Object.assign({}, f, { localAt: Date.now() });
      recentStickers.push(s); if (recentStickers.length > 40) recentStickers.shift();
      for (const v of viewsByTeam) if (v.team === s.team && v.stickers) v.view.addSticker(s, who(s.by));
    }
    if (f.kind === 'banner') for (const v of viewsByTeam) if (v.team === f.team && v.stickers) v.view.banner('📣 ' + f.text, who(f.by));
    if (f.kind === 'visit') for (const v of viewsByTeam) if (v.team === f.team && v.stickers) { v.view.banner('👀 董事長來巡視了！', '研發同仁看起來很忙', 'visit'); v.view.shake(); }
    if (f.kind === 'react') for (const v of viewsByTeam) if ((!f.team || v.team === f.team) && v.stickers) v.view.floatEmoji(f.emoji);
    if (f.kind === 'bossPick' && f.changes > 0) U.toast(`😱 董事長改變心意了！（第 ${f.changes} 次）`);
    if (f.kind === 'timeup') U.toast('⏰ 時間到！');
    if (f.kind === 'posterDone') U.toast(`🎨 ${who(f.by)} 交出海報了！`);
  });

  function countdown(openAt) {
    const el = h('<div class="big-count" style="pointer-events:none"></div>');
    document.body.appendChild(el);
    const tick = () => {
      const left = openAt - net.now();
      if (left > 0) { el.textContent = Math.ceil(left / 1000); requestAnimationFrame(tick); }
      else { el.textContent = 'GO!'; el.classList.add('go'); setTimeout(() => el.remove(), 900); }
    };
    tick();
  }

  function addView(container, team, opts) {
    const view = new VoxelView(container, Object.assign({ autoRotate: true, radius: 29 }, opts));
    view.setBlocks(builds[team] || {});
    const rec = { team, view, stickers: !!(opts && opts.stickers) };
    viewsByTeam.add(rec);
    if (rec.stickers) for (const s of recentStickers) if (s.team === team && Date.now() - s.localAt < 21000) view.addSticker(s, who(s.by));
    return rec;
  }

  // ---------------------------------------------------------------- 畫面切換
  function render() {
    if (!S) return;
    if (office) office.setState(S);
    const key = S.phase;
    if (key !== cur.key) {
      if (cur.ctl && cur.ctl.unmount) cur.ctl.unmount();
      for (const v of [...viewsByTeam]) { v.view.dispose(); viewsByTeam.delete(v); }
      stage.innerHTML = '';
      cur = { key, ctl: (SCREENS[key] || (() => ({})))(stage) || {} };
    }
    if (cur.ctl.update) cur.ctl.update();
    $('#steps').innerHTML = U.stepsHTML(S.phase);
    const online = S.players.filter(p => p.online).length;
    $('#conncount').textContent = `👥 ${S.players.length} 人報到 · ${online} 人在線`;
    renderCtl();
    if (drawer && drawer.update) drawer.update();
  }

  setInterval(() => {
    if (!S) return;
    const t = timerText(S, net);
    const el = $('#timer'); el.textContent = t.text; el.className = 'timer ' + t.cls;
    if (cur.ctl && cur.ctl.tick) cur.ctl.tick();
  }, 250);

  const briefNow = () => (S.brief.choice != null ? G.BRIEFS[S.brief.choice] : null);
  // 讓 n 張 3:4 卡片剛好塞進容器
  function fitGrid(el, n, extra) {
    const w = el.clientWidth, hgt = el.clientHeight, gap = 14;
    if (!w || !hgt || !n) return;
    let best = 1, bestW = 0;
    for (let c = 1; c <= n; c++) {
      const rows = Math.ceil(n / c);
      const cw = (w - gap * (c - 1)) / c;
      const ch = cw * 4 / 3 + (extra || 46);
      const totalH = rows * ch + gap * (rows - 1);
      const scale = totalH > hgt ? hgt / totalH : 1;
      const eff = cw * scale;
      if (eff > bestW) { bestW = eff; best = c; }
    }
    const cw = Math.min(bestW, (w - gap * (best - 1)) / best);
    el.style.gridTemplateColumns = `repeat(${best}, ${Math.floor(cw)}px)`;
    el.style.justifyContent = 'center';
  }
  const tp = (p, cls) => `<div class="tp ${cls || ''}" style="opacity:${p.online ? 1 : .5}">${U.avatar(p)}<div style="min-width:0;display:flex;flex-direction:column"><b>${esc(p.name)}</b><small>${esc(p.title)}</small></div></div>`;

  // ---------------------------------------------------------------- 各階段
  const SCREENS = {};

  SCREENS.lobby = root => {
    root.innerHTML = `
      <div class="lobby">
        <div class="qrbox">
          <div class="eyebrow">用手機掃描或在筆電輸入網址</div>
          <canvas id="qr" width="400" height="400"></canvas>
          <div class="url" id="url">…</div>
          <div class="small muted" id="urlhint"></div>
          <div class="steps3">${isCloud ? '① 公司網路、手機網路都可以' : '① 連上公司網路'}<br>② 掃 QR code 或在瀏覽器輸入上面網址<br>③ 先打好名字，倒數結束立刻按「報到」</div>
        </div>
        <div class="race">
          <div class="eyebrow">STEP 1 · 報到搶職位</div>
          <h1 class="big">最快報到的人，就是董事長。</h1>
          <p style="font-size:20px;color:#4e6962;margin-top:6px">越晚報到，職位越基層。<b id="ost"></b></p>
          <div class="podium" id="pod"></div>
          <div class="row" style="margin:4px 0 8px"><b style="font-size:18px">其他同仁</b><span class="muted" id="cnt"></span><span class="grow"></span>${isHost ? '<button id="botBtn" title="一個人測試用">🤖 加測試機器人</button><button class="gold" id="openBtn" style="font-size:20px;padding:12px 26px">🔔 開放報到（倒數 3 秒）</button>' : ''}</div>
          <div class="chips-wall" id="wall"></div>
        </div>
      </div>`;
    let lastUrl = '';
    if (isHost) { $('#openBtn', root).onclick = () => net.send({ t: 'h.openLobby' }); $('#botBtn', root).onclick = () => openDrawer('people'); }
    return {
      update() {
        // QR
        const local = /^(localhost|127\.|::1|\[::1\])/.test(location.hostname);
        let base;
        if (!local) base = location.protocol + '//' + location.host;
        else if (netInfo && netInfo.ips.length) {
          const pref = U.store.get('gt_ip', '');
          const ip = (netInfo.ips.find(i => i.address === pref) || netInfo.ips[0]).address;
          base = 'http://' + ip + ':' + netInfo.port;
        } else base = location.protocol + '//' + location.host;
        if (base !== lastUrl) {
          lastUrl = base;
          const shown = base.replace(/^https?:\/\//, '');
          $('#url', root).textContent = shown;
          $('#url', root).style.fontSize = shown.length > 30 ? '18px' : shown.length > 22 ? '22px' : '';
          try {
            const q = qrcode(0, 'M'); q.addData(base + '/'); q.make();
            const n = q.getModuleCount(), cv = $('#qr', root), c = cv.getContext('2d');
            const cell = Math.floor(400 / (n + 4)), off = Math.floor((400 - cell * n) / 2);
            c.fillStyle = '#fff'; c.fillRect(0, 0, 400, 400); c.fillStyle = '#1d3840';
            for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(off + k * cell, off + r * cell, cell, cell);
          } catch (e) { /* ignore */ }
          const others = local && netInfo ? netInfo.ips.map(i => 'http://' + i.address + ':' + netInfo.port).filter(x => x !== base).slice(0, 3) : [];
          $('#urlhint', root).innerHTML = others.length ? '連不上的話也可以試：<br>' + others.map(x => esc(x.replace(/^http:\/\//, ''))).join('<br>') : '';
        }
        const ps = S.players.slice().sort((a, b) => a.joinIdx - b.joinIdx);
        const slots = [
          { lab: '👑 董事長', cls: 'boss', color: '#8a5d14' },
          { lab: '第一研發部 處長', color: G.TEAMS.A.color },
          { lab: '第二研發部 處長', color: G.TEAMS.B.color },
          { lab: '行銷處 處長', color: G.TEAMS.M.color }
        ];
        $('#pod', root).innerHTML = slots.map((s, i) => {
          const p = ps[i];
          return `<div class="slot ${s.cls || ''} ${p ? 'filled' : ''}" ${p ? '' : ''}><div class="lab" style="color:${s.color}">${s.lab} · 第 ${i + 1} 位</div>${p ? `<div class="nm">${esc(p.name)}</div><div class="ms">+${(p.joinMs / 1000).toFixed(3)} 秒</div>` : '<div class="nm" style="color:#c8d4c9">？</div>'}</div>`;
        }).join('');
        const rest = ps.slice(4);
        $('#cnt', root).textContent = `共 ${ps.length} 人報到`;
        const max = 70;
        $('#wall', root).innerHTML = rest.slice(0, max).map(p => `<div class="nchip">${U.avatar(p)}<b>${esc(p.name)}</b><i>#${p.joinIdx}</i></div>`).join('') + (rest.length > max ? `<div class="nchip"><b>＋${rest.length - max} 人</b></div>` : '');
        const open = S.lobby.open;
        $('#ost', root).textContent = open ? (S.lobby.openAt > net.now() ? '倒數中…' : '報到開放中！') : '準備好名字，等主持人倒數。';
        const ob = $('#openBtn', root); if (ob) ob.classList.toggle('hidden', open);
      }
    };
  };

  SCREENS.roles = root => {
    root.innerHTML = `<div class="org"><div class="row"><div><div class="eyebrow">STEP 2 · 人事命令</div><h1 class="big" style="font-size:36px">即日起，組織如下</h1></div><span class="grow"></span><div class="bossrow" id="boss"></div></div><div class="teams3" id="t3"></div></div>`;
    return {
      update() {
        const boss = S.players.find(p => p.rank === 'boss');
        $('#boss', root).innerHTML = boss ? `<div class="ocard boss"><div class="t">👑 董事長</div><div class="n">${esc(boss.name)}</div></div>` : '';
        const order = { lead: 0, manager: 1, staff: 2, intern: 3 };
        $('#t3', root).innerHTML = ['A', 'B', 'M'].map(t => {
          const list = S.players.filter(p => p.team === t).sort((a, b) => order[a.rank] - order[b.rank] || a.joinIdx - b.joinIdx);
          return `<div class="tcol" style="--tc:${G.TEAMS[t].color}"><h3>${esc(G.TEAMS[t].name)} <span class="muted" style="font-size:14px">${list.length} 人 · ${t === 'M' ? '負責上市海報' : G.TEAMS[t].plan}</span></h3><div class="tgrid">${list.map(p => tp(p, p.rank === 'lead' ? 'lead' : p.rank === 'manager' ? 'mgr' : '')).join('')}</div></div>`;
        }).join('');
      }
    };
  };

  SCREENS.brief = root => {
    root.innerHTML = `<div class="pad"><div class="eyebrow">STEP 3 · 開案</div><h1 class="big" id="bt"></h1><div class="briefs" id="bg"></div></div>`;
    return {
      update() {
        const boss = S.players.find(p => p.rank === 'boss');
        const c = S.brief.choice;
        $('#bt', root).textContent = c == null ? `董事長 ${boss ? boss.name : ''}，這座馬桶要賣給誰？` : `董事長拍板：給${G.BRIEFS[c].name}的馬桶！`;
        $('#bg', root).innerHTML = G.BRIEFS.map((b, i) => `<div class="bcard${c === i ? ' chosen' : c != null ? ' dim' : ''}"><span class="ic">${b.icon}</span><b>${esc(b.name)}</b><span class="tag">「${esc(b.tag)}」</span><p>${esc(b.text)}</p>${c === i ? `<div class="stamp" style="font-size:30px;top:62%">${S.brief.auto ? '系統代選' : '董事長拍板'}</div>` : ''}</div>`).join('');
      }
    };
  };

  function duo(root, mode) {
    const b = briefNow();
    root.innerHTML = `<div style="display:flex;flex-direction:column;height:100%">
      ${b && mode === 'build' ? `<div class="reqbar">${b.icon} 開案需求：給<b>${esc(b.name)}</b>的馬桶 —「${esc(b.tag)}」・${esc(b.text)}</div>` : ''}
      <div class="duo" style="flex:1;min-height:0;height:auto">${['A', 'B'].map(t => `
        <div class="dcol" style="--tc:${G.TEAMS[t].color}">
          <div class="dhead"><b>${G.TEAMS[t].plan}</b><span class="muted" style="font-size:18px">${esc(G.TEAMS[t].name)} · <span id="m${t}"></span></span><span class="cnt" id="c${t}"></span></div>
          ${mode === 'build' ? `<div class="dirb hidden" id="d${t}"></div>` : ''}
          <div id="v${t}" style="position:relative"></div>
          ${mode === 'review' ? `<div class="vrow"><span style="color:${G.TEAMS[t].color}">民意</span><div class="vbar"><i id="bar${t}" style="background:${G.TEAMS[t].color};width:0"></i></div><span id="tal${t}" style="min-width:80px;text-align:right"></span></div>` : ''}
        </div>`).join('')}
      </div></div>`;
    for (const t of ['A', 'B']) {
      const el = $('#v' + t, root); el.style.flex = '1'; el.style.minHeight = '0';
      addView(el, t, { stickers: mode === 'build', radius: mode === 'build' ? 27 : 30, yaw: t === 'A' ? 0.75 : 2.3 });
    }
    let lastPick = null;
    return {
      update() {
        for (const t of ['A', 'B']) {
          const mem = S.players.filter(p => p.team === t);
          $('#m' + t, root).textContent = `${mem.length} 人`;
          $('#c' + t, root).textContent = `${Object.keys(builds[t] || {}).length} 塊`;
          if (mode === 'build') {
            const bn = S.banners[t], d = $('#d' + t, root);
            if (bn) { d.classList.remove('hidden'); d.innerHTML = `📣 方向調整：${esc(bn.text)} <span class="muted">— ${esc(who(bn.by))}</span>`; } else d.classList.add('hidden');
          }
        }
        if (mode === 'review') {
          const tl = S.review.tally, tot = Math.max(1, tl.A + tl.B);
          for (const t of ['A', 'B']) { $('#bar' + t, root).style.width = (tl[t] / tot * 100) + '%'; $('#tal' + t, root).textContent = tl[t] + ' 票'; }
          if (S.review.bossPick !== lastPick) {
            lastPick = S.review.bossPick;
            $$('.stamp', root).forEach(e => e.remove());
            if (lastPick) {
              const other = lastPick === 'A' ? 'B' : 'A';
              const against = tl[other] > tl[lastPick];
              $('#v' + lastPick, root).appendChild(h(`<div class="stamp" style="font-size:56px">董事長拍板<small style="font-size:20px">${against ? '（無視民意）' : '上市！'}${S.review.changes ? ` · 改變心意 ${S.review.changes} 次` : ''}</small></div>`));
            }
          }
        }
      }
    };
  }
  SCREENS.build = root => duo(root, 'build');
  SCREENS.review = root => duo(root, 'review');

  SCREENS.poster = root => {
    const win = S.review.winner || 'A';
    root.innerHTML = `
      <div class="promo">
        <div class="pleft">
          <div><div class="eyebrow">STEP 6 · 上市推廣</div><b style="font-size:24px;color:${G.TEAMS[win].color}">🏆 ${G.TEAMS[win].plan}（${esc(G.TEAMS[win].name)}）</b></div>
          <div id="vx"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="pstat"><div class="small muted">市調平均願付 · <span id="sc"></span></div><div class="big" id="avg">—</div></div>
            <div class="pstat"><div class="small muted">董事長定價</div><div class="big" id="op">—</div></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;min-height:0">
          <h2 style="font-size:28px;margin-bottom:10px">行銷處海報製作中 <span class="muted" style="font-size:16px" id="pc"></span></h2>
          <div class="pgrid" id="pg" style="flex:1;min-height:0"></div>
        </div>
      </div>
      <div class="ticker"><span id="tk"></span></div>`;
    const el = $('#vx', root); el.style.flex = '1'; el.style.minHeight = '0';
    addView(el, win, { radius: 27 });
    const seen = {};
    let tkKey = '';
    return {
      update() {
        $('#avg', root).textContent = U.money(S.poster.avgPrice);
        $('#sc', root).textContent = `${S.poster.surveyCount} 人回覆`;
        $('#op', root).textContent = S.poster.officialPrice != null ? U.money(S.poster.officialPrice) : '尚未定價';
        const makers = S.poster.makers.map(pById).filter(Boolean);
        const posters = {}; for (const x of S.poster.posters) posters[x.author] = x;
        const done = S.poster.posters.filter(x => x.submitted).length;
        $('#pc', root).textContent = `${done} / ${makers.length} 已完成`;
        const pg = $('#pg', root);
        const ids = makers.map(m => m.id).join(',');
        if (pg.dataset.ids !== ids) {
          pg.dataset.ids = ids;
          pg.innerHTML = makers.map(m => `<div class="pcard" data-id="${m.id}"><img alt=""><span class="tag hidden">✓ 完成</span><div class="m"><b>${esc(m.name)}</b> <span class="muted">${esc(m.title)}</span></div></div>`).join('');
          for (const k in seen) delete seen[k];
        }
        fitGrid(pg, makers.length, 34);
        for (const m of makers) {
          const card = pg.querySelector(`[data-id="${m.id}"]`); if (!card) continue;
          const x = posters[m.id];
          if (x && x.hasImg && seen[m.id] !== x.v) { seen[m.id] = x.v; card.querySelector('img').src = `/poster/${m.id}.jpg?v=${x.v}`; }
          card.querySelector('.tag').classList.toggle('hidden', !(x && x.submitted));
          const nm = x && x.name ? `「${x.name}」` : '';
          card.querySelector('.m').innerHTML = `<b>${esc(m.name)}</b> <span class="muted">${esc(nm || m.title)}</span>`;
        }
        const k = S.poster.quotes.map(q => q.by + q.at).join('|');
        if (k !== tkKey) { tkKey = k; $('#tk', root).textContent = S.poster.quotes.length ? S.poster.quotes.map(q => `「${q.quote}」— ${who(q.by)}（願付 ${U.money(q.price)}）`).join('　　✦　　') : '市調進行中：你願意花多少錢買這座馬桶？'; }
      }
    };
  };

  SCREENS.gallery = root => {
    root.innerHTML = `<div class="pad" style="display:flex;flex-direction:column;min-height:0"><div class="row"><div><div class="eyebrow">STEP 7 · 海報評選</div><h1 class="big" style="font-size:36px" id="gt">全員投票，董事長選官方海報</h1></div></div><div class="pgrid" id="pg" style="margin-top:14px;flex:1;min-height:0"></div></div>`;
    return {
      update() {
        const list = S.poster.posters.filter(x => x.hasImg).sort((a, b) => (S.gallery.tally[b.author] || 0) - (S.gallery.tally[a.author] || 0));
        const pick = S.gallery.bossPick;
        $('#gt', root).textContent = pick ? `👑 董事長選了 ${who(pick)} 的海報！` : '全員投票，董事長選官方海報';
        const n = list.length;
        const pg = $('#pg', root);
        fitGrid(pg, n, 34);
        pg.innerHTML = n ? list.map(x => {
          const a = pById(x.author) || { name: '?', title: '' };
          return `<div class="pcard${pick === x.author ? ' official' : ''}"><img src="/poster/${x.author}.jpg?v=${x.v}" alt=""><span class="votes">❤ ${S.gallery.tally[x.author] || 0}</span>${pick === x.author ? '<span class="tag" style="background:#c88d2e">👑 官方</span>' : ''}<div class="m"><b>${esc(x.name || '（未命名）')}</b> <span class="muted">${esc(a.name)}</span></div></div>`;
        }).join('') : '<div class="empty">行銷處還沒有交出海報</div>';
      }
    };
  };

  SCREENS.launch = root => {
    root.innerHTML = '<div class="launch" id="ln"></div>';
    setTimeout(() => U.confetti(null, 220), 300);
    let built = false;
    return {
      update() {
        const L = S.launch; if (!L) return;
        const off = L.official ? S.poster.posters.find(x => x.author === L.official) : null;
        const b = briefNow();
        const win = L.winner || 'A';
        const winners = S.players.filter(x => x.team === win);
        const aw = [
          ['🧱', '最勤勞基層', L.awards.worker, v => `放了 ${v} 塊積木`],
          ['☝️', '最愛指點江山主管', L.awards.micromanager, v => `貼了 ${v} 次意見`],
          ['💸', '最敢花錢客人', L.awards.rich, v => `願付 ${U.money(v)}`],
          ['📣', '最佳啦啦隊', L.awards.cheer, v => `按了 ${v} 次反應`],
          ['😴', '偷懶王', (() => { const k = office && office.slackKing(); return k && k.ms > 15000 ? { id: k.id, value: k.ms } : null; })(), v => `累計摸魚 ${Math.round(v / 1000)} 秒`]
        ].filter(x => x[2]);
        const boss = S.players.find(p => p.rank === 'boss');
        if (!built) {
          built = true;
          root.querySelector('#ln').innerHTML = `
            <div>${off ? `<img class="off" src="/poster/${off.author}.jpg?v=${off.v}" alt="官方海報">` : ''}</div>
            <div class="lmid">
              <div class="eyebrow">STEP 8 · 上市發表會</div>
              <h1>🎉 ${esc((off && off.name) || '金馬桶')} 正式上市</h1>
              <p style="font-size:22px;color:#4e6962;margin:6px 0">${esc((off && off.slogan) || '')}</p>
              <div id="vx"></div>
              <div class="row" style="gap:16px;font-size:17px;flex-wrap:wrap"><span style="white-space:nowrap">${b ? `${b.icon} 給${esc(b.name)}` : ''}</span><span style="white-space:nowrap">${G.TEAMS[win].plan} · ${L.blocks} 塊積木</span><span style="font-size:clamp(26px,2.6vw,42px);font-weight:900;color:#24484e;margin-left:auto;white-space:nowrap">${U.money(L.price)}</span></div>
            </div>
            <div style="overflow:hidden">
              <h2 style="font-size:24px;margin-bottom:6px">🏅 今日獎項</h2>
              ${aw.map(a => `<div class="award"><span class="ic">${a[0]}</span><div><div class="small muted">${a[1]}</div><b>${esc(who(a[2].id))}</b><div class="small muted">${a[3](a[2].value)}</div></div></div>`).join('')}
              <h3 style="margin:16px 0 4px">製作團隊</h3>
              <p class="small" style="line-height:1.8">👑 董事長：${esc(boss ? boss.name : '—')}<br>🏗 ${esc(G.TEAMS[win].name)}：${winners.map(x => esc(x.name)).join('、') || '—'}<br>🎨 海報：${off ? esc(who(off.author)) : '—'}</p>
              <p class="small muted" style="margin-top:10px">市調平均願付 ${U.money(L.avgPrice)}${isCloud ? '' : ' · 成果已存到「活動成果」資料夾'}</p>
              ${isHost ? `<a class="dl" href="/api/results.zip?key=${encodeURIComponent(KEY)}" style="display:inline-block;margin-top:8px;padding:8px 14px;border-radius:10px;background:#24484e;color:#fff;text-decoration:none;font-size:14px">⬇ 下載活動成果（海報＋名單）</a>` : ''}
            </div>`;
          const el = $('#vx', root); el.style.flex = '1'; el.style.minHeight = '0'; el.style.margin = '6px 0';
          addView(el, win, { radius: 26 });
        }
      }
    };
  };

  // ---------------------------------------------------------------- 主持人控制列
  function renderCtl() {
    if (!isHost) { ctl.classList.add('hidden'); return; }
    ctl.classList.remove('hidden');
    const i = G.PHASE_IDS.indexOf(S.phase);
    const next = G.PHASES[i + 1];
    const timed = S.phaseEndsAt || S.pausedRemaining != null;
    const key = [S.phase, !!timed, S.pausedRemaining != null, S.lobby.open, ctl.classList.contains('min')].join('|');
    if (ctl.dataset.key === key) return;
    ctl.dataset.key = key;
    ctl.innerHTML = `
      <b class="keep" style="color:#efbd5d">主持人</b>
      <button data-a="prev" ${i === 0 ? 'disabled' : ''}>◀</button>
      <div class="ph">${G.PHASES.map((p, j) => `<button data-ph="${p.id}" aria-pressed="${j === i}">${j + 1}.${p.name}</button>`).join('')}</div>
      ${next ? `<button class="go" data-a="next">下一步：${next.long} ▶</button>` : ''}
      <span class="sep"></span>
      ${S.phase === 'lobby' ? (S.lobby.open ? '<button data-a="closeLobby">暫停報到</button>' : '<button class="go" data-a="openLobby">🔔 開放報到</button>') : ''}
      ${timed ? `<button data-a="t-30">−30秒</button><button data-a="pause">${S.pausedRemaining != null ? '▶ 繼續' : '⏸ 暫停'}</button><button data-a="t30">＋30秒</button><button data-a="endNow">結束計時</button>` : '<button data-a="t60">⏱ 加 1 分鐘計時</button>'}
      <span class="sep"></span>
      <button data-a="people">👥 人員</button>
      <button data-a="settings">⚙ 設定</button>
      <button data-a="ov">🏢 辦公室：${ovMode === 'split' ? '下方' : ovMode === 'full' ? '全螢幕' : '關閉'}</button>
      <button data-a="fs">⛶ 全螢幕</button>
      <button class="keep" data-a="min" title="快捷鍵 H">${ctl.classList.contains('min') ? '▲ 控制列' : '▼'}</button>`;
  }
  ctl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ph) {
      if (b.dataset.ph === S.phase) return;
      if (G.PHASE_IDS.indexOf(b.dataset.ph) < G.PHASE_IDS.indexOf(S.phase) && !confirm('要跳回「' + G.PHASES.find(p => p.id === b.dataset.ph).long + '」嗎？')) return;
      net.send({ t: 'h.phase', phase: b.dataset.ph }); return;
    }
    const a = b.dataset.a;
    if (a === 'next') {
      if (S.phase === 'lobby' && S.players.length < 2 && !confirm('目前只有 ' + S.players.length + ' 人報到，確定要發布人事命令？')) return;
      if (S.phase === 'review' && !S.review.bossPick && !confirm('董事長還沒拍板，要直接用民意結果嗎？')) return;
      net.send({ t: 'h.next' });
    }
    if (a === 'prev') { if (confirm('回到上一步？')) net.send({ t: 'h.prev' }); }
    if (a === 'openLobby') net.send({ t: 'h.openLobby' });
    if (a === 'closeLobby') net.send({ t: 'h.closeLobby' });
    if (a === 't-30') net.send({ t: 'h.time', sec: -30 });
    if (a === 't30') net.send({ t: 'h.time', sec: 30 });
    if (a === 't60') net.send({ t: 'h.time', sec: 60 });
    if (a === 'pause') net.send({ t: 'h.pause' });
    if (a === 'endNow') { if (confirm('立即結束這一關的計時？')) net.send({ t: 'h.endNow' }); }
    if (a === 'ov') { ovMode = ovMode === 'split' ? 'full' : ovMode === 'full' ? 'off' : 'split'; U.store.set('gt_office', ovMode); applyOv(); renderCtl(); return; }
    if (a === 'fs') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
    if (a === 'min') { ctl.classList.toggle('min'); ctl.dataset.key = ''; renderCtl(); }
    if (a === 'people') openDrawer('people');
    if (a === 'settings') openDrawer('settings');
  });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'h' || e.key === 'H') { if (isHost) { ctl.classList.toggle('min'); ctl.dataset.key = ''; renderCtl(); } }
    if (e.key === 'o' || e.key === 'O') { ovMode = ovMode === 'split' ? 'full' : ovMode === 'full' ? 'off' : 'split'; U.store.set('gt_office', ovMode); applyOv(); renderCtl(); }
    if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
    if (e.key === 'Escape' && drawer) closeDrawer();
  });

  function closeDrawer() { if (drawer) { drawer.el.remove(); drawer = null; } }
  function openDrawer(kind) {
    closeDrawer();
    const el = h(`<div class="drawer"><header><b style="font-size:17px">${kind === 'people' ? '👥 人員管理' : '⚙ 設定'}</b><span class="grow"></span><button data-x>關閉</button></header><div class="body"></div></div>`);
    document.body.appendChild(el);
    el.querySelector('[data-x]').onclick = closeDrawer;
    const body = el.querySelector('.body');
    if (kind === 'people') {
      drawer = { el, update() {
        const ps = S.players.slice().sort((a, b) => a.joinIdx - b.joinIdx);
        const nb = ps.filter(p => p.bot).length;
        const real = ps.length - nb;
        body.innerHTML = `
          <div style="background:#f4ecf8;border:1px solid #e0cdea;border-radius:12px;padding:12px 14px;margin-bottom:14px">
            <b>🤖 測試機器人</b> <span class="small muted">目前 ${nb} 個</span>
            <p class="small muted" style="margin:4px 0 8px">一個人也能測滿場：機器人會搶報到、蓋馬桶、貼意見、投票、填市調、交海報。正式活動前記得「移除全部」或「重置遊戲」。</p>
            <div class="row" style="flex-wrap:wrap"><button data-bots="5">＋5</button><button data-bots="20">＋20</button><button data-bots="fill" class="primary">補滿到 50 人</button><button data-bots="clear" class="danger">移除全部機器人</button></div>
          </div>
          <p class="small muted" style="margin-bottom:8px">共 ${ps.length} 人（真人 ${real}、機器人 ${nb}）。灰色＝離線。董事長沒來？可以把別人「設為董事長」（兩人職位互換）。</p>` + ps.map(p => `
          <div class="prow" style="opacity:${p.online ? 1 : .5}">${U.avatar(p)}<div class="grow"><b>#${p.joinIdx} ${esc(p.name)}</b><div class="small muted">${esc(p.title || '')}${p.team ? ' · ' + esc(G.TEAMS[p.team].name) : ''} · 放了 ${p.placed} 塊</div></div>
          <button data-r="${p.id}">改名</button>${p.rank !== 'boss' ? `<button data-b="${p.id}">設為董事長</button>` : ''}<button class="danger" data-k="${p.id}">移出</button></div>`).join('');
      } };
      body.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.bots) {
          const v = b.dataset.bots;
          if (v === 'clear') { if (confirm('移除所有測試機器人？他們放的積木也會一起移除。')) net.send({ t: 'h.removeBots' }); return; }
          const n = v === 'fill' ? Math.max(0, 50 - S.players.length) : +v;
          if (n <= 0) { U.toast('已經 50 人了'); return; }
          net.send({ t: 'h.bots', n });
          return;
        }
        if (b.dataset.r) { const p = pById(b.dataset.r); const n = prompt('新名字', p ? p.name : ''); if (n) net.send({ t: 'h.rename', id: b.dataset.r, name: n }); }
        if (b.dataset.b) { const p = pById(b.dataset.b); if (confirm(`讓 ${p.name} 當董事長？（和現任董事長互換職位）`)) net.send({ t: 'h.makeBoss', id: b.dataset.b }); }
        if (b.dataset.k) { const p = pById(b.dataset.k); if (confirm(`把 ${p.name} 移出遊戲？他放的積木也會一起移除。`)) net.send({ t: 'h.kick', id: b.dataset.k }); }
      });
    } else {
      drawer = { el, update() {} };
      const st = S.settings;
      const ips = netInfo ? netInfo.ips : [];
      const pref = U.store.get('gt_ip', ips[0] ? ips[0].address : '');
      body.innerHTML = `
        <h4 style="margin:6px 0">各關時間（秒）</h4>
        <div style="display:grid;grid-template-columns:1fr 100px;gap:8px;align-items:center">
          <label>開案（董事長選客群）</label><input type="number" id="s1" value="${st.briefSec}" min="10">
          <label>共創（兩隊蓋馬桶）</label><input type="number" id="s2" value="${st.buildSec}" min="10">
          <label>推廣（做海報／市調）</label><input type="number" id="s3" value="${st.posterSec}" min="10">
        </div>
        <button class="primary" id="saveS" style="margin-top:10px">儲存時間</button>
        <p class="small muted" style="margin-top:4px">下一次進入該關時生效；進行中的關卡請用控制列的 ±30 秒。</p>
        ${isCloud ? `<h4 style="margin:22px 0 6px">同仁連線網址</h4><p class="small"><b>${esc(location.origin)}</b></p>` : `
        <h4 style="margin:22px 0 6px">同仁連線網址（QR code 用）</h4>
        ${ips.length ? ips.map(i => `<label class="row small" style="margin:5px 0"><input type="radio" name="ip" value="${i.address}" ${i.address === pref ? 'checked' : ''}> <b>http://${i.address}:${netInfo.port}</b> <span class="muted">${esc(i.name)}</span></label>`).join('') : '<p class="small muted">找不到區網 IP</p>'}
        <p class="small muted">通常選「Wi-Fi」或「乙太網路」那一個；vEthernet、VPN 開頭的通常不是。</p>`}
        <h4 style="margin:22px 0 6px">活動成果</h4>
        <a href="/api/results.zip?key=${encodeURIComponent(KEY)}" class="small">⬇ 下載目前的海報、名單與市調（zip）</a>
        <h4 style="margin:22px 0 6px">清空積木</h4>
        <div class="row"><button class="danger" id="clrA">清空方案 A</button><button class="danger" id="clrB">清空方案 B</button></div>
        <h4 style="margin:22px 0 6px">重新開始</h4>
        <button class="danger" id="reset">🔄 重置遊戲（所有人要重新報到）</button>
        <p class="small muted" style="margin-top:14px">${isCloud ? '主持人密碼就是你在雲端設定的 HOST_KEY。' : '主持人密碼存在 data/host-key.txt。'}這個頁面的網址含密碼，請勿分享給同仁。</p>`;
      body.querySelector('#saveS').onclick = () => { net.send({ t: 'h.settings', briefSec: +body.querySelector('#s1').value, buildSec: +body.querySelector('#s2').value, posterSec: +body.querySelector('#s3').value }); U.toast('已儲存'); };
      body.querySelectorAll('input[name=ip]').forEach(r => r.onchange = () => { U.store.set('gt_ip', r.value); if (cur.ctl && cur.ctl.update) cur.ctl.update(); });
      body.querySelector('#clrA').onclick = () => { if (confirm('清空方案 A 所有積木？')) net.send({ t: 'h.clearBuild', team: 'A' }); };
      body.querySelector('#clrB').onclick = () => { if (confirm('清空方案 B 所有積木？')) net.send({ t: 'h.clearBuild', team: 'B' }); };
      body.querySelector('#reset').onclick = () => { if (confirm('確定重置？所有進度會清除，大家要重新報到。') && confirm('真的確定？')) { net.send({ t: 'h.reset' }); closeDrawer(); } };
    }
    drawer.update();
  }

  if (!KEY) setTimeout(() => { if (!isHost) U.toast('觀看模式（沒有主持人控制）'); }, 1500);
})();

