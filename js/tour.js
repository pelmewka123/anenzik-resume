/* =====================================================================
   КАМЕРА: меню-облёт, «нырок» в карту и экскурсия от первого лица
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const T = THREE;
  const { clamp, lerp, smooth } = G.util;
  const UP = new T.Vector3(0, 1, 0), XAX = new T.Vector3(1, 0, 0);
  const EYE = 2.8;

  const tour = (G.tour = { mode: 'menu', idx: -1, stops: [] });
  const _m = new T.Matrix4();
  const lookQuat = (from, to, out) => { _m.lookAt(from, to, UP); return out.setFromRotationMatrix(_m); };
  const eyeAt = (x, z) => new T.Vector3(x, G.groundAt(x, z) + EYE, z);
  const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  const rig = {
    pos: new T.Vector3(), q: new T.Quaternion(),
    t: 0, dur: 1, path: null, qStart: new T.Quaternion(), qEnd: new T.Quaternion(), target: null,
    dragYaw: 0, dragPitch: 0, mx: 0, my: 0, smx: 0, smy: 0, shake: 0, fov: 60, panelYaw: 0,
  };
  let cam, diveT = 0, dive = null, onDiveDone = null, onDivePhase = null;

  tour.init = function () {
    cam = G.camera;
    const P = G.POS;
    function towerStop(side, lane, tier) {
      const tw = G.findTower(side, lane, tier);
      const p = G.lanePoint(lane, tw.sLane + (side ? 18 : -18));
      const c = eyeAt(p.x + p.dz * 1.5, p.z - p.dx * 1.5);
      return { cam: c, look: new T.Vector3(tw.x, tw.top.y - 5, tw.z), anchor: new T.Vector3(tw.x, tw.top.y + 4.5, tw.z) };
    }
    const shopDir = new T.Vector2(P.lightBase.x - P.shop.x, P.lightBase.z - P.shop.z).normalize();
    const S = [
      {
        id: 'base', name: 'База Светлых', icon: '⛲', label: 'Герой',
        cam: eyeAt(P.lightFountain.x + 10, P.lightFountain.z - 8),
        look: new T.Vector3(P.lightThrone.x, 12, P.lightThrone.z),
        anchor: new T.Vector3(P.lightThrone.x, 27, P.lightThrone.z),
      },
      {
        id: 'shop', name: 'Лавка навыков', icon: '🛒', label: 'Лавка навыков',
        cam: eyeAt(P.shop.x + shopDir.x * 21, P.shop.z + shopDir.y * 21),
        look: new T.Vector3(P.shop.x, 6, P.shop.z),
        anchor: new T.Vector3(P.shop.x, 15, P.shop.z),
      },
      Object.assign({ id: 'edu', name: 'Башня знаний', icon: '🎓', label: 'Образование' }, towerStop(0, 'mid', 1)),
      Object.assign({ id: 'exp', name: 'Башня опыта', icon: '💼', label: 'Опыт' }, towerStop(0, 'top', 1)),
      {
        id: 'hobby', name: 'Руна хобби', icon: '💠', label: 'Хобби',
        cam: eyeAt(P.rune.x - 8, P.rune.z + 8),
        look: new T.Vector3(P.rune.x, G.MAP.water + 2.4, P.rune.z),
        anchor: new T.Vector3(P.rune.x, G.MAP.water + 6.5, P.rune.z),
      },
      {
        id: 'projects', name: 'Лес проектов', icon: '🌲', label: 'Проекты',
        cam: eyeAt(P.jungle.x - 15, P.jungle.z + 15),
        look: new T.Vector3(P.jungle.x, 1.5, P.jungle.z - 2),
        anchor: new T.Vector3(P.jungle.x, 9, P.jungle.z),
      },
      {
        id: 'boss', name: 'Логово Дедлайна', icon: '⏳', label: 'Босс',
        cam: eyeAt(P.boss.x - 15, P.boss.z + 13),
        look: new T.Vector3(P.boss.x, 6, P.boss.z),
        anchor: new T.Vector3(P.boss.x, 17, P.boss.z),
      },
      {
        id: 'final', name: 'Трон Безработицы', icon: '🏰', label: 'Финал',
        cam: eyeAt(P.darkThrone.x - 21, P.darkThrone.z + 21),
        look: new T.Vector3(P.darkThrone.x, 12, P.darkThrone.z),
        anchor: new T.Vector3(P.darkThrone.x, 28, P.darkThrone.z),
      },
    ];
    tour.stops = S;
    G.boss.face(S[6].cam.x, S[6].cam.z);
    rig.pos.set(0, 120, 170);
    lookQuat(rig.pos, new T.Vector3(0, 0, 0), rig.q);
  };

  /* ---------- нырок ---------- */
  tour.startDive = function (done, phase) {
    tour.mode = 'dive';
    diveT = 0;
    onDiveDone = done;
    onDivePhase = phase;
    const st = tour.stops[0];
    const top = new T.Vector3(0, 290, 40);
    dive = {
      p0: rig.pos.clone(), q0: rig.q.clone(), top, qTop: lookQuat(top, new T.Vector3(0, 0, 0), new T.Quaternion()), phase: 0,
      curve: new T.CatmullRomCurve3([top, new T.Vector3(-25, 190, 45), new T.Vector3(-58, 92, 76), new T.Vector3(-86, 30, 96), st.cam.clone()], false, 'centripetal'),
      look: new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(-35, 0, 45), new T.Vector3(-62, 0, 66), new T.Vector3(-70, 6, 70), st.look.clone()], false, 'centripetal'),
    };
  };

  /* ---------- перемещение ---------- */
  function beginTravel(toPos, lookAt, idx) {
    const from = cam.position.clone();
    const d = from.distanceTo(toPos);
    rig.qStart.copy(cam.quaternion);
    lookQuat(toPos, lookAt, rig.qEnd);
    rig.dragYaw = 0;
    rig.dragPitch = 0;
    if (d < 0.5) {
      rig.path = null;
    } else {
      const midH = Math.max(from.y, toPos.y) + Math.min(30, 3 + d * 0.2);
      const q1 = from.clone().lerp(toPos, 0.22); q1.y = lerp(from.y, midH, 0.75);
      const mid = from.clone().lerp(toPos, 0.5); mid.y = midH;
      const q2 = from.clone().lerp(toPos, 0.78); q2.y = lerp(toPos.y, midH, 0.75);
      rig.path = new T.CatmullRomCurve3([from, q1, mid, q2, toPos.clone()], false, 'centripetal');
    }
    rig.dur = clamp(d / 36, 1.1, 4.2);
    rig.t = 0;
    rig.target = toPos.clone();
    rig.lookAt = lookAt.clone();
    tour.mode = 'travel';
    tour.idx = idx;
    if (G.audio) G.audio.play(d > 40 ? 'whoosh' : 'whooshShort');
  }
  tour.go = function (i) {
    const st = tour.stops[i];
    if (!st || tour.mode === 'dive' || tour.mode === 'menu') return;
    beginTravel(st.cam, st.look, i);
    if (G.ui) G.ui.onDepart(i);
  };
  tour.goPoint = function (x, z) {
    if (tour.mode === 'dive' || tour.mode === 'menu') return;
    x = clamp(x, -104, 104);
    z = clamp(z, -104, 104);
    const to = eyeAt(x, z);
    const dir = new T.Vector3(x - cam.position.x, 0, z - cam.position.z);
    if (dir.lengthSq() < 1) dir.set(1, 0, -1);
    dir.normalize();
    const look = to.clone().addScaledVector(dir, 20);
    look.y = to.y - 1;
    beginTravel(to, look, -1);
    if (G.ui) G.ui.onDepart(-1);
  };

  /* ---------- ввод ---------- */
  tour.drag = function (dx, dy) {
    rig.dragYaw -= dx * 0.0042;
    rig.dragPitch = clamp(rig.dragPitch - dy * 0.0032, -0.75, 0.6);
  };
  tour.mouse = function (nx, ny) { rig.mx = nx; rig.my = ny; };
  tour.shake = function (v) { rig.shake = Math.max(rig.shake, v); };
  tour.setPanelYaw = function (v) { rig.panelYaw = v; };

  /* ---------- кадр ---------- */
  const qA = new T.Quaternion(), qB = new T.Quaternion(), qYaw = new T.Quaternion(), qPitch = new T.Quaternion();
  const tmpV = new T.Vector3(), look = new T.Vector3();

  tour.update = function (dt, t) {
    rig.smx += (rig.mx - rig.smx) * Math.min(1, dt * 3);
    rig.smy += (rig.my - rig.smy) * Math.min(1, dt * 3);
    let fov = 62;
    let useOffsets = false;

    if (tour.mode === 'menu') {
      const a = t * 0.05;
      rig.pos.set(Math.sin(a) * 175, 115, Math.cos(a) * 175);
      lookQuat(rig.pos, look.set(0, -5, 0), rig.q);
      fov = 55;
    } else if (tour.mode === 'dive') {
      diveT += dt;
      const D = dive;
      if (diveT < 2.3) {
        const k = easeIO(diveT / 2.3);
        rig.pos.copy(D.p0).lerp(D.top, k);
        rig.q.copy(D.q0).slerp(D.qTop, k);
        fov = 55;
      } else if (diveT < 3.0) {
        if (D.phase === 0) { D.phase = 1; if (onDivePhase) onDivePhase('top'); }
        rig.pos.copy(D.top);
        rig.q.copy(D.qTop);
        fov = 55 - smooth(2.3, 3.0, diveT) * 4;
      } else {
        if (D.phase === 1) { D.phase = 2; if (onDivePhase) onDivePhase('dive'); }
        const u = Math.min(1, (diveT - 3.0) / 5.4);
        const k = easeIO(u);
        D.curve.getPoint(k, rig.pos);
        D.look.getPoint(k, look);
        lookQuat(rig.pos, look, rig.q);
        fov = 51 + Math.sin(k * Math.PI) * 26 + k * 11;
        if (u >= 1) {
          tour.mode = 'idle';
          tour.idx = 0;
          rig.target = rig.pos.clone();
          rig.lookAt = look.clone();
          if (onDiveDone) onDiveDone();
        }
      }
    } else if (tour.mode === 'travel') {
      rig.t += dt / rig.dur;
      const u = Math.min(1, rig.t);
      const k = easeIO(u);
      if (rig.path) {
        rig.path.getPoint(k, rig.pos);
        rig.path.getPoint(Math.min(1, k + 0.04), tmpV);
        tmpV.sub(rig.pos);
        tmpV.y *= 0.25;
        if (tmpV.lengthSq() < 1e-4) tmpV.set(0, 0, -1);
        lookQuat(rig.pos, look.copy(rig.pos).add(tmpV.normalize()).add(new T.Vector3(0, -0.12, 0)), qB);
        qA.copy(rig.qStart).slerp(qB, smooth(0, 0.3, u));
        rig.q.copy(qA).slerp(rig.qEnd, smooth(0.55, 1, u));
        fov = 62 + Math.sin(u * Math.PI) * 10;
      } else {
        rig.q.copy(rig.qStart).slerp(rig.qEnd, smooth(0, 1, u));
      }
      if (u >= 1) {
        tour.mode = 'idle';
        rig.pos.copy(rig.target);
        rig.q.copy(rig.qEnd);
        if (G.ui) G.ui.onArrive(tour.idx);
      }
      useOffsets = u > 0.8;
    } else if (tour.mode === 'idle') {
      useOffsets = true;
    }

    // итоговая камера
    cam.position.copy(rig.pos);
    if (tour.mode === 'idle') cam.position.y += Math.sin(t * 1.6) * 0.06;
    if (rig.shake > 0) {
      rig.shake = Math.max(0, rig.shake - dt * 2.5);
      cam.position.x += (Math.random() - 0.5) * rig.shake;
      cam.position.y += (Math.random() - 0.5) * rig.shake;
    }
    cam.quaternion.copy(rig.q);
    if (useOffsets) {
      const yaw = rig.dragYaw - rig.smx * 0.05 + rig.panelYaw;
      const pitch = clamp(rig.dragPitch - rig.smy * 0.03, -0.8, 0.7);
      qYaw.setFromAxisAngle(UP, yaw);
      qPitch.setFromAxisAngle(XAX, pitch);
      cam.quaternion.premultiply(qYaw).multiply(qPitch);
    }
    rig.fov += (fov - rig.fov) * Math.min(1, dt * 4);
    if (Math.abs(cam.fov - rig.fov) > 0.01) {
      cam.fov = rig.fov;
      cam.updateProjectionMatrix();
    }
  };

  // плавное смещение для панели — без рывка
  let panelYawTarget = 0;
  tour.panelShift = function (on) { panelYawTarget = on ? -0.14 : 0; };
  const _upd = tour.update;
  tour.update = function (dt, t) {
    rig.panelYaw += (panelYawTarget - rig.panelYaw) * Math.min(1, dt * 2.5);
    _upd(dt, t);
  };
})();
