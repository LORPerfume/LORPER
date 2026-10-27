/* World: city, shop interiors, park, secret garden, lighting and time of day.
   Builds meshes + collision data. Gameplay logic lives in game.js. */
G.buildWorld = function () {
  const C = G.C;
  const W = G.W = {};
  const PI = Math.PI, PI2 = PI * 2;
  const scene = W.scene = new THREE.Scene();

  // ---------- zones & collision ----------
  W.zones = {};
  const zone = (id, bounds, extra) => (W.zones[id] = Object.assign({ id, boxes: [], circles: [], bounds }, extra || {}));
  const solid = (z, x0, x1, z0, z1, tag) => { const b = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), tag }; W.zones[z].boxes.push(b); return b; };
  const solidC = (z, x, zz, r, tag) => { const c = { x, z: zz, r, tag }; W.zones[z].circles.push(c); return c; };
  W.occluders = [];
  W.points = {};
  W.mapRects = [];
  W.labels = [];
  const point = (name, x, z, zoneId = 'city', extra) => (W.points[name] = Object.assign({ x, z, zone: zoneId }, extra || {}));

  // ---------- materials & primitives ----------
  const cache = {};
  const lam = (color, o) => {
    if (o) return new THREE.MeshLambertMaterial(Object.assign({ color }, o));
    return cache[color] || (cache[color] = new THREE.MeshLambertMaterial({ color }));
  };
  W.lam = lam;
  function mesh(parent, geo, mat, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? lam(mat) : mat);
    m.position.set(x, y, z);
    m.castShadow = !!o.cast; m.receiveShadow = !!o.receive;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    parent.add(m);
    return m;
  }
  const box = (p, w, h, d, mat, x, y, z, o) => mesh(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
  const cyl = (p, rt, rb, h, seg, mat, x, y, z, o) => mesh(p, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, o);
  const sph = (p, r, mat, x, y, z, o) => mesh(p, new THREE.SphereGeometry(r, 14, 10), mat, x, y, z, o);
  const plane = (p, w, d, mat, x, y, z, o) => { const m = mesh(p, new THREE.PlaneGeometry(w, d), mat, x, y, z, o); m.rotation.x = -PI / 2; return m; };
  W.box = box; W.cyl = cyl; W.sph = sph;

  // ---------- canvas textures ----------
  const FONT_D = `"${C.theme.displayFont}", "${C.theme.bodyFont}", system-ui, sans-serif`;
  const FONT_B = `"${C.theme.bodyFont}", system-ui, sans-serif`;
  W.FONT_D = FONT_D; W.FONT_B = FONT_B;
  function canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  W.canvasTex = canvas;
  function signTex(text, bg, fg, border) {
    return canvas(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); }
      g.fillStyle = fg; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 72; g.font = `${size}px ${FONT_D}`;
      while (g.measureText(text).width > w - 60 && size > 20) { size -= 4; g.font = `${size}px ${FONT_D}`; }
      g.fillText(text, w / 2, h / 2 + 6);
    });
  }
  W.labelTex = function (text, sub) {
    return canvas(512, 160, (g, w, h) => {
      g.fillStyle = 'rgba(255,248,242,0.92)';
      const r = 40; g.beginPath(); g.moveTo(r, 10); g.arcTo(w - 10, 10, w - 10, h - 10, r); g.arcTo(w - 10, h - 10, 10, h - 10, r); g.arcTo(10, h - 10, 10, 10, r); g.arcTo(10, 10, w - 10, 10, r); g.fill();
      g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = C.theme.accent; g.font = `64px ${FONT_D}`; g.fillText(text, w / 2, sub ? 62 : h / 2 + 4);
      if (sub) { g.fillStyle = C.theme.ink; g.font = `36px ${FONT_B}`; g.fillText(sub, w / 2, 120); }
    });
  };
  const glowTex = canvas(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,200,120,.6)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  W.glowTex = glowTex;
  function tiledTex(size, draw, rx, ry) {
    const t = canvas(size, size, draw);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    return t;
  }
  const noise = (g, w, h, a, n = 600) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
  const asphalt = (rx, ry) => tiledTex(128, (g, w, h) => { g.fillStyle = '#5b5560'; g.fillRect(0, 0, w, h); noise(g, w, h, .25); }, rx, ry);
  const stripes = (c1, c2) => canvas(128, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 16, 0, 16, h); } });

  // ---------- lights ----------
  W.hemi = new THREE.HemisphereLight('#ffffff', '#8a7a6a', 0.6);
  W.sun = new THREE.DirectionalLight('#fff1dc', 0.8);
  W.sun.castShadow = true;
  W.sun.shadow.mapSize.set(1024, 1024);
  Object.assign(W.sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
  W.sun.shadow.bias = -0.0008;
  scene.add(W.hemi, W.sun, W.sun.target);
  W.roomLight = new THREE.PointLight('#ffd9a0', 0, 22, 1.5);
  scene.add(W.roomLight);
  scene.fog = new THREE.Fog('#f6d7c3', 40, 110);
  scene.background = new THREE.Color('#f6d7c3');

  // shared emissive materials that change with time of day
  W.windowMat = new THREE.MeshLambertMaterial({ color: '#a9cbe0', emissive: '#ffc970', emissiveIntensity: 0 });
  W.lampMat = new THREE.MeshLambertMaterial({ color: '#fff4d6', emissive: '#ffd27a', emissiveIntensity: 0.2 });
  W.shopGlassMat = new THREE.MeshLambertMaterial({ color: '#f3e0c8', emissive: '#ffb75e', emissiveIntensity: 0.25 });
  const glowPoints = [];   // [x,y,z,size]
  const windowXforms = [], sillXforms = [], balcXforms = [], railXforms = [], bedFlowers = [];
  const lampPos = [];

  // ================= CITY =================
  const city = zone('city', { x0: -45.5, x1: 45.5, z0: -65, z1: 37.5 }, { mode: 'follow', bg: null });
  const ground = new THREE.Group(); scene.add(ground);
  plane(ground, 260, 260, lam('#86b878'), 0, -0.02, 0, { receive: true });

  // roads
  plane(ground, 92, 6, lam('#ffffff', { map: asphalt(30, 2) }), 0, 0.01, 0, { receive: true });
  plane(ground, 6, 28, lam('#ffffff', { map: asphalt(2, 9) }), 0, 0.011, 24, { receive: true });
  plane(ground, 6, 8, lam('#ffffff', { map: asphalt(2, 3) }), 0, 0.011, -13.5, { receive: true });
  // dashed lines
  for (let x = -44; x <= 44; x += 4) if (Math.abs(x) > 13) plane(ground, 1.6, 0.15, '#f3e3b5', x, 0.02, 0);
  for (let z = 12; z <= 36; z += 4) plane(ground, 0.15, 1.6, '#f3e3b5', 0, 0.02, z);
  // sidewalks
  const paveMat = lam('#ffffff', { map: tiledTex(128, (g, w, h) => { g.fillStyle = '#d9c9b4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#bba78f'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } noise(g, w, h, .08, 200); }, 1, 1) });
  function walk(x0, x1, z0, z1) {
    const m = plane(ground, x1 - x0, z1 - z0, paveMat.clone(), (x0 + x1) / 2, 0.03, (z0 + z1) / 2, { receive: true });
    m.material.map = m.material.map.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set((x1 - x0) / 2, (z1 - z0) / 2);
    return m;
  }
  walk(-46, -12, -6, -3); walk(12, 46, -6, -3); walk(-46, -12, 3, 6); walk(12, 46, 3, 6);
  walk(-6, -3, 10, 38); walk(3, 6, 10, 38); walk(-6, -3, -17, -10); walk(3, 6, -17, -10);
  // plaza paving (rings)
  const plazaTex = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#e2d2bc'; g.fillRect(0, 0, w, h);
    for (let r = 250; r > 20; r -= 26) { g.strokeStyle = r % 52 ? '#dccab3' : '#d2b48c'; g.lineWidth = 5; g.beginPath(); g.arc(256, 256, r, 0, PI2); g.stroke(); }
    for (let a = 0; a < 16; a++) { g.strokeStyle = '#dccab3'; g.lineWidth = 3; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(a / 16 * PI2) * 360, 256 + Math.sin(a / 16 * PI2) * 360); g.stroke(); }
    noise(g, w, h, .06, 800);
  });
  plane(ground, 24, 20, lam('#ffffff', { map: plazaTex }), 0, 0.04, 0, { receive: true });
  W.mapRects.push({ x0: -46, x1: 46, z0: -3, z1: 3, c: '#6d6670' }, { x0: -3, x1: 3, z0: 10, z1: 38, c: '#6d6670' }, { x0: -3, x1: 3, z0: -17, z1: -10, c: '#6d6670' }, { x0: -12, x1: 12, z0: -10, z1: 10, c: '#e6d3b9' });

  // ---------- buildings ----------
  W.doors = {};
  const facadeDummy = new THREE.Object3D();
  function building(o) {
    const { x0, x1, z0, z1, front } = o;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rot = { S: 0, N: PI, E: PI / 2, W: -PI / 2 }[front];
    const ns = front === 'S' || front === 'N';
    const fw = ns ? x1 - x0 : z1 - z0, fd = ns ? z1 - z0 : x1 - x0;
    const h = o.height || 8;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rot; scene.add(g);
    const body = box(g, fw, h, fd, o.color, 0, h / 2, 0, { cast: true, receive: true });
    W.occluders.push(body);
    box(g, fw + 0.3, 0.35, fd + 0.3, o.trim || '#f4ead9', 0, h + 0.17, 0, { cast: true });
    box(g, fw + 0.12, 0.25, fd + 0.12, o.trim || '#f4ead9', 0, 3.6, 0);
    solid('city', x0, x1, z0, z1, o.id || 'bldg');
    W.mapRects.push({ x0, x1, z0, z1, c: o.mapColor || o.color, label: o.mapLabel });
    g.updateMatrixWorld(true);
    const addPart = (list, lx, ly, lz, sx, sy, sz) => {
      facadeDummy.position.set(lx, ly, lz); facadeDummy.scale.set(sx, sy, sz); facadeDummy.rotation.set(0, 0, 0); facadeDummy.updateMatrix();
      list.push(new THREE.Matrix4().multiplyMatrices(g.matrixWorld, facadeDummy.matrix));
    };
    const addWin = (lx, ly, sx, sy) => {
      facadeDummy.position.set(lx, ly, fd / 2 + 0.02); facadeDummy.scale.set(sx, sy, 1); facadeDummy.rotation.set(0, 0, 0);
      facadeDummy.updateMatrix();
      windowXforms.push(new THREE.Matrix4().multiplyMatrices(g.matrixWorld, facadeDummy.matrix));
    };
    // upper floor windows
    const cols = Math.max(1, Math.floor(fw / 2.6));
    for (let fy = 4.8; fy < h - 1; fy += 2.6) for (let i = 0; i < cols; i++) {
      const lx = -fw / 2 + (i + 0.5) * fw / cols;
      addWin(lx, fy, 1.1, 1.5);
      addPart(sillXforms, lx, fy - 0.85, fd / 2 + 0.1, 1.4, 0.12, 0.25);
      if (o.balcony && i % 2 === 0) { addPart(balcXforms, lx, fy - 0.9, fd / 2 + 0.35, 1.8, 0.1, 0.7); addPart(railXforms, lx, fy - 0.6, fd / 2 + 0.68, 1.8, 0.6, 0.05); }
    }
    let door = null;
    if (o.shop) {
      // display windows, awning, sign, door
      const glassW = Math.max(1, (fw - 3) / 2 - 0.6);
      [-1, 1].forEach(s => {
        const lx = s * (1.3 + glassW / 2 + 0.2);
        box(g, glassW, 2.2, 0.08, W.shopGlassMat, lx, 1.55, fd / 2 + 0.02);
        box(g, glassW + 0.25, 0.15, 0.3, o.trim || '#f4ead9', lx, 0.4, fd / 2 + 0.12);
        if (o.display) o.display(g, lx, fd / 2 + 0.35);
      });
      const aw = box(g, fw - 0.4, 0.12, 1.6, lam('#ffffff', { map: stripes(o.awning[0], o.awning[1]) }), 0, 3.25, fd / 2 + 0.75, { cast: true });
      aw.rotation.x = 0.25;
      const sb = box(g, Math.min(fw - 1, 7), 1.1, 0.15, o.signBg || '#3b1f2b', 0, 4.4, fd / 2 + 0.12);
      mesh(g, new THREE.PlaneGeometry(Math.min(fw - 1, 7) - 0.2, 0.95), new THREE.MeshBasicMaterial({ map: signTex(o.sign, o.signBg || '#3b1f2b', o.signFg || '#f7d488', o.signFg || '#f7d488'), toneMapped: false }), 0, 4.4, fd / 2 + 0.21);
      sb.castShadow = true;
      box(g, 2.4, 2.9, 0.1, o.trim || '#f4ead9', 0, 1.45, fd / 2 + 0.03);
      const pivot = new THREE.Group(); pivot.position.set(-0.85, 0, fd / 2 + 0.1); g.add(pivot);
      box(pivot, 1.7, 2.5, 0.08, o.doorColor || '#5d2e3a', 0.85, 1.25, 0);
      box(pivot, 1.1, 1.3, 0.1, W.shopGlassMat, 0.85, 1.6, 0);
      sph(pivot, 0.06, '#e0a93b', 1.5, 1.2, 0.08);
      const n = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      door = W.doors[o.id] = { id: o.id, pivot, open: 0, target: 0, x: cx + n.x * (fd / 2 + 0.9), z: cz + n.z * (fd / 2 + 0.9), out: n };
      point('door_' + o.id, door.x, door.z);
      lampPos.push([cx + n.x * (fd / 2 + 0.25) + (ns ? 1.9 : 0), 2.6, cz + n.z * (fd / 2 + 0.25) + (ns ? 0 : 1.9), 'wall']);
      W.labels.push({ x: door.x, z: door.z, text: o.sign });
    }
    if (o.roofDeco) o.roofDeco(g, fw, fd, h);
    return { g, door, fw, fd, h };
  }

  const shopsInfo = C.shops;
  // north side of the main street (facing +z)
  building({ id: 'cafe', x0: -26, x1: -12, z0: -17, z1: -6, front: 'S', shop: true, color: '#e8c9a7', height: 9, awning: ['#6d3b2a', '#f3e3c3'], sign: shopsInfo.cafe.name, signBg: '#3e2723', mapLabel: '☕', balcony: true,
    display: (g, x, z) => { cyl(g, 0.35, 0.35, 0.05, 12, '#fff', x, 1.0, z); cyl(g, 0.12, 0.1, 0.25, 10, '#6d3b2a', x, 1.15, z); } });
  building({ x0: -36, x1: -26, z0: -17, z1: -6, front: 'S', color: '#d8a48f', height: 12, balcony: true });
  building({ x0: -46, x1: -36, z0: -17, z1: -6, front: 'S', color: '#efe0c9', height: 10 });
  building({ id: 'restaurant', x0: 12, x1: 28, z0: -17, z1: -6, front: 'S', shop: true, color: '#b5545c', trim: '#f3e2c7', height: 10, awning: ['#7f1d2d', '#f3e2c7'], sign: shopsInfo.restaurant.name, signBg: '#2b1013', signFg: '#f2c46d', mapLabel: '🍽️', balcony: true,
    display: (g, x, z) => { cyl(g, 0.4, 0.4, 0.05, 14, '#fff', x, 1.0, z); cyl(g, 0.03, 0.03, 0.3, 6, '#fff3d6', x, 1.2, z); } });
  building({ id: 'clothes', x0: 28, x1: 40, z0: -17, z1: -6, front: 'S', shop: true, color: '#f1e4ea', trim: '#c9a227', height: 9, awning: ['#1b1b1b', '#f5f5f5'], sign: shopsInfo.clothes.name, signBg: '#111', signFg: '#e9c46a', mapLabel: '👗',
    display: (g, x, z) => { cyl(g, 0.22, 0.4, 1.2, 10, '#7b1e3a', x, 1.0, z); sph(g, 0.15, '#f2d5c4', x, 1.75, z); } });
  building({ x0: 40, x1: 46, z0: -17, z1: -6, front: 'S', color: '#cfd8c5', height: 11 });
  // south side of the main street (facing -z)
  building({ id: 'sweets', x0: -24, x1: -12, z0: 6, z1: 17, front: 'N', shop: true, color: '#f7c6d0', trim: '#fff', height: 8, awning: ['#e57373', '#ffffff'], sign: shopsInfo.sweets.name, signBg: '#ad1457', signFg: '#fff', mapLabel: '🍰',
    display: (g, x, z) => { cyl(g, 0.3, 0.3, 0.3, 14, '#fff0f5', x, 1.05, z); cyl(g, 0.2, 0.2, 0.2, 14, '#f48fb1', x, 1.3, z); } });
  building({ x0: -34, x1: -24, z0: 6, z1: 17, front: 'N', color: '#e9d5b5', height: 11, balcony: true });
  building({ x0: -46, x1: -34, z0: 6, z1: 17, front: 'N', color: '#c9b7a4', height: 9 });
  building({ id: 'arcade', x0: 12, x1: 24, z0: 6, z1: 17, front: 'N', shop: true, color: '#3a2c5c', trim: '#ff6ec7', height: 8, awning: ['#7c4dff', '#ff4fa3'], sign: shopsInfo.arcade.name, signBg: '#1a1033', signFg: '#7df9ff', mapLabel: '🕹️',
    display: (g, x, z) => { box(g, 0.6, 1.2, 0.5, '#ff4fa3', x, 0.9, z); } });
  building({ x0: 28, x1: 46, z0: 6, z1: 17, front: 'N', color: '#e3c0a0', height: 12, balcony: true });
  // around the plaza
  building({ id: 'flowers', x0: -12, x1: -6, z0: -17, z1: -10, front: 'S', shop: true, color: '#dfe9d8', trim: '#fff', height: 7, awning: ['#66bb6a', '#ffffff'], sign: shopsInfo.flowers.name, signBg: '#2e5e34', signFg: '#fff', mapLabel: '🌷',
    display: (g, x, z) => { cyl(g, 0.2, 0.15, 0.4, 10, '#8d6e63', x, 0.9, z); sph(g, 0.28, '#e57373', x, 1.3, z); } });
  building({ id: 'photo', x0: 6, x1: 12, z0: -17, z1: -10, front: 'S', shop: true, color: '#d9dde6', trim: '#fff', height: 7, awning: ['#37474f', '#eceff1'], sign: shopsInfo.photo.name, signBg: '#263238', signFg: '#fff', mapLabel: '📸',
    display: (g, x, z) => { box(g, 0.7, 0.5, 0.05, '#fff', x, 1.4, z); box(g, 0.55, 0.38, 0.06, '#90a4ae', x, 1.4, z); } });
  building({ x0: -12, x1: -6, z0: 10, z1: 17, front: 'N', color: '#efd9c1', height: 9 });
  building({ x0: 6, x1: 12, z0: 10, z1: 17, front: 'N', color: '#d6c0d9', height: 9 });
  // along the south street
  building({ x0: -46, x1: -6, z0: 17, z1: 26, front: 'E', color: '#e6cfb3', height: 10, balcony: true });
  building({ x0: -46, x1: -6, z0: 26, z1: 38, front: 'E', color: '#d9b49c', height: 12 });
  building({ x0: 6, x1: 18, z0: 17, z1: 28, front: 'W', color: '#f0dcc8', height: 9, balcony: true });
  building({ x0: 6, x1: 18, z0: 28, z1: 38, front: 'W', color: '#c8a98f', height: 11 });
  building({ x0: 18, x1: 46, z0: 28, z1: 38, front: 'N', color: '#d4b8a0', height: 10 });
  building({ x0: 34, x1: 46, z0: 17, z1: 28, front: 'W', color: '#e7d1c0', height: 9 });
  // city edges: arches/walls
  [[-46, -45.5, -3, 3], [45.5, 46, -3, 3], [-6, 6, 37.5, 38]].forEach(([x0, x1, z0, z1]) => {
    box(scene, x1 - x0, 3, z1 - z0, '#d7c4ad', (x0 + x1) / 2, 1.5, (z0 + z1) / 2, { cast: true });
    solid('city', x0, x1, z0, z1);
  });

  // ---------- alley + cat yard ----------
  plane(ground, 4, 22, lam('#ffffff', { map: tiledTex(128, (g, w, h) => { g.fillStyle = '#cbb8a2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8a48d'; for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if ((i + j) % 2) g.fillRect(i * 8, j * 8, 8, 8); noise(g, w, h, .1, 300); }, 2, 10) }), 26, 0.03, 17, { receive: true });
  plane(ground, 16, 11, lam('#c2ad94'), 26, 0.025, 22.5, { receive: true });
  W.mapRects.push({ x0: 24, x1: 28, z0: 6, z1: 17, c: '#cbb8a2' }, { x0: 18, x1: 34, z0: 17, z1: 28, c: '#c2ad94' });
  // alley walls (sides of neighbour buildings already block). Yard walls:
  solid('city', 17.5, 18, 17, 28); solid('city', 34, 34.5, 17, 28);
  box(scene, 0.5, 3, 11, '#bfa98f', 17.75, 1.5, 22.5, { cast: true }); box(scene, 0.5, 3, 11, '#bfa98f', 34.25, 1.5, 22.5, { cast: true });
  // crates in the yard
  [[30, 26.5], [31.3, 26.6], [30.6, 26.6, 1], [20, 26.5], [22.5, 18.5]].forEach(([x, z, up]) => {
    box(scene, 1.1, 1.1, 1.1, '#a1785a', x, up ? 1.65 : 0.55, z, { cast: true });
    if (!up) solid('city', x - 0.55, x + 0.55, z - 0.55, z + 0.55);
  });
  // string lights over the alley
  for (let z = 7; z < 17; z += 0.8) glowPoints.push([26 + Math.sin(z) * 0.6, 4.2 + Math.sin(z * 1.3) * 0.15, z, 0.5]);
  // alley gate
  W.alleyGate = new THREE.Group(); W.alleyGate.position.set(26, 0, 5.8); scene.add(W.alleyGate);
  const gateMat = lam('#2f2a33');
  const alleyL = new THREE.Group(); alleyL.position.x = -2; W.alleyGate.add(alleyL);
  const alleyR = new THREE.Group(); alleyR.position.x = 2; W.alleyGate.add(alleyR);
  [[alleyL, 1], [alleyR, -1]].forEach(([p, s]) => {
    for (let i = 0; i < 6; i++) cyl(p, 0.04, 0.04, 2.6, 6, gateMat, s * (0.17 + i * 0.33), 1.3, 0);
    box(p, 2, 0.1, 0.08, gateMat, s * 1, 2.5, 0); box(p, 2, 0.1, 0.08, gateMat, s * 1, 0.4, 0);
  });
  W.alleyGate.leaves = [alleyL, alleyR];
  W.alleyGateBox = solid('city', 24, 28, 5.6, 6.1, 'alleyGate');
  point('alleyGate', 26, 4.6);
  point('alley', 27.2, 11.5);
  W.labels.push({ x: 26, z: 4.6, text: C.streets.alley });
  // paw prints
  const pawTex = canvas(64, 64, (g) => { g.fillStyle = 'rgba(80,50,40,.85)'; g.beginPath(); g.ellipse(32, 40, 13, 11, 0, 0, PI2); g.fill(); [[18, 20], [28, 13], [38, 13], [47, 20]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 5, 6, 0, 0, PI2); g.fill(); }); });
  W.paws = [[26, 9], [25.4, 14.5], [24, 20]].map(([x, z], i) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.05, z); scene.add(grp);
    for (let k = 0; k < 3; k++) { const p = plane(grp, 0.5, 0.5, new THREE.MeshBasicMaterial({ map: pawTex, transparent: true }), (k % 2 ? 0.25 : -0.25), 0, k * 0.8 - 0.8); p.rotation.z = 0.2; }
    point('paw' + (i + 1), x, z);
    return grp;
  });

  // ---------- plaza ----------
  // clock tower
  const tower = new THREE.Group(); scene.add(tower);
  box(tower, 3.6, 0.6, 3.6, '#d9c6ad', 0, 0.3, 0, { cast: true, receive: true });
  W.occluders.push(box(tower, 3.0, 9, 3.0, '#e8d6bf', 0, 5.0, 0, { cast: true, receive: true }));
  box(tower, 3.3, 0.3, 3.3, '#c9a227', 0, 9.6, 0, { cast: true });
  box(tower, 3.1, 2.4, 3.1, '#e8d6bf', 0, 10.9, 0, { cast: true });
  const tRoof = cyl(tower, 0.01, 2.6, 2.8, 4, '#a83a5a', 0, 13.5, 0, { cast: true }); tRoof.rotation.y = PI / 4;
  sph(tower, 0.25, '#e0a93b', 0, 15.0, 0);
  solid('city', -1.8, 1.8, -1.8, 1.8, 'tower');
  W.clockCanvas = document.createElement('canvas'); W.clockCanvas.width = W.clockCanvas.height = 256;
  W.clockTex = new THREE.CanvasTexture(W.clockCanvas);
  W.drawClock = function (h, m) {
    const g = W.clockCanvas.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#fbf3e4'; g.beginPath(); g.arc(128, 128, 120, 0, PI2); g.fill();
    g.strokeStyle = '#c9a227'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#3b1f2b'; g.font = `bold 28px ${FONT_B}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * PI2 - PI / 2; g.fillText(String(i), 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); }
    const hand = (ang, len, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(ang) * len, 128 + Math.sin(ang) * len); g.stroke(); };
    hand(((h % 12) + m / 60) / 12 * PI2 - PI / 2, 52, 9, '#3b1f2b');
    hand(m / 60 * PI2 - PI / 2, 80, 5, '#a83a5a');
    g.fillStyle = '#c9a227'; g.beginPath(); g.arc(128, 128, 8, 0, PI2); g.fill();
    W.clockTex.needsUpdate = true;
  };
  W.drawClock(4, 0);
  const faceMat = new THREE.MeshBasicMaterial({ map: W.clockTex });
  [[0, 1.56, 0], [PI / 2, 1.56, 0], [PI, 1.56, 0], [-PI / 2, 1.56, 0]].forEach(([r]) => {
    const fg = new THREE.Group(); fg.rotation.y = r; tower.add(fg);
    mesh(fg, new THREE.CircleGeometry(1.15, 32), faceMat, 0, 10.9, 1.56);
  });
  // secret compartment door on the tower
  W.towerDoor = new THREE.Group(); W.towerDoor.position.set(-0.45, 0.6, 1.52); tower.add(W.towerDoor);
  box(W.towerDoor, 0.9, 1.2, 0.06, '#8b5e34', 0.45, 0.6, 0);
  sph(W.towerDoor, 0.05, '#e0a93b', 0.8, 0.6, 0.05);
  W.towerKey = new THREE.Group(); W.towerKey.position.set(0, 1.1, 1.3); tower.add(W.towerKey);
  point('clock', 0, 2.6);
  W.labels.push({ x: 0, z: 2.6, text: 'الساعة الكبيرة' });
  // fountain
  const fnt = new THREE.Group(); fnt.position.set(-7, 0, 6); scene.add(fnt);
  cyl(fnt, 2.0, 2.1, 0.6, 28, '#d9c6ad', 0, 0.3, 0, { cast: true, receive: true });
  W.water = cyl(fnt, 1.8, 1.8, 0.05, 28, lam('#7fc4e8', { emissive: '#3a7ca5', emissiveIntensity: 0.15 }), 0, 0.55, 0);
  cyl(fnt, 0.25, 0.35, 1.6, 12, '#e8d6bf', 0, 1.1, 0, { cast: true });
  cyl(fnt, 0.8, 0.3, 0.3, 18, '#e8d6bf', 0, 1.95, 0, { cast: true });
  solidC('city', -7, 6, 2.2);
  point('fountain', -7, 3.4);
  // benches, planters around the plaza
  function bench(x, z, ry) {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; scene.add(b);
    box(b, 1.8, 0.08, 0.5, '#8d5b3e', 0, 0.48, 0, { cast: true });
    box(b, 1.8, 0.45, 0.07, '#8d5b3e', 0, 0.8, -0.24, { cast: true });
    [-0.75, 0.75].forEach(s => box(b, 0.08, 0.48, 0.5, '#2f2a33', s, 0.24, 0));
    solidC('city', x, z, 0.75);
    return b;
  }
  W.bench = bench;
  bench(7.5, -7.5, 0); bench(-7.5, -7.5, 0); bench(8.5, 7.5, PI);
  point('plaza', 7.5, -6.3);
  function planter(x, z, col) {
    const p = new THREE.Group(); p.position.set(x, 0, z); scene.add(p);
    box(p, 1.4, 0.6, 1.4, '#d9c6ad', 0, 0.3, 0, { cast: true });
    sph(p, 0.65, col, 0, 0.95, 0, { cast: true });
    solid('city', x - 0.7, x + 0.7, z - 0.7, z + 0.7);
  }
  planter(10.5, -1.5, '#6aa36f'); planter(-10.5, -1.5, '#6aa36f'); planter(10.5, 4.5, '#e48aa6'); planter(-10.5, -6, '#e48aa6');

  // ---------- trees & lamps along streets ----------
  const treeSpots = [];
  for (let x = -42; x <= 42; x += 9) if (Math.abs(x) > 14) { treeSpots.push([x, -4.6], [x + 4.5, 4.6]); }
  for (let z = 14; z <= 34; z += 8) treeSpots.push([-4.6, z], [4.6, z + 4]);
  for (let x = -40; x <= 40; x += 9) if (Math.abs(x) > 14) { lampPos.push([x + 4.5, 0, -3.4]); lampPos.push([x, 0, 3.4]); }
  for (let z = 12; z <= 36; z += 8) { lampPos.push([-3.4, 0, z + 4]); lampPos.push([3.4, 0, z]); }
  lampPos.push([-9, 0, -9], [9, 0, -9], [9, 0, 9], [-9.5, 0, 9.3], [-3.4, 0, -14], [3.4, 0, -12]);

  // ================= PARK =================
  plane(ground, 44, 27, lam('#8fca7f'), 0, 0.005, -30.5, { receive: true });
  W.mapRects.push({ x0: -22, x1: 22, z0: -44, z1: -17, c: '#8fca7f', label: '🌳' });
  const pathMat = lam('#e9d9bf');
  plane(ground, 3.4, 27, pathMat, 0, 0.03, -30.5, { receive: true });
  plane(ground, 30, 3, pathMat, 0, 0.03, -31, { receive: true });
  W.mapRects.push({ x0: -1.7, x1: 1.7, z0: -44, z1: -17, c: '#e9d9bf' }, { x0: -15, x1: 15, z0: -32.5, z1: -29.5, c: '#e9d9bf' });
  // hedges
  function hedge(zid, x0, x1, z0, z1, h = 1.6) {
    const hm = box(scene, x1 - x0, h, z1 - z0, '#4e8c4a', (x0 + x1) / 2, h / 2, (z0 + z1) / 2, { cast: true, receive: true });
    if (h >= 2) W.occluders.push(hm);
    return solid(zid, x0, x1, z0, z1, 'hedge');
  }
  hedge('city', -22.5, -22, -44, -17); hedge('city', 22, 22.5, -44, -17);
  hedge('city', -22.5, -3, -44.5, -44); hedge('city', 3, 22.5, -44.5, -44);
  hedge('city', -12, -6, -17.5, -17, 1); hedge('city', 6, 12, -17.5, -17, 1);
  // pond
  const pond = { x: 11, z: -24, r: 3.2 };
  cyl(scene, pond.r, pond.r, 0.06, 40, lam('#7ec4e8', { emissive: '#2c6e91', emissiveIntensity: 0.1 }), pond.x, 0.04, pond.z, { receive: true });
  const rim = mesh(scene, new THREE.TorusGeometry(pond.r, 0.2, 8, 40), '#d9d2c5', pond.x, 0.07, pond.z, { rx: -PI / 2 });
  rim.castShadow = true;
  solidC('city', pond.x, pond.z, pond.r + 0.15);
  point('park', pond.x - 4.5, pond.z - 1);
  // gazebo
  const gz = new THREE.Group(); gz.position.set(-12, 0, -36); scene.add(gz);
  cyl(gz, 3.2, 3.2, 0.3, 8, '#efe2d0', 0, 0.15, 0, { receive: true });
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI2; cyl(gz, 0.1, 0.1, 2.8, 8, '#fff', Math.cos(a) * 2.8, 1.6, Math.sin(a) * 2.8, { cast: true }); if (i !== 2) solidC('city', -12 + Math.cos(a) * 2.8, -36 + Math.sin(a) * 2.8, 0.2); }
  cyl(gz, 0.1, 3.6, 1.6, 8, '#c2185b', 0, 3.8, 0, { cast: true });
  for (let i = 0; i < 24; i++) { const a = i / 24 * PI2; glowPoints.push([-12 + Math.cos(a) * 3.3, 2.95, -36 + Math.sin(a) * 3.3, 0.45]); }
  // flower beds
  const bedColors = ['#e57373', '#f06292', '#fff176', '#ba68c8', '#ffffff'];
  function bed(x, z, w, d) {
    box(scene, w, 0.3, d, '#7a5a43', x, 0.15, z, { receive: true });
    for (let i = 0; i < w * d * 3; i++) bedFlowers.push([x + (Math.random() - .5) * (w - 0.3), 0.38, z + (Math.random() - .5) * (d - 0.3), bedColors[i % 5]]);
    solid('city', x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }
  bed(-8, -22, 4, 1.4); bed(8, -38, 4, 1.4); bed(-5, -40, 1.4, 4); bed(15, -36, 1.4, 4);
  bench(-4, -26, PI / 2); bench(4, -36, -PI / 2); bench(-16, -30, 0);
  for (let i = 0; i < 6; i++) { lampPos.push([-2.4, 0, -20 - i * 4.5]); lampPos.push([2.4, 0, -22 - i * 4.5]); }
  treeSpots.push([-18, -20], [-19, -27], [-18, -41], [18, -41], [19, -32], [17, -20], [-7, -33], [6, -27], [-14, -24], [12, -42]);
  point('starsCenter', 0, -31);

  // ---------- secret gate ----------
  W.gate = new THREE.Group(); W.gate.position.set(0, 0, -44.25); scene.add(W.gate);
  [-3.2, 3.2].forEach(x => { box(W.gate, 0.7, 4.2, 0.7, '#e8d6bf', x, 2.1, 0, { cast: true }); sph(W.gate, 0.35, '#c9a227', x, 4.5, 0); });
  const arch = mesh(W.gate, new THREE.TorusGeometry(3.2, 0.18, 8, 24, PI), '#c9a227', 0, 4.2, 0);
  arch.castShadow = true;
  for (let i = 0; i < 30; i++) { const a = i / 29 * PI; glowPoints.push([Math.cos(a) * 3.2, 4.2 + Math.sin(a) * 3.2, -44.25, 0.5]); }
  const gateGold = lam('#b8860b', { emissive: '#4a3000', emissiveIntensity: 0.3 });
  W.gate.leaves = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.x = s * 2.9; W.gate.add(p);
    for (let i = 0; i < 7; i++) cyl(p, 0.05, 0.05, 3.6, 6, gateGold, -s * (0.2 + i * 0.4), 1.8, 0);
    box(p, 2.9, 0.12, 0.1, gateGold, -s * 1.45, 3.4, 0); box(p, 2.9, 0.12, 0.1, gateGold, -s * 1.45, 0.5, 0);
    const heart = mesh(p, new THREE.TorusGeometry(0.4, 0.07, 8, 20), gateGold, -s * 1.45, 2, 0);
    heart.castShadow = true;
    return p;
  });
  W.gateBox = solid('city', -3, 3, -44.6, -43.9, 'gate');
  point('gate', 0, -42.6);
  W.labels.push({ x: 0, z: -42.6, text: C.streets.secret });

  // ================= SECRET GARDEN =================
  plane(ground, 28, 22, lam('#7fbf74'), 0, 0.006, -55.5, { receive: true });
  W.mapRects.push({ x0: -14, x1: 14, z0: -66, z1: -44.5, c: '#7fbf74', secret: true });
  hedge('city', -14.5, -14, -66, -44.5, 2.2); hedge('city', 14, 14.5, -66, -44.5, 2.2); hedge('city', -14.5, 14.5, -66.5, -66, 2.2);
  plane(ground, 3, 12, lam('#f1e2c8'), 0, 0.03, -50.5, { receive: true });
  const platform = cyl(scene, 4, 4.2, 0.35, 40, '#f4ead9', 0, 0.17, -58.5, { receive: true, cast: true });
  cyl(scene, 4.25, 4.25, 0.1, 40, '#c9a227', 0, 0.04, -58.5);
  // rose arches along the path
  [-48, -52].forEach(z => {
    const a = mesh(scene, new THREE.TorusGeometry(2.2, 0.12, 8, 20, PI), '#5c8a4f', 0, 0, z);
    for (let i = 0; i < 10; i++) { const t = i / 9 * PI; sph(scene, 0.18, i % 2 ? '#e57373' : '#f8bbd0', Math.cos(t) * 2.2, Math.sin(t) * 2.2, z); }
    a.position.y = 0; [-2.2, 2.2].forEach(x => solidC('city', x, z, 0.25));
  });
  // lanterns
  W.gardenLanterns = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * PI2, x = Math.cos(a) * 6.5, z = -58.5 + Math.sin(a) * 5.5;
    cyl(scene, 0.05, 0.05, 1.4, 6, '#2f2a33', x, 0.7, z);
    const l = box(scene, 0.35, 0.45, 0.35, W.lampMat, x, 1.6, z);
    W.gardenLanterns.push(l);
    glowPoints.push([x, 1.6, z, 1.6]);
  }
  for (let i = 0; i < 80; i++) glowPoints.push([(Math.random() - .5) * 26, 2.5 + Math.random() * 2.5, -46 - Math.random() * 19, 0.35]);
  bed(-9, -50, 4, 1.4); bed(9, -50, 4, 1.4); bed(-10, -63, 6, 1.2); bed(10, -63, 6, 1.2);
  bench(-8.5, -58.5, PI / 2); bench(8.5, -58.5, -PI / 2);
  // photo easels (filled from the album at the finale)
  W.easels = [];
  [[-5, -47.5], [5, -47.5], [-11, -54], [11, -54], [-6, -64], [6, -64]].forEach(([x, z], i) => {
    const e = new THREE.Group(); e.position.set(x, 0, z); e.lookAt(0, 0, -58.5); e.rotation.x = 0; scene.add(e);
    [-0.4, 0.4].forEach(s => cyl(e, 0.04, 0.04, 1.8, 6, '#6d4c41', s, 0.9, 0));
    box(e, 1.3, 1.0, 0.06, '#c9a227', 0, 1.45, 0.05);
    const pic = mesh(e, new THREE.PlaneGeometry(1.15, 0.85), new THREE.MeshBasicMaterial({ color: '#555' }), 0, 1.45, 0.09);
    solidC('city', x, z, 0.5);
    W.easels.push({ group: e, pic });
  });
  // photo wall at the back of the garden (10 more frames)
  W.occluders.push(box(scene, 20.5, 3.6, 0.3, '#f4ead9', 0, 1.9, -65.7, { cast: true }));
  box(scene, 20.9, 0.25, 0.4, '#c9a227', 0, 3.8, -65.7);
  for (let i = 0; i < 10; i++) {
    const x = -8 + (i % 5) * 4, y = i < 5 ? 2.75 : 1.15;
    const fr = new THREE.Group(); fr.position.set(x, 0, -65.5); scene.add(fr);
    box(fr, 1.9, 1.45, 0.08, '#c9a227', 0, y, 0);
    const pic = mesh(fr, new THREE.PlaneGeometry(1.75, 1.3), new THREE.MeshBasicMaterial({ color: '#555' }), 0, y, 0.05);
    W.easels.push({ group: fr, pic });
  }
  solid('city', -10.3, 10.3, -66, -65.4);

  // seven letters floating in a ring
  const envTex = canvas(128, 96, (g) => { g.fillStyle = '#fff8f2'; g.fillRect(0, 0, 128, 96); g.strokeStyle = '#c2185b'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 88); g.beginPath(); g.moveTo(4, 4); g.lineTo(64, 52); g.lineTo(124, 4); g.stroke(); g.fillStyle = '#c2185b'; g.beginPath(); g.arc(64, 52, 10, 0, PI2); g.fill(); });
  W.gardenLetters = [];
  for (let i = 0; i < 7; i++) {
    const m = mesh(scene, new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshBasicMaterial({ map: envTex, side: THREE.DoubleSide, transparent: true }), 0, 2.4, -58.5);
    m.userData.a = i / 7 * PI2; m.visible = false;
    W.gardenLetters.push(m);
  }
  // the gift
  W.gift = new THREE.Group(); W.gift.position.set(0, 0.35, -58.5); scene.add(W.gift);
  const giftMat = lam('#b0124f', { emissive: '#3a0018', emissiveIntensity: 0.3 });
  const ribbon = lam('#e9c46a', { emissive: '#5a4200', emissiveIntensity: 0.3 });
  box(W.gift, 1.4, 1.1, 1.4, giftMat, 0, 0.55, 0, { cast: true });
  box(W.gift, 1.42, 1.11, 0.25, ribbon, 0, 0.55, 0); box(W.gift, 0.25, 1.11, 1.42, ribbon, 0, 0.55, 0);
  W.giftLid = new THREE.Group(); W.giftLid.position.y = 1.1; W.gift.add(W.giftLid);
  box(W.giftLid, 1.55, 0.25, 1.55, giftMat, 0, 0.12, 0, { cast: true });
  box(W.giftLid, 1.57, 0.26, 0.25, ribbon, 0, 0.12, 0); box(W.giftLid, 0.25, 0.26, 1.57, ribbon, 0, 0.12, 0);
  [-0.7, 0.7].forEach(r => { const b = mesh(W.giftLid, new THREE.TorusGeometry(0.24, 0.08, 8, 18), ribbon, r * 0.3, 0.45, 0, { ry: r }); b.castShadow = true; });
  W.giftLight = new THREE.PointLight('#ffb3c8', 0, 9, 1.5); W.giftLight.position.set(0, 2.2, -58.5); scene.add(W.giftLight);
  solidC('city', 0, -58.5, 1.1);
  point('gift', 0, -56.6);
  point('gardenEntry', 0, -46.2);

  // ---------- trees (instanced) ----------
  const treeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), lam('#7a5136', { flatShading: true }), treeSpots.length);
  const treeTop = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 0), lam('#5c9e57', { flatShading: true }), treeSpots.length);
  const treeTop2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 0), lam('#75b86b', { flatShading: true }), treeSpots.length);
  const d = new THREE.Object3D();
  treeSpots.forEach(([x, z], i) => {
    d.position.set(x, 0.8, z); d.rotation.set(0, i, 0); d.scale.setScalar(1); d.updateMatrix(); treeTrunk.setMatrixAt(i, d.matrix);
    d.position.set(x, 2.4, z); d.scale.setScalar(0.9 + (i % 3) * 0.12); d.updateMatrix(); treeTop.setMatrixAt(i, d.matrix);
    d.position.set(x + 0.4, 3.2, z - 0.3); d.updateMatrix(); treeTop2.setMatrixAt(i, d.matrix);
    solidC('city', x, z, 0.35);
  });
  [treeTrunk, treeTop, treeTop2].forEach(m => { m.castShadow = true; scene.add(m); });
  W.treeInst = { spots: treeSpots, meshes: [treeTrunk, treeTop, treeTop2], base: [treeTrunk, treeTop, treeTop2].map(m => treeSpots.map((_, i) => { const mm = new THREE.Matrix4(); m.getMatrixAt(i, mm); return mm; })), hidden: treeSpots.map(() => false) };

  // ---------- lamps (instanced) ----------
  const poles = lampPos.filter(l => l[3] !== 'wall');
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 3.4, 6), lam('#2f2a33'), poles.length);
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 8), W.lampMat, lampPos.length);
  lampPos.forEach(([x, y, z, kind], i) => {
    const hy = kind === 'wall' ? y : 3.55;
    d.position.set(x, hy, z); d.rotation.set(0, 0, 0); d.scale.setScalar(kind === 'wall' ? 0.7 : 1); d.updateMatrix(); headMesh.setMatrixAt(i, d.matrix);
    glowPoints.push([x, hy, z, kind === 'wall' ? 1.4 : 2.2]);
  });
  poles.forEach(([x, , z], i) => { d.position.set(x, 1.7, z); d.scale.setScalar(1); d.updateMatrix(); poleMesh.setMatrixAt(i, d.matrix); solidC('city', x, z, 0.15); });
  poleMesh.castShadow = true;
  scene.add(poleMesh, headMesh);
  // sign note on a lamp post (signs quest)
  point('note1', -15, 4.6);
  point('note2', 3.4, 21.2);
  W.notes = {};
  const noteTex = canvas(64, 80, (g) => { g.fillStyle = '#fff8e1'; g.fillRect(0, 0, 64, 80); g.fillStyle = '#c2185b'; g.font = '40px serif'; g.textAlign = 'center'; g.fillText('?', 32, 55); g.fillStyle = '#e53935'; g.beginPath(); g.arc(32, 8, 5, 0, PI2); g.fill(); });
  W.notes.note1 = mesh(scene, new THREE.PlaneGeometry(0.45, 0.56), new THREE.MeshBasicMaterial({ map: noteTex }), -15, 1.5, 6 - 0.07, { ry: PI });
  W.notes.note2 = mesh(scene, new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshBasicMaterial({ map: noteTex }), 3.4, 1.6, 20 + 0.1);

  // ---------- windows (instanced) ----------
  const winMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), W.windowMat, windowXforms.length);
  windowXforms.forEach((m, i) => winMesh.setMatrixAt(i, m));
  scene.add(winMesh);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  [[sillXforms, '#f4ead9'], [balcXforms, '#e8dccb'], [railXforms, '#3b2f2f']].forEach(([list, col]) => {
    const im = new THREE.InstancedMesh(unitBox, lam(col), list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    scene.add(im);
  });
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), lam('#ffffff'), bedFlowers.length);
  const flc = new THREE.Color();
  bedFlowers.forEach(([x, y, z, c], i) => { d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); fl.setMatrixAt(i, d.matrix); fl.setColorAt(i, flc.set(c)); });
  scene.add(fl);

  // ---------- taxi stand ----------
  box(scene, 3, 0.1, 1.2, '#f7c948', 4.6, 0.06, 33, { receive: true });
  cyl(scene, 0.05, 0.05, 2.6, 6, '#2f2a33', 5.6, 1.3, 31.2);
  mesh(scene, new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: signTex('تاكسي', '#f7c948', '#222', '#222'), side: THREE.DoubleSide }), 5.6, 2.5, 31.2);
  solidC('city', 5.6, 31.2, 0.15);
  point('taxiStand', 4.6, 34.5);
  point('taxiCar', 1.4, 32.5);
  point('taxiGoal', 0, -19.5);

  // ---------- NPC spots outside ----------
  point('npc_guide', 3.6, 4.4);
  point('npc_musician', -4.6, 25);
  point('npc_taxi', 4.4, 32.6);
  point('npc_keeper', -3.8, -24);
  point('npc_guard', 4.2, -42.4);
  point('npc_cat', 31, 24.5);
  point('cafeTerrace', -22.5, -4.4);
  // extra memory spots
  [['towerBack', 0, -2.7], ['sweetsFront', -18.2, 4.5], ['restaurantFront', 17.5, -4.4], ['boutiqueFront', 33.2, -4.5], ['arcadeFront', 15.5, 4.4],
   ['westEnd', -43, 0], ['eastEnd', 43, 0], ['southStreet', -4.6, 33.5], ['yard', 21.5, 22], ['gazebo', -12, -36], ['parkNorth', -15, -42.2], ['parkWest', -16, -26.5]]
    .forEach(([n, x, z]) => point(n, x, z));
  point('start', 0, 8.5);
  // cafe terrace tables
  [[-23.5, -4.5], [-20.5, -4.5]].forEach(([x, z]) => {
    cyl(scene, 0.5, 0.5, 0.06, 16, '#fff', x, 0.78, z, { cast: true }); cyl(scene, 0.05, 0.05, 0.78, 6, '#2f2a33', x, 0.39, z);
    solidC('city', x, z, 0.55);
  });
  // street name signs
  [[13, -6.6, 0, C.streets.main], [-13, 6.6, PI, C.streets.main], [-6.6, 18, PI / 2, C.streets.cross], [6.6, -15, -PI / 2, C.streets.cross]].forEach(([x, z, r, t]) => {
    cyl(scene, 0.04, 0.04, 2.6, 6, '#2f2a33', x, 1.3, z);
    mesh(scene, new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex(t, '#1f5c4a', '#fff', '#fff'), side: THREE.DoubleSide }), x, 2.5, z, { ry: r });
  });

  // ---------- glow sprites (one draw call) ----------
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPoints.flatMap(p => [p[0], p[1], p[2]]), 3));
  W.glowMat = new THREE.PointsMaterial({ map: glowTex, size: 1.0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  W.glow = new THREE.Points(gGeo, W.glowMat);
  scene.add(W.glow);
  // night sky stars
  const sky = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * PI2, e = Math.random() * 0.5 + 0.12; sky.push(Math.cos(a) * Math.cos(e) * 90, Math.sin(e) * 90, Math.sin(a) * Math.cos(e) * 90); }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sky, 3));
  W.skyStarsMat = new THREE.PointsMaterial({ color: '#fff', size: 0.35, transparent: true, opacity: 0, fog: false });
  W.skyStars = new THREE.Points(sGeo, W.skyStarsMat);
  scene.add(W.skyStars);

  // ================= INTERIORS =================
  W.rooms = {};
  const woodTex = (c1, c2) => tiledTex(128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(0, i * 16, w, 16); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(((i * 37) % 4) * 32, i * 16, 2, 16); } noise(g, w, h, .08, 300); }, 3, 3);
  const tileTex = (c1, c2) => tiledTex(128, (g, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? c1 : c2; g.fillRect(i * 32, j * 32, 32, 32); } }, 4, 4);
  function room(id, ox, w, dd, o) {
    const g = new THREE.Group(); g.position.set(ox, 0, 0); scene.add(g);
    const z = zone(id, { x0: ox - w / 2 + 0.4, x1: ox + w / 2 - 0.4, z0: -dd / 2 + 0.4, z1: dd / 2 - 0.3 }, { mode: 'room', bg: o.bg || '#2a1a1f', room: { ox, w, d: dd } });
    plane(g, w, dd, lam('#ffffff', { map: o.floor }), 0, 0, 0, { receive: true });
    const wallH = 3.4;
    box(g, w, wallH, 0.2, o.wall, 0, wallH / 2, -dd / 2, { receive: true });
    box(g, 0.2, wallH, dd, o.wall, -w / 2, wallH / 2, 0, { receive: true });
    box(g, 0.2, wallH, dd, o.wall, w / 2, wallH / 2, 0, { receive: true });
    box(g, w, 0.35, 0.12, o.trim || '#f4ead9', 0, 0.17, dd / 2);          // low front lip (cutaway wall)
    box(g, w, 0.12, 0.1, o.trim || '#f4ead9', 0, wallH, -dd / 2 + 0.1);
    box(g, w, 0.5, 0.06, o.trim || '#f4ead9', 0, 0.25, -dd / 2 + 0.12);
    // exit mat
    const mat = plane(g, 1.8, 0.9, lam('#ffffff', { map: signTex('خروج', '#7a2e3d', '#fff') }), 0, 0.02, dd / 2 - 0.55);
    mat.material.map.rotation = 0;
    const r = W.rooms[id] = { id, g, ox, w, d: dd, zone: z, spawn: { x: ox, z: dd / 2 - 1.4 }, exit: { x: ox, z: dd / 2 - 0.6 } };
    point('exit_' + id, ox, dd / 2 - 0.6, id);
    r.solid = (x0, x1, z0, z1, tag) => solid(id, ox + x0, ox + x1, z0, z1, tag);
    r.solidC = (x, zz, rr) => solidC(id, ox + x, zz, rr);
    r.pt = (name, x, zz) => point(name, ox + x, zz, id);
    // ceiling lamps (glow only)
    (o.lamps || [[-w / 4, -dd / 4], [w / 4, -dd / 4], [0, dd / 6]]).forEach(([x, zz]) => {
      cyl(g, 0.01, 0.01, 0.9, 4, '#2f2a33', x, wallH - 0.1, zz);
      cyl(g, 0.05, 0.35, 0.3, 14, o.lampShade || '#c9a227', x, wallH - 0.6, zz, {});
      glowPoints.push([ox + x, wallH - 0.75, zz, 2.2]);
    });
    return r;
  }
  function table(r, x, z, rad, col = '#fff', legCol = '#3b2f2f', h = 0.78) {
    cyl(r.g, rad, rad, 0.06, 18, col, x, h, z, { cast: true, receive: true });
    cyl(r.g, 0.06, 0.06, h, 8, legCol, x, h / 2, z);
    r.solidC(x, z, rad + 0.05);
  }
  function chair(r, x, z, ry, col = '#8d5b3e') {
    const c = new THREE.Group(); c.position.set(r.ox + x, 0, z); c.rotation.y = ry; scene.add(c);
    box(c, 0.45, 0.06, 0.45, col, 0, 0.46, 0, { cast: true });
    box(c, 0.45, 0.5, 0.06, col, 0, 0.72, -0.2, { cast: true });
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a, b]) => box(c, 0.04, 0.46, 0.04, '#3b2f2f', a, 0.23, b));
    r.solidC(x, z, 0.3);
    return c;
  }
  function counter(r, x, z, w, dd, col, top) {
    box(r.g, w, 1.05, dd, col, x, 0.52, z, { cast: true, receive: true });
    box(r.g, w + 0.1, 0.06, dd + 0.1, top || '#f4ead9', x, 1.08, z, { cast: true });
    r.solid(x - w / 2, x + w / 2, z - dd / 2, z + dd / 2);
  }
  function shelf(r, x, z, w, col, items) {
    box(r.g, w, 2.2, 0.4, col, x, 1.1, z, { cast: true });
    [0.6, 1.2, 1.8].forEach(y => box(r.g, w - 0.1, 0.05, 0.42, '#f4ead9', x, y, z + 0.02));
    if (items) items(r.g, x, z);
    r.solid(x - w / 2, x + w / 2, z - 0.25, z + 0.25);
  }
  function plant(r, x, z) { cyl(r.g, 0.25, 0.2, 0.45, 10, '#b5651d', x, 0.22, z, { cast: true }); sph(r.g, 0.45, '#5c9e57', x, 0.8, z, { cast: true }); r.solidC(x, z, 0.35); }
  function wallText(r, text, x, y, z, w, bg, fg, ry = 0) {
    mesh(r.g, new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg, fg) }), x, y, z, { ry });
  }

  // --- cafe ---
  const cafe = room('cafe', 200, 12, 9, { floor: woodTex('#8d6345', '#9c7151'), wall: '#f1dfc4', trim: '#6d3b2a', lampShade: '#6d3b2a', bg: '#2b1a12' });
  counter(cafe, 2.8, -2.6, 5, 1, '#6d3b2a', '#e8d6bf');
  box(cafe.g, 0.7, 0.6, 0.5, '#9aa0a6', 4.4, 1.4, -2.7, { cast: true });   // espresso machine
  cyl(cafe.g, 0.06, 0.06, 0.2, 8, '#333', 4.2, 1.2, -2.4);
  shelf(cafe, -3.5, -4.2, 3.6, '#6d3b2a', (g, x, z) => { for (let i = 0; i < 6; i++) cyl(g, 0.09, 0.08, 0.16, 10, i % 2 ? '#fff' : '#d7ccc8', x - 1.4 + i * 0.55, 1.33, z); for (let i = 0; i < 5; i++) box(g, 0.25, 0.35, 0.22, ['#6d3b2a', '#a1887f', '#4e342e'][i % 3], x - 1.2 + i * 0.6, 1.98, z); });
  wallText(cafe, 'قهوة • حلويات • حب', 2.8, 2.5, -4.38, 4, '#3e2723', '#f7d488');
  [[-3.5, -0.5], [-3.5, 2.4], [0.4, 1.6]].forEach(([x, z], i) => { table(cafe, x, z, 0.55, '#fff', '#3b2f2f'); chair(cafe, x - 0.9, z, PI / 2); chair(cafe, x + 0.9, z, -PI / 2); });
  plant(cafe, 5.4, 3.5); plant(cafe, -5.4, -1.8);
  cafe.pt('cafe_cup', -5.2, -3.6);
  W.cafeCup = new THREE.Group(); W.cafeCup.position.set(cafe.ox - 5.25, 1.82, -4.2); scene.add(W.cafeCup);
  cyl(W.cafeCup, 0.11, 0.09, 0.18, 12, '#c2185b', 0, 0, 0); mesh(W.cafeCup, new THREE.TorusGeometry(0.06, 0.02, 6, 12), '#c2185b', 0.12, 0, 0);
  cafe.pt('cafe_note', 0.4 + 0.9, 1.6 + 0.6);
  cafe.pt('cafe_counter', 2.8, -1.5);
  cafe.pt('npc_barista', 2.8, -3.6);

  // --- sweets ---
  const sweets = room('sweets', 240, 9, 7, { floor: tileTex('#fce4ec', '#ffffff'), wall: '#f8bbd0', trim: '#ffffff', lampShade: '#ec407a', bg: '#3a1424' });
  [[-2.2, -2.6], [1.6, -2.6]].forEach(([x, z]) => {
    box(sweets.g, 2.6, 0.9, 0.9, '#ffffff', x, 0.45, z, { cast: true });
    box(sweets.g, 2.6, 0.5, 0.9, new THREE.MeshLambertMaterial({ color: '#e3f2fd', transparent: true, opacity: 0.4 }), x, 1.15, z);
    for (let i = 0; i < 4; i++) { cyl(sweets.g, 0.22, 0.22, 0.2, 14, ['#f48fb1', '#fff59d', '#a5d6a7', '#ce93d8'][i], x - 0.9 + i * 0.6, 1.0, z); sph(sweets.g, 0.06, '#e53935', x - 0.9 + i * 0.6, 1.15, z); }
    sweets.solid(x - 1.3, x + 1.3, z - 0.45, z + 0.45);
  });
  wallText(sweets, C.shops.sweets.name, 0, 2.6, -3.38, 3.6, '#ad1457', '#fff');
  table(sweets, -2.5, 1.2, 0.5, '#fff', '#ec407a'); chair(sweets, -3.3, 1.2, PI / 2, '#ec407a');
  plant(sweets, 3.6, 2.4);
  sweets.pt('npc_sweetsSeller', 0, -2.8);
  sweets.pt('sweets_counter', 0, -1.5);

  // --- flowers ---
  const flowers = room('flowers', 280, 9, 7, { floor: woodTex('#d7ccc8', '#cbbfb9'), wall: '#dcedc8', trim: '#fff', lampShade: '#7cb342', bg: '#1c2a17' });
  counter(flowers, 2.6, -2.7, 2.6, 0.8, '#8d6e63');
  for (let i = 0; i < 7; i++) { const x = -4 + i * 0.6; cyl(flowers.g, 0.22, 0.18, 0.45, 10, '#90a4ae', x, 0.22, -3.1); sph(flowers.g, 0.3, bedColors[i % 5], x, 0.65, -3.1); }
  flowers.solid(-4.3, -0.1, -3.4, -2.8);
  W.bouquets = [];
  C.flowers.bouquets.forEach((b, i) => {
    const x = -3 + i * 2, z = 0.3;
    box(flowers.g, 1.1, 0.8, 0.8, '#a1887f', x, 0.4, z, { cast: true });
    const bq = new THREE.Group(); bq.position.set(flowers.ox + x, 0.8, z); scene.add(bq);
    cyl(bq, 0.08, 0.28, 0.6, 10, '#a5d6a7', 0, 0.3, 0);
    for (let k = 0; k < 7; k++) sph(bq, 0.14, b.color, Math.cos(k) * 0.18 * (k ? 1 : 0), 0.7 + (k ? 0 : 0.08), Math.sin(k) * 0.18 * (k ? 1 : 0));
    flowers.solid(x - 0.55, x + 0.55, z - 0.4, z + 0.4);
    flowers.pt('bouquet' + i, x, z + 0.95);
    W.bouquets.push(bq);
  });
  flowers.pt('npc_florist', 2.6, -3.3);
  wallText(flowers, C.shops.flowers.name, -2, 2.6, -3.38, 3.4, '#2e5e34', '#fff');

  // --- restaurant ---
  const rest = room('restaurant', 320, 13, 10, { floor: tileTex('#3b2228', '#4a2a31'), wall: '#7f1d2d', trim: '#e0a93b', lampShade: '#e0a93b', bg: '#160709', lamps: [[-3.5, -2], [3.5, -2], [0, 2], [-3.5, 2.5]] });
  counter(rest, -4, -4.3, 4, 0.8, '#3b1f2b', '#e0a93b');
  box(rest.g, 4, 1.2, 0.1, '#e0a93b', -4, 2.4, -4.85);
  [[-4.5, 0.5], [-1.5, 2.8], [-4.5, 3.4]].forEach(([x, z]) => { table(rest, x, z, 0.6, '#fff8f2', '#3b2f2f'); chair(rest, x - 0.95, z, PI / 2, '#5d1a24'); chair(rest, x + 0.95, z, -PI / 2, '#5d1a24'); cyl(rest.g, 0.03, 0.03, 0.2, 6, '#fff3d6', x, 0.92, z); });
  // private table on a platform
  cyl(rest.g, 2.4, 2.5, 0.18, 32, '#e0a93b', 3.3, 0.09, -0.8, { receive: true });
  table(rest, 3.3, -0.8, 0.8, '#fff8f2', '#e0a93b');
  chair(rest, 3.3 - 1.25, -0.8, PI / 2, '#b8860b'); chair(rest, 3.3 + 1.25, -0.8, -PI / 2, '#b8860b');
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI2; glowPoints.push([rest.ox + 3.3 + Math.cos(a) * 2.6, 2.8, -0.8 + Math.sin(a) * 2.6, 0.6]); }
  W.restTable = { plate: new THREE.Group(), candle: new THREE.Group(), flowers: new THREE.Group(), note: new THREE.Group() };
  Object.values(W.restTable).forEach(g => { g.position.set(rest.ox + 3.3, 0.82, -0.8); g.visible = false; scene.add(g); });
  cyl(W.restTable.plate, 0.28, 0.24, 0.04, 20, '#ffffff', -0.2, 0, 0.25); sph(W.restTable.plate, 0.12, '#e07a5f', -0.2, 0.06, 0.25);
  cyl(W.restTable.candle, 0.05, 0.05, 0.3, 8, '#fff3d6', 0.2, 0.15, -0.1);
  W.restCandleFlame = mesh(W.restTable.candle, new THREE.ConeGeometry(0.04, 0.1, 8), new THREE.MeshBasicMaterial({ color: '#ffb703' }), 0.2, 0.35, -0.1);
  cyl(W.restTable.flowers, 0.07, 0.06, 0.2, 10, '#90caf9', -0.3, 0.1, -0.3);
  for (let k = 0; k < 5; k++) sph(W.restTable.flowers, 0.07, '#e53935', -0.3 + Math.cos(k) * 0.06, 0.26, -0.3 + Math.sin(k) * 0.06);
  mesh(W.restTable.note, new THREE.PlaneGeometry(0.25, 0.18), new THREE.MeshBasicMaterial({ map: envTex }), -0.55, 0.01, 0.35, { rx: -PI / 2 });
  rest.pt('rest_table', 3.3, 0.4);
  rest.pt('npc_chef', -4, -3.6);
  rest.pt('rest_chef', -4, -3.0);
  wallText(rest, C.shops.restaurant.name, 3, 2.6, -4.88, 3.6, '#2b1013', '#f2c46d');
  plant(rest, 5.8, 4); plant(rest, -5.9, -2);

  // --- clothes ---
  const clo = room('clothes', 360, 11, 8, { floor: tileTex('#f5f5f5', '#ece4d8'), wall: '#fbf6f0', trim: '#c9a227', lampShade: '#c9a227', bg: '#1d1a16' });
  W.mannequins = [];
  C.clothes.outfits.forEach((o, i) => {
    const x = -3 + i * 3, z = -1.6;
    cyl(clo.g, 0.5, 0.55, 0.15, 20, '#c9a227', x, 0.07, z);
    const m = new THREE.Group(); m.position.set(clo.ox + x, 0.15, z); scene.add(m);
    cyl(m, 0.22, 0.48, 1.2, 16, o.dress, 0, 0.6, 0, { cast: true });
    cyl(m, 0.24, 0.3, 0.55, 16, o.jacket, 0, 1.2, 0, { cast: true });
    sph(m, 0.18, '#e8e0d8', 0, 1.65, 0);
    clo.solidC(x, z, 0.6);
    clo.pt('outfit' + i, x, z + 1.2);
    W.mannequins.push(m);
  });
  box(clo.g, 1.4, 2.2, 0.1, '#c9a227', -5.3, 1.3, 1.5, { ry: PI / 2 });
  box(clo.g, 1.2, 2.0, 0.05, lam('#dfe9f0', { emissive: '#8aa', emissiveIntensity: 0.15 }), -5.22, 1.3, 1.5, { ry: PI / 2 });
  [[3.5, 2.6], [-1, 2.8]].forEach(([x, z]) => { box(clo.g, 2, 0.05, 0.05, '#c9a227', x, 1.7, z); for (let k = 0; k < 6; k++) box(clo.g, 0.05, 1, 0.45, ['#7b1e3a', '#1f2d5a', '#f3b6c8', '#fff'][k % 4], x - 0.8 + k * 0.32, 1.15, z); clo.solid(x - 1, x + 1, z - 0.3, z + 0.3); });
  counter(clo, 3.8, -3.2, 2.4, 0.7, '#1b1b1b', '#c9a227');
  clo.pt('npc_tailor', 3.8, -3.75);
  wallText(clo, C.shops.clothes.name, -1, 2.6, -3.88, 3.4, '#111', '#e9c46a');

  // --- arcade ---
  const arc = room('arcade', 400, 12, 9, { floor: tileTex('#1a1033', '#24164a'), wall: '#2d1b4e', trim: '#ff4fa3', lampShade: '#7df9ff', bg: '#07030f' });
  const neon = (col) => new THREE.MeshBasicMaterial({ color: col });
  box(arc.g, 12, 0.08, 0.05, neon('#ff4fa3'), 0, 3.0, -4.38); box(arc.g, 0.05, 0.08, 9, neon('#7df9ff'), -5.88, 3.0, 0); box(arc.g, 0.05, 0.08, 9, neon('#7df9ff'), 5.88, 3.0, 0);
  W.arcadeScreens = [];
  function cabinet(x, z, col, ry = 0) {
    const c = new THREE.Group(); c.position.set(arc.ox + x, 0, z); c.rotation.y = ry; scene.add(c);
    box(c, 0.9, 1.9, 0.8, col, 0, 0.95, 0, { cast: true });
    const s = box(c, 0.7, 0.55, 0.05, new THREE.MeshBasicMaterial({ color: '#7df9ff' }), 0, 1.45, 0.41);
    box(c, 0.9, 0.12, 0.4, '#222', 0, 1.0, 0.5);
    W.arcadeScreens.push(s);
    arc.solid(x - 0.5, x + 0.5, z - 0.45, z + 0.45);
  }
  [-4.5, -3.3, -2.1].forEach((x, i) => cabinet(x, -3.8, ['#7c4dff', '#00bcd4', '#ff9800'][i]));
  cabinet(4.5, -1.5, '#4caf50', -PI / 2); cabinet(4.5, 0.2, '#e91e63', -PI / 2);
  const heartM = new THREE.Group(); heartM.position.set(arc.ox + 0.8, 0, -3.6); scene.add(heartM);
  box(heartM, 1.3, 2.3, 1, '#ff4fa3', 0, 1.15, 0, { cast: true });
  W.heartScreen = box(heartM, 1.0, 0.75, 0.05, new THREE.MeshBasicMaterial({ map: signTex('💗 قلوب', '#2d0a24', '#ff9bd2') }), 0, 1.65, 0.51);
  box(heartM, 1.3, 0.15, 0.5, '#2d0a24', 0, 1.1, 0.7);
  arc.solid(0.1, 1.5, -4.1, -3.1);
  arc.pt('heartMachine', 0.8, -2.5);
  box(arc.g, 1.4, 2, 1.4, lam('#e3f2fd', { transparent: true, opacity: 0.35 }), -4.3, 1.1, 2.6);
  box(arc.g, 1.4, 0.8, 1.4, '#ffeb3b', -4.3, 0.4, 2.6, { cast: true });
  arc.solid(-5, -3.6, 1.9, 3.3);
  counter(arc, 3.2, 3.3, 2.2, 0.7, '#1a1033', '#ff4fa3');
  arc.pt('npc_arcadeOwner', 3.2, 2.7);
  wallText(arc, C.shops.arcade.name, 3, 2.5, -4.38, 3.6, '#1a1033', '#7df9ff');

  // --- photo studio ---
  const ph = room('photo', 440, 10, 8, { floor: woodTex('#cfd8dc', '#b0bec5'), wall: '#eceff1', trim: '#37474f', lampShade: '#fff', bg: '#101417' });
  box(ph.g, 4, 3, 0.05, '#f8bbd0', 2.2, 1.5, -3.85);
  plane(ph.g, 4, 2, '#f8bbd0', 2.2, 0.01, -2.85);
  [[0.4, -2], [4, -2]].forEach(([x, z]) => { cyl(ph.g, 0.03, 0.03, 2, 6, '#333', x, 1, z); box(ph.g, 0.7, 0.7, 0.3, lam('#ffffff', { emissive: '#fff', emissiveIntensity: 0.5 }), x, 2.1, z); ph.solidC(x, z, 0.25); });
  const cam = new THREE.Group(); cam.position.set(ph.ox + 2.2, 0, 1.2); scene.add(cam);
  [-0.25, 0, 0.25].forEach((s, i) => cyl(cam, 0.02, 0.02, 1.4, 4, '#333', s, 0.7, i === 1 ? 0.25 : -0.1));
  box(cam, 0.45, 0.3, 0.3, '#222', 0, 1.45, 0); cyl(cam, 0.1, 0.1, 0.25, 12, '#111', 0, 1.45, -0.25, { rx: PI / 2 });
  ph.solidC(2.2, 1.2, 0.35);
  table(ph, -2.8, -1.8, 0.8, '#fff', '#37474f');
  for (let i = 0; i < 6; i++) box(ph.g, 0.22, 0.02, 0.3, '#c2185b', -3.2 + (i % 3) * 0.4, 0.82, -2 + Math.floor(i / 3) * 0.4);
  ph.pt('memoryTable', -2.8, -0.7);
  box(ph.g, 1.2, 2.2, 1.2, '#c2185b', -3.8, 1.1, 2.2, { cast: true });
  wallText(ph, 'كم بتعرفيني؟', -3.8, 2.45, 2.82, 1.2, '#880e4f', '#fff');
  ph.solid(-4.4, -3.2, 1.6, 2.8);
  ph.pt('quizBooth', -3.8, 3.3);
  ph.pt('npc_photographer', 0, 0.4);
  [-4, -2, 0].forEach((x, i) => box(ph.g, 1.2, 0.9, 0.05, ['#90a4ae', '#f8bbd0', '#ffe082'][i], x, 2.2, -3.88));
  wallText(ph, C.shops.photo.name, -2, 3.05, -3.86, 3, '#263238', '#fff');

  // ---------- time of day ----------
  // 0 morning, 1 afternoon, 2 sunset, 3 night
  const K = [
    { sky: '#bfe0f2', fog: '#e9e2dc', hs: '#f3f6ff', hg: '#8a7a6a', hi: 0.5, sc: '#fff1dc', si: 0.72, el: 0.9, lamp: 0.15, win: 0.0, glow: 0.0, stars: 0 },
    { sky: '#f7c99a', fog: '#f3d6bd', hs: '#fff3e0', hg: '#7a6a5a', hi: 0.48, sc: '#ffd9a8', si: 0.7, el: 0.6, lamp: 0.2, win: 0.1, glow: 0.05, stars: 0 },
    { sky: '#e98a8a', fog: '#e9a296', hs: '#ffd1dc', hg: '#5a4a5a', hi: 0.45, sc: '#ff9e6d', si: 0.6, el: 0.25, lamp: 0.7, win: 0.6, glow: 0.55, stars: 0.15 },
    { sky: '#1b1838', fog: '#241f45', hs: '#6b6fb5', hg: '#1f1a2e', hi: 0.42, sc: '#9fb4ff', si: 0.28, el: 0.7, lamp: 1.0, win: 1.0, glow: 1.0, stars: 1 },
  ];
  const ca = new THREE.Color(), cb = new THREE.Color();
  W.roomBg = new THREE.Color();
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  let skyKey = '';
  W.paintSky = function (top, horizon) {
    const key = top.getHexString() + horizon.getHexString();
    scene.background = skyTex;
    if (key === skyKey) return;
    skyKey = key;
    const g = skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(0.75, '#' + horizon.getHexString()); gr.addColorStop(1, '#' + horizon.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
  };
  const mix = (a, b, t) => ca.set(a).lerp(cb.set(b), t).clone();
  W.tod = 0;
  W.inRoom = null;
  W.applyTime = function (t, focus) {
    W.tod = t;
    const i = Math.min(2, Math.floor(t)), f = t - i, a = K[i], b = K[i + 1];
    const L = (k) => a[k] + (b[k] - a[k]) * f;
    const sky = mix(a.sky, b.sky, f);
    if (W.inRoom) {
      const r = W.zones[W.inRoom];
      scene.background = W.roomBg; W.roomBg.set(r.bg); scene.fog.color.set(r.bg); scene.fog.near = 30; scene.fog.far = 60;
      W.hemi.color.set('#fff1e0'); W.hemi.groundColor.set('#5a4040'); W.hemi.intensity = 0.62;
      W.sun.color.set('#ffe6c4'); W.sun.intensity = 0.45;
      W.roomLight.intensity = 1.0;
    } else {
      W.paintSky(sky, mix(a.fog, b.fog, f)); scene.fog.color.copy(mix(a.fog, b.fog, f)); scene.fog.near = 40; scene.fog.far = 115;
      W.hemi.color.copy(mix(a.hs, b.hs, f)); W.hemi.groundColor.copy(mix(a.hg, b.hg, f)); W.hemi.intensity = L('hi');
      W.sun.color.copy(mix(a.sc, b.sc, f)); W.sun.intensity = L('si');
      W.roomLight.intensity = 0;
    }
    W.sunElevation = L('el');
    W.lampMat.emissiveIntensity = L('lamp');
    W.windowMat.emissiveIntensity = L('win');
    W.shopGlassMat.emissiveIntensity = 0.25 + L('win') * 0.6;
    W.glowMat.opacity = W.inRoom ? 0.55 : L('glow');
    W.skyStarsMat.opacity = W.inRoom ? 0 : L('stars');
    W.night = L('stars');
  };
  W.placeSun = function (x, z) {
    const el = W.sunElevation || 0.8;
    W.sun.position.set(x + 14, 6 + el * 18, z + 10 - el * 4);
    W.sun.target.position.set(x, 0, z);
    W.roomLight.position.set(x, 3.2, z);
  };
  W.setShadows = on => { W.sun.castShadow = !!on; };
  W.applyTime(0);
};
