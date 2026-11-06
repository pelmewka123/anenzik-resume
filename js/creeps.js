/* =====================================================================
   КРИПЫ: волны бегут по линиям, дерутся, вышки по ним стреляют
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const T = THREE;
  const CAP = 170;
  const SPEED = 4.4;
  const WAVE_EVERY = 26;
  const LANES = ['top', 'mid', 'bot'];

  const C = (G.creeps = { list: [], active: false, lastWave: 0 });
  let sides, shots = [], pools;

  function creepGeo(side) {
    const p = G.part;
    if (!side) {
      return G.merge([
        p(new T.BoxGeometry(0.55, 0.55, 0.4), 0x3a2e22, 0, 0.28, 0),
        p(new T.CylinderGeometry(0.42, 0.55, 1.0, 6), 0x3d7a2e, 0, 0.98, 0),
        p(new T.BoxGeometry(0.72, 0.5, 0.25), 0xd9a540, 0, 1.08, 0.3),
        p(new T.SphereGeometry(0.32, 8, 6), 0xe3b48a, 0, 1.72, 0),
        p(new T.ConeGeometry(0.37, 0.5, 6), 0xd9a540, 0, 2.02, 0),
        p(new T.CylinderGeometry(0.42, 0.42, 0.1, 10), 0x8a5a2a, -0.56, 1.05, 0.1, 0, 0, Math.PI / 2),
        p(new T.BoxGeometry(0.08, 0.95, 0.16), 0xdfe4ea, 0.56, 1.35, 0.25, 0.5, 0, 0),
      ]);
    }
    return G.merge([
      p(new T.BoxGeometry(0.55, 0.55, 0.4), 0x1c1014, 0, 0.28, 0),
      p(new T.CylinderGeometry(0.46, 0.62, 1.0, 5), 0x5e1a22, 0, 0.98, 0),
      p(new T.IcosahedronGeometry(0.38, 0), 0x3a1a1e, 0, 1.7, 0),
      p(new T.ConeGeometry(0.1, 0.5, 4), 0xe4d4a8, -0.24, 2.05, 0, 0, 0, 0.4),
      p(new T.ConeGeometry(0.1, 0.5, 4), 0xe4d4a8, 0.24, 2.05, 0, 0, 0, -0.4),
      p(new T.BoxGeometry(0.34, 0.07, 0.05), 0xff5a20, 0, 1.74, 0.34),
      p(new T.BoxGeometry(0.1, 0.85, 0.34), 0x2a2a2e, 0.58, 1.3, 0.2, 0.5, 0, 0),
    ]);
  }

  C.init = function (scene) {
    const mat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    sides = [0, 1].map((side) => {
      const im = new T.InstancedMesh(creepGeo(side), mat, CAP);
      im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      for (let i = 0; i < CAP; i++) im.setMatrixAt(i, zero);
      im.frustumCulled = false;
      im.castShadow = true;
      im.userData.side = side;
      scene.add(im);
      const free = [];
      for (let i = CAP - 1; i >= 0; i--) free.push(i);
      return { im, free, byIdx: new Array(CAP) };
    });
    // снаряды вышек
    pools = [0, 1].map((side) => {
      const arr = [];
      for (let i = 0; i < 30; i++) {
        const s = G.glow(side ? 0xff5030 : 0xffd060, 2.6, 1);
        s.visible = false;
        scene.add(s);
        arr.push(s);
      }
      return arr;
    });
    // стартовые волны, чтобы карта сразу жила
    wave(0.36);
    wave(0.16);
  };

  function spawn(side, lane, s, lat) {
    const S = sides[side];
    if (!S.free.length) return null;
    const idx = S.free.pop();
    const c = { side, lane, s, lat, hp: 100, idx, ph: Math.random() * 6, atk: Math.random() * 0.8, alive: true, fight: false, age: 0, x: 0, y: 0, z: 0, dx: 0, dz: 1 };
    S.byIdx[idx] = c;
    C.list.push(c);
    return c;
  }
  function wave(frac) {
    LANES.forEach((lane) => {
      const L = G.laneData[lane].len;
      for (let i = 0; i < 4; i++) {
        const lat = [-1.35, 1.35, -0.45, 0.45][i];
        const back = Math.floor(i / 2) * 1.8 + Math.random() * 0.4;
        spawn(0, lane, (frac ? frac * L : 0) - back, lat);
        spawn(1, lane, (frac ? (1 - frac) * L : L) + back, -lat);
      }
    });
  }

  function kill(c, by) {
    if (!c.alive) return;
    c.alive = false;
    const S = sides[c.side];
    S.im.setMatrixAt(c.idx, new T.Matrix4().makeScale(0, 0, 0));
    S.byIdx[c.idx] = null;
    S.free.push(c.idx);
    G.fx.burst(new T.Vector3(c.x, c.y + 1.1, c.z), { color: c.side ? 0xff4a30 : 0xffd060, count: 26, speed: 6, life: 0.8 });
    if (by === 'player' && G.ui && G.ui.onCreepKilled) G.ui.onCreepKilled(c);
  }
  C.kill = kill;

  function nearestEnemy(c) {
    let best = null, bd = 1e9;
    for (const e of C.list) {
      if (!e.alive || e.side === c.side || e.lane !== c.lane) continue;
      const d = Math.abs(e.s - c.s);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  const m4 = new T.Matrix4(), q = new T.Quaternion(), e3 = new T.Euler(), v3 = new T.Vector3(), sc = new T.Vector3(), tmp = new T.Vector3();

  C.update = function (dt, t) {
    if (!sides) return;
    if (C.active && t - C.lastWave > WAVE_EVERY) { C.lastWave = t; wave(0); }

    const front = {};
    LANES.forEach((l) => (front[l] = [-1e9, 1e9]));
    for (const c of C.list) {
      if (!c.alive) continue;
      const f = front[c.lane];
      if (c.side === 0) f[0] = Math.max(f[0], c.s); else f[1] = Math.min(f[1], c.s);
    }

    for (const c of C.list) {
      if (!c.alive) continue;
      c.age += dt;
      const dir = c.side ? -1 : 1;
      const f = front[c.lane];
      const gap = ((c.side ? f[0] : f[1]) - c.s) * dir;
      const stopAt = 2.3;
      c.fight = false;
      if (gap < stopAt) c.fight = 'creep';
      else {
        for (const tw of G.towers) {
          if (tw.side === c.side || tw.lane !== c.lane) continue;
          if (Math.hypot(tw.x - c.x, tw.z - c.z) < 9) { c.fight = 'tower'; break; }
        }
      }
      if (!c.fight) {
        // не налезать на своих
        let blocked = false;
        for (const o of C.list) {
          if (o === c || !o.alive || o.side !== c.side || o.lane !== c.lane || Math.abs(o.lat - c.lat) > 0.3) continue;
          const ahead = (o.s - c.s) * dir;
          if (ahead > 0 && ahead < 1.6 && o.fight) { blocked = true; break; }
        }
        if (!blocked) c.s += SPEED * dir * dt;
      }
      if (c.fight === 'creep') {
        c.atk -= dt;
        if (c.atk <= 0) {
          c.atk = 0.9 + Math.random() * 0.5;
          const en = nearestEnemy(c);
          if (en && Math.abs(en.s - c.s) < stopAt + 2) {
            en.hp -= 8 + Math.random() * 7;
            if (en.hp <= 0) kill(en, 'creep');
          }
        }
      }
      const p = G.lanePoint(c.lane, c.s);
      c.dx = p.dx * dir;
      c.dz = p.dz * dir;
      c.x = p.x - p.dz * c.lat;
      c.z = p.z + p.dx * c.lat;
      c.y = G.heightAt(c.x, c.z);
    }

    // вышки стреляют
    for (const tw of G.towers) {
      tw.cd -= dt;
      if (tw.cd > 0) continue;
      let best = null, bd = 15 * 15;
      for (const c of C.list) {
        if (!c.alive || c.side === tw.side) continue;
        const dx = c.x - tw.x, dz = c.z - tw.z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = c; }
      }
      if (best) { tw.cd = 1.25; shoot(tw, best); } else tw.cd = 0.35;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const c = s.target;
      tmp.set(c.x, c.y + 1.1, c.z);
      const d = s.sprite.position.distanceTo(tmp);
      const stepLen = 34 * dt;
      if (!c.alive || d <= stepLen) {
        if (c.alive) {
          c.hp -= 34;
          G.fx.burst(tmp, { color: s.side ? 0xff6a40 : 0xffe080, count: 8, speed: 4, life: 0.4 });
          if (c.hp <= 0) kill(c, 'tower');
        }
        s.sprite.visible = false;
        pools[s.side].push(s.sprite);
        shots.splice(i, 1);
      } else {
        s.sprite.position.add(tmp.sub(s.sprite.position).multiplyScalar(stepLen / d));
      }
    }

    // матрицы
    for (const c of C.list) {
      if (!c.alive) continue;
      const S = sides[c.side];
      const bob = c.fight ? 0 : Math.abs(Math.sin(t * 9 + c.ph)) * 0.16;
      const lunge = c.fight ? Math.max(0, Math.sin(t * 7 + c.ph)) * 0.35 : 0;
      const yaw = Math.atan2(c.dx, c.dz);
      e3.set(0, yaw, c.fight ? lunge * 0.25 : Math.sin(t * 9 + c.ph) * 0.06);
      q.setFromEuler(e3);
      v3.set(c.x + c.dx * lunge, c.y + bob, c.z + c.dz * lunge);
      const k = Math.min(1, c.age * 3);
      sc.set(k, k, k);
      m4.compose(v3, q, sc);
      S.im.setMatrixAt(c.idx, m4);
    }
    sides[0].im.instanceMatrix.needsUpdate = true;
    sides[1].im.instanceMatrix.needsUpdate = true;

    if (C.list.length > 40 && Math.random() < 0.05) C.list = C.list.filter((c) => c.alive);
  };

  function shoot(tw, c) {
    const pool = pools[tw.side];
    if (!pool.length) return;
    const sp = pool.pop();
    sp.visible = true;
    tw.crystal.getWorldPosition(sp.position);
    shots.push({ sprite: sp, target: c, side: tw.side });
    if (G.camera && G.audio && sp.position.distanceTo(G.camera.position) < 40) G.audio.play('zap');
  }

  // клик по крипу
  C.pick = function (raycaster) {
    if (!sides) return null;
    const hits = raycaster.intersectObjects([sides[0].im, sides[1].im], false);
    for (const h of hits) {
      const side = h.object.userData.side;
      const c = sides[side].byIdx[h.instanceId];
      if (c && c.alive) return c;
    }
    return null;
  };
})();
