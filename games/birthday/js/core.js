/* Core systems: events, save, audio, quests, inventory, achievements. No rendering here. */
(function () {
  const C = window.GAME_CONFIG;
  const G = window.G = { C };

  // counts that follow the content
  const fixCount = (qid, oid, n) => { const q = C.quests.find(x => x.id === qid); const o = q && q.objectives.find(x => x.id === oid); if (o && n > 0) o.count = n; };
  fixCount('album', 'photos', C.memories.length);
  fixCount('quiz', 'answer', C.quiz.length);
  fixCount('letters', 'collect', C.letters.length);

  // ---------- text ----------
  G.vars = {
    bouquetHint: C.flowers.hint,
    outfitHint: C.clothes.hint,
    arcadeTarget: C.arcade.target,
    arcadeTime: C.arcade.seconds,
    starsTarget: C.stars.target,
  };
  G.fmt = s => String(s)
    .replace(/\{name\}/g, C.herName)
    .replace(/\{(\w+)\}/g, (m, k) => (k in G.vars ? G.vars[k] : m));

  // ---------- events ----------
  const handlers = {};
  G.on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); };
  G.emit = (evt, data) => { (handlers[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };

  // ---------- save ----------
  const KEY = 'jasmineCity.save.v1';
  const prefersReduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  function defaults() {
    return {
      v: 1, started: false, quests: {}, items: [], flags: {}, photos: [], achievements: [],
      outfit: 'outfitDefault', tod: 0, zone: 'city', pos: { x: 0, z: 9 }, endingDone: false,
      settings: { music: C.audio.music, sfx: C.audio.sfx, reduced: prefersReduced, shadows: true },
      savedAt: 0,
    };
  }
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  function sanitize(raw) {
    const d = defaults();
    if (!isObj(raw) || raw.v !== 1) return d;
    d.started = !!raw.started;
    d.endingDone = !!raw.endingDone;
    if (isObj(raw.quests)) {
      for (const q of C.quests) {
        const r = raw.quests[q.id];
        if (!isObj(r) || !['active', 'done'].includes(r.state)) continue;
        const obj = {};
        for (const o of q.objectives) {
          const n = r.obj && Number(r.obj[o.id]);
          if (n > 0) obj[o.id] = Math.min(n, o.count || 1);
        }
        d.quests[q.id] = { state: r.state, obj };
      }
    }
    if (Array.isArray(raw.items)) {
      const seen = new Set();
      for (const it of raw.items) {
        if (isObj(it) && C.items[it.id] && !seen.has(it.id)) { seen.add(it.id); d.items.push({ id: it.id, at: Number(it.at) || 0, ctx: String(it.ctx || '') }); }
      }
    }
    if (isObj(raw.flags)) for (const k in raw.flags) { const v = raw.flags[k]; if (['boolean', 'number', 'string'].includes(typeof v)) d.flags[k] = v; }
    if (Array.isArray(raw.photos)) d.photos = [...new Set(raw.photos.filter(id => C.memories.some(m => m.id === id)))];
    if (Array.isArray(raw.achievements)) d.achievements = [...new Set(raw.achievements.filter(id => C.achievements[id]))];
    if (C.items[raw.outfit] && C.items[raw.outfit].type === 'outfit') d.outfit = raw.outfit;
    d.tod = Math.max(0, Math.min(3, Number(raw.tod) || 0));
    if (typeof raw.zone === 'string') d.zone = raw.zone;
    if (isObj(raw.pos) && isFinite(raw.pos.x) && isFinite(raw.pos.z)) d.pos = { x: +raw.pos.x, z: +raw.pos.z };
    if (isObj(raw.settings)) for (const k in d.settings) if (typeof raw.settings[k] === 'boolean') d.settings[k] = raw.settings[k];
    return d;
  }
  G.save = {
    data: defaults(),
    storageOk: true,
    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
      this.data = sanitize(raw);
      return this.data;
    },
    hasProgress() { return this.data.started; },
    write() {
      this.data.savedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.storageOk = true; } catch { this.storageOk = false; }
    },
    reset() {
      const keep = this.data.settings;
      this.data = defaults();
      this.data.settings = keep;
      this.write();
    },
  };
  G.flags = {
    get: k => G.save.data.flags[k],
    set(k, v) { if (G.save.data.flags[k] === v) return; G.save.data.flags[k] = v; G.save.write(); G.emit('flag', k); },
  };

  // ---------- inventory ----------
  G.inv = {
    has: id => G.save.data.items.some(i => i.id === id),
    list: () => G.save.data.items.slice(),
    count: type => G.save.data.items.filter(i => C.items[i.id] && C.items[i.id].type === type).length,
    add(id, ctx) {
      if (!C.items[id] || this.has(id)) return false;
      G.save.data.items.push({ id, at: Date.now(), ctx: ctx || '' });
      G.save.write();
      G.emit('item', id);
      return true;
    },
  };

  // ---------- achievements ----------
  G.ach = {
    has: id => G.save.data.achievements.includes(id),
    unlock(id) {
      if (!C.achievements[id] || this.has(id)) return false;
      G.save.data.achievements.push(id);
      G.save.write();
      G.emit('achievement', id);
      return true;
    },
  };

  // ---------- quests ----------
  const def = id => C.quests.find(q => q.id === id);
  G.Q = {
    def,
    rec: id => G.save.data.quests[id],
    state(id) {
      const r = G.save.data.quests[id];
      if (r) return r.state;
      const d = def(id);
      return d && d.requires.every(rq => G.Q.state(rq) === 'done') ? 'available' : 'locked';
    },
    is: (id, st) => G.Q.state(id) === st,
    done: id => G.Q.state(id) === 'done',
    open: id => ['available', 'active'].includes(G.Q.state(id)),
    start(id) {
      if (G.Q.state(id) !== 'available') return false;
      G.save.data.quests[id] = { state: 'active', obj: {} };
      G.save.write();
      G.emit('quest:start', id);
      return true;
    },
    objDone(id, objId) {
      const d = def(id), r = G.save.data.quests[id];
      if (!d) return false;
      if (r && r.state === 'done') return true;
      const o = d.objectives.find(x => x.id === objId);
      return !!(r && o && (r.obj[objId] || 0) >= (o.count || 1));
    },
    objCount: (id, objId) => { const r = G.save.data.quests[id]; return r ? (r.obj[objId] || 0) : 0; },
    // amount: number to add; set=true sets the absolute value
    progress(id, objId, amount = 1, set = false) {
      if (G.Q.state(id) === 'available') G.Q.start(id);
      const r = G.save.data.quests[id];
      if (!r || r.state !== 'active') return false;
      const o = def(id).objectives.find(x => x.id === objId);
      if (!o) return false;
      const max = o.count || 1, before = r.obj[objId] || 0;
      const after = Math.min(max, set ? amount : before + amount);
      if (after === before) return false;
      r.obj[objId] = after;
      G.save.write();
      G.emit('quest:update', { id, objId });
      if (def(id).objectives.every(x => (r.obj[x.id] || 0) >= (x.count || 1))) G.Q.complete(id);
      return true;
    },
    complete(id) {
      const d = def(id);
      if (!d || G.Q.state(id) === 'done' || G.Q.state(id) === 'locked') return false;
      const before = new Set(C.quests.filter(q => G.Q.state(q.id) === 'available').map(q => q.id));
      const obj = {};
      d.objectives.forEach(o => { obj[o.id] = o.count || 1; });
      G.save.data.quests[id] = { state: 'done', obj };
      const got = d.rewards.filter(it => G.inv.add(it, d.title));
      G.save.write();
      G.emit('quest:done', { id, rewards: got });
      C.quests.forEach(q => { if (!before.has(q.id) && G.Q.state(q.id) === 'available') G.emit('quest:available', q.id); });
      return true;
    },
    // the one quest the HUD follows
    tracked() {
      const by = (k, st) => C.quests.find(q => q.kind === k && G.Q.state(q.id) === st);
      return by('main', 'active') || by('main', 'available') || by('side', 'active') || null;
    },
    nextObjective(id) {
      const d = def(id);
      if (!d) return null;
      const o = d.objectives.find(x => !G.Q.objDone(id, x.id));
      if (!o) return null;
      return o.count ? `${o.text} (${G.Q.objCount(id, o.id)}/${o.count})` : o.text;
    },
  };

  // ---------- audio ----------
  const A = G.audio = { ctx: null, music: null, sfx: null, mood: 'day', nextBar: 0, bar: 0 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    A.music = A.ctx.createGain(); A.sfx = A.ctx.createGain();
    const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    A.music.connect(lp).connect(A.ctx.destination);
    A.sfx.connect(A.ctx.destination);
    A.apply();
    A.nextBar = A.ctx.currentTime + 0.2;
    setInterval(A.schedule, 120);
  };
  A.apply = function () {
    if (!A.ctx) return;
    const s = G.save.data.settings;
    A.music.gain.setTargetAtTime(s.music ? C.audio.musicVolume * 0.5 : 0, A.ctx.currentTime, 0.3);
    A.sfx.gain.setTargetAtTime(s.sfx ? C.audio.sfxVolume : 0, A.ctx.currentTime, 0.05);
  };
  function note(dest, freq, t, dur, type, vol, attack = 0.01) {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const MOODS = {
    day:    { bpm: 84, chords: [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60]], pad: 0.05, box: 0.06 },
    sunset: { bpm: 74, chords: [[52, 55, 59, 62], [48, 52, 55, 59], [45, 48, 52, 55], [47, 50, 54, 57]], pad: 0.05, box: 0.05 },
    night:  { bpm: 64, chords: [[45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 55], [40, 44, 47, 50]], pad: 0.06, box: 0.045 },
    letter: { bpm: 58, chords: [[53, 57, 60, 64], [45, 48, 52, 57], [46, 50, 53, 58], [48, 52, 55, 60]], pad: 0.03, box: 0.07 },
    finale: { bpm: 90, chords: [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]], pad: 0.06, box: 0.07 },
  };
  A.schedule = function () {
    if (!A.ctx || A.ctx.state !== 'running') return;
    while (A.nextBar < A.ctx.currentTime + 0.4) {
      const m = MOODS[A.mood] || MOODS.day;
      const beat = 60 / m.bpm, barLen = beat * 4, t = A.nextBar;
      const ch = m.chords[A.bar % m.chords.length];
      ch.forEach(n => {
        note(A.music, mtof(n), t, barLen * 1.05, 'triangle', m.pad, 0.6);
        note(A.music, mtof(n) * 1.004, t, barLen * 1.05, 'sine', m.pad * 0.7, 0.6);
      });
      const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
      pattern.forEach((p, i) => {
        if (A.mood === 'letter' && i % 2) return;
        note(A.music, mtof(ch[p] + 12), t + i * beat / 2, beat * 1.4, 'sine', m.box, 0.005);
      });
      A.nextBar += barLen; A.bar++;
    }
  };
  A.setMood = m => { if (MOODS[m]) A.mood = m; };
  const sfx = (fn) => (...a) => { if (A.ctx && A.ctx.state === 'running') fn(...a); };
  const now = () => A.ctx.currentTime;
  A.ding = sfx(() => { note(A.sfx, 880, now(), .15, 'triangle', .2); note(A.sfx, 1320, now() + .07, .2, 'triangle', .18); });
  A.click = sfx(() => note(A.sfx, 660, now(), .06, 'triangle', .12));
  A.success = sfx(() => [523, 659, 784, 1047].forEach((f, i) => note(A.sfx, f, now() + i * .1, .35, 'triangle', .18)));
  A.fail = sfx(() => { note(A.sfx, 330, now(), .18, 'triangle', .15); note(A.sfx, 262, now() + .12, .25, 'triangle', .15); });
  A.door = sfx(() => { note(A.sfx, 196, now(), .25, 'sine', .2); note(A.sfx, 294, now() + .08, .3, 'sine', .14); });
  A.unlock = sfx(() => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => note(A.sfx, f, now() + i * .08, .5, 'sine', .16)));
  A.happyBirthday = sfx(() => {
    const N = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784 };
    const song = [['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2], ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2], ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2]];
    let t = now() + 0.3;
    for (const [n, b] of song) { note(A.sfx, N[n], t, b * .45, 'triangle', .2); t += b * .45; }
  });
})();
