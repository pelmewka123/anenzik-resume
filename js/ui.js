/* =====================================================================
   ИНТЕРФЕЙС: меню, HUD, панели резюме, лавка, бой с боссом, ачивки
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, R = window.RESUME, A = G.audio, T = THREE;
  const $ = (s) => document.querySelector(s);
  const ui = (G.ui = {});

  const COST = { Q: 10, W: 0, E: 20, R: 50 };
  const st = (ui.state = {
    started: false, gameStart: 0, gold: 3500, hp: 100, mp: 100, lastHits: 0,
    bought: [], ach: new Set(), cds: { Q: 0, W: 0, E: 0, R: 0 }, score: [0, 0],
    boss: null, bossDone: false, thrHits: 0, thrDone: false, visited: new Set(),
    nextChat: 4, chatI: 0, nextFeed: 9, feedI: 0, basicCd: 0, hired: false,
  });

  const ACH = [
    ['accept', '⚔️', 'Игра найдена', 'Принял матч и открыл резюме'],
    ['decline', '🙅', 'Упрямый', 'Пытался отклонить матч'],
    ['firstblood', '🩸', 'Первая кровь', 'Первый ластхит по крипу'],
    ['farmer', '🌾', 'Фармила', '10 ластхитов'],
    ['deny', '🚫', 'Денай!', 'Добил своего же крипа'],
    ['shopper', '🛒', 'Шопоголик', 'Купил все навыки в лавке'],
    ['ult', '☠️', 'Старый бог', 'Использовал ультимейт'],
    ['deadline', '⏳', 'Убийца дедлайнов', 'Победил босса «Дедлайн»'],
    ['explorer', '🗺️', 'Картограф', 'Побывал во всех точках карты'],
    ['gg', '🏆', 'GG WP', 'Разрушил Трон Безработицы'],
    ['hire', '🤝', 'Лучший работодатель', 'Нажал «Нанять»'],
    ['konami', '🎮', 'Читер', 'Ввёл секретный код'],
  ];

  /* ---------- мелкие помощники ---------- */
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const _v = new T.Vector3();
  function toScreen(p) {
    _v.copy(p).project(G.camera);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight };
  }
  function num(text, world, cls, color, jitter = 30) {
    const s = world ? toScreen(world) : { x: innerWidth / 2, y: innerHeight * 0.55 };
    if (!s) return;
    const e = document.createElement('div');
    e.className = 'num ' + (cls || '');
    e.textContent = text;
    e.style.left = s.x + (Math.random() - 0.5) * jitter + 'px';
    e.style.top = s.y + (Math.random() - 0.5) * jitter + 'px';
    e.style.color = color || '#fff';
    $('#fx').appendChild(e);
    setTimeout(() => e.remove(), 1000);
  }
  ui.num = num;
  let bannerTimer;
  function banner(main, sub, cls) {
    const b = $('#banner');
    b.className = '';
    b.querySelector('.banner-main').textContent = main;
    b.querySelector('.banner-sub').textContent = sub || '';
    void b.offsetWidth;
    b.className = 'show ' + (cls || '');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (b.className = ''), 2900);
  }
  ui.banner = banner;
  let hintTimer;
  function hint(text, ms = 3200) {
    const h = $('#hint');
    h.textContent = text;
    h.classList.remove('hidden');
    h.style.animation = 'none';
    void h.offsetWidth;
    h.style.animation = '';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => h.classList.add('hidden'), ms);
  }
  function flash(red, strength = 0.6) {
    const f = $('#flash');
    f.className = red ? 'red' : '';
    f.style.transition = 'none';
    f.style.opacity = strength;
    void f.offsetWidth;
    f.style.transition = 'opacity .5s';
    f.style.opacity = 0;
  }
  function confetti(n = 140) {
    const colors = ['#ffe7a3', '#e8b04a', '#7bd86a', '#ff5a4a', '#58a6ff', '#ff4fa3', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2 + Math.random() * 2.5 + 's';
      c.style.animationDelay = Math.random() * 0.6 + 's';
      c.style.borderRadius = Math.random() < 0.4 ? '50%' : '2px';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5500);
    }
  }
  function forward(dist) {
    const d = new T.Vector3();
    G.camera.getWorldDirection(d);
    d.y = 0;
    d.normalize();
    const p = G.camera.position.clone().addScaledVector(d, dist);
    p.y = G.groundAt(p.x, p.z) + 1;
    return p;
  }

  /* ---------- ачивки ---------- */
  function achieve(id) {
    if (st.ach.has(id)) return;
    st.ach.add(id);
    const a = ACH.find((x) => x[0] === id);
    if (!a) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="ti">${a[1]}</div><div><div class="tk">ДОСТИЖЕНИЕ ПОЛУЧЕНО</div><div class="tn">${a[2]}</div><div class="td">${a[3]}</div></div>`;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4700);
    A.play('achieve');
    $('#achCount').textContent = st.ach.size + '/' + ACH.length;
  }
  ui.achieve = achieve;

  /* ---------- тултипы ---------- */
  const tip = document.createElement('div');
  tip.className = 'tip hidden';
  document.body.appendChild(tip);
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.classList.add('hidden'); return; }
    tip.innerHTML = el.dataset.tip;
    tip.classList.remove('hidden');
  });
  document.addEventListener('mousemove', (e) => {
    if (tip.classList.contains('hidden')) return;
    const w = 270, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY - h - 12;
    if (x + w > innerWidth) x = e.clientX - w - 16;
    if (y < 8) y = e.clientY + 20;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });

  /* =====================================================================
     ИНИЦИАЛИЗАЦИЯ
     ===================================================================== */
  ui.init = function () {
    $('#hbPortrait').src = R.portrait;
    $('#hbNick').textContent = R.nick;
    $('#hbClass').textContent = '· ' + R.heroClass;
    $('#hbLevel').textContent = R.age;
    $('#ultImg').src = R.ultPhoto;
    $('#achCount').textContent = '0/' + ACH.length;
    buildAbilities();
    buildInventory();
    buildDots();
    buildLabels();
    bindInput();
    easterEggs();

    $('#btnPlay').addEventListener('click', startSearch);
    $('#btnAccept').addEventListener('click', accept);
    const dec = $('#btnDecline');
    let flee = 0;
    const run = () => {
      flee++;
      A.play('hover');
      dec.style.transform = `translate(${(Math.random() - 0.5) * 300}px, ${(Math.random() - 0.5) * 180}px) rotate(${(Math.random() - 0.5) * 30}deg)`;
      if (flee === 3) achieve('decline');
      if (flee === 6) dec.textContent = 'НЕ-А 🙂';
    };
    dec.addEventListener('pointerenter', run);
    dec.addEventListener('click', () => { dec.textContent = 'НЕЛЬЗЯ 🙂'; achieve('decline'); setTimeout(accept, 500); });
  };

  /* ---------- меню → поиск → «игра найдена» → загрузка ---------- */
  let searchTimer;
  function startSearch() {
    A.init();
    A.play('click');
    $('#menu').classList.add('fade');
    setTimeout(() => $('#menu').classList.add('hidden'), 800);
    const s = $('#search');
    s.classList.remove('hidden');
    let n = 0;
    $('#searchTime').textContent = '0:00';
    searchTimer = setInterval(() => { n++; $('#searchTime').textContent = fmtTime(n); }, 1000);
    setTimeout(() => {
      clearInterval(searchTimer);
      s.classList.add('hidden');
      showFound();
    }, 2700);
  }
  let foundTimer;
  function showFound() {
    $('#found').classList.remove('hidden');
    A.play('found');
    let left = 10;
    const ring = $('#foundRing');
    $('#foundCount').textContent = left;
    ring.style.strokeDashoffset = 0;
    foundTimer = setInterval(() => {
      left--;
      $('#foundCount').textContent = left;
      ring.style.strokeDashoffset = 276.5 * (1 - left / 10);
      A.play('tick');
      if (left <= 0) { hint('Мы приняли за тебя 😉'); accept(); }
    }, 1000);
  }
  let accepted = false;
  function accept() {
    if (accepted) return;
    accepted = true;
    clearInterval(foundTimer);
    A.play('click');
    achieve('accept');
    $('#found').classList.add('hidden');
    showLoading();
  }
  function card(p, team) {
    const me = p.me;
    const body = me ? `<img src="${R.photo}" alt="${R.name}">` : `<div class="pc-emoji">${p.emoji}</div>`;
    return `<div class="pcard ${me ? 'me' : ''}">${body}<div class="pc-info"><div class="pc-name">${p.name}</div><div class="pc-role">${p.role}</div></div></div>`;
  }
  function showLoading() {
    $('#lightCards').innerHTML = R.teams.light.map((p) => card(p, 'light')).join('');
    $('#darkCards').innerHTML = R.teams.dark.map((p) => card(p, 'dark')).join('');
    document.querySelectorAll('.pcard').forEach((c, i) => (c.style.animationDelay = (i % 5) * 0.08 + (i >= 5 ? 0.3 : 0) + 's'));
    const L = $('#loading');
    L.classList.remove('hidden');
    $('#loadTip').textContent = R.tips[Math.floor(Math.random() * R.tips.length)];
    const fill = $('#loadFill'), status = $('#loadStatus');
    const steps = [
      [300, 22, 'Загрузка карты…'],
      [900, 58, 'Высаживаем деревья…'],
      [1500, 84, 'Расставляем вышки…'],
      [2000, 99, 'Ожидание игрока: ' + R.teacher + '…'],
      [3700, 100, 'Все игроки загрузились!'],
    ];
    steps.forEach(([ms, w, txt]) => setTimeout(() => { fill.style.width = w + '%'; status.textContent = txt; }, ms));
    setTimeout(() => {
      L.classList.add('fade');
      setTimeout(() => L.classList.add('hidden'), 700);
      beginDive();
    }, 4300);
  }
  function beginDive() {
    A.startMusic();
    G.tour.startDive(onLanded, (phase) => {
      if (phase === 'top') A.play('tick');
      if (phase === 'dive') A.play('whoosh');
    });
  }
  function onLanded() {
    st.started = true;
    st.gameStart = G.time;
    G.creeps.active = true;
    G.creeps.lastWave = G.time - 20;
    $('#hud').classList.remove('hidden');
    A.play('land');
    A.play('horn', 0.15);
    flash(false, 0.35);
    G.tour.shake(0.8);
    banner('БИТВА НАЧАЛАСЬ', 'Резюме Андрея Мищенко', '');
    A.say('Битва началась');
    setTimeout(() => ui.onArrive(0), 1200);
    setTimeout(() => hint('Зажми мышь и двигай — осмотреться · кликай по вражеским крипам', 5000), 3800);
  }

  /* ---------- HUD ---------- */
  function buildAbilities() {
    const wrap = $('#abilities');
    R.abilities.forEach((ab) => {
      const b = document.createElement('button');
      b.className = 'ab' + (ab.ult ? ' ult' : '');
      b.type = 'button';
      b.style.setProperty('--c', ab.color);
      b.dataset.key = ab.key;
      b.dataset.tip = `<b>${ab.name} [${ab.key}]</b>${ab.desc}<i>Перезарядка: ${ab.cd} с · Кофе: ${COST[ab.key]}</i>`;
      b.innerHTML = `<span class="key">${ab.key}</span>${ab.icon}<span class="cdo"></span><span class="cdt"></span>`;
      b.addEventListener('click', () => cast(ab.key));
      wrap.appendChild(b);
    });
  }
  function buildInventory() {
    const inv = $('#inventory');
    for (let i = 0; i < 6; i++) inv.appendChild(Object.assign(document.createElement('div'), { className: 'slot' }));
    const n = $('#neutralSlot');
    n.textContent = '🌀';
    n.classList.add('filled');
    n.dataset.tip = `<b>${R.weapon.name}</b>${R.weapon.text}<i>${R.weapon.rarity} · нейтральный предмет</i>`;
  }
  function fillSlot(item) {
    const slots = document.querySelectorAll('#inventory .slot');
    const s = slots[st.bought.length - 1];
    if (!s) return;
    s.className = 'slot filled';
    s.style.setProperty('--c', item.color);
    s.textContent = item.glyph;
    s.dataset.tip = itemTip(item);
  }
  const itemTip = (it) => `<b>${esc(it.name)}</b>${esc(it.desc)}<i>${esc(it.passive)}</i><i>Уровень: ${it.lvl}/10 · ${it.price} золота</i>`;

  function buildDots() {
    const d = $('#tourDots');
    d.innerHTML = '';
    G.tour.stops.forEach((s, i) => {
      const dot = document.createElement('i');
      dot.title = s.name;
      dot.addEventListener('click', () => { if (st.started) { A.play('click'); G.tour.go(i); } });
      d.appendChild(dot);
    });
  }
  function updateDots(cur) {
    document.querySelectorAll('#tourDots i').forEach((d, i) => {
      d.className = (st.visited.has(i) ? 'seen ' : '') + (i === cur ? 'cur' : '');
    });
  }

  const labels = [];
  function buildLabels() {
    const box = $('#labels');
    G.tour.stops.forEach((s, i) => {
      const e = document.createElement('div');
      e.className = 'poi';
      e.textContent = s.icon + ' ' + s.label;
      box.appendChild(e);
      labels.push({ el: e, pos: s.anchor, stop: i, far: 70 });
    });
    G.camps.forEach((c, i) => {
      const p = R.projects[i];
      if (!p) return;
      const e = document.createElement('div');
      e.className = 'poi camp';
      e.style.setProperty('--c', p.color);
      e.textContent = p.icon + ' ' + p.title;
      box.appendChild(e);
      labels.push({ el: e, pos: c.pos.clone().add(new T.Vector3(0, 4.6, 0)), far: 75 });
    });
  }
  function updateLabels() {
    const show = st.started;
    const n = G.tour.stops.length;
    const nextIdx = G.tour.idx < 0 ? 0 : (G.tour.idx + 1) % n;
    for (const l of labels) {
      const d = G.camera.position.distanceTo(l.pos);
      const isNext = l.stop === nextIdx && G.tour.mode === 'idle';
      const far = isNext ? 500 : l.far;
      const s = show && d < far ? toScreen(l.pos) : null;
      if (!s) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      l.el.style.opacity = isNext ? 1 : Math.min(1, (far - d) / 30);
      if (l.stop != null) {
        l.el.classList.toggle('seen', st.visited.has(l.stop));
        l.el.classList.toggle('cur', G.tour.idx === l.stop && G.tour.mode === 'idle');
        l.el.classList.toggle('next', isNext);
      }
    }
  }

  /* ---------- миникарта ---------- */
  const mm = $('#minimap'), mx = mm.getContext('2d');
  const toMM = (x, z) => [((x + G.MAP.size / 2) / G.MAP.size) * mm.width, ((z + G.MAP.size / 2) / G.MAP.size) * mm.height];
  function drawMinimap(t) {
    if (!G.minimapBase) return;
    const W = mm.width;
    mx.drawImage(G.minimapBase, 0, 0, W, W);
    // крипы
    for (const c of G.creeps.list) {
      if (!c.alive) continue;
      const [x, y] = toMM(c.x, c.z);
      mx.fillStyle = c.side ? '#ff6a5a' : '#8ff07a';
      mx.fillRect(x - 2, y - 2, 4, 4);
    }
    // вышки и троны
    for (const tw of G.towers) {
      const [x, y] = toMM(tw.x, tw.z);
      mx.fillStyle = '#000';
      mx.fillRect(x - 6, y - 6, 12, 12);
      mx.fillStyle = tw.side ? '#ff5a4a' : '#7bd86a';
      mx.fillRect(x - 4.5, y - 4.5, 9, 9);
    }
    [['light', '#7bd86a'], ['dark', '#ff5a4a']].forEach(([k, col]) => {
      const th = G.thrones[k];
      const [x, y] = toMM(th.group.position.x, th.group.position.z);
      mx.fillStyle = '#000';
      mx.fillRect(x - 10, y - 10, 20, 20);
      mx.fillStyle = th.alive ? col : '#555';
      mx.fillRect(x - 8, y - 8, 16, 16);
    });
    // точки резюме
    mx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    mx.textAlign = 'center';
    mx.textBaseline = 'middle';
    G.tour.stops.forEach((s, i) => {
      const [x, y] = toMM(s.anchor.x, s.anchor.z);
      const cur = i === G.tour.idx;
      mx.beginPath();
      mx.arc(x, y, cur ? 17 + Math.sin(t * 5) * 2 : 15, 0, Math.PI * 2);
      mx.fillStyle = st.visited.has(i) ? 'rgba(30,60,20,.85)' : 'rgba(20,14,8,.85)';
      mx.fill();
      mx.lineWidth = cur ? 3 : 2;
      mx.strokeStyle = cur ? '#ffe7a3' : st.visited.has(i) ? '#7bd86a' : '#e8b04a';
      mx.stroke();
      mx.fillText(s.icon, x, y + 1);
    });
    // камера
    const [cx, cy] = toMM(G.camera.position.x, G.camera.position.z);
    G.camera.getWorldDirection(_v);
    const a = Math.atan2(_v.z, _v.x);
    mx.beginPath();
    mx.moveTo(cx, cy);
    mx.arc(cx, cy, 70, a - 0.55, a + 0.55);
    mx.closePath();
    mx.fillStyle = 'rgba(255,240,200,.16)';
    mx.fill();
    mx.beginPath();
    mx.arc(cx, cy, 7, 0, Math.PI * 2);
    mx.fillStyle = '#fff';
    mx.fill();
    mx.lineWidth = 3;
    mx.strokeStyle = '#e8b04a';
    mx.stroke();
  }
  mm.addEventListener('click', (e) => {
    if (!st.started) return;
    const r = mm.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * G.MAP.size - G.MAP.size / 2;
    const z = ((e.clientY - r.top) / r.height) * G.MAP.size - G.MAP.size / 2;
    let best = -1, bd = 14;
    G.tour.stops.forEach((s, i) => { const d = Math.hypot(s.anchor.x - x, s.anchor.z - z); if (d < bd) { bd = d; best = i; } });
    A.play('click');
    if (best >= 0) G.tour.go(best); else G.tour.goPoint(x, z);
  });

  /* =====================================================================
     ЭКСКУРСИЯ: отъезд и прибытие
     ===================================================================== */
  ui.onDepart = function (i) {
    closePanel();
    $('#tourTitle').textContent = i >= 0 ? '→ ' + G.tour.stops[i].name : 'Свободная прогулка';
    $('#tourStep').textContent = i >= 0 ? `ТОЧКА ${i + 1} / ${G.tour.stops.length}` : 'КЛИК ПО МИНИКАРТЕ';
    $('#btnNext').classList.remove('pulse');
    updateDots(i);
  };
  ui.onArrive = function (i) {
    if (i < 0) {
      $('#tourTitle').textContent = 'Свободная прогулка';
      updateDots(-1);
      return;
    }
    const s = G.tour.stops[i];
    st.visited.add(i);
    $('#tourStep').textContent = `ТОЧКА ${i + 1} / ${G.tour.stops.length}`;
    $('#tourTitle').textContent = s.name;
    updateDots(i);
    $('#btnPrev').disabled = i === 0;
    $('#btnNext').textContent = i === G.tour.stops.length - 1 ? 'Снова ⟲' : 'Дальше ▶';
    $('#btnNext').classList.add('pulse');
    openPanel(i);
    if (st.visited.size === G.tour.stops.length) achieve('explorer');
    if (s.id === 'boss' && !st.bossDone) A.play('roar');
  };
  ui.next = function () {
    if (!st.started) return;
    A.play('click');
    const n = G.tour.stops.length;
    const i = G.tour.idx;
    G.tour.go(i < 0 ? 0 : (i + 1) % n);
  };
  ui.prev = function () {
    if (!st.started || G.tour.idx <= 0) return;
    A.play('click');
    G.tour.go(G.tour.idx - 1);
  };

  /* =====================================================================
     ПАНЕЛИ РЕЗЮМЕ
     ===================================================================== */
  // блок контактов с заголовком; если контакты не заполнены — не показываем ничего
  function contactsHTML(title) {
    const c = R.contacts, out = [];
    if (c.telegram) out.push(`<a class="contact" href="https://t.me/${c.telegram}" target="_blank" rel="noopener">✈️ Telegram</a>`);
    if (c.github) out.push(`<a class="contact" href="${c.github}" target="_blank" rel="noopener">🐙 GitHub</a>`);
    if (c.email) out.push(`<a class="contact" href="mailto:${c.email}">✉️ ${c.email}</a>`);
    if (!out.length) return '';
    return `<div class="sec-h">${title}</div><div class="contacts">${out.join('')}</div>`;
  }
  const pips = (n) => Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');

  const PANELS = {
    base: () => ({
      kicker: 'Фонтан · точка возрождения', title: 'Карточка героя',
      html: `
        <div class="herocard"><img src="${R.photo}" alt="${R.name}"><div>
          <div class="hc-name">${R.name}</div>
          <div class="hc-nick">«${R.nick}» · ур. ${R.age}</div>
          <div class="hc-row">Класс: <b>${R.heroClass}</b></div>
          <div class="hc-row">Возраст: <b>${R.age} лет</b></div>
          <div class="hc-row">Город: <b>${R.city}</b></div>
          <div class="hc-row">Позиция: <b>${R.hobby.role}</b></div>
        </div></div>
        <p style="margin-top:12px">${R.about}</p>
        <div class="sec-h">Атрибуты</div>
        ${R.attributes.map((a) => `<div class="attr"><span>${a.name}</span><b>${a.value}/10</b><div class="track"><i style="--c:${a.color}" data-w="${a.value * 10}"></i></div></div>`).join('')}
        <div class="sec-h">Экипировка</div>
        <div class="weapon"><div class="wi">🌀</div><div><div class="wr">${R.weapon.rarity}</div><div class="wn">${R.weapon.name}</div><div class="wt">${R.weapon.text}</div></div></div>
        <div class="sec-h">Языки</div>
        <div class="chips">${R.languages.map((l) => `<span class="chip">${l.name}${l.level ? ` · <b>${l.level}</b>` : ''}</span>`).join('')}</div>`,
    }),
    shop: () => ({
      kicker: 'Навыки · предметы героя', title: 'Лавка навыков',
      html: `
        <p class="muted">Навыки — это предметы. Покупай за золото, они появятся в инвентаре героя. Золото: <b style="color:var(--gold-hi)" id="shopGold">${fmt(st.gold)}</b></p>
        <div class="shop-grid">
          ${R.items.map((it) => `
            <button class="item ${st.bought.includes(it.id) ? 'bought' : ''}" type="button" data-act="buy:${it.id}" style="--c:${it.color}" data-tip="${itemTip(it).replace(/"/g, '&quot;')}">
              <div class="it-top"><div class="it-icon">${esc(it.glyph)}</div><div><div class="it-name">${it.name}</div><div class="it-price"><i class="coin"></i>${it.price}</div></div></div>
              <div class="pips">${pips(it.lvl)}</div>
              <div class="it-desc">${it.desc}</div>
              <div class="it-buy">${st.bought.includes(it.id) ? '✓ В ИНВЕНТАРЕ' : 'КУПИТЬ · ' + it.lvl + '/10'}</div>
            </button>`).join('')}
        </div>
        <button class="btn-dark panel-next" type="button" data-act="buyall">Купить всё сразу</button>`,
    }),
    edu: () => ({
      kicker: 'Мид · образование', title: 'Башня знаний',
      html: `
        <div class="quest"><div class="qi">🎓</div><div style="flex:1">
          <div class="qs">КВЕСТ В ПРОЦЕССЕ · ${R.education.course.toUpperCase()}</div>
          <div class="qt">${R.education.place}</div>
          <div class="qd">Специальность: <b style="color:var(--text)">${R.education.spec}</b></div>
          <div class="tower-hp"><i style="width:100%"></i></div>
          <div class="qd">Прочность башни: 100% — знания не сдаются</div>
        </div></div>
        <p class="muted">Пассивка специальности: ${R.education.note}</p>
        <p class="muted">Мышление безопасника: сначала думаю, как это можно сломать, — потом пишу так, чтобы не сломали.</p>`,
    }),
    exp: () => ({
      kicker: 'Топ · опыт', title: 'Башня опыта',
      html: `
        ${R.experience.map((x) => `<div class="quest"><div class="qi">${x.icon}</div><div><div class="qs">АКТИВНЫЙ КВЕСТ</div><div class="qt">${x.title}</div><div class="qd">${x.text}</div></div></div>`).join('')}
        <div class="sec-h">Пассивные таланты</div>
        <div class="chips">${R.softSkills.map((s) => `<span class="chip">✦ ${s}</span>`).join('')}</div>`,
    }),
    hobby: () => ({
      kicker: 'Река · увлечения', title: 'Руна хобби',
      html: `
        <div class="stats">
          <div class="stat"><div class="sl">Позиция</div><div class="sv">${R.hobby.role}</div></div>
          <div class="stat"><div class="sl">Ранг</div><div class="sv">${R.hobby.rank}</div></div>
          <div class="stat"><div class="sl">Часов в Доте</div><div class="sv" data-count="${R.hobby.hours}">0</div></div>
          <div class="stat"><div class="sl">Ещё хобби</div><div class="sv">${R.hobby.other[1]}</div></div>
        </div>
        <div class="motto">«${R.hobby.motto}»</div>
        <p class="muted" style="margin-top:10px">${fmt(R.hobby.hours)} часов ≈ ${Math.round(R.hobby.hours / 24)} суток. Усидчивость, реакция и игра в команде — подтверждены.</p>`,
    }),
    projects: () => ({
      kicker: 'Лесные лагеря · проекты', title: 'Лес проектов',
      html: `
        <div class="camps">${R.projects.map((p) => `<div class="camp" style="--c:${p.color}"><div class="ci">${p.icon}</div><div class="cn">${p.title}</div><div class="cc">${p.camp}</div><div class="ct">${p.text}</div></div>`).join('')}</div>
        <p class="muted" style="margin-top:12px">${R.projectsNote}</p>`,
    }),
    boss: () => st.bossDone
      ? {
        kicker: 'Босс · побеждён', title: 'Логово Дедлайна',
        html: `<p>Дедлайн повержен. Сдано вовремя — как и всегда.</p>
          <div class="quest"><div class="qi">📜</div><div><div class="qs">НАГРАДА</div><div class="qt">Зачётка бессмертия</div><div class="qd">+600 золота. Защищает от одной пересдачи.</div></div></div>`,
      }
      : {
        kicker: 'Босс · испытание', title: 'Логово Дедлайна',
        html: `<p>Древний босс <b>Дедлайн</b> охраняет реку. Каждый студент встречает его хотя бы раз в семестр.</p>
          <div class="stats">
            <div class="stat"><div class="sl">Здоровье</div><div class="sv">5 000</div></div>
            <div class="stat"><div class="sl">Слабость</div><div class="sv">Тайм-менеджмент</div></div>
          </div>
          <div class="boss-actions"><button class="btn-gold" type="button" data-act="fight">⚔ В БОЙ</button></div>
          <p class="muted" style="margin-top:10px">В бою: Q W E R — способности, клик по боссу — обычная атака.</p>`,
      },
    final: () => ({
      kicker: 'База Тёмных · финал', title: 'Трон Безработицы',
      html: st.thrDone
        ? `<p>Трон разрушен. Андрей готов к работе.</p>
           ${contactsHTML('Связаться')}
           <button class="btn-gold panel-next" type="button" data-act="victory">🏆 Итоги матча</button>`
        : `<p>Последний рубеж — <b>Трон Безработицы</b>. Разрушь его, и резюме будет пройдено.</p>
           <div class="tower-hp"><i id="thrHp" style="width:${100 - st.thrHits * 25}%"></i></div>
           <div class="boss-actions"><button class="btn-gold" type="button" data-act="throne">💥 Атаковать трон</button></div>
           ${contactsHTML('Связаться')}`,
    }),
  };

  let panelStop = -1;
  function openPanel(i) {
    const s = G.tour.stops[i];
    const p = PANELS[s.id]();
    panelStop = i;
    $('#panelIcon').textContent = s.icon;
    $('#panelKicker').textContent = p.kicker;
    $('#panelTitle').textContent = p.title;
    let html = p.html;
    const n = G.tour.stops.length;
    if (s.id !== 'final' && !(s.id === 'boss' && st.boss && st.boss.active)) {
      html += `<button class="btn-gold panel-next" type="button" data-act="next">Дальше: ${G.tour.stops[(i + 1) % n].name} ▶</button>`;
    }
    const body = $('#panelBody');
    body.innerHTML = html;
    body.scrollTop = 0;
    $('#panel').classList.add('open');
    G.tour.panelShift(innerWidth > 900);
    requestAnimationFrame(() => {
      body.querySelectorAll('[data-w]').forEach((e) => (e.style.width = e.dataset.w + '%'));
      body.querySelectorAll('[data-count]').forEach((e) => countUp(e, +e.dataset.count));
    });
  }
  function closePanel() {
    $('#panel').classList.remove('open');
    G.tour.panelShift(false);
  }
  function countUp(el, to) {
    const t0 = performance.now();
    const f = (now) => {
      const k = Math.min(1, (now - t0) / 1400);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }
  $('#panelBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'next') ui.next();
    else if (act.startsWith('buy:')) buy(act.slice(4));
    else if (act === 'buyall') buyAll();
    else if (act === 'fight') startBoss();
    else if (act === 'throne') hitThrone();
    else if (act === 'victory') showVictory();
  });
  $('#panelClose').addEventListener('click', () => { A.play('click'); closePanel(); });

  /* ---------- лавка ---------- */
  function buy(id, quiet) {
    const it = R.items.find((x) => x.id === id);
    if (!it) return;
    if (st.bought.includes(id)) { if (!quiet) hint('Уже в инвентаре 😎'); return; }
    if (st.gold < it.price) { A.play('error'); hint('Не хватает золота — фарми крипов!'); return; }
    st.gold -= it.price;
    st.bought.push(id);
    fillSlot(it);
    A.play('buy');
    num('-' + it.price, null, 'small', '#ffe7a3', 120);
    if (G.shop) G.fx.burst(G.shop.pos.clone().add(new T.Vector3(0, 7, 0)), { color: it.color, count: 40, speed: 7, life: 1 });
    const btn = document.querySelector(`[data-act="buy:${id}"]`);
    if (btn) {
      btn.classList.add('bought');
      btn.querySelector('.it-buy').textContent = '✓ В ИНВЕНТАРЕ';
    }
    const g = $('#shopGold');
    if (g) g.textContent = fmt(st.gold);
    if (st.bought.length === R.items.length) {
      achieve('shopper');
      chat('team', 'Кофе', 'вот это сборка 🔥');
    }
  }
  function buyAll() {
    const left = R.items.filter((it) => !st.bought.includes(it.id));
    if (!left.length) { hint('Всё уже куплено 😎'); return; }
    left.forEach((it, i) => setTimeout(() => buy(it.id, true), i * 220));
  }

  /* ---------- способности ---------- */
  function cast(key) {
    if (!st.started) return;
    const ab = R.abilities.find((a) => a.key === key);
    if (!ab) return;
    if (st.cds[key] > 0) { A.play('error'); hint(`${ab.name}: перезарядка ${st.cds[key].toFixed(1)} с`, 1500); return; }
    if (st.mp < COST[key]) { A.play('error'); hint('Не хватает кофе ☕', 1500); return; }
    st.mp -= COST[key];
    st.cds[key] = ab.cd;
    const btn = document.querySelector(`.ab[data-key="${key}"]`);
    if (btn) { btn.style.transform = 'scale(.9)'; setTimeout(() => (btn.style.transform = ''), 120); }

    if (key === 'W') {
      st.hp = Math.min(100, st.hp + ab.heal);
      A.play('heal');
      num('+' + ab.heal + ' сна', null, '', '#7bff8a', 60);
      G.fx.burst(forward(4), { color: 0x7bff8a, count: 50, speed: 5, life: 1.2, gravity: 3 });
      return;
    }
    if (key === 'R') {
      achieve('ult');
      const u = $('#ultCut');
      u.classList.remove('show');
      void u.offsetWidth;
      u.classList.add('show');
      A.play('magic');
      A.play('explode', 0.5);
      A.say(R.hobby.motto);
      setTimeout(() => u.classList.remove('show'), 2000);
    } else {
      A.play('magic');
    }
    const color = new T.Color(ab.color);
    const fight = st.boss && st.boss.active;
    if (fight) {
      setTimeout(() => {
        const crit = key === 'E' && Math.random() < 0.35;
        dealBoss(ab.dmg * (crit ? 2 : 1), crit || key === 'R', ab.color);
        G.fx.burst(G.boss.pos, { color, count: key === 'R' ? 220 : 70, speed: key === 'R' ? 24 : 12, life: 1.2, big: key === 'R' });
      }, key === 'R' ? 800 : 120);
      return;
    }
    // вне боя — бьём по площади перед собой
    const p = forward(key === 'R' ? 18 : 13);
    const radius = { Q: 5, E: 6.5, R: 13 }[key];
    setTimeout(() => {
      G.fx.burst(p, { color, count: key === 'R' ? 260 : 70, speed: key === 'R' ? 26 : 11, life: 1.3, big: key === 'R' });
      if (key === 'R') { G.tour.shake(1.3); flash(false, 0.4); }
      let killed = 0;
      for (const c of G.creeps.list) {
        if (!c.alive || c.side !== 1) continue;
        if (Math.hypot(c.x - p.x, c.z - p.z) < radius) { G.creeps.kill(c, 'player'); killed++; }
      }
      if (killed > 2) banner(killed > 4 ? 'БУЙСТВО' : 'МУЛЬТИКИЛЛ', killed + ' крипов за раз', 'red');
    }, key === 'R' ? 800 : 100);
  }

  ui.onCreepKilled = function (c) {
    if (c.side === 0) {
      num('Денай!', new T.Vector3(c.x, c.y + 2.5, c.z), 'small', '#ffffff');
      achieve('deny');
      return;
    }
    const g = 38 + Math.floor(Math.random() * 20);
    st.gold += g;
    st.lastHits++;
    A.play('coin');
    num('+' + g, new T.Vector3(c.x, c.y + 2.5, c.z), 'small', '#ffd34d');
    if (st.lastHits === 1) {
      achieve('firstblood');
      banner('ПЕРВАЯ КРОВЬ', R.nick + ' открыл счёт', 'red');
      A.say('Первая кровь');
      st.score[0]++;
    }
    if (st.lastHits === 10) achieve('farmer');
  };

  /* ---------- босс ---------- */
  const TAUNTS = ['Сдача завтра в 9:00', 'Где отчёт?', 'Пересдача!', 'Осталось 5 минут', 'Это должно было быть вчера'];
  function startBoss() {
    if (st.bossDone || (st.boss && st.boss.active)) return;
    st.boss = { hp: 5000, max: 5000, active: true, atk: 2.4 };
    $('#bossbar').classList.remove('hidden');
    updateBossBar();
    A.play('roar');
    A.setIntensity(1);
    banner('В БОЙ!', 'Дедлайн проснулся', 'red');
    closePanel();
    hint('Q W E R — способности · клик по боссу — атака', 4500);
  }
  function updateBossBar() {
    const b = st.boss;
    $('#bossFill').style.width = (Math.max(0, b.hp) / b.max) * 100 + '%';
    $('#bossHpText').textContent = fmt(Math.max(0, b.hp)) + ' / ' + fmt(b.max);
  }
  function dealBoss(dmg, crit, color) {
    const b = st.boss;
    if (!b || !b.active) return;
    dmg = Math.round(dmg * (0.9 + Math.random() * 0.2));
    b.hp -= dmg;
    G.boss.hit();
    G.tour.shake(crit ? 0.5 : 0.2);
    A.play(crit ? 'crit' : 'hit');
    num((crit ? '💥' : '') + fmt(dmg), G.boss.pos, crit ? 'crit' : '', color || '#ff6a5a', 90);
    updateBossBar();
    if (b.hp <= 0) winBoss();
  }
  function bossTick(dt) {
    const b = st.boss;
    if (!b || !b.active) return;
    b.atk -= dt;
    if (b.atk > 0) return;
    b.atk = 2.0 + Math.random() * 1.2;
    G.boss.attack();
    setTimeout(() => {
      if (!b.active) return;
      const d = 9 + Math.floor(Math.random() * 9);
      st.hp -= d;
      flash(true, 0.5);
      G.tour.shake(0.7);
      A.play('hurt');
      num('-' + d + ' сна', null, '', '#ff4a3a', 80);
      if (Math.random() < 0.5) chat('dark', 'Дедлайн', TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
      if (st.hp < 30) {
        st.hp += 45;
        A.play('heal');
        num('☕ +45', null, '', '#9fd0ff', 60);
        chat('team', 'Кофе', 'держись, я рядом ☕');
      }
    }, 380);
  }
  function winBoss() {
    const b = st.boss;
    b.active = false;
    st.bossDone = true;
    G.boss.die();
    A.play('explode');
    A.setIntensity(0);
    flash(false, 0.6);
    G.tour.shake(1.4);
    st.gold += 600;
    st.score[0]++;
    setTimeout(() => {
      $('#bossbar').classList.add('hidden');
      G.boss.dropItem();
      banner('ДЕДЛАЙН ПОВЕРЖЕН', '+600 золота · Зачётка бессмертия', '');
      A.say('Дедлайн повержен');
      achieve('deadline');
      feed(R.nick, 'Дедлайн');
      if (G.tour.idx === 6 && G.tour.mode === 'idle') openPanel(6);
    }, 1300);
  }

  /* ---------- трон ---------- */
  function hitThrone() {
    if (st.thrDone) return;
    st.thrHits++;
    const th = G.thrones.dark;
    th.hit();
    const wp = new T.Vector3();
    th.core.getWorldPosition(wp);
    A.play('crit');
    G.tour.shake(0.6);
    num('-' + fmt(1250 + Math.random() * 200), wp, 'crit', '#ff8a5a', 120);
    G.fx.burst(wp, { color: 0xff5030, count: 60, speed: 14, life: 1 });
    const hp = $('#thrHp');
    if (hp) hp.style.width = Math.max(0, 100 - st.thrHits * 25) + '%';
    if (st.thrHits >= 4) {
      st.thrDone = true;
      th.destroy();
      A.play('explode');
      A.play('victory', 0.8);
      A.setIntensity(0);
      flash(false, 0.9);
      G.tour.shake(2);
      st.score[0] += 5;
      banner('ПОБЕДА СВЕТЛЫХ', 'Трон Безработицы разрушен', 'green');
      A.say('Победа');
      achieve('gg');
      closePanel();
      setTimeout(showVictory, 2800);
    }
  }

  /* ---------- экран победы ---------- */
  function showVictory() {
    const time = fmtTime(G.time - st.gameStart);
    const rows = [
      [R.nick, R.hobby.role, '∞ / 0 / ∞', fmt(st.gold), 'Резюме', true],
      ['Кофе ☕', 'Саппорт', '0 / 0 / 99', '—', 'Не дал уснуть'],
      ['Вайбкодинг ✦', 'Оффлейн', '12 / 0 / 30', '—', 'Написал полкода'],
      ['Ctrl+Z ↩️', 'Саппорт', '0 / 0 / 47', '—', 'Откатил 47 ошибок'],
      ['Гугл 🔎', 'Лесник', '3 / 0 / 120', '—', 'Нашёл всё'],
    ];
    $('#victoryInner').innerHTML = `
      <div class="v-title">ПОБЕДА</div>
      <div class="v-sub">СВЕТЛЫЕ ОДЕРЖАЛИ ПОБЕДУ · ${time}</div>
      <table class="v-table">
        <tr><th style="text-align:left">ИГРОК</th><th>РОЛЬ</th><th>У / С / П</th><th>ЗОЛОТО</th><th>ВКЛАД</th></tr>
        ${rows.map((r) => `<tr class="${r[5] ? 'me' : ''}"><td><span class="pl">${r[5] ? `<img src="${R.portrait}" alt="">` : ''}<b>${r[0]}</b></span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}
      </table>
      <div class="v-review"><div class="stars">★★★★★</div>Оценка от ${R.teacherGen}: <b>ожидается…</b> 🙏</div>
      ${contactsHTML('Связаться с Андреем')}
      <div class="v-btns">
        <button class="btn-gold" type="button" id="vHire">${st.hired ? '✓ Андрей в вашей команде' : '🤝 Нанять Андрея'}</button>
        <button class="btn-dark" type="button" id="vBoard">☰ Всё резюме</button>
        <button class="btn-dark" type="button" id="vStay">Остаться на карте</button>
      </div>`;
    $('#victory').classList.remove('hidden');
    $('#vHire').onclick = () => {
      st.hired = true;
      achieve('hire');
      A.play('victory');
      confetti();
      $('#vHire').textContent = '✓ Андрей в вашей команде';
    };
    $('#vBoard').onclick = () => { A.play('click'); openBoard(); };
    $('#vStay').onclick = () => { A.play('click'); $('#victory').classList.add('hidden'); };
  }

  /* ---------- табло = всё резюме одним экраном ---------- */
  function boardHTML() {
    const row = (a, b) => `<div class="brow"><span>${a}</span><b>${b}</b></div>`;
    return `
      <div class="board-head">
        <img src="${R.portrait}" alt="${R.name}">
        <div><h2>${R.name}</h2><div class="bh-sub">${R.nick} · ${R.age} лет · ${R.city} · ${R.heroClass}</div></div>
        <button class="btn-dark sm board-close" type="button" data-close>✕ Закрыть</button>
      </div>
      <p>${R.about}</p>
      <div class="board-grid">
        <div class="bcol">
          <div class="sec-h">Навыки</div>
          ${R.items.map((it) => row(it.name, `<span class="pips-inline">${'●'.repeat(it.lvl)}${'○'.repeat(10 - it.lvl)}</span> ${it.lvl}/10`)).join('')}
          <div class="sec-h">Языки</div>
          ${R.languages.map((l) => row(l.name, l.level || '✓')).join('')}
        </div>
        <div class="bcol">
          <div class="sec-h">Образование</div>
          ${row(R.education.place, R.education.course)}
          ${row('Специальность', R.education.spec)}
          <div class="sec-h">Опыт</div>
          ${R.experience.map((x) => row(x.icon + ' ' + x.title, x.text.split(' — ')[0])).join('')}
          <div class="sec-h">Качества</div>
          ${R.softSkills.map((s) => row('✦', s)).join('')}
        </div>
        <div class="bcol">
          <div class="sec-h">Проекты</div>
          ${R.projects.map((p) => row(p.icon + ' ' + p.title, '✓')).join('')}
          <div class="sec-h">Хобби</div>
          ${row('Дота', `${R.hobby.role} · ${R.hobby.rank} · ${fmt(R.hobby.hours)} ч`)}
          ${row('Ещё', R.hobby.other[1])}
          ${contactsHTML('Контакты')}
        </div>
      </div>`;
  }
  function openBoard() {
    $('#boardInner').innerHTML = boardHTML();
    $('#board').classList.remove('hidden');
  }
  function toggleBoard() {
    const b = $('#board');
    if (b.classList.contains('hidden')) { A.play('click'); openBoard(); } else b.classList.add('hidden');
  }
  ui.openBoard = openBoard;
  ui.boardHTML = boardHTML;
  $('#board').addEventListener('click', (e) => { if (e.target.id === 'board' || e.target.closest('[data-close]')) $('#board').classList.add('hidden'); });

  function openAch() {
    $('#achList').innerHTML = `<h3>Достижения · ${st.ach.size}/${ACH.length}</h3>` +
      ACH.map((a) => `<div class="ach ${st.ach.has(a[0]) ? 'got' : ''}"><div class="ai">${a[1]}</div><div><div class="an">${a[2]}</div><div class="ad">${a[3]}</div></div></div>`).join('') +
      '<button class="btn-dark sm panel-next" type="button" data-close>Закрыть</button>';
    $('#achModal').classList.remove('hidden');
  }
  $('#achModal').addEventListener('click', (e) => { if (e.target.id === 'achModal' || e.target.closest('[data-close]')) $('#achModal').classList.add('hidden'); });

  /* ---------- чат и лента убийств ---------- */
  const darkNames = new Set(R.teams.dark.map((p) => p.name));
  function chat(ch, name, text) {
    const box = $('#chat');
    const line = document.createElement('div');
    const cls = darkNames.has(name) ? 'dark' : ch;
    line.className = 'cl ' + cls;
    line.innerHTML = `<span class="ch">[${ch === 'team' ? 'Союзники' : 'Всем'}]</span> <span class="cn"></span>: <span class="ct"></span>`;
    line.querySelector('.cn').textContent = name;
    line.querySelector('.ct').textContent = text;
    box.appendChild(line);
    while (box.children.length > 7) box.firstChild.remove();
    setTimeout(() => line.remove(), 10500);
  }
  function feed(killer, victim) {
    const box = $('#killfeed');
    const e = document.createElement('div');
    e.className = 'kf';
    e.innerHTML = '<span class="k"></span><span class="sw">⚔</span><span class="v"></span>';
    e.querySelector('.k').textContent = killer;
    e.querySelector('.v').textContent = victim;
    box.appendChild(e);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => e.remove(), 7000);
  }

  /* =====================================================================
     КАДР
     ===================================================================== */
  let mmFrame = 0;
  ui.update = function (dt, t) {
    if (!st.started) return;
    // ресурсы
    st.gold += dt * 2;
    st.mp = Math.min(100, st.mp + dt * 6);
    if (!(st.boss && st.boss.active)) st.hp = Math.min(100, st.hp + dt * 1.5);
    $('#gold').textContent = fmt(st.gold);
    $('#hpFill').style.width = st.hp + '%';
    $('#mpFill').style.width = st.mp + '%';
    $('#hpText').textContent = `Сон ${Math.round(st.hp)} / 100`;
    $('#mpText').textContent = `Кофе ${Math.round(st.mp)} / 100`;
    const gt = t - st.gameStart;
    $('#gameTime').textContent = fmtTime(gt);
    $('#dayNight').textContent = Math.floor(gt / 120) % 2 ? '☾ ночь' : '☀ день';
    $('#scoreLight').textContent = st.score[0];
    $('#scoreDark').textContent = st.score[1];
    // перезарядки
    document.querySelectorAll('.ab').forEach((b) => {
      const k = b.dataset.key, ab = R.abilities.find((a) => a.key === k);
      const was = st.cds[k];
      st.cds[k] = Math.max(0, st.cds[k] - dt);
      b.querySelector('.cdo').style.setProperty('--cd', st.cds[k] / ab.cd);
      b.querySelector('.cdt').textContent = st.cds[k] > 0 ? Math.ceil(st.cds[k]) : '';
      if (was > 0 && st.cds[k] === 0) { b.classList.remove('ready-flash'); void b.offsetWidth; b.classList.add('ready-flash'); }
    });
    st.basicCd = Math.max(0, st.basicCd - dt);
    bossTick(dt);
    // чат и лента
    st.nextChat -= dt;
    if (st.nextChat <= 0) {
      st.nextChat = 7 + Math.random() * 6;
      const c = R.chat[st.chatI++ % R.chat.length];
      chat(c[0], c[1], c[2]);
    }
    st.nextFeed -= dt;
    if (st.nextFeed <= 0) {
      st.nextFeed = 11 + Math.random() * 7;
      const f = R.feed[st.feedI++ % R.feed.length];
      feed(f[0], f[1]);
      st.score[0]++;
      if (Math.random() < 0.25) st.score[1]++;
    }
    updateLabels();
    if (++mmFrame % 2 === 0) drawMinimap(t);
  };

  /* =====================================================================
     ВВОД
     ===================================================================== */
  function bindInput() {
    $('#btnNext').addEventListener('click', ui.next);
    $('#btnPrev').addEventListener('click', ui.prev);
    $('#btnBoard').addEventListener('click', toggleBoard);
    $('#btnAch').addEventListener('click', () => { A.play('click'); openAch(); });
    $('#btnMusic').addEventListener('click', () => {
      A.setMusic(!A.music);
      $('#btnMusic').classList.toggle('off', !A.music);
    });
    $('#btnSound').addEventListener('click', () => {
      A.setOn(!A.on);
      $('#btnSound').textContent = A.on ? '🔊' : '🔇';
      $('#btnSound').classList.toggle('off', !A.on);
    });

    const cv = G.renderer.domElement;
    let down = null;
    cv.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ок */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (down.moved && st.started) G.tour.drag(e.clientX - down.lx, e.clientY - down.ly);
      down.lx = e.clientX;
      down.ly = e.clientY;
    });
    cv.addEventListener('pointerup', (e) => {
      if (down && !down.moved) worldClick(e.clientX, e.clientY);
      down = null;
    });
    cv.addEventListener('pointercancel', () => (down = null));
    window.addEventListener('mousemove', (e) => G.tour.mouse((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1));

    window.addEventListener('keydown', (e) => {
      konami(e.code);
      if (!st.started) return;
      if (e.code === 'Tab') { e.preventDefault(); toggleBoard(); return; }
      if (e.code === 'Escape') {
        $('#board').classList.add('hidden');
        $('#achModal').classList.add('hidden');
        closePanel();
        return;
      }
      const onBtn = e.target && e.target.tagName === 'BUTTON';
      if (['KeyQ', 'KeyW', 'KeyE', 'KeyR'].includes(e.code)) { cast(e.code.slice(3)); return; }
      if (e.code === 'KeyM') { $('#btnMusic').click(); return; }
      if (konamiIdx >= 4) return;
      if ((e.code === 'Space' || e.code === 'Enter') && onBtn) return;
      if (e.code === 'ArrowRight' || e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyD') { e.preventDefault(); ui.next(); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); ui.prev(); }
    });
  }

  const ray = new T.Raycaster();
  function worldClick(x, y) {
    if (!st.started) return;
    ray.setFromCamera({ x: (x / innerWidth) * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, G.camera);
    if (st.boss && st.boss.active && G.boss.alive) {
      if (ray.intersectObject(G.boss.group, true).length) {
        if (st.basicCd > 0) return;
        st.basicCd = 0.25;
        const crit = Math.random() < 0.2;
        dealBoss(crit ? 320 : 150, crit, crit ? '#ffd34d' : '#ffffff');
        return;
      }
    }
    if (G.tour.stops[G.tour.idx] && G.tour.stops[G.tour.idx].id === 'final' && !st.thrDone) {
      if (ray.intersectObject(G.thrones.dark.group, true).length) { hitThrone(); return; }
    }
    const c = G.creeps.pick(ray);
    if (c) G.creeps.kill(c, 'player');
  }

  /* ---------- пасхалки ---------- */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let konamiIdx = 0;
  function konami(code) {
    if (code === KONAMI[konamiIdx]) konamiIdx++;
    else konamiIdx = code === KONAMI[0] ? 1 : 0;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      if (!st.started) return;
      achieve('konami');
      st.gold += 9999;
      banner('РЕЖИМ БОГА', '+9 999 золота · никому не говори', '');
      A.play('victory');
      for (let i = 0; i < 12; i++) setTimeout(() => G.fx.burst(forward(6 + Math.random() * 10).add(new T.Vector3(0, 6, 0)), { color: 0xffd34d, count: 40, speed: 6, life: 1.6 }), i * 120);
    }
  }
  function easterEggs() {
    const title = document.title;
    document.addEventListener('visibilitychange', () => {
      document.title = document.hidden ? '😢 Вернись на мид!' : title;
    });
    try {
      console.log('%cANENZIK', 'font: 700 46px Georgia, serif; color: #e8b04a; text-shadow: 0 3px 0 #000;');
      console.log(`%c${R.teacher}, если вы читаете консоль — вы настоящий разработчик. Ставьте 5 😉`, 'font: 14px sans-serif; color: #7bd86a;');
      console.log('%cСекрет: ↑ ↑ ↓ ↓ ← → ← → B A', 'font: 12px monospace; color: #a99f8b;');
    } catch (e) { /* консоль недоступна — не страшно */ }
  }
})();
