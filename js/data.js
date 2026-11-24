/* ==========================================================================
   AdmitLab · 数据层
   面向：AP 体系 · 中国申请者 · 美本
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------- 六个维度 ---------------- */
  const DIMS = [
    { key: 'gpa',   name: 'GPA', short: 'GPA',  color: '#7dd3fc', sub: '校内成绩 · 课程难度 · 排名' },
    { key: 'test',  name: '标化', short: '标化', color: '#a78bfa', sub: 'SAT / ACT · 托福 / 雅思' },
    { key: 'ap',    name: 'AP',  short: 'AP',   color: '#34d399', sub: '门数 × 分数 × 科目硬度' },
    { key: 'comp',  name: '竞赛', short: '竞赛', color: '#fbbf24', sub: '赛事层级 × 奖项档次' },
    { key: 'act',   name: '活动', short: '活动', color: '#f472b6', sub: '级别 × 角色 × 年限 × 影响力' },
    { key: 'essay', name: '材料', short: '材料', color: '#fb7185', sub: '文书 · 推荐信 · 面试' }
  ];

  const GLOBAL_WEIGHTS = { gpa: 0.20, test: 0.18, ap: 0.16, comp: 0.16, act: 0.18, essay: 0.12 };

  /* ---------------- 背景加成 ----------------
     不影响六维，只影响学校匹配里的录取概率 */
  const BG_FACTORS = [
    { key: 'domestic', name: '美国绿卡 / 公民', hint: '按 domestic 申请池处理，公立校优势更明显' },
    { key: 'usHigh',   name: '美高就读',       hint: '招生官更熟悉你的课程与推荐信，通常可免托福' },
    { key: 'firstGen', name: '第一代大学生',   hint: '父母均未读过四年制大学' },
    { key: 'legacy',   name: '校友子女',       hint: '父母 / 祖父母毕业于该校（各校权重不同）' },
    { key: 'athlete',  name: '体育特招',       hint: '有教练招募意向的运动员' },
    { key: 'aidNeed',  name: '需要助学金',     hint: '国际生申请 need-based aid；对 need-aware 学校是减分项' }
  ];

  /* 对中国 / 国际申请者的友好度（-6 ~ +6），来自招生规模、助学金政策与录取传统 */
  const SCHOOL_INTL = {
    mit: 1, harvard: 1, stanford: 0, yale: 1, princeton: 2, columbia: -2, uchicago: 1,
    penn: -1, caltech: 0, duke: -1, northwestern: 0, jhu: 1, brown: 0, cornell: 2,
    rice: 1, vanderbilt: 0, notredame: -2, williams: 1, amherst: 2,
    berkeley: 1, ucla: 1, cmu: 4, umich: 2, usc: 4, nyu: 5, unc: -1, uva: 0,
    gatech: 2, uiuc: 6, bu: 3, northeastern: 3, purdue: 4, uw: 3, ucsd: 3, uci: 4,
    wisconsin: 2, osu: 2, asu: 3,
    utaustin: 1, washu: 0, emory: 0, georgetown: -1, psu: 2, tamu: 1, msu: 1, umn: 1,
    umd: 2, pitt: 1, cuboulder: 2, ucdavis: 3, ucsb: 2, casewestern: 2, vt: 1,
    rutgers: 3, indiana: 2, umass: 2, tulane: 0, brandeis: 1, rochester: 1,
    lehigh: 0, villanova: -1, wake: -1, wm: 0, ucsc: 2, ucr: 3, babson: 2,
    emerson: 1, pepperdine: 0
  };
  const NEED_BLIND_INTL = ['harvard', 'yale', 'princeton', 'mit', 'amherst'];
  const D1_SCHOOLS = ['stanford', 'duke', 'umich', 'usc', 'berkeley', 'ucla', 'unc', 'uva',
    'notredame', 'vanderbilt', 'wisconsin', 'osu', 'purdue', 'asu', 'gatech',
    'utaustin', 'psu', 'tamu', 'msu', 'umn', 'umd', 'pitt', 'cuboulder', 'ucdavis',
    'ucsb', 'vt', 'rutgers', 'indiana', 'umass', 'lehigh', 'villanova', 'wake',
    'wm', 'ucsc', 'ucr', 'pepperdine'];

  /* 学校关键词：专业强项 / 招生偏好 / 气质，用于详情页与梦校对比 */
  const SCHOOL_KEYWORDS = {
    mit: ['工程', '计算机', '物理', '科研', '动手项目'],
    harvard: ['领导力', '政治', '经济', '人文', '影响力'],
    stanford: ['计算机', '创业', '工程', '跨学科', '产品'],
    yale: ['人文', '政治', '戏剧', '写作', '博雅'],
    princeton: ['数学', '物理', '公共政策', '本科教育', '学术'],
    columbia: ['金融', '新闻', '国际关系', '纽约', '核心课程'],
    uchicago: ['经济', '哲学', '数学', '写作', '怪题'],
    penn: ['商科', '金融', '创业', '跨学院', '沃顿'],
    caltech: ['物理', '天文', '工程', '科研', '小班'],
    duke: ['医学', '商科', '公共政策', '体育', '南方'],
    northwestern: ['传媒', '新闻', '经济', '表演', '跨学科'],
    jhu: ['医学', '生物', '公共卫生', '科研', '预科'],
    brown: ['开放课程', '人文', '跨学科', '自由', '设计'],
    cornell: ['工程', '酒店管理', '农学', '建筑', '藤校'],
    rice: ['工程', '物理', '建筑', '小班', '休斯顿'],
    vanderbilt: ['医学', '教育', '商科', '南方', '小班'],
    notredame: ['商科', '天主教', '公益', '校友', '橄榄球'],
    williams: ['文理', '经济', '艺术史', '小班', '牛津式'],
    amherst: ['文理', '写作', '政治', '开放课程', '小班'],
    berkeley: ['工程', '计算机', '物理', '经济', '公立'],
    ucla: ['电影', '传媒', '生物', '工程', '洛杉矶'],
    cmu: ['计算机', '机器人', '戏剧', '工程', '交互设计'],
    umich: ['工程', '商科', '医学', '体育', '公立'],
    usc: ['电影', '传媒', '商科', '游戏', '洛杉矶'],
    nyu: ['商科', '艺术', '传媒', '纽约', '实习'],
    unc: ['新闻', '商科', '医学', '公立', '篮球'],
    uva: ['商科', '政治', '历史', '公立', '荣誉体系'],
    gatech: ['工程', '计算机', '航空航天', '公立', '硬核'],
    uiuc: ['计算机', '工程', '会计', '公立', '中国学生多'],
    bu: ['传媒', '商科', '生物', '波士顿', '城市'],
    northeastern: ['实习', 'Co-op', '计算机', '商科', '波士顿'],
    purdue: ['工程', '航空航天', '计算机', '公立', '硬核'],
    uw: ['计算机', '医学', '工程', '西雅图', '科研'],
    ucsd: ['生物', '工程', '计算机', '海洋', '公立'],
    uci: ['计算机', '商科', '生物', '公立', '安全'],
    wisconsin: ['工程', '商科', '生物', '公立', '研究型'],
    osu: ['商科', '工程', '体育', '公立', '大校'],
    asu: ['商科', '工程', '公立', '保底', '创新'],
    utaustin: ['工程', '计算机', '商科', '会计', '德州'],
    washu: ['医学', '生物', '设计', '科研', '圣路易斯'],
    emory: ['医学', '商科', '公共卫生', '生物', '亚特兰大'],
    georgetown: ['国际关系', '政治', '外交', '商科', '华盛顿'],
    psu: ['工程', '商科', '传播', '公立', '校友网'],
    tamu: ['工程', '农学', '商科', '德州', '校友'],
    msu: ['商科', '教育', '传媒', '公立', '大校'],
    umn: ['工程', '化工', '心理', '公立', '研究型'],
    umd: ['计算机', '工程', '商科', '公立', '华盛顿'],
    pitt: ['医学', '生物', '工程', '公立', '匹兹堡'],
    cuboulder: ['物理', '航天', '环境', '公立', '户外'],
    ucdavis: ['农学', '兽医', '生物', '环境', '公立'],
    ucsb: ['物理', '材料', '海洋', '工程', '海边'],
    casewestern: ['工程', '医学', '生物', '科研', '克利夫兰'],
    vt: ['工程', '建筑', '农业', '公立', '弗吉尼亚'],
    rutgers: ['商科', '药学', '工程', '公立', '纽约'],
    indiana: ['商科', '会计', '音乐', '公立', 'Bloomington'],
    umass: ['计算机', '食品科学', '传播', '公立', '五校联盟'],
    tulane: ['商科', '公共卫生', '环境', '南方', '新奥尔良'],
    brandeis: ['社科', '生物', '商科', '文理', '波士顿'],
    rochester: ['光学', '音乐', '医学', '研究型', '罗切斯特'],
    lehigh: ['工程', '商科', '金融', '私立', '宾州'],
    villanova: ['商科', '护理', '工程', '天主教', '费城'],
    wake: ['商科', '政治', '医学', '南方', '小班'],
    wm: ['历史', '政治', '商科', '公立', '博雅'],
    ucsc: ['天文', '海洋', '游戏设计', '公立', '海边'],
    ucr: ['工程', '商科', '生物', '公立', '加州'],
    babson: ['创业', '商科', '家族企业', '波士顿', '实践'],
    emerson: ['传媒', '影视', '写作', '艺术', '波士顿'],
    pepperdine: ['商科', '传媒', '法律预科', '加州', '海边']
  };

  /* 卡片、统计框里用的短名 */  const SHORT_NAMES = {
    mit: 'MIT', harvard: '哈佛', stanford: '斯坦福', yale: '耶鲁', princeton: '普林斯顿',
    columbia: '哥大', uchicago: '芝大', penn: '宾大', caltech: 'Caltech', duke: '杜克',
    northwestern: '西北', jhu: 'JHU', brown: '布朗', cornell: '康奈尔', rice: '莱斯',
    vanderbilt: '范德堡', notredame: '圣母', williams: '威廉姆斯', amherst: '阿默斯特',
    berkeley: '伯克利', ucla: 'UCLA', cmu: 'CMU', umich: 'Umich', usc: 'USC', nyu: 'NYU',
    unc: 'UNC', uva: 'UVA', gatech: 'Gatech', uiuc: 'UIUC', bu: 'BU', northeastern: 'NEU',
    purdue: '普渡', uw: 'UW', ucsd: 'UCSD', uci: 'UCI', wisconsin: '威斯康星', osu: 'OSU', asu: 'ASU',
    utaustin: 'UT Austin', washu: 'WashU', emory: 'Emory', georgetown: 'Georgetown',
    psu: 'Penn State', tamu: 'TAMU', msu: 'MSU', umn: 'UMN', umd: 'UMD', pitt: 'Pitt',
    cuboulder: 'CU Boulder', ucdavis: 'UC Davis', ucsb: 'UCSB', casewestern: 'CWRU',
    vt: 'Virginia Tech', rutgers: 'Rutgers', indiana: 'IU', umass: 'UMass', tulane: 'Tulane',
    brandeis: 'Brandeis', rochester: 'Rochester', lehigh: 'Lehigh', villanova: 'Villanova',
    wake: 'Wake Forest', wm: 'W&M', ucsc: 'UCSC', ucr: 'UCR', babson: 'Babson',
    emerson: 'Emerson', pepperdine: 'Pepperdine'
  };

  /* ---------------- AP ---------------- */
  const AP_SUBJECTS = [
    { name: 'Calculus BC', hard: true }, { name: 'Calculus AB' },
    { name: 'Physics C: Mechanics', hard: true }, { name: 'Physics C: E&M', hard: true },
    { name: 'Physics 1' }, { name: 'Physics 2' },
    { name: 'Chemistry', hard: true }, { name: 'Biology', hard: true },
    { name: 'Computer Science A', hard: true }, { name: 'Computer Science Principles' },
    { name: 'Statistics' }, { name: 'English Language' }, { name: 'English Literature' },
    { name: 'US History' }, { name: 'World History' }, { name: 'European History' },
    { name: 'Human Geography' }, { name: 'Psychology' },
    { name: 'Microeconomics' }, { name: 'Macroeconomics' },
    { name: 'US Government & Politics' }, { name: 'Comparative Government' },
    { name: 'Environmental Science' }, { name: 'Art History' }, { name: 'Music Theory' },
    { name: 'Studio Art: Drawing' }, { name: 'Seminar' }, { name: 'Research' },
    { name: 'Chinese Language & Culture' }, { name: 'French' }, { name: 'Spanish' }
  ];
  const AP_SCORE_POINTS = { 5: 100, 4: 80, 3: 55, 2: 28, 1: 10 };

  /* ---------------- 竞赛评分表 ----------------
     不枚举所有赛事，而是按「档位」给分：先选学科，再选档位，分值可手改。
     每个档位给各学科一个代表赛事，方便对号入座。 */
  const COMP_SUBJECTS = [
    { id: 'math', name: '数学', short: '数学' }, { id: 'physics', name: '物理', short: '物理' },
    { id: 'chem', name: '化学', short: '化学' }, { id: 'bio', name: '生物', short: '生物' },
    { id: 'cs', name: '计算机', short: '计算机' }, { id: 'econ', name: '经济 / 商科', short: '商科' },
    { id: 'writing', name: '写作 / 人文', short: '写作' }, { id: 'debate', name: '辩论 / 模联', short: '辩论' },
    { id: 'research', name: '科创 / 科研', short: '科创' }, { id: 'arts', name: '艺术 / 设计', short: '艺术' },
    { id: 'other', name: '综合 / 其他', short: '其他' }
  ];

  const COMP_TIERS = [
    { id: 'splus', label: 'S+', pts: 100, title: '世界级 · 国家队', desc: '国际奥赛国家队、世界顶级竞赛最高奖',
      examples: { math: 'IMO 国家队', physics: 'IPhO 国家队', chem: 'IChO 国家队', bio: 'IBO 国家队', cs: 'IOI 国家队', econ: 'IEO 国家队', writing: '国际写作赛事全球最高奖', debate: '世界学校辩论锦标赛冠军', research: 'ISEF 全球最高奖 / STS Top 10', arts: '国际艺术赛事最高奖', other: '世界级奖项 / 国家级运动健将' } },
    { id: 's', label: 'S', pts: 94, title: '国际级 · 奖牌', desc: '国际奥赛奖牌、国际科研竞赛一等奖',
      examples: { math: 'IMO / USAMO 奖牌', physics: 'IPhO 奖牌', chem: 'IChO 奖牌', bio: 'IBO 奖牌', cs: 'IOI 奖牌', econ: 'IEO 奖牌', writing: 'John Locke 全球大奖', debate: '哈佛 / 耶鲁模联最佳代表', research: 'ISEF 一等奖 / 丘成桐全球金奖', arts: '国际艺术赛事入围', other: '国际级前 3 名' } },
    { id: 'aplus', label: 'A+', pts: 86, title: '国家级 · 顶尖', desc: '国家级最高奖、国际赛事高分段',
      examples: { math: 'AMC 12 前 1% + AIME 10+', physics: '物理碗全球前 100 / BPhO 超级金奖', chem: 'UKChO 金奖 / 进省队', bio: 'USABO 半决赛 / HOSA 全国前三', cs: 'USACO 白金', econ: 'NEC 全国金奖', writing: '纽约时报写作竞赛获奖', debate: 'NHSDLC 全国八强', research: '丘成桐全球铜奖 / ISEF 二等奖', arts: '全国艺术展演一等奖', other: '国家级一等奖（前 3%）' } },
    { id: 'a', label: 'A', pts: 78, title: '国家级 · 一等奖', desc: '国家级一等奖、省级最高奖',
      examples: { math: '省一 / AMC 12 前 5%', physics: '省一 / 物理碗金奖', chem: '省一', bio: '省一', cs: '省一 / USACO 金', econ: '商赛全国一等奖', writing: '全国作文大赛一等奖', debate: '全国 16 强', research: '全国科创一等奖', arts: '全国二等奖', other: '国家级二等奖' } },
    { id: 'bplus', label: 'B+', pts: 68, title: '省级 · 一等奖', desc: '省级一等奖、国家级二等奖',
      examples: { math: '省二 / AMC 12 前 10%', physics: '省二', chem: '省二', bio: '省二', cs: '省二', econ: '商赛全国二等奖', writing: '省一', debate: '省最佳辩手', research: '省科创一等奖', arts: '省一等奖', other: '省级一等奖' } },
    { id: 'b', label: 'B', pts: 58, title: '市级 · 一等奖', desc: '市级一等奖、省级二等奖',
      examples: { math: '市一', physics: '市一', chem: '市一', bio: '市一', cs: '市一', econ: '校内商赛冠军', writing: '市一', debate: '市最佳辩手', research: '市科创一等奖', arts: '市一等奖', other: '市级一等奖' } },
    { id: 'c', label: 'C', pts: 46, title: '校级 · 一等奖', desc: '校级最高奖、市级二等奖',
      examples: { math: '校级一等奖 / AMC 12 前 25%', physics: '校级一等奖', chem: '校级一等奖', bio: '校级一等奖', cs: '校级一等奖', econ: '校内商赛前三', writing: '校刊发表', debate: '校辩论队主力', research: '校科创一等奖', arts: '校艺术节一等奖', other: '校级一等奖' } },
    { id: 'd', label: 'D', pts: 32, title: '校级 · 参与奖', desc: '校级二三等奖、社团内部竞赛',
      examples: { math: '校级二三等奖', physics: '校级二三等奖', chem: '校级二三等奖', bio: '校级二三等奖', cs: '校级二三等奖', econ: '社团商赛参与', writing: '校征文优秀奖', debate: '校内辩论赛四强', research: '校科创二三等奖', arts: '校艺术节二三等奖', other: '校级二三等奖' } },
    { id: 'e', label: 'E', pts: 18, title: '入门 · 完赛', desc: '参与奖、完赛证明、非选拔项目结业',
      examples: { math: 'AMC 参与 / 校内赛参与', physics: '校内赛参与', chem: '校内赛参与', bio: '校内赛参与', cs: '校内赛参与', econ: '社团活动参与', writing: '校刊投稿', debate: '校内辩论赛参与', research: '科研项目结业', arts: '校艺术节参与', other: '参与证书 / 完赛证明' } }
  ];

  /* ---------------- 活动评分表 ----------------
     和竞赛一样：直接选档位，分值可手改 */
  const ACT_TYPES = [
    { id: 'research',   name: '学术科研' },
    { id: 'leadership', name: '领导力 / 社团' },
    { id: 'service',    name: '公益志愿' },
    { id: 'arts',       name: '艺术 / 创作' },
    { id: 'sports',     name: '体育 / 竞技' },
    { id: 'intern',     name: '实习 / 工作' },
    { id: 'startup',    name: '创业 / 项目' },
    { id: 'media',      name: '自媒体 / 线上影响' }
  ];

  const ACT_TIERS = [
    { id: 'as',  label: 'S',  pts: 70, title: '国际级 · 发起人', desc: '国际青年组织发起人、国际赛事/项目负责人',
      example: '国际青年组织发起人 / 国际赛事志愿者负责人' },
    { id: 'aa',  label: 'A',  pts: 62, title: '国家级 · 发起人', desc: '全国性社团或项目的创始人',
      example: '全国性学生社团创始人 / 国家级活动主理人' },
    { id: 'ab',  label: 'B+', pts: 54, title: '国家级核心 / 省级发起人', desc: '国家级项目核心成员、省级项目创始人',
      example: '国家级项目核心 / 省级社团创始人' },
    { id: 'ac',  label: 'B',  pts: 46, title: '省级骨干 / 校级创始人', desc: '省级活动骨干、校队或社团创始人（3 年以上）',
      example: '省级活动骨干 / 校队或社团创始人（3 年+）' },
    { id: 'ad',  label: 'C+', pts: 38, title: '校级负责人', desc: '社团创始人、社长、校队队长、校刊主编',
      example: '社团创始人 / 社长 / 校队队长 / 校刊主编' },
    { id: 'ae',  label: 'C',  pts: 30, title: '校级核心 / 长期志愿', desc: '部长、核心成员、3 年以上长期志愿',
      example: '部长 / 核心成员 / 3 年以上长期志愿' },
    { id: 'af',  label: 'D+', pts: 22, title: '校级成员 / 社区参与', desc: '普通社员、社区志愿者、班级委员',
      example: '普通社员 / 社区志愿者 / 班级委员' },
    { id: 'ag',  label: 'D',  pts: 14, title: '短期 / 一次性', desc: '一次性志愿、短期夏令营、单次比赛',
      example: '一次性志愿 / 短期夏令营 / 单次比赛' },
    { id: 'ah',  label: 'E',  pts: 8,  title: '线上 / 泛参与', desc: '线上社群、打卡活动、泛参与',
      example: '线上社群 / 打卡活动 / 泛参与' }
  ];

  /* ---------------- 换算锚点 ---------------- */
  const GPA_ANCHORS_4 = [[2.0, 0], [2.5, 16], [3.0, 38], [3.3, 50], [3.5, 62], [3.7, 72], [3.85, 81], [3.95, 87], [4.0, 90], [4.2, 95], [4.3, 98]];
  const GPA_ANCHORS_100 = [[60, 0], [65, 12], [70, 26], [75, 40], [80, 52], [85, 66], [90, 78], [95, 92], [98, 97], [100, 100]];
  const SAT_ANCHORS = [[1000, 4], [1100, 14], [1200, 28], [1300, 46], [1400, 66], [1450, 77], [1500, 87], [1550, 95], [1600, 100]];
  const ACT_ANCHORS = [[20, 12], [24, 32], [28, 52], [30, 66], [32, 79], [34, 90], [36, 100]];
  const TOEFL_ANCHORS = [[80, 35], [90, 55], [100, 74], [105, 83], [110, 91], [115, 97], [120, 100]];
  const IELTS_ANCHORS = [[6, 40], [6.5, 56], [7, 72], [7.5, 84], [8, 92], [8.5, 97], [9, 100]];

  const GPA_RIGOR = {
    regular:  { name: '几乎没上 AP',        bonus: 0 },
    honors:   { name: '荣誉 / 校本课程为主', bonus: 1 },
    ap_light: { name: 'AP 1–3 门',          bonus: 2 },
    ap_std:   { name: 'AP 4–6 门',          bonus: 3 },
    ap_heavy: { name: 'AP 7 门以上 / 全 AP', bonus: 4 }
  };
  const GPA_RANK = {
    none:    { name: '学校不排名', bonus: 0 },
    top1:    { name: '前 1%',      bonus: 3 },
    top5:    { name: '前 5%',      bonus: 2 },
    top10:   { name: '前 10%',     bonus: 1 },
    top25:   { name: '前 25%',     bonus: 0 },
    top50:   { name: '前 50%',     bonus: -3 }
  };
  const GPA_TREND = {
    up:   { name: '稳步上升', bonus: 2 },
    flat: { name: '基本持平', bonus: 0 },
    down: { name: '有下滑',   bonus: -2 }
  };

  /* ---------------- 文书自评 ---------------- */
  const ESSAY_CHECKS = [
    { key: 'unique',  name: '主题独特性',      weight: 0.22, hint: '别人写不出来的那部分' },
    { key: 'detail',  name: '细节与场景',      weight: 0.18, hint: '能被拍成镜头的画面' },
    { key: 'reflect', name: '反思深度',        weight: 0.20, hint: '你因此改变了什么' },
    { key: 'fit',     name: '与专业 / 学校契合', weight: 0.15, hint: '为什么是你、为什么是这里' },
    { key: 'voice',   name: '语言与个人声音',  weight: 0.15, hint: '读起来像不像你' },
    { key: 'revise',  name: '打磨程度',        weight: 0.10, hint: '改过几轮、给谁看过' }
  ];

  /* ---------------- 推荐信 / 面试 ----------------
     第六维不是纯文书：没写文书的用户先用推荐信和面试撑起来 */
  const REC_CHECKS = [
    { key: 'academic', name: '学术推荐信',        weight: 0.40, hint: '教过你核心课的任课老师' },
    { key: 'counselor', name: '班主任 / 升学指导', weight: 0.30, hint: '了解你整整三年的人' },
    { key: 'extra',    name: '额外推荐人',        weight: 0.20, hint: '科研导师 / 实习主管 / 教练' },
    { key: 'detail',   name: '信里有具体故事',    weight: 0.10, hint: '不是“该生优秀”，而是某件具体的事' }
  ];
  const INTERVIEW_CHECKS = [
    { key: 'prep',  name: '面试准备度', weight: 0.70, hint: '能不能 30 秒讲清自己是谁' },
    { key: 'story', name: '追问与细节', weight: 0.30, hint: '被追问时有没有第二层故事' }
  ];
  const MATERIAL_WEIGHTS = { essay: 0.50, rec: 0.35, interview: 0.15 };

  /* ---------------- 美国大学画像 ----------------
     dims 顺序：[GPA, 标化, AP, 竞赛, 活动, 文书]
     blind: UC 系 Test-Blind，不参考 SAT/ACT
     type: private / public；tech: 理工强校标签 */
  const SCHOOLS = [
    { id: 'mit', name: '麻省理工', en: 'MIT', type: 'private', tech: true, rate: 0.04, dims: [97, 96, 95, 97, 90, 88],
      tags: ['理工神校', '科研', '硬核'], note: '理工科天花板。要的是“你真的动手做出过东西”的证据，而不是“我很聪明”。',
      essayTip: '把一个技术决策写成现场：你卡在哪、试了什么、为什么改、最后跑通了什么。' },
    { id: 'harvard', name: '哈佛', en: 'Harvard University', type: 'private', rate: 0.035, dims: [98, 96, 90, 92, 95, 95],
      tags: ['藤校', '领导力', '人文'], note: '喜欢有“改变一群人”的痕迹的人。六维里活动和文书权重几乎和成绩一样高。',
      essayTip: '不要写“我领导了”，写你如何说服第一个不情愿的人加入。' },
    { id: 'stanford', name: '斯坦福', en: 'Stanford University', type: 'private', rate: 0.04, dims: [97, 95, 90, 93, 96, 94],
      tags: ['硅谷', '创业', '跨学科'], note: '对“自己造了个东西”的偏执，胜过对满分的偏执。',
      essayTip: '展示你如何把两个不相关的兴趣焊在一起，而不是罗列奖项。' },
    { id: 'yale', name: '耶鲁', en: 'Yale University', type: 'private', rate: 0.045, dims: [97, 96, 92, 88, 94, 97],
      tags: ['藤校', '人文', '文书'], note: '文书权重最高的学校之一。它想知道你怎么想，而不是你做过什么。',
      essayTip: '选一个小到别人不会写的瞬间，把它写到有气味、有声音。' },
    { id: 'princeton', name: '普林斯顿', en: 'Princeton University', type: 'private', rate: 0.04, dims: [98, 97, 93, 90, 92, 93],
      tags: ['藤校', '学术', '本科教育'], note: '成绩几乎不能有短板，同时要有一份像样的独立学术作品。',
      essayTip: '把学术兴趣写成一个具体的问题，而不是一个学科名。' },
    { id: 'columbia', name: '哥伦比亚', en: 'Columbia University', type: 'private', rate: 0.04, dims: [96, 95, 88, 85, 90, 92],
      tags: ['藤校', '纽约', '核心课程'], note: '在纽约，喜欢能把课堂知识接到真实城市问题上的人。',
      essayTip: '用你活动里的一个真实冲突，回应它 Core Curriculum 关心的问题。' },
    { id: 'uchicago', name: '芝加哥大学', en: 'University of Chicago', type: 'private', rate: 0.05, dims: [96, 94, 90, 86, 88, 99],
      tags: ['烧脑文书', '学术', '怪题'], note: '全美文书权重最离谱的学校。它用怪题筛“真的爱想事情”的人。',
      essayTip: '别猜它想要什么答案。选一个你真好奇的角度，把逻辑推到有点危险的地方。' },
    { id: 'penn', name: '宾大', en: 'University of Pennsylvania', type: 'private', rate: 0.06, dims: [95, 94, 89, 84, 92, 90],
      tags: ['藤校', '商科', '跨学院'], note: '喜欢“已经做过一点真实世界项目”的申请者，尤其是商科与交叉学科。',
      essayTip: '把一次活动写成一个小型商业/组织问题：目标、约束、你做的取舍。' },
    { id: 'caltech', name: '加州理工', en: 'Caltech', type: 'private', tech: true, rate: 0.03, dims: [98, 98, 96, 98, 82, 85],
      tags: ['理工', '科研', '极小'], note: '奥赛与科研硬通货，活动可以少，但学术证据必须极硬。',
      essayTip: '讲一个你算错、然后发现错得很有意思的推导。' },
    { id: 'duke', name: '杜克', en: 'Duke University', type: 'private', rate: 0.06, dims: [95, 94, 90, 85, 91, 91],
      tags: ['南方哈佛', '体育', '跨学科'], note: '学术与校园能量都要，喜欢有团队感的人。',
      essayTip: '写你在一支队伍里最不显眼但最不可替代的那件事。' },
    { id: 'northwestern', name: '西北大学', en: 'Northwestern University', type: 'private', rate: 0.07, dims: [94, 93, 88, 82, 90, 92],
      tags: ['传媒', '跨学科', '芝加哥'], note: '传媒、新闻、表演方向极强，重视表达与项目落地。',
      essayTip: '如果你做媒体，讲一次你决定“不发布”的取舍。' },
    { id: 'jhu', name: '约翰霍普金斯', en: 'Johns Hopkins University', type: 'private', rate: 0.07, dims: [94, 93, 92, 86, 85, 88],
      tags: ['医学', '科研', '预科'], note: '医学与科研导向，AP 与实验室经历的权重很高。',
      essayTip: '写你在实验室里第一次意识到“数据不等于结论”的时刻。' },
    { id: 'brown', name: '布朗', en: 'Brown University', type: 'private', rate: 0.05, dims: [94, 93, 85, 80, 88, 93],
      tags: ['自由选课', '开放课程'], note: '喜欢自己设计学习路径的人，文书要能看出“你为什么要自由”。',
      essayTip: '写一个你因为好奇而自学的东西，以及它怎么改变了你的课表。' },
    { id: 'cornell', name: '康奈尔', en: 'Cornell University', type: 'private', rate: 0.09, dims: [93, 91, 90, 84, 86, 85],
      tags: ['藤校', '工程', '农学院'], note: '藤校里最看“专业匹配度”的，学院之间差异巨大。',
      essayTip: '把 Why School 写到具体实验室、具体课程、具体教授的研究方向。' },
    { id: 'rice', name: '莱斯', en: 'Rice University', type: 'private', rate: 0.08, dims: [93, 92, 88, 82, 87, 88],
      tags: ['小班', '理工', '休斯顿'], note: '小而精，喜欢合作的理工科学生，讨厌“独狼式”自述。',
      essayTip: '写一次你为了帮别人解决问题，放弃了自己更酷的方案。' },
    { id: 'vanderbilt', name: '范德堡', en: 'Vanderbilt University', type: 'private', rate: 0.07, dims: [94, 93, 89, 80, 86, 89],
      tags: ['南方', '教育', '医学'], note: '成绩门槛高，活动看重持续性与社区感。',
      essayTip: '用一件很小的事证明你“会照顾人”，而不是喊口号。' },
    { id: 'notredame', name: '圣母大学', en: 'University of Notre Dame', type: 'private', rate: 0.12, dims: [92, 90, 82, 78, 88, 86],
      tags: ['天主教', '价值观', '校友'], note: '看重服务精神与价值观一致性，公益活动要写出“为什么持续”。',
      essayTip: '写你服务过的人如何改变了你对“帮助”的理解。' },
    { id: 'williams', name: '威廉姆斯学院', en: 'Williams College', type: 'private', rate: 0.08, dims: [95, 93, 86, 78, 93, 95],
      tags: ['文理学院', '小班', '博雅'], note: '文理学院天花板，文书和活动权重高于竞赛。',
      essayTip: '写一个你在课堂上没能问出口的问题，以及它后来怎么追着你。' },
    { id: 'amherst', name: '阿默斯特学院', en: 'Amherst College', type: 'private', rate: 0.09, dims: [95, 92, 85, 76, 92, 96],
      tags: ['文理学院', '博雅', '写作'], note: '极度看重写作与思考密度，标化高只是入场券。',
      essayTip: '把一篇你写过的读书笔记改写成“你与作者吵架”的故事。' },
    { id: 'berkeley', name: '加州大学伯克利', en: 'UC Berkeley', type: 'public', rate: 0.11, dims: [94, 0, 88, 86, 88, 84], blind: true,
      tags: ['公立第一', '理工', 'Test-Blind'], note: 'UC 系不看 SAT/ACT。GPA、AP 与课程强度是硬门槛，PIQ 要写满四篇。',
      essayTip: 'PIQ 不要复述简历，每篇只回答一个问题，并给出一个具体场景。' },
    { id: 'ucla', name: '加州大学洛杉矶', en: 'UCLA', type: 'public', rate: 0.09, dims: [93, 0, 85, 82, 86, 83], blind: true,
      tags: ['公立', '洛杉矶', 'Test-Blind'], note: 'UC 系同理：标化不参与，GPA 和 AP 门数几乎决定初筛。',
      essayTip: '把“领导力”写成一个你实际改变了的流程，而不是一个头衔。' },
    { id: 'cmu', name: '卡内基梅隆', en: 'Carnegie Mellon University', type: 'private', tech: true, rate: 0.11, dims: [93, 92, 92, 90, 84, 85],
      tags: ['计算机', '戏剧', '理工'], note: 'CS 和工程看竞赛与项目，艺术学院看作品集，两个世界。',
      essayTip: '写一个你为了让程序快 20% 而做的“不优雅”选择。' },
    { id: 'umich', name: '密歇根大学安娜堡', en: 'University of Michigan', type: 'public', rate: 0.18, dims: [90, 87, 80, 76, 82, 80],
      tags: ['公立', '工程', '体育'], note: '公立强校，EA 批次对国际生更友好，GPA 是第一位。',
      essayTip: 'Why Michigan 要写出你能用上具体哪个学院资源，别写“排名高”。' },
    { id: 'usc', name: '南加州大学', en: 'USC', type: 'private', rate: 0.10, dims: [89, 87, 82, 76, 84, 85],
      tags: ['洛杉矶', '传媒', '电影'], note: '传媒、电影、商科强，喜欢有作品集的申请者。',
      essayTip: '把你的作品当成主角，写观众的反应如何改变了你下一次创作。' },
    { id: 'nyu', name: '纽约大学', en: 'NYU', type: 'private', rate: 0.12, dims: [88, 86, 78, 72, 80, 82],
      tags: ['纽约', '艺术', '商科'], note: '不强制提交标化，但热门学院（Stern / Tisch）依然卷。',
      essayTip: 'Why NYU 必须具体到学院和城市资源，否则一眼假。' },
    { id: 'unc', name: '北卡教堂山', en: 'UNC Chapel Hill', type: 'public', rate: 0.17, dims: [90, 86, 80, 74, 82, 80],
      tags: ['公立', '新闻', '医学'], note: '公立名校，国际生名额少，文书要体现对社区的长期投入。',
      essayTip: '写你为学校做的一件“没人要求你做”的事。' },
    { id: 'uva', name: '弗吉尼亚大学', en: 'University of Virginia', type: 'public', rate: 0.19, dims: [90, 86, 78, 72, 80, 79],
      tags: ['公立', '荣誉体系', '商科'], note: '重视荣誉感与自我管理，活动里长期服务很加分。',
      essayTip: '写一次你主动承认错误并承担后果的经历。' },
    { id: 'gatech', name: '佐治亚理工', en: 'Georgia Tech', type: 'public', tech: true, rate: 0.17, dims: [91, 88, 88, 82, 78, 78],
      tags: ['工程', '公立', '硬核'], note: '工程导向，AP 微积分与物理成绩几乎被逐门看。',
      essayTip: '写你如何用工程思维修好一个非工程问题（比如一段关系）。' },
    { id: 'uiuc', name: '伊利诺伊香槟', en: 'UIUC', type: 'public', tech: true, rate: 0.45, dims: [85, 80, 76, 70, 74, 72],
      tags: ['工程', 'CS', '公立'], note: '中国学生最熟悉的保底/匹配校，CS 与工程录取明显更难。',
      essayTip: '把 Why Major 写成“我已经开始做了”，而不是“我想学”。' },
    { id: 'bu', name: '波士顿大学', en: 'Boston University', type: 'private', rate: 0.14, dims: [86, 82, 74, 66, 76, 78],
      tags: ['波士顿', '传媒', '商科'], note: '城市型大学，标化与 GPA 是主要筛选项，文书要有城市感。',
      essayTip: '写一次你在城市里观察到的、和你想学的专业有关的细节。' },
    { id: 'northeastern', name: '东北大学', en: 'Northeastern University', type: 'private', rate: 0.06, dims: [88, 84, 76, 70, 82, 80],
      tags: ['Co-op', '实习', '波士顿'], note: '看重实习与项目经历，录取率比想象中低，别当保底。',
      essayTip: '写你在一次实习/项目里被现实打脸后学到的东西。' },
    { id: 'purdue', name: '普渡大学', en: 'Purdue University', type: 'public', tech: true, rate: 0.50, dims: [83, 78, 72, 66, 70, 68],
      tags: ['工程', '航空航天', '公立'], note: '工程强、录取相对友好，但热门专业仍要早申。',
      essayTip: '写一个你拆过的东西，以及你从零件里看出的系统。' },
    { id: 'uw', name: '华盛顿大学西雅图', en: 'University of Washington', type: 'public', tech: true, rate: 0.48, dims: [85, 78, 70, 64, 68, 68],
      tags: ['CS', '公立', '西雅图'], note: 'CS 直录极难，整体录取率却很高，专业选择要策略。',
      essayTip: '写你为什么非这个专业不可，且能说出两个具体方向。' },
    { id: 'ucsd', name: '加州大学圣地亚哥', en: 'UC San Diego', type: 'public', rate: 0.24, dims: [87, 0, 78, 70, 72, 70], blind: true,
      tags: ['公立', '理工', 'Test-Blind'], note: 'UC 系，按学院录取，文书里写清你想进哪个学院。',
      essayTip: 'PIQ 选“学术兴趣”那题，写你自学过的一个具体知识点。' },
    { id: 'uci', name: '加州大学欧文', en: 'UC Irvine', type: 'public', rate: 0.26, dims: [85, 0, 74, 66, 70, 68], blind: true,
      tags: ['公立', '安全', 'Test-Blind'], note: 'UC 系里相对友好的选择，GPA 稳定就很有机会。',
      essayTip: '四篇 PIQ 里至少有一篇要写“你为别人做了什么”。' },
    { id: 'wisconsin', name: '威斯康星麦迪逊', en: 'UW–Madison', type: 'public', rate: 0.43, dims: [84, 78, 70, 64, 72, 70],
      tags: ['公立', '研究型', '保底'], note: '中国学生常见保底校，GPA 与课程难度是核心。',
      essayTip: '写你为什么需要一个“大而全”的学校，而不是小而精。' },
    { id: 'osu', name: '俄亥俄州立', en: 'Ohio State University', type: 'public', rate: 0.53, dims: [80, 74, 66, 58, 66, 64],
      tags: ['公立', '保底', '综合'], note: '规模大、专业全，适合作为稳妥选择。',
      essayTip: '写一个你想加入的具体学生组织，以及你能给它带来什么。' },
    { id: 'asu', name: '亚利桑那州立', en: 'Arizona State University', type: 'public', rate: 0.88, dims: [72, 66, 55, 45, 58, 56],
      tags: ['公立', '保底', '性价比'], note: '录取友好，适合兜底；荣誉学院是另一种玩法。',
      essayTip: '写清楚你想读什么、为什么，越具体越好。' },

    /* ---- 补齐 QS 前 100 里的美国校 + 常见强校 ---- */
    { id: 'utaustin', name: '德州大学奥斯汀', en: 'UT Austin', type: 'public', rate: 0.29, dims: [90, 86, 80, 74, 80, 78],
      tags: ['公立', '工程', '德州'], note: '公立里的工程与商科强校，德州本地保护明显，国际生名额紧。',
      essayTip: '把 Why Major 写到具体课程 / 实验室，别只写排名。' },
    { id: 'washu', name: '圣路易斯华盛顿', en: 'Washington University in St. Louis', type: 'private', rate: 0.12, dims: [95, 94, 90, 80, 88, 90],
      tags: ['医学预科', '生物', '圣路易斯'], note: '医学预科和生物的天花板之一，圣路易斯安静、资源集中。',
      essayTip: '写你对一个具体科学问题的执念，而不是“我想学医”。' },
    { id: 'emory', name: '埃默里', en: 'Emory University', type: 'private', rate: 0.11, dims: [93, 92, 88, 80, 86, 88],
      tags: ['医学', '商科', '亚特兰大'], note: '医学预科、商科和公共卫生强，亚特兰大的实习资源多。',
      essayTip: '把一次医院 / 实验室经历写成“你看见了什么”。' },
    { id: 'georgetown', name: '乔治城', en: 'Georgetown University', type: 'private', rate: 0.12, dims: [93, 93, 86, 78, 90, 92],
      tags: ['国际关系', '政治', '华盛顿'], note: '国际关系、政治、外交方向顶级，DC 的地理位置是加成。',
      essayTip: '用一次真实的政策辩论，展示你怎么处理反对意见。' },
    { id: 'psu', name: '宾州州立', en: 'Penn State University', type: 'public', tech: true, rate: 0.55, dims: [84, 78, 70, 62, 72, 68],
      tags: ['工程', '公立', '大校'], note: '公立大校，工程、商科、传播都全，校友网络巨大。',
      essayTip: 'Why School 写清你想进哪个学院、哪个实验室。' },
    { id: 'tamu', name: '德州农工', en: 'Texas A&M University', type: 'public', tech: true, rate: 0.63, dims: [83, 76, 68, 60, 70, 66],
      tags: ['工程', '公立', '德州'], note: '工程和农学强，德州校友文化浓，录取相对友好。',
      essayTip: '写你动手做过的工程项目，越具体越好。' },
    { id: 'msu', name: '密歇根州立', en: 'Michigan State University', type: 'public', rate: 0.70, dims: [80, 74, 64, 56, 66, 62],
      tags: ['公立', '商科', '大校'], note: '公立大校，商科、教育、传媒稳定，适合作为匹配 / 保底。',
      essayTip: '写一个你想加入的社团，以及你能做什么。' },
    { id: 'umn', name: '明尼苏达双城', en: 'University of Minnesota', type: 'public', rate: 0.75, dims: [82, 75, 66, 58, 68, 64],
      tags: ['公立', '工程', '明尼苏达'], note: '公立研究型，工程、化工、心理学强，冬天很长。',
      essayTip: '写你如何适应一个“大而冷”的环境。' },
    { id: 'umd', name: '马里兰大学', en: 'University of Maryland', type: 'public', tech: true, rate: 0.45, dims: [86, 80, 74, 66, 74, 70],
      tags: ['计算机', '公立', '华盛顿都会'], note: '计算机、工程、商科强，离华盛顿近，实习机会多。',
      essayTip: '把 Why CS 写成一个你解决过的问题。' },
    { id: 'pitt', name: '匹兹堡大学', en: 'University of Pittsburgh', type: 'public', rate: 0.50, dims: [84, 78, 70, 62, 70, 66],
      tags: ['医学', '公立', '匹兹堡'], note: '医学预科强，匹兹堡城市资源好，公立里性价比高。',
      essayTip: '写你在医院 / 社区看到的细节，而不是“我想救人”。' },
    { id: 'cuboulder', name: '科罗拉多博尔德', en: 'CU Boulder', type: 'public', rate: 0.80, dims: [80, 74, 64, 56, 66, 62],
      tags: ['物理', '航天', '公立'], note: '物理、航天、环境科学强，户外文化浓。',
      essayTip: '写一次你抬头看星星 / 爬山时的具体观察。' },
    { id: 'ucdavis', name: '加州大学戴维斯', en: 'UC Davis', type: 'public', rate: 0.42, dims: [86, 0, 76, 68, 72, 70], blind: true,
      tags: ['农学', '兽医', 'Test-Blind'], note: '农学、兽医、生物强，UC 里相对友好的选择。',
      essayTip: 'PIQ 写你和土地 / 动物 / 实验的具体关系。' },
    { id: 'ucsb', name: '加州大学圣塔芭芭拉', en: 'UC Santa Barbara', type: 'public', rate: 0.28, dims: [88, 0, 78, 70, 74, 70], blind: true,
      tags: ['物理', '材料', 'Test-Blind'], note: '物理、材料、海洋科学强，海边校园。',
      essayTip: '写一个你拆过 / 修过的东西。' },
    { id: 'casewestern', name: '凯斯西储', en: 'Case Western Reserve University', type: 'private', tech: true, rate: 0.27, dims: [87, 84, 78, 70, 74, 72],
      tags: ['工程', '医学', '克利夫兰'], note: '工程、医学预科强，克利夫兰的医院系统是资源。',
      essayTip: '写你在实验室里失败得最有价值的一次。' },
    { id: 'vt', name: '弗吉尼亚理工', en: 'Virginia Tech', type: 'public', tech: true, rate: 0.57, dims: [84, 78, 70, 62, 70, 66],
      tags: ['工程', '公立', '弗吉尼亚'], note: '工程、建筑、农业强，公立里工科氛围浓。',
      essayTip: '写一个你亲手造出来的东西。' },
    { id: 'rutgers', name: '罗格斯', en: 'Rutgers University', type: 'public', rate: 0.66, dims: [82, 76, 68, 58, 68, 64],
      tags: ['公立', '纽约都会', '商科'], note: '公立大校，靠近纽约，商科、药学、工程稳定。',
      essayTip: '写你为什么需要纽约都会圈的实习。' },
    { id: 'indiana', name: '印第安纳伯明顿', en: 'Indiana University Bloomington', type: 'public', rate: 0.80, dims: [81, 75, 66, 56, 68, 64],
      tags: ['商科', '公立', 'Bloomington'], note: 'Kelley 商学院是招牌，公立大校，校园氛围好。',
      essayTip: '写一个你卖过 / 组织过的东西。' },
    { id: 'umass', name: '麻省大学阿默斯特', en: 'UMass Amherst', type: 'public', rate: 0.64, dims: [83, 77, 68, 58, 68, 64],
      tags: ['CS', '公立', '五校联盟'], note: 'CS、食品科学、传播强，Amherst 五校联盟。',
      essayTip: '写你想跨校选的那门课。' },
    { id: 'tulane', name: '杜兰大学', en: 'Tulane University', type: 'private', rate: 0.13, dims: [89, 87, 80, 70, 82, 80],
      tags: ['南方', '商科', '新奥尔良'], note: '南方私立，商科、公共卫生、环境强，新奥尔良文化独特。',
      essayTip: '写你与一座城市的关系。' },
    { id: 'brandeis', name: '布兰迪斯', en: 'Brandeis University', type: 'private', rate: 0.35, dims: [88, 85, 78, 68, 76, 76],
      tags: ['文理', '波士顿', '社科'], note: '波士顿近郊的私立研究型，社科、生物、商科稳。',
      essayTip: '写一个你持续追问的社会问题。' },
    { id: 'rochester', name: '罗切斯特', en: 'University of Rochester', type: 'private', rate: 0.38, dims: [88, 85, 80, 70, 76, 76],
      tags: ['光学', '音乐', '研究型'], note: '光学、音乐、医学预科强，罗切斯特冬天长。',
      essayTip: '写你如何同时做两件不相关的事。' },
    { id: 'lehigh', name: '里海大学', en: 'Lehigh University', type: 'private', tech: true, rate: 0.35, dims: [87, 84, 76, 66, 76, 74],
      tags: ['工程', '商科', '宾州'], note: '工程、商科强，宾州私立，校园在山坡上。',
      essayTip: '写一次团队里你负责的那部分。' },
    { id: 'villanova', name: '维拉诺瓦', en: 'Villanova University', type: 'private', rate: 0.25, dims: [88, 85, 76, 66, 80, 78],
      tags: ['商科', '天主教', '费城'], note: '商科、护理、工程强，天主教价值观，费城近郊。',
      essayTip: '写一次你服务他人的经历，别喊口号。' },
    { id: 'wake', name: '维克森林', en: 'Wake Forest University', type: 'private', rate: 0.22, dims: [90, 88, 80, 68, 82, 80],
      tags: ['南方', '商科', '小班'], note: '南方私立，商科、医学预科、政治强，小班教学。',
      essayTip: '写一次你在课堂上被推翻的观点。' },
    { id: 'wm', name: '威廉玛丽', en: 'William & Mary', type: 'public', rate: 0.33, dims: [89, 86, 78, 68, 80, 80],
      tags: ['公立', '历史', '弗吉尼亚'], note: '公立里的小班博雅，历史、政治、商科强。',
      essayTip: '写一个你读过的历史细节，以及它怎么改变你看现在。' },
    { id: 'ucsc', name: '加州大学圣克鲁兹', en: 'UC Santa Cruz', type: 'public', rate: 0.47, dims: [82, 0, 72, 62, 70, 68], blind: true,
      tags: ['天文', '海洋', 'Test-Blind'], note: '天文、海洋、游戏设计有特色，UC 里相对友好。',
      essayTip: 'PIQ 写一个你自学过的奇怪技能。' },
    { id: 'ucr', name: '加州大学河滨', en: 'UC Riverside', type: 'public', rate: 0.65, dims: [80, 0, 68, 58, 66, 64], blind: true,
      tags: ['公立', '工程', 'Test-Blind'], note: 'UC 里录取最友好的之一，工程、商科稳定。',
      essayTip: '写清楚你想读什么、为什么，别泛泛而谈。' },
    { id: 'babson', name: '巴布森', en: 'Babson College', type: 'private', rate: 0.24, dims: [85, 83, 72, 64, 80, 76],
      tags: ['创业', '商科', '波士顿'], note: '创业学全美第一梯队，商科导向极强。',
      essayTip: '写你做过的规模最小的一次“生意”。' },
    { id: 'emerson', name: '爱默生学院', en: 'Emerson College', type: 'private', rate: 0.35, dims: [82, 80, 70, 60, 76, 80],
      tags: ['传媒', '艺术', '波士顿'], note: '传媒、影视、写作强，波士顿市中心。',
      essayTip: '写一个你拍过 / 写过的作品，以及观众的反应。' },
    { id: 'pepperdine', name: '佩珀代因', en: 'Pepperdine University', type: 'private', rate: 0.35, dims: [84, 82, 72, 62, 74, 74],
      tags: ['加州', '商科', '海边'], note: '加州海边私立，商科、传媒、法律预科，宗教氛围。',
      essayTip: '写你如何面对一次价值观冲突。' }
  ];

  /* ---------------- 历届毕业生（可编辑的示例数据） ---------------- */
  const COHORTS = [
    { year: 2025, count: 46, demo: true, dims: [86, 84, 78, 62, 74, 70],
      destinations: [{ id: 'uiuc', n: 6 }, { id: 'wisconsin', n: 5 }, { id: 'osu', n: 5 }, { id: 'bu', n: 4 }, { id: 'purdue', n: 4 }, { id: 'nyu', n: 3 }, { id: 'uw', n: 2 }, { id: 'northeastern', n: 2 }, { id: 'umich', n: 2 }, { id: 'usc', n: 2 }, { id: 'berkeley', n: 1 }, { id: 'ucla', n: 1 }, { id: 'cmu', n: 1 }, { id: 'cornell', n: 1 } ],
      note: 'AP 体系，平均每人 4.2 门 AP；T30 录取 9 人。' },
    { year: 2024, count: 44, demo: true, dims: [85, 83, 76, 60, 73, 69],
      destinations: [{ id: 'uiuc', n: 7 }, { id: 'wisconsin', n: 5 }, { id: 'purdue', n: 5 }, { id: 'osu', n: 4 }, { id: 'bu', n: 3 }, { id: 'uw', n: 3 }, { id: 'nyu', n: 2 }, { id: 'northeastern', n: 2 }, { id: 'usc', n: 2 }, { id: 'uci', n: 2 }, { id: 'umich', n: 1 }, { id: 'ucla', n: 1 } ],
      note: '这一届 ED 命中率偏高，NYU 与 BU 各走了 2 人。' },
    { year: 2023, count: 43, demo: true, dims: [84, 82, 75, 58, 71, 66],
      destinations: [{ id: 'uiuc', n: 6 }, { id: 'wisconsin', n: 6 }, { id: 'purdue', n: 5 }, { id: 'osu', n: 4 }, { id: 'bu', n: 3 }, { id: 'uw', n: 3 }, { id: 'uci', n: 3 }, { id: 'nyu', n: 2 }, { id: 'umich', n: 1 }, { id: 'northeastern', n: 1 } ],
      note: '标化平均 1460，AP 平均 3.8 门。' },
    { year: 2022, count: 41, demo: true, dims: [83, 81, 73, 56, 70, 65],
      destinations: [{ id: 'wisconsin', n: 6 }, { id: 'uiuc', n: 5 }, { id: 'osu', n: 5 }, { id: 'purdue', n: 4 }, { id: 'uw', n: 4 }, { id: 'uci', n: 3 }, { id: 'bu', n: 2 }, { id: 'nyu', n: 2 }, { id: 'asu', n: 2 } ],
      note: '疫情后恢复正常申请，加州系录取明显收紧。' },
    { year: 2021, count: 39, demo: true, dims: [82, 80, 72, 55, 68, 63],
      destinations: [{ id: 'wisconsin', n: 5 }, { id: 'osu', n: 5 }, { id: 'uiuc', n: 4 }, { id: 'purdue', n: 4 }, { id: 'uw', n: 4 }, { id: 'uci', n: 3 }, { id: 'bu', n: 2 }, { id: 'asu', n: 2 }, { id: 'nyu', n: 1 } ],
      note: 'Test-Optional 第一年，标化提交率只有 6 成。' }
  ];

  /* ---------------- 文书题目 ---------------- */
  const PROMPTS = [
    { id: 'ca1', org: 'Common App', title: '背景、身份、兴趣或天赋', dims: ['act', 'essay'],
      en: 'Some students have a background, identity, interest, or talent so meaningful they believe their application would be incomplete without it.',
      zh: '你的某个背景、身份、兴趣或天赋，重要到没有它申请材料就不完整。',
      tips: ['别写“我热爱数学”，写你和数学相处的方式', '把身份落到一个具体物品或场景上', '结尾不要升华到世界和平'] },
    { id: 'ca2', org: 'Common App', title: '一次挫折与它的礼物', dims: ['comp', 'act'],
      en: 'The lessons we take from obstacles we encounter can be fundamental to later success.',
      zh: '你从一次障碍中学到的东西，如何影响了后来的你。',
      tips: ['选一个真的失败过的版本，不是“差点失败”', '写清你当时的错误判断', '重点在“后来你改了哪个习惯”'] },
    { id: 'ca3', org: 'Common App', title: '你质疑过的信念', dims: ['essay', 'act'],
      en: 'Reflect on a time when you questioned or challenged a belief or idea.',
      zh: '你曾质疑或挑战某个信念 / 观念的时刻。',
      tips: ['先诚实地写出你原本相信什么', '对手要是一个值得尊重的对手', '不要写成“我赢了辩论”'] },
    { id: 'ca4', org: 'Common App', title: '你想解决的问题', dims: ['act', 'comp'],
      en: 'Describe a problem you have solved or a problem you would like to solve.',
      zh: '你解决过的一个问题，或你渴望解决的问题。',
      tips: ['把大问题缩到一个你摸得到的尺度', '写你已经做过的那 10%', '说清为什么是你来做'] },
    { id: 'ca5', org: 'Common App', title: '一次让你成长的成就', dims: ['act', 'essay'],
      en: 'Discuss an accomplishment, event, or realization that sparked a period of personal growth.',
      zh: '一个成就、事件或领悟，开启了你的一段成长。',
      tips: ['成就本身两句带过', '写成长前后的具体行为差异', '避免“从那以后我变得更自信了”'] },
    { id: 'ca6', org: 'Common App', title: '让你忘记时间的事', dims: ['ap', 'essay'],
      en: 'Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time.',
      zh: '一个让你着迷到忘记时间的话题、想法或概念。',
      tips: ['最适合学术型申请者', '写出你钻研时的具体动作', '让别人读完也想查一下'] },
    { id: 'ca7', org: 'Common App', title: '自由选题', dims: ['essay'],
      en: 'Share an essay on any topic of your choice.',
      zh: '任何你想写的题目。',
      tips: ['自由题最容易写散，先定一句话主题', '用一个场景开头，不要用道理开头', '写完后删掉第一段试试'] },
    { id: 'uc1', org: 'UC PIQ', title: '领导力经验', dims: ['act'],
      en: 'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes, or contributed to group efforts over time.',
      zh: '描述一次你正面影响他人、解决分歧或长期贡献于团队的经历。',
      tips: ['定义你理解的领导力', '写你具体做了什么决定', '给一个可验证的结果'] },
    { id: 'uc2', org: 'UC PIQ', title: '创造力', dims: ['act', 'ap'],
      en: 'Every person has a creative side, and it can be expressed in many ways.',
      zh: '每个人都有一个有创造力的一面，可以以很多方式表达。',
      tips: ['不要局限于艺术', '写创作过程中被砍掉的想法', '展示你的审美判断'] },
    { id: 'uc4', org: 'UC PIQ', title: '教育机会或障碍', dims: ['gpa', 'essay'],
      en: 'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.',
      zh: '你如何利用了一个重要的教育机会，或克服了某个教育障碍。',
      tips: ['具体到课程、项目、资源', '写你主动争取的部分', '不要卖惨，要写行动'] },
    { id: 'uc6', org: 'UC PIQ', title: '学术兴趣', dims: ['ap', 'comp'],
      en: 'Think about an academic subject that inspires you. Describe how you have furthered this interest inside and outside the classroom.',
      zh: '一个启发你的学科，以及你如何在课内外深化这个兴趣。',
      tips: ['列出你读过的具体材料', '写一次你被推翻的理解', '连接到你想学的专业'] },
    { id: 'why-major', org: 'Supplement', title: 'Why Major', dims: ['ap', 'comp'],
      en: 'Why do you want to study this major, and what have you already done about it?',
      zh: '你为什么想学这个专业？你已经为此做过什么？',
      tips: ['用一件具体的事开头，别用定义开头', '证明你了解这个领域的分支', '说清你还没解决的问题'] },
    { id: 'why-school', org: 'Supplement', title: 'Why School', dims: ['act', 'essay'],
      en: 'Why are you applying to this specific school?',
      zh: '为什么是这所学校？',
      tips: ['至少两个只有这所学校才有的资源', '把课程名、教授、实验室写具体', '说明你能给学校带来什么'] }
  ];

  /* ---------------- 示例档案 ---------------- */
  const SAMPLES = {
    t30: {
      label: 'T30 申请者',
      profile: {
        gpa: { scale: '4', value: 3.91, rigor: 'ap_std', rank: 'top5', trend: 'up' },
        test: { sat: 1540, act: null, toefl: 112, ielts: null },
        aps: [
          { subject: 'Calculus BC', score: 5 }, { subject: 'Physics 1', score: 4 },
          { subject: 'Computer Science A', score: 5 }, { subject: 'Psychology', score: 5 },
          { subject: 'English Language', score: 4 }
        ],
        comps: [
          { name: 'AMC 12 前 1%', subject: 'math', tierId: 'a' },
          { name: '省科创一等奖', subject: 'research', tierId: 'bplus' },
          { name: '市物理竞赛一等奖', subject: 'physics', tierId: 'b' }
        ],
        acts: [
          { name: '校园水质监测项目', type: 'research', tierId: 'ad' },
          { name: '天文社社长', type: 'leadership', tierId: 'ae' },
          { name: '社区科普志愿', type: 'service', tierId: 'af' }
        ],
        essay: {
          checks: { unique: 7, detail: 7, reflect: 7, fit: 7, voice: 7, revise: 6 },
          rec: { academic: 7, counselor: 7, extra: 5, detail: 6 },
          interview: { prep: 6, story: 5, thirdParty: false },
          text: ''
        }
      }
    },
    ivy: {
      label: '藤校卷王',
      profile: {
        gpa: { scale: '4', value: 3.97, rigor: 'ap_heavy', rank: 'top1', trend: 'up' },
        test: { sat: 1580, act: null, toefl: 118, ielts: null },
        aps: [
          { subject: 'Calculus BC', score: 5 }, { subject: 'Physics C: Mechanics', score: 5 },
          { subject: 'Computer Science A', score: 5 }, { subject: 'Chemistry', score: 5 },
          { subject: 'English Language', score: 4 }, { subject: 'US History', score: 5 },
          { subject: 'Statistics', score: 5 }
        ],
        comps: [
          { name: 'IMO 银牌', subject: 'math', tierId: 's' },
          { name: 'ISEF 二等奖', subject: 'research', tierId: 'aplus' },
          { name: 'AMC 12 前 1%', subject: 'math', tierId: 'a' }
        ],
        acts: [
          { name: 'AI 辅助听障手语翻译项目', type: 'research', tierId: 'as' },
          { name: '校内编程社', type: 'leadership', tierId: 'ad' },
          { name: '周末社区支教', type: 'service', tierId: 'af' }
        ],
        essay: {
          checks: { unique: 9, detail: 8, reflect: 9, fit: 9, voice: 8, revise: 8 },
          rec: { academic: 9, counselor: 8, extra: 7, detail: 9 },
          interview: { prep: 8, story: 7, thirdParty: true },
          text: ''
        }
      }
    },
    stem: {
      label: '竞赛偏科天才',
      profile: {
        gpa: { scale: '4', value: 3.62, rigor: 'ap_heavy', rank: 'top10', trend: 'flat' },
        test: { sat: 1540, act: null, toefl: 108, ielts: null },
        aps: [
          { subject: 'Calculus BC', score: 5 }, { subject: 'Physics C: Mechanics', score: 5 },
          { subject: 'Physics C: E&M', score: 5 }, { subject: 'Computer Science A', score: 5 },
          { subject: 'Chemistry', score: 4 }, { subject: 'Statistics', score: 5 }
        ],
        comps: [
          { name: 'IMO 铜牌', subject: 'math', tierId: 'aplus' },
          { name: '物理碗金奖', subject: 'physics', tierId: 'a' },
          { name: 'ISEF 入围', subject: 'research', tierId: 'bplus' }
        ],
        acts: [
          { name: '校内天文观测小组', type: 'research', tierId: 'ae' },
          { name: '数学建模社', type: 'leadership', tierId: 'ag' }
        ],
        essay: {
          checks: { unique: 6, detail: 5, reflect: 5, fit: 6, voice: 5, revise: 4 },
          rec: { academic: 6, counselor: 5, extra: 4, detail: 5 },
          interview: { prep: 5, story: 4, thirdParty: false },
          text: ''
        }
      }
    },
    humanities: {
      label: '文科文艺青年',
      profile: {
        gpa: { scale: '4', value: 3.88, rigor: 'ap_std', rank: 'top5', trend: 'up' },
        test: { sat: 1520, act: null, toefl: 114, ielts: null },
        aps: [
          { subject: 'English Literature', score: 5 }, { subject: 'Psychology', score: 5 },
          { subject: 'US Government & Politics', score: 4 }, { subject: 'Biology', score: 3 },
          { subject: 'World History', score: 5 }
        ],
        comps: [
          { name: 'NYT 写作竞赛获奖', subject: 'writing', tierId: 'a' },
          { name: '省作文一等奖', subject: 'writing', tierId: 'bplus' },
          { name: 'NHSDLC 全国 16 强', subject: 'debate', tierId: 'b' }
        ],
        acts: [
          { name: '校刊《回声》主编', type: 'media', tierId: 'ad' },
          { name: '话剧社年度原创剧', type: 'arts', tierId: 'ad' },
          { name: '城市口述史计划', type: 'service', tierId: 'ac' }
        ],
        essay: {
          checks: { unique: 9, detail: 9, reflect: 9, fit: 8, voice: 9, revise: 8 },
          rec: { academic: 8, counselor: 8, extra: 6, detail: 7 },
          interview: { prep: 7, story: 6, thirdParty: false },
          text: ''
        }
      }
    },
    average: {
      label: '普通高中生',
      profile: {
        gpa: { scale: '4', value: 3.45, rigor: 'ap_light', rank: 'top25', trend: 'flat' },
        test: { sat: 1380, act: null, toefl: 98, ielts: null },
        aps: [{ subject: 'Calculus AB', score: 4 }, { subject: 'Psychology', score: 4 }, { subject: 'Computer Science A', score: 3 }],
        comps: [
          { name: '市科创二等奖', subject: 'research', tierId: 'c' },
          { name: '校学科竞赛一等奖', subject: 'math', tierId: 'c' }
        ],
        acts: [
          { name: '班级学习委员', type: 'leadership', tierId: 'af' },
          { name: '校篮球队', type: 'sports', tierId: 'ag' },
          { name: '社区图书馆志愿者', type: 'service', tierId: 'ag' }
        ],
        essay: {
          checks: { unique: 6, detail: 5, reflect: 5, fit: 6, voice: 5, revise: 5 },
          rec: { academic: 5, counselor: 5, extra: 0, detail: 4 },
          interview: { prep: 4, story: 3, thirdParty: false },
          text: ''
        }
      }
    }
  };

  /* ---------------- 版本与更新日志 ---------------- */
  /* 毕业生对照开关：拿到真实学校数据前先关闭，代码与示例数据保留 */
  const COHORT_ENABLED = false;

  const VERSION = '1.3.1';
  const CHANGELOG = [
    {
      version: '1.3.1', date: '2026-11-24', title: '修复隐藏控件与缓存',
      items: [
        '修复「毕业生」关闭后雷达图的「届别」下拉仍然显示的问题（CSS 覆盖了 hidden）',
        '给 CSS / JS 引用加版本号，更新后浏览器不会混用旧脚本；以后每次发版改这个号',
        '单文件版同步更新'
      ]
    },
    {
      version: '1.3.0', date: '2026-11-24', title: '去向推测与案例相似度',
      items: [
        '新增「去向推测」：把深国交 2025 官方喜报按藤校 & Top10 / Top30 / Top50 分档，并给出届别水平区间',
        '只做档位分布与区间推测，不假装知道每个学生的六维；目前只有 1 所样本，暂不做大湾区平均',
        '新增「录取案例」：可手动录入匿名案例，计算与你六维的相似度和逐维差距（只存本机）',
        '新增「数据来源」区块，列官方链接与口径说明'
      ]
    },
    {
      version: '1.2.0', date: '2026-11-24', title: '暂时关闭毕业生对照',
      items: [
        '隐藏「毕业生」入口、年度对比和雷达届别图层：公开数据只有去向 / offer 数，没有六维均分',
        '代码和示例数据保留在 data.js，拿到真实升学数据后把 COHORT_ENABLED 改为 true 即可恢复',
        '首页不再显示「vs 某届平均」的示例对比'
      ]
    },
    {
      version: '1.1.1', date: '2026-11-24', title: '数据来源标注',
      items: [
        '毕业生五届数据明确标注为「虚构演示数据」，不是任何真实学校',
        '新增数据来源说明：哪些是官方数据、哪些是模型估算、哪些是示例',
        '编辑或新增一届后会自动去掉「演示数据」标记'
      ]
    },
    {
      version: '1.1.0', date: '2026-11-24', title: '成长快照与下一步',
      items: [
        '新增「成长记录」：一键保存当前画像，和上一次对比综合战力与六维变化',
        '新增「下一步」清单：从提分建议里挑收益最高的三件事，可勾选完成',
        '新增存档导出 / 导入（JSON），换电脑或换浏览器可带走全部数据',
        '跨平台适配：macOS / Windows 字体与暗色控件、Safari 存储与下载兼容'
      ]
    },
    {
      version: '1.0.0', date: '2026-11-24', title: '官方录取画像',
      items: [
        '新增 14 所学校的官方录取画像（GPA / SAT / ACT 区间 + 官方来源链接），和模型画像分开展示',
        '版本号写进顶栏与页脚，新增这份更新日志',
        '明确区分「官方数据」和「六维模型翻译」，避免把估算当成官方口径'
      ]
    },
    {
      version: '0.9.0', date: '2026-11-12', title: '梦校、关键词与背景',
      items: [
        '大学库扩到 68 所，覆盖 QS 前 100 里的美国校和常见强校',
        '雷达图最多同时叠加 4 所梦校，选校区新增梦校对比条',
        '每所学校新增 5 个关键词：专业强项 / 招生偏好 / 气质',
        '新增背景加成：绿卡、美高、第一代、校友、体育特招、助学金',
        '第六维从「文书」改为「材料」：文书 50% + 推荐信 35% + 面试 15%',
        '竞赛 / 活动改为档位直接给分；每维支持「没有这项」和「预估区间」'
      ]
    },
    {
      version: '0.8.0', date: '2026-11-12', title: '第一个可用版本',
      items: [
        '六维录入、雷达图、选校匹配、只申 8 所清单',
        '毕业生对照、文书工坊、可自定义评分表'
      ]
    }
  ];

  /* ---------------- 去向样本与档位 ----------------
     只放可核对来源的官方喜报；offer 数 ≠ 人数，页面必须标注口径。 */
  const DEST_TIERS = [
    { key: 'top10', label: '藤校 & Top10', weight: 100, color: '#fbbf24' },
    { key: 'top30', label: 'Top30', weight: 85, color: '#7dd3fc' },
    { key: 'top50', label: 'Top50', weight: 70, color: '#6ee7b7' },
    { key: 'below50', label: 'Top50 以外', weight: 55, color: '#64708a' }
  ];

  const DEST_SAMPLES = [
    {
      id: 'scie-2025',
      school: '深圳国际交流书院（深国交）',
      short: '深国交',
      region: '深圳 · 大湾区',
      year: 2025,
      cohort: '450+',
      published: '2025-05-16',
      sourceName: '深国交官网《英美全能｜2025 深国交全球本科录取》',
      sourceUrl: 'https://www.alevel.com.cn/news/3019/',
      us: {
        applicants: 210,
        top10: { students: 17, offers: 18, share: 17 / 210 },
        top30: { offers: 254, share: 0.65 },
        top50: { offers: 666, share: 0.95 }
      },
      uk: {
        applicants: 330,
        oxbridge: { students: 41, share: 41 / 330 },
        g5: { offers: 409, share: 0.70 },
        top10: { offers: 859, share: 0.95 }
      },
      hk: { students: 77, top3Share: 0.95, offers: 97 },
      note: '官方口径：截至 2025-05-15，450 余名毕业生获 2000 多份录取；美国方向 210 余人，17 名同学获 18 枚藤校 & Top10，65% 获 Top30，95% 获 Top50。'
    }
  ];

  /* ---------------- 官方录取画像（约值，以官方页面为准） ----------------
     来自各校 Common Data Set / UC 官方 admissions profile；
     和 SCHOOLS.dims 的六维模型画像分开，不混用。 */
  const SCHOOL_FACTS = {
    mit: { year: '2024–25', gpa: '3.9–4.0', sat: '1520–1580', act: '34–36', src: 'https://mitadmissions.org/apply/process/profile/' },
    harvard: { year: '2024–25', gpa: '3.9–4.0', sat: '1500–1580', act: '34–36', src: 'https://college.harvard.edu/admissions/admissions-statistics' },
    stanford: { year: '2024–25', gpa: '3.9–4.0', sat: '1510–1580', act: '34–36', src: 'https://admission.stanford.edu/apply/selection/profile.html' },
    yale: { year: '2024–25', gpa: '3.9–4.0', sat: '1500–1580', act: '34–36', src: 'https://admissions.yale.edu/class-profile' },
    princeton: { year: '2024–25', gpa: '3.9–4.0', sat: '1500–1580', act: '34–36', src: 'https://admission.princeton.edu/how-apply/admission-stats' },
    columbia: { year: '2024–25', gpa: '3.9–4.0', sat: '1500–1570', act: '34–36', src: 'https://undergrad.admissions.columbia.edu/apply/class-profile' },
    uchicago: { year: '2024–25', gpa: '3.9–4.0', sat: '1510–1570', act: '34–36', src: 'https://collegeadmissions.uchicago.edu/apply/class-profile' },
    caltech: { year: '2024–25', gpa: '3.9–4.0', sat: '1530–1580', act: '35–36', src: 'https://www.admissions.caltech.edu/apply/first-year-applicants/class-profile' },
    berkeley: { year: '2024–25', gpa: '4.15–4.30（加权）', sat: 'Test-Blind', act: '—', src: 'https://admissions.berkeley.edu/student-profile/' },
    ucla: { year: '2024–25', gpa: '4.20–4.30（加权）', sat: 'Test-Blind', act: '—', src: 'https://admission.ucla.edu/apply/freshman/profile' },
    ucsd: { year: '2024–25', gpa: '4.05–4.25（加权）', sat: 'Test-Blind', act: '—', src: 'https://admissions.ucsd.edu/apply/freshman-profile/' },
    nyu: { year: '2024–25', gpa: '3.7–4.0', sat: '1470–1570', act: '33–35', src: 'https://www.nyu.edu/admissions/undergraduate-admissions/apply/class-profile.html' },
    usc: { year: '2024–25', gpa: '3.7–4.0', sat: '1450–1550', act: '32–35', src: 'https://admission.usc.edu/apply/class-profile/' },
    umich: { year: '2024–25', gpa: '3.7–4.0', sat: '1350–1530', act: '31–34', src: 'https://admissions.umich.edu/apply/freshmen-applicants/student-profile' }
  };

  root.ADMIT_DATA = {
    DIMS, GLOBAL_WEIGHTS, SHORT_NAMES,
    AP_SUBJECTS, AP_SCORE_POINTS,
    COMP_SUBJECTS, COMP_TIERS,
    ACT_TYPES, ACT_TIERS,
    GPA_ANCHORS_4, GPA_ANCHORS_100, SAT_ANCHORS, ACT_ANCHORS, TOEFL_ANCHORS, IELTS_ANCHORS,
    GPA_RIGOR, GPA_RANK, GPA_TREND,
    ESSAY_CHECKS, REC_CHECKS, INTERVIEW_CHECKS, MATERIAL_WEIGHTS,
    BG_FACTORS, SCHOOL_INTL, NEED_BLIND_INTL, D1_SCHOOLS, SCHOOL_KEYWORDS, SCHOOL_FACTS,
    DEST_TIERS, DEST_SAMPLES,
    VERSION, CHANGELOG, COHORT_ENABLED,
    SCHOOLS, COHORTS, PROMPTS, SAMPLES
  };
})(typeof window !== 'undefined' ? window : globalThis);
