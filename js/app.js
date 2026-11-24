/* ==========================================================================
   AdmitLab · 界面逻辑
   ========================================================================== */
(function () {
  'use strict';
  const D = window.ADMIT_DATA, C = window.ADMIT_CORE, R = window.ADMIT_RADAR;
  const DIMS = D.DIMS;
  const KEY = 'admitlab.v5';

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const TIERS = ['safe', 'match', 'reach', 'dream'];
  const TIER = {
    safe: { label: '保底', color: '#6ee7b7' },
    match: { label: '匹配', color: '#7dd3fc' },
    reach: { label: '冲刺', color: '#fbbf24' },
    dream: { label: '梦校', color: '#fb7185' }
  };

  let state = null;
  let view = null;
  let timer = null;
  let toastTimer = null;
  let editingYear = null;
  let storageOk = true;

  /* ======================================================================
     状态
     ====================================================================== */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return C.sanitize(JSON.parse(raw));
    } catch (err) { storageOk = false; }
    return C.loadSample('t30');
  }

  function saveState() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { storageOk = false; }
  }

  function recalc() {
    const c = C.computeScores(state.profile, state.manual, { skip: state.skip, estimates: state.estimates });
    const power = C.powerOf(c.scores);
    const pr = C.powerRange(c.scores, c.ranges);
    view = {
      c,
      scores: c.scores,
      auto: c.auto,
      locked: c.locked,
      ranges: c.ranges,
      skipped: c.skipped,
      power,
      powerLow: pr.low,
      powerHigh: pr.high,
      persona: C.personaOf(c.scores),
      rating: C.ratingOf(power),
      results: C.matchAll(c.scores, { ranges: c.ranges, bg: state.bg })
    };
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(renderAll, 150);
  }

  const fmtPct = (p) => (p < 0.01 ? '<1%' : Math.round(p * 100) + '%');
  const fmtRate = (r) => (r < 0.01 ? '<1%' : Math.round(r * 100) + '%');
  const fmtScore = (n) => Math.round(n * 10) / 10;

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? null : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const parts = path.split('.');
    const last = parts.pop();
    let o = obj;
    parts.forEach((k) => { o = o[k]; });
    o[last] = val;
  }

  function dimsToObj(arr) {
    const o = {};
    DIMS.forEach((d, i) => { o[d.key] = arr[i] == null ? 0 : arr[i]; });
    return o;
  }

  function schoolValues(school) {
    const o = {};
    DIMS.forEach((d, i) => { o[d.key] = school.blind && d.key === 'test' ? null : school.dims[i]; });
    return o;
  }

  function activeCohort() {
    if (!D.COHORT_ENABLED) return null;
    return C.cohortById(state, state.ui.activeCohort) || (state.cohorts || [])[0] || null;
  }

  /* ======================================================================
     渲染：输入区
     ====================================================================== */
  const AP_OPTIONS = D.AP_SUBJECTS.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');

  function compTierOptions(selected) {
    let html = '';
    D.COMP_TIERS.forEach((t) => {
      html += `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${t.label} · ${t.pts} 分 · ${esc(t.title)}</option>`;
    });
    const customs = state.customRubric.filter((x) => x.kind === 'comp');
    if (customs.length) {
      html += '<optgroup label="我的自定义">';
      customs.forEach((x) => {
        const v = 'custom:' + x.id;
        html += `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(x.name)} · ${x.pts} 分</option>`;
      });
      html += '</optgroup>';
    }
    return html;
  }

  function actTierOptions(selected) {
    return D.ACT_TIERS.map((t) =>
      `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${t.label} · ${t.pts} 分 · ${esc(t.title)}</option>`).join('');
  }

  function options(list, selected, valueKey, labelKey, prefix) {
    return list.map((x) => {
      const v = prefix ? prefix + x[valueKey] : x[valueKey];
      return `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(x[labelKey])}</option>`;
    }).join('');
  }

  function renderRows() {
    /* AP */
    const aps = state.profile.aps || [];
    $('[data-rows="aps"]').innerHTML = aps.length ? aps.map((a, i) => `
      <div class="row-item">
        <div class="row-line">
          <select class="grow" data-row="aps" data-idx="${i}" data-field="subject" aria-label="AP 科目">
            ${D.AP_SUBJECTS.map((s) => `<option value="${esc(s.name)}"${s.name === a.subject ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
          <select style="flex:0 0 92px" data-row="aps" data-idx="${i}" data-field="score" aria-label="AP 分数">
            ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${+a.score === n ? ' selected' : ''}>${n} 分</option>`).join('')}
          </select>
          <span class="pts-wrap"><span>折合</span><b>${D.AP_SCORE_POINTS[a.score] != null ? D.AP_SCORE_POINTS[a.score] : 40}</b></span>
          <button class="del" type="button" data-del="aps" data-idx="${i}" aria-label="删除这门 AP">×</button>
        </div>
      </div>`).join('') : '<div class="row-empty">还没有填 AP。AP 门数和分数是美本申请里最硬的一块证据。</div>';

    /* 竞赛 */
    const comps = state.profile.comps || [];
    $('[data-rows="comps"]').innerHTML = comps.length ? comps.map((c, i) => {
      const sel = c.customId ? 'custom:' + c.customId : c.tierId;
      const pts = C.compPoints(c, state.customRubric);
      const example = C.compExample(c) || (c.customId ? '自定义分值，可手改' : '');
      return `
      <div class="row-item">
        <div class="row-line">
          <input class="grow" type="text" maxlength="50" placeholder="赛事名称（可选），如 IMO 银牌 / AMC 12 前 1%" value="${esc(c.name || '')}" data-row="comps" data-idx="${i}" data-field="name" aria-label="竞赛名称">
          <div class="pts-wrap"><span>分值</span><input class="pts" type="number" min="0" max="100" step="1" value="${pts}" data-row="comps" data-idx="${i}" data-field="points" aria-label="竞赛分值"></div>
          <button class="del" type="button" data-del="comps" data-idx="${i}" aria-label="删除这个竞赛">×</button>
        </div>
        <div class="row-line">
          <select style="flex:0 0 112px" data-row="comps" data-idx="${i}" data-field="subject" aria-label="竞赛学科">
            ${options(D.COMP_SUBJECTS, c.subject || 'other', 'id', 'name')}
          </select>
          <select class="grow" data-row="comps" data-idx="${i}" data-field="tierId" aria-label="竞赛档位">
            ${compTierOptions(sel)}
          </select>
        </div>
        <div class="comp-hint">${esc(example)}</div>
      </div>`;
    }).join('') : '<div class="row-empty">还没有竞赛。选一个学科和档位，分值会自动填。</div>';

    /* 活动 */
    const acts = state.profile.acts || [];
    $('[data-rows="acts"]').innerHTML = acts.length ? acts.map((a, i) => {
      const tier = C.actTier(a);
      return `
      <div class="row-item">
        <div class="row-line">
          <input class="grow" type="text" maxlength="40" placeholder="活动名称，如：校刊主编 / AI 手语翻译项目" value="${esc(a.name || '')}" data-row="acts" data-idx="${i}" data-field="name" aria-label="活动名称">
          <div class="pts-wrap"><span>分值</span><input class="pts" type="number" min="0" max="70" step="1" value="${C.actPoints(a)}" data-row="acts" data-idx="${i}" data-field="points" aria-label="活动分值"></div>
          <button class="del" type="button" data-del="acts" data-idx="${i}" aria-label="删除这项活动">×</button>
        </div>
        <div class="row-line">
          <select style="flex:0 0 136px" data-row="acts" data-idx="${i}" data-field="type" aria-label="活动类型">
            ${options(D.ACT_TYPES, a.type, 'id', 'name')}
          </select>
          <select class="grow" data-row="acts" data-idx="${i}" data-field="tierId" aria-label="活动档位">
            ${actTierOptions(a.tierId)}
          </select>
        </div>
        <div class="comp-hint">${esc(tier ? tier.example : '选一个档位，分值会自动填')}</div>
      </div>`;
    }).join('') : '<div class="row-empty">还没有活动。选一个档位（比如校级社长 38 分），分值会自动填。</div>';
  }

  function renderSliders() {
    const e = state.profile.essay || {};
    const sets = [
      { key: 'rec', checks: D.REC_CHECKS, vals: e.rec || {} },
      { key: 'interview', checks: D.INTERVIEW_CHECKS, vals: e.interview || {} },
      { key: 'essay', checks: D.ESSAY_CHECKS, vals: e.checks || {} }
    ];
    sets.forEach((set) => {
      const box = $('[data-sliders="' + set.key + '"]');
      if (!box) return;
      box.innerHTML = set.checks.map((c) => {
        const v = set.vals[c.key] == null ? 0 : set.vals[c.key];
        return `<div class="slider">
          <div class="slider-top"><span>${esc(c.name)}</span><b data-check-val="${set.key}.${c.key}">${v}</b></div>
          <input type="range" min="0" max="10" step="1" value="${v}" data-check="${set.key}.${c.key}" aria-label="${esc(c.name)}">
          <span class="hint" style="font-size:10.5px">${esc(c.hint)}</span>
        </div>`;
      }).join('');
    });
    const third = $('[data-third]');
    if (third) third.checked = !!(e.interview && e.interview.thirdParty);
  }

  function buildDimExtras() {
    DIMS.forEach((d) => {
      const card = document.getElementById('card-' + d.key);
      if (!card) return;
      const manual = $('.manual-row', card);
      if (!manual || $('[data-skip="' + d.key + '"]')) return;
      manual.insertAdjacentHTML('beforeend',
        `<label class="skip-check"><input type="checkbox" data-skip="${d.key}"><span></span>没有这项</label>`);
      manual.insertAdjacentHTML('afterend',
        `<div class="est-row">
          <label class="switch"><input type="checkbox" data-est="${d.key}"><span></span>预估区间</label>
          <input type="number" min="0" max="100" step="1" data-est-low="${d.key}" aria-label="不理想预估" placeholder="不理想" disabled>
          <span class="est-dash">–</span>
          <input type="number" min="0" max="100" step="1" data-est-high="${d.key}" aria-label="理想预估" placeholder="理想" disabled>
        </div>`);
    });
  }

  function syncControls() {
    DIMS.forEach((d) => {
      const card = document.getElementById('card-' + d.key);
      if (!card) return;
      const skipped = !!state.skip[d.key];
      const est = state.estimates[d.key];
      card.classList.toggle('is-skipped', skipped);
      const skip = $('[data-skip="' + d.key + '"]');
      if (skip) skip.checked = skipped;
      const cb = $('[data-est="' + d.key + '"]');
      const lo = $('[data-est-low="' + d.key + '"]');
      const hi = $('[data-est-high="' + d.key + '"]');
      if (cb) { cb.checked = !!est; cb.disabled = skipped; }
      if (lo) { lo.disabled = skipped || !est; lo.value = est ? est.low : ''; }
      if (hi) { hi.disabled = skipped || !est; hi.value = est ? est.high : ''; }
      const lock = $('[data-lock="' + d.key + '"]');
      const range = $('[data-manual="' + d.key + '"]');
      if (lock) lock.disabled = skipped;
      if (range) range.disabled = skipped || !(lock && lock.checked);
    });
  }

  function syncInputs() {
    $$('[data-bind]').forEach((el) => {
      const v = getPath(state.profile, el.dataset.bind);
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = v == null ? '' : v;
      }
    });
    $$('[data-lock]').forEach((cb) => {
      const k = cb.dataset.lock;
      const locked = state.manual[k] != null;
      cb.checked = locked;
      const range = $('[data-manual="' + k + '"]');
      if (range) {
        range.disabled = !locked;
        range.value = locked ? state.manual[k] : Math.round(view ? view.scores[k] : 0);
      }
      const out = $('[data-manual-out="' + k + '"]');
      if (out) out.textContent = locked ? Math.round(state.manual[k]) : '';
    });
    const essay = $('#essayDraft');
    if (essay) essay.value = (state.profile.essay && state.profile.essay.text) || '';
    renderSliders();
    syncControls();
  }

  /* ======================================================================
     渲染：驾驶舱
     ====================================================================== */
  function rangeText(r) {
    return r && r.high - r.low >= 1 ? Math.round(r.low) + '–' + Math.round(r.high) : null;
  }

  function renderBg() {
    const grid = $('#bgGrid');
    if (!grid) return;
    grid.innerHTML = D.BG_FACTORS.map((f) => `
      <label class="bg-item${state.bg[f.key] ? ' on' : ''}">
        <input type="checkbox" data-bg="${f.key}"${state.bg[f.key] ? ' checked' : ''}>
        <span class="bg-box"></span>
        <span class="bg-text"><b>${esc(f.name)}</b><small>${esc(f.hint)}</small></span>
      </label>`).join('');
    const avg = view.results.length ? view.results.reduce((a, r) => a + r.bgAdj, 0) / view.results.length : 0;
    const rounded = Math.round(avg * 10) / 10;
    $('#bgTotal').textContent = (rounded >= 0 ? '+' : '') + rounded + ' 平均';
  }

  function renderBgChip() {
    const chip = $('#bgChip');
    if (!chip) return;
    const names = D.BG_FACTORS.filter((f) => state.bg[f.key]).map((f) => f.name);
    chip.innerHTML = '<span>' + (state.bg.domestic ? 'domestic 池' : '国际生池') + '</span>' +
      names.map((n) => '<span class="up">' + esc(n) + '</span>').join('');
  }

  function renderBadges() {
    DIMS.forEach((d) => {
      const badge = $('[data-badge="' + d.key + '"]');
      if (!badge) return;
      const b = badge.querySelector('b');
      const v = view.scores[d.key];
      if (v == null) {
        b.textContent = '—';
        badge.classList.add('locked');
      } else {
        const rt = rangeText(view.ranges[d.key]);
        b.textContent = rt || Math.round(v);
        badge.classList.toggle('locked', !!view.locked[d.key]);
      }
    });
    $$('[data-manual]').forEach((range) => {
      const k = range.dataset.manual;
      if (state.manual[k] == null) {
        range.value = view.scores[k] == null ? 0 : Math.round(view.scores[k]);
        const out = $('[data-manual-out="' + k + '"]');
        if (out) out.textContent = '';
      }
    });
  }

  /* ======================================================================
     成长记录 / 下一步
     ====================================================================== */
  const EFFORT = { gpa: '1 个学期', test: '6–10 周', ap: '1 个学期', comp: '3–6 个月', act: '1 个学期', essay: '2–4 周' };

  function snapshotNow() {
    const ts = Date.now();
    return {
      id: 's' + ts,
      ts,
      label: new Date(ts).toLocaleDateString('zh-CN'),
      scores: Object.assign({}, view.scores),
      ranges: view.ranges,
      power: view.power,
      persona: view.persona.name
    };
  }

  function saveSnapshot() {
    if (!view.power) { toast('先填几个数字再保存快照'); return; }
    state.snapshots = (state.snapshots || []).concat([snapshotNow()]).slice(-20);
    saveState();
    renderGrowth();
    toast('已保存快照 · ' + new Date().toLocaleDateString('zh-CN'));
  }

  function renderGrowth() {
    const box = $('#growthMain');
    if (!box) return;
    const list = (state.snapshots || []).slice().sort((a, b) => a.ts - b.ts);
    const last = list[list.length - 1];
    const prev = list[list.length - 2];

    if (!last) {
      box.innerHTML = `<div class="growth-empty">
        <span>◎</span>
        <h3>还没有快照</h3>
        <p>现在保存第一张，过几周再回来，就能看到自己长了多少。</p>
        <button class="btn primary small" type="button" data-snap-now>保存第一张快照</button>
      </div>`;
      return;
    }

    const delta = Math.round((view.power - last.power) * 10) / 10;
    let topGain = null;
    DIMS.forEach((d) => {
      if (view.scores[d.key] == null || last.scores[d.key] == null) return;
      const diff = Math.round((view.scores[d.key] - last.scores[d.key]) * 10) / 10;
      if (!topGain || diff > topGain.diff) topGain = { name: d.name, diff };
    });
    const sign = (n) => (n > 0 ? '+' : '') + n;

    const summary = `<div class="growth-summary">
      <div class="gs-main">
        <span>距上次快照</span>
        <b class="${delta >= 0 ? 'up' : 'down'}">${sign(delta)}</b>
        <small>综合战力</small>
      </div>
      <div class="gs-sub">
        <span>现在 <b>${fmtScore(view.power)}</b> · ${esc(last.label)} <b>${fmtScore(last.power)}</b></span>
        <span>${topGain && topGain.diff !== 0 ? '变化最大：' + esc(topGain.name) + ' ' + sign(topGain.diff) : '六维和上次持平'}</span>
      </div>
    </div>`;

    const items = list.slice().reverse().map((s, idx) => {
      const older = list[list.length - 1 - idx - 1];
      const d = older ? Math.round((s.power - older.power) * 10) / 10 : 0;
      const bars = DIMS.map((dim) => {
        const v = s.scores[dim.key];
        return `<i title="${dim.name} ${v == null ? '—' : Math.round(v)}" style="height:${v == null ? 2 : Math.max(4, v * 0.32)}px;background:${dim.color}"></i>`;
      }).join('');
      return `<div class="snap-row">
        <div class="snap-date"><b>${esc(s.label)}</b><span>${esc(s.persona || '')}</span></div>
        <div class="snap-bars">${bars}</div>
        <div class="snap-power"><b>${fmtScore(s.power)}</b>${older ? `<em class="${d >= 0 ? 'up' : 'down'}">${sign(d)}</em>` : '<em>起点</em>'}</div>
        <button class="snap-del" type="button" data-snap-del="${s.id}" aria-label="删除快照">×</button>
      </div>`;
    }).join('');

    box.innerHTML = summary + `<div class="snap-list">${items}</div>
      <p class="hint growth-note">最多保留 20 张快照。换设备时用「导出存档」带走。</p>`;
  }

  function renderTasks() {
    const box = $('#growthSide');
    if (!box) return;
    const tasks = state.tasks || [];
    const done = tasks.filter((t) => t.done).length;
    const head = `<div class="task-head"><div><h3>下一步</h3><p>挑收益最高的三件事，本周先做一件。</p></div>
      ${tasks.length ? `<span class="task-progress">${done}/${tasks.length}</span>` : ''}</div>`;

    if (!tasks.length) {
      box.innerHTML = head + `<div class="growth-empty small">
        <p>根据你现在的六维，生成一份可执行清单。</p>
        <button class="btn primary small" type="button" data-task-gen>生成下一步</button>
      </div>`;
      return;
    }

    const rows = tasks.map((t) => `<label class="task${t.done ? ' done' : ''}">
      <input type="checkbox" data-task="${esc(t.id)}"${t.done ? ' checked' : ''}>
      <span class="task-box"></span>
      <span class="task-text"><b>${esc(t.text)}</b>
        <small>预计 +${t.gain} · ${esc(t.effort)}</small></span>
    </label>`).join('');

    box.innerHTML = head + `<div class="task-list">${rows}</div>
      <div class="task-foot">
        <button class="btn ghost small" type="button" data-task-gen>重新生成</button>
        <button class="btn ghost small" type="button" data-task-clear>清空</button>
      </div>`;
  }

  function generateTasks() {
    const pool = DIMS.map((d) => {
      const adv = C.adviceFor(d.key, state.profile, view.scores);
      let text = adv.text.replace(/，这一维 \+\d+(?:\.\d+)?$/, '').replace(/（[^）]*）/g, '').replace(/[，,]\s*$/, '');
      if (text.length > 64) text = text.slice(0, 62) + '…';
      return { dim: d.key, name: d.name, text, gain: adv.gain };
    }).filter((t) => t.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);
    if (!pool.length) { toast('六维已经很满，暂时没有可加分的建议'); return; }
    state.tasks = pool.map((t, i) => ({
      id: 't' + Date.now() + i, dim: t.dim, text: t.text, gain: t.gain,
      effort: EFFORT[t.dim] || '按自己的节奏', done: false
    }));
    saveState();
    renderTasks();
    toast('已生成 ' + pool.length + ' 条下一步');
  }

  function exportArchive() {
    const payload = {
      app: 'AdmitLab',
      version: D.VERSION,
      exportedAt: new Date().toISOString(),
      state
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AdmitLab-存档-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('存档已导出，换设备时导入即可');
    } catch (err) {
      toast('导出失败，换个浏览器试试');
    }
  }

  function importArchive(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        const raw = payload.state || payload;
        if (!raw || !raw.profile) throw new Error('bad file');
        if (!window.confirm('导入会覆盖当前数据（包括快照和清单），确定吗？')) return;
        state = C.sanitize(raw);
        syncInputs();
        renderRows();
        renderAll();
        renderGrowth();
        saveState();
        toast('存档已导入');
      } catch (err) {
        toast('这个文件看不懂，换一个试试');
      }
    };
    reader.readAsText(file);
  }

  function renderDashboard() {
    const p = view.persona;
    $('#personaGrade').textContent = view.rating;
    $('#personaName').textContent = p.name;
    $('#personaDesc').textContent = p.desc;
    const prt = view.powerHigh - view.powerLow >= 1 ? view.powerLow + '–' + view.powerHigh : fmtScore(view.power);
    $('#statPower').textContent = prt;
    $('#statPowerNote').style.display = view.powerHigh - view.powerLow >= 1 ? 'none' : '';
    $('#statTop').textContent = p.top.name;
    $('#statTopVal').textContent = Math.round(p.max) + ' 分';
    $('#statWeak').textContent = p.low.name;
    $('#statWeakVal').textContent = Math.round(p.min) + ' 分';

    const safes = view.results.filter((r) => r.tier === 'safe');
    const pick = safes[0] || view.results[0];
    if (pick) {
      $('#statSafe').textContent = C.shortName(pick.school);
      $('#statSafeNote').textContent = '匹配度 ' + Math.round(pick.fit);
    }

    const cohort = activeCohort();
    const chip = $('#cohortChip');
    if (cohort && view.power > 5) {
      const st = C.cohortStats(cohort, view.scores);
      const up = st.delta >= 0;
      chip.innerHTML = '<span class="' + (up ? 'up' : 'down') + '">vs ' + cohort.year + ' 届平均' +
        (cohort.demo ? '（示例）' : '') + ' ' + (up ? '+' : '') + st.delta + '</span><span>届内估算前 ' + st.top + '%</span>';
    } else {
      chip.innerHTML = '';
    }
    document.body.dataset.rating = view.rating;
  }

  function renderStrip() {
    $('#dimStrip').innerHTML = DIMS.map((d) => {
      const v = view.scores[d.key];
      const rt = rangeText(view.ranges[d.key]);
      const label = v == null ? '—' : (rt || Math.round(v));
      const width = v == null ? 0 : (view.ranges[d.key] ? view.ranges[d.key].high : v);
      return `<button class="mini-dim" type="button" data-scroll="card-${d.key}" title="跳到 ${d.name} 录入">
        <span class="md-top"><strong style="color:${d.color}">${d.name}</strong><em>${label}</em></span>
        <span class="md-bar"><i style="width:${width}%;background:${d.color}"></i></span>
      </button>`;
    }).join('');
  }

  function renderAdvice() {
    DIMS.forEach((d) => {
      const el = $('[data-advice="' + d.key + '"]');
      if (!el) return;
      const adv = C.adviceFor(d.key, state.profile, view.scores);
      let html = esc(adv.text).replace(/\+(\d+(?:\.\d+)?)/g, '<b>+$1</b>');
      el.innerHTML = html;
    });
  }

  const SCHOOL_COLORS = ['#fbbf24', '#38bdf8', '#fb923c', '#f472b6'];

  function selectedSchools() {
    return (state.ui.overlaySchools || [])
      .map((id) => D.SCHOOLS.find((s) => s.id === id))
      .filter(Boolean);
  }

  function renderRadar() {
    const overlays = [];
    const cohort = D.COHORT_ENABLED ? C.cohortById(state, state.ui.overlayYear) : null;
    if (cohort) {
      overlays.push({
        values: dimsToObj(cohort.dims), color: '#a78bfa', dash: '6 5', width: '1.7',
        label: cohort.year + ' 届平均'
      });
    }
    const schools = selectedSchools();
    schools.forEach((school, i) => {
      overlays.push({
        values: schoolValues(school), color: SCHOOL_COLORS[i], dash: '2 4', width: '1.8',
        label: school.name
      });
    });
    const band = (() => {
      let any = false;
      const low = {}, high = {};
      DIMS.forEach((d) => {
        if (view.scores[d.key] == null) { low[d.key] = null; high[d.key] = null; return; }
        const r = view.ranges[d.key];
        const v = view.scores[d.key];
        low[d.key] = Math.min(r.low, v);
        high[d.key] = Math.max(r.high, v);
        if (high[d.key] - low[d.key] >= 1) any = true;
      });
      return any ? { low, high } : null;
    })();
    R.update($('#radar'), view.scores, overlays, band);

    const powerText = view.powerHigh - view.powerLow >= 1
      ? fmtScore(view.powerLow) + '–' + fmtScore(view.powerHigh)
      : fmtScore(view.power);
    let legend = '<button type="button" data-legend="me"><i style="color:#6ee7b7"></i>我 <b>' + powerText + ' 综合</b></button>';
    if (cohort) {
      legend += '<button type="button" data-clear="cohort" title="点击隐藏"><i class="dash" style="color:#a78bfa"></i>' +
        cohort.year + ' 届平均 <b>' + Math.round(C.cohortPower(cohort)) + '</b></button>';
    }
    schools.forEach((school, i) => {
      const r = view.results.find((x) => x.school.id === school.id);
      legend += '<button type="button" data-unpick="' + school.id + '" title="点击从雷达移除"><i class="dot" style="color:' +
        SCHOOL_COLORS[i] + '"></i>' + esc(C.shortName(school)) + ' <b>' +
        (school.blind ? '不看标化' : Math.round(r.fit)) + '</b></button>';
    });
    $('#radarLegend').innerHTML = legend;
  }

  /* ======================================================================
     渲染：选校
     ====================================================================== */
  function fitLabel(r) {
    return r.fitHigh - r.fitLow >= 1 ? Math.round(r.fitLow) + '–' + Math.round(r.fitHigh) : String(Math.round(r.fit));
  }

  function pLabel(r) {
    return r.pHigh - r.pLow >= 0.01 ? fmtPct(r.pLow) + '–' + fmtPct(r.pHigh) : fmtPct(r.p);
  }

  function schoolCard(r) {
    const s = r.school;
    return `<button class="school-card tier-${r.tier}" type="button" data-school="${s.id}">
      <div class="sc-top">
        <div class="sc-name"><strong>${esc(s.name)}</strong><small>${esc(s.en)}</small></div>
        <div class="sc-fit"><b>${fitLabel(r)}</b><span>匹配度</span></div>
      </div>
      <div class="sc-bar"><i style="width:${r.fit}%;background:${TIER[r.tier].color}"></i></div>
      <div class="sc-meta">
        <span class="pill">录取率 ${fmtRate(s.rate)}</span>
        <span>估算 ${pLabel(r)}</span>
        ${s.blind ? '<span class="pill warn">不看标化</span>' : ''}
        ${C.factsFor(s) ? '<span class="pill official">官方画像</span>' : ''}
        ${r.bgAdj ? `<span class="pill ${r.bgAdj > 0 ? 'bg-plus' : 'bg-minus'}">背景 ${r.bgAdj > 0 ? '+' : ''}${r.bgAdj}</span>` : ''}
      </div>
      <div class="sc-tags">${s.tags.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
    </button>`;
  }

  /* ======================================================================
     渲染：去向推测 / 案例
     ====================================================================== */
  function renderDest() {
    const sample = D.DEST_SAMPLES[0];
    const main = $('#destMain');
    if (!main || !sample) return;
    const st = C.destStats(sample);
    const us = sample.us;

    main.innerHTML = `
      <div class="dest-title">
        <div><h3>${esc(sample.school)}</h3>
          <p>${esc(sample.region)} · ${sample.year} 届 · ${esc(sample.cohort)} 名毕业生 · 美国方向 ${us.applicants} 余人</p></div>
        <span class="sample-chip">官方喜报</span>
      </div>
      <div class="dest-tiers">
        ${st.usRows.map((r) => `<div class="dt-row">
          <div class="dt-top"><span>${esc(r.label)}</span><b>${Math.round(r.share * 1000) / 10}%</b>
            <small>${r.offers ? r.offers + ' 份 offer' : ''}${r.students ? ' · ' + r.students + ' 人' : ''}</small></div>
          <div class="dt-bar"><i style="width:${r.share * 100}%"></i></div>
        </div>`).join('')}
      </div>
      <div class="dest-uk">
        <div><span>英国方向</span><b>${sample.uk.oxbridge.students} 人牛剑</b><small>${sample.uk.applicants} 人申英 · 占 ${Math.round(sample.uk.oxbridge.share * 1000) / 10}%</small></div>
        <div><span>G5</span><b>${Math.round(sample.uk.g5.share * 100)}%</b><small>${sample.uk.g5.offers} 份预录取</small></div>
        <div><span>香港前三</span><b>${Math.round(sample.hk.top3Share * 100)}%</b><small>${sample.hk.students} 人 · ${sample.hk.offers} 份</small></div>
      </div>
      <p class="dest-note">${esc(sample.note)}</p>
      <p class="dest-src">来源：<a href="${esc(sample.sourceUrl)}" target="_blank" rel="noopener">${esc(sample.sourceName)}</a> · 发布于 ${esc(sample.published)} · offer 数 ≠ 人数（一人可能多 offer）</p>`;

    $('#destSide').innerHTML = `
      <div class="dest-index">
        <span>届别水平指数（推测）</span>
        <b>${st.low}–${st.high}</b>
        <small>不是个人录取概率，只描述这一届的整体去向结构</small>
      </div>
      <ul class="dest-formula">
        <li>藤校 & Top10 ${Math.round(st.usRows[0].share * 1000) / 10}% × 100</li>
        <li>Top30 ${Math.round(st.usRows[1].share * 100)}% × 85</li>
        <li>Top50 ${Math.round(st.usRows[2].share * 100)}% × 70</li>
        <li>Top50 以外 ${Math.round((1 - st.usRows[2].share) * 1000) / 10}% × 55</li>
        <li>再加 ±4.5 的口径容差（offer / 人数、年份差异）</li>
      </ul>
      <p class="dest-warn">样本只有 1 所（深国交），不能代表整个大湾区；后续可以加学校样本。指数是模型，不是官方评级。</p>`;
  }

  function renderCases() {
    const box = $('#caseGrid');
    if (!box) return;
    const cases = state.cases || [];
    if (!cases.length) {
      box.innerHTML = `<div class="case-empty card">
        <span>◎</span>
        <h3>还没有案例</h3>
        <p>公开案例多为自报、无法核实，所以不预置。你可以录入一个了解的匿名案例（六维 + 录取学校），系统会算它和你的相似度。只存本机。</p>
        <button class="btn primary small" type="button" data-add-case>添加第一个案例</button>
      </div>`;
      return;
    }
    box.innerHTML = cases.map((c) => {
      const school = D.SCHOOLS.find((s) => s.id === c.schoolId);
      const sim = C.similarityOf(view.scores, c.scores);
      const tone = sim.sim >= 80 ? 'good' : sim.sim >= 60 ? 'mid' : 'low';
      const bars = DIMS.map((d) => {
        const v = c.scores[d.key];
        return `<i title="${d.name} ${v == null ? '—' : Math.round(v)}" style="height:${v == null ? 2 : Math.max(4, v * 0.3)}px;background:${d.color}"></i>`;
      }).join('');
      return `<article class="case-card">
        <div class="case-top">
          <div><b>${esc(school ? school.name : '未知学校')}</b><small>${esc(c.alias)}${c.year ? ' · ' + esc(c.year) : ''}</small></div>
          <div class="case-sim ${tone}"><b>${sim.sim}%</b><span>相似度</span></div>
        </div>
        <div class="case-bars">${bars}</div>
        <p class="case-gaps">${sim.farthest ? '差距最大：' + esc(sim.farthest.name) + ' 差 ' + sim.farthest.diff : '暂无可比维度'}
          ${sim.closest ? ' · 最接近：' + esc(sim.closest.name) + ' 差 ' + sim.closest.diff : ''}</p>
        ${c.source ? `<p class="case-src">来源：${esc(c.source)}</p>` : ''}
        <button class="case-del" type="button" data-case-del="${esc(c.id)}">删除</button>
      </article>`;
    }).join('') + `<button class="case-add" type="button" data-add-case>＋ 再加一个案例</button>`;
  }

  function openCaseForm() {
    const opts = D.SCHOOLS.slice().sort((a, b) => a.en.localeCompare(b.en)).map((s) =>
      `<option value="${s.id}">${esc(s.name)}（${esc(s.en)}）</option>`).join('');
    const fields = DIMS.map((d) => `<label class="field"><span>${d.name}</span>
      <input type="number" name="s-${d.key}" min="0" max="100" step="1" value="${view.scores[d.key] == null ? 60 : Math.round(view.scores[d.key])}"></label>`).join('');
    openModal(`
      <h3 id="modalTitle">添加一个匿名案例</h3>
      <p class="hint" style="margin-top:6px">只存本机，请不要填真实姓名。案例越具体，相似度越有意义。</p>
      <form id="caseForm" class="m-form">
        <div class="field-row" style="margin-top:14px">
          <label class="field"><span>录取学校</span><select name="schoolId">${opts}</select></label>
          <label class="field"><span>年份（可选）</span><input type="text" name="year" maxlength="8" placeholder="2025"></label>
        </div>
        <label class="field" style="margin-top:10px"><span>匿名代号 / 来源说明</span>
          <input type="text" name="alias" maxlength="40" placeholder="如：2025 届 A 同学 / 翠鹿公开案例"></label>
        <div class="case-score-grid">${fields}</div>
        <div class="m-actions">
          <button class="btn primary" type="submit">保存案例</button>
          <button class="btn ghost" type="button" data-close="modal">取消</button>
        </div>
      </form>`);
    $('#caseForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const scores = {};
      DIMS.forEach((d) => { scores[d.key] = C.clamp(+fd.get('s-' + d.key) || 0, 0, 100); });
      state.cases = (state.cases || []).concat([{
        id: 'c' + Date.now(),
        schoolId: String(fd.get('schoolId')),
        alias: String(fd.get('alias') || '匿名案例'),
        year: String(fd.get('year') || ''),
        source: String(fd.get('alias') || ''),
        scores,
        createdAt: Date.now()
      }]).slice(-30);
      saveState();
      closeModal();
      renderCases();
      toast('案例已保存到本机');
    });
  }

  function renderSources() {
    const box = $('#sourceList');
    if (!box) return;
    const items = [
      { tag: '官方', name: '深国交 2025 全球本科录取', note: '去向档位与人数 / offer 数据', url: 'https://www.alevel.com.cn/news/3019/' },
      { tag: '官方', name: 'UC Berkeley 录取画像', note: '加权 GPA 区间、Test-Blind', url: 'https://admissions.berkeley.edu/student-profile/' },
      { tag: '官方', name: 'UCLA 录取画像', note: '加权 GPA 区间、Test-Blind', url: 'https://admission.ucla.edu/apply/freshman/profile' },
      { tag: '官方', name: 'MIT 录取画像', note: 'SAT / ACT 区间', url: 'https://mitadmissions.org/apply/process/profile/' },
      { tag: '官方', name: 'Harvard 录取统计', note: 'SAT / ACT 区间', url: 'https://college.harvard.edu/admissions/admissions-statistics' },
      { tag: '官方', name: 'Common App 文书题目', note: '主文书 7 题', url: 'https://www.commonapp.org/' },
      { tag: '官方', name: 'UC PIQ 题目', note: '加州系个人洞察问题', url: 'https://admission.universityofcalifornia.edu/admission-requirements/freshman-requirements/personal-insight-questions.html' },
      { tag: '估算', name: '68 所大学六维画像 / 录取率', note: '公开数据 + 学校偏好的人工整理，不是官方', url: '' },
      { tag: '手动', name: '录取案例', note: '由用户在本机录入，未核实', url: '' }
    ];
    box.innerHTML = items.map((x) => `<div class="source-item">
      <span class="source-tag ${x.tag === '官方' ? 'off' : x.tag === '估算' ? 'est' : 'user'}">${x.tag}</span>
      <div><b>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)}</b>
        <small>${esc(x.note)}</small></div>
    </div>`).join('');
  }

  function renderSchools() {
    const countEl = $('#schoolCount');
    if (countEl) countEl.textContent = D.SCHOOLS.length;
    const f = state.ui.typeFilter;
    const q = (state.ui.search || '').trim().toLowerCase();
    const match = (r) => {
      const s = r.school;
      if (f === 'private' && s.type !== 'private') return false;
      if (f === 'public' && s.type !== 'public') return false;
      if (f === 'tech' && !s.tech) return false;
      if (q) {
        const hay = (s.name + ' ' + s.en + ' ' + s.tags.join(' ') + ' ' + s.note).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    };
    const filtered = view.results.filter(match);

    TIERS.forEach((t) => {
      const list = filtered.filter((r) => r.tier === t)
        .sort((a, b) => a.school.rate - b.school.rate || b.fit - a.fit);
      $('#count-' + t).textContent = list.length;
      $('#grid-' + t).innerHTML = list.length
        ? list.map(schoolCard).join('')
        : '<p class="group-empty">这个筛选下没有学校，换个条件试试。</p>';
    });

    const picks = C.shortlist(view.results);
    $('#shortlist').innerHTML = '<span class="sl-label">只申 8 所的话</span>' + picks.map((r) =>
      `<button class="sl-chip" type="button" data-school="${r.school.id}" style="color:${TIER[r.tier].color}">
        <i></i>${esc(C.shortName(r.school))}<small>${Math.round(r.fit)}</small></button>`
    ).join('');

    const dreams = selectedSchools();
    $('#dreamStrip').innerHTML = dreams.length ? `
      <div class="dream-head">梦校对比 <span>已叠加 ${dreams.length} / 4 所</span></div>
      <div class="dream-grid">${dreams.map((s, i) => {
        const r = view.results.find((x) => x.school.id === s.id);
        const gaps = r.gaps.filter((g) => !g.ignored && g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 2);
        return `<div class="dream-card" data-school="${s.id}">
          <div class="dc-top"><b style="color:${SCHOOL_COLORS[i]}">${esc(s.name)}</b>
            <span>匹配 ${fitLabel(r)} · 概率 ${pLabel(r)}</span></div>
          <div class="dc-kw">${C.keywordsFor(s).map((k) => `<span>${esc(k)}</span>`).join('')}</div>
          <p>${gaps.length ? '还差：' + gaps.map((g) => DIMS.find((d) => d.key === g.key).name + ' ' + Math.round(g.gap)).join(' / ') : '六维全部达到该校画像'}</p>
        </div>`;
      }).join('')}</div>` : '';
  }

  /* ======================================================================
     渲染：毕业生
     ====================================================================== */
  function renderCohort() {
    const sec = document.getElementById('sec-cohort');
    if (!D.COHORT_ENABLED) {
      if (sec) sec.hidden = true;
      const nav = document.getElementById('nav-cohort');
      if (nav) nav.hidden = true;
      return;
    }
    if (sec) sec.hidden = false;
    const list = (state.cohorts || []).slice().sort((a, b) => b.year - a.year);
    if (!list.length) return;
    const active = activeCohort() || list[0];

    const demoEl = $('#cohortDemo');
    if (demoEl) {
      demoEl.hidden = !active.demo;
      demoEl.innerHTML = active.demo
        ? '<b>演示数据</b>　这五届的人数和去向是虚构的，不是任何真实学校。点「编辑本届数据」换成你们学校的升学榜，或直接删掉。'
        : '';
    }

    $('#yearBar').innerHTML = list.map((c) => `
      <button class="year-chip${c.year === active.year ? ' on' : ''}" type="button" data-cohort="${c.year}">
        <b>${c.year}</b><small>${c.count} 人 · 平均 ${Math.round(C.cohortPower(c))}</small>
      </button>`).join('');

    const st = C.cohortStats(active, view.scores);
    const rows = DIMS.map((d, i) => {
      const mine = view.scores[d.key];
      const avg = active.dims[i] || 0;
      if (mine == null) {
        return `<div class="cc-row">
          <span class="cc-name">${d.name}</span>
          <div class="cc-track"><div class="cc-avg" style="left:${avg}%"></div></div>
          <span class="cc-val">— / ${Math.round(avg)}</span>
        </div>`;
      }
      const delta = Math.round(mine - avg);
      return `<div class="cc-row">
        <span class="cc-name">${d.name}</span>
        <div class="cc-track">
          <div class="cc-mine" style="width:${mine}%;background:linear-gradient(90deg,${d.color}44,${d.color})"></div>
          <div class="cc-avg" style="left:${avg}%"></div>
        </div>
        <span class="cc-val"><b>${Math.round(mine)}</b> / ${Math.round(avg)}
          <em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}</em></span>
      </div>`;
    }).join('');

    $('#cohortMain').innerHTML = `
      <div class="cohort-title">
        <h3>${active.year} 届毕业生平均</h3>
        ${active.demo ? '<span class="c-badge demo">演示数据</span>' : ''}
        <span class="c-badge">可编辑</span>
        <span class="c-avg">${active.count} 人 · 平均战力 <b>${st.avg}</b></span>
      </div>
      <p class="hint">${esc(active.note || '把这一届的平均分改成你们学校的真实数据。')}</p>
      <div class="cohort-compare">${rows}</div>
      <div class="cohort-foot">
        <span>你的综合战力 <b>${st.power}</b></span>
        <span class="${st.delta >= 0 ? '' : 'neg'}">比本届平均 <b>${st.delta >= 0 ? '+' : ''}${st.delta}</b></span>
        <span>届内估算位置 <b>前 ${st.top}%</b></span>
      </div>`;

    const dests = (active.destinations || []).slice().sort((a, b) => b.n - a.n).slice(0, 9);
    const maxN = dests.length ? dests[0].n : 1;
    $('#cohortSide').innerHTML = `
      <h3>这一届去了哪</h3>
      <div class="dest-list">${dests.length ? dests.map((x) => {
        const s = D.SCHOOLS.find((y) => y.id === x.id);
        if (!s) return '';
        return `<div class="dest-row" data-school="${s.id}" role="button" tabindex="0">
          <span class="dest-name">${esc(s.name)}</span>
          <span class="dest-bar"><i style="width:${Math.max(6, (x.n / maxN) * 100)}%"></i></span>
          <b>${x.n} 人</b></div>`;
      }).join('') : '<p class="hint">还没有填去向。</p>'}</div>
      <p class="cohort-note">点任意学校，看它的六维画像和你的差距。人数只统计了这份表里列出的学校。</p>`;
  }

  /* ======================================================================
     渲染：文书
     ====================================================================== */
  function renderPrompts() {
    $('#promptGrid').innerHTML = D.PROMPTS.map((p) => {
      const best = Math.max.apply(null, p.dims.map((k) => view.scores[k] || 0));
      const badge = best >= 80 ? '你最强的一项' : best >= 65 ? '素材够用' : '暂时没素材';
      return `<article class="prompt-card">
        <div class="p-top">
          <span class="p-org">${esc(p.org)}</span>
          <span class="fit-badge${best >= 80 ? '' : ' mid'}">${badge} · ${Math.round(best)}</span>
        </div>
        <h4>${esc(p.title)}</h4>
        <p class="p-en">${esc(p.en)}</p>
        <p class="hint">${esc(p.zh)}</p>
        <ul>${p.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </article>`;
    }).join('');
  }

  function renderOutlines() {
    const list = C.buildOutlines(state.profile);
    $('#outlineGrid').innerHTML = list.map((o) => `
      <article class="outline-card">
        <span class="oc-tag">${esc(o.tag)}</span>
        <h4>${esc(o.title)}</h4>
        <p class="oc-line">${esc(o.line)}</p>
        <div class="oc-steps">${o.steps.map((s) => `
          <div class="oc-step"><b>${esc(s.k)}</b><span><strong>${esc(s.t)}</strong><br>约 ${esc(s.w)}</span></div>`).join('')}
        </div>
        <div class="oc-words">${esc(o.words)}</div>
      </article>`).join('');
  }

  function renderEssayRubric() {
    $('#essayRubric').innerHTML = D.ESSAY_CHECKS.map((c) => `
      <article class="er-card">
        <div class="er-top"><h4>${esc(c.name)}</h4><span class="er-w">${Math.round(c.weight * 100)}%</span></div>
        <p>${esc(c.hint)}</p>
        <p class="er-8">8 分以上：${essayStandard(c.key)}</p>
      </article>`).join('');
  }

  function essayStandard(key) {
    return {
      unique: '读完之后，别人写不出同样的一篇。',
      detail: '至少有一个能被拍成镜头的画面。',
      reflect: '能说清“我原来怎么想、后来怎么变”。',
      fit: '和你申请的专业、这所学校的资源对得上。',
      voice: '像你本人在说话，而不是申请范文。',
      revise: '至少改过 3 轮，并被一个真人挑过刺。'
    }[key] || '';
  }

  /* ======================================================================
     渲染：评分表
     ====================================================================== */
  function renderCompRubric() {
    const subj = state.ui.compSubject || 'math';
    $('#compSubjectTabs').innerHTML = D.COMP_SUBJECTS.map((s) =>
      `<button type="button" data-comp-subject="${s.id}" class="${s.id === subj ? 'on' : ''}">${esc(s.short || s.name)}</button>`).join('');
    const subjName = (D.COMP_SUBJECTS.find((s) => s.id === subj) || { name: '综合' }).name;
    const rows = D.COMP_TIERS.map((t) => `
      <tr>
        <td><span class="tier-pill">${t.label}</span></td>
        <td class="pts" style="width:56px">${t.pts}</td>
        <td class="name">${esc((t.examples && t.examples[subj]) || t.desc)}</td>
        <td class="hint">${esc(t.title)}</td>
      </tr>`).join('');
    $('#compRubricTable').innerHTML = `
      <caption>当前学科：${esc(subjName)}。档位分值可以手改；每个学科在每一档都有一个代表赛事。</caption>
      <thead><tr><th>档位</th><th style="text-align:right">分值</th><th>代表赛事</th><th>说明</th></tr></thead>
      <tbody>${rows}</tbody>`;
  }

  function renderRubricTables() {
    renderCompRubric();

    const actRows = D.ACT_TIERS.map((t) => `
      <tr><td><span class="tier-pill">${t.label}</span></td><td class="pts">${t.pts}</td>
      <td class="name">${esc(t.example)}</td><td class="hint">${esc(t.title)}</td></tr>`).join('');
    $('#actRubricTable').innerHTML = `
      <caption>直接选档位，分值可以手改；多项按 1 / .65 / .45 / .30 / .20 加权累加，封顶 100</caption>
      <thead><tr><th>档位</th><th style="text-align:right">分值</th><th>代表活动</th><th>说明</th></tr></thead>
      <tbody>${actRows}</tbody>`;

    const gpa4 = D.GPA_ANCHORS_4.map((p) => `<tr><td class="name">GPA ${p[0].toFixed(2)} / 4.0</td><td class="num">${p[1]}</td><td class="hint">归一化</td></tr>`).join('');
    const gpa100 = D.GPA_ANCHORS_100.map((p) => `<tr><td class="name">平均分 ${p[0]}</td><td class="num">${p[1]}</td><td class="hint">归一化</td></tr>`).join('');
    const bonus = Object.keys(D.GPA_RIGOR).map((k) => `<tr><td class="name">AP 课程量 · ${esc(D.GPA_RIGOR[k].name)}</td><td class="num">${D.GPA_RIGOR[k].bonus >= 0 ? '+' : ''}${D.GPA_RIGOR[k].bonus}</td><td class="hint">加分</td></tr>`).join('') +
      Object.keys(D.GPA_RANK).map((k) => `<tr><td class="name">排名 · ${esc(D.GPA_RANK[k].name)}</td><td class="num">${D.GPA_RANK[k].bonus >= 0 ? '+' : ''}${D.GPA_RANK[k].bonus}</td><td class="hint">加分</td></tr>`).join('');
    $('#gpaRubricTable').innerHTML = `
      <caption>先按 GPA / 平均分查表得到基础分，再加课程量、排名、趋势，封顶 100</caption>
      <thead><tr><th>输入</th><th style="text-align:right">得分</th><th>说明</th></tr></thead>
      <tbody>${gpa4}${gpa100}
        <tr class="rt-section"><td colspan="3">附加分</td></tr>${bonus}
      </tbody>`;

    const sat = D.SAT_ANCHORS.map((p) => `<tr><td class="name">SAT ${p[0]}</td><td class="num">${p[1]}</td><td class="hint">分段线性</td></tr>`).join('');
    const toefl = D.TOEFL_ANCHORS.map((p) => `<tr><td class="name">TOEFL ${p[0]}</td><td class="num">${p[1]}</td><td class="hint">语言项</td></tr>`).join('');
    const ap = [5, 4, 3, 2, 1].map((n) => `<tr><td class="name">AP ${n} 分</td><td class="num">${D.AP_SCORE_POINTS[n]}</td><td class="hint">单科分值</td></tr>`).join('');
    $('#testRubricTable').innerHTML = `
      <caption>标化 = 主成绩 75% + 语言 25%（缺一项时单项折算）</caption>
      <thead><tr><th>输入</th><th style="text-align:right">得分</th><th>说明</th></tr></thead>
      <tbody>${sat}${toefl}
        <tr class="rt-section"><td colspan="3">AP 单科</td></tr>${ap}
        <tr class="rt-section"><td colspan="3">AP 合成</td></tr>
        <tr><td class="name">质量分</td><td class="num">单科均值</td><td class="hint">权重 62%</td></tr>
        <tr><td class="name">数量分</td><td class="num">门数 × 15 + 10</td><td class="hint">权重 38%，封顶 100</td></tr>
        <tr><td class="name">硬核科目</td><td class="num">+1.5 / 门</td><td class="hint">Calc BC、Physics C、CSA、化学、生物等 4 分以上</td></tr>
      </tbody>`;
  }

  function renderCustom() {
    const el = $('#customList');
    if (!state.customRubric.length) {
      el.innerHTML = '<p class="custom-empty">还没有自定义条目。比如加一个“HIMCM 数学建模 = 70 分”，它就会出现在竞赛下拉框里。</p>';
      return;
    }
    el.innerHTML = state.customRubric.map((x) => `
      <span class="custom-item">${esc(x.name)} <b>${x.pts}</b>
        <small class="hint">${x.kind === 'comp' ? '竞赛' : '活动'}</small>
        ${x.kind === 'act' ? `<button type="button" data-use-act="${x.id}" title="添加这项活动">＋</button>` : ''}
        <button type="button" data-del-custom="${x.id}" aria-label="删除">×</button>
      </span>`).join('');
  }

  function renderFormula() {
    const g = D.GLOBAL_WEIGHTS;
    $('#formulaList').innerHTML = `
      <li><b>综合战力</b> = ${DIMS.map((d) => `<code>${d.name} × ${Math.round(g[d.key] * 100)}%</code>`).join(' + ')}，满分 100。</li>
      <li><b>单维得分</b>：GPA 与标化查表归一化后加调节项；AP 用「质量 62% + 数量 38% + 硬核科目」；竞赛取最高奖 72% + 前三均值 28% + 广度；活动直接选档位、前五项加权累加；材料 = 文书 50% + 推荐信 35% + 面试 15%，没写的部分会把权重让给已有的材料。</li>
      <li><b>没有这项</b>：勾选后该维不参与总分和学校匹配，雷达图直接跳过这个轴，不会按 0 分处理。</li>
      <li><b>预估区间</b>：给还没定下来的维度填「不理想 / 理想」两个分数。雷达图会画出浅色区间带，综合战力、学校匹配度和录取概率都会变成区间。</li>
      <li><b>学校匹配度</b> = 100 − Σ（该校第 i 维权重 × 你的差额）。权重来自该校画像本身 —— 它越看重某一维，这一维差一分扣得越多。</li>
      <li><b>录取概率（娱乐）</b> = 1 − (1 − 该校录取率)<sup>2^((匹配度−82)/9)</sup>，并对超低录取率学校封顶。它只描述“画像重合度”，不代表真实录取。</li>
      <li><b>档位</b>：概率 ≥60% 保底，≥30% 匹配，≥12% 冲刺，其余为梦校。UC 系为 Test-Blind，标化一维不参与计算。</li>
      <li><b>背景加成</b>：绿卡 / 公民按 domestic 池、美高、第一代、校友子女、体育特招、助学金需求分别加减分；各校对中国 / 国际申请者的友好度不同（比如 UIUC、NYU 偏友好，圣母、UNC 偏保守），这部分只影响录取概率，不改六维分数。</li>
      <li><b>毕业生对比</b>：把该届六维平均按同一套权重合成平均战力，再用逻辑斯蒂估算你在届内的位置。数据可自行编辑。</li>`;
  }

  /* ======================================================================
     总渲染
     ====================================================================== */
  function renderAll() {
    recalc();
    renderBadges();
    renderDashboard();
    renderStrip();
    renderAdvice();
    renderRadar();
    renderSchools();
    renderDest();
    renderCases();
    renderCohort();
    renderPrompts();
    renderOutlines();
    renderEssayRubric();
    renderCustom();
    renderBg();
    renderBgChip();
    renderOverlayControls();
    renderGrowth();
    renderTasks();
    const banner = $('#demoBanner');
    if (state.sample && D.SAMPLES[state.sample]) {
      banner.hidden = false;
      $('#demoName').textContent = D.SAMPLES[state.sample].label;
    } else {
      banner.hidden = true;
    }
    saveState();
  }

  function renderOverlayControls() {
    const years = (state.cohorts || []).slice().sort((a, b) => b.year - a.year);
    const yearCtl = document.getElementById('yearControl');
    if (yearCtl) yearCtl.hidden = !D.COHORT_ENABLED;
    const ySel = $('#overlayYear');
    ySel.innerHTML = '<option value="">不叠加</option>' + years.map((c) =>
      `<option value="${c.year}">${c.year} 届 · ${c.count} 人</option>`).join('');
    ySel.value = state.ui.overlayYear == null ? '' : String(state.ui.overlayYear);

    const count = (state.ui.overlaySchools || []).length;
    const countEl = $('#overlaySchoolCount');
    if (countEl) countEl.textContent = count;
    renderPickerList();
  }

  function renderPickerList() {
    const box = $('#pickerList');
    if (!box) return;
    const q = (($('#pickerSearch') && $('#pickerSearch').value) || '').trim().toLowerCase();
    const chosen = state.ui.overlaySchools || [];
    const list = D.SCHOOLS.slice().sort((a, b) => a.en.localeCompare(b.en)).filter((s) => {
      if (!q) return true;
      const hay = (s.name + ' ' + s.en + ' ' + s.tags.join(' ') + ' ' + C.keywordsFor(s).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    box.innerHTML = list.length ? list.map((s) => {
      const idx = chosen.indexOf(s.id);
      const on = idx >= 0;
      const disabled = !on && chosen.length >= 4;
      return `<label class="picker-item${on ? ' on' : ''}${disabled ? ' disabled' : ''}">
        <input type="checkbox" data-pick="${s.id}"${on ? ' checked' : ''}${disabled ? ' disabled' : ''}>
        <i style="background:${on ? SCHOOL_COLORS[idx] : 'transparent'}"></i>
        <span><b>${esc(s.name)}</b><small>${esc(C.keywordsFor(s).slice(0, 3).join(' · '))}</small></span>
      </label>`;
    }).join('') : '<p class="hint" style="padding:12px">没有匹配的学校</p>';
  }

  function toggleDream(id) {
    const arr = state.ui.overlaySchools || [];
    const idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1);
    else if (arr.length < 4) arr.push(id);
    else { toast('最多同时叠加 4 所'); return; }
    state.ui.overlaySchools = arr;
    renderAll();
  }

  /* ======================================================================
     弹窗
     ====================================================================== */
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal').hidden = true;
    $('#modalBody').innerHTML = '';
    document.body.style.overflow = '';
  }

  function factsBlock(school) {
    const f = C.factsFor(school);
    if (!f) return '';
    return `<div class="m-facts">
      <div class="mf-head"><h4>官方录取画像</h4><span>${esc(f.year)} · 约值</span></div>
      <div class="mf-grid">
        <div><span>GPA</span><b>${esc(f.gpa)}</b></div>
        <div><span>SAT</span><b>${esc(f.sat)}</b></div>
        <div><span>ACT</span><b>${esc(f.act)}</b></div>
      </div>
      <p>这是学校公布的录取者区间，不是你的六维分；下面的六维是模型翻译，用来和你对比。<a href="${esc(f.src)}" target="_blank" rel="noopener">官方来源 ↗</a></p>
    </div>`;
  }

  function renderChangelog() {
    const box = $('#changelogList');
    if (!box) return;
    box.innerHTML = D.CHANGELOG.map((c, i) => `
      <article class="log-item${i === 0 ? ' now' : ''}">
        <div class="log-meta"><b>v${esc(c.version)}</b><span>${esc(c.date)}</span></div>
        <div class="log-body">
          <h3>${esc(c.title)}${i === 0 ? '<em>当前</em>' : ''}</h3>
          <ul>${c.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </article>`).join('');
    $$('.js-version').forEach((el) => { el.textContent = 'v' + D.VERSION; });
  }

  function openSchool(id) {
    const r = view.results.find((x) => x.school.id === id);
    if (!r) return;
    const s = r.school;
    const rows = DIMS.map((d, i) => {
      const mine = view.scores[d.key];
      const bench = s.dims[i];
      if (mine == null) {
        return `<div class="m-row"><span class="mr-name">${d.name}</span>
          <div class="mr-track" style="display:flex;align-items:center;justify-content:center;background:rgba(251,191,36,.06)">
            <span class="hint" style="font-size:10.5px">你标记了「没有这项」，不参与匹配</span></div>
          <span class="mr-val">—</span></div>`;
      }
      if (s.blind && d.key === 'test') {
        return `<div class="m-row"><span class="mr-name">${d.name}</span>
          <div class="mr-track" style="display:flex;align-items:center;justify-content:center;background:rgba(251,191,36,.06)">
            <span class="hint" style="font-size:10.5px">Test-Blind · 不参考 SAT/ACT</span></div>
          <span class="mr-val">—</span></div>`;
      }
      return `<div class="m-row">
        <span class="mr-name" style="color:${d.color}">${d.name}</span>
        <div class="mr-track">
          <div class="mr-mine" style="width:${mine}%;background:${mine >= bench ? 'rgba(110,231,183,.8)' : d.color + '99'}"></div>
          <div class="mr-bench" style="left:${bench}%"></div>
        </div>
        <span class="mr-val"><b>${Math.round(mine)}</b> / ${bench}</span>
      </div>`;
    }).join('');

    const gaps = r.gaps.filter((g) => !g.ignored && g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
    const gapHtml = gaps.length ? gaps.map((g) => {
      const d = DIMS.find((x) => x.key === g.key);
      const adv = C.adviceFor(g.key, state.profile, view.scores);
      const clean = adv.text.replace(/，这一维 \+\d+(?:\.\d+)?/, '');
      return `<li><b>${d.name} 差 ${Math.round(g.gap)} 分</b> · ${esc(clean)}</li>`;
    }).join('') : '<li>六维全部达到或超过这所学校的画像，剩下就看文书和运气了。</li>';

    openModal(`
      <div class="m-head">
        <div>
          <h3 id="modalTitle">${esc(s.name)}</h3>
          <p class="m-en">${esc(s.en)} · ${s.type === 'public' ? '公立' : '私立'}${s.tech ? ' · 理工强校' : ''}</p>
          <div class="m-tags">${s.tags.map((t) => `<span>${esc(t)}</span>`).join('')}
            ${s.blind ? '<span style="color:#fbbf24;border-color:rgba(251,191,36,.3)">UC 不看标化</span>' : ''}</div>
        </div>
        <div class="m-rate"><b>${fitLabel(r)}</b><span>匹配度 · 录取率 ${fmtRate(s.rate)}</span></div>
      </div>
      <p class="m-note">${esc(s.note)}</p>
      <div class="m-kw">
        <h4>关键词 · 优势与偏好</h4>
        <div class="kw-chips">${C.keywordsFor(s).map((k) => `<span>${esc(k)}</span>`).join('')}</div>
      </div>
      ${factsBlock(s)}
      <div class="m-bg">
        <b>背景加成 ${r.bgAdj > 0 ? '+' : ''}${r.bgAdj}</b>
        <span>${r.bgParts.length ? r.bgParts.map((p) => esc(p.label) + ' ' + (p.value > 0 ? '+' : '') + p.value).join(' · ') : '国际生池默认处理'}</span>
        <em>匹配度只算六维；录取概率已包含这部分加成。</em>
      </div>
      <div class="m-compare">${rows}</div>
      <p class="hint" style="margin-top:8px">竖线 = 该校画像的基准值；绿条 = 你。条超过竖线即达标。</p>
      <div class="m-gap">
        <h4>差在哪里 · 怎么补</h4>
        <ul>${gapHtml}</ul>
      </div>
      <div class="m-gap">
        <h4>这所学校的文书偏好</h4>
        <p class="hint">${esc(s.essayTip)}</p>
      </div>
      <div class="m-actions">
        <button class="btn primary" type="button" id="mOverlay">${(state.ui.overlaySchools || []).indexOf(s.id) >= 0 ? '从雷达移除' : '把它叠加到我的雷达图'}</button>
        <button class="btn ghost" type="button" data-close="modal">先看看别的</button>
      </div>
      <p class="hint" style="margin-top:14px">录取概率估算：${pLabel(r)} · 这个数字只用来区分“冲 / 稳 / 保”，不当真。</p>
    `);
    $('#mOverlay').onclick = () => {
      const wasOn = (state.ui.overlaySchools || []).indexOf(s.id) >= 0;
      toggleDream(s.id);
      closeModal();
      document.getElementById('sec-dash').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(wasOn ? '已从雷达移除「' + s.name + '」' : '已叠加「' + s.name + '」的画像');
    };
  }

  function cohortForm(cohort) {
    editingYear = cohort ? cohort.year : null;
    const isNew = !cohort;
    const latest = (state.cohorts || []).slice().sort((a, b) => b.year - a.year)[0];
    const c = cohort || {
      year: latest ? latest.year + 1 : 2025,
      count: 30,
      dims: latest ? latest.dims.slice() : [80, 78, 72, 58, 68, 64],
      destinations: [],
      note: ''
    };
    const dimFields = DIMS.map((d, i) => `
      <label class="field"><span>${d.name}</span>
        <input type="number" min="0" max="100" step="1" name="d-${d.key}" value="${c.dims[i] || 0}">
      </label>`).join('');
    const destRows = (c.destinations || []).map((x) => destRowHtml(x.id, x.n)).join('');

    openModal(`
      <h3 id="modalTitle">${isNew ? '新增一届毕业生' : '编辑 ' + c.year + ' 届数据'}</h3>
      <p class="hint" style="margin-top:6px">六维取这一届的平均分（0–100）。去向填人数即可，可以只填前几名。</p>
      <form id="cohortForm" class="m-form">
        <div class="field-row" style="margin-top:16px">
          <label class="field"><span>毕业年份</span><input type="number" min="2000" max="2100" name="year" value="${c.year}" required></label>
          <label class="field"><span>毕业生人数</span><input type="number" min="1" max="999" name="count" value="${c.count}" required></label>
        </div>
        <div class="cohort-edit-dims">${dimFields}</div>
        <label class="field" style="margin-top:12px"><span>一句话备注</span>
          <input type="text" name="note" maxlength="80" value="${esc(c.note || '')}" placeholder="如：AP 平均 4.2 门，T30 录取 9 人">
        </label>
        <h4 style="margin:18px 0 8px;font-size:13px">这一届去了哪</h4>
        <div id="destRows">${destRows || '<p class="hint">还没有去向，点下面添加。</p>'}</div>
        <button class="add-btn" type="button" id="addDest" style="margin-top:8px">＋ 添加一所学校</button>
        <div class="m-actions">
          <button class="btn primary" type="submit">保存这一届</button>
          ${isNew ? '' : '<button class="btn ghost" type="button" id="delCohort">删除这一届</button>'}
          <button class="btn ghost" type="button" data-close="modal">取消</button>
        </div>
      </form>
    `);

    $('#addDest').onclick = () => {
      const wrap = $('#destRows');
      if (wrap.querySelector('.hint')) wrap.innerHTML = '';
      wrap.insertAdjacentHTML('beforeend', destRowHtml(D.SCHOOLS[0].id, 1));
    };
    $('#cohortForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const year = +fd.get('year');
      const count = +fd.get('count');
      if (!year) return;
      const dims = DIMS.map((d) => C.clamp(+fd.get('d-' + d.key) || 0, 0, 100));
      const map = {};
      $$('.dest-edit-row', e.target).forEach((row) => {
        const id = row.querySelector('select').value;
        const n = +row.querySelector('input').value || 0;
        if (id && n > 0) map[id] = (map[id] || 0) + n;
      });
      const destinations = Object.keys(map).map((id) => ({ id, n: map[id] })).sort((a, b) => b.n - a.n);
      const item = { year, count: count || 1, demo: false, dims, destinations, note: fd.get('note') || '' };

      state.cohorts = (state.cohorts || []).filter((x) => x.year !== editingYear && x.year !== year);
      state.cohorts.push(item);
      state.cohorts.sort((a, b) => b.year - a.year);
      state.ui.activeCohort = year;
      state.ui.overlayYear = year;
      closeModal();
      renderAll();
      toast('已保存 ' + year + ' 届数据');
    });
    if (!isNew) {
      $('#delCohort').onclick = () => {
        if ((state.cohorts || []).length <= 1) { toast('至少保留一届数据'); return; }
        state.cohorts = state.cohorts.filter((x) => x.year !== editingYear);
        state.ui.activeCohort = state.cohorts[0].year;
        state.ui.overlayYear = state.cohorts[0].year;
        closeModal();
        renderAll();
        toast('已删除 ' + editingYear + ' 届');
      };
    }
  }

  function schoolOptions(selected) {
    return D.SCHOOLS.slice().sort((a, b) => a.en.localeCompare(b.en)).map((s) =>
      `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  }

  function destRowHtml(id, n) {
    return `<div class="dest-edit-row">
      <select aria-label="学校">${schoolOptions(id)}</select>
      <input type="number" min="0" max="999" value="${n || 0}" aria-label="人数">
      <button type="button" class="del" data-dest-del aria-label="删除">×</button>
    </div>`;
  }

  /* ======================================================================
     文书体检
     ====================================================================== */
  function runCheck() {
    const text = $('#essayDraft').value || '';
    if (text.trim().length < 40) { toast('至少写 40 个字，体检才有意义'); return; }
    state.profile.essay.text = text;
    const a = C.analyzeEssay(text);
    renderAll();
    renderCheckResult(a);
    toast('体检完成：' + a.score + ' 分');
  }

  function renderCheckResult(a) {
    const color = a.score >= 80 ? '#6ee7b7' : a.score >= 65 ? '#7dd3fc' : a.score >= 50 ? '#fbbf24' : '#fb7185';
    const issues = [];
    if (a.words < 180) issues.push(['bad', '太短', '目前 ' + a.words + ' 字，主文书通常 500–650 词。先把故事讲完整，再谈文采。']);
    else if (a.words > 900) issues.push(['warn', '偏长', '超过 900 词了，Common App 上限 650 词，先删掉所有铺垫。']);
    if (a.cliches.length) issues.push(['bad', '套话', '出现 ' + a.cliches.length + ' 个高频表达：' + a.cliches.slice(0, 5).join(' / ') + '。试着换成你独有的说法。']);
    if (a.concrete < 5) issues.push(['warn', '缺少具体细节', '数字、专有名词、引语偏少。招生官记不住形容词，只记得住画面。']);
    if (!a.reflectHits) issues.push(['warn', '几乎没有反思', '加一段“我原来以为…后来发现…”，让事件变成成长。']);
    if (a.avgLen > 46) issues.push(['warn', '句子太长', '平均每句 ' + a.avgLen + ' 词，读起来会喘。把长句拆成两三个短句。']);
    if (a.firstRatio > 0.16) issues.push(['warn', '“我”太多', '第一人称占比 ' + Math.round(a.firstRatio * 100) + '%，试着把镜头交给别人和场景。']);
    if (a.repeated.length) issues.push(['warn', '重复用词', a.repeated.map((r) => r.w + ' ×' + r.n).join('、') + '。换几个同义词，或者删掉。']);
    if (!issues.length) issues.push(['good', '没什么硬伤', '结构、细节和反思都在线，接下来让别人读一遍，看哪里会走神。']);
    if (a.score >= 78) issues.push(['good', '有画面感', '这稿已经有“只有你能写”的部分了，别改掉那些具体的细节。']);

    $('#checkResult').innerHTML = `
      <div class="check-score">
        <div class="check-ring" style="background:conic-gradient(${color} ${a.score * 3.6}deg, rgba(255,255,255,.08) 0)">
          <b style="color:${color}">${a.score}</b><small>分</small>
        </div>
        <div class="check-head">
          <h4>${a.score >= 80 ? '这稿可以往下打磨了' : a.score >= 65 ? '骨架还在，血肉不够' : '先别改句子，先改故事'}</h4>
          <p>${a.isCJK ? '中文' : '英文'} · ${a.words} ${a.isCJK ? '字' : '词'} · ${a.sentences} 句 · 套话 ${a.cliches.length} 处</p>
        </div>
      </div>
      <div class="metric-grid">
        <div class="metric"><span>具体细节</span><b class="${a.concrete >= 6 ? '' : a.concrete >= 3 ? 'warn' : 'bad'}">${a.concrete}</b></div>
        <div class="metric"><span>句均长度</span><b class="${a.avgLen > 46 ? 'warn' : ''}">${a.avgLen}</b></div>
        <div class="metric"><span>反思信号</span><b class="${a.reflectHits ? '' : 'warn'}">${a.reflectHits}</b></div>
        <div class="metric"><span>第一人称</span><b>${Math.round(a.firstRatio * 100)}%</b></div>
      </div>
      ${a.cliches.length ? `<div class="word-chips">${a.cliches.slice(0, 8).map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}
      <div class="issue-list">
        ${issues.map((i) => `<div class="issue ${i[0]}"><i>${i[0] === 'good' ? '✓' : i[0] === 'warn' ? '!' : '×'}</i>
          <span><strong>${esc(i[1])}</strong>：${esc(i[2])}</span></div>`).join('')}
      </div>
      <p class="hint" style="margin-top:14px">体检只做规则检测，不是评审。它不知道你的故事好不好，只知道你写得够不够具体。</p>`;
  }

  const BAD_ESSAY = '从小我就对商业世界充满热爱。我的梦想是成为一名改变世界的企业家，让世界变得更美好。在成长的过程中，我参加了许多丰富多彩的活动，锻炼了我的综合能力，也让我明白了团队合作的重要性。我相信，只要坚持不懈地努力，就一定能实现自己的梦想。对我来说，这段经历意义重大，是我人生的转折点。未来，我希望能够为社会做出更大的贡献，成为一个独一无二的人。';

  /* ======================================================================
     事件
     ====================================================================== */
  function writeBind(t) {
    const path = t.dataset.bind;
    if (t.type === 'number') {
      setPath(state.profile, path, t.value === '' ? null : +t.value);
    } else {
      setPath(state.profile, path, t.value);
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.matches('[data-bind]') && t.tagName !== 'SELECT') {
      writeBind(t);
      schedule();
      return;
    }
    if (t.matches('[data-est-low],[data-est-high]')) {
      const key = t.dataset.estLow || t.dataset.estHigh;
      const base = view.scores[key] == null ? 0 : view.scores[key];
      const e = state.estimates[key] || {
        low: Math.max(0, Math.round(base - 5)),
        high: Math.min(100, Math.round(base + 5))
      };
      const v = t.value === '' ? Math.round(base) : C.clamp(+t.value, 0, 100);
      if (t.dataset.estLow) e.low = v; else e.high = v;
      state.estimates[key] = e;
      schedule();
      return;
    }
    if (t.matches('[data-check]')) {
      const key = t.dataset.check;
      const path = 'essay.' + key.replace(/^essay\./, '');
      setPath(state.profile, path, +t.value);
      const out = $('[data-check-val="' + key + '"]');
      if (out) out.textContent = t.value;
      schedule();
      return;
    }
    if (t.matches('[data-manual]')) {
      const k = t.dataset.manual;
      state.manual[k] = +t.value;
      const out = $('[data-manual-out="' + k + '"]');
      if (out) out.textContent = t.value;
      schedule();
      return;
    }
    if (t.matches('[data-row]') && (t.tagName === 'INPUT')) {
      updateRow(t, false);
      schedule();
      return;
    }
    if (t.id === 'schoolSearch') {
      state.ui.search = t.value;
      renderSchools();
    }
    if (t.id === 'pickerSearch') {
      renderPickerList();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.matches('[data-task]')) {
      const task = (state.tasks || []).find((x) => x.id === t.dataset.task);
      if (task) {
        task.done = t.checked;
        saveState();
        renderTasks();
      }
      return;
    }
    if (t.matches('[data-bind]')) {
      if (t.dataset.bind === 'gpa.scale') {
        const v = state.profile.gpa.value;
        if (v != null) {
          if (t.value === '100' && +v <= 4.3) state.profile.gpa.value = Math.round((+v / 4) * 1000) / 10;
          if (t.value === '4' && +v > 4.3) state.profile.gpa.value = Math.round((+v / 100) * 4 * 100) / 100;
        }
      }
      writeBind(t);
      if (t.dataset.bind === 'gpa.scale') syncInputs();
      schedule();
      return;
    }
    if (t.matches('[data-row]')) {
      updateRow(t, true);
      renderRows();
      schedule();
      return;
    }
    if (t.matches('[data-bg]')) {
      state.bg[t.dataset.bg] = t.checked;
      renderAll();
      return;
    }
    if (t.matches('[data-skip]')) {
      state.skip[t.dataset.skip] = t.checked;
      syncControls();
      renderAll();
      return;
    }
    if (t.matches('[data-est]')) {
      const key = t.dataset.est;
      if (t.checked) {
        const base = view.scores[key] == null ? 0 : view.scores[key];
        state.estimates[key] = {
          low: Math.max(0, Math.round(base - 5)),
          high: Math.min(100, Math.round(base + 5))
        };
      } else {
        state.estimates[key] = null;
      }
      syncControls();
      renderAll();
      return;
    }
    if (t.matches('[data-lock]')) {
      const k = t.dataset.lock;
      const range = $('[data-manual="' + k + '"]');
      if (t.checked) {
        state.manual[k] = Math.round(view.auto[k]);
        range.disabled = false;
        range.value = state.manual[k];
      } else {
        state.manual[k] = null;
        range.disabled = true;
      }
      const out = $('[data-manual-out="' + k + '"]');
      if (out) out.textContent = t.checked ? range.value : '';
      renderAll();
      return;
    }
    if (t.matches('[data-third]')) {
      state.profile.essay.interview.thirdParty = t.checked;
      renderAll();
      return;
    }
    if (t.matches('[data-pick]')) {
      toggleDream(t.dataset.pick);
      return;
    }
    if (t.id === 'overlayYear') {
      state.ui.overlayYear = t.value ? +t.value : null;
      if (t.value) state.ui.activeCohort = +t.value;
      renderAll();
      return;
    }
  }

  function updateRow(input, isSelect) {
    const key = input.dataset.row, idx = +input.dataset.idx, field = input.dataset.field;
    const item = state.profile[key][idx];
    if (!item) return;
    let v = input.value;
    if (input.type === 'number') v = v === '' ? null : +v;

    if (field === 'points') {
      item.customPts = v == null ? null : C.clamp(v, 0, key === 'comps' ? 100 : 70);
      return;
    }
    if (field === 'tierId') {
      if (String(v).indexOf('custom:') === 0) { item.customId = String(v).slice(7); item.tierId = null; }
      else { item.tierId = v; item.customId = null; }
      item.customPts = null;
      return;
    }
    if (field === 'subject') { item.subject = v; item.customPts = null; return; }
    if (field === 'score') { item.score = +v; return; }
    if (field === 'years') { item.years = +v; item.customPts = null; return; }
    if (field === 'type' || field === 'level' || field === 'role' || field === 'impact') {
      item[field] = v; item.customPts = null; return;
    }
    item[field] = v;
  }

  function addRow(kind) {
    if (kind === 'aps') state.profile.aps.push({ subject: 'Calculus BC', score: 5 });
    if (kind === 'comps') state.profile.comps.push({ name: '', subject: 'math', tierId: 'a' });
    if (kind === 'acts') state.profile.acts.push({ name: '', type: 'leadership', tierId: 'ae' });
    renderRows();
    renderAll();
  }

  function delRow(kind, idx) {
    state.profile[kind].splice(idx, 1);
    renderRows();
    renderAll();
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  function sampleMenu(open) {
    const pop = $('#samplePop');
    pop.hidden = open == null ? !pop.hidden : !open;
  }

  function applySample(key) {
    const keepRubric = state.customRubric;
    const keepCohorts = state.cohorts;
    const keepActive = state.ui.activeCohort;
    state = C.loadSample(key);
    state.customRubric = keepRubric;
    state.cohorts = keepCohorts;
    if (!C.cohortById(state, state.ui.overlayYear)) {
      state.ui.overlayYear = keepCohorts.length ? keepCohorts[0].year : null;
    }
    state.ui.activeCohort = C.cohortById(state, keepActive) ? keepActive : (keepCohorts[0] ? keepCohorts[0].year : null);
    sampleMenu(false);
    syncInputs();
    renderRows();
    renderAll();
    toast('已载入示例：' + D.SAMPLES[key].label);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearAll() {
    if (!window.confirm('清空六维数据？毕业生数据和自定义评分表会保留。')) return;
    state.profile = C.blankProfile();
    state.manual = { gpa: null, test: null, ap: null, comp: null, act: null, essay: null };
    state.skip = { gpa: false, test: false, ap: false, comp: false, act: false, essay: false };
    state.estimates = C.emptyEstimates();
    state.bg = C.blankBg();
    state.sample = null;
    syncInputs();
    renderRows();
    renderAll();
    toast('已清空，开始填你自己的吧');
  }

  function cardSchools() {
    const by = (t) => view.results.filter((r) => r.tier === t)[0];
    const picks = ['reach', 'match', 'safe'].map(by).filter(Boolean);
    if (picks.length < 3) {
      view.results.forEach((r) => { if (picks.length < 3 && picks.indexOf(r) < 0) picks.push(r); });
    }
    return picks;
  }

  function share() {
    const cohort = D.COHORT_ENABLED ? C.cohortById(state, state.ui.overlayYear) : null;
    const cohortValues = cohort ? dimsToObj(cohort.dims) : null;
    const deltas = cohort ? DIMS.reduce((o, d, i) => {
      o[d.key] = view.scores[d.key] == null ? null : Math.round((view.scores[d.key] || 0) - (cohort.dims[i] || 0));
      return o;
    }, {}) : null;
    const canvas = R.exportCard({
      title: '我的六维录取画像',
      persona: view.persona,
      scores: view.scores,
      ranges: view.ranges,
      power: fmtScore(view.power),
      powerRange: view.powerHigh - view.powerLow >= 1 ? view.powerLow + '–' + view.powerHigh : null,
      rating: view.rating,
      schools: cardSchools(),
      cohortValues,
      cohortLabel: cohort ? cohort.year + ' 届平均' : '',
      deltas,
      date: new Date().toLocaleDateString('zh-CN')
    });
    try {
      const a = document.createElement('a');
      a.download = 'AdmitLab-六维画像-' + new Date().toISOString().slice(0, 10) + '.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('分享卡已生成，在下载文件夹里');
    } catch (err) {
      toast('生成失败，换个浏览器试试');
    }
  }

  /* ======================================================================
     绑定
     ====================================================================== */
  function bind() {
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.pick-wrap')) {
        const p = $('#schoolPicker');
        if (p && !p.hidden) { p.hidden = true; $('#overlaySchoolBtn').setAttribute('aria-expanded', 'false'); }
      }
      const close = e.target.closest('[data-close]');
      if (close) { closeModal(); return; }
      if (e.target.closest('#overlaySchoolBtn')) {
        const p = $('#schoolPicker');
        p.hidden = !p.hidden;
        $('#overlaySchoolBtn').setAttribute('aria-expanded', String(!p.hidden));
        if (!p.hidden) renderPickerList();
        return;
      }
      if (e.target.closest('#pickerClear')) {
        state.ui.overlaySchools = [];
        renderAll();
        return;
      }
      const unpick = e.target.closest('[data-unpick]');
      if (unpick) { toggleDream(unpick.dataset.unpick); return; }
      if (e.target.closest('[data-add-case]')) { openCaseForm(); return; }
      const caseDel = e.target.closest('[data-case-del]');
      if (caseDel) {
        state.cases = (state.cases || []).filter((c) => c.id !== caseDel.dataset.caseDel);
        saveState();
        renderCases();
        return;
      }
      if (e.target.closest('[data-snap-now]')) { saveSnapshot(); return; }
      const snapDel = e.target.closest('[data-snap-del]');
      if (snapDel) {
        state.snapshots = (state.snapshots || []).filter((s) => s.id !== snapDel.dataset.snapDel);
        saveState();
        renderGrowth();
        return;
      }
      if (e.target.closest('[data-task-gen]')) { generateTasks(); return; }
      if (e.target.closest('[data-task-clear]')) {
        state.tasks = [];
        saveState();
        renderTasks();
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) { addRow(add.dataset.add); return; }
      const del = e.target.closest('[data-del]');
      if (del) { delRow(del.dataset.del, +del.dataset.idx); return; }
      const destDel = e.target.closest('[data-dest-del]');
      if (destDel) { destDel.closest('.dest-edit-row').remove(); return; }
      const scroll = e.target.closest('[data-scroll]');
      if (scroll) {
        const el = document.getElementById(scroll.dataset.scroll);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (e.target.closest('[data-legend="me"]')) {
        const el = document.getElementById('sec-input');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const school = e.target.closest('[data-school]');
      if (school) { openSchool(school.dataset.school); return; }
      const clear = e.target.closest('[data-clear]');
      if (clear) {
        if (clear.dataset.clear === 'cohort') state.ui.overlayYear = null;
        if (clear.dataset.clear === 'school') state.ui.overlaySchools = [];
        renderAll();
        return;
      }
      const compSubj = e.target.closest('[data-comp-subject]');
      if (compSubj) {
        state.ui.compSubject = compSubj.dataset.compSubject;
        renderCompRubric();
        saveState();
        return;
      }
      const year = e.target.closest('[data-cohort]');
      if (year) {
        state.ui.activeCohort = +year.dataset.cohort;
        state.ui.overlayYear = +year.dataset.cohort;
        renderAll();
        return;
      }
      const delCustom = e.target.closest('[data-del-custom]');
      if (delCustom) {
        state.customRubric = state.customRubric.filter((x) => x.id !== delCustom.dataset.delCustom);
        renderRows();
        renderAll();
        toast('已从评分表移除');
        return;
      }
      const useAct = e.target.closest('[data-use-act]');
      if (useAct) {
        const item = state.customRubric.find((x) => x.id === useAct.dataset.useAct);
        if (item) {
          state.profile.acts.push({ name: item.name, type: 'leadership', tierId: 'ae', customPts: item.pts });
          renderRows();
          renderAll();
          toast('已添加活动：' + item.name);
        }
        return;
      }
      const tab = e.target.closest('.ws-tabs button');
      if (tab) {
        $$('.ws-tabs button').forEach((b) => b.classList.toggle('on', b === tab));
        $$('.ws-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === tab.dataset.ws));
        return;
      }
      const sampleBtn = e.target.closest('[data-sample]');
      if (sampleBtn) { applySample(sampleBtn.dataset.sample); return; }
      if (!e.target.closest('#samplePop') && !e.target.closest('#btnSample')) sampleMenu(false);
      if (e.target.closest('#btnSample')) sampleMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); sampleMenu(false); }
    });

    $('#btnSave').onclick = () => { saveState(); toast('已保存到这台设备'); };
    $('#btnShare').onclick = share;
    $('#btnSnapshot').onclick = saveSnapshot;
    $('#btnAddCase').onclick = openCaseForm;
    $('#btnExport').onclick = exportArchive;
    $('#btnImport').onclick = () => $('#importFile').click();
    $('#importFile').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importArchive(f);
      e.target.value = '';
    };
    $('#btnBannerClear').onclick = clearAll;
    $('#btnClearAll').onclick = clearAll;
    $('#btnLockAll').onclick = () => {
      state.manual = { gpa: null, test: null, ap: null, comp: null, act: null, essay: null };
      syncInputs();
      renderAll();
      toast('六维已全部恢复自动算分');
    };
    $('#btnEditCohort').onclick = () => { const c = activeCohort(); if (c) cohortForm(c); };
    $('#btnAddCohort').onclick = () => cohortForm(null);
    $('#btnQuickCheck').onclick = () => {
      const text = (state.profile.essay && state.profile.essay.text) || '';
      if (text.trim().length < 40) { toast('先在上面粘一段文书草稿'); return; }
      const a = C.analyzeEssay(text);
      $('#quickCheckOut').textContent = '体检 ' + a.score + ' 分 · ' + a.words + ' 字 · 套话 ' + a.cliches.length +
        ' 处 · 具体细节 ' + a.concrete + ' 个。' + (a.cliches.length ? '先把套话删掉。' : '细节够用，继续打磨反思。');
    };
    $('#btnCheck').onclick = runCheck;
    $('#btnLoadSampleEssay').onclick = () => {
      $('#essayDraft').value = BAD_ESSAY;
      state.profile.essay.text = BAD_ESSAY;
      renderAll();
      toast('已塞入一段“招生官看了会困”的范文');
    };
    $('#btnRegenOutline').onclick = () => {
      renderOutlines();
      toast('已按当前素材重新生成故事线');
    };
    $('#btnAddRubric').onclick = () => {
      $('#customForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#customForm input[name="name"]').focus();
    };
    $('#customForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get('name') || '').trim();
      const pts = C.clamp(+fd.get('pts') || 0, 1, 100);
      if (!name) return;
      state.customRubric.push({ id: 'c' + Date.now().toString(36), name, kind: fd.get('kind'), pts });
      e.target.reset();
      renderRows();
      renderAll();
      toast('已加入评分表：' + name + ' ' + pts + ' 分');
    });

    /* 筛选 & 搜索 */
    $$('#typeFilter button').forEach((b) => {
      b.onclick = () => {
        state.ui.typeFilter = b.dataset.type;
        $$('#typeFilter button').forEach((x) => x.classList.toggle('on', x === b));
        renderSchools();
        saveState();
      };
    });
    /* 导航高亮 */
    const links = $$('.topnav a');
    const secs = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      secs.forEach((s) => io.observe(s));
    }
  }

  function activateWs(name) {
    const btn = $$('.ws-tabs button').find((b) => b.dataset.ws === name);
    if (!btn) return;
    $$('.ws-tabs button').forEach((b) => b.classList.toggle('on', b === btn));
    $$('.ws-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === name));
  }

  /* ======================================================================
     启动
     ====================================================================== */
  function init() {
    state = load();
    recalc();
    buildDimExtras();
    $$('#typeFilter button').forEach((b) => b.classList.toggle('on', b.dataset.type === state.ui.typeFilter));
    bind();
    syncInputs();
    renderRows();
    renderAll();
    renderFormula();
    renderRubricTables();
    renderChangelog();
    renderSources();
    R.mount($('#radar'));
    if (!storageOk) {
      setTimeout(() => toast('浏览器禁用了本地存储，刷新会丢数据；请用「导出存档」备份'), 1400);
    }
    if (state.sample) {
      setTimeout(() => toast('这是示例数据，点「清空重来」就能算你自己的'), 700);
    }
    try {
      const q = new URLSearchParams(location.search);
      const sid = q.get('school');
      if (sid && D.SCHOOLS.some((s) => s.id === sid)) setTimeout(() => openSchool(sid), 300);
      if (q.get('ws')) activateWs(q.get('ws'));
    } catch (err) { /* file:// 下没有 URLSearchParams 也能正常用 */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
