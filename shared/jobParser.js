/**
 * Shared pure job classification, city normalization, batch CSV/JSON parsing,
 * and zero-scraping WeChat Official Account announcement parser.
 * Used identically by Node backend (server/services/syncEngine.js) and
 * GitHub Pages static mode (client/src/api/localEngine.js).
 */

export const ALL_JOB_CATEGORIES = [
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

export const RECRUIT_TYPES = ['校园招聘', '社会招聘', '实习兼职'];

export const EXPERIENCE_LEVELS = [
  '应届毕业生',
  '在校实习生',
  '不限/1年以内',
  '1-3年',
  '3-5年',
  '5年以上',
];

export const CITY_PROVINCE_MAP = {
  北京: { province: '北京', tier: '一线城市' },
  上海: { province: '上海', tier: '一线城市' },
  深圳: { province: '广东', tier: '一线城市' },
  广州: { province: '广东', tier: '一线城市' },
  杭州: { province: '浙江', tier: '新一线' },
  成都: { province: '四川', tier: '新一线' },
  南京: { province: '江苏', tier: '新一线' },
  武汉: { province: '湖北', tier: '新一线' },
  西安: { province: '陕西', tier: '新一线' },
  苏州: { province: '江苏', tier: '新一线' },
  长沙: { province: '湖南', tier: '新一线' },
  重庆: { province: '重庆', tier: '新一线' },
  合肥: { province: '安徽', tier: '新一线' },
  宁波: { province: '浙江', tier: '新一线' },
  青岛: { province: '山东', tier: '新一线' },
  天津: { province: '天津', tier: '新一线' },
  郑州: { province: '河南', tier: '新一线' },
  东莞: { province: '广东', tier: '新一线' },
  佛山: { province: '广东', tier: '新一线' },
  无锡: { province: '江苏', tier: '新一线' },
  福州: { province: '福建', tier: '新一线' },
  沈阳: { province: '辽宁', tier: '新一线' },
  昆明: { province: '云南', tier: '新一线' },
  珠海: { province: '广东', tier: '省会及重点城市' },
  厦门: { province: '福建', tier: '省会及重点城市' },
  宁德: { province: '福建', tier: '省会及重点城市' },
  泉州: { province: '福建', tier: '省会及重点城市' },
  济南: { province: '山东', tier: '省会及重点城市' },
  烟台: { province: '山东', tier: '省会及重点城市' },
  潍坊: { province: '山东', tier: '省会及重点城市' },
  大连: { province: '辽宁', tier: '省会及重点城市' },
  长春: { province: '吉林', tier: '省会及重点城市' },
  哈尔滨: { province: '黑龙江', tier: '省会及重点城市' },
  南宁: { province: '广西', tier: '省会及重点城市' },
  石家庄: { province: '河北', tier: '省会及重点城市' },
  太原: { province: '山西', tier: '省会及重点城市' },
  南昌: { province: '江西', tier: '省会及重点城市' },
  上饶: { province: '江西', tier: '省会及重点城市' },
  贵阳: { province: '贵州', tier: '省会及重点城市' },
  海口: { province: '海南', tier: '省会及重点城市' },
  常州: { province: '江苏', tier: '省会及重点城市' },
  泰州: { province: '江苏', tier: '省会及重点城市' },
  徐州: { province: '江苏', tier: '省会及重点城市' },
  丹阳: { province: '江苏', tier: '省会及重点城市' },
  连云港: { province: '江苏', tier: '省会及重点城市' },
  南通: { province: '江苏', tier: '省会及重点城市' },
  扬州: { province: '江苏', tier: '省会及重点城市' },
  镇江: { province: '江苏', tier: '省会及重点城市' },
  温州: { province: '浙江', tier: '省会及重点城市' },
  嘉兴: { province: '浙江', tier: '省会及重点城市' },
  绍兴: { province: '浙江', tier: '省会及重点城市' },
  台州: { province: '浙江', tier: '省会及重点城市' },
  金华: { province: '浙江', tier: '省会及重点城市' },
  湖州: { province: '浙江', tier: '省会及重点城市' },
  芜湖: { province: '安徽', tier: '省会及重点城市' },
  惠州: { province: '广东', tier: '省会及重点城市' },
  潮州: { province: '广东', tier: '省会及重点城市' },
  中山: { province: '广东', tier: '省会及重点城市' },
  宜昌: { province: '湖北', tier: '省会及重点城市' },
  呼和浩特: { province: '内蒙古', tier: '省会及重点城市' },
  鄂尔多斯: { province: '内蒙古', tier: '省会及重点城市' },
  包头: { province: '内蒙古', tier: '省会及重点城市' },
  南阳: { province: '河南', tier: '省会及重点城市' },
  洛阳: { province: '河南', tier: '省会及重点城市' },
  株洲: { province: '湖南', tier: '省会及重点城市' },
  保山: { province: '云南', tier: '省会及重点城市' },
  楚雄: { province: '云南', tier: '省会及重点城市' },
  安康: { province: '陕西', tier: '省会及重点城市' },
  眉山: { province: '四川', tier: '省会及重点城市' },
  绵阳: { province: '四川', tier: '省会及重点城市' },
  宜宾: { province: '四川', tier: '省会及重点城市' },
  兰州: { province: '甘肃', tier: '省会及重点城市' },
  银川: { province: '宁夏', tier: '省会及重点城市' },
  西宁: { province: '青海', tier: '省会及重点城市' },
  乌鲁木齐: { province: '新疆', tier: '省会及重点城市' },
  拉萨: { province: '西藏', tier: '省会及重点城市' },
  香港: { province: '香港', tier: '其他/海外' },
  澳门: { province: '澳门', tier: '其他/海外' },
  台湾: { province: '台湾', tier: '其他/海外' },
  越南: { province: '海外', tier: '其他/海外' },
  新加坡: { province: '海外', tier: '其他/海外' },
  日本: { province: '海外', tier: '其他/海外' },
  美国: { province: '海外', tier: '其他/海外' },
  德国: { province: '海外', tier: '其他/海外' },
  泰国: { province: '海外', tier: '其他/海外' },
  马来西亚: { province: '海外', tier: '其他/海外' },
  印度尼西亚: { province: '海外', tier: '其他/海外' },
  全国多地: { province: '全国多地', tier: '其他/海外' },
  海外: { province: '海外', tier: '其他/海外' },
  远程: { province: '远程', tier: '其他/海外' },
};

export const KNOWN_CITY_NAMES = Object.keys(CITY_PROVINCE_MAP);
const KNOWN_CITY_NAMES_BY_LENGTH = [...KNOWN_CITY_NAMES].sort((a, b) => b.length - a.length);

const ADMIN_SUFFIX_RE = /(?:特别行政区|(?:彝族|藏族|蒙古族|土家族|苗族|布依族|回族|朝鲜族|哈萨克|白族|傣族|壮族|侗族|哈尼族|羌族|傈僳族|佤族|纳西族|景颇族|柯尔克孜|土族|锡伯|塔吉克|裕固|毛南|仡佬)*自治[州县区]|地区|盟)$/;
const VAGUE_CITY_RE = /^(?:全国|全国各地|不限|不限城市|多地|其他|未知|暂无|-+)$/i;

function stripCityAdminSuffix(token = '') {
  let t = String(token || '').trim();
  if (!t) return '';
  if (CITY_PROVINCE_MAP[t]) return t;
  t = t.replace(ADMIN_SUFFIX_RE, '');
  if (t.length > 2 && /[市县]$/.test(t) && !/全国多地|城市/.test(t)) {
    t = t.slice(0, -1);
  }
  return t.trim();
}

export function normalizeCityToken(cityInput = '') {
  const raw = String(cityInput || '').trim();
  if (!raw) return '';
  if (CITY_PROVINCE_MAP[raw]) return raw;
  if (VAGUE_CITY_RE.test(raw)) return '全国多地';
  if (/^(?:国外|海外多地|全球)$/i.test(raw)) return '海外';

  const withoutCountry = raw.replace(/^(?:中华人民共和国|中国)[\s·\-_/]+/, '').trim();
  const parts = withoutCountry
    .split(/[-/·,，、;；|\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return '';

  // Skip leading province segment for strings formatted as '福建省-福州市' or '山东省-烟台市-福山区'
  let primaryIdx = 0;
  if (parts.length > 1 && /省$/.test(parts[0])) {
    primaryIdx = 1;
  }

  const orderedParts = [parts[primaryIdx], ...parts.filter((_, idx) => idx !== primaryIdx)];
  for (const part of orderedParts) {
    const stripped = stripCityAdminSuffix(part);
    if (CITY_PROVINCE_MAP[stripped]) return stripped;
  }

  const primaryStripped = stripCityAdminSuffix(parts[primaryIdx]);
  for (const known of KNOWN_CITY_NAMES_BY_LENGTH) {
    if (known !== '全国多地' && (primaryStripped.includes(known) || withoutCountry.includes(known))) {
      return known;
    }
  }
  return primaryStripped || withoutCountry;
}

export function inferCityInfo(cityInput = '', fallbackText = '') {
  const cleanRaw = String(cityInput || '').trim();
  const normalized = normalizeCityToken(cleanRaw);
  if (normalized && CITY_PROVINCE_MAP[normalized] && normalized !== '全国多地') {
    return { city: normalized, ...CITY_PROVINCE_MAP[normalized] };
  }

  if (!cleanRaw || VAGUE_CITY_RE.test(cleanRaw)) {
    const fb = String(fallbackText || '');
    for (const cityName of KNOWN_CITY_NAMES_BY_LENGTH) {
      if (cityName !== '全国多地' && fb.includes(cityName)) {
        return { city: cityName, ...CITY_PROVINCE_MAP[cityName] };
      }
    }
    return { city: '全国多地', province: '全国多地', tier: '其他/海外' };
  }

  if (normalized === '全国多地') {
    return { city: '全国多地', province: '全国多地', tier: '其他/海外' };
  }

  return { city: normalized, province: normalized, tier: '省会及重点城市' };
}

export function inferCityTier(cityInput = '') {
  return inferCityInfo(cityInput).tier;
}

export function normalizeJobLocation(cityInput = '', provinceInput = '') {
  const rawCity = String(cityInput || '').trim();
  const rawProvince = String(provinceInput || '').trim();
  const info = inferCityInfo(rawCity);
  const province =
    info.province !== info.city
      ? info.province
      : rawProvince && rawProvince !== rawCity
        ? rawProvince
        : info.province;
  return {
    city: info.city,
    province,
    city_tier: info.tier,
  };
}

export function inferCategory(title = '', fallbackText = '') {
  const t = `${String(title || '')} ${String(fallbackText || '')}`;
  const primary = String(title || '');

  for (const cat of ALL_JOB_CATEGORIES) {
    if (primary.includes(cat)) return cat;
  }

  if (/生物|医药|临床|药理|药物|CRA|CRC|医疗器械|基因|制药|药师|医学|生命科学/i.test(primary)) return '生物医药';
  if (/财务|会计|审计|税务|出纳|注会|CPA|资金结算|预算|内审|并购审计/i.test(primary)) return '财务审计';
  if (/法务|合规|律师|知识产权|专利|契约|民商事|反垄断|证券合规/i.test(primary)) return '法务合规';
  if (/新能源|锂电|电芯|电池|光伏|储能|化工|正极|负极|电解液|氢能|材料研发|热管理工艺/i.test(primary)) {
    return '新能源化工';
  }
  if (/算法|大模型|AI|机器学习|视觉|NLP|推荐|SLAM|感知|具身智能|DeepSeek|多模态|强化学习/i.test(primary)) {
    return '算法AI';
  }
  if (/测试|QA|SDET|运维|SRE|DevOps|渗透|网安|安全工程|性能测试|自动化测试|技术支持/i.test(primary)) {
    return '测试运维';
  }
  if (
    /数据科学|数据分析|商业分析|BI|数仓|ETL|SQL分析|策略分析|经营分析|Data\s*(?:Scientist|Analyst|Engineer)|Business\s+Analyst/i.test(
      primary,
    )
  ) {
    return '数据商业分析';
  }
  if (/人力|HR|HRBP|招聘|薪酬|绩效|员工关系|组织发展|行政管理|行政专员|董办|Recruiter|Talent\s+Acquisition/i.test(primary)) {
    return '人力行政';
  }
  if (/销售|客户经理|商务拓展|BD|大客户|政企|渠道|售前|解决方案专家|Ka|外贸|跨境销售|门店扩展|Account\s+Executive|Sales/i.test(primary)) {
    return '销售商务';
  }
  if (
    /产品|策划|交互|UI|UX|用研|设计师|视觉设计|\bProduct\s+(?:Manager|Designer|Lead|Owner)\b|\b(?:UI|UX|Visual|Brand|Graphic)?\s*Designer\b/i.test(
      primary,
    )
  ) {
    return '产品设计';
  }
  if (/运营|市场|营销|推广|品牌|公关|增长|新媒体|内容|投放|媒介|活动|电商|Marketing|Growth\s+Lead/i.test(primary)) {
    return '运营市场';
  }
  if (/金融|投行|基金|风控|证券|信贷|精算|财富|行研|行长助理|交易员|柜员|承销|固收/i.test(primary)) {
    return '金融风控';
  }
  if (/硬件|嵌入式|FPGA|IC|芯片|射频|天线|机械|结构|电路|BMS|电控|电机|电源|声学|光学|驱动开发|版图|Hardware|Embedded/i.test(primary)) {
    return '硬件工程';
  }
  if (/供应链|采购|物流|制造|IE|工艺|品控|质量|生产|计划|仓储|关务|PMC|调度/i.test(primary)) {
    return '供应链制造';
  }
  if (/管培|职能|战略|综合管理|储备|门店管理|店长|营运/i.test(primary)) return '职能管培';
  if (
    /开发|研发|后端|前端|全栈|Java|Go|C\+\+|Python|Rust|客户端|iOS|Android|架构师|鸿蒙|系统工程|云计算|Software|Engineer|Developer/i.test(
      t,
    )
  ) {
    return '技术研发';
  }
  return '技术研发';
}

export function inferRecruitTypeAndExp({
  title = '',
  seasonTag = '',
  recruitType = '',
  experienceReq = '',
  graduationYears = null,
  contextText = '',
} = {}) {
  const cleanType = RECRUIT_TYPES.includes(String(recruitType).trim()) ? String(recruitType).trim() : '';
  const cleanExp = EXPERIENCE_LEVELS.includes(String(experienceReq).trim())
    ? String(experienceReq).trim()
    : '';
  const combined = `${title} ${seasonTag} ${contextText}`;

  let resolvedType = cleanType;
  if (!resolvedType) {
    if (/社招|社会招聘|在职人才|社会人士|experienced/i.test(combined) && !/仅限应届/.test(combined)) {
      resolvedType = '社会招聘';
    } else if (/实习|兼职|暑期实习|日常实习|实习生|intern/i.test(combined)) {
      resolvedType = '实习兼职';
    } else if (/校招|校园招聘|应届|秋招|春招|2026届|2027届|2028届|管培生/i.test(combined)) {
      resolvedType = '校园招聘';
    } else if (/1-3年|3-5年|5年以上|\d年以上工作经验|资深专家|技术专家|总监|经理/i.test(combined)) {
      resolvedType = '社会招聘';
    } else {
      resolvedType = '校园招聘';
    }
  }

  let resolvedExp = cleanExp;
  if (!resolvedExp) {
    if (resolvedType === '实习兼职' || /实习生|在校生/i.test(combined)) {
      resolvedExp = '在校实习生';
    } else if (/5年以上|5-10年|8年以上|10年|资深架构|总监/i.test(combined)) {
      resolvedExp = '5年以上';
    } else if (/3-5年|3年以上|4年经验/i.test(combined)) {
      resolvedExp = '3-5年';
    } else if (/1-3年|1年以上|2年经验|2年以上/i.test(combined)) {
      resolvedExp = '1-3年';
    } else if (resolvedType === '社会招聘') {
      resolvedExp = /经验不限|不限|1年以内/i.test(combined) ? '不限/1年以内' : '1-3年';
    } else {
      resolvedExp = '应届毕业生';
    }
  }

  let resolvedSeason = String(seasonTag || '').trim();
  if (!resolvedSeason) {
    if (resolvedType === '社会招聘') {
      resolvedSeason = resolvedExp === '5年以上' ? '高阶专家/资深社招' : '2026-2027社招急聘';
    } else if (resolvedType === '实习兼职') {
      resolvedSeason = /暑期/.test(combined) ? '2028届暑期实习' : '日常实习';
    } else {
      resolvedSeason = '2027届秋招补录';
    }
  }

  let resolvedYears = Array.isArray(graduationYears) && graduationYears.length > 0 ? graduationYears : null;
  if (!resolvedYears) {
    if (resolvedType === '社会招聘') {
      resolvedYears = ['社招不限'];
    } else {
      const detected = [];
      for (const y of ['2026', '2027', '2028']) {
        if (combined.includes(y)) detected.push(y);
      }
      resolvedYears = detected.length > 0 ? detected : resolvedType === '实习兼职' ? ['2027', '2028'] : ['2027'];
    }
  }

  return {
    recruitType: resolvedType,
    experienceReq: resolvedExp,
    seasonTag: resolvedSeason,
    graduationYears: resolvedYears,
  };
}

function normalizeDateToken(raw = '') {
  const s = String(raw || '').trim();
  const full = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (full) {
    return `${full[1]}-${String(full[2]).padStart(2, '0')}-${String(full[3]).padStart(2, '0')}`;
  }
  const md = s.match(/(\d{1,2})[-/.月](\d{1,2})日?/);
  if (md) {
    return `2026-${String(md[1]).padStart(2, '0')}-${String(md[2]).padStart(2, '0')}`;
  }
  return '';
}

function extractUrlsFromText(text = '') {
  const raw = String(text || '');
  const matches = raw.match(/https?:\/\/[^\s)）\]>"'，,；;]+/gi) || [];
  return matches.map((u) => u.replace(/[.,;:!?。，；：！？]+$/, ''));
}

function isWechatHost(urlStr = '') {
  try {
    const h = new URL(urlStr).hostname.toLowerCase();
    return h === 'mp.weixin.qq.com' || h.endsWith('.weixin.qq.com') || h === 'weixin.qq.com';
  } catch {
    return false;
  }
}

function detectCompanyInText(text = '', knownCompanies = []) {
  const raw = String(text || '');
  const sorted = [...(knownCompanies || [])]
    .filter((c) => c && c.name)
    .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));

  let bestMatch = null;
  let bestIndex = Infinity;
  let bestLen = 0;

  for (const c of sorted) {
    const candidates = [c.wechat_account, c.name, c.short_name, c.legal_name]
      .flatMap((v) => String(v || '').split('/').map((part) => part.trim()))
      .filter((v) => v.length >= 2);
    for (const alias of candidates) {
      const idx = raw.indexOf(alias);
      if (idx !== -1 && (idx < bestIndex || (idx === bestIndex && alias.length > bestLen))) {
        bestIndex = idx;
        bestLen = alias.length;
        bestMatch = { companyName: c.name, matchedCompany: c };
      }
    }
  }
  if (bestMatch) return bestMatch;

  const bracket = raw.match(/[【\[]([^】\]|｜/]{2,20})(?:招聘|校招|社招|热招|内推|202\d)[^】\]]*[】\]]/);
  if (bracket?.[1]) return { companyName: bracket[1].trim(), matchedCompany: null };

  const prefix = raw.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,16})(?:202\d届?(?:春季|秋季|校园|社会)?招聘|官方招聘|校园招聘|社会招聘|热招岗位|诚聘英才)/);
  if (prefix?.[1]) return { companyName: prefix[1].trim(), matchedCompany: null };

  const field = raw.match(/(?:公司|企业|单位|公众号)[名称号]?[：:]\s*([^\s，,。；;|/]{2,24})/);
  if (field?.[1]) return { companyName: field[1].trim(), matchedCompany: null };

  return { companyName: '', matchedCompany: null };
}

function isNoiseLine(line = '') {
  if (!line || line.length < 2) return true;
  if (/^https?:\/\//i.test(line)) return true;
  if (
    /^(投递方式|网申入口|报名链接|投递链接|官网投递|官方网址|关注我们|扫码投递|截止时间|截止日期|联系我们|备注|温馨提示|公司简介|关于我们|福利待遇)[：:]/i.test(
      line,
    )
  ) {
    return true;
  }
  if (/^(校园招聘|社会招聘|实习兼职|热招岗位|岗位列表|以下岗位|招聘对象)[：:\s]*$/i.test(line)) {
    return true;
  }
  return false;
}

/**
 * Zero-scraping parser for pasted WeChat Official Account announcement articles / group notices.
 * Extracts structured job items with inferred recruitType, experienceReq, category, city, salary,
 * and candidate official portal URLs (flagging mp.weixin.qq.com-only posts so users inspect/confirm).
 */
export function parseWechatAnnouncementText(rawText = '', knownCompanies = []) {
  const raw = String(rawText || '').trim();
  if (!raw) return [];

  const detectedGlobal = detectCompanyInText(raw, knownCompanies);
  const globalCompany = detectedGlobal.matchedCompany;
  const globalCompanyName = detectedGlobal.companyName || '待确认企业';

  const wechatAccountMatch = raw.match(/公众号[：:]\s*([^\s，,。；;]+)/);
  const globalWechatAccount = wechatAccountMatch?.[1]?.trim() || globalCompany?.wechat_account || '';

  const allUrls = extractUrlsFromText(raw);
  const officialUrls = allUrls.filter((u) => !isWechatHost(u));
  const wechatArticleUrl = allUrls.find((u) => isWechatHost(u)) || '';
  const globalOfficialUrl =
    officialUrls[0] || globalCompany?.official_social_url || globalCompany?.official_campus_url || '';

  const globalDeadlineMatch = raw.match(
    /(?:截止|网申截止|投递截止|有效期至)[时间日期：:\s]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|\d{1,2}月\d{1,2}日)/,
  );
  const globalDeadline = globalDeadlineMatch ? normalizeDateToken(globalDeadlineMatch[1]) || '招满即止' : '招满即止';

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let sectionRecruitType = '';
  let sectionCity = '';
  let sectionCompany = globalCompany;
  let sectionCompanyName = globalCompanyName;
  let sectionWechatAccount = globalWechatAccount;
  let sectionOfficialUrl = '';
  const results = [];
  const seenTitles = new Set();

  for (const line of lines) {
    if (/^(?:[一二三四五六七八九十\d]+[、.]\s*|[#【\[])?(?:社会招聘|社招岗位|在职社招|社招专区)/.test(line)) {
      sectionRecruitType = '社会招聘';
      if (line.length < 22 && !/[|｜/]/.test(line) && !/工程|经理|专家|专员|分析师|顾问|主管/.test(line)) continue;
    } else if (/^(?:[一二三四五六七八九十\d]+[、.]\s*|[#【\[])?(?:校园招聘|校招岗位|应届生岗位|秋招|春招)/.test(line)) {
      sectionRecruitType = '校园招聘';
      if (line.length < 22 && !/[|｜/]/.test(line) && !/工程|经理|专家|专员|分析师|管培/.test(line)) continue;
    } else if (/^(?:[一二三四五六七八九十\d]+[、.]\s*|[#【\[])?(?:实习生|实习岗位|暑期实习|日常实习|兼职)/.test(line)) {
      sectionRecruitType = '实习兼职';
      if (line.length < 22 && !/[|｜/]/.test(line) && !/工程|经理|专员|助理|实习生/.test(line)) continue;
    }

    const headerCompanyHit =
      /^[【\[]/.test(line) || /[：:]\s*$/.test(line)
        ? detectCompanyInText(line, knownCompanies)
        : { companyName: '', matchedCompany: null };
    if (headerCompanyHit.companyName && !/^\d+[、.)）]/.test(line)) {
      sectionCompany = headerCompanyHit.matchedCompany;
      sectionCompanyName = headerCompanyHit.companyName;
      sectionWechatAccount = headerCompanyHit.matchedCompany?.wechat_account || globalWechatAccount;
      sectionOfficialUrl = extractUrlsFromText(line).find((u) => !isWechatHost(u)) || '';
      if (/社招|社会招聘/.test(line) && !/校招|校园/.test(line)) sectionRecruitType = '社会招聘';
      else if (/校招|校园/.test(line) && !/社招|社会/.test(line)) sectionRecruitType = '校园招聘';
    }

    const workCityHint = line.match(/^(?:工作地点|招聘城市|地点)[：:]\s*([^\n]+)/);
    if (workCityHint) {
      const cityRes = inferCityInfo('', workCityHint[1]);
      if (cityRes.city !== '全国多地') sectionCity = cityRes.city;
      continue;
    }

    if (isNoiseLine(line)) continue;

    // Strip leading bullets / numbering
    let cleaned = line
      .replace(/^[-*•·▪▫◆◇▶►✅🔥🌟📌\s]+/, '')
      .replace(/^\d{1,2}[、.)）]\s*/, '')
      .trim();

    if (!cleaned || cleaned.length < 3) continue;

    // Extract line-level URLs first so they don't pollute title
    const lineUrls = extractUrlsFromText(cleaned);
    const lineOfficialUrl = lineUrls.find((u) => !isWechatHost(u)) || '';
    for (const u of lineUrls) {
      cleaned = cleaned.replace(u, ' ');
    }

    // Extract explicit field prefix if single-block format like "岗位：xxx"
    cleaned = cleaned.replace(/^(?:岗位名称|招聘岗位|热招职位|职位)[：:]\s*/, '').trim();

    // Skip announcement narrative headers unless they contain pipe separators or clear role keywords
    const hasRoleKeyword =
      /(?:工程师|架构师|科学家|研究员|产品经理|项目经理|经理|主管|总监|专家|专员|顾问|分析师|律师|审计师|会计师|设计师|运营|销售|代表|管培生|实习生|开发|测试|运维|药师|医学|CRA|CRC|HRBP|BP)/i.test(
        cleaned,
      );
    const hasPipe = /[|｜/]/.test(cleaned);
    if (!hasRoleKeyword && !hasPipe) continue;

    // Extract salary range if present
    const salaryMatch = cleaned.match(/(\d{1,3}\s*[-~—]\s*\d{1,3}\s*[kKwW万]?(?:·\d+薪)?|\d{3,4}\s*元\/[天月]|面议)/);
    const salaryRange = salaryMatch ? salaryMatch[1].replace(/\s+/g, '') : '';

    // Check line-level company override
    const lineCompanyDetected = detectCompanyInText(cleaned, knownCompanies);
    const matchedComp = lineCompanyDetected.matchedCompany || sectionCompany || globalCompany;
    const companyName = lineCompanyDetected.companyName || sectionCompanyName || globalCompanyName;
    const lineWechatAccount = matchedComp?.wechat_account || sectionWechatAccount || globalWechatAccount;

    // Split by pipe or dash if structured like "岗位 | 城市 | 经验 | 薪资"
    const segments = cleaned
      .split(/[|｜]/)
      .map((s) => s.trim())
      .filter(Boolean);
    let rawTitle = segments[0] || cleaned;
    const restText = segments.slice(1).join(' ');

    // Also pull city from title parentheses e.g. "后端开发工程师（北京/上海）" or "Java工程师 - 杭州"
    const cityInfo = inferCityInfo('', `${restText} ${rawTitle}`);
    const city = cityInfo.city !== '全国多地' ? cityInfo.city : sectionCity || '全国多地';

    // Clean title of inline bracket tags, salary, and city dash suffix
    let cleanTitle = rawTitle
      .replace(/[【\[](?:急聘|社招|校招|实习|热招|内推)[】\]]/g, '')
      .replace(/(\d{1,3}\s*[-~—]\s*\d{1,3}\s*[kKwW万]?(?:·\d+薪)?)/g, '')
      .trim();

    if (segments.length === 1) {
      cleanTitle = cleanTitle
        .replace(new RegExp(`[-—–]\\s*(?:${KNOWN_CITY_NAMES.join('|')}).*$`), '')
        .trim();
    }

    if (!cleanTitle || cleanTitle.length < 2 || seenTitles.has(`${companyName}::${cleanTitle}`)) continue;
    seenTitles.add(`${companyName}::${cleanTitle}`);

    const dlMatch = cleaned.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
    const deadline = dlMatch ? normalizeDateToken(dlMatch[1]) || globalDeadline : globalDeadline;

    const category = inferCategory(cleanTitle, restText);
    const meta = inferRecruitTypeAndExp({
      title: cleanTitle,
      recruitType: /社招|社会/.test(cleaned)
        ? '社会招聘'
        : /校招|应届/.test(cleaned)
          ? '校园招聘'
          : /实习/.test(cleaned)
            ? '实习兼职'
            : sectionRecruitType,
      contextText: `${cleaned} ${raw.slice(0, 220)}`,
    });

    let resolvedUrl = lineOfficialUrl;
    let urlSource = 'line';
    if (!resolvedUrl && sectionOfficialUrl) {
      resolvedUrl = sectionOfficialUrl;
      urlSource = 'announcement';
    } else if (!resolvedUrl && matchedComp) {
      resolvedUrl =
        meta.recruitType === '社会招聘'
          ? matchedComp.official_social_url || matchedComp.official_campus_url || ''
          : matchedComp.official_campus_url || matchedComp.official_social_url || '';
      urlSource = resolvedUrl ? 'company_catalog' : 'missing';
    } else if (!resolvedUrl && officialUrls[0]) {
      resolvedUrl = officialUrls[0];
      urlSource = 'announcement';
    } else if (!resolvedUrl) {
      resolvedUrl = globalOfficialUrl;
      urlSource = resolvedUrl ? 'announcement' : 'missing';
    }

    results.push({
      selected: Boolean(resolvedUrl),
      companyName,
      matchedCompanyId: matchedComp?.id || '',
      wechatAccount: lineWechatAccount,
      title: cleanTitle,
      category,
      recruitType: meta.recruitType,
      experienceReq: meta.experienceReq,
      seasonTag: meta.seasonTag,
      graduationYears: meta.graduationYears,
      city,
      province: cityInfo.province,
      cityTier: cityInfo.tier,
      salaryRange,
      deadline,
      officialUrl: resolvedUrl,
      wechatArticleUrl,
      urlSource,
      requirementsSummary: `解析自${lineWechatAccount ? `公众号「${lineWechatAccount}」` : '招聘公告文本'} · ${meta.recruitType} / ${meta.experienceReq}${salaryRange ? ` / ${salaryRange}` : ''}`,
    });
  }

  return results;
}

/**
 * Unified batch import parser accepting:
 * 1) JSON array
 * 2) Comma / tab / pipe structured lines: 公司名, 岗位名, 城市, https://官网链接, [截止日期]
 * 3) WeChat Official Account announcement text (fallback)
 */
export function parseBatchImportText(rawText = '', knownCompanies = []) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        return arr
          .map((item) => {
            const title = String(item.title || '').trim();
            const meta = inferRecruitTypeAndExp({
              title,
              seasonTag: item.seasonTag || '',
              recruitType: item.recruitType || '',
              experienceReq: item.experienceReq || '',
              graduationYears: item.graduationYears,
            });
            const cityInfo = inferCityInfo(item.city || '', title);
            return {
              selected: true,
              companyName: String(item.companyName || '').trim(),
              shortName: String(item.shortName || '').trim(),
              legalName: String(item.legalName || '').trim(),
              entityTag: String(item.entityTag || '').trim(),
              companyType: String(item.companyType || '').trim(),
              industry: String(item.industry || '').trim(),
              wechatAccount: String(item.wechatAccount || '').trim(),
              title,
              category: item.category || inferCategory(title),
              recruitType: meta.recruitType,
              experienceReq: meta.experienceReq,
              seasonTag: meta.seasonTag,
              graduationYears: meta.graduationYears,
              city: cityInfo.city,
              province: cityInfo.province,
              cityTier: cityInfo.tier,
              officialUrl: String(item.officialUrl || '').trim(),
              deadline: String(item.deadline || '招满即止').trim(),
              salaryRange: String(item.salaryRange || '').trim(),
              requirementsSummary: String(item.requirementsSummary || '').trim(),
              urlSource: 'json',
            };
          })
          .filter((item) => item.companyName && item.title && item.officialUrl);
      }
    } catch {
      // fall through to line/announcement parsing
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const csvResults = [];
  for (const line of lines) {
    const parts = line
      .split(/[,，|\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 4 && /^https?:\/\//i.test(parts[3])) {
      const title = parts[1];
      const cityInfo = inferCityInfo(parts[2], title);
      const meta = inferRecruitTypeAndExp({
        title,
        recruitType: parts[5] || '',
        experienceReq: parts[6] || '',
      });
      csvResults.push({
        selected: true,
        companyName: parts[0],
        title,
        category: inferCategory(title),
        recruitType: meta.recruitType,
        experienceReq: meta.experienceReq,
        seasonTag: meta.seasonTag,
        graduationYears: meta.graduationYears,
        city: cityInfo.city,
        province: cityInfo.province,
        cityTier: cityInfo.tier,
        officialUrl: parts[3],
        deadline: parts[4] || '招满即止',
        salaryRange: '',
        requirementsSummary: `批量导入官网岗位 · ${meta.recruitType} / ${meta.experienceReq}`,
        urlSource: 'csv',
      });
    }
  }

  if (csvResults.length > 0 && csvResults.length >= Math.floor(lines.length / 2)) {
    return csvResults;
  }

  const wechatResults = parseWechatAnnouncementText(trimmed, knownCompanies);
  return wechatResults.length > 0 ? wechatResults : csvResults;
}
