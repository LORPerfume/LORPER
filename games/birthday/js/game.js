/* Game: renderer, landscape stage, input, player, NPCs, camera, interactions, story, 3D mini-games, ending. */
(function () {
  const C = G.C, UI = G.UI;
  const $ = id => document.getElementById(id);
  const game = G.game = {};
  const PI = Math.PI, PI2 = PI * 2;
  const wait = UI.wait;
  let W, scene, renderer, camera;

  // ---------------- stage (always landscape) ----------------
  const stageEl = $('stage'), glc = $('gl'), fxc = $('fx'), fx = fxc.getContext('2d');
  let SW = 0, LW = 0, LH = 0, rotated = false;
  function layout() {
    SW = window.innerWidth; const SH = window.innerHeight;
    rotated = SH > SW;
    LW = rotated ? SH : SW; LH = rotated ? SW : SH;
    stageEl.style.width = LW + 'px'; stageEl.style.height = LH + 'px';
    stageEl.style.transform = rotated ? `translate(${SW}px,0) rotate(90deg)` : 'none';
    if (renderer) { renderer.setSize(LW, LH, false); camera.aspect = LW / LH; camera.updateProjectionMatrix(); }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fxc.width = LW * dpr; fxc.height = LH * dpr; fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const toLocal = e => rotated ? { x: e.clientY, y: SW - e.clientX } : { x: e.clientX, y: e.clientY };
  game.toLocal = toLocal;
  game.stageH = () => LH;

  // ---------------- player state ----------------
  const P = { x: 0, z: 9, angle: PI, zone: 'city', walk: 0, moving: false, run: false, r: 0.32, inTaxi: false };
  let yaw = 0;
  let mode = 'title';
  let acting = false;
  game.playerPos = () => P.inTaxi ? { x: taxi.x, z: taxi.z, angle: taxi.h } : { x: P.x, z: P.z, angle: P.angle };

  // ---------------- helpers ----------------
  const reduced = () => G.save.data.settings.reduced;
  const lines = (npc, key) => (C.dialogs[npc] && C.dialogs[npc][key]) || [];
  const say = (who, l) => UI.say(who, Array.isArray(l) ? l : [l]);
  const Q = G.Q;
  const pt = name => W.points[name];
  function emojiTex(ch, size = 96) {
    return W.canvasTex(size, size, (g) => { g.font = `${size * 0.75}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, size / 2, size / 2 + size * 0.05); });
  }
  function sprite(tex, sx, sy, o = {}) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false }, o)));
    s.scale.set(sx, sy, 1);
    return s;
  }

  // ---------------- characters ----------------
  const SKIN = '#e8b996';
  function human(look) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const sh = { cast: true };
    if (look.male) [-0.12, 0.12].forEach(x => W.cyl(body, 0.08, 0.08, 0.8, 8, look.bottom, x, 0.4, 0, sh));
    else W.cyl(body, 0.22, 0.38, 0.85, 14, look.bottom, 0, 0.43, 0, sh);
    W.cyl(body, 0.24, 0.27, 0.65, 14, look.top, 0, 1.12, 0, sh);
    if (look.apron) W.box(body, 0.36, 0.62, 0.05, look.apron, 0, 0.98, 0.25);
    const arms = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(0.31 * s, 1.4, 0); body.add(p);
      W.cyl(p, 0.06, 0.055, 0.55, 8, look.top, 0, -0.27, 0, sh);
      W.sph(p, 0.06, SKIN, 0, -0.57, 0);
      return p;
    });
    W.cyl(body, 0.07, 0.08, 0.12, 8, SKIN, 0, 1.48, 0);
    if (look.head === 'hijab') {
      W.sph(body, 0.24, look.headColor, 0, 1.71, -0.04, sh);
      W.sph(body, 0.185, SKIN, 0, 1.69, 0.06);
      W.cyl(body, 0.13, 0.3, 0.3, 14, look.headColor, 0, 1.47, 0, sh);
    } else {
      W.sph(body, 0.2, SKIN, 0, 1.68, 0, sh);
      const hair = W.sph(body, 0.21, look.headColor, 0, 1.74, -0.03); hair.scale.y = 0.8;
      if (look.head === 'bun') W.sph(body, 0.1, look.headColor, 0, 1.86, -0.15);
      if (look.head === 'chef') { W.cyl(body, 0.17, 0.15, 0.28, 12, '#ffffff', 0, 1.97, 0); W.sph(body, 0.21, '#ffffff', 0, 2.13, 0); }
      if (look.head === 'cap') { W.cyl(body, 0.215, 0.215, 0.1, 14, look.headColor, 0, 1.86, 0); W.box(body, 0.3, 0.03, 0.18, look.headColor, 0, 1.82, 0.22); }
      if (look.head === 'beret') { const b = W.sph(body, 0.23, look.headColor, 0.03, 1.87, 0); b.scale.y = 0.35; }
    }
    [-0.07, 0.07].forEach(x => W.sph(body, 0.025, '#2b1b17', x, 1.71, 0.2));
    if (look.mustache) W.box(body, 0.14, 0.03, 0.03, '#3b2a20', 0, 1.61, 0.19);
    if (look.camera) W.box(body, 0.22, 0.14, 0.1, '#222', 0, 1.15, 0.28);
    if (look.oud) { const o = W.sph(body, 0.22, '#8d5b3e', 0.05, 1.05, 0.3); o.scale.set(1, 1.3, 0.5); W.box(body, 0.05, 0.05, 0.6, '#5d3a24', 0.2, 1.3, 0.3, { ry: 0.6 }); }
    return { g, body, arms };
  }
  const NPC_LOOK = {
    guide: { top: '#b39ddb', bottom: '#7e57c2', head: 'hijab', headColor: '#f8bbd0' },
    barista: { top: '#f5f5f5', apron: '#6d3b2a', bottom: '#3e2723', head: 'short', headColor: '#3b2a20', male: true, mustache: true },
    sweetsSeller: { top: '#f8bbd0', apron: '#ffffff', bottom: '#ad1457', head: 'hijab', headColor: '#ffffff' },
    florist: { top: '#aed581', apron: '#558b2f', bottom: '#33691e', head: 'hijab', headColor: '#dcedc8' },
    chef: { top: '#ffffff', bottom: '#37474f', head: 'chef', headColor: '#3b2a20', male: true },
    tailor: { top: '#212121', bottom: '#212121', head: 'bun', headColor: '#4e342e' },
    arcadeOwner: { top: '#7c4dff', bottom: '#263238', head: 'cap', headColor: '#ff4fa3', male: true },
    photographer: { top: '#90a4ae', bottom: '#37474f', head: 'short', headColor: '#212121', male: true, camera: true },
    musician: { top: '#8d6e63', bottom: '#3e2723', head: 'beret', headColor: '#b71c1c', male: true, oud: true },
    taxi: { top: '#fff59d', bottom: '#455a64', head: 'cap', headColor: '#f9a825', male: true, mustache: true },
    keeper: { top: '#283593', bottom: '#1a237e', head: 'hijab', headColor: '#3949ab' },
    guard: { top: '#33691e', bottom: '#1b5e20', head: 'cap', headColor: '#1b5e20', male: true, mustache: true },
  };
  const npcs = {};
  let newsTex;
  function makeNPCs() {
    newsTex = W.canvasTex(64, 64, (g) => { g.fillStyle = '#e0a93b'; g.beginPath(); g.arc(32, 32, 28, 0, PI2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 34); });
    for (const id in NPC_LOOK) {
      const p = pt('npc_' + id); if (!p) continue;
      const h = human(NPC_LOOK[id]);
      h.g.position.set(p.x, 0, p.z);
      scene.add(h.g);
      const n = C.npcs[id];
      const label = sprite(W.labelTex(n.name, n.title), 1.7, 0.53); label.position.y = 2.45; label.visible = false; h.g.add(label);
      const news = sprite(newsTex, 0.42, 0.42); news.position.y = 2.95; news.visible = false; h.g.add(news);
      npcs[id] = Object.assign(h, { id, x: p.x, z: p.z, zone: p.zone, label, news, phase: Math.random() * 6 });
    }
  }

  // her
  const her = {};
  function makeHer() {
    her.g = new THREE.Group(); scene.add(her.g);
    her.body = new THREE.Group(); her.g.add(her.body);
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    her.dressMat = lam('#fbf8f4'); her.jacketMat = lam('#1f1a24'); her.hijabMat = lam('#d8cfc4');
    her.jacketMat.side = THREE.DoubleSide;
    const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; her.body.add(o); return o; };
    m(new THREE.CylinderGeometry(0.24, 0.42, 1.0, 18), her.dressMat, 0, 0.5, 0);
    m(new THREE.CylinderGeometry(0.27, 0.38, 0.78, 18, 1, true, 0.55, PI2 - 1.1), her.jacketMat, 0, 0.72, 0);
    m(new THREE.CylinderGeometry(0.13, 0.37, 0.36, 18), her.hijabMat, 0, 1.17, 0);
    her.arms = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(0.34 * s, 1.1, 0); her.body.add(p);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.55, 8), her.jacketMat); a.position.y = -0.27; a.castShadow = true; p.add(a);
      W.sph(p, 0.06, '#f2cdb4', 0, -0.57, 0);
      return p;
    });
    her.acc = {
      necklace: W.sph(her.body, 0.05, '#e0a93b', 0, 1.12, 0.3),
      brooch: W.sph(her.body, 0.05, '#e0a93b', 0.16, 0.95, 0.31),
    };
    const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 20), new THREE.MeshLambertMaterial({ color: '#e0a93b', emissive: '#5a3a00', emissiveIntensity: 0.4 }));
    necklace.rotation.x = PI / 2.3; necklace.position.set(0, 1.18, 0.08); her.body.add(necklace);
    her.acc.necklace2 = necklace;
    const crown = new THREE.Group(); crown.position.y = 2.12; her.g.add(crown);
    W.cyl(crown, 0.16, 0.16, 0.08, 10, '#e0a93b', 0, 0, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI2; W.cyl(crown, 0.001, 0.035, 0.1, 4, '#e0a93b', Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15); }
    her.acc.crown = crown;
    her.headMat = new THREE.SpriteMaterial({ transparent: true, fog: false });
    her.head = new THREE.Sprite(her.headMat); her.head.scale.set(0.64, 0.92, 1); her.head.position.y = 1.62; her.g.add(her.head);
    new THREE.TextureLoader().load(C.faceImage, t => { her.headMat.map = t; her.headMat.needsUpdate = true; }, undefined, () => {
      her.headMat.map = W.canvasTex(180, 260, (g) => {
        g.fillStyle = '#d8cfc4'; g.beginPath(); g.ellipse(90, 130, 88, 128, 0, 0, PI2); g.fill();
        g.fillStyle = '#f2cdb4'; g.beginPath(); g.ellipse(90, 145, 60, 80, 0, 0, PI2); g.fill();
        g.fillStyle = '#3b1f2b'; g.beginPath(); g.arc(68, 135, 7, 0, PI2); g.arc(112, 135, 7, 0, PI2); g.fill();
        g.strokeStyle = '#a61e4d'; g.lineWidth = 5; g.beginPath(); g.arc(90, 170, 20, .2, PI - .2); g.stroke();
      });
      her.headMat.needsUpdate = true;
    });
    // things she carries
    her.carry = new THREE.Group(); her.carry.position.set(0, -0.62, 0.12); her.arms[1].add(her.carry);
  }
  game.setOutfit = function (id) {
    if (!C.items[id] || (id !== 'outfitDefault' && !G.inv.has(id))) id = 'outfitDefault';
    G.save.data.outfit = id; G.save.write();
    const o = id === 'outfitGala' ? C.clothes.outfits[C.clothes.correct] : { dress: '#fbf8f4', jacket: '#1f1a24', hijab: '#d8cfc4', accessory: null };
    her.dressMat.color.set(o.dress); her.jacketMat.color.set(o.jacket); her.hijabMat.color.set(o.hijab);
    her.acc.necklace.visible = false; her.acc.brooch.visible = o.accessory === 'brooch';
    her.acc.necklace2.visible = o.accessory === 'necklace'; her.acc.crown.visible = o.accessory === 'crown';
  };

  // cat
  const cat = {};
  function makeCat() {
    const p = pt('npc_cat');
    cat.g = new THREE.Group(); cat.g.position.set(p.x, 0, p.z); cat.g.rotation.y = -2.4; scene.add(cat.g);
    const b = W.sph(cat.g, 0.3, '#9e9e9e', 0, 0.3, 0, { cast: true }); b.scale.set(1, 0.85, 1.35);
    W.sph(cat.g, 0.24, '#9e9e9e', 0, 0.62, 0.33, { cast: true });
    [-0.12, 0.12].forEach(x => { W.cyl(cat.g, 0.001, 0.08, 0.18, 4, '#757575', x, 0.85, 0.31); W.sph(cat.g, 0.035, '#43a047', x * 0.75, 0.66, 0.54); });
    W.sph(cat.g, 0.03, '#ff8fab', 0, 0.6, 0.57);
    cat.collar = W.cyl(cat.g, 0.17, 0.17, 0.05, 12, '#c2185b', 0, 0.45, 0.3);
    cat.key = W.box(cat.g, 0.06, 0.12, 0.03, '#e0a93b', 0, 0.36, 0.45);
    cat.tail = W.cyl(cat.g, 0.035, 0.05, 0.55, 6, '#757575', 0, 0.5, -0.45); cat.tail.rotation.x = -0.7;
    cat.heart = sprite(emojiTex('💗'), 0.4, 0.4); cat.heart.position.y = 1.2; cat.g.add(cat.heart);
  }

  // taxi
  const taxi = { x: 0, z: 0, h: PI, v: 0 };
  function makeTaxi() {
    taxi.g = new THREE.Group(); scene.add(taxi.g);
    W.box(taxi.g, 1.7, 0.6, 3.6, '#f7c948', 0, 0.6, 0, { cast: true });
    W.box(taxi.g, 1.5, 0.55, 1.9, '#f7c948', 0, 1.17, -0.15, { cast: true });
    W.box(taxi.g, 1.52, 0.4, 1.7, '#2b3a4a', 0, 1.2, -0.15);
    W.box(taxi.g, 1.72, 0.12, 3.62, '#222', 0, 0.33, 0);
    const sign = W.box(taxi.g, 0.7, 0.22, 0.3, '#fff', 0, 1.56, -0.15);
    void sign;
    [[-0.85, 1.15], [0.85, 1.15], [-0.85, -1.15], [0.85, -1.15]].forEach(([x, z]) => W.cyl(taxi.g, 0.33, 0.33, 0.25, 14, '#1b1b1b', x, 0.33, z, { rz: PI / 2 }));
    [-0.55, 0.55].forEach(x => W.box(taxi.g, 0.3, 0.15, 0.05, new THREE.MeshBasicMaterial({ color: '#fff7c2' }), x, 0.65, 1.81));
    resetTaxi();
  }
  function resetTaxi() {
    const s = pt('taxiCar');
    Object.assign(taxi, { x: s.x, z: s.z, h: PI, v: 0 });
    taxi.g.position.set(taxi.x, 0, taxi.z); taxi.g.rotation.y = taxi.h;
  }

  // ---------------- world props controlled by state ----------------
  const props = {};
  const GATED = ['alley', 'yard'];
  function makeProps() {
    // hidden cafe note
    const np = pt('cafe_note');
    props.cafeNote = W.box(scene, 0.25, 0.02, 0.18, '#fff8e1', np.x, 0.03, np.z - 0.5);
    // memory sparkles
    const spark = emojiTex('✨');
    props.memories = C.memories.map(m => {
      const p = pt(m.spot) || pt('plaza');
      const s = sprite(spark, 0.6, 0.6); s.position.set(p.x, 1.2, p.z); scene.add(s);
      return { m, s, x: p.x, z: p.z };
    });
    // objective beacon
    props.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 8, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ff6fa5', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    scene.add(props.beacon);
    props.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), new THREE.MeshBasicMaterial({ color: '#ff3d7f' }));
    props.arrow.rotation.x = PI; scene.add(props.arrow);
    // interaction ring
    props.ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: '#f3d79a', transparent: true, opacity: 0.85 }));
    props.ring.rotation.x = -PI / 2; scene.add(props.ring);
    // carried items
    props.carryCup = W.cyl(her.carry, 0.08, 0.07, 0.14, 10, '#c2185b', 0, 0, 0);
    props.carryCake = W.box(her.carry, 0.2, 0.12, 0.16, '#f8bbd0', 0, 0, 0);
    // stars for the night game
    props.stars = [];
    const starMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });
    for (let i = 0; i < C.stars.target + 6; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.32), starMat));
      g.add(sprite(W.glowTex, 1.6, 1.6, { blending: THREE.AdditiveBlending }));
      g.visible = false; scene.add(g);
      props.stars.push(g);
    }
    // particles
    props.fxTex = { heart: emojiTex('💗', 64), star: emojiTex('✨', 64), gold: emojiTex('⭐', 64) };
    props.particles = [];
  }
  function burst(x, y, z, kind = 'heart', n = 14) {
    if (reduced()) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const s = sprite(props.fxTex[kind], 0.35, 0.35);
      s.position.set(x, y, z); scene.add(s);
      const a = Math.random() * PI2, sp = 0.8 + Math.random() * 1.8;
      props.particles.push({ s, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.2, vz: Math.sin(a) * sp, life: 1.3 });
    }
  }
  game.burst = burst;

  // ---------------- state → world ----------------
  function syncWorld() {
    const f = k => G.flags.get(k);
    W.cafeCup.visible = !Q.objDone('cafe', 'cup');
    // alley gate
    const alleyOpen = !!f('alleyOpen');
    W.alleyGate.leaves[0].rotation.y = alleyOpen ? -1.6 : 0; W.alleyGate.leaves[1].rotation.y = alleyOpen ? 1.6 : 0;
    // secret gate
    const gateOpen = !!f('gateOpen');
    W.gate.leaves[0].rotation.y = gateOpen ? -1.7 : 0; W.gate.leaves[1].rotation.y = gateOpen ? 1.7 : 0;
    // restaurant table
    const t = Q.objCount('restaurant', 'table') + (Q.done('restaurant') ? 3 : 0);
    W.restTable.plate.visible = t >= 1 || Q.done('restaurant');
    W.restTable.candle.visible = t >= 2 || Q.done('restaurant');
    W.restTable.flowers.visible = t >= 3 || Q.done('restaurant');
    W.restTable.note.visible = Q.objDone('restaurant', 'plate');
    W.restTable.plate.position.z = -0.8 + (Q.objDone('restaurant', 'plate') ? -0.15 : 0);
    // clock
    W.drawClock(Q.done('clock') ? C.clock.hour : 4, Q.done('clock') ? C.clock.minute : 0);
    W.towerDoor.rotation.y = Q.done('clock') ? -1.8 : 0;
    // tod
    W.tod = G.save.data.tod;
    W.applyTime(W.tod);
    // garden letters
    const nLetters = C.letters.filter((_, i) => G.inv.has('letter' + (i + 1))).length;
    W.gardenLetters.forEach((m, i) => { m.visible = i < nLetters; });
    fillEasels();
    W.giftLid.position.set(0, 1.1, 0); W.giftLid.rotation.set(0, 0, 0);
    W.giftLight.intensity = 0;
    game.setOutfit(G.save.data.outfit);
    cat.key.visible = !Q.done('cat');
    resetTaxi();
  }
  function fillEasels() {
    const found = new Set(G.save.data.photos);
    W.easels.forEach((e, i) => {
      const m = C.memories[i];
      if (!m) { e.group.visible = false; return; }
      if (found.has(m.id)) {
        const img = new Image();
        img.onload = () => { const t = new THREE.Texture(img); t.needsUpdate = true; e.pic.material = new THREE.MeshBasicMaterial({ map: t }); };
        img.onerror = () => { const t = new THREE.TextureLoader().load(UI.photoURL({ id: m.id + '_err', title: m.title }, i)); e.pic.material = new THREE.MeshBasicMaterial({ map: t }); };
        img.src = UI.photoURL(m, i);
      } else {
        e.pic.material = new THREE.MeshBasicMaterial({ map: emojiTex('💛', 96), color: '#ffffff' });
      }
    });
  }

  // ---------------- rewards & notifications ----------------
  function itemToast(id) { const d = C.items[id]; if (d) UI.toast(d.icon, 'حصلتي على', d.name); }
  G.on('item', id => {
    itemToast(id);
    if (/^letter\d$/.test(id)) {
      const n = C.letters.filter((_, i) => G.inv.has('letter' + (i + 1))).length;
      Q.progress('letters', 'collect', n, true);
    }
    if (id === 'letter1') game.whenFree(() => UI.toast('💌', 'الرسائل السبعة', 'لقيتي أول رسالة! اقريها من الحقيبة 🎒'));
  });
  G.on('quest:done', ({ id }) => {
    const q = Q.def(id);
    UI.toast(q.kind === 'main' ? '🌟' : '💫', 'مهمة مكتملة', q.title);
    G.audio.success();
    const p = game.playerPos(); burst(p.x, 1.8, p.z, 'gold', 16);
    const ach = { cafe: 'cafeDone', flowers: 'goldenRose', restaurant: 'dinner', clothes: 'fashion', arcade: 'arcade', cat: 'catFriend', clock: 'clock', stars: 'stars', quiz: 'quiz', memory: 'memory', taxi: 'taxi', album: 'album', letters: 'letters', finale: 'finale' }[id];
    if (ach) G.ach.unlock(ach);
    const todAfter = { cafe: 1, restaurant: 2, arcade: 3 }[id];
    if (todAfter && G.save.data.tod < todAfter) { G.save.data.tod = todAfter; G.save.write(); UI.toast(todAfter === 3 ? '🌙' : '🌇', todAfter === 3 ? 'نزل الليل على المدينة' : todAfter === 2 ? 'الشمس عم تغيب' : 'صار العصر', ''); }
    if (id === 'letters') game.whenFree(async () => { UI.toast('💌', 'الخطاب الكامل جاهز', 'جمعتي الرسائل السبعة!'); });
    UI.updateTracker();
  });
  G.on('quest:available', id => { const q = Q.def(id); UI.toast('📜', q.kind === 'main' ? 'مهمة جديدة' : 'مهمة جانبية جديدة', q.title); UI.updateTracker(); });
  G.on('quest:start', () => UI.updateTracker());
  G.on('quest:update', () => UI.updateTracker());
  G.on('achievement', id => { const a = C.achievements[id]; UI.toast(a.icon, 'إنجاز جديد', a.name); });
  const freeQueue = [];
  game.whenFree = fn => freeQueue.push(fn);

  // ---------------- zones / doors ----------------
  const SHOP_NPC = { cafe: 'barista', sweets: 'sweetsSeller', flowers: 'florist', restaurant: 'chef', clothes: 'tailor', arcade: 'arcadeOwner', photo: 'photographer' };
  const SHOP_OPEN = { cafe: 'welcome', sweets: 'welcome', photo: 'welcome', flowers: 'cafe', restaurant: 'flowers', clothes: 'restaurant', arcade: 'clothes' };
  const shopOpen = id => Q.done(SHOP_OPEN[id]);
  async function enterShop(id) {
    if (!shopOpen(id)) {
      const l = lines(SHOP_NPC[id], 'locked');
      await say(C.shops[id].name, l.length ? l : ['المحل مسكّر هلأ… كمّلي مهامك وارجعي 🔒']);
      return;
    }
    const d = W.doors[id];
    G.audio.door(); d.target = 1;
    await UI.fade(async () => {
      P.zone = id; W.inRoom = id;
      const r = W.rooms[id];
      P.x = r.spawn.x; P.z = r.spawn.z; P.angle = PI; yaw = 0;
      W.applyTime(W.tod);
      snapCamera();
      d.target = 0; d.open = 0;
    });
    UI.zoneTitle(C.shops[id].name);
    G.ach.unlock('firstShop');
    savePos(true);
    updateMood();
  }
  async function exitShop() {
    const id = P.zone, d = W.doors[id];
    G.audio.door();
    await UI.fade(async () => {
      P.zone = 'city'; W.inRoom = null;
      P.x = d.x + d.out.x * 0.6; P.z = d.z + d.out.z * 0.6;
      P.angle = Math.atan2(d.out.x, d.out.z);
      yaw = P.angle + PI;
      W.applyTime(W.tod);
      d.open = 1; d.target = 0;
      snapCamera();
    });
    savePos(true);
    updateMood();
  }

  // ---------------- interactions ----------------
  const acts = [];
  const act = (o) => acts.push(Object.assign({ r: 1.5, icon: '✋' }, o));
  const talkIcon = '💬';
  function npcAct(id, label, fn, extra) {
    act(Object.assign({ id: 'npc_' + id, npc: id, zoneOf: () => npcs[id].zone, pos: () => npcs[id], r: 2.2, icon: talkIcon, label: () => typeof label === 'function' ? label() : label || ('احكي مع ' + C.npcs[id].name), run: fn }, extra || {}));
  }
  function itemAct(id, pointName, label, show, fn, icon = '✨') {
    act({ id, zoneOf: () => pt(pointName).zone, pos: () => pt(pointName), label, show, run: fn, icon });
  }

  function setupActs() {
    // doors
    for (const id in W.doors) {
      act({ id: 'door_' + id, zoneOf: () => 'city', pos: () => W.doors[id], r: 1.7, icon: () => shopOpen(id) ? '🚪' : '🔒', label: () => (shopOpen(id) ? 'ادخلي ' : '🔒 ') + C.shops[id].name, run: () => enterShop(id) });
      act({ id: 'exit_' + id, zoneOf: () => id, pos: () => pt('exit_' + id), r: 1.3, icon: '🚪', label: () => 'اطلعي للشارع', run: exitShop });
    }

    // ---- guide ----
    npcAct('guide', null, async () => {
      if (!Q.done('welcome')) {
        Q.start('welcome');
        await say('guide', lines('guide', 'intro'));
        Q.progress('welcome', 'talk');
      } else if (G.save.data.endingDone) await say('guide', lines('guide', 'done'));
      else if (Q.open('finale') || Q.open('password')) await say('guide', lines('guide', 'late'));
      else await say('guide', [...lines('guide', 'progress'), '💡 ' + (game.hintFor((Q.tracked() || {}).id) || '')]);
    });

    // ---- cafe ----
    npcAct('barista', null, async () => {
      if (!Q.open('cafe') && !Q.done('cafe')) return say('barista', ['أهلاً! ارجعي لما تخلّصي حكيك مع ليلى ☕']);
      if (Q.done('cafe')) return say('barista', lines('barista', 'done'));
      if (!Q.objDone('cafe', 'talk')) { await say('barista', lines('barista', 'start')); Q.progress('cafe', 'talk'); return; }
      if (!(Q.objDone('cafe', 'cup') && Q.objDone('cafe', 'dessert') && Q.objDone('cafe', 'note'))) return say('barista', lines('barista', 'progress'));
      return cafeDrink();
    });
    itemAct('cafe_counter', 'cafe_counter', () => 'اختاري المشروب', () => Q.is('cafe', 'active') && Q.objDone('cafe', 'cup') && Q.objDone('cafe', 'dessert') && Q.objDone('cafe', 'note'), cafeDrink, '☕');
    async function cafeDrink() {
      await say('barista', lines('barista', 'ready'));
      const i = await UI.choose('barista', C.cafe.question || 'شو مشروبك المفضّل؟', C.cafe.drinks);
      if (i < 0) return;
      if (i === C.cafe.correct) {
        G.audio.success();
        await say('barista', [`${C.cafe.drinks[i]}! بتعرفيه منيح ☕💛`, 'هاي الرسالة الأولى إلك… ومعها رمز سري صغير.']);
        Q.progress('cafe', 'drink');
        const p = game.playerPos(); burst(p.x, 1.6, p.z, 'heart', 18);
        await say(null, ['💌 ' + G.fmt(C.letters[0])]);
        await say('barista', ['بالمناسبة… ياسمين ببيت الورد بتستناكِ 🌷', 'وأم فادي بتقول في ورقة غريبة ملزوقة عباب محلها.']);
      } else { G.audio.fail(); await say('barista', ['ممم… مش هاد. 💡 ' + G.fmt(C.cafe.hint)]); }
    }
    itemAct('cafe_cup', 'cafe_cup', () => 'خدي الفنجان الخاص', () => Q.is('cafe', 'active') && Q.objDone('cafe', 'talk') && !Q.objDone('cafe', 'cup'), async () => {
      W.cafeCup.visible = false; G.audio.ding(); burst(W.cafeCup.position.x, 1.8, W.cafeCup.position.z, 'star', 8);
      Q.progress('cafe', 'cup'); G.inv.add('coffeeCup', C.shops.cafe.name);
    }, '☕');
    itemAct('cafe_note', 'cafe_note', () => 'شوفي شو تحت الكرسي', () => Q.is('cafe', 'active') && Q.objDone('cafe', 'talk') && !Q.objDone('cafe', 'note'), async () => {
      G.audio.ding(); await say(null, [G.fmt(C.notes.cafeHidden)]);
      Q.progress('cafe', 'note'); G.inv.add('cafeNote', C.shops.cafe.name);
    }, '📝');
    npcAct('sweetsSeller', null, async () => {
      if (Q.is('cafe', 'active') && Q.objDone('cafe', 'talk') && !Q.objDone('cafe', 'dessert')) {
        await say('sweetsSeller', lines('sweetsSeller', 'give'));
        Q.progress('cafe', 'dessert'); G.inv.add('dessert', C.shops.sweets.name); G.audio.ding();
      } else if (Q.done('cafe') && !Q.done('signs')) await say('sweetsSeller', lines('sweetsSeller', 'after'));
      else await say('sweetsSeller', lines('sweetsSeller', 'idle'));
    });

    // ---- signs → alley ----
    itemAct('note1', 'note1', () => 'اقري الورقة الملزوقة', () => Q.open('signs') && !Q.objDone('signs', 'note1'), async () => {
      G.audio.ding(); await say(null, [G.fmt(C.notes.sign1)]); Q.progress('signs', 'note1');
    }, '📝');
    itemAct('note2', 'note2', () => 'اقري الورقة عالعمود', () => Q.is('signs', 'active') && Q.objDone('signs', 'note1') && !Q.objDone('signs', 'note2'), async () => {
      G.audio.ding(); await say(null, [G.fmt(C.notes.sign2)]); Q.progress('signs', 'note2');
    }, '📝');
    npcAct('musician', null, async () => {
      if (Q.is('signs', 'active') && Q.objDone('signs', 'note2')) {
        await say('musician', lines('musician', 'signs'));
        Q.progress('signs', 'musician');
        await openAlley();
      } else if (Q.done('signs')) await say('musician', lines('musician', 'done'));
      else await say('musician', lines('musician', 'idle'));
    });
    act({ id: 'alleyGate', zoneOf: () => 'city', pos: () => pt('alleyGate'), r: 1.8, icon: '🔒', show: () => !G.flags.get('alleyOpen'), label: () => C.streets.alley + ' (مقفول)', run: () => say(null, ['البوابة مقفولة… يمكن في إشارات بتدلّك على مفتاحها؟']) });

    // ---- cat ----
    W.paws.forEach((paw, i) => itemAct('paw' + (i + 1), 'paw' + (i + 1), () => 'تتبّعي الآثار 🐾', () => Q.open('cat') && G.flags.get('alleyOpen') && Q.objCount('cat', 'paws') === i, async () => {
      G.audio.ding(); burst(paw.position.x, 0.6, paw.position.z, 'star', 6);
      await say(null, [G.fmt(C.notes.paw)]); Q.progress('cat', 'paws');
    }, '🐾'));
    act({ id: 'cat', zoneOf: () => 'city', pos: () => pt('npc_cat'), r: 1.7, icon: '🐱', label: () => Q.done('cat') ? 'دلّعي القطة' : 'اقتربي من القطة', show: () => G.flags.get('alleyOpen'), run: async () => {
      if (Q.done('cat')) { burst(cat.g.position.x, 1, cat.g.position.z, 'heart', 8); G.audio.ding(); return; }
      if (Q.objCount('cat', 'paws') < 3) return say(null, [G.fmt(C.notes.catHiding)]);
      await say(null, C.notes.catFound.map(G.fmt));
      cat.key.visible = false; burst(cat.g.position.x, 1, cat.g.position.z, 'heart', 14);
      Q.progress('cat', 'find');
    } });

    // ---- flowers ----
    npcAct('florist', null, async () => {
      if (Q.done('flowers')) return say('florist', lines('florist', 'done'));
      if (!Q.open('flowers')) return say('florist', lines('florist', 'locked'));
      await say('florist', lines('florist', 'start'));
      Q.progress('flowers', 'talk');
    });
    C.flowers.bouquets.forEach((b, i) => itemAct('bouquet' + i, 'bouquet' + i, () => b.name, () => Q.is('flowers', 'active') && Q.objDone('flowers', 'talk'), async () => {
      const yes = await UI.choose('florist', `بدك تختاري ${b.name}؟`, ['آه، هاي هي', 'لا، خليني أشوف']);
      if (yes !== 0) return;
      if (i === C.flowers.correct) {
        W.bouquets[i].visible = false; G.audio.success(); burst(W.bouquets[i].position.x, 1.5, W.bouquets[i].position.z, 'heart', 16);
        await say('florist', ['هاي هي! 🌹 اختيارك دايماً صح.', 'ومع الباقة… وردة ذهبية ما بتذبل أبداً.']);
        Q.progress('flowers', 'pick');
        await say(null, ['💌 ' + G.fmt(C.letters[1])]);
        await say('florist', lines('florist', 'done'));
      } else { G.audio.fail(); await say('florist', [...lines('florist', 'wrong'), '💡 ' + G.fmt(C.flowers.hint)]); }
    }, '💐'));

    // ---- restaurant ----
    npcAct('chef', null, async () => {
      if (Q.done('restaurant')) return say('chef', lines('chef', 'done'));
      if (!Q.open('restaurant')) return say('chef', lines('chef', 'locked'));
      if (!Q.objDone('restaurant', 'talk')) { await say('chef', lines('chef', 'start')); Q.progress('restaurant', 'talk'); }
      if (!Q.objDone('restaurant', 'menu')) {
        const R = C.restaurant;
        const a = await UI.choose('chef', 'شو بتحبي تاكلي؟', R.foods); if (a < 0) return;
        const b = await UI.choose('chef', 'وشو المشروب؟', R.drinks); if (b < 0) return;
        const c = await UI.choose('chef', 'وأي ورد نحط عالطاولة؟', R.flowers); if (c < 0) return;
        G.flags.set('menu', `${R.foods[a]} • ${R.drinks[b]} • ${R.flowers[c]}`);
        Q.progress('restaurant', 'menu');
        return say('chef', [`${R.foods[a]} و${R.drinks[b]} و${R.flowers[c]}… ذوقك رفيع!`, ...lines('chef', 'table')]);
      }
      if (Q.objCount('restaurant', 'table') < 3) return say('chef', lines('chef', 'table'));
      if (!Q.objDone('restaurant', 'plate')) return say('chef', lines('chef', 'plate'));
      return chefQuestion();
    });
    async function chefQuestion() {
      const R = C.restaurant.question;
      await say('chef', lines('chef', 'question'));
      const i = await UI.choose('chef', R.text, R.options);
      if (i < 0) return;
      if (i === R.correct) {
        Q.progress('restaurant', 'question');
        await say(null, ['💌 ' + G.fmt(C.letters[2])]);
        await say('chef', lines('chef', 'done'));
      } else { G.audio.fail(); await say('chef', ['مش هيك بالزبط… 💡 ' + G.fmt(R.hint)]); }
    }
    const TABLE = [['حطي الصحن', '🍽️'], ['ولّعي الشمعة', '🕯️'], ['حطي الورد', '🌹']];
    act({ id: 'rest_table', zoneOf: () => 'restaurant', pos: () => pt('rest_table'), r: 1.6, icon: '🍽️',
      show: () => Q.is('restaurant', 'active') && Q.objDone('restaurant', 'menu') && !Q.objDone('restaurant', 'plate'),
      label: () => { const n = Q.objCount('restaurant', 'table'); return n < 3 ? TABLE[n][0] : 'شوفي شو تحت الصحن'; },
      run: async () => {
        const n = Q.objCount('restaurant', 'table');
        if (n < 3) {
          G.audio.ding(); Q.progress('restaurant', 'table'); syncWorld();
          burst(W.restTable.plate.position.x, 1.3, W.restTable.plate.position.z, n === 2 ? 'heart' : 'star', 8);
          if (n === 2) await say('chef', lines('chef', 'plate'));
        } else {
          Q.progress('restaurant', 'plate'); syncWorld(); G.audio.ding();
          await say(null, ['رفعتي الصحن… ولقيتي ورقة صغيرة:', G.fmt(C.restaurant.plateNote)]);
          await chefQuestion();
        }
      } });

    // ---- clothes ----
    npcAct('tailor', null, async () => {
      if (Q.done('clothes')) return say('tailor', lines('tailor', 'done'));
      if (!Q.open('clothes')) return say('tailor', lines('tailor', 'locked'));
      await say('tailor', lines('tailor', 'start'));
      Q.progress('clothes', 'talk');
    });
    C.clothes.outfits.forEach((o, i) => itemAct('outfit' + i, 'outfit' + i, () => 'جرّبي ' + o.name, () => Q.is('clothes', 'active') && Q.objDone('clothes', 'talk'), async () => {
      const yes = await UI.choose('tailor', `${o.name}… هاي اللبسة؟`, ['آه، هاي', 'لا، رجعيها']);
      if (yes !== 0) return;
      if (i === C.clothes.correct) {
        Q.progress('clothes', 'pick');
        game.setOutfit('outfitGala');
        burst(P.x, 1.8, P.z, 'star', 18);
        await say(null, ['💌 ' + G.fmt(C.letters[3])]);
        await say('tailor', ['اللبسة صارت إلك، وبتقدري تغيّريها من الحقيبة 🎒', 'والخريطة السرية بتكشف أماكن صور الذكريات على الخريطة 📸', 'زيد بصالة النجوم عنده تحدّي إلك 🕹️']);
      } else { G.audio.fail(); await say('tailor', [...lines('tailor', 'wrong'), '💡 ' + G.fmt(C.clothes.hint)]); }
    }, '👗'));

    // ---- arcade ----
    npcAct('arcadeOwner', null, async () => {
      if (Q.done('arcade')) return say('arcadeOwner', lines('arcadeOwner', 'done'));
      if (!Q.open('arcade')) return say('arcadeOwner', lines('arcadeOwner', 'locked'));
      await say('arcadeOwner', lines('arcadeOwner', 'start'));
      Q.progress('arcade', 'talk');
    });
    itemAct('heartMachine', 'heartMachine', () => Q.done('arcade') ? 'العبي للتسلية 💗' : 'العبي تحدي القلوب', () => Q.done('arcade') || (Q.is('arcade', 'active') && Q.objDone('arcade', 'talk')), async () => {
      const won = await UI.heartsGame();
      if (won && !Q.done('arcade')) {
        Q.progress('arcade', 'win');
        await say('arcadeOwner', lines('arcadeOwner', 'done'));
        await say(null, ['💌 ' + G.fmt(C.letters[4])]);
        await say('arcadeOwner', ['وبرّا… الليل نزل. سلمى بحديقة النجوم عندها إشي إلك 🌙']);
      } else if (!won && !Q.done('arcade')) await say('arcadeOwner', lines('arcadeOwner', 'retry'));
    }, '🕹️');

    // ---- photo studio: quiz & memory ----
    npcAct('photographer', null, async () => {
      if (Q.done('quiz') && Q.done('memory')) return say('photographer', lines('photographer', 'done'));
      await say('photographer', lines('photographer', 'idle'));
    });
    itemAct('memoryTable', 'memoryTable', () => Q.done('memory') ? 'العبي تحدي الذاكرة' : 'تحدي الذاكرة 🃏', () => Q.open('memory') || Q.done('memory'), async () => {
      const won = await UI.memoryGame();
      if (won) Q.progress('memory', 'win');
    }, '🃏');
    itemAct('quizBooth', 'quizBooth', () => Q.done('quiz') ? 'العبي "كم بتعرفيني؟"' : 'كم بتعرفيني؟ 💯', () => Q.open('quiz') || Q.done('quiz'), async () => {
      const startAt = Q.done('quiz') ? 0 : Q.objCount('quiz', 'answer');
      await UI.quiz(startAt, (i) => { if (!Q.done('quiz')) Q.progress('quiz', 'answer', i + 1, true); });
    }, '💯');

    // ---- clock ----
    act({ id: 'clock', zoneOf: () => 'city', pos: () => pt('clock'), r: 2.0, icon: '🕰️', label: () => Q.done('clock') ? 'الساعة الكبيرة' : 'افحصي الساعة الكبيرة', run: async () => {
      if (Q.done('clock')) return say(null, ['الساعة واقفة على وقتكم 🕰️💛']);
      if (!Q.open('clock')) return say(null, [G.fmt(C.notes.clockIdle)]);
      await say(null, [G.fmt(C.notes.clockStart)]);
      const ok = await UI.clockPuzzle();
      if (!ok) return;
      G.audio.unlock();
      await animate(1.2, t => { W.towerDoor.rotation.y = -1.8 * t; });
      burst(0, 1.5, 1.8, 'gold', 16);
      await say(null, C.notes.clockDone.map(G.fmt));
      Q.progress('clock', 'set');
      await say(null, ['💌 ' + G.fmt(C.letters[5])]);
    } });

    // ---- stars (park, night) ----
    npcAct('keeper', null, async () => {
      if (Q.done('stars')) return say('keeper', lines('keeper', 'done'));
      if (!Q.open('stars')) return say('keeper', lines('keeper', 'locked'));
      if (!Q.objDone('stars', 'talk')) { await say('keeper', lines('keeper', 'start')); Q.progress('stars', 'talk'); return; }
      if (starsGame.active) return say('keeper', ['يلا يلا! النجوم عم تختفي ✨']);
      const go = await UI.choose('keeper', 'جاهزة؟ عندك ' + C.stars.seconds + ' ثانية.', ['يلا!', 'بعدين']);
      if (go === 0) startStars();
    });

    // ---- taxi ----
    npcAct('taxi', null, async () => {
      if (!Q.open('taxi') && !Q.done('taxi')) return say('taxi', ['التاكسي بخدمتك بس لسا بدري… ارجعي بعدين 🚕']);
      await say('taxi', Q.done('taxi') ? lines('taxi', 'done') : lines('taxi', 'idle'));
      const go = await UI.choose('taxi', `توصلي لمدخل ${C.streets.park} بـ ${C.taxi.seconds} ثانية؟`, ['يلا نسوق!', 'مش هلأ']);
      if (go === 0) startTaxi();
    });

    // ---- gate & guard ----
    const gateLabel = () => G.flags.get('gateOpen') ? C.streets.secret : (Q.open('finale') ? 'افتحي البوابة 🔑' : (Q.open('password') ? 'ادخلي كلمة السر' : 'البوابة المقفولة'));
    const gateRun = async () => {
      if (G.flags.get('gateOpen')) return say(null, ['البوابة مفتوحة… الهدية جوّا 💛']);
      if (Q.open('password')) {
        const chars = ['symbol1', 'symbol2', 'symbol3', 'symbol4'].filter(G.inv.has).map(s => C.password.symbols[s]);
        await say('guard', lines('guard', 'code'));
        const ok = await UI.passwordPuzzle(chars);
        if (ok) Q.progress('password', 'code');
        if (!Q.open('finale')) return say('guard', ['كلمة السر صح! بقي تجيبي المفاتيح والرسائل اللي ناقصة.', ...missingList()]);
      }
      if (Q.open('finale')) return openGate();
      await say('guard', [...lines('guard', 'locked'), ...missingList()]);
    };
    npcAct('guard', null, gateRun);
    act({ id: 'gate', zoneOf: () => 'city', pos: () => pt('gate'), r: 2.2, icon: '🔐', label: gateLabel, show: () => !G.flags.get('gateOpen'), run: gateRun });
    act({ id: 'gift', zoneOf: () => 'city', pos: () => pt('gift'), r: 2.0, icon: '🎁', show: () => G.flags.get('gateOpen'), label: () => G.save.data.endingDone ? 'افتحي الهدية مرة ثانية' : 'افتحي الهدية 🎁', run: () => playEnding() });

    // ---- memories ----
    props.memories.forEach((pm, i) => act({ id: 'mem_' + pm.m.id, zoneOf: () => 'city', pos: () => pm, r: 1.6, icon: '📸', label: () => 'في إشي بيلمع هون…',
      show: () => !G.save.data.photos.includes(pm.m.id) && Q.done('welcome') && (!GATED.includes(pm.m.spot) || G.flags.get('alleyOpen')),
      run: async () => {
        G.save.data.photos.push(pm.m.id); G.save.write();
        G.audio.unlock(); burst(pm.x, 1.4, pm.z, 'star', 14);
        UI.toast('📸', 'ذكرى جديدة', pm.m.title);
        Q.progress('album', 'photos', G.save.data.photos.length, true);
        UI.showPhoto(pm.m, i);
        fillEasels();
      } }));
  }
  function missingList() {
    const out = [];
    const keys = ['key1', 'key2', 'key3'].filter(k => !G.inv.has(k)).map(k => C.items[k].name);
    if (keys.length) out.push('🔑 ناقصك: ' + keys.join('، '));
    if (!Q.done('password')) out.push('🔣 كلمة السر لسا ما انحلّت' + (Q.open('password') ? '' : ' (اجمعي الرموز الأربعة أول)'));
    if (!Q.done('stars')) out.push('⭐ لسا ما جمعتي نجوم الليل');
    return out;
  }

  // ---------------- story helpers ----------------
  function animate(sec, fn) {
    return new Promise(res => {
      const t0 = performance.now(), d = reduced() ? Math.min(sec, 0.3) * 1000 : sec * 1000;
      const step = () => { const t = Math.min(1, (performance.now() - t0) / d); fn(t * t * (3 - 2 * t)); if (t < 1) requestAnimationFrame(step); else res(); };
      step();
    });
  }
  let camOverride = null;
  async function cutscene(camPos, look, fn, text) {
    UI.cinematic = true; UI.bars(true); UI.showHUD(false); UI.setAction(null);
    camOverride = { pos: new THREE.Vector3(...camPos), look: new THREE.Vector3(...look) };
    await wait(reduced() ? 100 : 700);
    const p = fn ? fn() : null;
    if (text) await UI.cine(text, 2300);
    await p;
    await wait(300);
    camOverride = null; UI.bars(false); UI.showHUD(true); UI.cinematic = false;
  }
  async function openAlley() {
    G.flags.set('alleyOpen', true);
    G.audio.unlock();
    await cutscene([22, 4.5, -2], [26, 1.3, 7], () => animate(1.8, t => { W.alleyGate.leaves[0].rotation.y = -1.6 * t; W.alleyGate.leaves[1].rotation.y = 1.6 * t; }), [`${C.streets.alley} انفتح… 🐾`]);
    UI.toast('🗺️', 'منطقة جديدة', C.streets.alley);
  }
  async function openGate() {
    Q.progress('finale', 'gate');
    G.flags.set('gateOpen', true);
    G.audio.unlock();
    if (G.save.data.tod < 3) { G.save.data.tod = 3; G.save.write(); }
    await cutscene([0, 3.6, -36], [0, 2.2, -46], async () => {
      const p = new THREE.Vector3(0, 2, -44.2);
      burst(p.x, p.y, p.z, 'gold', 20);
      await wait(900);
      await animate(2.4, t => { W.gate.leaves[0].rotation.y = -1.7 * t; W.gate.leaves[1].rotation.y = 1.7 * t; });
    }, C.finale.gateLines);
    UI.toast('🗺️', 'منطقة جديدة', C.streets.secret);
  }
  async function gardenReveal() {
    G.flags.set('gardenSeen', true);
    syncWorld();
    G.audio.setMood('finale');
    UI.cinematic = true; UI.bars(true); UI.showHUD(false); UI.setAction(null);
    const path = [[0, 3, -45], [-7, 3.5, -52], [0, 5, -66], [7, 3.5, -52], [0, 3.2, -48]];
    const look = new THREE.Vector3(0, 1.2, -58.5);
    camOverride = { pos: new THREE.Vector3(...path[0]), look };
    const textP = UI.cine(C.finale.gardenLines, 2400);
    await animate(reduced() ? 1 : 7.5, t => {
      const f = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), k = f - i;
      camOverride.pos.set(...path[i].map((v, j) => v + (path[i + 1][j] - v) * k));
    });
    await textP;
    camOverride = null; UI.bars(false); UI.showHUD(true); UI.cinematic = false;
  }
  async function playEnding() {
    if (!G.flags.get('gateOpen')) return;
    UI.cinematic = true; UI.bars(true); UI.showHUD(false); UI.setAction(null);
    G.audio.setMood('finale');
    W.giftLid.position.set(0, 1.1, 0); W.giftLid.rotation.set(0, 0, 0);
    const look = new THREE.Vector3(0, 1.3, -58.5);
    camOverride = { pos: new THREE.Vector3(0, 3, -53), look };
    const textP = UI.cine(C.finale.giftLines, 2200);
    await animate(reduced() ? 0.6 : 2.6, t => { const a = t * 1.4; camOverride.pos.set(Math.sin(a) * 5, 2.6 + t * 0.6, -58.5 + Math.cos(a) * 5); });
    G.audio.unlock();
    W.giftLight.intensity = 0;
    await animate(1.4, t => { W.giftLid.position.set(t * 1.1, 1.1 + t * 1.6, 0); W.giftLid.rotation.z = -t * 1.3; W.giftLight.intensity = t * 2.2; });
    burst(0, 2, -58.5, 'heart', 26); burst(0, 2.2, -58.5, 'gold', 20);
    G.audio.happyBirthday();
    confettiOn = true;
    await textP;
    await wait(reduced() ? 300 : 1200);
    camOverride = null; UI.bars(false); UI.cinematic = false;
    if (!G.save.data.endingDone) { G.save.data.endingDone = true; G.save.write(); }
    Q.progress('finale', 'gift');
    UI.showEnding();
  }
  game.replayEnding = async function () {
    if (!G.save.data.endingDone) return;
    $('ending').hidden = true;
    if (P.zone !== 'city' || P.z > -46) {
      await UI.fade(async () => {
        if (P.zone !== 'city') { P.zone = 'city'; W.inRoom = null; W.applyTime(W.tod); }
        const g = pt('gift'); P.x = g.x; P.z = g.z + 1.2; P.angle = PI; yaw = 0; snapCamera();
      });
    }
    playEnding();
  };
  game.afterEnding = () => { confettiOn = false; UI.showHUD(true); UI.updateTracker(); updateMood(); };

  // ---------------- 3D mini-games ----------------
  const starsGame = { active: false, t: 0, got: 0, list: [] };
  function startStars() {
    const c = pt('starsCenter');
    starsGame.active = true; starsGame.t = C.stars.seconds; starsGame.got = 0;
    starsGame.list = props.stars.map((s, i) => {
      let x, z, tries = 0;
      do { x = c.x + (Math.random() - 0.5) * 38; z = c.z + (Math.random() - 0.5) * 22; tries++; } while (tries < 30 && blocked(x, z, 0.6));
      s.position.set(x, 1, z); s.visible = true;
      return { s, x, z, got: false, phase: i };
    });
    UI.toast('⭐', 'نجوم الليل', `اجمعي ${C.stars.target} نجمة!`);
  }
  function endStars(win) {
    starsGame.active = false; UI.timer(null);
    props.stars.forEach(s => { s.visible = false; });
    if (win) {
      Q.progress('stars', 'collect');
      game.whenFree(async () => {
        await say('keeper', lines('keeper', 'done'));
        await say(null, ['💌 ' + G.fmt(C.letters[6])]);
      });
    } else { G.audio.fail(); game.whenFree(() => say('keeper', lines('keeper', 'retry'))); }
  }
  function updateStars(dt) {
    if (!starsGame.active) return;
    starsGame.t -= dt;
    for (const s of starsGame.list) {
      if (s.got) continue;
      s.s.position.y = 1 + Math.sin(performance.now() / 400 + s.phase) * 0.2;
      s.s.children[0].rotation.y += dt * 2;
      if (Math.hypot(s.x - P.x, s.z - P.z) < 1.1) { s.got = true; s.s.visible = false; starsGame.got++; G.audio.ding(); burst(s.x, 1.2, s.z, 'star', 6); }
    }
    UI.timer('⭐ ' + starsGame.got + '/' + C.stars.target, Math.max(0, Math.ceil(starsGame.t)));
    if (starsGame.got >= C.stars.target) endStars(true);
    else if (starsGame.t <= 0) endStars(false);
  }
  const taxiGame = { active: false, t: 0 };
  async function startTaxi() {
    await UI.fade(async () => {
      resetTaxi();
      P.inTaxi = true; her.g.visible = false;
      yaw = taxi.h + PI; snapCamera();
    });
    taxiGame.active = true; taxiGame.t = C.taxi.seconds;
    UI.toast('🚕', 'سباق التاكسي', 'عصا التحكم: لفوق = بنزين، يمين ويسار = دركسيون');
  }
  async function endTaxi(win) {
    taxiGame.active = false; UI.timer(null);
    taxi.v = 0;
    if (win) { G.audio.success(); burst(taxi.x, 2, taxi.z, 'gold', 16); }
    else G.audio.fail();
    await wait(600);
    await UI.fade(async () => {
      P.inTaxi = false; her.g.visible = true;
      if (win) { P.x = taxi.x + 2; P.z = taxi.z; } else { const s = pt('taxiStand'); P.x = s.x; P.z = s.z - 0.6; }
      resetTaxi(); snapCamera();
    });
    if (win && !Q.done('taxi')) Q.progress('taxi', 'win');
    await say('taxi', win ? lines('taxi', 'done') : ['خلص الوقت! بتقدري تحاولي كمان مرة 🚕']);
  }
  function updateTaxi(dt, jx, jy) {
    if (!taxiGame.active) return;
    taxiGame.t -= dt;
    const throttle = -jy;
    taxi.v += throttle * 14 * dt;
    taxi.v *= Math.pow(0.55, dt);
    taxi.v = Math.max(-5, Math.min(14, taxi.v));
    const steer = Math.max(-1, Math.min(1, jx));
    taxi.h -= steer * 2.2 * dt * Math.sign(taxi.v) * Math.min(1, Math.abs(taxi.v) / 3);
    const nx = taxi.x + Math.sin(taxi.h) * taxi.v * dt, nz = taxi.z + Math.cos(taxi.h) * taxi.v * dt;
    const o = { x: nx, z: nz, r: 1.25 };
    collide(o, 'city');
    if (Math.hypot(o.x - nx, o.z - nz) > 0.01) taxi.v *= 0.6;
    taxi.x = o.x; taxi.z = o.z;
    taxi.g.position.set(taxi.x, 0, taxi.z); taxi.g.rotation.y = taxi.h;
    const g = pt('taxiGoal');
    UI.timer('🚕 ' + Math.round(Math.hypot(g.x - taxi.x, g.z - taxi.z)) + 'م', Math.max(0, Math.ceil(taxiGame.t)));
    if (Math.hypot(g.x - taxi.x, g.z - taxi.z) < 3.5) endTaxi(true);
    else if (taxiGame.t <= 0) endTaxi(false);
  }

  // ---------------- guidance ----------------
  const HINTS = {
    welcome: 'ليلى بساحة الساعة بنص المدينة',
    cafe: `مقهى القمر عالشمال من ${C.streets.main}، غرب الساحة`,
    flowers: 'بيت الورد شمال الساحة، عاليسار',
    signs: `في ورقة ملزوقة عند محل الحلويات (${C.shops.sweets.name})`,
    restaurant: `مطعم الشموع شرق الساحة على ${C.streets.main}`,
    clothes: 'بوتيك لمسة جنب المطعم',
    arcade: 'صالة النجوم قبال المطعم',
    clock: 'الساعة الكبيرة بنص الساحة',
    cat: `${C.streets.alley} جنب صالة النجوم`,
    stars: `سلمى بـ${C.streets.park} بالشمال`,
    password: 'بوابة الحديقة السرية آخر حديقة النجوم',
    finale: 'بوابة الحديقة السرية آخر حديقة النجوم',
    quiz: 'كشك "كم بتعرفيني؟" باستوديو اللحظة',
    memory: 'طاولة البطاقات باستوديو اللحظة',
    taxi: `أبو خليل بموقف التاكسي آخر ${C.streets.cross}`,
    album: 'دوّري على إشي بيلمع ✨ بأنحاء المدينة',
    letters: 'كل مهمة رئيسية فيها رسالة',
  };
  game.hintFor = id => id ? HINTS[id] : '';
  function npcPoint(id) { return npcs[id] && { x: npcs[id].x, z: npcs[id].z, zone: npcs[id].zone }; }
  function objectiveTarget() {
    const q = Q.tracked(); if (!q) return null;
    const id = q.id, done = o => Q.objDone(id, o);
    const P_ = n => pt(n);
    switch (id) {
      case 'welcome': return npcPoint('guide');
      case 'cafe': return !done('talk') ? npcPoint('barista') : !done('cup') ? P_('cafe_cup') : !done('dessert') ? npcPoint('sweetsSeller') : !done('note') ? P_('cafe_note') : P_('cafe_counter');
      case 'flowers': return npcPoint('florist');
      case 'signs': return !done('note1') ? P_('note1') : !done('note2') ? P_('note2') : npcPoint('musician');
      case 'restaurant': return (!done('talk') || !done('menu')) ? npcPoint('chef') : !done('plate') ? P_('rest_table') : npcPoint('chef');
      case 'clothes': return !done('talk') ? npcPoint('tailor') : P_('outfit1');
      case 'arcade': return !done('talk') ? npcPoint('arcadeOwner') : P_('heartMachine');
      case 'clock': return P_('clock');
      case 'cat': { const n = Q.objCount('cat', 'paws'); return n < 3 ? P_('paw' + (n + 1)) : P_('npc_cat'); }
      case 'stars': return starsGame.active ? null : npcPoint('keeper');
      case 'password': return P_('gate');
      case 'finale': return G.flags.get('gateOpen') ? P_('gift') : P_('gate');
      case 'quiz': return P_('quizBooth');
      case 'memory': return P_('memoryTable');
      case 'taxi': return taxiGame.active ? P_('taxiGoal') : npcPoint('taxi');
      default: return null;
    }
  }
  // where to walk from the current zone to reach a target
  function routeTo(t) {
    if (!t) return null;
    if (P.inTaxi) return pt('taxiGoal');
    if (t.zone === P.zone) return t;
    if (P.zone !== 'city') return pt('exit_' + P.zone);
    return W.doors[t.zone] ? { x: W.doors[t.zone].x, z: W.doors[t.zone].z, zone: 'city' } : null;
  }
  function npcHasNews(id) {
    const a = acts.find(x => x.npc === id);
    const t = objectiveTarget();
    if (t && npcs[id] && t.x === npcs[id].x && t.z === npcs[id].z) return true;
    void a;
    if (id === 'taxi') return Q.is('taxi', 'available');
    if (id === 'photographer') return Q.is('quiz', 'available') || Q.is('memory', 'available');
    return false;
  }
  game.mapMarkers = function () {
    const out = [];
    const t = routeTo(objectiveTarget());
    const tracked = objectiveTarget();
    const real = tracked && tracked.zone === 'city' ? tracked : (tracked && W.doors[tracked.zone]) || null;
    if (P.zone === 'city' && real) out.push({ x: real.x, z: real.z, color: '#ff3d7f', icon: '📍' });
    else if (t && P.zone === 'city') out.push({ x: t.x, z: t.z, color: '#ff3d7f', icon: '📍' });
    for (const id in npcs) if (npcs[id].zone === 'city' && npcHasNews(id)) out.push({ x: npcs[id].x, z: npcs[id].z, color: '#e0a93b', icon: '❗' });
    if (G.inv.has('secretMap')) props.memories.forEach(pm => { if (!G.save.data.photos.includes(pm.m.id)) out.push({ x: pm.x, z: pm.z, color: '#9c27b0', icon: '📸' }); });
    if (taxiGame.active) { const g = pt('taxiGoal'); out.push({ x: g.x, z: g.z, color: '#f7c948', icon: '🏁' }); }
    return out;
  };

  // ---------------- collision ----------------
  function boxOpen(b) {
    if (b.tag === 'alleyGate') return !!G.flags.get('alleyOpen');
    if (b.tag === 'gate') return !!G.flags.get('gateOpen');
    return false;
  }
  function collide(p, zoneId) {
    const z = W.zones[zoneId];
    for (let pass = 0; pass < 2; pass++) {
      for (const c of z.circles) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + p.r;
        if (d < min && d > 1e-6) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
      }
      for (const b of z.boxes) {
        if (boxOpen(b)) continue;
        const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d < p.r) {
          if (d > 1e-6) { p.x = cx + dx / d * p.r; p.z = cz + dz / d * p.r; }
          else {
            const pen = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
            if (pen[1]) p.x = pen[1] < 0 ? b.x0 - p.r : b.x1 + p.r; else p.z = pen[2] < 0 ? b.z0 - p.r : b.z1 + p.r;
          }
        }
      }
      for (const id in npcs) {
        const n = npcs[id]; if (n.zone !== zoneId) continue;
        const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz), min = 0.35 + p.r;
        if (d < min && d > 1e-6) { p.x = n.x + dx / d * min; p.z = n.z + dz / d * min; }
      }
    }
    const B = z.bounds;
    p.x = Math.max(B.x0, Math.min(B.x1, p.x)); p.z = Math.max(B.z0, Math.min(B.z1, p.z));
  }
  function blocked(x, z, r) { const o = { x, z, r }; collide(o, 'city'); return Math.hypot(o.x - x, o.z - z) > 0.01; }

  // ---------------- input ----------------
  const joy = { id: null, bx: 0, by: 0, dx: 0, dy: 0 };
  const look = { id: null, lx: 0 };
  const JR = 58;
  let skipCine = false;
  glc.addEventListener('pointerdown', e => {
    if (UI.cinematic) { skipCine = true; return; }
    if (mode !== 'play' || UI.busy()) return;
    G.audio.init();
    const p = toLocal(e);
    if (p.x < LW * 0.45 && joy.id === null) Object.assign(joy, { id: e.pointerId, bx: p.x, by: p.y, dx: 0, dy: 0 });
    else if (look.id === null && P.zone === 'city' && !P.inTaxi) Object.assign(look, { id: e.pointerId, lx: p.x });
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerId === joy.id) {
      const p = toLocal(e);
      let dx = p.x - joy.bx, dy = p.y - joy.by; const d = Math.hypot(dx, dy);
      if (d > JR) { dx *= JR / d; dy *= JR / d; }
      joy.dx = dx; joy.dy = dy;
    } else if (e.pointerId === look.id) {
      const p = toLocal(e);
      yaw -= (p.x - look.lx) * 0.009; look.lx = p.x;
    }
  });
  const release = e => { if (e.pointerId === joy.id) joy.id = null; if (e.pointerId === look.id) look.id = null; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (mode === 'play' && !UI.busy() && (e.key === 'e' || e.key === 'Enter')) doAction();
    if (e.key === 'Escape') { if (!$('panelWrap').hidden) UI.closePanel(); else if (mode === 'play' && !UI.busy()) UI.openPause(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  $('runBtn').addEventListener('click', () => { P.run = !P.run; $('runBtn').classList.toggle('on', P.run); G.audio.click(); });
  $('actionBtn').addEventListener('click', () => doAction());
  window.addEventListener('blur', () => { joy.id = null; look.id = null; for (const k in keys) keys[k] = false; });

  let current = null;
  async function doAction() {
    if (!current || acting || UI.busy() || mode !== 'play') return;
    acting = true; joy.id = null;
    G.audio.init();
    const a = current;
    if (a.npc) { const n = npcs[a.npc]; n.g.rotation.y = Math.atan2(P.x - n.x, P.z - n.z); P.angle = Math.atan2(n.x - P.x, n.z - P.z); }
    try { await a.run(); } catch (err) { console.error(err); }
    acting = false;
    UI.updateTracker();
  }
  function findAction() {
    if (P.inTaxi) return null;
    let best = null, bd = Infinity;
    for (const a of acts) {
      if (a.zoneOf() !== P.zone) continue;
      if (a.show && !a.show()) continue;
      const p = a.pos(); const d = Math.hypot(p.x - P.x, p.z - P.z);
      if (d < a.r && d < bd) { bd = d; best = a; }
    }
    return best;
  }

  // ---------------- camera ----------------
  const ray = new THREE.Raycaster();
  const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), rayDir = new THREE.Vector3();
  function desiredCam(out, lookOut) {
    if (P.zone !== 'city') {
      const r = W.rooms[P.zone];
      const relX = Math.max(-r.w / 2, Math.min(r.w / 2, P.x - r.ox));
      out.set(r.ox + relX * 0.45, 7.4, r.d / 2 + 4.6 + P.z * 0.15);
      lookOut.set(r.ox + relX * 0.75, 0.6, P.z * 0.55 - 0.4);
      return;
    }
    const tx = P.inTaxi ? taxi.x : P.x, tz = P.inTaxi ? taxi.z : P.z;
    const dist = P.inTaxi ? 9 : 7, h = P.inTaxi ? 4.8 : 4.4;
    lookOut.set(tx, P.inTaxi ? 1.2 : 1.5, tz);
    out.set(tx + Math.sin(yaw) * dist, h, tz + Math.cos(yaw) * dist);
    // keep the camera out of buildings
    rayDir.copy(out).sub(lookOut); const len = rayDir.length(); rayDir.normalize();
    ray.set(lookOut, rayDir); ray.far = len;
    const hit = ray.intersectObjects(W.occluders, false)[0];
    if (hit) out.copy(lookOut).addScaledVector(rayDir, Math.max(1.2, hit.distance - 0.4));
  }
  const camLook = new THREE.Vector3();
  function snapCamera() { desiredCam(camera.position, camLook); camera.lookAt(camLook); }
  function updateCamera(dt) {
    if (camOverride) {
      const k = 1 - Math.exp(-dt * 3);
      camera.position.lerp(camOverride.pos, k); camLook.lerp(camOverride.look, k); camera.lookAt(camLook);
      return;
    }
    desiredCam(tmpV, tmpL);
    const k = 1 - Math.exp(-dt * 7);
    camera.position.lerp(tmpV, k); camLook.lerp(tmpL, k); camera.lookAt(camLook);
    fadeTrees();
  }
  // hide trees that sit between the camera and her
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function fadeTrees() {
    const T = W.treeInst; let dirty = false;
    const cx = camera.position.x, cz = camera.position.z, fp = game.playerPos();
    T.spots.forEach(([x, z], i) => {
      const dc = Math.hypot(x - cx, z - cz);
      // distance from the tree to the camera→player segment
      const vx = fp.x - cx, vz = fp.z - cz, L = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - cx) * vx + (z - cz) * vz) / L));
      const ds = Math.hypot(cx + vx * t - x, cz + vz * t - z);
      const hide = P.zone === 'city' && (dc < 2.4 || (ds < 1.3 && t < 0.85));
      if (hide !== T.hidden[i]) { T.hidden[i] = hide; dirty = true; T.meshes.forEach((m, k) => m.setMatrixAt(i, hide ? ZERO : T.base[k][i])); }
    });
    if (dirty) T.meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  // ---------------- mood ----------------
  function updateMood() {
    if (P.zone === 'city' && P.z < -45 && G.flags.get('gateOpen')) return G.audio.setMood('finale');
    const t = G.save.data.tod;
    G.audio.setMood(t >= 3 ? 'night' : t >= 2 ? 'sunset' : 'day');
  }
  game.updateMood = updateMood;

  // ---------------- update loop ----------------
  let confettiOn = false;
  const confetti = [];
  let lastSave = 0, lastMinimap = 0, lastZoneCheck = '';
  function savePos(force) {
    if (P.inTaxi || mode !== 'play') return;
    const d = G.save.data;
    d.zone = P.zone; d.pos = { x: +P.x.toFixed(2), z: +P.z.toFixed(2) };
    if (force || performance.now() - lastSave > 4000) { lastSave = performance.now(); G.save.write(); }
  }
  function update(dt, now) {
    const t = now / 1000;
    // time of day drift toward story target
    const target = G.save.data.tod;
    if (Math.abs(W.tod - target) > 0.001) { W.applyTime(W.tod + Math.sign(target - W.tod) * Math.min(Math.abs(target - W.tod), dt * 0.25)); }
    else if (W.inRoom !== lastZoneCheck) W.applyTime(W.tod);
    lastZoneCheck = W.inRoom;

    // input vector
    let jx = joy.id !== null ? joy.dx / JR : 0, jy = joy.id !== null ? joy.dy / JR : 0;
    if (keys.arrowleft || keys.a) jx = -1; if (keys.arrowright || keys.d) jx = 1;
    if (keys.arrowup || keys.w) jy = -1; if (keys.arrowdown || keys.s) jy = 1;
    const free = mode === 'play' && !UI.busy() && !acting;

    if (P.inTaxi) { updateTaxi(dt, free ? jx : 0, free ? jy : 0); yaw += (Math.atan2(Math.sin(taxi.h + PI - yaw), Math.cos(taxi.h + PI - yaw))) * Math.min(1, dt * 3); }
    else {
      const m = Math.hypot(jx, jy);
      P.moving = free && m > 0.15;
      if (P.moving) {
        const cy = P.zone === 'city' ? yaw : 0;
        const k = Math.min(1, m) / m;
        const run = P.run || keys.shift;
        const sp = (run ? 6.4 : 3.6) * Math.min(1, m);
        const mx = (jx * Math.cos(cy) + jy * Math.sin(cy)) * k, mz = (-jx * Math.sin(cy) + jy * Math.cos(cy)) * k;
        P.x += mx * sp * dt; P.z += mz * sp * dt;
        collide(P, P.zone);
        P.angle = Math.atan2(mx, mz);
        P.walk += dt * (run ? 15 : 10);
      }
    }
    // gate open: entering the garden first time
    if (mode === 'play' && P.zone === 'city' && P.z < -46 && G.flags.get('gateOpen') && !G.flags.get('gardenSeen') && !UI.busy()) gardenReveal();
    if (P.zone === 'city' && !UI.cinematic) { const inG = P.z < -45 && G.flags.get('gateOpen'); if (inG !== game._inGarden) { game._inGarden = inG; updateMood(); } }

    // her pose
    let da = P.angle - her.body.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    her.body.rotation.y += da * Math.min(1, dt * 12);
    const swing = P.moving ? Math.sin(P.walk) : 0;
    const bob = P.moving ? Math.abs(Math.sin(P.walk)) * 0.07 : Math.sin(t * 2) * 0.012;
    her.g.position.set(P.x, bob, P.z);
    her.arms[0].rotation.x = swing * 0.6; her.arms[1].rotation.x = -swing * 0.6;
    props.carryCup.visible = Q.is('cafe', 'active') && Q.objDone('cafe', 'cup') && !Q.objDone('cafe', 'drink');
    props.carryCake.visible = Q.is('cafe', 'active') && Q.objDone('cafe', 'dessert') && !Q.objDone('cafe', 'drink') && !props.carryCup.visible;

    // NPCs
    for (const id in npcs) {
      const n = npcs[id];
      if (n.zone !== P.zone) { n.g.visible = n.zone === 'city' && P.zone === 'city'; continue; }
      n.g.visible = true;
      const d = Math.hypot(P.x - n.x, P.z - n.z);
      n.body.position.y = Math.sin(t * 2 + n.phase) * 0.015;
      n.arms[0].rotation.x = Math.sin(t * 1.3 + n.phase) * 0.08;
      if (d < 5) { const want = Math.atan2(P.x - n.x, P.z - n.z); let a = want - n.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); n.g.rotation.y += a * Math.min(1, dt * 4); }
      n.label.visible = d < 6;
      n.news.visible = npcHasNews(id);
      n.news.position.y = 2.95 + Math.sin(t * 3) * 0.08;
    }
    // cat, notes, paws, memories
    cat.tail.rotation.z = Math.sin(t * 4) * 0.4;
    cat.heart.visible = Q.done('cat'); cat.heart.position.y = 1.2 + Math.sin(t * 3) * 0.08;
    W.notes.note1.visible = !Q.done('signs') && !Q.objDone('signs', 'note1');
    W.notes.note2.visible = Q.objDone('signs', 'note1') && !Q.objDone('signs', 'note2');
    W.paws.forEach((p, i) => { p.visible = G.flags.get('alleyOpen') && !Q.done('cat') && Q.objCount('cat', 'paws') >= i; });
    props.cafeNote.visible = Q.is('cafe', 'active') && Q.objDone('cafe', 'talk') && !Q.objDone('cafe', 'note');
    props.memories.forEach(pm => {
      const vis = P.zone === 'city' && !G.save.data.photos.includes(pm.m.id) && (!GATED.includes(pm.m.spot) || G.flags.get('alleyOpen'));
      const d = Math.hypot(pm.x - P.x, pm.z - P.z);
      pm.s.visible = vis && (d < 9 || G.inv.has('secretMap'));
      pm.s.material.opacity = 0.55 + Math.sin(t * 4 + pm.x) * 0.35;
    });
    // doors
    for (const id in W.doors) { const d = W.doors[id]; d.open += (d.target - d.open) * Math.min(1, dt * 6); d.pivot.rotation.y = -d.open * 1.4; }
    // garden
    W.gardenLetters.forEach((m, i) => { if (!m.visible) return; const a = m.userData.a + t * 0.3; m.position.set(Math.cos(a) * 2.6, 2.4 + Math.sin(t * 1.5 + i) * 0.2, -58.5 + Math.sin(a) * 2.6); m.lookAt(camera.position); });
    if (G.flags.get('gateOpen') && !UI.cinematic && $('ending').hidden) { W.gift.scale.setScalar(1 + Math.sin(t * 3) * 0.02); }
    W.water.material.emissiveIntensity = 0.12 + Math.sin(t * 2) * 0.05;
    if (W.arcadeScreens) W.arcadeScreens.forEach((s, i) => s.material.color.setHSL(((t * 0.1 + i * 0.2) % 1), 0.8, 0.6));

    // mini-games
    updateStars(dt);

    // particles
    for (let i = props.particles.length - 1; i >= 0; i--) {
      const p = props.particles[i];
      p.vy -= 4 * dt; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.life -= dt; p.s.material.opacity = Math.max(0, Math.min(1, p.life));
      if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); props.particles.splice(i, 1); }
    }

    // interaction + guidance
    current = free && !UI.cinematic ? findAction() : null;
    UI.setAction(current && { label: current.label(), icon: typeof current.icon === 'function' ? current.icon() : current.icon });
    if (current) { const p = current.pos(); props.ring.visible = true; props.ring.position.set(p.x, 0.06, p.z); props.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06); }
    else props.ring.visible = false;
    const route = routeTo(objectiveTarget());
    const showGuide = mode === 'play' && route && !UI.cinematic;
    props.beacon.visible = !!(showGuide && P.zone === 'city' && Math.hypot(route.x - P.x, route.z - P.z) > 4);
    props.arrow.visible = !!showGuide;
    if (showGuide) {
      props.beacon.position.set(route.x, 4, route.z);
      props.beacon.material.opacity = 0.16 + Math.sin(t * 3) * 0.06;
      props.arrow.position.set(route.x, (P.zone === 'city' ? 2.9 : 2.4) + Math.sin(t * 4) * 0.12, route.z);
      props.arrow.rotation.y += dt * 2;
    }

    // world lighting follows her
    const fp = game.playerPos();
    W.placeSun(fp.x, fp.z);
    updateCamera(dt);

    if (mode === 'play') savePos(false);
    if (now - lastMinimap > 120 && !$('hud').hidden) {
      lastMinimap = now;
      const mc = $('minimap'); UI.drawMap(mc.getContext('2d'), mc.width, mc.height, false, fp);
    }
    // deferred story beats once the screen is free
    if (freeQueue.length && mode === 'play' && !UI.busy() && !acting) { const fn = freeQueue.shift(); acting = true; Promise.resolve(fn()).finally(() => { acting = false; UI.updateTracker(); }); }
  }

  function drawFX(dt) {
    fx.clearRect(0, 0, LW, LH);
    if (mode === 'play' && !UI.busy()) {
      if (joy.id !== null) {
        fx.fillStyle = 'rgba(255,248,242,.25)'; fx.strokeStyle = 'rgba(243,215,154,.9)'; fx.lineWidth = 2;
        fx.beginPath(); fx.arc(joy.bx, joy.by, JR, 0, PI2); fx.fill(); fx.stroke();
        fx.fillStyle = 'rgba(194,24,91,.85)'; fx.beginPath(); fx.arc(joy.bx + joy.dx, joy.by + joy.dy, 25, 0, PI2); fx.fill();
      } else {
        const bx = 100, by = LH - 92;
        fx.strokeStyle = 'rgba(255,248,242,.45)'; fx.lineWidth = 2; fx.setLineDash([6, 6]);
        fx.beginPath(); fx.arc(bx, by, JR, 0, PI2); fx.stroke(); fx.setLineDash([]);
        fx.fillStyle = 'rgba(255,248,242,.35)'; fx.beginPath(); fx.arc(bx, by, 22, 0, PI2); fx.fill();
      }
    }
    if (confettiOn && !reduced()) {
      if (confetti.length < 140) confetti.push({ x: Math.random() * LW, y: -10, vy: 50 + Math.random() * 80, vx: (Math.random() - .5) * 40, r: Math.random() * 6, s: 5 + Math.random() * 6, c: ['#c2185b', '#e0a93b', '#f8bbd0', '#fff8f2', '#ff6fa5'][Math.floor(Math.random() * 5)] });
      for (const c of confetti) {
        c.y += c.vy * dt; c.x += c.vx * dt; c.r += dt * 3; if (c.y > LH + 10) { c.y = -10; c.x = Math.random() * LW; }
        fx.save(); fx.translate(c.x, c.y); fx.rotate(c.r); fx.fillStyle = c.c; fx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); fx.restore();
      }
    }
  }

  // ---------------- modes ----------------
  function placeFromSave() {
    const d = G.save.data;
    const zoneOk = W.zones[d.zone];
    P.zone = zoneOk ? d.zone : 'city';
    W.inRoom = P.zone === 'city' ? null : P.zone;
    const o = { x: d.pos.x, z: d.pos.z, r: P.r };
    if (!zoneOk) { const s = pt('start'); o.x = s.x; o.z = s.z; }
    collide(o, P.zone);
    P.x = o.x; P.z = o.z; P.angle = PI; yaw = 0;
    if (P.zone === 'city' && P.z < -45 && !G.flags.get('gateOpen')) { const s = pt('start'); P.x = s.x; P.z = s.z; }
  }
  game.toTitle = function () {
    savePos(true);
    mode = 'title'; UI.showHUD(false); confettiOn = false; confetti.length = 0;
    if (starsGame.active) endStars(false);
    showTitle();
  };
  function showTitle() {
    $('startCity').textContent = C.cityName;
    $('startTitle').textContent = 'عيد ميلاد سعيد يا ' + C.herName;
    $('startSub').textContent = 'مدينة كاملة محضّرة إلك. لفّي فيها، احكي مع ناسها، وجمّعي الأسرار لحتى توصلي للهدية.';
    UI.setImg($('startPortrait'), C.faceImage, () => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="260"><ellipse cx="90" cy="130" rx="88" ry="128" fill="#f8bbd0"/><text x="90" y="150" font-size="80" text-anchor="middle">🎂</text></svg>'));
    const has = G.save.hasProgress();
    $('btnContinue').hidden = !has;
    $('saveNote').textContent = has ? (G.save.data.endingDone ? 'خلّصتي اللعبة 🎉 بتقدري تكمّلي استكشاف أو تعيدي النهاية.' : 'في لعبة محفوظة على هاد الجهاز.') : 'الحفظ تلقائي على هاد الجهاز.';
    $('startScreen').hidden = false;
    // gentle orbit behind the title
    camOverride = { pos: new THREE.Vector3(26, 16, 26), look: new THREE.Vector3(0, 3, 0) };
  }
  async function beginPlay(isNew) {
    G.audio.init();
    $('startScreen').hidden = true;
    syncWorld();
    placeFromSave();
    if (isNew) {
      G.save.data.started = true; G.save.write();
      await opening();
    }
    camOverride = null; snapCamera();
    mode = 'play';
    UI.showHUD(true); UI.updateTracker(); updateMood();
    if (P.zone !== 'city') UI.zoneTitle(C.shops[P.zone].name);
    if (isNew) game.whenFree(() => say('guide', ['يا {name}! تعالي لعندي، أنا جنب الساعة الكبيرة 👋']));
  }
  async function opening() {
    UI.cinematic = true; UI.bars(true); skipCine = false;
    G.audio.setMood('day');
    camOverride = { pos: new THREE.Vector3(30, 20, 30), look: new THREE.Vector3(0, 4, 0) };
    camera.position.copy(camOverride.pos);
    const textP = UI.cine(C.openingLines, 3000);
    const s = pt('start');
    const t0 = performance.now(), dur = reduced() ? 1500 : 9000;
    await new Promise(res => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        if (skipCine) return res();
        const a = 0.8 + k * 2.4, R = 32 - k * 24, H = 20 - k * 15;
        camOverride.pos.set(Math.sin(a) * R + s.x * k, H, Math.cos(a) * R + s.z * k);
        camOverride.look.set(s.x * k, 4 - k * 2.6, s.z * k);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
    if (!skipCine) await textP;
    $('cine').hidden = true;
    UI.bars(false); UI.cinematic = false; skipCine = false;
  }
  game.newGame = function () {
    UI.closePanel();
    G.save.reset();
    G.save.data.started = true; G.save.write();
    if (starsGame.active) endStars(false);
    if (taxiGame.active) { taxiGame.active = false; P.inTaxi = false; her.g.visible = true; UI.timer(null); }
    W.bouquets.forEach(b => { b.visible = true; });
    mode = 'title'; UI.showHUD(false);
    beginPlay(true);
  };
  game.applySettings = function () {
    const s = G.save.data.settings;
    document.body.classList.toggle('reduced', s.reduced);
    W.setShadows(s.shadows);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.reduced ? 1.25 : 1.6));
    layout();
  };

  // ---------------- boot ----------------
  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (mode === 'title' && camOverride && !UI.cinematic) {
      const a = now / 9000;
      camOverride.pos.set(Math.sin(a) * 30, 15, Math.cos(a) * 30);
    }
    update(dt, now);
    adaptQuality(now);
    renderer.render(scene, camera);
    drawFX(dt);
    requestAnimationFrame(loop);
  }
  // drop shadows / resolution automatically on slow phones
  const perf = { frames: 0, t0: 0, step: 0 };
  function adaptQuality(now) {
    if (mode !== 'play' || UI.busy() || document.hidden) { perf.t0 = 0; return; }
    if (!perf.t0) { perf.t0 = now; perf.frames = 0; return; }
    perf.frames++;
    if (now - perf.t0 < 4000) return;
    const fps = perf.frames * 1000 / (now - perf.t0);
    perf.t0 = 0;
    if (fps >= 28 || perf.step >= 2) return;
    perf.step++;
    const s = G.save.data.settings;
    if (perf.step === 1 && s.shadows) { s.shadows = false; G.save.write(); W.setShadows(false); UI.toast('⚡', 'خففنا الرسوم', 'طفينا الظلال لتصير الحركة أنعم'); }
    else { renderer.setPixelRatio(1); layout(); perf.step = 2; }
  }
  game.perf = perf;

  async function boot() {
    G.save.load();
    try { await Promise.race([document.fonts.ready, wait(2500)]); } catch {}
    G.buildWorld();
    W = G.W; scene = W.scene;
    renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 160);
    scene.add(camera);
    makeHer(); makeNPCs(); makeCat(); makeTaxi(); makeProps();
    setupActs();
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', () => setTimeout(layout, 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden) savePos(true); });
    game.applySettings();
    syncWorld();
    placeFromSave();
    snapCamera();
    $('btnContinue').onclick = () => beginPlay(false);
    $('btnNew').onclick = async () => {
      if (G.save.hasProgress() && !(await UI.confirm('في لعبة محفوظة. أكيد بدك تبدئي من جديد؟ التقدم القديم رح ينمسح.', 'ابدئي من جديد', 'لا'))) return;
      G.save.reset(); syncWorld(); W.bouquets.forEach(b => { b.visible = true; });
      beginPlay(true);
    };
    $('btnStartSettings').onclick = () => UI.openSettings();
    showTitle();
    $('loading').hidden = true;
    requestAnimationFrame(loop);
    // QA hook (used by automated tests; harmless for players)
    game.debug = { P, acts, npcs, pt, setYaw: v => { yaw = v; snapCamera(); }, setPos: (x, z, zoneId = P.zone) => { P.zone = zoneId; W.inRoom = zoneId === 'city' ? null : zoneId; P.x = x; P.z = z; W.applyTime(W.tod); snapCamera(); }, act: () => doAction(), current: () => current && current.id, taxi, starsGame, taxiGame, enterShop, exitShop, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }) };
  }
  boot().catch(err => {
    console.error(err);
    $('loading').querySelector('p').textContent = 'صار خطأ بتحميل اللعبة. جرّبي تحدّثي الصفحة.';
  });
})();
