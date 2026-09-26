/*
 * Animated rhombic dodecahedron rendered on a 2D canvas.
 *
 * Geometry: 14 vertices (8 cube corners at (±1,±1,±1) and 6 octahedral points
 * at ±2 along each axis) and 12 rhombic faces. Faces are depth-sorted and
 * flat-shaded with a key light, a green accent light, and a subtle rim.
 *
 * Behaviors:
 *   - slow continuous rotation
 *   - gentle pointer parallax (tilt toward the pointer)
 *   - honors prefers-reduced-motion (renders a single static frame)
 *   - pauses when off-screen or when the tab is hidden
 *   - caps device pixel ratio for low-power devices
 *   - re-reads CSS custom properties on theme change
 *   - the ambient glow behind the solid is drawn by the hero's CSS background,
 *     not on the canvas, so it is never clipped by the canvas edge
 */
(function () {
  'use strict';

  var canvas = document.querySelector('[data-polyhedron]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  /* ---- Geometry -------------------------------------------------------- */
  var C = 1, O = 2;
  var verts = [];
  // cube corners: index 0..7
  for (var i = 0; i < 8; i++) {
    verts.push([ (i & 1) ? C : -C, (i & 2) ? C : -C, (i & 4) ? C : -C ]);
  }
  // octahedral points: index 8..13  (+x,-x,+y,-y,+z,-z)
  verts.push([ O, 0, 0], [-O, 0, 0], [0,  O, 0], [0, -O, 0], [0, 0,  O], [0, 0, -O]);

  function cubeIndex(x, y, z) { return (x > 0 ? 1 : 0) | (y > 0 ? 2 : 0) | (z > 0 ? 4 : 0); }
  function octIndex(axis, sign) { return 8 + axis * 2 + (sign > 0 ? 0 : 1); }

  // Each face: one rhombus per cube edge. For axes (a, b) with signs (sa, sb),
  // the face joins oct(a, sa), cube(sa, sb, +1 on c), oct(b, sb), cube(sa, sb, -1 on c).
  var faces = [];
  var pairs = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  pairs.forEach(function (p) {
    var a = p[0], b = p[1], c = p[2];
    [1, -1].forEach(function (sa) {
      [1, -1].forEach(function (sb) {
        var v1 = [0, 0, 0], v2 = [0, 0, 0];
        v1[a] = sa; v1[b] = sb; v1[c] = 1;
        v2[a] = sa; v2[b] = sb; v2[c] = -1;
        faces.push([
          octIndex(a, sa),
          cubeIndex(v1[0], v1[1], v1[2]),
          octIndex(b, sb),
          cubeIndex(v2[0], v2[1], v2[2])
        ]);
      });
    });
  });

  /* ---- Colors from CSS ------------------------------------------------- */
  var palette = {};
  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    palette.base   = parseColor(cs.getPropertyValue('--poly-base'))   || [74, 86, 100];
    palette.light  = parseColor(cs.getPropertyValue('--poly-light'))  || [138, 151, 166];
    palette.dark   = parseColor(cs.getPropertyValue('--poly-dark'))   || [44, 52, 61];
    palette.accent = parseColor(cs.getPropertyValue('--poly-accent')) || [46, 154, 99];
    palette.edge   = cs.getPropertyValue('--poly-edge').trim() || 'rgba(0,0,0,0.3)';
  }

  function parseColor(str) {
    str = (str || '').trim();
    if (!str) return null;
    var m = /^#([0-9a-f]{6})$/i.exec(str);
    if (m) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = /^rgba?\(([^)]+)\)/i.exec(str);
    if (m) {
      var parts = m[1].split(/[\s,\/]+/).map(parseFloat);
      return [parts[0], parts[1], parts[2]];
    }
    return null;
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgb(c, alpha) {
    var s = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
    return alpha == null ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + alpha + ')';
  }

  /* ---- State ----------------------------------------------------------- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var width = 0, height = 0, dpr = 1;
  var angleY = 0.9, angleX = -0.55;
  var targetTiltX = 0, targetTiltY = 0, tiltX = 0, tiltY = 0;
  var running = false, visible = true, rafId = 0, lastTime = 0;
  var coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var maxDpr = coarsePointer ? 1.5 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) drawFrame();
  }

  /* ---- Math ------------------------------------------------------------ */
  // Fixed pre-tilt about Z so the spin axis is not one of the solid's symmetry
  // axes; otherwise, at certain angles the rhombic dodecahedron projects to an
  // isometric cube.
  var TILT_Z = 0.42, cz = Math.cos(TILT_Z), sz = Math.sin(TILT_Z);

  function rotate(v, ax, ay) {
    var cx = Math.cos(ax), sx = Math.sin(ax);
    var cy = Math.cos(ay), sy = Math.sin(ay);
    // pre-tilt around Z
    var x0 = v[0] * cz - v[1] * sz;
    var y0 = v[0] * sz + v[1] * cz;
    var z0 = v[2];
    // spin around Y, then pitch around X
    var x = x0 * cy + z0 * sy;
    var z = -x0 * sy + z0 * cy;
    var y = y0 * cx - z * sx;
    z = y0 * sx + z * cx;
    return [x, y, z];
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  /* ---- Lighting -------------------------------------------------------- */
  var keyLight = norm([-0.6, 0.9, 0.7]);    // upper-left, toward viewer
  var accentLight = norm([0.95, -0.5, 0.35]); // lower-right green accent
  var viewDir = [0, 0, 1];

  /* ---- Render ---------------------------------------------------------- */
  function drawFrame() {
    ctx.clearRect(0, 0, width, height);

    var size = Math.min(width, height);
    var scale = size * 0.185;         // model radius 2 -> ~37% of min dimension
    var cx = width / 2, cy = height / 2;
    var camDist = 7.5;

    var ax = angleX + tiltX, ay = angleY + tiltY;

    var rotated = verts.map(function (v) { return rotate(v, ax, ay); });
    var projected = rotated.map(function (v) {
      var f = camDist / (camDist - v[2]);
      return [cx + v[0] * scale * f, cy - v[1] * scale * f];
    });

    var drawList = faces.map(function (face) {
      var p0 = rotated[face[0]], p1 = rotated[face[1]], p2 = rotated[face[2]], p3 = rotated[face[3]];
      var n = norm(cross(sub(p2, p0), sub(p3, p1)));
      var centroid = [
        (p0[0] + p1[0] + p2[0] + p3[0]) / 4,
        (p0[1] + p1[1] + p2[1] + p3[1]) / 4,
        (p0[2] + p1[2] + p2[2] + p3[2]) / 4
      ];
      // Ensure outward normal (points away from origin)
      if (dot(n, centroid) < 0) n = [-n[0], -n[1], -n[2]];
      return { face: face, n: n, depth: centroid[2] };
    });

    drawList.sort(function (a, b) { return a.depth - b.depth; });

    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.8, size * 0.0022);

    drawList.forEach(function (item) {
      var n = item.n;
      var facing = dot(n, viewDir);
      if (facing <= 0.02) return; // back-face cull

      var key = Math.max(0, dot(n, keyLight));
      var acc = Math.max(0, dot(n, accentLight));
      var rim = Math.pow(1 - facing, 2.2);

      var color = mix(palette.dark, palette.base, 0.15 + key * 0.85);
      color = mix(color, palette.light, Math.pow(key, 2.5) * 0.7);
      color = mix(color, palette.accent, Math.pow(acc, 1.8) * 0.7 + rim * 0.3);

      var f = item.face;
      ctx.beginPath();
      ctx.moveTo(projected[f[0]][0], projected[f[0]][1]);
      ctx.lineTo(projected[f[1]][0], projected[f[1]][1]);
      ctx.lineTo(projected[f[2]][0], projected[f[2]][1]);
      ctx.lineTo(projected[f[3]][0], projected[f[3]][1]);
      ctx.closePath();

      ctx.fillStyle = rgb(color);
      ctx.fill();
      ctx.strokeStyle = palette.edge;
      ctx.stroke();

      // Subtle specular sheen along the light direction on the brightest faces
      if (key > 0.85) {
        ctx.fillStyle = rgb(palette.light, (key - 0.85) * 1.2);
        ctx.fill();
      }
    });
  }

  function tick(now) {
    if (!running) return;
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;

    angleY += dt * 0.22;                     // ~29 s per revolution
    angleX = -0.55 + Math.sin(now * 0.00018) * 0.1;

    // ease toward pointer tilt
    tiltX += (targetTiltX - tiltX) * Math.min(1, dt * 4);
    tiltY += (targetTiltY - tiltY) * Math.min(1, dt * 4);

    drawFrame();
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduceMotion.matches || !visible || document.hidden) return;
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ---- Pointer parallax ------------------------------------------------ */
  if (!coarsePointer) {
    var hero = canvas.closest('.hero') || document.body;
    hero.addEventListener('pointermove', function (e) {
      if (reduceMotion.matches) return;
      var rect = hero.getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width - 0.5;
      var ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetTiltY = nx * 0.35;
      targetTiltX = ny * 0.25;
    });
    hero.addEventListener('pointerleave', function () {
      targetTiltX = 0; targetTiltY = 0;
    });
  }

  /* ---- Lifecycle ------------------------------------------------------- */
  readPalette();
  resize();

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries.some(function (en) { return en.isIntersecting; });
      if (visible) start(); else stop();
    }, { threshold: 0.05 }).observe(canvas);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  reduceMotion.addEventListener('change', function () {
    if (reduceMotion.matches) { stop(); tiltX = tiltY = 0; drawFrame(); }
    else start();
  });

  document.addEventListener('themechange', function () {
    readPalette();
    if (!running) drawFrame();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    readPalette();
    if (!running) drawFrame();
  });

  start();
})();
