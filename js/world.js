/* =====================================================================
   3D-МИР: рельеф, река, лес, базы, вышки, лавка, лагеря, босс, частицы
   ===================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const T = THREE;

  /* ---------- утилиты ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  G.util = { clamp, lerp, smooth };

  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = rng(20261106);
  G.rand = rand;

  function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }

  /* ---------- раскладка карты ---------- */
  const MAP = (G.MAP = { size: 260, water: -1.0 });
  const riverZ = (G.riverZ = (x) => 0.8 * x + 6 * Math.sin(x * 0.05));
  const riverDist = (G.riverDist = (x, z) => Math.abs(z - riverZ(x)) * 0.78);

  const P = (G.POS = {
    lightBase: { x: -80, z: 80 }, darkBase: { x: 80, z: -80 },
    lightFountain: { x: -98, z: 98 }, darkFountain: { x: 98, z: -98 },
    lightThrone: { x: -70, z: 70 }, darkThrone: { x: 70, z: -70 },
    shop: { x: -98, z: 66 },
    jungle: { x: -15, z: 55 },
    boss: { x: 40, z: 24 },
  });
  P.rune = { x: -22, z: riverZ(-22) };
  P.camps = [
    { x: -30, z: 57 }, { x: -12, z: 43 }, { x: 2, z: 58 }, { x: -16, z: 68 },
  ];

  const LANES = {
    top: [[-76, 62], [-82, 40], [-82, -62], [-76, -76], [-62, -82], [40, -82], [62, -76]],
    mid: [[-62, 62], [62, -62]],
    bot: [[-62, 76], [-40, 82], [62, 82], [76, 76], [82, 62], [82, -40], [76, -62]],
  };
  const laneData = (G.laneData = {});
  const segs = [];
  for (const k in LANES) {
    const pts = LANES[k].map((p) => new T.Vector2(p[0], p[1]));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) { cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1])); segs.push([pts[i - 1], pts[i]]); }
    laneData[k] = { pts, cum, len: cum[cum.length - 1] };
  }
  G.lanePoint = function (lane, s) {
    const d = laneData[lane];
    s = clamp(s, 0, d.len);
    let i = 1;
    while (i < d.pts.length - 1 && d.cum[i] < s) i++;
    const a = d.pts[i - 1], b = d.pts[i], L = d.cum[i] - d.cum[i - 1];
    const t = (s - d.cum[i - 1]) / L;
    return { x: lerp(a.x, b.x, t), z: lerp(a.y, b.y, t), dx: (b.x - a.x) / L, dz: (b.y - a.y) / L };
  };
  function segDist(px, pz, a, b) {
    const abx = b.x - a.x, abz = b.y - a.y;
    const t = clamp(((px - a.x) * abx + (pz - a.y) * abz) / (abx * abx + abz * abz), 0, 1);
    const dx = px - (a.x + abx * t), dz = pz - (a.y + abz * t);
    return Math.sqrt(dx * dx + dz * dz);
  }
  function laneDist(x, z) { let m = 1e9; for (let i = 0; i < segs.length; i++) { const d = segDist(x, z, segs[i][0], segs[i][1]); if (d < m) m = d; } return m; }
  G.laneDist = laneDist;

  /* ---------- рельеф ---------- */
  function sample(x, z) {
    const n = fbm(x * 0.022 + 10, z * 0.022 + 3);
    let h = (n - 0.45) * 5.5;
    const e = Math.max(Math.abs(x), Math.abs(z));
    const mount = smooth(100, 124, e);
    h += mount * (12 + fbm(x * 0.05, z * 0.05) * 24);

    const dl = Math.hypot(x - P.lightBase.x, z - P.lightBase.z);
    const dd = Math.hypot(x - P.darkBase.x, z - P.darkBase.z);
    const plat = Math.max(smooth(37, 30, dl), smooth(37, 30, dd));
    const lane = smooth(8.5, 4.5, laneDist(x, z));

    const dj = Math.hypot(x - P.jungle.x, z - P.jungle.z);
    h *= 1 - smooth(26, 14, dj) * 0.8;

    const flat = Math.max(lane, plat);
    h = h * (1 - flat) + 0.15 * lane * (1 - plat) + 3.2 * plat;

    const river = smooth(10, 4, riverDist(x, z)) * (1 - plat) * (1 - mount);
    h = lerp(h, -2.8 + 1.1 * lane, river);

    // логово босса: кратер, открытый в сторону реки
    const bx = x - P.boss.x, bz = z - P.boss.z, db = Math.hypot(bx, bz) || 1;
    const facing = (-bx + bz) / db / 1.414;
    const rim = smooth(17, 12, db) * smooth(6, 10, db) * smooth(0.35, -0.25, facing);
    h += rim * 3.2 * (0.6 + fbm(x * 0.3, z * 0.3));
    h = lerp(h, -0.4, smooth(9, 5, db));

    const side = smooth(-60, 60, x - z);
    return { h, lane, plat, river, mount, side, rim };
  }
  G.sample = sample;
  G.heightAt = (x, z) => sample(x, z).h;
  G.groundAt = (x, z) => Math.max(sample(x, z).h, MAP.water);

  const COL = {
    grassL1: new T.Color(0x3b7a2c), grassL2: new T.Color(0x7bb24c),
    grassD1: new T.Color(0x2a1c24), grassD2: new T.Color(0x5a3442),
    laneL: new T.Color(0xae8f5a), laneD: new T.Color(0x5e4446),
    stoneL: new T.Color(0xbab296), stoneD: new T.Color(0x41343c),
    sandL: new T.Color(0xcdb37c), sandD: new T.Color(0x6b4440),
    bedL: new T.Color(0x2d5a52), bedD: new T.Color(0x3a1e28),
    rockL: new T.Color(0x7d756a), rockD: new T.Color(0x3c2c32), snow: new T.Color(0xeeeae2),
    rim: new T.Color(0x5a5048),
  };
  const tmpC = new T.Color();
  function groundColor(x, z, s, out) {
    const v = fbm(x * 0.12 + 5, z * 0.12 + 9);
    out.copy(COL.grassL1).lerp(COL.grassL2, v);
    tmpC.copy(COL.grassD1).lerp(COL.grassD2, v);
    out.lerp(tmpC, s.side);
    tmpC.copy(COL.laneL).lerp(COL.laneD, s.side).multiplyScalar(0.88 + v * 0.25);
    out.lerp(tmpC, s.lane * (1 - s.plat));
    tmpC.copy(COL.stoneL).lerp(COL.stoneD, s.side);
    tmpC.multiplyScalar(((Math.floor(x / 5) + Math.floor(z / 5)) & 1) ? 1 : 0.88);
    out.lerp(tmpC, s.plat);
    if (s.h < 0.3) { tmpC.copy(COL.sandL).lerp(COL.sandD, s.side); out.lerp(tmpC, smooth(0.3, -0.6, s.h)); }
    if (s.h < -1.0) { tmpC.copy(COL.bedL).lerp(COL.bedD, s.side); out.lerp(tmpC, smooth(-1.0, -2.2, s.h)); }
    if (s.mount > 0) {
      tmpC.copy(COL.rockL).lerp(COL.rockD, s.side);
      out.lerp(tmpC, smooth(0.1, 0.6, s.mount));
      if (s.h > 24) out.lerp(COL.snow, smooth(24, 32, s.h) * (1 - s.side));
    }
    if (s.rim > 0.05) out.lerp(COL.rim, s.rim);
    return out;
  }
  G.groundColor = groundColor;

  /* ---------- геометрия: хелперы ---------- */
  function part(geo, color, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    const m = new T.Matrix4().compose(
      new T.Vector3(tx, ty, tz),
      new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
      new T.Vector3(sx, sy, sz)
    );
    g.applyMatrix4(m);
    const c = new T.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(arr, 3));
    return g;
  }
  function merge(parts) {
    let total = 0;
    parts.forEach((g) => (total += g.attributes.position.count));
    const P3 = new Float32Array(total * 3), N3 = new Float32Array(total * 3), C3 = new Float32Array(total * 3);
    let o = 0;
    parts.forEach((g) => {
      P3.set(g.attributes.position.array, o * 3);
      N3.set(g.attributes.normal.array, o * 3);
      C3.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(P3, 3));
    out.setAttribute('normal', new T.BufferAttribute(N3, 3));
    out.setAttribute('color', new T.BufferAttribute(C3, 3));
    out.computeBoundingSphere();
    return out;
  }
  G.part = part;
  G.merge = merge;

  function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, o));

  /* ---------- текстуры ---------- */
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return new T.CanvasTexture(c);
  }
  const glowTex = (G.glowTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.2, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }));
  const beamTex = canvasTex(4, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.75, 'rgba(255,255,255,0.3)');
    gr.addColorStop(1, 'rgba(255,255,255,0.85)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  });
  const cloudTex = canvasTex(256, 256, (g) => {
    for (let i = 0; i < 16; i++) {
      const x = 60 + Math.random() * 136, y = 80 + Math.random() * 96, r = 30 + Math.random() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
  });

  function glow(color, size, opacity = 1) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
    s.scale.set(size, size, 1);
    return s;
  }
  function beam(color, r, h, opacity = 0.6) {
    const geo = new T.CylinderGeometry(r * 0.55, r, h, 20, 1, true);
    geo.translate(0, h / 2, 0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: beamTex, color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    return m;
  }
  G.glow = glow;
  G.beam = beam;

  G.timeUniform = { value: 0 };
  G.pointScale = { value: 400 };

  /* =====================================================================
     ПОСТРОЕНИЕ МИРА
     ===================================================================== */
  G.buildWorld = function (scene) {
    G.scene = scene;
    G.anim = [];

    buildSkyAndLights(scene);
    buildTerrain(scene);
    buildWater(scene);
    G.towers = buildTowers(scene);
    G.thrones = {
      light: buildThrone(scene, 0, P.lightThrone.x, P.lightThrone.z),
      dark: buildThrone(scene, 1, P.darkThrone.x, P.darkThrone.z),
    };
    buildFountain(scene, 0, P.lightFountain.x, P.lightFountain.z);
    buildFountain(scene, 1, P.darkFountain.x, P.darkFountain.z);
    buildBarracks(scene);
    G.shop = buildShop(scene, P.shop.x, P.shop.z);
    G.camps = buildCamps(scene);
    G.rune = buildRune(scene);
    G.boss = buildBoss(scene);
    buildTrees(scene);
    buildRocks(scene);
    buildAmbient(scene);
    buildClouds(scene);
    G.fx = buildFx(scene);
    buildMinimapBase();
  };

  G.updateWorld = function (t, dt, camPos) {
    G.timeUniform.value = t;
    for (let i = 0; i < G.anim.length; i++) G.anim[i](t, dt);
    // свет и туман подстраиваются под сторону карты
    const side = smooth(-70, 70, camPos.x - camPos.z);
    G.fogColor.copy(G.fogLight).lerp(G.fogDark, side);
    G.scene.fog.color.copy(G.fogColor);
    G.sky.material.uniforms.horizon.value.copy(G.fogColor);
    G.sky.material.uniforms.top.value.copy(G.skyTopL).lerp(G.skyTopD, side);
    G.sky.position.copy(camPos);
    const hi = smooth(25, 120, camPos.y);
    G.scene.fog.near = lerp(55, 400, hi);
    G.scene.fog.far = lerp(230, 1400, hi);
    G.cloudMat.forEach((m) => (m.opacity = 0.5 * smooth(30, 80, camPos.y)));
    G.fx.update(dt);
  };

  /* ---------- небо, свет ---------- */
  function buildSkyAndLights(scene) {
    G.fogLight = new T.Color(0xcfae84);
    G.fogDark = new T.Color(0x5a2634);
    G.fogColor = G.fogLight.clone();
    G.skyTopL = new T.Color(0x2c3f86);
    G.skyTopD = new T.Color(0x1c0b1e);
    scene.fog = new T.Fog(G.fogColor.clone(), 55, 230);
    scene.background = new T.Color(0x000000);

    const sunDir = new T.Vector3(-0.75, 0.42, -0.25).normalize();
    const sky = new T.Mesh(
      new T.SphereGeometry(900, 32, 16),
      new T.ShaderMaterial({
        uniforms: {
          top: { value: G.skyTopL.clone() },
          horizon: { value: G.fogColor.clone() },
          bottom: { value: new T.Color(0x1e1820) },
          sunDir: { value: sunDir },
        },
        vertexShader: `varying vec3 vDir;
          void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir); float y = d.y;
            vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.5)) : mix(horizon, bottom, pow(clamp(-y,0.0,1.0), 0.35));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0,0.78,0.5) * (pow(s, 900.0) * 2.5 + pow(s, 10.0) * 0.35);
            gl_FragColor = vec4(c, 1.0);
          }`,
        side: T.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    sky.renderOrder = -10;
    scene.add(sky);
    G.sky = sky;

    const hemi = new T.HemisphereLight(0xfff0d6, 0x3a2a40, 0.85);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xffd8a4, 1.35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 320;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.5;
    scene.add(sun, sun.target);
    G.sun = sun;
    G.sunDir = sunDir;
    G.updateSun = function (fx, fz) {
      sun.target.position.set(fx, 0, fz);
      sun.position.set(fx + sunDir.x * 160, sunDir.y * 160, fz + sunDir.z * 160);
    };
    G.updateSun(-60, 60);

    // подложка за краем карты
    const under = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ color: 0x2a2826, roughness: 1 }));
    under.rotation.x = -Math.PI / 2;
    under.position.y = -3.2;
    scene.add(under);
  }

  function buildTerrain(scene) {
    const seg = 200;
    const geo = new T.PlaneGeometry(MAP.size, MAP.size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const s = sample(x, z);
      pos.setY(i, s.h);
      groundColor(x, z, s, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    m.receiveShadow = true;
    scene.add(m);
    G.terrain = m;
  }

  function buildWater(scene) {
    const geo = new T.PlaneGeometry(MAP.size, MAP.size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: `#include <fog_pars_vertex>
        varying vec3 vW;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <fog_pars_fragment>
        uniform float uTime; varying vec3 vW;
        void main(){
          float side = smoothstep(-60.0, 60.0, vW.x - vW.z);
          vec3 deep = mix(vec3(0.06,0.30,0.36), vec3(0.24,0.05,0.10), side);
          vec3 lite = mix(vec3(0.40,0.85,0.85), vec3(0.95,0.32,0.22), side);
          float w = sin(vW.x*0.35 + uTime*1.2) * sin(vW.z*0.3 - uTime*0.9);
          float w2 = sin((vW.x + vW.z)*0.8 + uTime*1.8) * sin((vW.x - vW.z)*0.6 - uTime*1.3);
          float sp = smoothstep(0.55, 0.95, w*0.5 + w2*0.5);
          vec3 col = mix(deep, lite, 0.22 + 0.18*w) + sp*0.45;
          gl_FragColor = vec4(col, 0.84);
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const w = new T.Mesh(geo, mat);
    w.position.y = MAP.water;
    w.renderOrder = 1;
    scene.add(w);
    G.anim.push((t) => (mat.uniforms.uTime.value = t));
  }

  /* ---------- материалы построек ---------- */
  const M = {};
  function mats() {
    if (M.ok) return M;
    M.ok = true;
    M.stoneL = std(0xc4bba0);
    M.stoneL2 = std(0x9a917a);
    M.stoneD = std(0x40343c);
    M.stoneD2 = std(0x2a2228);
    M.trimL = std(0xd9a540, { metalness: 0.6, roughness: 0.35 });
    M.trimD = std(0x6a1c1c, { metalness: 0.5, roughness: 0.4 });
    M.crystalL = std(0xfff0a0, { emissive: 0xffb830, emissiveIntensity: 1.1, roughness: 0.2 });
    M.crystalD = std(0xff7060, { emissive: 0xff2010, emissiveIntensity: 1.1, roughness: 0.2 });
    M.wood = std(0x7a5232);
    M.woodD = std(0x4e3320);
    M.roof = std(0x9a2e22);
    M.gold = std(0xffd34d, { emissive: 0xb07a10, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.3 });
    M.rock = std(0x6f685e, { roughness: 1 });
    M.rockD = std(0x3a2c32, { roughness: 1 });
    M.cyan = std(0x9ff8ff, { emissive: 0x20c8e0, emissiveIntensity: 1.2, roughness: 0.2 });
    M.cloth = std(0x2f6b2a);
    M.clothD = std(0x7a1a1a);
    return M;
  }
  const GEO = {
    oct: new T.OctahedronGeometry(1, 0),
    ico: new T.IcosahedronGeometry(1, 0),
    dode: new T.DodecahedronGeometry(1, 0),
  };

  /* ---------- вышки ---------- */
  function buildTower(scene, side, lane, x, z) {
    mats();
    const g = new T.Group();
    const y = G.heightAt(x, z);
    g.position.set(x, y - 0.3, z);
    const st = side ? M.stoneD : M.stoneL, st2 = side ? M.stoneD2 : M.stoneL2, tr = side ? M.trimD : M.trimL;
    mesh(new T.CylinderGeometry(3.0, 3.6, 1.8, 8), st2, 0, 0.9, 0, g);
    mesh(new T.CylinderGeometry(1.6, 2.3, 8, 8), st, 0, 5.6, 0, g);
    mesh(new T.CylinderGeometry(2.4, 1.7, 1.1, 8), tr, 0, 10.0, 0, g);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const sp = mesh(new T.ConeGeometry(0.35, 2.4, 5), tr, Math.cos(a) * 1.9, 11.6, Math.sin(a) * 1.9, g);
      sp.rotation.z = -Math.cos(a) * 0.25;
      sp.rotation.x = Math.sin(a) * 0.25;
    }
    // флажки
    const ban = mesh(new T.BoxGeometry(0.08, 2.4, 1.4), side ? M.clothD : M.cloth, 1.75, 6.5, 0, g);
    ban.rotation.y = 0;
    const crystal = mesh(GEO.oct, side ? M.crystalD : M.crystalL, 0, 13.2, 0, g);
    crystal.scale.set(1.1, 1.8, 1.1);
    crystal.castShadow = false;
    const gl = glow(side ? 0xff4030 : 0xffcf60, 10, 0.85);
    gl.position.y = 13.2;
    g.add(gl);
    scene.add(g);
    const ph = Math.random() * 6;
    G.anim.push((t) => {
      crystal.rotation.y = t * 0.8 + ph;
      crystal.position.y = 13.2 + Math.sin(t * 1.6 + ph) * 0.35;
      gl.position.y = crystal.position.y;
    });
    return { group: g, crystal, glow: gl, side, lane, x, z, top: new T.Vector3(x, y + 13, z), cd: Math.random() * 1.5 };
  }

  function buildTowers(scene) {
    const out = [];
    const fr = { 0: [0.12, 0.25, 0.38], 1: [0.62, 0.75, 0.88] };
    ['top', 'mid', 'bot'].forEach((lane) => {
      const L = laneData[lane].len;
      [0, 1].forEach((side) => {
        fr[side].forEach((f, i) => {
          let s = f * L, p, x, z;
          for (let guard = 0; guard < 30; guard++) {
            p = G.lanePoint(lane, s);
            x = p.x - p.dz * 6.5;
            z = p.z + p.dx * 6.5;
            if (riverDist(x, z) >= 13) break;
            s += side ? 4 : -4;
          }
          const tw = buildTower(scene, side, lane, x, z);
          tw.tier = side ? i + 1 : 3 - i; // T1 — ближе к центру
          tw.sLane = s;
          out.push(tw);
        });
      });
    });
    return out;
  }
  G.findTower = (side, lane, tier) => G.towers.find((t) => t.side === side && t.lane === lane && t.tier === tier);

  /* ---------- троны ---------- */
  function buildThrone(scene, side, x, z) {
    mats();
    const g = new T.Group();
    g.position.set(x, 3.2, z);
    const st = side ? M.stoneD : M.stoneL, st2 = side ? M.stoneD2 : M.stoneL2, tr = side ? M.trimD : M.trimL;
    mesh(new T.CylinderGeometry(10, 11, 1.2, 8), st2, 0, 0.6, 0, g);
    mesh(new T.CylinderGeometry(8, 9, 1.2, 8), st, 0, 1.8, 0, g);
    mesh(new T.CylinderGeometry(5.5, 6.5, 1.2, 8), st2, 0, 3.0, 0, g);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new T.CylinderGeometry(0.5, 0.65, 7, 6), st, Math.cos(a) * 8, 5.4, Math.sin(a) * 8, g);
      mesh(GEO.oct, tr, Math.cos(a) * 8, 9.4, Math.sin(a) * 8, g).scale.set(0.6, 0.9, 0.6);
    }
    if (side) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const sp = mesh(new T.ConeGeometry(0.9, 7 + (i % 3) * 2, 5), M.rockD, Math.cos(a) * 6, 6, Math.sin(a) * 6, g);
        sp.rotation.z = -Math.cos(a) * 0.45;
        sp.rotation.x = Math.sin(a) * 0.45;
      }
    }
    const cg = new T.Group();
    cg.position.y = 13;
    g.add(cg);
    const crystal = mesh(GEO.oct, side ? M.crystalD : M.crystalL, 0, 0, 0, cg);
    crystal.scale.set(3.2, 5.6, 3.2);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = mesh(new T.TorusGeometry(5.2 + i * 0.9, 0.22, 6, 56), tr, 0, 0, 0, cg);
      r.rotation.x = Math.PI / 2 + (i - 1) * 0.5;
      r.rotation.y = i * 0.7;
      rings.push(r);
    }
    const gl = glow(side ? 0xff3020 : 0xffd070, 34, 0.9);
    cg.add(gl);
    const bm = beam(side ? 0xff3020 : 0xffe090, 3.2, 220, 0.5);
    bm.position.y = 4;
    g.add(bm);
    const light = new T.PointLight(side ? 0xff4030 : 0xffc860, 2.2, 70, 1.6);
    light.position.y = 13;
    g.add(light);
    scene.add(g);
    const obj = { group: g, core: cg, crystal, rings, glow: gl, beam: bm, light, side, alive: true, shake: 0 };
    G.anim.push((t, dt) => {
      if (!obj.alive) return;
      crystal.rotation.y = t * 0.4;
      cg.position.y = 13 + Math.sin(t * 1.2) * 0.6;
      rings.forEach((r, i) => { r.rotation.z += dt * (0.4 + i * 0.25) * (i % 2 ? -1 : 1); });
      if (obj.shake > 0) {
        obj.shake = Math.max(0, obj.shake - dt * 3);
        cg.position.x = (Math.random() - 0.5) * obj.shake * 1.2;
        cg.position.z = (Math.random() - 0.5) * obj.shake * 1.2;
      }
    });
    obj.hit = () => { obj.shake = 1; crystal.material.emissiveIntensity = 3; setTimeout(() => (crystal.material.emissiveIntensity = 1.1), 120); };
    obj.destroy = () => {
      obj.alive = false;
      const wp = new T.Vector3();
      cg.getWorldPosition(wp);
      G.fx.burst(wp, { color: 0xff5030, count: 260, speed: 22, life: 2.2, big: true, gravity: -8 });
      G.fx.burst(wp, { color: 0xffd080, count: 200, speed: 30, life: 1.6, gravity: -14 });
      cg.visible = false;
      bm.visible = false;
      light.intensity = 0;
    };
    return obj;
  }

  /* ---------- фонтаны и казармы ---------- */
  function buildFountain(scene, side, x, z) {
    mats();
    const g = new T.Group();
    g.position.set(x, 3.2, z);
    const st = side ? M.stoneD : M.stoneL;
    const rim = mesh(new T.TorusGeometry(6.5, 0.9, 6, 24), st, 0, 0.5, 0, g);
    rim.rotation.x = Math.PI / 2;
    const wmat = new T.MeshStandardMaterial({
      color: side ? 0xff6a50 : 0x7ff0ff, emissive: side ? 0x801808 : 0x1a8aa0, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.1,
    });
    const disk = mesh(new T.CircleGeometry(6.4, 24), wmat, 0, 0.7, 0, g);
    disk.rotation.x = -Math.PI / 2;
    mesh(new T.CylinderGeometry(0.8, 1.3, 4.5, 8), st, 0, 2.6, 0, g);
    mesh(new T.CylinderGeometry(2.4, 1.0, 0.8, 10), side ? M.trimD : M.trimL, 0, 5.1, 0, g);
    const gl = glow(side ? 0xff5040 : 0x80f0ff, 14, 0.8);
    gl.position.y = 6;
    g.add(gl);
    scene.add(g);
    ambientPoints(scene, 160, () => {
      const a = Math.random() * 6.28, r = Math.random() * 2.2;
      return new T.Vector3(x + Math.cos(a) * r, 8.5, z + Math.sin(a) * r);
    }, side ? 0xff7050 : 0x90f8ff, 1.0, 1, 7);
  }

  function buildBarracks(scene) {
    mats();
    [[0, P.lightBase], [1, P.darkBase]].forEach(([side, b]) => {
      ['top', 'mid', 'bot'].forEach((lane) => {
        const p = G.lanePoint(lane, side ? laneData[lane].len - 2 : 2);
        const dir = side ? -1 : 1;
        [-1, 1].forEach((k) => {
          const x = p.x - p.dz * 6 * k * dir, z = p.z + p.dx * 6 * k * dir;
          const g = new T.Group();
          g.position.set(x, 3.2, z);
          mesh(new T.BoxGeometry(4, 3.5, 4), side ? M.stoneD : M.stoneL2, 0, 1.75, 0, g);
          const roof = mesh(new T.ConeGeometry(3.4, 2.4, 4), side ? M.trimD : M.roof, 0, 4.7, 0, g);
          roof.rotation.y = Math.PI / 4;
          g.rotation.y = Math.atan2(p.dx, p.dz);
          scene.add(g);
        });
      });
    });
  }

  /* ---------- лавка ---------- */
  function buildShop(scene, x, z) {
    mats();
    const g = new T.Group();
    g.position.set(x, 3.2, z);
    g.rotation.y = Math.atan2(P.lightBase.x - x, P.lightBase.z - z);
    mesh(new T.BoxGeometry(9, 0.4, 7), M.woodD, 0, 0.2, 0, g);
    mesh(new T.BoxGeometry(7.6, 4, 5.4), M.wood, 0, 2.4, -0.5, g);
    const roof = mesh(new T.ConeGeometry(6.4, 3.4, 4), M.roof, 0, 6.1, -0.5, g);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.8;
    mesh(new T.BoxGeometry(8, 1.3, 1.3), M.woodD, 0, 1.05, 2.9, g);
    const aw = mesh(new T.BoxGeometry(8.2, 0.18, 2.8), std(0xd8b46a), 0, 4.1, 3.0, g);
    aw.rotation.x = 0.28;
    [[-3.6, 3.6], [3.6, 3.6]].forEach(([px, pz]) => mesh(new T.CylinderGeometry(0.18, 0.18, 4.2, 6), M.woodD, px, 2.1, pz, g));
    [[-5.2, 2.4], [-5.4, 0.2], [5.3, 2.2]].forEach(([px, pz]) => mesh(new T.CylinderGeometry(0.75, 0.85, 1.6, 8), M.wood, px, 0.8, pz, g));
    mesh(new T.BoxGeometry(1.4, 1.4, 1.4), M.woodD, 5.1, 0.7, 0.2, g).rotation.y = 0.4;
    const coin = mesh(new T.CylinderGeometry(1.5, 1.5, 0.35, 28), M.gold, 0, 10, 0, g);
    coin.rotation.x = Math.PI / 2;
    const gl = glow(0xffd060, 9, 0.8);
    gl.position.y = 10;
    g.add(gl);
    const lamp = glow(0xffa040, 3, 0.9);
    lamp.position.set(0, 3.6, 3.4);
    g.add(lamp);
    scene.add(g);
    G.anim.push((t) => { coin.rotation.z = t * 1.6; coin.position.y = 10 + Math.sin(t * 2) * 0.3; });
    return { group: g, pos: new T.Vector3(x, 3.2, z) };
  }

  /* ---------- лагеря проектов ---------- */
  function buildCamps(scene) {
    mats();
    const list = window.RESUME.projects;
    return P.camps.map((c, i) => {
      const color = new T.Color(list[i] ? list[i].color : '#88ff88');
      const y = G.heightAt(c.x, c.z);
      const g = new T.Group();
      g.position.set(c.x, y, c.z);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const s = mesh(GEO.dode, M.rock, Math.cos(a) * 3.4, 0.2, Math.sin(a) * 3.4, g);
        s.scale.setScalar(0.4 + Math.random() * 0.35);
      }
      const bodyMat = std(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.25 });
      const body = mesh(new T.SphereGeometry(1.3, 12, 9), bodyMat, 0, 1.0, 0, g);
      body.scale.y = 0.75;
      const eyeW = new T.MeshBasicMaterial({ color: 0xffffff }), eyeB = new T.MeshBasicMaterial({ color: 0x111111 });
      [-0.45, 0.45].forEach((ex) => {
        const e = new T.Mesh(new T.SphereGeometry(0.26, 8, 6), eyeW);
        e.position.set(ex, 0.35, 1.08);
        body.add(e);
        const p = new T.Mesh(new T.SphereGeometry(0.13, 6, 5), eyeB);
        p.position.set(ex, 0.35, 1.3);
        body.add(p);
      });
      const gl = glow(color, 6, 0.5);
      gl.position.y = 1.5;
      g.add(gl);
      g.rotation.y = Math.atan2(P.jungle.x - c.x, P.jungle.z - c.z + 8);
      scene.add(g);
      const ph = i * 1.7;
      G.anim.push((t) => {
        const k = Math.sin(t * 3 + ph);
        body.scale.set(1 + k * 0.06, 0.75 - k * 0.07, 1 + k * 0.06);
        body.position.y = 1.0 + Math.max(0, Math.sin(t * 1.5 + ph)) * 0.6;
      });
      return { group: g, pos: new T.Vector3(c.x, y, c.z), color };
    });
  }

  /* ---------- руна ---------- */
  function buildRune(scene) {
    mats();
    const g = new T.Group();
    g.position.set(P.rune.x, MAP.water, P.rune.z);
    const ped = mesh(new T.TorusGeometry(2.2, 0.35, 6, 20), M.rock, 0, 0.1, 0, g);
    ped.rotation.x = Math.PI / 2;
    const core = new T.Group();
    core.position.y = 2.6;
    g.add(core);
    const cr = mesh(GEO.oct, M.cyan, 0, 0, 0, core);
    cr.scale.set(0.9, 1.4, 0.9);
    const ring = mesh(new T.TorusGeometry(1.7, 0.08, 6, 36), M.cyan, 0, 0, 0, core);
    const gl = glow(0x60f0ff, 8, 0.8);
    core.add(gl);
    scene.add(g);
    G.anim.push((t) => {
      core.position.y = 2.6 + Math.sin(t * 2) * 0.3;
      cr.rotation.y = t * 1.5;
      ring.rotation.x = t * 1.2;
      ring.rotation.y = t * 0.7;
    });
    ambientPoints(scene, 60, () => new T.Vector3(P.rune.x + (Math.random() - 0.5) * 3, MAP.water + 0.5, P.rune.z + (Math.random() - 0.5) * 3), 0x80f8ff, 0.7, 1, 5);
    return { group: g, pos: new T.Vector3(P.rune.x, MAP.water + 2.6, P.rune.z) };
  }

  /* ---------- босс «Дедлайн» ---------- */
  function buildBoss(scene) {
    mats();
    const baseY = -0.4;
    const g = new T.Group();
    g.position.set(P.boss.x, baseY, P.boss.z);
    g.scale.setScalar(1.3);
    const glass = std(0x8a6cff, { transparent: true, opacity: 0.6, roughness: 0.15, metalness: 0.2, emissive: 0x3a1a90, emissiveIntensity: 0.6 });
    const sand = std(0xffb347, { emissive: 0xaa5500, emissiveIntensity: 0.6 });
    const frame = std(0x2a2230, { metalness: 0.7, roughness: 0.35 });
    const body = new T.Group();
    g.add(body);
    mesh(new T.ConeGeometry(2.6, 3.4, 8), glass, 0, 3.3, 0, body);
    const top = mesh(new T.ConeGeometry(2.6, 3.4, 8), glass, 0, 6.7, 0, body);
    top.rotation.x = Math.PI;
    mesh(new T.ConeGeometry(1.9, 1.5, 8), sand, 0, 2.35, 0, body);
    const sandTop = mesh(new T.ConeGeometry(1.75, 2.0, 8), sand, 0, 7.2, 0, body);
    sandTop.rotation.x = Math.PI;
    mesh(new T.CylinderGeometry(0.12, 0.12, 2.2, 6), sand, 0, 5.0, 0, body);
    mesh(new T.CylinderGeometry(3.0, 3.0, 0.6, 8), frame, 0, 1.3, 0, body);
    mesh(new T.CylinderGeometry(3.0, 3.0, 0.6, 8), frame, 0, 8.7, 0, body);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      mesh(new T.CylinderGeometry(0.22, 0.22, 7.4, 6), frame, Math.cos(a) * 2.8, 5.0, Math.sin(a) * 2.8, body);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new T.ConeGeometry(0.3, 1.6, 5), M.gold, Math.cos(a) * 2.4, 9.8, Math.sin(a) * 2.4, body);
    }
    const eyeMat = new T.MeshBasicMaterial({ color: 0xff3020 });
    [-0.7, 0.7].forEach((ex) => {
      const e = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), eyeMat);
      e.position.set(ex, 7.5, 1.75);
      body.add(e);
      const eg = glow(0xff3020, 2.4, 0.9);
      eg.position.copy(e.position);
      body.add(eg);
    });
    // часы за спиной
    const clock = new T.Group();
    clock.position.set(0, 6, -1.8);
    body.add(clock);
    mesh(new T.TorusGeometry(4.3, 0.2, 6, 48), M.gold, 0, 0, 0, clock);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tk = mesh(new T.BoxGeometry(0.16, i % 3 ? 0.5 : 0.9, 0.16), M.gold, Math.cos(a) * 3.8, Math.sin(a) * 3.8, 0, clock);
      tk.rotation.z = a + Math.PI / 2;
    }
    const handGeo = new T.BoxGeometry(0.16, 3.2, 0.12);
    handGeo.translate(0, 1.6, 0);
    const h1 = mesh(handGeo, M.gold, 0, 0, 0.1, clock);
    const h2 = mesh(handGeo, M.gold, 0, 0, 0.15, clock);
    h2.scale.y = 0.65;
    // кулаки
    const fists = [-1, 1].map((k) => {
      const f = mesh(GEO.ico, M.rockD, k * 4.6, 4.5, 0.8, g);
      f.scale.setScalar(1.35);
      return f;
    });
    const aura = glow(0x9a40ff, 22, 0.55);
    aura.position.y = 5;
    g.add(aura);
    scene.add(g);

    const obj = { group: g, body, alive: true, flash: 0, slam: 0, deathT: -1, glass, pos: new T.Vector3(P.boss.x, baseY + 6, P.boss.z) };
    G.anim.push((t, dt) => {
      if (obj.deathT >= 0) {
        obj.deathT += dt;
        const k = Math.min(1, obj.deathT / 1.4);
        g.scale.setScalar(1.3 * (1 - k * k));
        g.rotation.y += dt * 6;
        g.position.y = baseY - k * 3;
        if (k >= 1) { g.visible = false; obj.deathT = -2; }
        return;
      }
      if (obj.deathT === -2) return;
      body.position.y = Math.sin(t * 1.4) * 0.3;
      h1.rotation.z = -t * 2.2;
      h2.rotation.z = -t * 0.35;
      clock.rotation.z = Math.sin(t * 0.5) * 0.1;
      obj.slam = Math.max(0, obj.slam - dt * 2.2);
      const sl = Math.sin(obj.slam * Math.PI);
      fists.forEach((f, i) => {
        f.position.y = 4.5 + Math.sin(t * 2 + i * 2) * 0.5 + sl * 2.5;
        f.position.z = 0.8 + sl * 3.5;
        f.rotation.x = t * 0.7 + i;
      });
      if (obj.flash > 0) {
        obj.flash = Math.max(0, obj.flash - dt * 4);
        glass.emissiveIntensity = 0.6 + obj.flash * 3;
        body.position.x = (Math.random() - 0.5) * obj.flash * 0.8;
      }
      aura.material.opacity = 0.45 + Math.sin(t * 3) * 0.12;
    });
    obj.face = (x, z) => { g.rotation.y = Math.atan2(x - P.boss.x, z - P.boss.z); };
    obj.hit = () => { obj.flash = 1; };
    obj.attack = () => { obj.slam = 1; };
    obj.die = () => {
      obj.alive = false;
      obj.deathT = 0;
      G.fx.burst(obj.pos, { color: 0xb070ff, count: 240, speed: 20, life: 2, big: true, gravity: -6 });
      G.fx.burst(obj.pos, { color: 0xffb347, count: 260, speed: 26, life: 1.8, gravity: -16 });
    };
    // выпавшая «Зачётка бессмертия»
    obj.dropItem = () => {
      const d = new T.Group();
      d.position.set(P.boss.x, baseY + 2, P.boss.z);
      mesh(new T.BoxGeometry(1.6, 0.35, 2.2), M.gold, 0, 0, 0, d);
      const dg = glow(0xffd060, 8, 0.9);
      d.add(dg);
      d.add(beam(0xffd060, 1, 30, 0.5));
      scene.add(d);
      G.anim.push((t) => { d.rotation.y = t * 1.5; d.position.y = baseY + 2 + Math.sin(t * 2.5) * 0.3; });
    };
    return obj;
  }

  /* ---------- лес ---------- */
  function buildTrees(scene) {
    const trunk = 0x6b4a2e, trunkD = 0x2e2228;
    const geos = [
      merge([
        part(new T.CylinderGeometry(0.3, 0.45, 2.6, 6), trunk, 0, 1.3, 0),
        part(new T.ConeGeometry(2.5, 3.6, 7), 0x2e6a2a, 0, 3.6, 0),
        part(new T.ConeGeometry(1.95, 3.0, 7), 0x3b7d31, 0, 5.4, 0),
        part(new T.ConeGeometry(1.25, 2.4, 7), 0x4f983b, 0, 7.0, 0),
      ]),
      merge([
        part(new T.CylinderGeometry(0.35, 0.5, 3, 6), trunk, 0, 1.5, 0),
        part(new T.IcosahedronGeometry(2.4, 0), 0x5a9a38, 0, 4.4, 0),
        part(new T.IcosahedronGeometry(1.6, 0), 0x74b246, 0.9, 5.7, 0.4),
      ]),
      merge([
        part(new T.CylinderGeometry(0.28, 0.45, 2.6, 5), trunkD, 0, 1.3, 0),
        part(new T.ConeGeometry(2.3, 3.4, 5), 0x3c1a2c, 0, 3.6, 0),
        part(new T.ConeGeometry(1.75, 2.8, 5), 0x4c2032, 0, 5.3, 0),
        part(new T.ConeGeometry(1.05, 2.4, 5), 0x62263a, 0, 6.8, 0),
      ]),
      merge([
        part(new T.CylinderGeometry(0.25, 0.5, 5.5, 5), 0x2a1e22, 0, 2.75, 0),
        part(new T.CylinderGeometry(0.12, 0.22, 2.6, 4), 0x2a1e22, 0.8, 4.2, 0, 0, 0, -0.8),
        part(new T.CylinderGeometry(0.12, 0.2, 2.2, 4), 0x2a1e22, -0.7, 3.6, 0.2, 0.3, 0, 0.9),
        part(new T.OctahedronGeometry(0.8, 0), 0xff5a40, 0, 6.0, 0),
      ]),
    ];
    const lists = [[], [], [], []];
    const avoid = [
      [P.jungle, 24], [P.boss, 19], [P.rune, 16], [P.shop, 10],
      [P.lightFountain, 12], [P.darkFountain, 12],
    ];
    const step = 4.3;
    for (let x = -127; x <= 127; x += step) {
      for (let z = -127; z <= 127; z += step) {
        const px = x + (rand() - 0.5) * 3.4, pz = z + (rand() - 0.5) * 3.4;
        const s = sample(px, pz);
        if (s.plat > 0.01 || s.h < -0.3 || s.rim > 0.05 || s.mount > 0.85) continue;
        if (laneDist(px, pz) < 9.5) continue;
        if (riverDist(px, pz) < 11) continue;
        let skip = false;
        for (const [p, r] of avoid) if (Math.hypot(px - p.x, pz - p.z) < r) { skip = true; break; }
        if (skip || rand() > 0.84) continue;
        const dark = rand() < s.side;
        const type = dark ? (rand() < 0.62 ? 2 : 3) : (rand() < 0.6 ? 0 : 1);
        lists[type].push({ x: px, y: s.h - 0.2, z: pz, sc: 0.8 + rand() * 0.6 + s.mount * 0.5, ry: rand() * 6.28 });
      }
    }
    const mat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = G.timeUniform;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
          float k = max(0.0, position.y - 2.0);
          transformed.x += sin(uTime * 1.3 + ph) * k * 0.035;
          transformed.z += cos(uTime * 1.1 + ph) * k * 0.025;
        #endif`
      );
    };
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(), col = new T.Color();
    G.treePoints = [];
    lists.forEach((list, ti) => {
      if (!list.length) return;
      const im = new T.InstancedMesh(geos[ti], mat, list.length);
      list.forEach((t, i) => {
        e.set(0, t.ry, 0);
        q.setFromEuler(e);
        v.set(t.x, t.y, t.z);
        sc.set(t.sc, t.sc * (0.9 + rand() * 0.3), t.sc);
        m4.compose(v, q, sc);
        im.setMatrixAt(i, m4);
        const k = 0.82 + rand() * 0.3;
        im.setColorAt(i, col.setRGB(k, k, k));
        G.treePoints.push(t.x, t.z, ti >= 2 ? 1 : 0);
      });
      im.frustumCulled = false;
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
    });
  }

  function buildRocks(scene) {
    const list = [];
    for (let i = 0; i < 900 && list.length < 260; i++) {
      const x = (rand() - 0.5) * 250, z = (rand() - 0.5) * 250;
      const s = sample(x, z);
      if (s.plat > 0.05 || laneDist(x, z) < 7) continue;
      const nearRiver = riverDist(x, z) < 12 && riverDist(x, z) > 6;
      if (!(nearRiver || s.mount > 0.3 || s.rim > 0.3)) continue;
      list.push({ x, y: s.h, z, s: 0.6 + rand() * (s.mount > 0.3 ? 4 : 1.6), side: s.side });
    }
    const im = new T.InstancedMesh(GEO.dode, std(0xffffff, { roughness: 1 }), list.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(), c = new T.Color();
    list.forEach((r, i) => {
      e.set(rand() * 3, rand() * 3, rand() * 3);
      q.setFromEuler(e);
      v.set(r.x, r.y, r.z);
      sc.set(r.s, r.s * 0.6, r.s * (0.8 + rand() * 0.4));
      m4.compose(v, q, sc);
      im.setMatrixAt(i, m4);
      c.copy(COL.rockL).lerp(COL.rockD, r.side);
      im.setColorAt(i, c);
    });
    im.frustumCulled = false;
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  }

  /* ---------- атмосферные частицы ---------- */
  const ambVS = `attribute float aSeed; uniform float uTime; uniform float uSize; uniform float uRise; uniform float uH; uniform float uScale;
    varying float vA;
    void main(){
      vec3 p = position;
      float t = uTime * (0.25 + fract(aSeed * 7.3) * 0.5) + aSeed * 20.0;
      if (uRise > 0.5) {
        float r = mod(uTime * (0.8 + fract(aSeed * 3.1) * 1.4) + aSeed * 30.0, uH);
        p.y += r; p.x += sin(t) * 0.8; p.z += cos(t * 0.8) * 0.8;
        vA = 1.0 - r / uH;
      } else {
        p.x += sin(t) * 2.5; p.y += sin(t * 1.7) * 0.9; p.z += cos(t * 1.3) * 2.5;
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.5 + aSeed * 50.0));
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (uScale / max(0.5, -mv.z));
      gl_Position = projectionMatrix * mv;
    }`;
  const ambFS = `uniform vec3 uColor; uniform sampler2D uMap; varying float vA;
    void main(){ vec4 tx = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, tx.a * vA); }`;

  function ambientPoints(scene, count, gen, color, size, rise, h) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) { const p = gen(); pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; seed[i] = Math.random(); }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    const mat = new T.ShaderMaterial({
      uniforms: {
        uTime: G.timeUniform, uScale: G.pointScale, uColor: { value: new T.Color(color) }, uSize: { value: size },
        uRise: { value: rise ? 1 : 0 }, uH: { value: h || 14 }, uMap: { value: glowTex },
      },
      vertexShader: ambVS, fragmentShader: ambFS, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  }
  G.ambientPoints = ambientPoints;

  function buildAmbient(scene) {
    // светлячки на светлой стороне
    ambientPoints(scene, 420, () => {
      let x, z;
      do { x = (Math.random() - 0.5) * 220; z = (Math.random() - 0.5) * 220; } while (x - z > -10);
      return new T.Vector3(x, G.heightAt(x, z) + 1 + Math.random() * 4, z);
    }, 0xd8ff70, 0.55, 0);
    // угольки на тёмной стороне
    ambientPoints(scene, 520, () => {
      let x, z;
      do { x = (Math.random() - 0.5) * 220; z = (Math.random() - 0.5) * 220; } while (x - z < 10);
      return new T.Vector3(x, G.heightAt(x, z), z);
    }, 0xff6a30, 0.6, 1, 16);
  }

  function buildClouds(scene) {
    G.cloudMat = [];
    for (let i = 0; i < 34; i++) {
      const m = new T.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false, color: i % 3 ? 0xfff2e0 : 0xffd8c0 });
      const s = new T.Sprite(m);
      const sz = 50 + Math.random() * 50;
      s.scale.set(sz, sz * 0.6, 1);
      s.position.set((Math.random() - 0.5) * 260, 70 + Math.random() * 80, (Math.random() - 0.5) * 260);
      scene.add(s);
      G.cloudMat.push(m);
      const sp = 1 + Math.random() * 2;
      G.anim.push((t, dt) => { s.position.x += dt * sp; if (s.position.x > 150) s.position.x = -150; });
    }
  }

  /* ---------- частицы-вспышки (удары, смерти, взрывы) ---------- */
  function buildFx(scene) {
    function system(max, size) {
      const geo = new T.BufferGeometry();
      const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
      geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      geo.setAttribute('color', new T.BufferAttribute(col, 3).setUsage(T.DynamicDrawUsage));
      geo.setDrawRange(0, 0);
      const mat = new T.PointsMaterial({ size, map: glowTex, vertexColors: true, blending: T.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: true, fog: false });
      const pts = new T.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      return { geo, pos, col, max, list: [] };
    }
    const small = system(2500, 0.7), big = system(800, 3.2);
    const c = new T.Color();
    function burst(p, o = {}) {
      const sys = o.big ? big : small;
      c.set(o.color || 0xffffff);
      const n = o.count || 30, sp = o.speed || 8, life = o.life || 0.9;
      for (let i = 0; i < n && sys.list.length < sys.max; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), v = sp * (0.3 + Math.random() * 0.7);
        sys.list.push({
          x: p.x, y: p.y, z: p.z,
          vx: Math.sin(ph) * Math.cos(th) * v, vy: Math.abs(Math.cos(ph)) * v * (o.up || 1), vz: Math.sin(ph) * Math.sin(th) * v,
          life: life * (0.5 + Math.random() * 0.5), max: life, r: c.r, g: c.g, b: c.b, gr: o.gravity == null ? -12 : o.gravity,
        });
      }
    }
    function step(sys, dt) {
      const L = sys.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const q = L[i];
        q.life -= dt;
        if (q.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
        q.vy += q.gr * dt;
        q.vx *= 0.985; q.vz *= 0.985;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      }
      for (let i = 0; i < L.length; i++) {
        const q = L[i], k = q.life / q.max;
        sys.pos[i * 3] = q.x; sys.pos[i * 3 + 1] = q.y; sys.pos[i * 3 + 2] = q.z;
        sys.col[i * 3] = q.r * k; sys.col[i * 3 + 1] = q.g * k; sys.col[i * 3 + 2] = q.b * k;
      }
      sys.geo.setDrawRange(0, L.length);
      sys.geo.attributes.position.needsUpdate = true;
      sys.geo.attributes.color.needsUpdate = true;
    }
    return { burst, update(dt) { step(small, dt); step(big, dt); } };
  }

  /* ---------- подложка миникарты ---------- */
  function buildMinimapBase() {
    const N = 220;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const col = new T.Color();
    const half = MAP.size / 2;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i / N) * MAP.size - half, z = (j / N) * MAP.size - half;
        const s = sample(x, z);
        groundColor(x, z, s, col);
        if (s.h < MAP.water) {
          const sd = s.side;
          col.setRGB(0.12 + sd * 0.25, 0.42 - sd * 0.32, 0.46 - sd * 0.32);
        }
        const k = (j * N + i) * 4;
        img.data[k] = Math.min(255, col.r * 290);
        img.data[k + 1] = Math.min(255, col.g * 290);
        img.data[k + 2] = Math.min(255, col.b * 290);
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // деревья
    const tp = G.treePoints || [];
    for (let i = 0; i < tp.length; i += 3) {
      g.fillStyle = tp[i + 2] ? 'rgba(30,10,20,.55)' : 'rgba(10,40,10,.5)';
      const px = ((tp[i] + half) / MAP.size) * N, py = ((tp[i + 1] + half) / MAP.size) * N;
      g.fillRect(px - 1, py - 1, 2.2, 2.2);
    }
    G.minimapBase = c;
  }
})();
