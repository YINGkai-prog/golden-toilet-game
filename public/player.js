/* 金馬桶專案 — 玩家端 */
(function () {
  'use strict';
  const G = window.GAME, { $, $$, esc, h } = U;
  const main = $('#main');
  const net = new Net({ office: true });

  let S = null, you = null;
  let builds = { A: {}, B: {} };
  let recentStickers = [];
  let cur = { key: null, ctl: null };
  const viewsByTeam = new Set(); // {team, view}

  // The same activity stream drives both the host and the optional player office.
  let playerOffice = null;
  let officeManual = false;
  let officeFailed = false;
  function showOffice(on, manual) {
    if (manual) officeManual = true;
    const wrap = $('#playerOfficeWrap'), button = $('#officeToggle');
    wrap.classList.toggle('hidden', !on);
    button.setAttribute('aria-expanded', String(on));
    button.textContent = on ? '收起公司' : '公司實況';
    document.body.classList.toggle('player-office', on);
    if (on && !playerOffice && !officeFailed && window.OfficeView) {
      try { playerOffice = new OfficeView($('#playerOffice')); }
      catch (error) {
        officeFailed = true;
        console.error('辦公室畫面無法啟動', error);
        $('#playerOffice').innerHTML = '<div class="office-fallback">此裝置無法顯示 3D 辦公室，仍可使用上方遊戲功能。</div>';
      }
    }
    if (on && playerOffice && S) {
      playerOffice.selfId = you && you.id;
      playerOffice.setState(S);
    }
  }
  $('#officeToggle').addEventListener('click', () => showOffice($('#playerOfficeWrap').classList.contains('hidden'), true));
  net.on('act', m => { if (playerOffice) playerOffice.onAct(m); });


  const me = () => (S && you ? S.players.find(p => p.id === you.id) : null);
  // 積木數由本機從 builds 計算（伺服器不必每放一塊就廣播狀態）
  const ownedOf = (id, team) => { const b = builds[team]; let c = 0; if (b) for (const k in b) if (b[k].by === id) c++; return c; };
  const countOf = team => Object.keys(builds[team] || {}).length;
  const pById = id => (S ? S.players.find(p => p.id === id) : null);
  const who = id => { const p = pById(id); return p ? `${p.title} ${p.name}` : ''; };
  const isBuilder = p => p && (p.team === 'A' || p.team === 'B') && p.rank !== 'boss';

  // ---------------------------------------------------------------- 連線事件
  let welcomed = false;
  net.on('close', () => { welcomed = false; });
  net.on('welcome', m => {
    welcomed = true;
    S = m.s; you = m.you; builds = m.builds || builds;
    if (!you) U.store.del('gt_token'); else U.store.set('gt_token', you.token);
    recentStickers = (m.stickers || []).map(s => Object.assign({}, s, { localAt: Date.now() - Math.max(0, (S.serverNow - s.at)) }));
    for (const v of viewsByTeam) v.view.setBlocks(builds[v.team] || {});
    render();
  });
  net.on('state', m => { if (!welcomed) return; const prevPhase = S && S.phase; S = m.s; if (prevPhase && prevPhase !== S.phase) onPhaseChange(prevPhase); render(); });
  net.on('you', m => { you = m.you; if (you) U.store.set('gt_token', you.token); render(); });
  net.on('ops', m => {
    const b = builds[m.team];
    for (const o of m.ops) { const k = o[1] + ',' + o[2] + ',' + o[3]; if (o[0] === 1) b[k] = { c: o[4], by: o[5] }; else delete b[k]; }
    for (const v of viewsByTeam) if (v.team === m.team) v.view.applyOps(m.ops);
    if (playerOffice) playerOffice.onOps(m.team, m.ops);
    if (cur.ctl && cur.ctl.onOps) cur.ctl.onOps(m.team);
    if (!opsRaf && cur.ctl && cur.ctl.update) opsRaf = requestAnimationFrame(() => { opsRaf = 0; if (cur.ctl && cur.ctl.update) cur.ctl.update(); });
  });
  let opsRaf = 0;
  net.on('builds', m => { builds = m.builds; for (const v of viewsByTeam) v.view.setBlocks(builds[v.team] || {}); });
  net.on('err', m => {
    U.toast(m.msg, 'warn');
    if (m.code === 'notopen' && cur.ctl && cur.ctl.notOpen) cur.ctl.notOpen();
  });
  net.on('toast', m => U.toast(m.msg, m.kind));
  net.on('kicked', () => { U.store.del('gt_token'); you = null; render(); U.toast('你已被主持人移出遊戲，可以重新報到', 'warn'); });
  net.on('reset', () => { U.store.del('gt_token'); location.reload(); });
  net.on('fx', onFx);

  function onPhaseChange(prev) {
    if (S.phase === 'build') recentStickers = [];
    if (prev === 'build' && S.phase !== 'build') recentStickers = [];
  }

  function onFx(f) {
    if (playerOffice) playerOffice.onFx(f);
    if (f.kind === 'countdown') return showCountdown(f.openAt);
    if (f.kind === 'timeup') { U.toast('⏰ 時間到！'); return; }
    if (f.kind === 'sticker') {
      const s = Object.assign({}, f, { localAt: Date.now() });
      recentStickers.push(s); if (recentStickers.length > 40) recentStickers.shift();
      for (const v of viewsByTeam) if (v.team === s.team && v.stickers) v.view.addSticker(s, who(s.by));
      return;
    }
    if (f.kind === 'banner') {
      for (const v of viewsByTeam) if (v.team === f.team && v.stickers) v.view.banner('📣 ' + f.text, who(f.by));
      return;
    }
    if (f.kind === 'visit') {
      for (const v of viewsByTeam) if (v.team === f.team && v.stickers) { v.view.banner('👀 董事長來巡視了！', '大家看起來要很忙', 'visit'); v.view.shake(); }
      const p = me(); if (p && p.team === f.team && isBuilder(p)) U.toast('👀 董事長正在看你們的作品！');
      return;
    }
    if (f.kind === 'react') {
      for (const v of viewsByTeam) if ((!f.team || v.team === f.team) && v.stickers) v.view.floatEmoji(f.emoji);
      return;
    }
    if (f.kind === 'bossPick' && f.changes > 0) U.toast(`😱 董事長改變心意了！（第 ${f.changes} 次）`);
    if (f.kind === 'brief' && f.auto) U.toast('董事長沒選，系統幫老闆決定了 🎲');
  }

  function showCountdown(openAt) {
    const el = h('<div class="big-count" style="pointer-events:none;background:#1d3840b0"></div>');
    document.body.appendChild(el);
    const tick = () => {
      const left = openAt - net.now();
      if (left > 0) { el.textContent = Math.ceil(left / 1000); el.classList.remove('go'); requestAnimationFrame(tick); }
      else { el.textContent = 'GO!'; el.classList.add('go'); setTimeout(() => el.remove(), 700); if (cur.ctl && cur.ctl.tick) cur.ctl.tick(); }
    };
    tick();
  }

  // ---------------------------------------------------------------- 主畫面切換
  function screenKey() {
    if (!S) return 'loading';
    const p = me();
    if (!p) return S.phase === 'lobby' ? 'lobby-out' : 'late';
    switch (S.phase) {
      case 'lobby': return 'lobby-in';
      case 'roles': return 'roles';
      case 'brief': return 'brief';
      case 'build': return isBuilder(p) ? 'build-' + p.team + '-' + p.rank : 'spec-' + p.rank + '-' + p.team;
      case 'review': return 'review-' + p.rank;
      case 'poster': return (S.poster.makers.includes(p.id) ? 'maker' : 'survey-' + p.rank);
      case 'gallery': return 'gallery-' + p.rank;
      case 'launch': return 'launch';
    }
    return 'loading';
  }

  function render() {
    if (S && !officeManual) showOffice(window.innerWidth >= 1024 && S.phase === 'lobby', false);
    if (playerOffice && S) { playerOffice.selfId = you && you.id; playerOffice.setState(S); }
    const key = screenKey();
    if (key !== cur.key) {
      if (cur.ctl && cur.ctl.unmount) cur.ctl.unmount();
      for (const v of [...viewsByTeam]) { v.view.dispose(); viewsByTeam.delete(v); }
      main.innerHTML = '';
      main.scrollTop = 0;
      const name = key.split('-')[0];
      cur = { key, ctl: (SCREENS[name] || SCREENS.loading)(main) || {} };
    }
    if (cur.ctl.update) cur.ctl.update();
    topbar();
  }

  function topbar() {
    $('#steps').innerHTML = S ? U.stepsHTML(S.phase) : '';
    const p = me();
    const badge = $('#me');
    if (p) {
      badge.classList.remove('hidden');
      badge.innerHTML = `${U.avatar(p)}<div style="min-width:0"><b>${esc(p.name)}</b><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(S.rolesPublished ? p.title : '第 ' + p.joinIdx + ' 位報到')}</div></div>`;
    } else badge.classList.add('hidden');
  }

  setInterval(() => {
    if (!S) return;
    const t = timerText(S, net);
    const el = $('#timer');
    el.textContent = t.text; el.className = 'timer ' + t.cls;
    if (cur.ctl && cur.ctl.tick) cur.ctl.tick();
  }, 250);

  function addView(container, team, opts) {
    const view = new VoxelView(container, opts);
    view.setBlocks(builds[team] || {});
    const rec = { team, view, stickers: !!(opts && opts.stickers) };
    viewsByTeam.add(rec);
    if (rec.stickers) for (const s of recentStickers) if (s.team === team && Date.now() - s.localAt < 21000) view.addSticker(s, who(s.by));
    return rec;
  }
  function setViewTeam(rec, team) {
    rec.team = team;
    rec.view.setBlocks(builds[team] || {});
    rec.view.clearStickers();
    if (rec.stickers) for (const s of recentStickers) if (s.team === team && Date.now() - s.localAt < 21000) rec.view.addSticker(s, who(s.by));
  }

  function personHTML(p, extra) {
    const mine = you && p.id === you.id;
    return `<div class="person${mine ? ' me' : ''}${p.online ? '' : ' off'}">${U.avatar(p)}<div style="min-width:0"><b>${esc(p.name)}${mine ? '（你）' : ''}</b><small>${esc(p.title || '')}${extra ? ' · ' + extra : ''}</small></div></div>`;
  }
  const briefNow = () => (S.brief.choice != null ? G.BRIEFS[S.brief.choice] : null);
  const briefMini = () => {
    const b = briefNow();
    return b ? `<div class="brief-mini"><span class="ic">${b.icon}</span><div><div class="eyebrow">開案需求</div><b>給${esc(b.name)}的馬桶：${esc(b.tag)}</b><div class="small muted">${esc(b.text)}</div></div></div>` : '<div class="small muted">董事長還沒開案，自由發揮！</div>';
  };

  // ---------------------------------------------------------------- 各畫面
  const SCREENS = {};

  SCREENS.loading = root => { root.innerHTML = '<div class="center-msg"><div><div style="font-size:48px">🚽</div><h2>連線中…</h2></div></div>'; };

  function joinForm(root, late) {
    root.innerHTML = `
      <div class="lobby">
        <div class="hero card">
          <div class="eyebrow">GOLDEN BOX INC. · 全員研發中</div>
          <h1>今天，你在公司<br>是什麼角色？</h1><div class="company-tagline">50 位同仁 · 2 個提案 · 1 座金馬桶</div>
          <p>${late ? '遊戲已經開始了！現在加入會成為<b>約聘實習生</b>，一樣可以一起蓋馬桶。' : '越早報到，職位越高。<b>第一個報到的人就是董事長</b>，最後幾位…就是基層主力。'}</p>
          <div class="join-row"><input id="nm" type="text" maxlength="12" placeholder="你的名字或綽號" autocomplete="off"><button id="go" class="gold">報到！</button></div>
          <p id="lstat" class="muted small"></p>
        </div>
        <div class="recent card"><h3>報到名單 <span class="muted small" id="rcount"></span></h3><div class="rlist" id="rlist"></div></div>
      </div>`;
    const nm = $('#nm', root), go = $('#go', root);
    nm.value = U.store.get('gt_name', '');
    nm.focus();
    let sent = 0;
    const submit = () => {
      const name = nm.value.trim();
      if (!name) { nm.focus(); U.toast('先輸入名字！', 'warn'); return; }
      if (go.disabled) return;
      if (Date.now() - sent < 600) return;
      U.store.set('gt_name', name);
      sent = Date.now();
      net.send({ t: 'join', name });
    };
    go.onclick = submit;
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    nm.addEventListener('input', () => U.store.set('gt_name', nm.value.trim()));
    const ctl = {
      tick() {
        if (late) { go.disabled = false; go.textContent = '加入遊戲'; $('#lstat', root).textContent = ''; return; }
        const open = S.lobby.open, left = open ? S.lobby.openAt - net.now() : 0;
        if (!open) { go.disabled = true; go.textContent = '等待開放'; $('#lstat', root).innerHTML = '先把名字打好，主持人倒數 <b>3、2、1</b> 後立刻按「報到」或 Enter！'; }
        else if (left > 0) { go.disabled = true; go.textContent = Math.ceil(left / 1000) + '…'; $('#lstat', root).textContent = '準備…'; }
        else { go.disabled = false; go.textContent = '報到！'; $('#lstat', root).textContent = '快！現在就按！'; }
      },
      update() {
        const ps = S.players.slice().sort((a, b) => b.joinIdx - a.joinIdx);
        $('#rcount', root).textContent = `${ps.length} 人`;
        $('#rlist', root).innerHTML = ps.length ? ps.slice(0, 60).map(p => `<div class="ritem"><span class="n">#${p.joinIdx}</span>${U.avatar(p)}<b>${esc(p.name)}</b><span class="ms">${p.joinMs != null && !late ? '+' + (p.joinMs / 1000).toFixed(3) + 's' : esc(p.title)}</span></div>`).join('') : '<div class="muted small">還沒有人報到</div>';
        this.tick();
      },
      notOpen() { sent = 0; }
    };
    return ctl;
  }
  SCREENS.lobby = root => {
    if (cur.key === 'lobby-in' || screenKey() === 'lobby-in') return SCREENS.lobbyIn(root);
    return joinForm(root, false);
  };
  SCREENS.late = root => joinForm(root, true);
  SCREENS.lobbyIn = root => {
    root.innerHTML = `
      <div class="lobby">
        <div class="card joined-big" id="jb"></div>
        <div class="recent card"><h3>報到名單 <span class="muted small" id="rcount"></span></h3><div class="rlist" id="rlist"></div></div>
      </div>`;
    return {
      update() {
        const p = me(); if (!p) return;
        const r = G.RANKS[p.rank] || {};
        $('#jb', root).innerHTML = `
          <div class="eyebrow">報到成功</div>
          <div class="num"><small>第</small> ${p.joinIdx} <small>位</small></div>
          <div class="muted">比開放時間晚 ${(p.joinMs / 1000).toFixed(3)} 秒</div>
          <div class="t" style="color:${r.color || '#24484e'}">暫定職位：${esc(p.rank === 'boss' ? '董事長 👑' : p.title || '')}</div>
          <p class="muted">${p.rank === 'boss' ? '你是全場最快的人！等等由你拍板一切。' : p.joinIdx <= 4 ? '高層就是你，準備指點江山。' : '主管名額會依總人數調整，等主持人發布人事命令。'}</p>
          <p class="small muted" style="margin-top:18px">等待主持人發布人事命令…</p>`;
        const ps = S.players.slice().sort((a, b) => a.joinIdx - b.joinIdx);
        $('#rcount', root).textContent = `${ps.length} 人`;
        $('#rlist', root).innerHTML = ps.map(q => `<div class="ritem${q.id === p.id ? ' me' : ''}"><span class="n">#${q.joinIdx}</span>${U.avatar(q)}<b>${esc(q.name)}</b><span class="ms">+${(q.joinMs / 1000).toFixed(3)}s</span></div>`).join('');
      }
    };
  };

  SCREENS.roles = root => {
    const p = me();
    const r = G.RANKS[p.rank];
    root.innerHTML = `
      <div class="roles">
        <div class="rank-card" id="rc">
          <div class="rank-inner">
            <div class="rank-face rank-front"><div><div style="font-size:64px">📜</div><div style="font-size:30px;font-weight:900;letter-spacing:.2em">人事命令</div><div class="small" style="opacity:.8;margin-top:8px">即日生效</div></div></div>
            <div class="rank-face rank-back" style="--rc:${p.rank === 'boss' ? r.color : G.TEAMS[p.team].color}">
              <div class="eyebrow">人事命令 · ${esc(p.name)}</div>
              <div class="rk">${p.rank === 'boss' ? '董事長 👑' : esc(r.name)}</div>
              <div class="tt">${p.rank === 'boss' ? '全場最快報到，全公司你最大' : esc(p.title)}</div>
              ${U.teamChip(p.team)} <span class="chip">第 ${p.joinIdx} 位報到</span>
              <ul>${r.perks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
              <p class="small muted" style="margin-top:14px">${p.team === 'M' ? '你們行銷處：先觀察兩隊作品，等等負責做上市海報！' : p.team ? `你們${esc(G.TEAMS[p.team].name)}要合力蓋出「${esc(G.TEAMS[p.team].plan)}」。` : '兩隊作品出來後，由你決定哪一座上市。'}</p>
            </div>
          </div>
        </div>
        <div class="card roster"><h3 id="rt"></h3><div class="rgrid" id="rg"></div></div>
      </div>`;
    setTimeout(() => $('#rc', root) && $('#rc', root).classList.add('flipped'), 500);
    return {
      update() {
        const p = me(); if (!p) return;
        const order = { boss: 0, lead: 1, manager: 2, staff: 3, intern: 4 };
        let list, title;
        if (p.rank === 'boss') { list = S.players.filter(q => q.rank === 'lead' || q.rank === 'boss'); title = '你的處長們'; }
        else { list = S.players.filter(q => q.team === p.team || q.rank === 'boss'); title = `${G.TEAMS[p.team].name}（${list.length - 1} 人）`; }
        list.sort((a, b) => order[a.rank] - order[b.rank] || a.joinIdx - b.joinIdx);
        $('#rt', root).textContent = title;
        $('#rg', root).innerHTML = list.map(q => personHTML(q)).join('');
      }
    };
  };

  SCREENS.brief = root => {
    const p = me();
    const boss = p.rank === 'boss';
    root.innerHTML = `
      <div class="wrap">
        <div class="eyebrow">STEP 3 · 開案</div>
        <h2 style="font-size:28px;margin:4px 0" id="bt"></h2>
        <p class="muted" id="bs"></p>
        <div class="briefs" id="bg"></div>
      </div>`;
    return {
      update() {
        const c = S.brief.choice;
        $('#bt', root).textContent = boss ? (c == null ? '董事長，這座馬桶要賣給誰？' : '你決定了！') : (c == null ? '董事長正在決定這座馬桶要賣給誰…' : '董事長拍板了！');
        $('#bs', root).textContent = boss ? '點一張卡片就決定（可以改，主持人按下一步才算數）。' : c == null ? '大家一起盯著老闆看。' : `接下來兩隊要為「${G.BRIEFS[c].name}」設計一座馬桶。`;
        $('#bg', root).innerHTML = G.BRIEFS.map((b, i) => `<button class="bcard${c === i ? ' chosen' : c != null ? ' dim' : ''}" data-i="${i}" ${boss ? '' : 'disabled style="cursor:default;opacity:' + (c == null || c === i ? 1 : .4) + '"'}><span class="ic">${b.icon}</span><b>${esc(b.name)}</b><span class="tag">「${esc(b.tag)}」</span><p>${esc(b.text)}</p>${c === i ? '<div class="stamp" style="font-size:26px;top:60%">董事長拍板</div>' : ''}</button>`).join('');
        if (boss) $$('.bcard', root).forEach(b => b.onclick = () => net.send({ t: 'brief', choice: +b.dataset.i }));
      }
    };
  };

  // ---- 共創：蓋馬桶的人
  SCREENS.build = root => {
    const p = me();
    const team = p.team;
    const canPower = p.rank === 'manager' || p.rank === 'lead';
    root.innerHTML = `
      <div class="build">
        <div class="stage">
          <div class="dir-bar hidden" id="dir"></div>
          <div id="vx"></div>
        </div>
        <div class="side">
          <div class="card" style="border-left:5px solid ${G.TEAMS[team].color}">
            <div class="row"><b style="font-size:17px;color:${G.TEAMS[team].color}">${esc(G.TEAMS[team].name)}・${esc(G.TEAMS[team].plan)}</b><span class="grow"></span><span class="chip" id="tc"></span></div>
            <div style="margin-top:10px">${briefMini()}</div>
          </div>
          <div class="card">
            <h4><span>我的積木</span><span id="bud"></span></h4>
            <div class="budget-bar"><i id="budbar"></i></div>
            ${p.rank === 'lead' ? '<div class="small muted" style="margin-top:6px">主管不用親自動手，指揮就好 😎</div>' : ''}
          </div>
          <div class="card">
            <h4>工具</h4>
            <div class="modes">
              <button data-m="place" aria-pressed="true">🧱 放置</button>
              <button data-m="remove">🔨 拆除</button>
              ${canPower ? '<button data-m="sticker">💬 貼紙</button>' : '<button disabled title="經理以上才能貼意見">💬 貼紙</button>'}
            </div>
            <div style="margin-top:10px" id="palwrap"><div class="palette" id="pal"></div><div class="small muted" style="margin-top:6px" id="cname"></div></div>
            <div id="stkwrap" class="hidden" style="margin-top:10px">
              <div class="small muted" style="margin-bottom:6px">選一句，再點模型貼上去：</div>
              <div class="stk-list" id="stk"></div>
              <input type="text" id="stkc" maxlength="16" placeholder="或自己寫一句…" style="width:100%;margin-top:8px">
            </div>
          </div>
          ${p.rank === 'lead' ? `
          <div class="card" style="background:#f6eff9">
            <h4><span>📣 方向調整（全隊廣播）</span><span class="small" id="bcd"></span></h4>
            <select id="bsel" style="width:100%">${G.BANNERS.map(b => `<option>${esc(b)}</option>`).join('')}<option value="">（自己寫）</option></select>
            <input type="text" id="bcus" maxlength="20" placeholder="自己寫…" class="hidden" style="width:100%;margin-top:6px">
            <button id="bsend" class="primary" style="width:100%;margin-top:8px">發布給全隊</button>
          </div>` : ''}
          <div class="card"><h4><span>隊員進度</span><span class="small muted">積木數</span></h4><div class="team-list" id="tl"></div></div>
          <div class="help">🖱 <b>左鍵</b> 放置　<b>右鍵</b>（或 Shift＋左鍵）拆除<br>🖱 <b>拖曳</b> 旋轉　<b>滾輪</b> 縮放　<span class="kbd">1</span>~<span class="kbd">0</span> 換顏色<br>${canPower ? '你可以拆任何隊員的積木。' : '你只能拆自己的積木。'}</div>
        </div>
      </div>`;
    const vxEl = $('#vx', root);
    vxEl.classList.add('build');
    vxEl.style.flex = '1'; vxEl.style.minHeight = '0';
    let stkText = G.STICKERS[0];
    const rec = addView(vxEl, team, {
      interactive: true, stickers: true,
      onPlace: c => net.send({ t: 'place', x: c[0], y: c[1], z: c[2], c: rec.view.color }),
      onRemove: c => net.send({ t: 'remove', x: c[0], y: c[1], z: c[2] }),
      onSticker: pos => { const txt = ($('#stkc', root).value.trim() || stkText); net.send({ t: 'sticker', team, pos, text: txt }); }
    });
    const view = rec.view;
    const hud = h('<div class="hud">左鍵放置・右鍵拆除・拖曳旋轉</div>'); vxEl.appendChild(hud);
    const lock = h('<div class="lock hidden">⏰ 時間到，停止施工</div>'); vxEl.appendChild(lock);

    // 色票
    const pal = $('#pal', root);
    const keyLabel = i => (i < 9 ? String(i + 1) : i === 9 ? '0' : '');
    pal.innerHTML = G.COLORS.map((c, i) => `<button class="swatch ${c.kind}" data-c="${i}" title="${esc(c.name)}" style="background-color:${c.hex}" aria-pressed="${i === 0}"><i>${keyLabel(i)}</i></button>`).join('');
    const setColor = i => { view.setColor(i); $$('.swatch', pal).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.c === i))); $('#cname', root).textContent = '目前顏色：' + G.COLORS[i].name; };
    $$('.swatch', pal).forEach(b => b.onclick = () => setColor(+b.dataset.c));
    setColor(0);
    const setMode = m => {
      view.setMode(m);
      $$('.modes button[data-m]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
      $('#stkwrap', root).classList.toggle('hidden', m !== 'sticker');
      $('#palwrap', root).classList.toggle('hidden', m === 'sticker');
      hud.textContent = m === 'place' ? '左鍵放置・右鍵拆除・拖曳旋轉' : m === 'remove' ? '點積木拆除・拖曳旋轉' : '點模型貼上意見・拖曳旋轉';
    };
    $$('.modes button[data-m]', root).forEach(b => b.onclick = () => setMode(b.dataset.m));
    if (canPower) {
      const stk = $('#stk', root);
      stk.innerHTML = G.STICKERS.map((s, i) => `<button data-i="${i}" aria-pressed="${i === 0}">${esc(s)}</button>`).join('');
      $$('button', stk).forEach(b => b.onclick = () => { stkText = G.STICKERS[+b.dataset.i]; $('#stkc', root).value = ''; $$('button', stk).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    }
    if (p.rank === 'lead') {
      const sel = $('#bsel', root), cus = $('#bcus', root);
      sel.onchange = () => cus.classList.toggle('hidden', sel.value !== '');
      let last = 0;
      $('#bsend', root).onclick = () => {
        const text = sel.value || cus.value.trim(); if (!text) return;
        net.send({ t: 'banner', text }); last = Date.now();
      };
      root._bannerLast = () => last;
    }
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; if (G.COLORS[i]) { setColor(i); if (view.mode === 'sticker') setMode('place'); } }
      if (k === 'r' || k === 'R') setMode(view.mode === 'remove' ? 'place' : 'remove');
    };
    window.addEventListener('keydown', onKey);

    return {
      unmount() { window.removeEventListener('keydown', onKey); },
      update() {
        const q = me(); if (!q) return;
        const budget = G.RANKS[q.rank].budget;
        const own = {}; for (const k in builds[team]) { const by = builds[team][k].by; own[by] = (own[by] || 0) + 1; }
        const mine = own[q.id] || 0;
        $('#bud', root).textContent = `${mine} / ${budget}`;
        $('#budbar', root).style.width = Math.min(100, mine / Math.max(1, budget) * 100) + '%';
        $('#budbar', root).style.background = mine >= budget ? 'var(--red)' : 'var(--teal)';
        $('#tc', root).textContent = `全隊 ${countOf(team)} 塊`;
        const order = { lead: 0, manager: 1, staff: 2, intern: 3 };
        const mates = S.players.filter(x => x.team === team).sort((a, b) => order[a.rank] - order[b.rank] || (own[b.id] || 0) - (own[a.id] || 0));
        const html = mates.map(x => `<div class="tl${x.id === q.id ? ' me' : ''}" style="opacity:${x.online ? 1 : .45}">${U.avatar(x)}<span class="nm">${esc(x.name)} <span class="muted">${esc(G.RANKS[x.rank].name)}</span></span><span class="ct">${own[x.id] || 0}/${G.RANKS[x.rank].budget}</span></div>`).join('');
        if (html !== this._tl) { this._tl = html; $('#tl', root).innerHTML = html; }
        const bn = S.banners[team];
        const dir = $('#dir', root);
        if (bn) { dir.classList.remove('hidden'); dir.innerHTML = `📣 <b>方向調整：</b>${esc(bn.text)} <span class="muted small">— ${esc(who(bn.by))}</span>`; } else dir.classList.add('hidden');
        const locked = S.timeUp || S.pausedRemaining != null;
        lock.classList.toggle('hidden', !locked);
        lock.textContent = S.pausedRemaining != null ? '⏸ 主持人暫停中' : '⏰ 時間到，停止施工';
        view.opts.interactive = !locked;
      },
      tick() {
        if (p.rank === 'lead' && root._bannerLast) {
          const left = 45000 - (Date.now() - root._bannerLast());
          const btn = $('#bsend', root); if (!btn) return;
          btn.disabled = left > 0; $('#bcd', root).textContent = left > 0 ? Math.ceil(left / 1000) + ' 秒' : '';
        }
      }
    };
  };

  // ---- 共創：旁觀者（董事長、行銷處）
  SCREENS.spec = root => {
    const p = me();
    const boss = p.rank === 'boss';
    const canStk = boss || p.rank === 'manager' || p.rank === 'lead';
    const presets = boss ? G.BOSS_STICKERS : G.STICKERS;
    root.innerHTML = `
      <div class="build">
        <div class="stage"><div class="dir-bar hidden" id="dir"></div><div id="vx"></div></div>
        <div class="side">
          <div class="card">
            <h4>${boss ? '👑 董事長巡視中' : '📈 行銷處：市場觀察'}</h4>
            <div class="teamtabs"><button class="A" data-t="A" aria-pressed="true">第一研發部<br><small id="ca"></small></button><button class="B" data-t="B">第二研發部<br><small id="cb"></small></button></div>
          </div>
          <div class="card">${briefMini()}</div>
          ${boss ? `<div class="card" style="background:var(--gold-soft)"><button class="gold" id="visit" style="width:100%;font-size:16px">👀 巡視這一隊</button><div class="small muted" style="margin-top:6px">全隊螢幕會跳出「董事長來巡視了！」</div></div>` : ''}
          ${canStk ? `<div class="card"><h4>${boss ? '💛 老闆的關心' : '💬 意見貼紙'}</h4><div class="small muted" style="margin-bottom:6px">選一句，再點模型貼上：</div><div class="stk-list" id="stk"></div><input type="text" id="stkc" maxlength="16" placeholder="或自己寫一句…" style="width:100%;margin-top:8px"></div>` : ''}
          <div class="card"><h4>即時反應</h4><div class="reacts" id="rx"></div></div>
          ${p.team === 'M' ? `<div class="card" style="background:#f6eff9"><h4>📝 海報靈感筆記</h4><textarea id="notes" rows="4" maxlength="300" placeholder="想到的產品名、標語、賣點先記下來，下一關會出現在海報編輯器旁邊" style="width:100%;resize:vertical"></textarea></div>` : ''}
          <div class="help">${boss ? '董事長任務：到處巡視、給點「關心」，等一下由你決定哪一座上市。' : '行銷處任務：先觀察兩隊、想想賣點。下一關你要做上市海報！'}<br>🖱 拖曳旋轉・滾輪縮放</div>
        </div>
      </div>`;
    const vxEl = $('#vx', root); vxEl.style.flex = '1'; vxEl.style.minHeight = '0';
    let team = 'A', stkText = presets[0], armed = false;
    const rec = addView(vxEl, team, {
      interactive: canStk, stickers: true,
      onSticker: pos => { if (!armed) return; const txt = ($('#stkc', root) && $('#stkc', root).value.trim()) || stkText; net.send({ t: 'sticker', team, pos, text: txt }); }
    });
    rec.view.setMode(canStk ? 'sticker' : 'place');
    if (canStk) { rec.view.opts.onPlace = null; rec.view.opts.onRemove = null; }
    const hud = h('<div class="hud">拖曳旋轉・滾輪縮放</div>'); vxEl.appendChild(hud);
    const setTeam = t => { team = t; setViewTeam(rec, t); $$('.teamtabs button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t))); render(); };
    $$('.teamtabs button', root).forEach(b => b.onclick = () => setTeam(b.dataset.t));
    if (canStk) {
      const stk = $('#stk', root);
      stk.innerHTML = presets.map((s, i) => `<button data-i="${i}">${esc(s)}</button>`).join('');
      $$('button', stk).forEach(b => b.onclick = () => { stkText = presets[+b.dataset.i]; armed = true; $$('button', stk).forEach(x => x.setAttribute('aria-pressed', String(x === b))); hud.textContent = '點模型貼上「' + stkText + '」'; });
      $('#stkc', root).addEventListener('input', () => { armed = true; hud.textContent = '點模型貼上你的意見'; });
    }
    if (boss) $('#visit', root).onclick = () => net.send({ t: 'visit', team });
    const notes = $('#notes', root);
    if (notes) { const nk = 'gt_notes_' + S.gameId; notes.value = U.store.get(nk, ''); notes.oninput = () => U.store.set(nk, notes.value); }
    $('#rx', root).innerHTML = G.REACTIONS.map(e => `<button data-e="${e}">${e}</button>`).join('');
    $$('#rx button', root).forEach(b => b.onclick = () => net.send({ t: 'react', team, emoji: b.dataset.e }));
    return {
      update() {
        $('#ca', root).textContent = `${countOf('A')} 塊`;
        $('#cb', root).textContent = `${countOf('B')} 塊`;
        const bn = S.banners[team], dir = $('#dir', root);
        if (bn) { dir.classList.remove('hidden'); dir.innerHTML = `📣 ${esc(G.TEAMS[team].name)}方向：${esc(bn.text)}`; } else dir.classList.add('hidden');
      }
    };
  };

  // ---- 評選
  SCREENS.review = root => {
    const p = me();
    const boss = p.rank === 'boss';
    root.innerHTML = `
      <div class="review">
        ${['A', 'B'].map(t => `
        <div class="rcol" style="--tc:${G.TEAMS[t].color}">
          <div class="rhead"><b>${G.TEAMS[t].plan}</b><span class="muted">${esc(G.TEAMS[t].name)} · <span id="n${t}"></span> 塊積木</span></div>
          <div id="v${t}" style="position:relative"></div>
          <div class="rvote"><button id="vote${t}">投給${G.TEAMS[t].plan}</button><div class="grow"><div class="vbar"><i id="bar${t}" style="background:${G.TEAMS[t].color};width:0"></i></div></div><b id="tal${t}" style="min-width:52px;text-align:right"></b></div>
        </div>`).join('')}
        ${boss ? `<div class="boss-bar"><b style="font-size:18px">👑 董事長拍板：</b><button class="gold" id="pickA">方案 A 上市</button><button class="gold" id="pickB">方案 B 上市</button><span class="small muted">民意僅供參考 😏</span></div>` : '<div class="boss-bar" id="wait"><b>民意可以投，但最後由董事長拍板。</b></div>'}
      </div>`;
    const recs = {};
    for (const t of ['A', 'B']) {
      const el = $('#v' + t, root); el.style.flex = '1'; el.style.minHeight = '0';
      recs[t] = addView(el, t, { autoRotate: true, radius: 30 });
      $('#vote' + t, root).onclick = () => net.send({ t: 'vote', team: t });
      if (boss) $('#pick' + t, root).onclick = () => net.send({ t: 'bossPick', team: t });
    }
    let lastPick = null;
    return {
      update() {
        const tl = S.review.tally, tot = Math.max(1, tl.A + tl.B);
        for (const t of ['A', 'B']) {
          $('#n' + t, root).textContent = countOf(t);
          $('#bar' + t, root).style.width = (tl[t] / tot * 100) + '%';
          $('#tal' + t, root).textContent = tl[t] + ' 票';
          const b = $('#vote' + t, root);
          b.setAttribute('aria-pressed', String(you.reviewVote === t));
          b.textContent = you.reviewVote === t ? `✓ 你投了${G.TEAMS[t].plan}` : `投給${G.TEAMS[t].plan}`;
        }
        if (S.review.bossPick !== lastPick) {
          lastPick = S.review.bossPick;
          $$('.stamp', root).forEach(e => e.remove());
          if (lastPick) {
            const other = lastPick === 'A' ? 'B' : 'A';
            const against = tl[other] > tl[lastPick];
            const st = h(`<div class="stamp">董事長拍板<small>${against ? '（無視民意）' : '上市！'}</small></div>`);
            $('#v' + lastPick, root).appendChild(st);
          }
        }
        if (!boss) { const w = $('#wait', root); w.innerHTML = S.review.bossPick ? `<b style="font-size:18px">👑 董事長選了 ${G.TEAMS[S.review.bossPick].plan}！</b>${S.review.changes ? `<span class="muted">（已改變心意 ${S.review.changes} 次）</span>` : ''}` : '<b>民意可以投，但最後由董事長拍板。</b><span class="muted">董事長思考中…</span>'; }
        else for (const t of ['A', 'B']) $('#pick' + t, root).setAttribute('aria-pressed', String(S.review.bossPick === t));
      }
    };
  };

  // ---- 推廣：行銷處做海報
  SCREENS.maker = root => {
    const ed = PosterEditor.mount(root, {
      net,
      getState: () => S,
      getYou: () => you,
      getBuild: () => builds[S.review.winner || 'A'] || {},
      who
    });
    return { update() { ed.update(); }, tick() { ed.tick && ed.tick(); }, unmount() { ed.unmount(); }, onOps() { ed.refreshModel && ed.refreshModel(); } };
  };

  // ---- 推廣：其他人做市調；董事長定價
  SCREENS.survey = root => {
    const p = me();
    const boss = p.rank === 'boss';
    const win = S.review.winner || 'A';
    root.innerHTML = `
      <div class="survey">
        <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
          <div class="row"><b style="font-size:20px;color:${G.TEAMS[win].color}">🏆 上市方案：${G.TEAMS[win].plan}（${esc(G.TEAMS[win].name)}）</b></div>
          <div id="vx" style="flex:1;min-height:320px"></div>
        </div>
        <div class="card" id="form"></div>
      </div>`;
    addView($('#vx', root), win, { autoRotate: true, radius: 28 });
    const form = $('#form', root);
    if (!boss) {
      form.innerHTML = `
        <div class="eyebrow">市場調查</div>
        <h2 style="font-size:24px;margin:4px 0 4px">你願意花多少錢買這座馬桶？</h2>
        <p class="muted small">行銷處正在做海報，你的答案和金句會即時出現在他們的畫面上！</p>
        <div class="price-big" id="pv" style="margin-top:16px">NT$ 15,000</div>
        <input type="range" id="pr" min="0" max="100000" step="500" value="15000">
        <div class="row small muted"><span>NT$ 0</span><span class="grow"></span><span>NT$ 100,000</span></div>
        <h3 style="font-size:16px;margin:18px 0 6px">用一句話推薦（或吐槽）它</h3>
        <input type="text" id="qt" maxlength="30" placeholder="例如：坐上去就不想起來" style="width:100%">
        <button class="primary" id="sv" style="margin-top:14px;width:100%;font-size:17px;padding:12px">送出市調</button>
        <p class="small muted" id="svst" style="margin-top:8px"></p>`;
      const pr = $('#pr', form), pv = $('#pv', form), qt = $('#qt', form);
      if (you.survey) { pr.value = you.survey.price; qt.value = you.survey.quote || ''; }
      const show = () => pv.textContent = U.money(+pr.value);
      pr.oninput = show; show();
      $('#sv', form).onclick = () => net.send({ t: 'survey', price: +pr.value, quote: qt.value.trim() });
      return { update() { $('#svst', form).textContent = you.survey ? `✓ 已送出（${U.money(you.survey.price)}）。可以修改後再送一次。` : ''; $('#sv', form).textContent = you.survey ? '更新市調' : '送出市調'; } };
    }
    form.innerHTML = `
      <div class="eyebrow">董事長 · 定價</div>
      <h2 style="font-size:24px;margin:4px 0">官方售價由你決定</h2>
      <p class="muted small">全員市調平均願付：<b id="avg">—</b>（<span id="cnt">0</span> 人回覆）</p>
      <div class="price-big" id="pv" style="margin-top:12px">NT$ 29,900</div>
      <input type="range" id="pr" min="0" max="200000" step="100" value="29900">
      <button class="gold" id="setp" style="margin-top:10px;width:100%;font-size:17px;padding:12px">就賣這個價！</button>
      <p class="small muted" id="cur" style="margin-top:6px"></p>
      <h3 style="font-size:15px;margin:16px 0 4px">市調金句</h3>
      <div class="quotes" id="qs"></div>`;
    const pr = $('#pr', form), pv = $('#pv', form);
    if (S.poster.officialPrice != null) pr.value = S.poster.officialPrice;
    const show = () => pv.textContent = U.money(+pr.value);
    pr.oninput = show; show();
    $('#setp', form).onclick = () => { net.send({ t: 'price', price: +pr.value }); U.toast('定價完成！'); };
    return {
      update() {
        $('#avg', form).textContent = U.money(S.poster.avgPrice);
        $('#cnt', form).textContent = S.poster.surveyCount;
        $('#cur', form).textContent = S.poster.officialPrice != null ? '目前官方售價：' + U.money(S.poster.officialPrice) : '還沒定價';
        $('#qs', form).innerHTML = S.poster.quotes.map(q => `<div class="quote">「${esc(q.quote)}」<small>${esc(who(q.by))} · 願付 ${U.money(q.price)}</small></div>`).join('') || '<div class="small muted">還沒有人留言</div>';
      }
    };
  };

  // ---- 海報評選
  SCREENS.gallery = root => {
    const p = me();
    const boss = p.rank === 'boss';
    root.innerHTML = `<div class="wrap" style="max-width:1400px;padding-bottom:0"><div class="eyebrow">STEP 7 · 海報評選</div><h2 style="font-size:26px;margin:4px 0">${boss ? '董事長，選一張當官方海報！' : '投給你最想買單的海報（不能投自己）'}</h2><p class="muted small" id="gs"></p></div><div class="gallery" id="gg"></div>`;
    const gg = $('#gg', root);
    gg.addEventListener('click', e => {
      const img = e.target.closest('img');
      if (img) { const lb = h(`<div class="lightbox"><img src="${img.src}"></div>`); lb.onclick = () => lb.remove(); document.body.appendChild(lb); return; }
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      if (b.dataset.k === 'pick') net.send({ t: 'gpick', author: b.dataset.a });
      else net.send({ t: 'gvote', author: b.dataset.a });
    });
    return {
      update() {
        const list = S.poster.posters.filter(x => x.hasImg);
        $('#gs', root).textContent = list.length ? `共 ${list.length} 張海報` : '';
        if (!list.length) { gg.innerHTML = '<div class="empty card" style="grid-column:1/-1">行銷處沒有交出海報… 😅</div>'; return; }
        gg.innerHTML = list.map(x => {
          const a = pById(x.author) || { name: '?', title: '' };
          const votes = S.gallery.tally[x.author] || 0;
          const mine = x.author === you.id, voted = you.galleryVote === x.author, off = S.gallery.bossPick === x.author;
          return `<div class="card gcard${voted ? ' voted' : ''}${off ? ' official' : ''}">${off ? '<span class="badge">👑 官方海報</span>' : ''}
            <img src="/poster/${x.author}.jpg?v=${x.v}" alt="海報">
            <b>${esc(x.name || '（未命名）')}</b><div class="meta">${esc(a.title)} ${esc(a.name)} · ❤ ${votes} 票</div>
            ${mine ? '<button disabled>你的作品</button>' : `<button data-a="${x.author}" aria-pressed="${voted}">${voted ? '✓ 你的一票' : '投這張'}</button>`}
            ${boss ? `<button class="gold" data-a="${x.author}" data-k="pick">${off ? '✓ 官方海報' : '⭐ 選為官方海報'}</button>` : ''}
          </div>`;
        }).join('');
      }
    };
  };

  // ---- 發表會
  SCREENS.launch = root => {
    root.innerHTML = '<div class="launch" id="ln"></div>';
    setTimeout(() => U.confetti(), 300);
    return {
      update() {
        const L = S.launch; if (!L) return;
        const off = L.official ? S.poster.posters.find(x => x.author === L.official) : null;
        const p = me();
        const b = briefNow();
        const win = L.winner || 'A';
        const winners = S.players.filter(x => x.team === win);
        const aw = [
          ['🧱', '最勤勞基層', L.awards.worker, v => `放了 ${v} 塊積木`],
          ['☝️', '最愛指點江山主管', L.awards.micromanager, v => `貼了 ${v} 次意見`],
          ['💸', '最敢花錢客人', L.awards.rich, v => `願付 ${U.money(v)}`],
          ['📣', '最佳啦啦隊', L.awards.cheer, v => `按了 ${v} 次反應`]
        ].filter(x => x[2]);
        const mineStat = p ? (p.placed ? `你這場放了 ${p.placed} 塊積木。` : '') : '';
        $('#ln', root).innerHTML = `
          <div>${off ? `<img src="/poster/${off.author}.jpg?v=${off.v}" alt="官方海報">` : '<div class="card empty" style="width:340px;height:450px">（沒有官方海報）</div>'}</div>
          <div>
            <div class="eyebrow">STEP 8 · 上市發表會</div>
            <h1>🎉 ${esc((off && off.name) || '金馬桶')} 正式上市！</h1>
            <p style="font-size:18px;margin:8px 0">${esc((off && off.slogan) || '')}</p>
            <p class="muted">${b ? `${b.icon} 給${esc(b.name)}的馬桶 · ` : ''}${G.TEAMS[win].plan}（${esc(G.TEAMS[win].name)}）· ${L.blocks} 塊積木</p>
            <div class="price-big" style="margin:12px 0">${U.money(L.price)}</div>
            <p class="small muted">市調平均願付 ${U.money(L.avgPrice)}${S.poster.officialPrice != null ? ' · 董事長定價' : ''}</p>
            <h3 style="margin:18px 0 6px">🏅 今日獎項</h3>
            ${aw.map(a => `<div class="award"><span class="ic">${a[0]}</span><div><b>${a[1]}：${esc(who(a[2].id))}</b><div class="small muted">${a[3](a[2].value)}</div></div></div>`).join('') || '<div class="muted small">—</div>'}
            <p style="margin-top:16px">${esc(mineStat)} ${p && p.team === win ? '恭喜！你們的方案上市了 🎊' : ''}</p>
            <p class="small muted" style="margin-top:6px">研發團隊：${winners.map(x => esc(x.name)).join('、') || '—'}</p>
          </div>`;
      }
    };
  };
})();

