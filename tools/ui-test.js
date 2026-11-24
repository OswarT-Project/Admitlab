/* 通过 CDP 跑一遍真实交互，检查事件绑定是否工作 */
'use strict';

const PORT = +(process.argv[2] || 9333);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let list = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      list = await res.json();
      if (list && list.length) break;
    } catch (err) { /* 还没起来 */ }
    await sleep(300);
  }
  if (!list) throw new Error('无法连接 DevTools');
  const page = list.find((t) => t.type === 'page' && /admitlab/.test(t.url));
  if (!page) throw new Error('找不到页面: ' + list.map((t) => t.url).join(', '));

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.text + ' ' +
        (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || ''));
    }
  });
  const send = (method, params) => new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const expr = `(async () => {
    const out = [];
    const ok = (n, c, d) => out.push({ n, ok: !!c, d: d == null ? '' : String(d) });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    for (let i = 0; i < 40 && $$('.school-card').length === 0; i++) await sleep(100);

    ok('学校卡片渲染', $$('.school-card').length > 20, $$('.school-card').length);
    ok('文书六滑块', $$('[data-sliders="essay"] input[type=range]').length === 6, $$('[data-sliders="essay"] input[type=range]').length);
    ok('推荐信四滑块', $$('[data-sliders="rec"] input[type=range]').length === 4, $$('[data-sliders="rec"] input[type=range]').length);
    ok('面试两滑块', $$('[data-sliders="interview"] input[type=range]').length === 2, $$('[data-sliders="interview"] input[type=range]').length);
    ok('毕业生年份已隐藏', $$('.year-chip').length === 0, $$('.year-chip').length);
    ok('竞赛档位表渲染', $$('#compRubricTable tbody tr').length === 9, $$('#compRubricTable tbody tr').length);
    ok('活动档位表渲染', $$('#actRubricTable tbody tr').length === 9, $$('#actRubricTable tbody tr').length);
    ok('每维都有「没有这项」', $$('[data-skip]').length === 6, $$('[data-skip]').length);
    ok('每维都有预估开关', $$('[data-est]').length === 6, $$('[data-est]').length);
    ok('雷达图有六个顶点', $$('#radar polygon').length >= 6, $$('#radar polygon').length);

    const before = $$('[data-rows="aps"] .row-item').length;
    $('[data-add="aps"]').click();
    await sleep(80);
    ok('添加 AP 行', $$('[data-rows="aps"] .row-item').length === before + 1, before + ' → ' + $$('[data-rows="aps"] .row-item').length);
    $$('[data-rows="aps"] .del')[before].click();
    await sleep(80);
    ok('删除 AP 行', $$('[data-rows="aps"] .row-item').length === before);

    const beforeComps = $$('[data-rows="comps"] .row-item').length;
    $('[data-add="comps"]').click();
    await sleep(100);
    ok('添加竞赛行', $$('[data-rows="comps"] .row-item').length === beforeComps + 1, beforeComps + ' → ' + $$('[data-rows="comps"] .row-item').length);
    const compTier = $$('[data-rows="comps"] select[data-field="tierId"]').pop();
    compTier.value = 'splus';
    compTier.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);
    const lastPts = $$('[data-rows="comps"] input[data-field="points"]').pop();
    ok('切换竞赛档位', lastPts.value === '100', lastPts.value);
    const compHints = $$('[data-rows="comps"] .comp-hint');
    ok('档位示例提示', compHints[compHints.length - 1].textContent.indexOf('IMO') >= 0, compHints[compHints.length - 1].textContent);
    $$('[data-rows="comps"] .del')[beforeComps].click();
    await sleep(100);
    ok('删除竞赛行', $$('[data-rows="comps"] .row-item').length === beforeComps);

    const beforeActs = $$('[data-rows="acts"] .row-item').length;
    $('[data-add="acts"]').click();
    await sleep(100);
    ok('添加活动行', $$('[data-rows="acts"] .row-item').length === beforeActs + 1, beforeActs + ' → ' + $$('[data-rows="acts"] .row-item').length);
    const actTier = $$('[data-rows="acts"] select[data-field="tierId"]').pop();
    actTier.value = 'as';
    actTier.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);
    const actPts = $$('[data-rows="acts"] input[data-field="points"]').pop();
    ok('活动切档位', actPts.value === '70', actPts.value);
    const actHints = $$('[data-rows="acts"] .comp-hint');
    ok('活动示例提示', actHints[actHints.length - 1].textContent.indexOf('国际') >= 0, actHints[actHints.length - 1].textContent);
    $$('[data-rows="acts"] .del')[beforeActs].click();
    await sleep(100);
    ok('删除活动行', $$('[data-rows="acts"] .row-item').length === beforeActs);

    const skip = $('[data-skip="comp"]');
    skip.checked = true;
    skip.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);
    ok('勾选没有竞赛', $('[data-badge="comp"] b').textContent === '—', $('[data-badge="comp"] b').textContent);
    ok('卡片进入跳过状态', $('#card-comp').classList.contains('is-skipped'));
    ok('雷达跳过竞赛轴', $('#radar').textContent.indexOf('—') >= 0);
    skip.checked = false;
    skip.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);
    ok('取消没有竞赛', $('[data-badge="comp"] b').textContent !== '—', $('[data-badge="comp"] b').textContent);

    const est = $('[data-est="gpa"]');
    est.checked = true;
    est.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);
    const low = $('[data-est-low="gpa"]');
    const high = $('[data-est-high="gpa"]');
    low.value = '60';
    low.dispatchEvent(new Event('input', { bubbles: true }));
    high.value = '90';
    high.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(350);
    ok('预估区间显示在分数徽章', $('[data-badge="gpa"] b').textContent.indexOf('–') >= 0, $('[data-badge="gpa"] b').textContent);
    ok('综合战力变成区间', $('#statPower').textContent.indexOf('–') >= 0, $('#statPower').textContent);
    const fitText = $('.school-card .sc-fit b').textContent;
    ok('学校匹配度支持区间', fitText.length > 0, fitText);

    ok('背景加成六个开关', $$('#bgGrid input[type=checkbox]').length === 6, $$('#bgGrid input[type=checkbox]').length);
    const domBg = $('[data-bg="domestic"]');
    domBg.checked = true;
    domBg.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(350);
    ok('绿卡切换到 domestic 池', $('#bgChip').textContent.indexOf('domestic') >= 0, $('#bgChip').textContent);
    ok('学校卡片显示背景加成', $$('.pill.bg-plus,.pill.bg-minus').length > 0, $$('.pill.bg-plus,.pill.bg-minus').length);

    const sat = $('[data-bind="test.sat"]');    const oldBadge = $('[data-badge="test"] b').textContent;
    sat.value = '1600';
    sat.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(450);
    ok('改 SAT 分数联动', $('[data-badge="test"] b').textContent !== oldBadge, oldBadge + ' → ' + $('[data-badge="test"] b').textContent);
    sat.value = '1540';
    sat.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(350);

    const lock = $('[data-lock="gpa"]');
    lock.checked = true;
    lock.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
    ok('手动锁定生效', $('[data-badge="gpa"]').classList.contains('locked'));
    lock.checked = false;
    lock.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
    ok('解除锁定', !$('[data-badge="gpa"]').classList.contains('locked'));

    const slider = $('[data-sliders="essay"] input[type=range]');
    slider.value = '2';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(350);
    ok('文书滑块联动', $('[data-check-val="essay.unique"]').textContent === '2', $('[data-check-val="essay.unique"]').textContent);

    $('.ws-tabs button[data-ws="check"]').click();
    ok('切换文书体检 Tab', $('.ws-panel[data-panel="check"]').classList.contains('on'));

    const firstCard = $('.school-card');
    firstCard.click();
    await sleep(200);
    ok('学校弹窗打开', !$('#modal').hidden && !!$('#modalTitle'), $('#modalTitle') && $('#modalTitle').textContent);
    ok('弹窗有学校关键词', $$('.kw-chips span').length >= 4, $$('.kw-chips span').length);
    ok('弹窗有官方录取画像', !!$('.m-facts') && $$('.mf-grid b').length === 3, $$('.mf-grid b').length);
    ok('更新日志已渲染', $$('.log-item').length === ADMIT_DATA.CHANGELOG.length, $$('.log-item').length);
    ok('版本号显示', ($('.js-version') || {}).textContent === 'v' + ADMIT_DATA.VERSION, ($('.js-version') || {}).textContent);

    ok('成长记录区域存在', !!$('#growthMain') && !!$('#growthSide'));
    $('#btnSnapshot').click();
    await sleep(250);
    ok('保存快照', $$('.snap-row').length >= 1, $$('.snap-row').length);
    const gen = $('[data-task-gen]');
    if (gen) { gen.click(); await sleep(300); }
    ok('生成下一步', $$('.task').length >= 1, $$('.task').length);
    const taskBox = $('.task input');
    if (taskBox) {
      taskBox.checked = true;
      taskBox.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
    const progress = $('#growthSide .task-progress');
    ok('下一步可勾选', !!progress && progress.textContent.indexOf('/') >= 0, progress && progress.textContent);

    ok('去向推测区域存在', !!$('#destMain') && !!$('#destSide'));
    ok('去向指数区间显示', ($('.dest-index b') || {}).textContent.indexOf('–') >= 0, ($('.dest-index b') || {}).textContent);
    ok('数据来源已渲染', $$('.source-item').length >= 6, $$('.source-item').length);
    $('#btnAddCase').click();
    await sleep(200);
    ok('案例表单打开', !!$('#caseForm'));
    $('#caseForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await sleep(300);
    ok('案例保存并显示', $$('.case-card').length >= 1, $$('.case-card').length);
    ok('案例相似度显示', ($('.case-sim b') || {}).textContent.indexOf('%') >= 0, ($('.case-sim b') || {}).textContent);


    const overlayBtn = $('#mOverlay');
    if (overlayBtn) overlayBtn.click();
    await sleep(250);
    ok('叠加梦校到雷达', +$('#overlaySchoolCount').textContent >= 1 && $('#modal').hidden, $('#overlaySchoolCount').textContent);

    $('#overlaySchoolBtn').click();
    await sleep(150);
    ok('梦校选择器打开', !$('#schoolPicker').hidden);
    const freeBox = $$('#pickerList input[data-pick]:not(:checked):not(:disabled)')[0];
    if (freeBox) {
      freeBox.checked = true;
      freeBox.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(350);
    }
    ok('叠加多所梦校', +$('#overlaySchoolCount').textContent >= 2, $('#overlaySchoolCount').textContent);
    ok('雷达图例有多所梦校', $$('#radarLegend [data-unpick]').length >= 2, $$('#radarLegend [data-unpick]').length);
    ok('出现梦校对比条', $$('.dream-card').length >= 2, $$('.dream-card').length);

    ok('毕业生功能已关闭', $('#sec-cohort').hidden && $('#nav-cohort').hidden && $('#yearControl').hidden);
    ok('首页不再显示届别对比', $('#cohortChip').textContent.trim() === '', $('#cohortChip').textContent);

    const form = $('#customForm');
    form.querySelector('[name=name]').value = 'HIMCM 数学建模';
    form.querySelector('[name=pts]').value = '70';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await sleep(300);
    ok('自定义条目出现', $$('.custom-item').some((x) => x.textContent.indexOf('HIMCM') >= 0));
    ok('自定义进入竞赛下拉', $$('[data-rows="comps"] option').some((o) => o.textContent.indexOf('HIMCM') >= 0));

    const essay = $('#essayDraft');
    essay.value = '凌晨两点，实验室的离心机第三次报警。我伸手进冰盒，指尖碰到那支编号 B-07 的管子。上个月我把它插错了位置，整组数据作废。那天我没有回宿舍，把 42 页记录重抄了一遍。第二天我改了流程：每支管子贴两个标签。三周后，B-07 长出了我想要的那圈菌落。我第一次意识到，科研就是把“我以为”改成“我确认”。';
    $('#btnCheck').click();
    await sleep(500);
    ok('文书体检出结果', !!$('.check-ring'), $('.check-ring') ? $('.check-ring').textContent.trim() : '无');
    ok('体检更新文书分', $('[data-badge="essay"] b').textContent !== '0', $('[data-badge="essay"] b').textContent);

    ok('分享卡函数存在', typeof ADMIT_RADAR.exportCard === 'function');
    return out;
  })()`;

  const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (res.result && res.result.exceptionDetails) {
    console.error('脚本异常:', JSON.stringify(res.result.exceptionDetails, null, 2));
    process.exit(1);
  }
  const out = res.result.result.value;
  let fails = 0;
  out.forEach((t) => {
    if (!t.ok) fails++;
    console.log((t.ok ? '  ✓ ' : '  ✗ ') + t.n + (t.d ? '  [' + t.d + ']' : ''));
  });
  if (exceptions.length) {
    console.log('\n运行时异常:');
    exceptions.forEach((e) => console.log('  ! ' + e));
  }
  console.log('\n' + (fails ? 'UI FAILED: ' + fails : 'UI ALL PASS') + (exceptions.length ? ' (含异常)' : ''));
  ws.close();
  process.exit(fails || exceptions.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
