/* Node 冒烟测试：不依赖浏览器 */
'use strict';
require('../js/data.js');
const C = require('../js/core.js');
const D = globalThis.ADMIT_DATA;

let fails = 0;
function ok(cond, msg) {
  if (!cond) { fails++; console.log('  ✗ ' + msg); }
  else console.log('  ✓ ' + msg);
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.51 : tol); }

console.log('\n== 示例档案打分 ==');
const keys = ['t30', 'ivy', 'stem', 'humanities', 'average'];
const sampleScores = {};
keys.forEach((k) => {
  const st = C.loadSample(k);
  const r = C.computeScores(st.profile, st.manual);
  sampleScores[k] = r.scores;
  const power = C.powerOf(r.scores);
  const p = C.personaOf(r.scores);
  const row = D.DIMS.map((d) => d.name + ' ' + Math.round(r.scores[d.key])).join(' | ');
  console.log('\n[' + D.SAMPLES[k].label + '] power=' + power + ' (' + C.ratingOf(power) + ') ' + p.name);
  console.log('  ' + row);
  ok(D.DIMS.every((d) => r.scores[d.key] >= 0 && r.scores[d.key] <= 100), k + ' 所有维度在 0–100');
  ok(power > 0 && power <= 100, k + ' 综合战力合理');
});

console.log('\n== 匹配结果 ==');
const st = C.loadSample('ivy');
const r0 = C.computeScores(st.profile, st.manual);
const results = C.matchAll(r0.scores);
console.log('  共 ' + results.length + ' 所学校');
results.slice(0, 8).forEach((x) => {
  console.log('  ' + x.tier.padEnd(6) + ' ' + x.school.name.padEnd(12) + ' fit=' + x.fit + ' p=' + Math.round(x.p * 100) + '%');
});
ok(results.length === D.SCHOOLS.length, '返回全部学校');
ok(results.every((x) => x.fit >= 0 && x.fit <= 100), '匹配度在 0–100');
ok(results.every((x) => x.p > 0 && x.p <= 1), '概率在 0–1');
ok(['safe', 'match', 'reach', 'dream'].indexOf(results[0].tier) >= 0, '档位合法');

const mit = results.find((x) => x.school.id === 'mit');
const asu = results.find((x) => x.school.id === 'asu');
ok(asu.fit > mit.fit, '保底校匹配度高于 MIT');
ok(asu.p > mit.p, 'ASU 概率高于 MIT');
const ucb = results.find((x) => x.school.id === 'berkeley');
ok(ucb.blind === true, 'UC 系标记为 Test-Blind');
ok(ucb.gaps.find((g) => g.key === 'test').ignored === true, 'Test-Blind 忽略标化一维');

console.log('\n== 单调性 ==');
const base = C.loadSample('average');
function withSat(v) { const p = C.clone(base.profile); p.test.sat = v; return C.computeScores(p, {}).scores.test; }
ok(withSat(1600) > withSat(1500) && withSat(1500) > withSat(1400), 'SAT 越高标化分越高');
const g1 = C.clone(base.profile); g1.gpa.value = 3.0;
const g2 = C.clone(base.profile); g2.gpa.value = 4.0;
ok(C.computeScores(g2, {}).scores.gpa > C.computeScores(g1, {}).scores.gpa, 'GPA 越高分越高');
const a1 = { subject: 'Calculus BC', score: 3 };
const a2 = { subject: 'Calculus BC', score: 5 };
const pa1 = C.clone(base.profile); pa1.aps = [a1];
const pa2 = C.clone(base.profile); pa2.aps = [a2];
ok(C.computeScores(pa2, {}).scores.ap > C.computeScores(pa1, {}).scores.ap, 'AP 5 分高于 3 分');

console.log('\n== 评分表 ==');
ok(C.compPoints({ subject: 'math', tierId: 'splus' }) === 100, 'S+ 档 = 100');
ok(C.compPoints({ subject: 'math', tierId: 's' }) === 94, 'S 档 = 94');
ok(C.compPoints({ subject: 'research', tierId: 'c' }) === 46, 'C 档 = 46');
ok(C.compPoints({ subject: 'math', tierId: 'a', customPts: 83 }) === 83, '手改分值生效');
const actStrong = C.actPoints({ type: 'leadership', tierId: 'as' });
ok(actStrong === 70, 'S 档活动 = 70');
const actWeak = C.actPoints({ tierId: 'ah' });
ok(actWeak === 8, 'E 档活动 = 8');
ok(C.actPoints({ tierId: 'ad', customPts: 41 }) === 41, '活动分值可手改');

console.log('\n== 材料：没文书也能算 ==');
const noEssay = C.blankProfile();
noEssay.gpa.value = 3.8;
ok(C.computeScores(noEssay, {}).scores.essay === 0, '什么都没填时材料为 0');
noEssay.essay.rec = { academic: 8, counselor: 7, extra: 5, detail: 6 };
const recOnly = C.computeScores(noEssay, {});
console.log('  只有推荐信：材料 = ' + recOnly.scores.essay + '（推荐信分 ' + Math.round(recOnly.detail.essay.rec.score) + '）');
ok(recOnly.scores.essay > 45 && recOnly.scores.essay <= 88, '只有推荐信也能得到一个中等偏上的材料分');
noEssay.essay.checks = { unique: 8, detail: 7, reflect: 8, fit: 7, voice: 8, revise: 6 };
const withEssay = C.computeScores(noEssay, {});
console.log('  加上文书：材料 = ' + withEssay.scores.essay);
ok(withEssay.scores.essay > recOnly.scores.essay, '补上文书后材料分上升');
ok(withEssay.detail.essay.parts.length === 2, '材料由推荐信 + 文书两部分组成');

console.log('\n== 没有这项 / 预估区间 ==');
const skipTest = C.computeScores(base.profile, {}, { skip: { comp: true } });
ok(skipTest.scores.comp === null, '勾选没有竞赛后该维为空');
ok(skipTest.skipped.comp === true, 'skipped 标记正确');
ok(C.powerOf(skipTest.scores) > 0, '排除一维后综合战力仍可计算');
const skippedMatch = C.matchSchool(skipTest.scores, D.SCHOOLS.find((s) => s.id === 'mit'), { ranges: skipTest.ranges });
ok(skippedMatch.fit > 0 && skippedMatch.fit <= 100, '缺一维也能算匹配度');

const est = C.computeScores(base.profile, {}, { estimates: { gpa: { low: 60, high: 80 } } });
ok(est.ranges.gpa.low === 60 && est.ranges.gpa.high === 80, 'GPA 区间记录正确');
const pr = C.powerRange(est.scores, est.ranges);
const mid = C.powerOf(est.scores);
console.log('  综合战力区间 ' + pr.low + '–' + pr.high + '（中点 ' + mid + '）');
ok(pr.low <= mid && pr.high >= mid, '综合战力区间包住中点');
const ranged = C.matchSchool(est.scores, D.SCHOOLS.find((s) => s.id === 'nyu'), { ranges: est.ranges });
ok(ranged.fitLow <= ranged.fit && ranged.fit <= ranged.fitHigh, '匹配度区间方向正确');
ok(ranged.pLow <= ranged.pHigh, '概率区间方向正确');

console.log('\n== 背景加成 ==');
const uiuc = D.SCHOOLS.find((s) => s.id === 'uiuc');
const nyuS = D.SCHOOLS.find((s) => s.id === 'nyu');
const mitS = D.SCHOOLS.find((s) => s.id === 'mit');
ok(C.backgroundFor(uiuc, {}).total === 6, 'UIUC 国际生友好度 +6');
ok(C.backgroundFor(uiuc, { domestic: true }).total === 6, '绿卡在公立校 +6');
const bAidNyu = C.backgroundFor(nyuS, { aidNeed: true });
ok(bAidNyu.total === 1, 'NYU 国际生 +5、助学金 -4');
ok(C.backgroundFor(mitS, { aidNeed: true }).parts.every((p) => p.key !== 'aidNeed'), 'MIT need-blind 不扣助学金分');
const baseScores = C.loadSample('t30');
const bs = C.computeScores(baseScores.profile, {}).scores;
const pNo = C.matchSchool(bs, nyuS, {});
const pDom = C.matchSchool(bs, nyuS, { bg: { domestic: true } });
console.log('  NYU 概率：国际生 ' + Math.round(pNo.p * 100) + '% → 绿卡 ' + Math.round(pDom.p * 100) + '%');
ok(pDom.p > pNo.p, '绿卡提升 NYU 录取概率');
const pAid = C.matchSchool(bs, nyuS, { bg: { aidNeed: true } });
ok(pAid.p < pNo.p, '需要助学金降低 NYU 概率');

console.log('\n== 学校关键词 ==');
ok(C.keywordsFor(D.SCHOOLS.find((s) => s.id === 'mit')).indexOf('工程') >= 0, 'MIT 关键词包含工程');
const noKw = D.SCHOOLS.filter((s) => C.keywordsFor(s).length < 4);
ok(noKw.length === 0, '每所学校至少 4 个关键词' + (noKw.length ? '（缺：' + noKw.map((s) => s.id).join(',') + '）' : ''));

console.log('\n== 手动锁定 ==');
const manual = C.computeScores(base.profile, { gpa: 100 });
ok(manual.scores.gpa === 100 && manual.locked.gpa === true, '手动锁定生效');

console.log('\n== 毕业生 ==');
const cohort = st.cohorts[0];
const cs = C.cohortStats(cohort, r0.scores);
console.log('  ' + cohort.year + ' 届平均 ' + cs.avg + ' · 我 ' + cs.power + ' · 差 ' + cs.delta + ' · 前 ' + cs.percentile + '%');
ok(cs.avg > 0 && cs.percentile >= 1 && cs.percentile <= 99, '届内百分位合理');
ok(C.cohortPower(cohort) === cs.avg, '平均战力一致');

console.log('\n== 文书体检 ==');
const bad = '从小我就对商业世界充满热爱。我的梦想是成为一名改变世界的企业家。在成长的过程中，我参加了许多丰富多彩的活动，锻炼了我的综合能力，也让我明白了团队合作的重要性。我相信只要坚持不懈地努力，就一定能实现自己的梦想。这段经历意义重大，是我人生的转折点。';
const good = '凌晨两点，实验室的离心机第三次报警。我把手伸进冰盒，指尖碰到那支编号 B-07 的管子——上个月我把它插错了位置，整组数据作废。那天我没有回宿舍，坐在走廊地上把 42 页实验记录重抄了一遍。第二天我改了流程：每支管子贴两个标签，一个写编号，一个写我给它起的名字。三周后，B-07 终于长出了我想要的那圈菌落。我盯着它看了很久，第一次意识到，所谓科研，可能就是把“我以为”一遍遍改成“我确认”。';
const ab = C.analyzeEssay(bad);
const ag = C.analyzeEssay(good);
console.log('  反面教材 ' + ab.score + ' 分 · 套话 ' + ab.cliches.length + ' · 细节 ' + ab.concrete);
console.log('  正面样例 ' + ag.score + ' 分 · 套话 ' + ag.cliches.length + ' · 细节 ' + ag.concrete);
ok(ab.cliches.length >= 3, '识别出套话');
ok(ag.score > ab.score, '具体文本得分更高');
ok(ab.score >= 18 && ab.score <= 98, '分数在范围内');

console.log('\n== 文书骨架 ==');
const outlines = C.buildOutlines(st.profile);
ok(outlines.length === 3, '生成三条故事线');
ok(outlines.every((o) => o.steps.length === 5), '每条五个段落');
console.log('  ' + outlines.map((o) => o.title).join('\n  '));

console.log('\n== 提分建议 ==');
D.DIMS.forEach((d) => {
  const adv = C.adviceFor(d.key, st.profile, r0.scores);
  console.log('  ' + d.name.padEnd(4) + ' +' + adv.gain + ' · ' + adv.text);
});
ok(D.DIMS.every((d) => C.adviceFor(d.key, st.profile, r0.scores).text.length > 0), '每个维度都有建议');

console.log('\n== 序列化 ==');
st.snapshots = [{ id: 's1', ts: 1700000000000, label: '2026/11/24', scores: r0.scores, power: 82.4, persona: '均衡型选手' }];
st.tasks = [{ id: 't1', dim: 'test', text: 'SAT 提到 1550', gain: 6, effort: '6–10 周', done: false }];
const round = C.sanitize(JSON.parse(JSON.stringify(st)));
ok(round.profile.aps.length === st.profile.aps.length, '存档往返不丢数据');
ok(round.cohorts.length === st.cohorts.length, '毕业生数据保留');
ok(round.snapshots.length === 1 && round.snapshots[0].power === 82.4, '快照保留');
ok(round.tasks.length === 1 && round.tasks[0].text.indexOf('SAT') >= 0, '下一步清单保留');

console.log('\n' + (fails ? 'FAILED: ' + fails : 'ALL PASS') + '\n');
process.exit(fails ? 1 : 0);
