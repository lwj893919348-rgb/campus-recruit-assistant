export const APPLICATION_STAGES = [
  {
    key: 'wishlist',
    label: '待投递/收藏',
    shortLabel: '待投递',
    next: 'applied',
    badgeClass: 'bg-slate-100/80 text-slate-700 border-slate-200/80',
    columnBg: 'bg-slate-100/65 border-slate-200/75',
    dotClass: 'bg-slate-400',
    barClass: 'bg-slate-300',
  },
  {
    key: 'applied',
    label: '已投递',
    shortLabel: '已投递',
    next: 'assessment',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    columnBg: 'bg-sky-50/60 border-sky-200/70',
    dotClass: 'bg-sky-500',
    barClass: 'bg-sky-400',
  },
  {
    key: 'assessment',
    label: '测评/笔试',
    shortLabel: '笔试中',
    next: 'interview',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    columnBg: 'bg-amber-50/55 border-amber-200/70',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-400',
  },
  {
    key: 'interview',
    label: '面试中',
    shortLabel: '面试中',
    next: 'offer',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
    columnBg: 'bg-violet-50/55 border-violet-200/70',
    dotClass: 'bg-violet-500',
    barClass: 'bg-violet-400',
  },
  {
    key: 'offer',
    label: '已拿 Offer',
    shortLabel: 'Offer',
    next: null,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
    columnBg: 'bg-emerald-50/65 border-emerald-200/75',
    dotClass: 'bg-emerald-500',
    barClass: 'bg-emerald-500',
  },
  {
    key: 'rejected',
    label: '已婉拒/终止',
    shortLabel: '已终止',
    next: null,
    badgeClass: 'bg-rose-50/80 text-rose-700 border-rose-200/75',
    columnBg: 'bg-rose-50/45 border-rose-200/60',
    dotClass: 'bg-rose-400',
    barClass: 'bg-rose-300',
  },
];

export const STAGE_MAP = Object.fromEntries(APPLICATION_STAGES.map((s) => [s.key, s]));

export const REGION_GROUPS = [
  { id: '全部', label: '全部地区', cities: [] },
  { id: '一线城市', label: '一线城市 (北上广深)', cities: ['北京', '上海', '深圳', '广州'] },
  {
    id: '新一线',
    label: '新一线热门城市',
    cities: ['杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '重庆', '合肥', '天津', '宁波', '东莞', '佛山', '青岛', '郑州', '沈阳', '无锡', '昆明', '福州'],
  },
  {
    id: '省会及重点城市',
    label: '区域核心/产业基地',
    cities: [
      '珠海', '厦门', '宁德', '济南', '烟台', '惠州', '芜湖', '连云港', '宜昌', '株洲',
      '绍兴', '徐州', '泉州', '潍坊', '南阳', '呼和浩特', '潮州', '上饶', '丹阳', '哈尔滨',
    ],
  },
  { id: '其他/海外', label: '全国多地/海外', cities: ['全国多地', '海外'] },
];

export const RECRUIT_TYPE_OPTIONS = ['全部', '校园招聘', '社会招聘', '实习兼职'];

export const EXPERIENCE_OPTIONS = [
  '全部',
  '应届毕业生',
  '在校实习生',
  '不限/1年以内',
  '1-3年',
  '3-5年',
  '5年以上',
];

export const SEASON_OPTIONS = [
  '全部',
  '2027届秋招',
  '2027届秋招补录',
  '2027届春招提前批',
  '2026届春招补录',
  '2028届暑期实习',
  '日常实习',
  '社招常年热招',
  '2026-2027社招急聘',
  '高阶专家/资深社招',
];

export const GRAD_YEAR_OPTIONS = ['全部', '2026', '2027', '2028', '社招不限'];

export const COMPANY_TYPE_OPTIONS = [
  '全部',
  '大厂科技',
  '独角兽/名企',
  '初创/融资企业',
  '硬科技名企',
  '专精特新/科创上市',
  '软件与信创服务',
  '半导体芯片',
  '新能源车企',
  '先进制造',
  '生物医药健康',
  '消费零售与物流',
  '国央企',
  '金融机构',
  '外企名企',
];

export const STARTUP_ENTITY_PRESETS = [
  '初创/融资企业 · 种子/天使轮',
  '初创/融资企业 · Pre-A/A轮融资',
  '初创/融资企业 · B轮及以上高成长',
  '初创/融资企业 · 高校科研孵化',
  '初创/融资企业 · 拟IPO准独角兽',
];

export const JOB_CATEGORY_OPTIONS = [
  '全部',
  '技术研发',
  '算法AI',
  '测试运维',
  '数据商业分析',
  '产品设计',
  '运营市场',
  '销售商务',
  '硬件工程',
  '金融风控',
  '供应链制造',
  '新能源化工',
  '生物医药',
  '财务审计',
  '法务合规',
  '人力行政',
  '职能管培',
];

export const RESUME_TEMPLATES = [
  {
    id: 'tech-minimal',
    name: '极简技术单栏',
    badge: 'ATS 最友好',
    desc: '经典黑白灰+主色细线单栏，高可读性，大厂研发/算法/测试校招首选。',
  },
  {
    id: 'modern-dual',
    name: '现代双栏紧凑',
    badge: '一页装更多',
    desc: '左侧信息栏+右侧核心经历，结构分明，适合实习与项目丰富的复合同学。',
  },
  {
    id: 'formal-soe',
    name: '国央企/金融稳重',
    badge: '含政治面貌/证件照',
    desc: '突出籍贯、政治面貌、英语等级与院校背景，贴合国企、银行与管培网申风格。',
  },
  {
    id: 'creative-product',
    name: '产品/运营亮色风',
    badge: '重点高亮',
    desc: '顶部质感色块+能力标签卡片，突出产品思维、用户增长与数据成果。',
  },
];

export const RESUME_THEME_COLORS = [
  { name: '科技蓝', value: '#2563EB' },
  { name: '深邃藏青', value: '#1E3A8A' },
  { name: '墨玉绿', value: '#047857' },
  { name: '石墨黑', value: '#0F172A' },
  { name: '典雅紫', value: '#4F46E5' },
];

export const RESUME_SECTION_LABELS = {
  education: '教育背景',
  internship: '工作与实习经历',
  projects: '项目经历',
  skills: '专业技能',
  campus: '校园与科研经历',
  awards: '荣誉与证书',
  summary: '个人总结',
};

export const STAR_ACTION_VERBS = [
  '主导设计并落地',
  '独立负责核心模块',
  '重构并优化链路性能',
  '搭建自动化监控体系',
  '协同跨部门推进上线',
  '基于数据分析定位瓶颈',
];

export const STAR_EXAMPLE_SNIPPETS = [
  '针对【具体业务痛点/高并发瓶颈】，设计并实现【核心技术方案/策略】，使【核心指标如耗时/转化率】提升【XX%】。',
  '负责【模块名称】从 0 到 1 研发与上线，引入【关键技术/工具】，累计服务【XX】用户并稳定运行零故障。',
  '独立完成【XX万条】数据的清洗、特征工程与可视化分析，输出【研究/业务报告】，有效支撑团队决策。',
];

export function formatEventCountdown(dateTimeStr) {
  if (!dateTimeStr) return null;
  const target = new Date(dateTimeStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < -12) return { text: '已过时间', tone: 'muted' };
  if (diffHours <= 24 && diffHours >= -12) return { text: '24小时内', tone: 'urgent' };
  if (diffDays <= 3) return { text: `${diffDays}天后`, tone: 'warning' };
  return { text: `${diffDays}天后`, tone: 'normal' };
}

export const JOB_SORT_OPTIONS = [
  { value: 'latest', label: '综合 / 最新发布优先' },
  { value: 'deadline', label: '临近截止日期优先' },
];

export const SYNC_SOURCE_META = {
  ats_auto: { label: '官网 ATS 自动同步', isLiveAts: true },
  beisen_zhiye: { label: '北森 ATS 官网直抓', isLiveAts: true },
  hotjob_wecruit: { label: '大易 HotJob 官网直抓', isLiveAts: true },
  greenhouse: { label: 'Greenhouse 官网接口', isLiveAts: true },
  lever: { label: 'Lever 官网接口', isLiveAts: true },
  ashby: { label: 'Ashby 官网接口', isLiveAts: true },
  rss_atom: { label: 'RSS 订阅同步', isLiveAts: false },
  json_feed: { label: 'JSON Feed 同步', isLiveAts: false },
  html_jsonld: { label: '官网结构化页面', isLiveAts: false },
  batch_import: { label: '批量/公告导入', isLiveAts: false },
  user_submitted: { label: '手动补充收录', isLiveAts: false },
  verified_registry: { label: '官方入口方向参考', isLiveAts: false },
};

export const PRIORITY_OPTIONS = [
  { value: 'high', label: '高优冲刺', badgeClass: 'border-rose-200 bg-rose-50 text-rose-700' },
  { value: 'normal', label: '常规投递', badgeClass: 'border-teal-200/80 bg-teal-50/75 text-teal-800' },
  { value: 'low', label: '保底备选', badgeClass: 'border-slate-200 bg-slate-100 text-slate-600' },
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITY_OPTIONS.map((p) => [p.value, p]));

export function formatShortDate(isoStr = '') {
  const clean = String(isoStr || '').trim();
  if (!clean) return '近期';
  const match = clean.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : clean.slice(0, 10);
}
