export const APPLICATION_STAGES = [
  {
    key: 'wishlist',
    label: '待投递/收藏',
    shortLabel: '待投递',
    next: 'applied',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    columnBg: 'bg-slate-50/80 border-slate-200/80',
    dotClass: 'bg-slate-400',
  },
  {
    key: 'applied',
    label: '已投递',
    shortLabel: '已投递',
    next: 'assessment',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    columnBg: 'bg-blue-50/40 border-blue-200/60',
    dotClass: 'bg-blue-500',
  },
  {
    key: 'assessment',
    label: '测评/笔试',
    shortLabel: '笔试中',
    next: 'interview',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    columnBg: 'bg-amber-50/40 border-amber-200/60',
    dotClass: 'bg-amber-500',
  },
  {
    key: 'interview',
    label: '面试中',
    shortLabel: '面试中',
    next: 'offer',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    columnBg: 'bg-indigo-50/40 border-indigo-200/60',
    dotClass: 'bg-indigo-500',
  },
  {
    key: 'offer',
    label: '已拿 Offer',
    shortLabel: 'Offer',
    next: null,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    columnBg: 'bg-emerald-50/40 border-emerald-200/70',
    dotClass: 'bg-emerald-500',
  },
  {
    key: 'rejected',
    label: '已婉拒/终止',
    shortLabel: '已终止',
    next: null,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    columnBg: 'bg-rose-50/30 border-rose-200/60',
    dotClass: 'bg-rose-400',
  },
];

export const STAGE_MAP = Object.fromEntries(APPLICATION_STAGES.map((s) => [s.key, s]));

export const REGION_GROUPS = [
  { id: '全部', label: '全部地区', cities: [] },
  { id: '一线城市', label: '一线城市 (北上广深)', cities: ['北京', '上海', '深圳', '广州'] },
  {
    id: '新一线',
    label: '新一线热门城市',
    cities: ['杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '重庆', '合肥', '天津', '宁波', '东莞', '佛山', '青岛', '郑州'],
  },
  { id: '省会及重点城市', label: '区域核心/工业基地', cities: ['珠海', '厦门', '宁德', '济南'] },
  { id: '其他/海外', label: '全国多地/海外', cities: ['全国多地', '海外'] },
];

export const SEASON_OPTIONS = [
  '全部',
  '2027届秋招',
  '2027届秋招补录',
  '2027届春招提前批',
  '2026届春招补录',
  '2028届暑期实习',
  '日常实习',
];

export const GRAD_YEAR_OPTIONS = ['全部', '2026', '2027', '2028'];

export const COMPANY_TYPE_OPTIONS = [
  '全部',
  '大厂科技',
  '独角兽/名企',
  '硬科技名企',
  '半导体芯片',
  '新能源车企',
  '先进制造',
  '国央企',
  '金融机构',
  '外企名企',
];

export const JOB_CATEGORY_OPTIONS = [
  '全部',
  '技术研发',
  '算法AI',
  '产品设计',
  '运营市场',
  '硬件工程',
  '金融风控',
  '供应链制造',
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
  internship: '实习经历',
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
