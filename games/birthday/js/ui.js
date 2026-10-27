/* UI: HUD, dialog, panels (pause, quests, bag, album, map, achievements, settings), toasts,
   cinematics and the mini-games. Talks to the game only through G.* */
(function () {
  const C = G.C;
  const $ = id => document.getElementById(id);
  const UI = G.UI = {};
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach(c => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  };
  UI.el = el;
  const reduced = () => G.save.data.settings.reduced;
  const click = () => G.audio.click();

  // ---------- state ----------
  UI.cinematic = false;
  UI.busy = () => !$('dialog').hidden || !$('panelWrap').hidden || !$('mini').hidden || UI.cinematic || !$('ending').hidden || !$('startScreen').hidden;

  // ---------- placeholder images ----------
  function placeholder(title, sub, hue) {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 800, 600);
    gr.addColorStop(0, `hsl(${hue},55%,62%)`); gr.addColorStop(1, `hsl(${hue + 40},50%,32%)`);
    g.fillStyle = gr; g.fillRect(0, 0, 800, 600);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 6; g.setLineDash([18, 14]); g.strokeRect(30, 30, 740, 540);
    g.setLineDash([]); g.fillStyle = '#fff'; g.textAlign = 'center'; g.direction = 'rtl';
    g.font = `90px serif`; g.fillText('🖼️', 400, 250);
    g.font = `bold 46px ${G.W ? G.W.FONT_B : 'sans-serif'}`; g.fillText(title, 400, 360);
    g.font = `30px ${G.W ? G.W.FONT_B : 'sans-serif'}`; g.fillText(sub, 400, 420);
    return c.toDataURL('image/jpeg', 0.85);
  }
  const phCache = {};
  UI.photoURL = (m, i) => m.src || (phCache[m.id] = phCache[m.id] || placeholder(m.title, 'صورة تجريبية — بدّلها من config.js', 320 + i * 25));
  UI.giftURL = () => C.finale.giftImage || (phCache.gift = phCache.gift || placeholder('🎁 الهدية', 'صورة تجريبية — حط صورة الهدية بالإعدادات', 330));
  UI.setImg = (img, src, fallback) => { img.onerror = () => { img.onerror = null; img.src = fallback(); }; img.src = src; };

  // ---------- HUD ----------
  UI.showHUD = on => { $('hud').hidden = !on; };
  UI.updateTracker = function () {
    const q = G.Q.tracked();
    const tk = $('tracker');
    if (!q) { $('trackerTitle').textContent = G.save.data.endingDone ? '🎉 خلّصتي اللعبة' : '✨ استكشفي المدينة'; $('trackerObj').textContent = G.save.data.endingDone ? 'إعادة النهاية من القائمة ☰' : ''; return; }
    $('trackerTitle').textContent = (q.kind === 'main' ? '★ ' : '☆ ') + q.title;
    const st = G.Q.state(q.id);
    $('trackerObj').textContent = st === 'available' ? (G.game && G.game.hintFor(q.id)) || q.desc : G.Q.nextObjective(q.id) || q.desc;
    tk.title = q.desc;
  };
  $('tracker').addEventListener('click', () => { click(); UI.openQuests(); });
  UI.setAction = function (t) {
    const b = $('actionBtn');
    if (!t) { b.hidden = true; return; }
    b.hidden = false;
    $('actionIcon').textContent = t.icon || '✋';
    $('actionLabel').textContent = t.label;
  };
  UI.timer = function (label, value) {
    if (label == null) { $('timerHud').hidden = true; return; }
    $('timerHud').hidden = false; $('timerLabel').textContent = label; $('timerValue').textContent = value;
  };
  UI.zoneTitle = function (text) {
    const z = $('zoneTitle'); z.hidden = true; void z.offsetWidth; z.textContent = text; z.hidden = false;
    clearTimeout(UI._zt); UI._zt = setTimeout(() => { z.hidden = true; }, 2700);
  };
  UI.toast = function (icon, title, text) {
    const t = el('div', { class: 'toast' }, el('span', { class: 'ti', text: icon }), el('div', {}, el('b', { text: title }), text || ''));
    $('toasts').append(t);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => t.remove(), 3900);
  };

  // ---------- dialog ----------
  let dlg = null;
  function whoLabel(who) {
    const n = C.npcs[who];
    if (n) return [n.name, n.title];
    return [who || '', ''];
  }
  function typeLine(text) {
    const p = $('dlgText');
    clearInterval(dlg.typer);
    if (reduced()) { p.textContent = text; dlg.typing = false; return; }
    let i = 0; dlg.typing = true; p.textContent = '';
    dlg.typer = setInterval(() => {
      i += 2; p.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(dlg.typer); dlg.typing = false; }
    }, 22);
  }
  function showLine() {
    const [name, title] = whoLabel(dlg.who);
    $('dlgWho').replaceChildren(name, title ? el('small', { text: title }) : '');
    dlg.full = G.fmt(dlg.lines[dlg.i]);
    typeLine(dlg.full);
    $('dlgChoices').replaceChildren();
    $('dlgNext').hidden = false; $('dlgSkip').hidden = dlg.lines.length < 2; $('dlgSkip').textContent = 'تخطّي';
    $('dlgNext').textContent = dlg.i < dlg.lines.length - 1 ? 'التالي ◂' : 'تمام ✓';
  }
  function endDialog(val) {
    clearInterval(dlg && dlg.typer);
    $('dialog').hidden = true;
    const r = dlg && dlg.resolve; dlg = null;
    G.emit('ui:close');
    r && r(val);
  }
  UI.say = function (who, lines) {
    if (!lines || !lines.length) return Promise.resolve();
    return new Promise(resolve => {
      if (dlg) endDialog();
      dlg = { who, lines, i: 0, resolve };
      $('dialog').hidden = false;
      showLine();
    });
  };
  UI.choose = function (who, prompt, options) {
    return new Promise(resolve => {
      if (dlg) endDialog();
      dlg = { who, lines: [prompt], i: 0, resolve, choice: true };
      $('dialog').hidden = false;
      const [name, title] = whoLabel(who);
      $('dlgWho').replaceChildren(name, title ? el('small', { text: title }) : '');
      $('dlgText').textContent = G.fmt(prompt);
      $('dlgNext').hidden = true; $('dlgSkip').hidden = false; $('dlgSkip').textContent = 'إلغاء';
      $('dlgChoices').replaceChildren(...options.map((o, i) => el('button', { text: o, onclick: () => { click(); endDialog(i); } })));
    });
  };
  $('dlgNext').addEventListener('click', () => {
    if (!dlg) return;
    click();
    if (dlg.typing) { clearInterval(dlg.typer); dlg.typing = false; $('dlgText').textContent = dlg.full; return; }
    if (dlg.i < dlg.lines.length - 1) { dlg.i++; showLine(); } else endDialog();
  });
  $('dlgSkip').addEventListener('click', () => { if (!dlg) return; click(); $('dlgSkip').textContent = 'تخطّي'; endDialog(dlg.choice ? -1 : undefined); });
  $('dialog').addEventListener('pointerdown', e => e.stopPropagation());

  // ---------- panels ----------
  let panelClose = null;
  UI.panel = function (title, body, onClose) {
    $('panelTitle').textContent = title;
    $('panelBody').replaceChildren(body);
    $('panelBody').scrollTop = 0;
    $('panelWrap').hidden = false;
    panelClose = onClose || null;
  };
  UI.closePanel = function () {
    if ($('panelWrap').hidden) return;
    $('panelWrap').hidden = true;
    const f = panelClose; panelClose = null;
    G.emit('ui:close');
    f && f();
  };
  $('panelClose').addEventListener('click', () => { click(); UI.closePanel(); });
  $('panelWrap').addEventListener('pointerdown', e => { if (e.target === $('panelWrap')) UI.closePanel(); e.stopPropagation(); });

  UI.confirm = function (text, yes = 'نعم', no = 'لا') {
    return new Promise(res => {
      const body = el('div', { class: 'detail' }, el('p', { text }),
        el('div', { class: 'row' },
          el('button', { class: 'btn danger', text: yes, onclick: () => { res(true); panelClose = null; UI.closePanel(); } }),
          el('button', { class: 'btn ghost', text: no, onclick: () => UI.closePanel() })));
      UI.panel('تأكيد', body, () => res(false));
    });
  };

  UI.openPause = function () {
    const items = [
      ['▶️', 'كمّلي اللعب', () => UI.closePanel()],
      ['📜', 'المهام', UI.openQuests], ['🎒', 'الحقيبة', UI.openBag], ['📸', 'ألبوم الذكريات', UI.openAlbum],
      ['🗺️', 'الخريطة', UI.openMap], ['🏆', 'الإنجازات', UI.openAchievements], ['⚙️', 'الإعدادات', UI.openSettings],
    ];
    if (G.inv.has('fullLetter')) items.push(['💌', 'الخطاب الكامل', UI.showFullLetter]);
    if (G.save.data.endingDone) items.push(['🎁', 'إعادة النهاية', () => { UI.closePanel(); G.game.replayEnding(); }]);
    items.push(['🏠', 'الشاشة الرئيسية', () => { UI.closePanel(); G.game.toTitle(); }]);
    UI.panel('القائمة', el('div', { class: 'menu-list' }, items.map(([i, t, f]) => el('button', { onclick: () => { click(); f(); } }, el('span', { text: i }), t))));
  };

  const STATE_AR = { locked: 'مقفلة', available: 'متاحة', active: 'جارية', done: 'مكتملة' };
  UI.openQuests = function (kind = 'main') {
    const list = el('div');
    const render = (k) => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
      list.replaceChildren(...C.quests.filter(q => q.kind === k).map(q => {
        const st = G.Q.state(q.id);
        const card = el('div', { class: 'quest ' + st }, el('h3', {}, q.title, el('span', { class: 'st', text: STATE_AR[st] })),
          el('div', { text: st === 'locked' ? 'بتنفتح بعد مهام ثانية…' : q.desc }));
        if (st !== 'locked') card.append(el('ul', {}, q.objectives.map(o => {
          const ok = G.Q.objDone(q.id, o.id);
          return el('li', { class: ok ? 'ok' : '', text: o.count ? `${o.text} (${st === 'done' ? o.count : G.Q.objCount(q.id, o.id)}/${o.count})` : o.text });
        })));
        if (st !== 'locked' && st !== 'done' && G.game) { const h = G.game.hintFor(q.id); if (h) card.append(el('div', { class: 'hint', text: '💡 ' + h })); }
        return card;
      }));
    };
    const tabs = el('div', { class: 'tabs' },
      el('button', { 'data-k': 'main', text: 'المهام الرئيسية', onclick: () => render('main') }),
      el('button', { 'data-k': 'side', text: 'مهام جانبية', onclick: () => render('side') }));
    render(kind);
    UI.panel('المهام', el('div', {}, tabs, list));
  };

  const TYPES = [['all', 'الكل'], ['key', 'مفاتيح ورموز'], ['letter', 'رسائل'], ['treasure', 'كنوز'], ['outfit', 'لبس']];
  const typeGroup = t => ({ symbol: 'key', key: 'key', heart: 'treasure', quest: 'treasure', tool: 'treasure' }[t] || t);
  UI.openBag = function () {
    const grid = el('div', { class: 'grid' });
    const detail = el('div', { class: 'detail' }, el('p', { class: 'meta', text: 'اختاري غرض لتشوفي تفاصيله.' }));
    const items = () => [{ id: 'outfitDefault', at: 0, ctx: 'من البداية' }, ...G.inv.list()];
    let filter = 'all';
    const showItem = (it) => {
      const d = C.items[it.id];
      const kids = [el('div', { class: 'big', text: d.icon }), el('h3', { text: d.name }), el('p', { text: d.desc })];
      if (d.type === 'symbol') kids.push(el('p', {}, 'الرمز: ', el('b', { style: 'font-size:1.6rem', text: C.password.symbols[it.id] || '?' })));
      if (it.ctx) kids.push(el('div', { class: 'meta', text: `من: ${it.ctx}${it.at ? ' — ' + new Date(it.at).toLocaleString('ar') : ''}` }));
      const m = /^letter(\d)$/.exec(it.id);
      if (m) kids.push(el('button', { class: 'btn', text: 'اقرئي الرسالة', onclick: () => UI.showLetter(+m[1] - 1) }));
      if (it.id === 'fullLetter') kids.push(el('button', { class: 'btn', text: 'اقرئي الخطاب', onclick: UI.showFullLetter }));
      if (it.id === 'cityMap' || it.id === 'secretMap') kids.push(el('button', { class: 'btn', text: 'افتحي الخريطة', onclick: UI.openMap }));
      if (d.type === 'outfit') {
        const on = G.save.data.outfit === it.id;
        kids.push(el('button', { class: 'btn' + (on ? ' ghost' : ''), text: on ? 'لابستها هلأ' : 'البسيها', onclick: () => { if (!on) { G.game.setOutfit(it.id); UI.toast(d.icon, 'لبسة جديدة', d.name); render(); showItem(it); } } }));
      }
      detail.replaceChildren(...kids);
    };
    const render = () => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === filter));
      const list = items().filter(it => filter === 'all' || typeGroup(C.items[it.id].type) === filter);
      grid.replaceChildren(...list.map(it => {
        const d = C.items[it.id];
        return el('button', { class: 'slot' + (G.save.data.outfit === it.id ? ' on' : ''), onclick: () => { click(); showItem(it); } }, el('span', { class: 'si', text: d.icon }), el('span', { class: 'sn', text: d.name }));
      }));
      if (!list.length) grid.append(el('p', { class: 'hint', text: 'لسا ما في إشي هون.' }));
    };
    const tabs = el('div', { class: 'tabs' }, TYPES.map(([k, t]) => el('button', { 'data-k': k, text: t, onclick: () => { filter = k; render(); } })));
    render();
    UI.panel('الحقيبة', el('div', {}, tabs, el('div', { class: 'split' }, grid, detail)));
  };

  UI.openAlbum = function () {
    const found = new Set(G.save.data.photos);
    const grid = el('div', { class: 'photo-grid' }, C.memories.map((m, i) => {
      if (!found.has(m.id)) return el('div', { class: 'photo lockedp', text: '?' });
      const img = el('img', { alt: m.title });
      UI.setImg(img, UI.photoURL(m, i), () => (phCache[m.id] = placeholder(m.title, 'تعذّر تحميل الصورة', 320 + i * 25)));
      return el('button', { class: 'photo', onclick: () => UI.showPhoto(m, i, true) }, img, el('span', { text: m.title }));
    }));
    UI.panel(`ألبوم الذكريات (${found.size}/${C.memories.length})`, el('div', {}, el('p', { class: 'hint', text: 'الصور بتنكشف لما تلاقيها بالمدينة 📸' }), grid));
  };
  UI.showPhoto = function (m, i, fromAlbum) {
    const img = el('img', { alt: m.title });
    UI.setImg(img, UI.photoURL(m, i), () => (phCache[m.id] = placeholder(m.title, 'تعذّر تحميل الصورة', 320 + i * 25)));
    const body = el('div', { class: 'photo-view' }, img, el('div', {}, el('h3', { text: m.title }), el('p', { class: 'meta', text: '📍 ' + m.place }), el('p', { text: G.fmt(m.caption) }),
      fromAlbum ? el('button', { class: 'btn ghost', text: 'رجوع للألبوم', onclick: UI.openAlbum }) : ''));
    UI.panel('ذكرى', body);
  };

  UI.showLetter = function (i) {
    const body = el('div', { class: 'letter' }, el('p', { text: G.fmt(C.letters[i]) }));
    UI.panel(`الرسالة ${i + 1} من ٧`, body);
  };
  UI.showFullLetter = function () {
    G.audio.setMood('letter');
    const paras = C.letters.map((t, i) => {
      const p = el('p', { class: reduced() ? '' : 'reveal', text: G.fmt(t) });
      if (!reduced()) p.style.animationDelay = (i * 1.6) + 's';
      return p;
    });
    paras.push(el('p', { class: reduced() ? '' : 'reveal', text: '— ' + C.fromName, style: reduced() ? '' : `animation-delay:${C.letters.length * 1.6}s` }));
    UI.panel('الخطاب الكامل 💌', el('div', { class: 'letter' }, paras), () => G.game && G.game.updateMood());
  };

  UI.openAchievements = function () {
    const ids = Object.keys(C.achievements);
    UI.panel(`الإنجازات (${G.save.data.achievements.length}/${ids.length})`, el('div', {}, ids.map(id => {
      const a = C.achievements[id], on = G.ach.has(id);
      return el('div', { class: 'ach' + (on ? '' : ' off') }, el('span', { class: 'ai', text: a.icon }), el('div', {}, el('b', { text: a.name }), el('div', { class: 'meta', text: a.desc })));
    })));
  };

  UI.openSettings = function () {
    const s = G.save.data.settings;
    const row = (label, key, after) => {
      const t = el('button', { class: 'toggle' + (s[key] ? ' on' : ''), 'aria-label': label, 'aria-pressed': String(!!s[key]) });
      t.addEventListener('click', () => { s[key] = !s[key]; t.classList.toggle('on', s[key]); t.setAttribute('aria-pressed', String(s[key])); G.save.write(); after && after(); click(); });
      return el('div', { class: 'settings-row' }, el('span', { text: label }), t);
    };
    const body = el('div', {},
      row('الموسيقى', 'music', G.audio.apply),
      row('المؤثرات الصوتية', 'sfx', G.audio.apply),
      row('تقليل الحركة والمؤثرات', 'reduced', () => G.game && G.game.applySettings()),
      row('الظلال (إطفاؤها بيسرّع اللعبة)', 'shadows', () => G.game && G.game.applySettings()),
      el('div', { class: 'settings-row' }, el('span', { text: G.save.storageOk ? 'الحفظ تلقائي على هاد الجهاز (مش متزامن بين الأجهزة).' : 'المتصفح مانع الحفظ — التقدم رح يضيع لما تسكّري الصفحة.' })),
      el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn danger', text: 'ابدئي لعبة جديدة', onclick: async () => { if (await UI.confirm('أكيد بدك تبدئي من الأول؟ كل التقدم رح ينمسح.', 'امسحي وابدئي', 'لا')) G.game.newGame(); } })));
    UI.panel('الإعدادات', body);
  };

  // ---------- map ----------
  UI.drawMap = function (g, w, h, full, center) {
    const B = { x0: -48, x1: 48, z0: -68, z1: 40 };
    let s, ox, oz;
    if (full) { s = Math.min(w / (B.x1 - B.x0), h / (B.z1 - B.z0)); ox = (w - (B.x1 - B.x0) * s) / 2 - B.x0 * s; oz = (h - (B.z1 - B.z0) * s) / 2 - B.z0 * s; }
    else { s = 2.6; ox = w / 2 - center.x * s; oz = h / 2 - center.z * s; }
    const X = x => ox + x * s, Z = z => oz + z * s;
    g.fillStyle = '#6f8f63'; g.fillRect(0, 0, w, h);
    const secretOpen = G.flags.get('gateOpen');
    for (const r of G.W.mapRects) {
      if (r.secret && !secretOpen) continue;
      g.fillStyle = r.c; g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    }
    g.font = `${full ? 16 : 14}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of G.W.mapRects) if (r.label && !(r.secret && !secretOpen)) g.fillText(r.label, X((r.x0 + r.x1) / 2), Z((r.z0 + r.z1) / 2));
    if (!secretOpen) { g.fillText('🔒', X(0), Z(-50)); }
    // markers
    for (const m of G.game.mapMarkers()) {
      g.fillStyle = m.color; g.beginPath(); g.arc(X(m.x), Z(m.z), full ? 6 : 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      if (m.icon && full) g.fillText(m.icon, X(m.x), Z(m.z) - 14);
    }
    // player
    const p = G.game.playerPos();
    g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-p.angle + Math.PI);
    g.fillStyle = '#fff'; g.strokeStyle = '#c2185b'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };
  UI.openMap = function () {
    const cv = el('canvas', { width: 700, height: 790 });
    const h = Math.max(200, G.game.stageH() - 110); cv.style.height = h + 'px'; cv.style.width = (h * 700 / 790) + 'px'; cv.style.maxWidth = '100%';
    UI.drawMap(cv.getContext('2d'), 700, 790, true);
    const legend = el('div', { class: 'legend' },
      el('div', { text: '🔴 المهمة الحالية' }), el('div', { text: '🟡 شخصية عندها إشي إلك' }), el('div', { text: '🟣 صورة ذكرى (بعد الخريطة السرية)' }),
      el('div', { text: `🛣️ ${C.streets.main} — شرق/غرب` }), el('div', { text: `🛣️ ${C.streets.cross} — شمال/جنوب` }),
      el('div', { text: `🌳 ${C.streets.park} بالشمال` }), el('div', { text: G.flags.get('gateOpen') ? `💛 ${C.streets.secret} مفتوحة` : `🔒 ${C.streets.secret} ورا الحديقة` }));
    UI.panel('خريطة ' + C.cityName, el('div', { class: 'map-wrap' }, cv, legend));
  };

  // ---------- fade / cinematic ----------
  UI.fade = async function (fn) {
    const f = $('fade');
    f.classList.add('on');
    await wait(reduced() ? 60 : 460);
    await fn();
    await wait(80);
    f.classList.remove('on');
    await wait(reduced() ? 60 : 400);
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  UI.wait = wait;
  UI.bars = on => { $('bars').hidden = !on; };
  UI.cine = async function (lines, perLine = 2600) {
    const c = $('cine');
    c.hidden = false;
    for (const l of lines) {
      c.replaceChildren(el('span', { text: G.fmt(l) }));
      await wait(reduced() ? Math.min(perLine, 1800) : perLine);
    }
    c.hidden = true;
  };

  // ---------- mini-game shell ----------
  let miniDone = null;
  function openMini(title, body, onClose) {
    $('miniTitle').textContent = title;
    $('miniBody').replaceChildren(body);
    $('mini').hidden = false;
    miniDone = onClose;
  }
  function closeMini(result) {
    if ($('mini').hidden) return;
    $('mini').hidden = true;
    const f = miniDone; miniDone = null;
    G.emit('ui:close');
    f && f(result);
  }
  $('miniClose').addEventListener('click', () => { click(); closeMini(false); });
  $('mini').addEventListener('pointerdown', e => e.stopPropagation());

  // ---- hearts (arcade) ----
  UI.heartsGame = function () {
    return new Promise(resolve => {
      const target = C.arcade.target, secs = C.arcade.seconds;
      const cv = el('canvas', { class: 'mg-canvas', width: 800, height: 400 });
      const stats = el('div', { class: 'mg-stats' });
      const footer = el('div', { class: 'row' });
      const body = el('div', { style: 'display:contents' }, stats, cv, el('p', { class: 'hint', text: 'حرّكي إصبعك يمين وشمال لتلقطي القلوب 💗 وابعدي عن الغيوم ☁️' }), footer);
      let raf, running = false, won = false;
      const g = cv.getContext('2d');
      const st = {};
      const reset = () => Object.assign(st, { t: secs, got: 0, x: 400, items: [], spawn: 0, last: 0 });
      const setX = e => { if (e.target !== cv) return; st.x = Math.max(60, Math.min(740, e.offsetX / cv.clientWidth * 800)); };
      cv.addEventListener('pointerdown', e => { setX(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', setX);
      const draw = () => {
        g.fillStyle = '#1a1033'; g.fillRect(0, 0, 800, 400);
        g.strokeStyle = 'rgba(125,249,255,.15)'; for (let i = 0; i < 800; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 400); g.stroke(); }
        g.font = '44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const it of st.items) g.fillText(it.bad ? '☁️' : '💗', it.x, it.y);
        g.fillStyle = '#ff4fa3'; g.beginPath(); g.roundRect ? g.roundRect(st.x - 60, 352, 120, 26, 12) : g.rect(st.x - 60, 352, 120, 26); g.fill();
        g.fillStyle = '#7df9ff'; g.fillRect(st.x - 50, 348, 100, 6);
      };
      const tick = (ts) => {
        const dt = Math.min(0.05, (ts - (st.last || ts)) / 1000); st.last = ts;
        st.t -= dt; st.spawn -= dt;
        if (st.spawn <= 0) { st.spawn = 0.42 + Math.random() * 0.3; st.items.push({ x: 40 + Math.random() * 720, y: -20, v: 170 + (secs - st.t) * 9 + Math.random() * 60, bad: Math.random() < 0.18 }); }
        for (const it of st.items) {
          it.y += it.v * dt;
          if (!it.done && it.y > 340 && it.y < 380 && Math.abs(it.x - st.x) < 70) {
            it.done = true;
            if (it.bad) { st.got = Math.max(0, st.got - 1); G.audio.fail(); } else { st.got++; G.audio.ding(); }
          }
        }
        st.items = st.items.filter(it => !it.done && it.y < 430);
        stats.replaceChildren(`💗 ${st.got}/${target}`, `⏱️ ${Math.max(0, Math.ceil(st.t))}`);
        draw();
        if (st.got >= target) return finish(true);
        if (st.t <= 0) return finish(false);
        raf = requestAnimationFrame(tick);
      };
      const begin = () => { reset(); running = true; footer.replaceChildren(); st.last = 0; raf = requestAnimationFrame(tick); };
      const finish = (ok) => {
        running = false; cancelAnimationFrame(raf);
        if (ok) { won = true; G.audio.success(); footer.replaceChildren(el('b', { text: '🏆 فزتي!' }), el('button', { class: 'btn', text: 'استلمي الجائزة', onclick: () => closeMini(true) })); }
        else { G.audio.fail(); footer.replaceChildren(el('b', { text: `جمعتي ${st.got} — قربتي!` }), el('button', { class: 'btn', text: 'حاولي كمان مرة', onclick: begin })); }
      };
      UI.qa = { hearts: { begin: () => begin(), finish: ok => finish(ok), state: st } };
      reset(); draw();
      stats.replaceChildren(`💗 0/${target}`, `⏱️ ${secs}`);
      footer.replaceChildren(el('button', { class: 'btn', text: 'ابدئي', onclick: begin }));
      openMini('تحدي القلوب', body, (r) => { cancelAnimationFrame(raf); resolve(!!(r || won)); });
    });
  };

  // ---- memory cards ----
  UI.memoryGame = function () {
    return new Promise(resolve => {
      const syms = C.memoryGame.symbols.slice(0, 6);
      const stats = el('div', { class: 'mg-stats' });
      const grid = el('div', { class: 'cards' });
      const footer = el('div', { class: 'row' });
      let deck, open, matched, moves, lock, won = false;
      const start = () => {
        deck = [...syms, ...syms].map(s => ({ s })).sort(() => Math.random() - 0.5);
        open = []; matched = 0; moves = 0; lock = false; footer.replaceChildren();
        grid.replaceChildren(...deck.map((c, i) => (c.btn = el('button', { class: 'card', 'aria-label': 'بطاقة', text: c.s, onclick: () => flip(i) }))));
        upd();
      };
      const upd = () => stats.replaceChildren(`🃏 ${matched}/${syms.length}`, `🔁 ${moves}`);
      const flip = (i) => {
        const c = deck[i];
        if (lock || c.ok || open.includes(c)) return;
        c.btn.classList.add('up'); G.audio.click(); open.push(c);
        if (open.length === 2) {
          moves++;
          const [a, b] = open;
          if (a.s === b.s) {
            a.ok = b.ok = true; a.btn.classList.add('ok'); b.btn.classList.add('ok'); open = []; matched++; G.audio.ding();
            if (matched === syms.length) { won = true; G.audio.success(); footer.replaceChildren(el('b', { text: `🧠 خلّصتي بـ ${moves} محاولة!` }), el('button', { class: 'btn', text: 'تمام', onclick: () => closeMini(true) })); }
          } else {
            lock = true;
            setTimeout(() => { a.btn.classList.remove('up'); b.btn.classList.remove('up'); open = []; lock = false; }, 800);
          }
          upd();
        }
      };
      start();
      openMini('تحدي الذاكرة', el('div', { style: 'display:contents' }, stats, grid, el('p', { class: 'hint', text: 'اقلبي بطاقتين وطابقي الأزواج.' }), footer), () => resolve(won));
    });
  };

  // ---- clock puzzle ----
  UI.clockPuzzle = function () {
    return new Promise(resolve => {
      let h = 12, m = 0, won = false;
      const cv = el('canvas', { width: 256, height: 256 });
      const hb = el('b'), mb = el('b');
      const msg = el('p', { class: 'hint', text: 'اضبطي العقارب واضغطي "جرّبي".' });
      const draw = () => {
        hb.textContent = String(h); mb.textContent = String(m).padStart(2, '0');
        G.W.drawClock(h, m);
        cv.getContext('2d').drawImage(G.W.clockCanvas, 0, 0);
      };
      const spin = (label, b, dec, inc) => el('div', { class: 'spin' }, el('button', { text: '−', onclick: () => { dec(); draw(); click(); } }), b, el('button', { text: '+', onclick: () => { inc(); draw(); click(); } }), el('label', { text: label }));
      const body = el('div', { style: 'display:contents' },
        el('div', { class: 'clock-ui' }, cv, el('div', {},
          spin('الساعة', hb, () => { h = h === 1 ? 12 : h - 1; }, () => { h = h === 12 ? 1 : h + 1; }),
          spin('الدقائق', mb, () => { m = (m + 55) % 60; }, () => { m = (m + 5) % 60; }))),
        msg,
        el('div', { class: 'row' },
          el('button', { class: 'btn', text: 'جرّبي', onclick: () => {
            const ok = (h % 12) === (C.clock.hour % 12) && m === C.clock.minute;
            if (ok) { won = true; G.audio.success(); msg.textContent = '✨ الساعة دقّت… الحجرة السرية انفتحت!'; setTimeout(() => closeMini(true), 900); }
            else { G.audio.fail(); msg.textContent = 'مش هاد الوقت… 💡 ' + G.fmt(C.clock.hint); }
          } }),
          el('button', { class: 'btn ghost', text: 'تلميح', onclick: () => { msg.textContent = '💡 ' + G.fmt(C.clock.hint); } })));
      draw();
      openMini('لغز الساعة', body, () => { if (!won) G.W.drawClock(4, 0); resolve(won); });
    });
  };

  // ---- password ----
  UI.passwordPuzzle = function (chars) {
    return new Promise(resolve => {
      const word = [...C.password.word];
      let picked = [], won = false;
      const slots = el('div', { class: 'code-slots' });
      const tiles = el('div', { class: 'code-tiles' });
      const msg = el('p', { class: 'hint', text: 'اضغطي على الرموز بالترتيب الصح.' });
      const pool = chars.map((c, i) => ({ c, i })).sort(() => Math.random() - 0.5);
      const render = () => {
        slots.replaceChildren(...word.map((_, i) => el('span', { text: picked[i] ? picked[i].c : '' })));
        tiles.replaceChildren(...pool.map(p => el('button', { text: p.c, disabled: picked.includes(p) ? '' : null, onclick: () => pick(p) })));
        tiles.querySelectorAll('button').forEach((b, i) => { b.disabled = picked.includes(pool[i]); });
      };
      const pick = (p) => {
        if (picked.length >= word.length) return;
        picked.push(p); click(); render();
        if (picked.length === word.length) {
          if (picked.map(x => x.c).join('') === word.join('')) { won = true; G.audio.unlock(); msg.textContent = '💛 كلمة السر صحيحة!'; setTimeout(() => closeMini(true), 1000); }
          else { G.audio.fail(); msg.textContent = 'مش هيك… جربي ترتيب ثاني.'; setTimeout(() => { picked = []; render(); }, 900); }
        }
      };
      render();
      openMini('الرسالة المشفّرة', el('div', { style: 'display:contents' }, slots, tiles, msg,
        el('div', { class: 'row' }, el('button', { class: 'btn ghost', text: 'امسحي', onclick: () => { picked = []; render(); } }),
          el('button', { class: 'btn ghost', text: 'تلميح', onclick: () => { msg.textContent = '💡 ' + G.fmt(C.password.hint); } }))), () => resolve(won));
    });
  };

  // ---- quiz ----
  UI.quiz = function (startAt, onCorrect) {
    return new Promise(resolve => {
      let i = startAt;
      const q = el('div', { class: 'quiz-q' }), opts = el('div', { class: 'quiz-opts' }), msg = el('p', { class: 'hint' }), prog = el('div', { class: 'mg-stats' });
      const show = () => {
        if (i >= C.quiz.length) {
          G.audio.success();
          q.textContent = '💯 جاوبتي على كل الأسئلة!'; opts.replaceChildren(); msg.textContent = '';
          prog.replaceChildren(`${C.quiz.length}/${C.quiz.length}`);
          opts.append(el('button', { class: 'btn', text: 'تمام', onclick: () => closeMini(true) }));
          return;
        }
        const item = C.quiz[i];
        prog.replaceChildren(`سؤال ${i + 1} من ${C.quiz.length}`);
        q.textContent = G.fmt(item.q); msg.textContent = '';
        opts.replaceChildren(...item.options.map((o, k) => el('button', { text: G.fmt(o), onclick: (e) => {
          if (k === item.correct) { e.currentTarget.classList.add('good'); G.audio.ding(); onCorrect(i); i++; setTimeout(show, 600); }
          else { e.currentTarget.classList.add('bad'); G.audio.fail(); msg.textContent = '💡 ' + G.fmt(item.hint) + ' — جربي كمان مرة.'; }
        } })));
      };
      show();
      openMini('كم بتعرفيني؟', el('div', { style: 'display:contents' }, prog, q, opts, msg), (r) => resolve(!!r || i >= C.quiz.length));
    });
  };

  // ---------- ending ----------
  UI.showEnding = function () {
    UI.setImg($('giftImg'), UI.giftURL(), () => (phCache.gift = placeholder('🎁 الهدية', 'تعذّر تحميل صورة الهدية', 330)));
    $('giftCaption').textContent = C.finale.giftImage ? '' : G.fmt(C.finale.giftCaption);
    $('endTitle').textContent = G.fmt(C.finale.title);
    $('endMsg').textContent = G.fmt(C.finale.message);
    $('endSig').textContent = '— ' + C.fromName;
    $('btnFullLetter').hidden = !G.inv.has('fullLetter');
    $('ending').hidden = false;
  };
  $('btnReplay').addEventListener('click', () => { click(); $('ending').hidden = true; G.game.replayEnding(); });
  $('btnFullLetter').addEventListener('click', () => { click(); UI.showFullLetter(); });
  $('btnEndClose').addEventListener('click', () => { click(); $('ending').hidden = true; G.game.afterEnding(); });

  // HUD buttons
  $('btnPause').addEventListener('click', () => { click(); UI.openPause(); });
  $('btnQuests').addEventListener('click', () => { click(); UI.openQuests(); });
  $('btnBag').addEventListener('click', () => { click(); UI.openBag(); });
  $('btnAlbum').addEventListener('click', () => { click(); UI.openAlbum(); });
  $('minimapBtn').addEventListener('click', () => { click(); UI.openMap(); });
})();
