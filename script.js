// Footer year, kept accurate automatically.
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ------------------------------------------------------------
// Nav: mobile toggle + "active section" highlight
// ------------------------------------------------------------
const navToggle = document.querySelector('.nav-toggle');
const navList = document.getElementById('nav-links');

if (navToggle && navList){
  navToggle.addEventListener('click', () => {
    const open = navList.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navList.addEventListener('click', (e) => {
    if (e.target.closest('a')){
      navList.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
const sections = Array.from(navLinks)
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window && sections.length){
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        const id = `#${entry.target.id}`;
        navLinks.forEach(link => {
          link.classList.toggle('is-active', link.getAttribute('href') === id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(section => observer.observe(section));
}

// ------------------------------------------------------------
// Hero: a low-poly rock rendered as a live wireframe.
// Icosphere (1 subdivision) with a little vertex noise, projected
// into an SVG. Drag to orbit; respects prefers-reduced-motion.
// ------------------------------------------------------------
(function wireframe(){
  const svg = document.getElementById('mesh');
  const gizmo = document.getElementById('gizmo');
  if (!svg) return;

  const NS = 'http://www.w3.org/2000/svg';
  const t = (1 + Math.sqrt(5)) / 2;
  const normalize = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ].map(normalize);

  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];

  // one loop subdivision → 42 verts, 80 faces
  const cache = new Map();
  const mid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (cache.has(key)) return cache.get(key);
    const p = normalize(verts[a].map((v, i) => (v + verts[b][i]) / 2));
    verts.push(p);
    cache.set(key, verts.length - 1);
    return verts.length - 1;
  };
  const next = [];
  faces.forEach(([a, b, c]) => {
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  });
  faces = next;

  // deterministic "sculpt" noise so it reads as a rock, not a ball
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  verts = verts.map(v => {
    const s = 0.84 + rand() * 0.26;
    return [v[0] * s * 1.08, v[1] * s * 0.86, v[2] * s];
  });

  // unique edges
  const edgeSet = new Set();
  const edges = [];
  faces.forEach(f => {
    for (let i = 0; i < 3; i++){
      const a = f[i], b = f[(i + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeSet.has(key)){ edgeSet.add(key); edges.push([a, b]); }
    }
  });

  const stats = document.getElementById('mesh-stats');
  if (stats) stats.textContent = `Verts ${verts.length} · Edges ${edges.length} · Faces ${faces.length}`;

  const lineEls = edges.map(() => svg.appendChild(document.createElementNS(NS, 'line')));
  const dotEls = verts.map(() => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '1.6');
    return svg.appendChild(c);
  });

  // gizmo axes
  const axes = [
    { v: [1, 0, 0], color: 'var(--axis-x)', label: 'X' },
    { v: [0, 1, 0], color: 'var(--axis-y)', label: 'Y' },
    { v: [0, 0, 1], color: 'var(--axis-z)', label: 'Z' }
  ];
  const gizmoEls = gizmo ? axes.map(ax => {
    const g = document.createElementNS(NS, 'g');
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('stroke', ax.color);
    l.setAttribute('stroke-width', '1.5');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '6');
    c.setAttribute('fill', ax.color);
    const tx = document.createElementNS(NS, 'text');
    tx.textContent = ax.label;
    g.append(l, c, tx);
    gizmo.appendChild(g);
    return { g, l, c, tx };
  }) : [];

  let yaw = 0.6, pitch = -0.35;
  const R = 92;

  function rotate([x, y, z]){
    // yaw around Y, then pitch around X
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1, y2, z2];
  }

  function render(){
    const p = verts.map(v => {
      const [x, y, z] = rotate(v);
      const persp = 3.2 / (3.2 - z);
      return { x: x * R * persp, y: -y * R * persp, z };
    });

    edges.forEach(([a, b], i) => {
      const el = lineEls[i];
      el.setAttribute('x1', p[a].x.toFixed(2));
      el.setAttribute('y1', p[a].y.toFixed(2));
      el.setAttribute('x2', p[b].x.toFixed(2));
      el.setAttribute('y2', p[b].y.toFixed(2));
      const depth = (p[a].z + p[b].z) / 2; // -1 (back) .. 1 (front)
      el.style.opacity = (0.16 + (depth + 1) * 0.38).toFixed(2);
    });

    dotEls.forEach((el, i) => {
      el.setAttribute('cx', p[i].x.toFixed(2));
      el.setAttribute('cy', p[i].y.toFixed(2));
      el.style.opacity = p[i].z > 0.05 ? '0.9' : '0';
    });

    if (gizmoEls.length){
      const order = axes
        .map((ax, i) => ({ i, r: rotate(ax.v) }))
        .sort((a, b) => a.r[2] - b.r[2]);
      order.forEach(({ i, r }) => {
        const e = gizmoEls[i];
        const x = r[0] * 20, y = -r[1] * 20;
        e.l.setAttribute('x2', x.toFixed(2));
        e.l.setAttribute('y2', y.toFixed(2));
        e.c.setAttribute('cx', x.toFixed(2));
        e.c.setAttribute('cy', y.toFixed(2));
        e.tx.setAttribute('x', x.toFixed(2));
        e.tx.setAttribute('y', y.toFixed(2));
        gizmo.appendChild(e.g); // re-append back-to-front
      });
    }
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dragging = false, lastX = 0, lastY = 0, idleAt = 0;

  const host = svg.parentElement;
  host.style.touchAction = 'pan-y';
  host.style.cursor = 'grab';
  host.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    host.setPointerCapture(e.pointerId);
    host.style.cursor = 'grabbing';
  });
  host.addEventListener('pointermove', e => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - lastY) * 0.01));
    lastX = e.clientX; lastY = e.clientY;
    if (reduced) render();
  });
  const stop = () => { dragging = false; idleAt = performance.now(); host.style.cursor = 'grab'; };
  host.addEventListener('pointerup', stop);
  host.addEventListener('pointercancel', stop);

  render();
  if (reduced) return;

  let visible = true;
  if ('IntersectionObserver' in window){
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  }

  let last = performance.now();
  (function tick(now){
    const dt = Math.min(50, now - last); last = now;
    if (visible){
      if (!dragging && now - idleAt > 1200) yaw += dt * 0.00022;
      render();
    }
    requestAnimationFrame(tick);
  })(last);
})();
