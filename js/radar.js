/* ==========================================================================
   AdmitLab · 六维雷达 / 分享卡
   ========================================================================== */
(function (root) {
  'use strict';
  const C = root.ADMIT_CORE;
  const D = root.ADMIT_DATA;
  const DIMS = D.DIMS;

  const NS = 'http://www.w3.org/2000/svg';
  const CX = 220, CY = 202, R = 128, START = -Math.PI / 2, STEP = Math.PI / 3;
  const cache = new WeakMap();

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    return n;
  }

  function angle(i) { return START + i * STEP; }
  function point(i, value) {
    const a = angle(i), r = R * C.clamp(value, 0, 100) / 100;
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
  }
  function poly(values) {
    return DIMS.map((d, i) => [i, values[d.key]])
      .filter((pair) => pair[1] !== null && pair[1] !== undefined && !isNaN(pair[1]))
      .map((pair) => point(pair[0], pair[1]).map((n) => C.round(n, 2)).join(','))
      .join(' ');
  }

  /* ---------------- 初始化骨架 ---------------- */
  function mount(svg) {
    if (!svg || cache.has(svg)) return;
    svg.innerHTML = '';
    const defs = el('defs');
    const grad = el('radialGradient', { id: 'radarFill', cx: '50%', cy: '50%', r: '50%' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#6ee7b7', 'stop-opacity': '.30' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#34d399', 'stop-opacity': '.08' }));
    defs.appendChild(grad);
    const glow = el('filter', { id: 'dotGlow', x: '-200%', y: '-200%', width: '400%', height: '400%' });
    glow.appendChild(el('feGaussianBlur', { stdDeviation: '3', result: 'b' }));
    const merge = el('feMerge');
    merge.appendChild(el('feMergeNode', { in: 'b' }));
    merge.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(merge);
    defs.appendChild(glow);
    svg.appendChild(defs);

    const gGrid = el('g', { class: 'radar-grid' });
    for (let ring = 1; ring <= 5; ring++) {
      const v = ring * 20;
      const pts = DIMS.map((d, i) => point(i, v).map((n) => C.round(n, 2)).join(',')).join(' ');
      gGrid.appendChild(el('polygon', {
        points: pts, fill: ring % 2 === 0 ? 'rgba(255,255,255,.012)' : 'none',
        stroke: 'rgba(255,255,255,' + (ring === 5 ? '.13' : '.055') + ')', 'stroke-width': '1'
      }));
    }
    DIMS.forEach((d, i) => {
      const a = angle(i), x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R;
      gGrid.appendChild(el('line', {
        x1: CX, y1: CY, x2: x, y2: y, stroke: 'rgba(255,255,255,.07)', 'stroke-width': '1'
      }));
    });
    svg.appendChild(gGrid);

    const gOverlay = el('g', { class: 'radar-overlays' });
    svg.appendChild(gOverlay);

    const gBand = el('g', { class: 'radar-band' });
    const bandPath = el('path', {
      d: '', fill: 'rgba(110,231,183,.16)', 'fill-rule': 'evenodd', stroke: 'none'
    });
    gBand.appendChild(bandPath);
    const bandLow = el('polygon', {
      points: '', fill: 'none', stroke: 'rgba(110,231,183,.55)', 'stroke-width': '1.2',
      'stroke-dasharray': '4 4', 'stroke-linejoin': 'round'
    });
    gBand.appendChild(bandLow);

    const gMain = el('g', { class: 'radar-main' });
    const shape = el('polygon', {
      points: poly({}), fill: 'rgba(110,231,183,.10)', stroke: '#6ee7b7', 'stroke-width': '2',
      'stroke-linejoin': 'round'
    });
    gMain.appendChild(shape);
    const dots = DIMS.map(() => {
      const c = el('circle', { r: '3.4', fill: '#6ee7b7', stroke: '#04140d', 'stroke-width': '1.4' });
      c.style.filter = 'drop-shadow(0 0 6px rgba(110,231,183,.9))';
      gMain.appendChild(c);
      return c;
    });
    svg.appendChild(gMain);
    svg.appendChild(gBand);

    const gLabels = el('g', { class: 'radar-labels' });
    const labels = DIMS.map((d, i) => {
      const a = angle(i);
      const cos = Math.cos(a), sin = Math.sin(a);
      const lx = CX + cos * (R + 30);
      const ly = CY + sin * (R + 30) + (Math.abs(cos) < 0.25 ? (sin > 0 ? 12 : -6) : 0);
      const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
      const t = el('text', {
        x: C.round(lx, 2), y: C.round(ly, 2), 'text-anchor': anchor,
        'font-size': '12.5', 'font-weight': '600', fill: '#c7d2e6', 'letter-spacing': '.02em'
      });
      const name = document.createElementNS(NS, 'tspan');
      name.textContent = d.name;
      t.appendChild(name);
      const v = document.createElementNS(NS, 'tspan');
      v.setAttribute('x', C.round(lx, 2));
      v.setAttribute('dy', '15');
      v.setAttribute('font-size', '12');
      v.setAttribute('font-weight', '500');
      v.setAttribute('fill', d.color);
      v.setAttribute('style', 'font-family:var(--mono)');
      v.textContent = '0';
      t.appendChild(v);
      gLabels.appendChild(t);
      return v;
    });
    svg.appendChild(gLabels);

    cache.set(svg, { shape, dots, labels, overlay: gOverlay, band: bandPath, bandLow, values: {}, anim: null });
  }

  /* ---------------- 更新（带动画） ---------------- */
  function loopPath(values) {
    const pts = DIMS.map((d, i) => [i, values[d.key]]).filter((p) => p[1] !== null && p[1] !== undefined);
    if (pts.length < 3) return '';
    return pts.map((p, k) => {
      const xy = point(p[0], p[1]);
      return (k === 0 ? 'M' : 'L') + C.round(xy[0], 2) + ' ' + C.round(xy[1], 2);
    }).join(' ') + ' Z';
  }

  function update(svg, values, overlays, band) {
    mount(svg);
    const st = cache.get(svg);
    if (!st) return;
    const from = Object.assign({}, st.values);
    const to = {};
    DIMS.forEach((d) => {
      const v = values[d.key];
      to[d.key] = v === null || v === undefined ? null : C.clamp(v, 0, 100);
    });

    /* 预估区间带 */
    if (st.band) {
      const d = band ? (loopPath(band.high) + ' ' + loopPath(band.low)) : '';
      st.band.setAttribute('d', d);
      st.band.style.display = d ? '' : 'none';
    }
    if (st.bandLow) {
      const pts = band ? poly(band.low) : '';
      st.bandLow.setAttribute('points', pts);
      st.bandLow.style.display = pts ? '' : 'none';
    }

    /* 叠加对比图形 */
    st.overlay.innerHTML = '';
    (overlays || []).forEach((o) => {
      if (!o || !o.values) return;
      const p = el('polygon', {
        points: poly(o.values),
        fill: o.fill || 'none',
        stroke: o.color || '#a78bfa',
        'stroke-width': o.width || '1.6',
        'stroke-dasharray': o.dash || '6 5',
        'stroke-linejoin': 'round',
        opacity: o.opacity == null ? 0.9 : o.opacity
      });
      st.overlay.appendChild(p);
      DIMS.forEach((d, i) => {
        if (o.values[d.key] === null || o.values[d.key] === undefined) return;
        const [x, y] = point(i, o.values[d.key]);
        st.overlay.appendChild(el('circle', { cx: x, cy: y, r: '2.2', fill: o.color || '#a78bfa', opacity: '.85' }));
      });
    });

    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const dur = reduce ? 0 : 560;
    if (st.anim) cancelAnimationFrame(st.anim);

    function frame(now) {
      const t = dur ? C.clamp((now - start) / dur, 0, 1) : 1;
      const e = 1 - Math.pow(1 - t, 3);
      const cur = {};
      DIMS.forEach((d) => {
        const target = to[d.key];
        if (target == null) { cur[d.key] = null; return; }
        const f = from[d.key];
        cur[d.key] = f == null ? target * e : f + (target - f) * e;
      });
      st.shape.setAttribute('points', poly(cur));
      DIMS.forEach((d, i) => {
        if (cur[d.key] == null) {
          st.dots[i].setAttribute('r', '0');
          st.labels[i].textContent = '—';
          return;
        }
        st.dots[i].setAttribute('r', '3.4');
        const [x, y] = point(i, cur[d.key]);
        st.dots[i].setAttribute('cx', C.round(x, 2));
        st.dots[i].setAttribute('cy', C.round(y, 2));
        if (band && band.high && band.high[d.key] != null && band.high[d.key] - band.low[d.key] >= 1) {
          st.labels[i].textContent = Math.round(band.low[d.key]) + '–' + Math.round(band.high[d.key]);
        } else {
          st.labels[i].textContent = Math.round(cur[d.key]);
        }
      });
      if (t < 1) st.anim = requestAnimationFrame(frame);
      else { st.values = to; st.anim = null; }
    }
    st.anim = requestAnimationFrame(frame);
  }

  /* ---------------- 分享卡 ---------------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  }

  function drawRadar(ctx, cx, cy, radius, values, opts) {
    opts = opts || {};
    const rings = 5;
    ctx.save();
    ctx.translate(cx, cy);
    for (let ring = 1; ring <= rings; ring++) {
      const r = radius * ring / rings;
      ctx.beginPath();
      for (let i = 0; i < DIMS.length; i++) {
        const a = START + i * Math.PI / 3;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === rings ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (ring === 5) { ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fill(); }
    }
    for (let i = 0; i < DIMS.length; i++) {
      const a = START + i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.stroke();
    }

    if (opts.overlay) {
      const pts = DIMS.map((d, i) => ({ i, v: opts.overlay[d.key] }))
        .filter((p) => p.v !== null && p.v !== undefined);
      if (pts.length > 2) {
        ctx.beginPath();
        pts.forEach((p, k) => {
          const a = START + p.i * Math.PI / 3;
          const r = radius * C.clamp(p.v || 0, 0, 100) / 100;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = opts.overlayColor || 'rgba(167,139,250,.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const pts = DIMS.map((d, i) => ({ i, v: values[d.key] })).filter((p) => p.v !== null && p.v !== undefined);
    if (pts.length >= 3) {
      ctx.beginPath();
      pts.forEach((p, k) => {
        const a = START + p.i * Math.PI / 3;
        const r = radius * C.clamp(p.v || 0, 0, 100) / 100;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, radius);
      grad.addColorStop(0, 'rgba(110,231,183,.42)');
      grad.addColorStop(1, 'rgba(52,211,153,.10)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    pts.forEach((p) => {
      const a = START + p.i * Math.PI / 3;
      const r = radius * C.clamp(p.v || 0, 0, 100) / 100;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#6ee7b7';
      ctx.fill();
      ctx.strokeStyle = '#04140d';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    DIMS.forEach((d, i) => {
      const a = START + i * Math.PI / 3;
      const v = values[d.key];
      const lx = Math.cos(a) * (radius + 44);
      const ly = Math.sin(a) * (radius + 44);
      ctx.textAlign = Math.abs(Math.cos(a)) < 0.25 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
      ctx.textBaseline = 'middle';
      ctx.font = '600 22px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(233,237,248,.92)';
      ctx.fillText(d.name, lx, ly - 13);
      ctx.font = '500 21px "SFMono-Regular",Consolas,monospace';
      ctx.fillStyle = d.color;
      ctx.fillText(v === null || v === undefined ? '—' : String(Math.round(v)), lx, ly + 14);
    });
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth, maxLines) {
    const lines = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
      const test = cur + text[i];
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = text[i];
        if (lines.length === maxLines) break;
      } else cur = test;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines) {
      let last = lines[maxLines - 1];
      if (last.length < text.length && ctx.measureText(last).width > maxWidth - 18) {
        lines[maxLines - 1] = fitText(ctx, last, maxWidth - 18);
      }
    }
    return lines;
  }

  function exportCard(data) {
    const W = 1080, H = 1440;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#080c16');
    bg.addColorStop(0.55, '#0b1120');
    bg.addColorStop(1, '#0a0e1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glowA = ctx.createRadialGradient(160, 80, 0, 160, 80, 620);
    glowA.addColorStop(0, 'rgba(110,231,183,.20)');
    glowA.addColorStop(1, 'rgba(110,231,183,0)');
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, W, H);

    const glowB = ctx.createRadialGradient(980, 1260, 0, 980, 1260, 560);
    glowB.addColorStop(0, 'rgba(167,139,250,.18)');
    glowB.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 2;
    roundRect(ctx, 34, 34, W - 68, H - 68, 34);
    ctx.stroke();

    /* 页眉 */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 24px "SFMono-Regular",Consolas,monospace';
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText('ADMITLAB', 76, 108);
    ctx.font = '500 22px "SFMono-Regular",Consolas,monospace';
    ctx.fillStyle = 'rgba(147,160,186,.9)';
    ctx.textAlign = 'right';
    ctx.fillText('六维录取实验室 · AP · 中国 · 美本', W - 76, 108);

    /* 标题区 */
    ctx.textAlign = 'left';
    ctx.font = '700 56px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#f2f6ff';
    ctx.fillText(fitText(ctx, data.title || '我的六维录取画像', W - 152), 76, 192);

    ctx.font = '600 28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(167,139,250,.96)';
    ctx.fillText(fitText(ctx, data.persona.name, 640), 76, 242);

    ctx.font = '400 21px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(147,160,186,.92)';
    ctx.fillText('综合战力 ' + (data.powerRange || data.power) + ' / 100 · 评级 ' + data.rating, 76, 280);

    /* 雷达 */
    drawRadar(ctx, W / 2, 596, 220, data.scores, {
      overlay: data.cohortValues || null,
      overlayColor: 'rgba(167,139,250,.7)'
    });

    if (data.cohortValues) {
      ctx.textAlign = 'right';
      ctx.font = '500 19px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(167,139,250,.9)';
      ctx.fillText('虚线 = ' + data.cohortLabel, W - 76, 280);
    }

    /* 六维分数 */
    const cw = (W - 152) / 6;
    DIMS.forEach((d, i) => {
      const x = 76 + i * cw;
      const sc = data.scores[d.key];
      const r = data.ranges && data.ranges[d.key];
      const ranged = sc != null && r && r.high - r.low >= 1;
      const label = sc == null ? '—' : (ranged ? Math.round(r.low) + '–' + Math.round(r.high) : String(Math.round(sc)));
      ctx.textAlign = 'center';
      ctx.font = '500 20px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(147,160,186,.95)';
      ctx.fillText(d.name, x + cw / 2 - 6, 940);
      ctx.font = '600 ' + (ranged ? 30 : 40) + 'px "SFMono-Regular",Consolas,monospace';
      ctx.fillStyle = d.color;
      ctx.fillText(label, x + cw / 2 - 6, 986);
      if (data.deltas && data.deltas[d.key] != null) {
        const dv = data.deltas[d.key];
        ctx.font = '500 17px "SFMono-Regular",Consolas,monospace';
        ctx.fillStyle = dv >= 0 ? 'rgba(110,231,183,.85)' : 'rgba(251,113,133,.85)';
        ctx.fillText((dv >= 0 ? '+' : '') + dv, x + cw / 2 - 6, 1010);
      }
    });

    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(76, 1044);
    ctx.lineTo(W - 76, 1044);
    ctx.stroke();

    /* 选校 */
    ctx.textAlign = 'left';
    ctx.font = '600 24px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#e9edf8';
    ctx.fillText('冲刺 / 匹配 / 保底，各一所', 76, 1092);

    const tierColor = { reach: '#fbbf24', match: '#7dd3fc', safe: '#6ee7b7', dream: '#fb7185' };
    (data.schools || []).slice(0, 3).forEach((r, i) => {
      const y = 1142 + i * 56;
      ctx.font = '600 25px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = tierColor[r.tier] || '#e9edf8';
      ctx.textAlign = 'left';
      ctx.fillText(fitText(ctx, r.school.name, 300), 76, y);
      ctx.font = '400 18px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(147,160,186,.85)';
      ctx.fillText(fitText(ctx, r.school.en, 270), 386, y);
      const barX = 700, barW = 250;
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      roundRect(ctx, barX, y - 14, barW, 8, 4); ctx.fill();
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, 'rgba(110,231,183,.3)');
      g.addColorStop(1, '#6ee7b7');
      ctx.fillStyle = g;
      roundRect(ctx, barX, y - 14, Math.max(6, barW * r.fit / 100), 8, 4); ctx.fill();
      ctx.font = '600 22px "SFMono-Regular",Consolas,monospace';
      ctx.fillStyle = '#6ee7b7';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(r.fit)), W - 76, y);
    });

    /* 一句诊断 */
    if (data.persona && data.persona.desc) {
      ctx.textAlign = 'left';
      ctx.font = '400 20px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(147,160,186,.85)';
      const lines = wrapText(ctx, data.persona.desc, W - 152, 2);
      lines.forEach((line, i) => ctx.fillText(line, 76, 1322 + i * 32));
    }

    ctx.font = '400 18px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(100,112,138,.9)';
    ctx.textAlign = 'left';
    ctx.fillText('娱乐向模型 · 不构成录取承诺 · ' + (data.date || ''), 76, H - 58);

    return canvas;
  }

  root.ADMIT_RADAR = { mount, update, exportCard, drawRadar };
})(typeof window !== 'undefined' ? window : globalThis);
