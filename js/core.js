/* ==========================================================================
   AdmitLab · 计算核心
   纯函数，浏览器与 Node 通用
   ========================================================================== */
(function (root) {
  'use strict';
  const D = root.ADMIT_DATA;
  const DIMS = D.DIMS;

  /* ---------------- 基础工具 ---------------- */
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round = (n, d = 0) => { const p = Math.pow(10, d); return Math.round(n * p) / p; };
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isNum = (v) => v !== null && v !== undefined && v !== '' && !isNaN(+v);

  function interp(x, anchors) {
    if (!isNum(x)) return 0;
    const pts = anchors;
    const v = +x;
    if (v <= pts[0][0]) return pts[0][1];
    if (v >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
      if (v <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return y0 + (y1 - y0) * (v - x0) / (x1 - x0);
      }
    }
    return 0;
  }

  function byId(list, id) { return list.find((x) => x.id === id) || null; }
  function shortName(school) {
    return (school && D.SHORT_NAMES && D.SHORT_NAMES[school.id]) || (school ? school.name : '');
  }
  function keywordsFor(school) {
    return (school && D.SCHOOL_KEYWORDS && D.SCHOOL_KEYWORDS[school.id]) || (school && school.tags) || [];
  }
  function factsFor(school) {
    return (school && D.SCHOOL_FACTS && D.SCHOOL_FACTS[school.id]) || null;
  }

  /* ---------------- 默认状态 ---------------- */
  function emptyChecks(list, v) {
    const o = {};
    (list || D.ESSAY_CHECKS).forEach((c) => { o[c.key] = v; });
    return o;
  }

  function emptyEstimates() {
    const o = {};
    D.DIMS.forEach((d) => { o[d.key] = null; });
    return o;
  }

  function blankEssay() {
    return {
      checks: emptyChecks(D.ESSAY_CHECKS, 0),
      rec: emptyChecks(D.REC_CHECKS, 0),
      interview: Object.assign(emptyChecks(D.INTERVIEW_CHECKS, 0), { thirdParty: false }),
      text: ''
    };
  }

  function blankProfile() {
    return {
      gpa: { scale: '4', value: null, rigor: 'ap_std', rank: 'top10', trend: 'up' },
      test: { sat: null, act: null, toefl: null, ielts: null },
      aps: [],
      comps: [],
      acts: [],
      essay: blankEssay()
    };
  }

  function blankBg() {
    return { domestic: false, usHigh: false, firstGen: false, legacy: false, athlete: false, aidNeed: false };
  }

  function backgroundFor(school, bg) {
    bg = bg || {};
    const isPublic = school.type === 'public';
    const domestic = !!bg.domestic;
    const parts = [];

    if (domestic) parts.push({ key: 'domestic', label: '绿卡 / 公民', value: isPublic ? 6 : Math.max(3, (D.SCHOOL_INTL[school.id] || 0) + 1) });
    else if (D.SCHOOL_INTL[school.id]) parts.push({ key: 'intl', label: '国际生友好度', value: D.SCHOOL_INTL[school.id] });

    if (bg.usHigh) parts.push({ key: 'usHigh', label: '美高', value: isPublic ? 2 : 3 });
    if (bg.firstGen) parts.push({ key: 'firstGen', label: '第一代', value: isPublic ? 4 : 3 });
    if (bg.legacy) parts.push({ key: 'legacy', label: '校友子女', value: isPublic ? 1 : (school.rate < 0.1 ? 5 : 3) });
    if (bg.athlete) parts.push({ key: 'athlete', label: '体育特招', value: D.D1_SCHOOLS.indexOf(school.id) >= 0 ? 10 : 6 });
    if (bg.aidNeed && !domestic) {
      const blind = D.NEED_BLIND_INTL.indexOf(school.id) >= 0;
      parts.push({ key: 'aidNeed', label: '助学金需求', value: blind ? 0 : (isPublic ? -1 : -4) });
    }
    const total = clamp(parts.reduce((a, p) => a + p.value, 0), -15, 20);
    return { total, parts: parts.filter((p) => p.value !== 0) };
  }

  function defaultState() {
    return {
      version: 5,
      sample: null,
      profile: blankProfile(),
      manual: { gpa: null, test: null, ap: null, comp: null, act: null, essay: null },
      skip: { gpa: false, test: false, ap: false, comp: false, act: false, essay: false },
      estimates: { gpa: null, test: null, ap: null, comp: null, act: null, essay: null },
      bg: blankBg(),
      cohorts: clone(D.COHORTS),
      customRubric: [],
      snapshots: [],
      tasks: [],
      cases: [],
      ui: {
        overlayYear: null, overlaySchools: [], typeFilter: 'all', search: '',
        activeCohort: D.COHORTS[0].year, compSubject: 'math'
      }
    };
  }

  /* ---------------- 分项打分 ---------------- */
  function gpaScore(g) {
    const anchors = g.scale === '100' ? D.GPA_ANCHORS_100 : D.GPA_ANCHORS_4;
    const base = interp(g.value, anchors);
    const rigor = D.GPA_RIGOR[g.rigor] || { name: '—', bonus: 0 };
    const rank = D.GPA_RANK[g.rank] || { name: '—', bonus: 0 };
    const trend = D.GPA_TREND[g.trend] || { name: '—', bonus: 0 };
    return {
      score: clamp(base + rigor.bonus + rank.bonus + trend.bonus, 0, 100),
      base, rigor, rank, trend,
      maxed: base >= 90 && rigor.bonus >= 7 && rank.bonus >= 4
    };
  }

  function testScore(t) {
    const sat = isNum(t.sat) ? interp(t.sat, D.SAT_ANCHORS) : null;
    const act = isNum(t.act) ? interp(t.act, D.ACT_ANCHORS) : null;
    const toefl = isNum(t.toefl) ? interp(t.toefl, D.TOEFL_ANCHORS) : null;
    const ielts = isNum(t.ielts) ? interp(t.ielts, D.IELTS_ANCHORS) : null;

    const core = sat !== null && act !== null ? Math.max(sat, act) : (sat !== null ? sat : act);
    const eng = toefl !== null && ielts !== null ? Math.max(toefl, ielts) : (toefl !== null ? toefl : ielts);

    let score = 0, mode = 'none';
    if (core !== null && eng !== null) { score = core * 0.75 + eng * 0.25; mode = 'both'; }
    else if (core !== null) { score = core * 0.94; mode = 'core'; }
    else if (eng !== null) { score = eng * 0.8; mode = 'lang'; }

    const bestSat = isNum(t.sat) ? +t.sat : null;
    const bestAct = isNum(t.act) ? +t.act : null;
    return { score: clamp(score, 0, 100), sat, act, toefl, ielts, core, eng, mode, bestSat, bestAct, hasEnglish: eng !== null };
  }

  function apScore(aps) {
    const list = (aps || []).filter((a) => a && a.subject);
    if (!list.length) return { score: 0, quality: 0, quantity: 0, hard: 0, n: 0, five: 0 };
    const pts = list.map((a) => D.AP_SCORE_POINTS[a.score] !== undefined ? D.AP_SCORE_POINTS[a.score] : 40);
    const quality = mean(pts);
    const quantity = Math.min(100, list.length * 15 + 10);
    const hard = list.filter((a) => {
      const s = D.AP_SUBJECTS.find((x) => x.name === a.subject);
      return s && s.hard && +a.score >= 4;
    }).length;
    const five = list.filter((a) => +a.score === 5).length;
    return {
      score: clamp(quality * 0.62 + quantity * 0.38 + Math.min(6, hard * 1.5), 0, 100),
      quality, quantity, hard, n: list.length, five
    };
  }

  function compTier(item) { return byId(D.COMP_TIERS, item.tierId); }
  function compSubject(item) { return byId(D.COMP_SUBJECTS, item.subject); }

  function compPoints(item, customRubric) {
    if (item.customPts !== null && item.customPts !== undefined && isNum(item.customPts)) {
      return clamp(Math.round(+item.customPts), 0, 100);
    }
    if (item.customId) {
      const c = (customRubric || []).find((x) => x.id === item.customId);
      return c ? clamp(c.pts, 0, 100) : 0;
    }
    const tier = compTier(item);
    return tier ? tier.pts : 0;
  }

  function compName(item, customRubric) {
    if (item.name) return item.name;
    if (item.customId) {
      const c = (customRubric || []).find((x) => x.id === item.customId);
      if (c) return c.name;
    }
    const tier = compTier(item), sub = compSubject(item);
    return (sub ? sub.name + ' · ' : '') + (tier ? tier.label + ' 档' : '竞赛');
  }

  function compExample(item) {
    const tier = compTier(item);
    if (!tier) return '';
    return (tier.examples && tier.examples[item.subject]) || tier.desc || '';
  }

  function compScore(comps, customRubric) {
    const items = (comps || []).map((c) => ({
      item: c,
      name: compName(c, customRubric),
      points: compPoints(c, customRubric),
      tier: (compTier(c) || {}).label || '自定义'
    })).filter((x) => x.points > 0).sort((a, b) => b.points - a.points);

    if (!items.length) return { score: 0, top: 0, items: [], breadth: 0, avg3: 0 };
    const top = items[0].points;
    const avg3 = mean(items.slice(0, 3).map((x) => x.points));
    const breadth = Math.min(6, Math.max(0, items.length - 1) * 1.5);
    return {
      score: clamp(top * 0.72 + avg3 * 0.28 + breadth, 0, 100),
      top, avg3, breadth, items
    };
  }

  function actTier(a) { return byId(D.ACT_TIERS, a.tierId); }

  function actPoints(a) {
    if (a.customPts !== null && a.customPts !== undefined && isNum(a.customPts)) {
      return clamp(Math.round(+a.customPts), 0, 70);
    }
    const t = actTier(a);
    return t ? t.pts : 0;
  }

  function actName(a) {
    if (a.name) return a.name;
    const t = actTier(a);
    return t ? t.label + ' 档活动' : '一项活动';
  }

  function actScore(acts) {
    const items = (acts || []).map((a) => ({ item: a, points: actPoints(a) }))
      .filter((x) => x.points > 0).sort((a, b) => b.points - a.points);
    const weights = [1, 0.65, 0.45, 0.3, 0.2];
    let s = 0;
    items.slice(0, weights.length).forEach((x, i) => { s += x.points * weights[i]; });
    return { score: clamp(s, 0, 100), items, top: items.length ? items[0].points : 0 };
  }

  function essayScore(essay, text) {
    const checks = (essay && essay.checks) || {};
    let self = 0, filled = 0;
    D.ESSAY_CHECKS.forEach((c) => {
      const v = clamp(+checks[c.key] || 0, 0, 10);
      if (v > 0) filled++;
      self += (v / 10) * c.weight;
    });
    self *= 100;
    const draft = typeof text === 'string' ? text : (essay && essay.text) || '';
    const analysis = draft.trim().length > 40 ? analyzeEssay(draft) : null;
    let score = self;
    if (analysis) score = filled > 0 ? self * 0.65 + analysis.score * 0.35 : analysis.score;
    return { score: clamp(score, 0, 100), self, analysis, hasText: !!analysis };
  }

  function recScore(rec) {
    let s = 0, filled = 0;
    D.REC_CHECKS.forEach((c) => {
      const v = clamp(+((rec || {})[c.key]) || 0, 0, 10);
      if (v > 0) filled++;
      s += (v / 10) * c.weight;
    });
    return { score: filled ? s * 100 : 0, filled };
  }

  function interviewScore(itv) {
    let s = 0, filled = 0;
    D.INTERVIEW_CHECKS.forEach((c) => {
      const v = clamp(+((itv || {})[c.key]) || 0, 0, 10);
      if (v > 0) filled++;
      s += (v / 10) * c.weight;
    });
    let score = filled ? s * 100 : 0;
    if (itv && itv.thirdParty) score = Math.min(100, score + 3);
    return { score, filled, thirdParty: !!(itv && itv.thirdParty) };
  }

  /* 第六维 = 材料：文书 + 推荐信 + 面试，按已有材料重新分配权重 */
  function materialScore(essay) {
    essay = essay || {};
    const es = essayScore(essay, essay.text);
    const rec = recScore(essay.rec);
    const itv = interviewScore(essay.interview);
    const essayFilled = es.self > 0 || es.hasText;

    const parts = [];
    if (essayFilled) parts.push({ key: 'essay', label: '文书', v: es.score, w: D.MATERIAL_WEIGHTS.essay });
    if (rec.filled) parts.push({ key: 'rec', label: '推荐信', v: rec.score, w: D.MATERIAL_WEIGHTS.rec });
    if (itv.filled) parts.push({ key: 'interview', label: '面试', v: itv.score, w: D.MATERIAL_WEIGHTS.interview });

    if (!parts.length) {
      return { score: 0, parts, essay: es, rec, interview: itv, essayFilled: false, empty: true };
    }
    const wsum = sum(parts.map((p) => p.w));
    let score = sum(parts.map((p) => p.v * p.w)) / wsum;
    if (!essayFilled) score = Math.min(score, 88);
    return {
      score: clamp(round(score, 1), 0, 100), parts,
      essay: es, rec, interview: itv, essayFilled,
      empty: false
    };
  }

  /* ---------------- 总分 ---------------- */
  function computeScores(profile, manual, extras) {
    manual = manual || {};
    extras = extras || {};
    const skip = extras.skip || {};
    const est = extras.estimates || {};
    const p = profile;
    const g = gpaScore(p.gpa);
    const t = testScore(p.test);
    const a = apScore(p.aps);
    const c = compScore(p.comps, p.customRubric);
    const ac = actScore(p.acts);
    const es = materialScore(p.essay);

    const auto = {
      gpa: g.score, test: t.score, ap: a.score,
      comp: c.score, act: ac.score, essay: es.score
    };
    const scores = {}, locked = {}, ranges = {}, skipped = {};
    DIMS.forEach((d) => {
      if (skip[d.key]) {
        scores[d.key] = null;
        ranges[d.key] = null;
        skipped[d.key] = true;
        return;
      }
      const m = manual[d.key];
      locked[d.key] = isNum(m);
      const v = isNum(m) ? clamp(+m, 0, 100) : round(auto[d.key], 1);
      scores[d.key] = v;
      const e = est[d.key];
      if (e && isNum(e.low) && isNum(e.high)) {
        const lo = clamp(Math.min(+e.low, +e.high), 0, 100);
        const hi = clamp(Math.max(+e.low, +e.high), 0, 100);
        ranges[d.key] = { low: lo, high: hi };
      } else {
        ranges[d.key] = { low: v, high: v };
      }
    });

    return {
      scores, auto, locked, ranges, skipped,
      detail: { gpa: g, test: t, ap: a, comp: c, act: ac, essay: es }
    };
  }

  function powerOf(scores) {
    let s = 0, w = 0;
    DIMS.forEach((d) => {
      const v = scores[d.key];
      if (v == null) return;
      s += v * D.GLOBAL_WEIGHTS[d.key];
      w += D.GLOBAL_WEIGHTS[d.key];
    });
    return w ? round(s / w, 1) : 0;
  }

  function powerRange(scores, ranges) {
    let lo = 0, hi = 0, w = 0;
    DIMS.forEach((d) => {
      if (scores[d.key] == null) return;
      const r = ranges && ranges[d.key] ? ranges[d.key] : { low: scores[d.key], high: scores[d.key] };
      lo += r.low * D.GLOBAL_WEIGHTS[d.key];
      hi += r.high * D.GLOBAL_WEIGHTS[d.key];
      w += D.GLOBAL_WEIGHTS[d.key];
    });
    return w ? { low: round(lo / w, 1), high: round(hi / w, 1) } : { low: 0, high: 0 };
  }

  function ratingOf(power) {
    if (power >= 92) return 'S';
    if (power >= 86) return 'A+';
    if (power >= 80) return 'A';
    if (power >= 74) return 'B+';
    if (power >= 68) return 'B';
    if (power >= 60) return 'C+';
    if (power >= 52) return 'C';
    return 'D';
  }

  const ROLE_NAMES = {
    gpa: '绩点机器', test: '标化杀手', ap: 'AP 收割机',
    comp: '竞赛战神', act: '活动家', essay: '材料大师'
  };

  function personaOf(scores) {
    const present = DIMS.filter((d) => scores[d.key] != null && scores[d.key] > 0);
    if (!present.length) {
      return {
        name: '还没开始', desc: '六项都还空着。先填几个真实数字，哪怕是“没有”，也好过空白。',
        top: DIMS[0], low: DIMS[0], max: 0, min: 0, avg: 0, sd: 0
      };
    }
    const arr = present.map((d) => scores[d.key] || 0);
    const avg = mean(arr);
    const sd = Math.sqrt(mean(arr.map((v) => Math.pow(v - avg, 2))));
    const max = Math.max.apply(null, arr);
    const min = Math.min.apply(null, arr);
    const top = present[arr.indexOf(max)];
    const low = present[arr.indexOf(min)];

    let name;
    if (avg >= 88 && sd < 7) name = '六边形战士';
    else if (max - min >= 34 && max >= 72) name = ROLE_NAMES[top.key] + ' · 偏科型';
    else if (avg >= 80) name = '均衡型选手';
    else if (avg >= 68) name = '潜力股 · 只差一个尖';
    else if (avg >= 50) name = '正在长出来的申请者';
    else name = '故事才刚开头';

    let desc;
    if (avg < 20) {
      desc = '六项都还空着。先填几个真实数字，哪怕是“没有”，也好过空白。';
    } else if (avg >= 88 && sd < 7) {
      desc = '六块板一样长，招生官挑不出硬伤，剩下就看故事够不够独特。';
    } else {
      desc = top.name + ' 是你最锋利的一把刀（' + round(max, 0) + ' 分），' + low.name +
        ' 是现在最漏水的那块板（' + round(min, 0) + ' 分）。补短板通常比再堆长板涨得快。';
    }
    return { name, desc, top, low, max, min, avg: round(avg, 1), sd: round(sd, 1) };
  }

  /* ---------------- 学校匹配 ---------------- */
  function estimateProbability(fit, rate) {
    const exp = Math.min(8, Math.pow(2, (fit - 82) / 9));
    let p = 1 - Math.pow(1 - rate, exp);
    p = Math.min(p, rate * 3.2, 0.95);
    return clamp(p, 0.004, 0.95);
  }

  function tierOf(p) {
    if (p >= 0.6) return 'safe';
    if (p >= 0.3) return 'match';
    if (p >= 0.12) return 'reach';
    return 'dream';
  }

  const TIER_LABEL = { safe: '保底', match: '匹配', reach: '冲刺', dream: '梦校' };

  function fitParts(scores, school) {
    const blind = !!school.blind;
    const gaps = [];
    let wsum = 0, deficit = 0, surplus = 0;

    DIMS.forEach((d, i) => {
      if (blind && d.key === 'test') return;
      if (scores[d.key] == null) return;
      const bench = school.dims[i];
      if (!bench) return;
      wsum += bench;
    });

    DIMS.forEach((d, i) => {
      const bench = school.dims[i];
      const mine = scores[d.key];
      if (blind && d.key === 'test') {
        gaps.push({ key: d.key, bench: 0, mine: null, gap: 0, w: 0, ignored: true, reason: 'blind' });
        return;
      }
      if (mine == null) {
        gaps.push({ key: d.key, bench, mine: null, gap: 0, w: 0, ignored: true, reason: 'skip' });
        return;
      }
      if (!bench) {
        gaps.push({ key: d.key, bench: 0, mine, gap: 0, w: 0, ignored: true });
        return;
      }
      const w = bench / wsum;
      const gap = Math.max(0, bench - mine);
      deficit += w * gap;
      if (gap === 0) surplus += (mine - bench) * w;
      gaps.push({ key: d.key, bench, mine, gap, w, ignored: false });
    });

    let fit = clamp(100 - deficit * 1.55, 0, 100);
    fit = clamp(fit + Math.min(2, surplus * 0.15), 0, 100);
    return { fit: round(fit, 1), gaps };
  }

  function matchSchool(scores, school, opts) {
    opts = opts || {};
    const base = fitParts(scores, school);
    let fitLow = base.fit, fitHigh = base.fit;
    if (opts.ranges) {
      const lo = {}, hi = {};
      DIMS.forEach((d) => {
        if (scores[d.key] == null) { lo[d.key] = null; hi[d.key] = null; return; }
        const r = opts.ranges[d.key];
        lo[d.key] = r ? r.low : scores[d.key];
        hi[d.key] = r ? r.high : scores[d.key];
      });
      fitLow = fitParts(lo, school).fit;
      fitHigh = fitParts(hi, school).fit;
    }
    if (fitLow > fitHigh) { const tmp = fitLow; fitLow = fitHigh; fitHigh = tmp; }
    const fit = base.fit;
    const bgInfo = backgroundFor(school, opts.bg);
    const adj = bgInfo.total;
    const p = estimateProbability(clamp(fit + adj, 0, 100), school.rate);
    const pLow = estimateProbability(clamp(fitLow + adj, 0, 100), school.rate);
    const pHigh = estimateProbability(clamp(fitHigh + adj, 0, 100), school.rate);
    const tier = tierOf(p);
    return {
      school, fit, fitLow, fitHigh,
      p: round(p, 4), pLow: round(pLow, 4), pHigh: round(pHigh, 4), tier,
      bgAdj: adj, bgParts: bgInfo.parts,
      gaps: base.gaps.sort((a, b) => b.gap * b.w - a.gap * a.w),
      blind: !!school.blind,
      mainGap: base.gaps.filter((g) => !g.ignored && g.gap > 0).sort((a, b) => b.gap - a.gap)[0] || null
    };
  }

  function matchAll(scores, opts) {
    return D.SCHOOLS.map((s) => matchSchool(scores, s, opts)).sort((a, b) => b.fit - a.fit);
  }

  function shortlist(results) {
    const pick = (tier, n) => results.filter((r) => r.tier === tier).slice(0, n);
    const list = []
      .concat(pick('reach', 2))
      .concat(pick('match', 4))
      .concat(pick('safe', 2));
    if (list.length < 8) {
      const rest = results.filter((r) => list.indexOf(r) === -1).slice(0, 8 - list.length);
      return list.concat(rest);
    }
    return list;
  }

  /* ---------------- 毕业生对比 ---------------- */
  function cohortPower(cohort) {
    let s = 0;
    DIMS.forEach((d, i) => { s += (cohort.dims[i] || 0) * D.GLOBAL_WEIGHTS[d.key]; });
    return round(s, 1);
  }

  function cohortStats(cohort, scores) {
    const power = powerOf(scores);
    const avg = cohortPower(cohort);
    const delta = round(power - avg, 1);
    const percentile = clamp(1 / (1 + Math.exp(-(power - avg) / 6.5)), 0.01, 0.99);
    return {
      power, avg, delta,
      percentile: round(percentile * 100, 0),
      top: round((1 - percentile) * 100, 0),
      dims: cohort.dims
    };
  }

  function cohortById(state, year) {
    return (state.cohorts || []).find((c) => +c.year === +year) || null;
  }

  /* ---------------- 提分建议 ---------------- */
  function secureSim(key, profile, scores, mutate) {
    const p = clone(profile);
    mutate(p);
    const next = computeScores(p, {}).scores[key];
    return round(next - (scores[key] || 0), 1);
  }

  function adviceFor(key, profile, scores) {
    if (scores[key] == null) return { text: '已标记为「没有这项」，不参与总分和匹配。', gain: 0 };
    const out = [];
    const d = computeScores(profile, {}).detail[key];
    const add = (text, gain) => { if (gain > 0.4) out.push({ text, gain: round(gain, 1) }); };

    if (key === 'gpa') {
      const g = profile.gpa;
      if (!isNum(g.value)) {
        add('先填 GPA 或平均分，这是整张图的底座。', 20);
      } else if (g.scale === '4' ? g.value < 3.95 : g.value < 95) {
        const target = g.scale === '4' ? Math.min(4, +(g.value + 0.1).toFixed(2)) : Math.min(100, +g.value + 3);
        add('GPA 拉到 ' + (g.scale === '4' ? target.toFixed(2) : target) + (g.scale === '4' ? ' / 4.0' : ' / 100') + '，这一维 +{g}', secureSim('gpa', profile, scores, (p) => { p.gpa.value = target; }));
      }
      if (g.rigor !== 'ap_heavy') {
        add('AP 课程量提到 7 门以上（或全 AP 课表），这一维 +{g}', secureSim('gpa', profile, scores, (p) => { p.gpa.rigor = 'ap_heavy'; }));
      }
      if (g.rank !== 'top1' && g.rank !== 'none') {
        add('排名进前 1%，这一维 +{g}', secureSim('gpa', profile, scores, (p) => { p.gpa.rank = 'top1'; }));
      }
      if (g.trend === 'down') {
        add('把最近一学期的成绩拉回来，趋势 +{g}', secureSim('gpa', profile, scores, (p) => { p.gpa.trend = 'up'; }));
      }
    }

    if (key === 'test') {
      const t = profile.test;
      if (!isNum(t.sat) && !isNum(t.act)) {
        add('先考一次 SAT / ACT，标化空着会明显拖后腿。', 18);
      } else if (isNum(t.sat) && +t.sat < 1550) {
        add('SAT 提到 1550，这一维 +{g}', secureSim('test', profile, scores, (p) => { p.test.sat = 1550; }));
      } else if (!isNum(t.act) && isNum(t.sat) && +t.sat < 1580) {
        add('SAT 再冲到 1580，这一维 +{g}', secureSim('test', profile, scores, (p) => { p.test.sat = 1580; }));
      }
      if (!isNum(t.toefl) && !isNum(t.ielts)) {
        add('补一个托福 / 雅思成绩（国际生语言项），这一维 +{g}', secureSim('test', profile, scores, (p) => { p.test.toefl = 110; }));
      } else if (isNum(t.toefl) && +t.toefl < 110) {
        add('托福到 110，这一维 +{g}', secureSim('test', profile, scores, (p) => { p.test.toefl = 110; }));
      } else if (isNum(t.ielts) && +t.ielts < 7.5) {
        add('雅思到 7.5，这一维 +{g}', secureSim('test', profile, scores, (p) => { p.test.ielts = 7.5; }));
      }
    }

    if (key === 'ap') {
      const a = profile.aps || [];
      if (a.length < 6) {
        add('再考 2 门 AP 并拿到 5，这一维 +{g}', secureSim('ap', profile, scores, (p) => {
          p.aps = a.concat([{ subject: 'Calculus BC', score: 5 }, { subject: 'Statistics', score: 5 }]);
        }));
      }
      const low = a.find((x) => +x.score <= 3);
      if (low) {
        add('把 ' + low.subject + ' 从 ' + low.score + ' 分刷到 5，这一维 +{g}', secureSim('ap', profile, scores, (p) => {
          const t = p.aps.find((x) => x.subject === low.subject);
          if (t) t.score = 5;
        }));
      }
      if (a.length >= 6 && !d.hard) {
        add('补一门硬核 AP（Calc BC / Physics C / CSA），这一维 +{g}', secureSim('ap', profile, scores, (p) => {
          p.aps = p.aps.concat([{ subject: 'Calculus BC', score: 5 }]);
        }));
      }
      if (a.length >= 8 && d.quality >= 96) {
        add('AP 这块已经接近满格，把时间还给活动和文书。', 0);
      }
    }

    if (key === 'comp') {
      const list = profile.comps || [];
      if (!list.length) {
        add('先拿一个省级一等奖（B+ 档，68 分）打底，这一维 +{g}', secureSim('comp', profile, scores, (p) => {
          p.comps = [{ name: '省级学科竞赛', subject: 'math', tierId: 'bplus' }];
        }));
      } else {
        const top = d.top || 0;
        const next = D.COMP_TIERS.slice().sort((a, b) => a.pts - b.pts).find((t) => t.pts > top + 4);
        if (next) {
          add('把最高奖推到「' + next.label + ' 档」（' + next.pts + ' 分，例如 ' + (next.examples.math || next.desc) + '），这一维 +{g}',
            secureSim('comp', profile, scores, (p) => {
              p.comps = list.concat([{ name: next.label + ' 档示例', subject: 'math', tierId: next.id }]);
            }));
        }
        add('再加一个不同学科的 B+ 档奖项，这一维 +{g}', secureSim('comp', profile, scores, (p) => {
          p.comps = list.concat([{ name: '省级科创', subject: 'research', tierId: 'bplus' }]);
        }));
      }
      if (d.top >= 94) add('竞赛已经到天花板，别再为第 5 个奖熬夜了。', 0);
    }

    if (key === 'act') {
      const list = profile.acts || [];
      if (!list.length) {
        add('先填一个校级核心活动（C 档，30 分）打底，这一维 +{g}', secureSim('act', profile, scores, (p) => {
          p.acts = [{ name: '自定义活动', type: 'leadership', tierId: 'ae' }];
        }));
      } else {
        const top = d.top || 0;
        const next = D.ACT_TIERS.slice().sort((a, b) => a.pts - b.pts).find((t) => t.pts > top + 3);
        if (next) {
          add('把最强的一项活动推到「' + next.label + ' 档」（' + next.pts + ' 分：' + next.example + '），这一维 +{g}',
            secureSim('act', profile, scores, (p) => {
              p.acts = list.concat([{ name: '自定义活动', type: 'leadership', tierId: next.id }]);
            }));
        }
        add('再加一项 C+ 档活动（38 分：社团创始人 / 社长 / 校队队长），这一维 +{g}', secureSim('act', profile, scores, (p) => {
          p.acts = list.concat([{ name: '自定义活动', type: 'leadership', tierId: 'ad' }]);
        }));
      }
    }

    if (key === 'essay') {
      const e = profile.essay || {};
      const checks = e.checks || {};
      const hasEssay = d.essayFilled;
      const hasRec = d.rec && d.rec.filled;
      const hasItv = d.interview && d.interview.filled;

      if (!hasRec) {
        add('先把两位老师的推荐信约起来（学术 + 班主任），这一维 +{g}', secureSim('essay', profile, scores, (p) => {
          p.essay.rec.academic = Math.max(7, +p.essay.rec.academic || 0);
          p.essay.rec.counselor = Math.max(6, +p.essay.rec.counselor || 0);
        }));
      } else {
        add('给推荐信补一个具体故事，找老师深聊一次，这一维 +{g}', secureSim('essay', profile, scores, (p) => {
          p.essay.rec.detail = Math.min(10, (+p.essay.rec.detail || 0) + 3);
        }));
      }

      if (!hasEssay) {
        add('主文书还没开始：先写出一稿，这一维最多 +{g}', secureSim('essay', profile, scores, (p) => {
          p.essay.checks = { unique: 7, detail: 6, reflect: 6, fit: 6, voice: 6, revise: 5 };
        }));
      } else {
        add('把自评里最低的两项各 +2 分，这一维 +{g}', secureSim('essay', profile, scores, (p) => {
          const arr = D.ESSAY_CHECKS.map((c) => ({ c, v: +checks[c.key] || 0 })).sort((a, b) => a.v - b.v);
          arr.slice(0, 2).forEach((x) => { p.essay.checks[x.c.key] = Math.min(10, x.v + 2); });
        }));
      }

      if (!hasItv) {
        add('做一次第三方面试或补充材料，这一维 +{g}', secureSim('essay', profile, scores, (p) => {
          p.essay.interview.prep = Math.max(6, +p.essay.interview.prep || 0);
          p.essay.interview.story = Math.max(5, +p.essay.interview.story || 0);
          p.essay.interview.thirdParty = true;
        }));
      }
      if (!e.text || !e.text.trim()) {
        add('把文书草稿粘进「文书体检」，看看具体细节够不够。', 0);
      }
    }

    out.sort((a, b) => b.gain - a.gain);
    if (!out.length) return { text: '这一维已经接近满格，保持就好。', gain: 0 };
    const best = out[0];
    return { text: best.text.replace('{g}', best.gain > 0 ? best.gain : ''), gain: best.gain };
  }

  /* ---------------- 文书体检 ---------------- */
  const CLICHES = {
    zh: ['从小', '一直以来', '我深知', '我意识到', '意义重大', '不仅', '全面发展', '德智体美劳',
      '改变世界', '为社会做贡献', '梦想', '热爱', '坚持不懈', '人生的转折点', '让我明白',
      '丰富多彩', '锻炼了我的能力', '综合素质', '独一无二', '不可或缺', '与众不同'],
    en: ['since i was a child', 'ever since', 'passion for', 'dream of', 'changed my life',
      'make a difference', 'hard work pays off', 'outside my comfort zone', 'broaden my horizons',
      'delve into', 'tapestry', 'testament', 'in conclusion', 'not only', 'moreover', 'furthermore']
  };
  const STOP = ('the and that with this from have has had was were are you your for not but his her she him they them their its our we us i me my myself a an of to in on at by as is be been being it can could would should will just very really about into over after before more most some such than then there here what which who whom when where why how all any both each few other own same so only too also do does did doing if or because while during through above below up down out off again further once'.split(' '));

  function normalizeText(t) {
    return t.toLowerCase().replace(/[“”"'’]/g, '').replace(/\s+/g, ' ');
  }

  function analyzeEssay(text) {
    const raw = String(text || '').trim();
    const cjkChars = (raw.match(/[\u4e00-\u9fa5]/g) || []).length;
    const latinWords = (raw.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
    const isCJK = cjkChars > latinWords * 0.8;
    const words = isCJK ? cjkChars : latinWords;
    const chars = raw.length;

    const sentences = raw.split(/[.!?。！？\n]+/).map((s) => s.trim()).filter((s) => s.length > 1);
    const avgLen = sentences.length ? Math.round(words / sentences.length) : words;

    const low = normalizeText(raw);
    const cliches = [];
    CLICHES.zh.forEach((w) => { if (raw.indexOf(w) >= 0) cliches.push(w); });
    CLICHES.en.forEach((w) => { if (low.indexOf(w) >= 0) cliches.push(w); });

    const numbers = (raw.match(/\d+(?:[.,]\d+)?/g) || []).length;
    const proper = (raw.match(/(?:^|[^A-Za-z])[A-Z][a-z]{2,}/g) || []).length;
    const quotes = (raw.match(/[“”"]/g) || []).length / 2;
    const concrete = numbers + Math.min(proper, 8) + Math.min(quotes, 3);

    const firstPerson = isCJK
      ? (raw.match(/我/g) || []).length
      : (low.match(/\bi\b|\bmy\b|\bme\b/g) || []).length;
    const firstRatio = words ? firstPerson / words : 0;
    const reflectWords = ['意识到', '发现', '学到', '改变', '后来', '原来', '明白', '反思',
      'realize', 'realise', 'learned', 'learnt', 'understand', 'changed', 'noticed', 'began', 'started to'];
    const reflectHits = reflectWords.filter((w) => low.indexOf(w.toLowerCase()) >= 0).length;

    const freq = {};
    if (!isCJK) {
      (low.match(/[a-z][a-z'’-]+/g) || []).forEach((w) => {
        if (w.length < 4 || STOP.indexOf(w) >= 0) return;
        freq[w] = (freq[w] || 0) + 1;
      });
    }
    const repeated = Object.keys(freq).filter((w) => freq[w] >= 3)
      .sort((a, b) => freq[b] - freq[a]).slice(0, 5).map((w) => ({ w, n: freq[w] }));

    let score = 56;
    score += Math.min(12, concrete * 1.4);
    score += Math.min(8, reflectHits * 2);
    if (words >= 250 && words <= 700) score += 6;
    if (words < 120) score -= 14; else if (words < 220) score -= 6;
    if (words > 900) score -= 5;
    if (avgLen > 46) score -= 7; else if (avgLen >= 14 && avgLen <= 32) score += 5;
    if (firstRatio > 0.16) score -= 5;
    score -= Math.min(24, cliches.length * 3.2);
    score -= Math.min(8, repeated.length * 1.6);

    return {
      score: clamp(Math.round(score), 18, 98),
      words, chars, sentences: sentences.length, avgLen, isCJK,
      cliches, numbers, proper, concrete, firstPerson, firstRatio: round(firstRatio, 3),
      reflectHits, repeated
    };
  }

  /* ---------------- 文书骨架 ---------------- */
  const TYPE_NAME = {};
  D.ACT_TYPES.forEach((t) => { TYPE_NAME[t.id] = t.name; });

  function topMaterial(profile) {
    const acts = (profile.acts || []).map((a) => ({
      kind: 'act', name: actName(a),
      points: actPoints(a), meta: (actTier(a) || {}).label ? (actTier(a).label + ' 档') : '自定义'
    })).sort((a, b) => b.points - a.points);
    const comps = (profile.comps || []).map((c) => ({
      kind: 'comp', name: compName(c, profile.customRubric),
      points: compPoints(c, profile.customRubric),
      meta: (compTier(c) || {}).label ? (compTier(c).label + ' 档') : '自定义'
    })).sort((a, b) => b.points - a.points);
    const aps = (profile.aps || []).slice().sort((a, b) => (+b.score) - (+a.score));
    return { acts, comps, aps, act: acts[0], act2: acts[1], comp: comps[0], ap: aps[0] };
  }

  function buildOutlines(profile) {
    const m = topMaterial(profile);
    const actName = m.act ? m.act.name : '你最投入的那件事';
    const act2Name = m.act2 ? m.act2.name : '第二个社团或项目';
    const compName_ = m.comp ? m.comp.name : '一次竞赛或研究';
    const apName = m.ap ? m.ap.subject : '一门你喜欢的 AP';

    return [
      {
        tag: '角度 A · 学术好奇心',
        title: '从「' + compName_ + '」开始的一次较真',
        line: '主线：一个具体的问题怎么缠上你，你为它做了什么，最后发现自己还差什么。',
        steps: [
          { k: '钩子', t: '直接进入一个现场：考场、实验室、凌晨的屏幕。', w: '80 词' },
          { k: '问题', t: '你当时想不通的那一步，用一句外行也懂的话说清。', w: '120 词' },
          { k: '行动', t: '你试过的两种方法，以及哪一种失败了、为什么。', w: '150 词' },
          { k: '转折', t: '你向谁求助 / 读了什么 / 哪一刻突然通了。', w: '120 词' },
          { k: '落点', t: '这个兴趣现在变成了什么问题，你想在大学怎么接着做。', w: '80 词' }
        ],
        words: '建议 500–650 词 · 适合 MIT / Caltech / CMU / UC'
      },
      {
        tag: '角度 B · 领导力与影响力',
        title: '「' + actName + '」里最难搞定的那个人',
        line: '主线：你不是天生的领袖，你是被一个具体的人、一次冲突逼出来的组织者。',
        steps: [
          { k: '场景', t: '一个具体的分歧现场：谁不同意你、为什么。', w: '100 词' },
          { k: '难点', t: '你原以为领导就是分配任务，现实给了你一巴掌。', w: '120 词' },
          { k: '动作', t: '你做的那件很小但很关键的事（一对一、改规则、让权）。', w: '150 词' },
          { k: '结果', t: '一个可验证的数字或变化，别用“大家都说好”。', w: '100 词' },
          { k: '反思', t: '你对“影响力”的理解发生了什么变化。', w: '80 词' }
        ],
        words: '建议 500–650 词 · 适合 Harvard / Penn / Duke / 文理学院'
      },
      {
        tag: '角度 C · 身份与连接',
        title: '把「' + act2Name + '」和「' + apName + '」焊在一起的那个我',
        line: '主线：两个看起来不相关的部分，如何在你身上长成同一件事。',
        steps: [
          { k: '物件', t: '从一个具体物件 / 地点 / 习惯开场，不要从“我出生在”。', w: '90 词' },
          { k: '分裂', t: '你身上的两个身份 / 两种兴趣，曾经怎么互相打架。', w: '140 词' },
          { k: '焊接', t: '哪件事让你发现它们其实是一回事。', w: '140 词' },
          { k: '证据', t: '你因此做的项目 / 写的文章 / 建的小组织。', w: '110 词' },
          { k: '未来', t: '你希望在大学继续把哪两样东西接起来。', w: '80 词' }
        ],
        words: '建议 550–650 词 · 适合 UChicago / Brown / Yale / NYU'
      }
    ];
  }

  /* ---------------- 序列化 ---------------- */
  function sanitize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const st = base;
    if (typeof raw.sample === 'string') st.sample = raw.sample;
    if (raw.profile) {
      const p = raw.profile;
      if (p.gpa) Object.assign(st.profile.gpa, p.gpa);
      if (p.test) Object.assign(st.profile.test, p.test);
      if (Array.isArray(p.aps)) st.profile.aps = p.aps.filter((a) => a && a.subject);
      if (Array.isArray(p.comps)) st.profile.comps = p.comps.filter((a) => a && (a.tierId || a.customId || a.customPts)).map((a) => ({
        name: a.name || '', subject: a.subject || 'other', tierId: a.tierId || null,
        customId: a.customId || null,
        customPts: isNum(a.customPts) ? clamp(+a.customPts, 0, 100) : null
      }));
      if (Array.isArray(p.acts)) st.profile.acts = p.acts.filter((a) => a);
      if (p.essay) {
        if (p.essay.checks) Object.assign(st.profile.essay.checks, p.essay.checks);
        if (p.essay.rec) Object.assign(st.profile.essay.rec, p.essay.rec);
        if (p.essay.interview) Object.assign(st.profile.essay.interview, p.essay.interview);
        if (typeof p.essay.text === 'string') st.profile.essay.text = p.essay.text;
      }
    }
    if (raw.manual) DIMS.forEach((d) => { if (isNum(raw.manual[d.key])) st.manual[d.key] = clamp(+raw.manual[d.key], 0, 100); });
    if (raw.skip) DIMS.forEach((d) => { st.skip[d.key] = !!raw.skip[d.key]; });
    if (raw.bg) Object.keys(st.bg).forEach((k) => { st.bg[k] = !!raw.bg[k]; });
    if (raw.estimates) {
      DIMS.forEach((d) => {
        const e = raw.estimates[d.key];
        if (e && isNum(e.low) && isNum(e.high)) {
          st.estimates[d.key] = {
            low: clamp(Math.min(+e.low, +e.high), 0, 100),
            high: clamp(Math.max(+e.low, +e.high), 0, 100)
          };
        }
      });
    }
    if (Array.isArray(raw.cohorts) && raw.cohorts.length) {
      st.cohorts = raw.cohorts.map((c) => ({
        year: +c.year || 0, count: +c.count || 0, demo: !!c.demo,
        dims: (c.dims || []).map((v) => clamp(+v || 0, 0, 100)),
        destinations: Array.isArray(c.destinations) ? c.destinations.filter((x) => x && x.id) : [],
        note: c.note || ''
      })).filter((c) => c.year);
    }
    if (Array.isArray(raw.customRubric)) st.customRubric = raw.customRubric.filter((x) => x && x.name);
    if (Array.isArray(raw.snapshots)) {
      st.snapshots = raw.snapshots.filter((s) => s && s.ts && s.scores).slice(-20).map((s) => ({
        id: s.id || 's' + s.ts,
        ts: +s.ts,
        label: s.label || '',
        scores: s.scores,
        ranges: s.ranges || null,
        power: +s.power || 0,
        persona: s.persona || ''
      }));
    }
    if (Array.isArray(raw.tasks)) {
      st.tasks = raw.tasks.filter((t) => t && t.id && t.text).slice(0, 20).map((t) => ({
        id: String(t.id), dim: t.dim || '', text: String(t.text),
        gain: +t.gain || 0, effort: t.effort || '', done: !!t.done
      }));
    }
    if (Array.isArray(raw.cases)) {
      st.cases = raw.cases.filter((c) => c && c.schoolId && c.scores).slice(0, 30).map((c) => ({
        id: String(c.id || 'c' + Date.now()),
        schoolId: String(c.schoolId),
        alias: c.alias || '匿名案例',
        year: c.year || '',
        source: c.source || '',
        scores: c.scores,
        createdAt: +c.createdAt || Date.now()
      }));
    }
    if (raw.ui) {
      st.ui.typeFilter = raw.ui.typeFilter || 'all';
      st.ui.search = raw.ui.search || '';
      if (Array.isArray(raw.ui.overlaySchools)) {
        st.ui.overlaySchools = raw.ui.overlaySchools.filter((id) => D.SCHOOLS.some((s) => s.id === id)).slice(0, 4);
      } else if (raw.ui.overlaySchool) {
        st.ui.overlaySchools = [raw.ui.overlaySchool];
      }
      st.ui.overlayYear = raw.ui.overlayYear || null;
      st.ui.activeCohort = raw.ui.activeCohort || st.cohorts[0].year;
      st.ui.compSubject = raw.ui.compSubject || 'math';
    }
    return st;
  }

  function loadSample(key) {
    const s = defaultState();
    const sample = D.SAMPLES[key];
    if (!sample) return s;
    const p = clone(sample.profile);
    s.profile = {
      gpa: Object.assign(s.profile.gpa, p.gpa),
      test: Object.assign(s.profile.test, p.test),
      aps: p.aps || [],
      comps: p.comps || [],
      acts: p.acts || [],
      essay: {
        checks: Object.assign(emptyChecks(D.ESSAY_CHECKS, 0), (p.essay || {}).checks || {}),
        rec: Object.assign(emptyChecks(D.REC_CHECKS, 0), (p.essay || {}).rec || {}),
        interview: Object.assign(emptyChecks(D.INTERVIEW_CHECKS, 0), { thirdParty: false }, (p.essay || {}).interview || {}),
        text: (p.essay || {}).text || ''
      }
    };
    s.ui.overlayYear = s.cohorts[0].year;
    s.ui.activeCohort = s.cohorts[0].year;
    s.ui.overlaySchools = ['nyu'];
    s.sample = key;
    return s;
  }

  /* ---------------- 去向推测 / 案例相似度 ---------------- */
  function destStats(sample) {
    const us = sample.us || {};
    const p10 = us.top10 ? us.top10.share : 0;
    const p30 = us.top30 ? us.top30.share : 0;
    const p50 = us.top50 ? us.top50.share : 0;
    const below = Math.max(0, 1 - p50);
    const index = p10 * 100 + Math.max(0, p30 - p10) * 85 + Math.max(0, p50 - p30) * 70 + below * 55;
    const margin = 4.5;
    return {
      index: round(index, 1),
      low: round(Math.max(0, index - margin), 1),
      high: round(Math.min(100, index + margin), 1),
      usRows: [
        { key: 'top10', label: '藤校 & Top10', share: p10, offers: us.top10 && us.top10.offers, students: us.top10 && us.top10.students },
        { key: 'top30', label: 'Top30', share: p30, offers: us.top30 && us.top30.offers },
        { key: 'top50', label: 'Top50', share: p50, offers: us.top50 && us.top50.offers }
      ],
      uk: sample.uk || null,
      hk: sample.hk || null
    };
  }

  function similarityOf(userScores, caseScores) {
    let sum = 0, w = 0;
    const diffs = [];
    DIMS.forEach((d) => {
      const a = userScores[d.key];
      const b = caseScores[d.key];
      if (a == null || b == null) return;
      const wd = D.GLOBAL_WEIGHTS[d.key];
      sum += Math.abs(a - b) * wd;
      w += wd;
      diffs.push({ key: d.key, name: d.name, diff: round(Math.abs(a - b), 1), mine: a, theirs: b });
    });
    diffs.sort((a, b) => b.diff - a.diff);
    return {
      sim: w ? round(Math.max(0, 100 - sum / w), 1) : 0,
      diffs,
      farthest: diffs[0] || null,
      closest: diffs.length ? diffs[diffs.length - 1] : null
    };
  }

  const API = {
    clamp, round, mean, sum, clone, isNum, interp, byId, shortName, keywordsFor, factsFor,
    defaultState, blankProfile, blankEssay, blankBg, emptyEstimates, sanitize, loadSample,
    gpaScore, testScore, apScore, essayScore, recScore, interviewScore, materialScore,
    compTier, compSubject, compExample, compPoints, compName, compScore,
    actTier, actName, actPoints, actScore,
    computeScores, powerOf, powerRange, ratingOf, personaOf, ROLE_NAMES,
    backgroundFor,
    destStats, similarityOf,
    matchSchool, matchAll, shortlist, estimateProbability, tierOf, TIER_LABEL,
    cohortPower, cohortStats, cohortById,
    adviceFor, analyzeEssay, buildOutlines, topMaterial,
    emptyChecks
  };

  root.ADMIT_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
