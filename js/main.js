/* =====================================================================
   ЗАПУСК: рендерер, сцена, главный цикл
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const T = THREE;
  const canvas = document.getElementById('scene');

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    noWebGL();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 2600);
  G.renderer = renderer;
  G.camera = camera;
  G.time = 0;

  G.buildWorld(scene);
  G.creeps.init(scene);
  G.tour.init();
  G.ui.init();

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    G.pointScale.value = h * renderer.getPixelRatio() * 0.5;
  }
  resize();
  window.addEventListener('resize', resize);

  // если тормозит — снижаем разрешение
  let fpsAcc = 0, fpsN = 0, fpsChecked = 0;
  function adapt(dt) {
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc < 3) return;
    const fps = fpsN / fpsAcc;
    fpsAcc = 0;
    fpsN = 0;
    if (fps < 32 && renderer.getPixelRatio() > 1 && fpsChecked < 3) {
      fpsChecked++;
      renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5));
      resize();
    }
  }

  const clock = new T.Clock();
  const fwd = new T.Vector3();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    G.time += dt;
    const t = G.time;
    G.tour.update(dt, t);
    G.creeps.update(dt, t);
    G.updateWorld(t, dt, camera.position);
    camera.getWorldDirection(fwd);
    const ahead = Math.min(40, Math.max(15, camera.position.y));
    G.updateSun(camera.position.x + fwd.x * ahead, camera.position.z + fwd.z * ahead);
    G.ui.update(dt, t);
    renderer.render(scene, camera);
    adapt(dt);
  }
  loop();

  function noWebGL() {
    const m = document.getElementById('menu');
    m.style.overflowY = 'auto';
    m.style.alignItems = 'flex-start';
    m.querySelector('.menu-inner').innerHTML =
      '<h1 class="logo">ANENZIK</h1><p class="menu-sub">Браузер не поддерживает 3D — вот резюме без карты</p>' +
      '<div class="board frame" style="text-align:left;max-height:none">' + G.ui.boardHTML() + '</div>';
  }
})();
