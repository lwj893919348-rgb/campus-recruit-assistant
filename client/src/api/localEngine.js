const STORAGE_KEY = 'zhihang_campus_static_v1';

const APPLICATION_STATUSES = ['wishlist', 'applied', 'assessment', 'interview', 'offer', 'rejected'];

const STATUS_LABELS = {
  wishlist: '待投递/收藏',
  applied: '已投递',
  assessment: '测评/笔试',
  interview: '面试中',
  offer: '已拿 Offer',
  rejected: '流程终止',
};

const MULTI_PART_TLDS = ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'co.uk', 'co.jp', 'com.hk', 'com.sg'];

const FIRST_TIER = new Set(['北京', '上海', '深圳', '广州']);
const NEW_FIRST_TIER = new Set([
  '杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '重庆', '合肥', '天津', '郑州', '东莞', '佛山', '青岛', '宁波',
]);

let catalogPromise = null;

async function fetchStaticCatalog() {
  if (!catalogPromise) {
    const base = import.meta.env.BASE_URL || '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    catalogPromise = fetch(`${normalizedBase}catalog.json`).then(async (res) => {
      if (!res.ok) {
        throw new Error(`无法加载内置校招数据集 (${res.status})`);
      }
      return res.json();
    });
  }
  return catalogPromise;
}

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function extractRootDomain(hostname = '') {
  const host = String(hostname).toLowerCase().replace(/\.$/, '');
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function isPrivateOrLoopbackHost(hostname = '') {
  const host = String(hostname).toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.local') || host === '::1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const m = host.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function inferCityTier(city = '') {
  if (FIRST_TIER.has(city)) return '一线城市';
  if (NEW_FIRST_TIER.has(city)) return '新一线';
  if (['全国多地', '海外', '远程'].includes(city)) return '其他/海外';
  return '省会及重点城市';
}

function computeDeadlineStatus(job) {
  const dl = String(job.deadline || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dl)) return job.status || 'open';
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const dlMs = new Date(`${dl}T00:00:00Z`).getTime();
  if (Number.isNaN(dlMs)) return job.status || 'open';
  const diffDays = Math.round((dlMs - todayMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'closed';
  if (diffDays <= 10) return 'closing_soon';
  return 'open';
}

function readLocalState(catalog) {
  let state = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    state = null;
  }

  if (!state || typeof state !== 'object') {
    state = {
      seededVersion: 1,
      resumes: catalog.resumes || [],
      applications: catalog.applications || [],
      userJobs: [],
      userCompanies: [],
      jobOverrides: {},
      customSources: [],
      disabledBuiltinIds: [],
      syncRuns: [],
    };
    saveLocalState(state);
  }

  return {
    seededVersion: state.seededVersion || 1,
    resumes: Array.isArray(state.resumes) ? state.resumes : catalog.resumes || [],
    applications: Array.isArray(state.applications) ? state.applications : [],
    userJobs: Array.isArray(state.userJobs) ? state.userJobs : [],
    userCompanies: Array.isArray(state.userCompanies) ? state.userCompanies : [],
    jobOverrides: state.jobOverrides && typeof state.jobOverrides === 'object' ? state.jobOverrides : {},
    customSources: Array.isArray(state.customSources) ? state.customSources : [],
    disabledBuiltinIds: Array.isArray(state.disabledBuiltinIds) ? state.disabledBuiltinIds : [],
    syncRuns: Array.isArray(state.syncRuns) ? state.syncRuns : [],
  };
}

function saveLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function getHydratedContext() {
  const catalog = await fetchStaticCatalog();
  const state = readLocalState(catalog);

  const companyMap = new Map();
  for (const c of catalog.companies || []) companyMap.set(c.id, { ...c });
  for (const c of state.userCompanies) companyMap.set(c.id, { ...c });
  const companies = Array.from(companyMap.values());

  const jobMap = new Map();
  for (const j of catalog.jobs || []) {
    const ov = state.jobOverrides[j.id];
    const merged = ov ? { ...j, ...ov } : { ...j };
    merged.status = computeDeadlineStatus(merged);
    jobMap.set(j.id, merged);
  }
  for (const j of state.userJobs) {
    const merged = { ...j };
    merged.status = computeDeadlineStatus(merged);
    jobMap.set(j.id, merged);
  }
  const jobs = Array.from(jobMap.values());

  return { catalog, state, companies, companyMap, jobs };
}

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function createEmptyResumeContent() {
  return {
    basic: {
      name: '张同学',
      phone: '138-0000-0000',
      email: 'student@university.edu.cn',
      city: '期望城市：北京 / 上海 / 杭州',
      targetRole: '校招应届生岗位',
      github: '',
      politicalStatus: '共青团员',
      hometown: '',
      englishLevel: 'CET-6',
      gradDate: '2027年6月',
      avatar: '',
    },
    education: [
      {
        id: 'edu-new-1',
        school: 'XX大学',
        degree: '本科',
        major: '计算机科学与技术',
        period: '2023.09 - 2027.06',
        gpa: 'GPA 3.6/4.0',
        courses: '数据结构、操作系统、计算机网络、数据库原理',
      },
    ],
    internship: [],
    projects: [
      {
        id: 'proj-new-1',
        name: '校内课程实践 / 核心项目名称',
        role: '核心开发者',
        period: '2026.03 - 2026.06',
        link: '',
        bullets: [
          '使用 STAR 法则描述：针对【具体痛点/背景】，采取了【核心技术与方案】，最终实现【量化指标提升，如性能提升 40%】。',
        ],
      },
    ],
    campus: [],
    skills: [
      { id: 'sk-new-1', label: '核心技能', items: '请填写与目标校招岗位匹配的技能关键词（利于企业 ATS 筛选）' },
    ],
    awards: [],
    summary: '',
  };
}

function enrichApplications(state) {
  const resumeTitleMap = Object.fromEntries(state.resumes.map((r) => [r.id, r.title]));
  return state.applications.map((a) => ({
    ...a,
    is_demo: Boolean(a.is_demo),
    resume_title: a.resume_id ? resumeTitleMap[a.resume_id] || null : null,
  }));
}

function parseBatchLines(rawText = '') {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
      return list
        .map((it) => ({
          companyName: String(it.companyName || it.company || '').trim(),
          title: String(it.title || it.jobTitle || '').trim(),
          city: String(it.city || '全国多地').trim(),
          officialUrl: String(it.officialUrl || it.url || '').trim(),
          deadline: String(it.deadline || '招满即止').trim(),
          seasonTag: String(it.seasonTag || '2027届秋招补录').trim(),
        }))
        .filter((x) => x.companyName && x.title && x.officialUrl);
    } catch {
      // fall through
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];

  for (const line of lines) {
    if (/^(公司|company)/i.test(line) && /(岗位|title|职位)/i.test(line)) continue;
    const parts = line
      .split(/[,，|\t]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 3) continue;
    const urlIdx = parts.findIndex((p) => /^https?:\/\//i.test(p));
    if (urlIdx === -1) continue;
    const officialUrl = parts[urlIdx];
    const nonUrl = parts.filter((_, i) => i !== urlIdx);
    const companyName = nonUrl[0] || '';
    const title = nonUrl[1] || '';
    const city = nonUrl[2] || '全国多地';
    const deadline = nonUrl[3] || '招满即止';
    const seasonTag = nonUrl[4] || '2027届秋招补录';
    if (companyName && title) {
      items.push({ companyName, title, city, officialUrl, deadline, seasonTag });
    }
  }

  return items;
}

export const localEngine = {
  async getDashboard() {
    const { state, companies, companyMap, jobs } = await getHydratedContext();
    const openJobs = jobs.filter((j) => j.status === 'open' || j.status === 'closing_soon');
    const sortedResumes = [...state.resumes].sort(
      (a, b) => Number(b.is_default) - Number(a.is_default) || String(b.updated_at).localeCompare(String(a.updated_at)),
    );
    const defaultResume = sortedResumes[0]
      ? {
          id: sortedResumes[0].id,
          title: sortedResumes[0].title,
          template_id: sortedResumes[0].template_id,
          updated_at: sortedResumes[0].updated_at,
        }
      : null;

    const funnel = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    for (const app of state.applications) {
      if (funnel[app.status] !== undefined) funnel[app.status] += 1;
    }

    const totalApplications = state.applications.length;
    const activeAppliedCount =
      funnel.applied + funnel.assessment + funnel.interview + funnel.offer + funnel.rejected;
    const progressedToAssessmentOrAbove = funnel.assessment + funnel.interview + funnel.offer;
    const progressedToInterviewOrAbove = funnel.interview + funnel.offer;

    const upcomingEvents = enrichApplications(state)
      .filter((a) => a.next_event_at && a.status !== 'rejected' && a.status !== 'offer')
      .sort((a, b) => String(a.next_event_at).localeCompare(String(b.next_event_at)))
      .slice(0, 6);

    const closingJobs = jobs
      .filter((j) => j.status === 'closing_soon')
      .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
      .slice(0, 5)
      .map((j) => {
        const c = companyMap.get(j.company_id) || {};
        return {
          ...j,
          company_name: c.name || '官方名企',
          company_short_name: c.short_name || '名企',
          badge_color: c.badge_color || '#2563EB',
        };
      });

    const cityCountMap = new Map();
    for (const j of openJobs) {
      const key = `${j.city}::${j.city_tier}`;
      if (!cityCountMap.has(key)) {
        cityCountMap.set(key, { city: j.city, city_tier: j.city_tier, count: 0 });
      }
      cityCountMap.get(key).count += 1;
    }
    const topCities = Array.from(cityCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const openByCompany = new Map();
    for (const j of openJobs) {
      openByCompany.set(j.company_id, (openByCompany.get(j.company_id) || 0) + 1);
    }
    const featuredCompanies = companies
      .map((c) => ({ ...c, open_job_count: openByCompany.get(c.id) || 0 }))
      .sort((a, b) => b.open_job_count - a.open_job_count)
      .slice(0, 8);

    return {
      summary: {
        totalCompanies: companies.length,
        totalOpenJobs: openJobs.length,
        totalResumes: state.resumes.length,
        totalApplications,
        activeAppliedCount,
        interviewRate:
          activeAppliedCount > 0 ? Math.round((progressedToInterviewOrAbove / activeAppliedCount) * 100) : 0,
        assessmentRate:
          activeAppliedCount > 0 ? Math.round((progressedToAssessmentOrAbove / activeAppliedCount) * 100) : 0,
      },
      funnel,
      defaultResume,
      upcomingEvents,
      closingJobs,
      topCities,
      featuredCompanies,
    };
  },

  async getJobs(params = {}) {
    const { state, companyMap, jobs } = await getHydratedContext();
    const {
      q = '',
      cities = '',
      cityTier = '',
      province = '',
      season = '',
      gradYear = '',
      industry = '',
      companyType = '',
      category = '',
      companyId = '',
      onlyOpen = '',
      onlyReferral = '',
      sort = 'latest',
    } = params;

    const cityList = String(cities)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const kw = String(q).trim().toLowerCase();

    const trackedMap = {};
    for (const a of state.applications) {
      if (a.job_id) trackedMap[a.job_id] = { id: a.id, status: a.status };
    }

    const enrichedAll = jobs.map((j) => {
      const c = companyMap.get(j.company_id) || {};
      return {
        ...j,
        company_name: c.name || '',
        company_short_name: c.short_name || '',
        company_industry: c.industry || '',
        company_type: c.company_type || '',
        badge_color: c.badge_color || '#2563EB',
        company_portal_url: c.official_campus_url || j.official_source_url,
        company_search_url_template: c.search_url_template || '',
        company_verification_status: c.verification_status || 'verified_official',
        tracked: trackedMap[j.id] || null,
      };
    });

    const filtered = enrichedAll.filter((item) => {
      if (kw) {
        const hay = `${item.title} ${item.requirements_summary} ${item.company_name} ${item.company_short_name} ${item.city} ${item.category}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (cityList.length > 0 && !cityList.includes(item.city)) return false;
      if (cityTier && cityTier !== '全部' && item.city_tier !== cityTier) return false;
      if (province && province !== '全部' && item.province !== province) return false;
      if (season && season !== '全部' && item.season_tag !== season) return false;
      if (gradYear && gradYear !== '全部' && !(item.graduation_years || []).includes(String(gradYear).trim())) return false;
      if (industry && industry !== '全部' && item.company_industry !== industry) return false;
      if (companyType && companyType !== '全部' && item.company_type !== companyType) return false;
      if (category && category !== '全部' && item.category !== category) return false;
      if (companyId && item.company_id !== companyId) return false;
      if ((onlyOpen === '1' || onlyOpen === 'true') && item.status !== 'open' && item.status !== 'closing_soon') return false;
      if ((onlyReferral === '1' || onlyReferral === 'true') && !item.is_referral) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'deadline') {
        const da = a.deadline === '招满即止' ? '9999-12-31' : a.deadline;
        const db = b.deadline === '招满即止' ? '9999-12-31' : b.deadline;
        if (da !== db) return String(da).localeCompare(String(db));
        return String(b.created_at).localeCompare(String(a.created_at));
      }
      const rank = { closing_soon: 0, open: 1, closed: 2 };
      const ra = rank[a.status] ?? 2;
      const rb = rank[b.status] ?? 2;
      if (ra !== rb) return ra - rb;
      return String(b.created_at).localeCompare(String(a.created_at));
    });

    const cityFacetMap = new Map();
    const seasonCount = new Map();
    const catCount = new Map();
    const typeCount = new Map();

    for (const j of enrichedAll) {
      const ck = `${j.city}::${j.province}::${j.city_tier}`;
      if (!cityFacetMap.has(ck)) {
        cityFacetMap.set(ck, { city: j.city, province: j.province, city_tier: j.city_tier, count: 0 });
      }
      cityFacetMap.get(ck).count += 1;
      seasonCount.set(j.season_tag, (seasonCount.get(j.season_tag) || 0) + 1);
      catCount.set(j.category, (catCount.get(j.category) || 0) + 1);
      typeCount.set(j.company_type, (typeCount.get(j.company_type) || 0) + 1);
    }

    const toFacetArray = (map) =>
      Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

    return {
      total: filtered.length,
      jobs: filtered,
      facets: {
        cities: Array.from(cityFacetMap.values()).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
        seasons: toFacetArray(seasonCount),
        categories: toFacetArray(catCount),
        companyTypes: toFacetArray(typeCount),
      },
    };
  },

  async createJob(data) {
    const {
      companyName = '',
      title = '',
      category = '技术研发',
      seasonTag = '2027届秋招补录',
      graduationYears = ['2027'],
      province = '',
      city = '',
      officialUrl = '',
      deadline = '招满即止',
      isReferral = false,
      salaryRange = '',
      requirementsSummary = '',
      companyType = '优质企业',
      industry = '综合行业',
    } = data || {};

    if (!companyName.trim() || !title.trim() || !city.trim() || !officialUrl.trim()) {
      throw new Error('请填写完整的公司名称、岗位名称、工作城市与官网投递链接。');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(officialUrl.trim());
    } catch {
      throw new Error('官网投递链接格式无效，请以 https:// 或 http:// 开头。');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || isPrivateOrLoopbackHost(parsedUrl.hostname)) {
      throw new Error('请填写有效的公开企业官网 HTTP/HTTPS 链接。');
    }

    const { state, companies } = await getHydratedContext();
    const rootDomain = extractRootDomain(parsedUrl.hostname);
    const now = new Date().toISOString();

    let company = companies.find((c) => c.official_domain === rootDomain || c.name === companyName.trim());
    if (!company) {
      const cleanName = companyName.trim();
      company = {
        id: genId('comp'),
        name: cleanName,
        short_name: cleanName.slice(0, 4),
        industry: industry.trim() || '综合行业',
        company_type: companyType.trim() || '优质企业',
        official_domain: rootDomain,
        official_campus_url: officialUrl.trim(),
        search_url_template: officialUrl.trim(),
        badge_color: '#334155',
        hq_city: city.trim(),
        verification_status: 'user_submitted',
        last_verified_at: now,
        notes: '由用户在本地浏览器收录并校对域名的官方校招入口。',
      };
      state.userCompanies.push(company);
    }

    const cleanCity = city.trim();
    const job = {
      id: genId('job'),
      company_id: company.id,
      title: title.trim(),
      category: category.trim() || '技术研发',
      season_tag: seasonTag.trim() || '2027届秋招补录',
      graduation_years: Array.isArray(graduationYears) && graduationYears.length > 0 ? graduationYears : ['2027'],
      province: province.trim() || cleanCity,
      city: cleanCity,
      city_tier: inferCityTier(cleanCity),
      official_source_url: officialUrl.trim(),
      official_domain: rootDomain,
      deadline: deadline.trim() || '招满即止',
      status: 'open',
      is_referral: Boolean(isReferral),
      salary_range: salaryRange.trim(),
      requirements_summary: requirementsSummary.trim() || '详情请点击直达官网查看具体岗位职责与专业要求。',
      sync_source: 'user_submitted',
      last_checked_at: now,
      created_at: now,
    };
    job.status = computeDeadlineStatus(job);
    state.userJobs.unshift(job);
    saveLocalState(state);

    return {
      ...job,
      company_name: company.name,
      company_short_name: company.short_name,
      company_type: company.company_type,
      badge_color: company.badge_color,
      company_portal_url: company.official_campus_url,
      company_verification_status: company.verification_status,
    };
  },

  async getCompanies(params = {}) {
    const { companies, jobs } = await getHydratedContext();
    const { q = '', companyType = '' } = params;
    const kw = String(q).trim().toLowerCase();

    const list = companies
      .filter((c) => {
        if (companyType && companyType !== '全部' && c.company_type !== companyType) return false;
        if (kw) {
          const hay = `${c.name} ${c.short_name} ${c.industry} ${c.hq_city}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .map((c) => {
        const companyJobs = jobs.filter((j) => j.company_id === c.id);
        const openCount = companyJobs.filter((j) => j.status === 'open' || j.status === 'closing_soon').length;
        return {
          ...c,
          open_job_count: openCount,
          total_job_count: companyJobs.length,
        };
      })
      .sort((a, b) => b.open_job_count - a.open_job_count || a.name.localeCompare(b.name));

    return { companies: list };
  },

  async verifyUrl(payload = {}) {
    const { companyId, jobId, url } = payload;
    const { companies, jobs } = await getHydratedContext();
    let targetUrl = url;
    let expectedDomain = '';

    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error('未找到对应的校招岗位记录。');
      const comp = companies.find((c) => c.id === job.company_id);
      targetUrl = targetUrl || job.official_source_url;
      expectedDomain = comp?.official_domain || job.official_domain;
    } else if (companyId) {
      const comp = companies.find((c) => c.id === companyId);
      if (!comp) throw new Error('未找到对应的官方企业记录。');
      targetUrl = targetUrl || comp.official_campus_url;
      expectedDomain = comp.official_domain;
    }

    if (!targetUrl) throw new Error('缺少待核验的官网 URL。');
    const parsed = new URL(targetUrl);
    const resolvedDomain = extractRootDomain(parsed.hostname);
    const match = !expectedDomain || resolvedDomain === expectedDomain || resolvedDomain.endsWith(`.${expectedDomain}`);

    return {
      ok: match && !isPrivateOrLoopbackHost(parsed.hostname),
      targetUrl,
      finalUrl: targetUrl,
      httpStatus: null,
      resolvedDomain,
      expectedDomain,
      isDomainMatch: match,
      resultStatus: match ? 'verified_official' : 'domain_mismatch',
      message: match
        ? `域名一致性核验通过（根域 ${resolvedDomain}）。纯静态演示模式下请直接点击「直达官网」浏览实时在招详情。`
        : `目标域名 (${resolvedDomain}) 与企业主域名 (${expectedDomain}) 不一致，请注意甄别。`,
      checkedAt: new Date().toISOString(),
    };
  },

  async verifyBatch(payload = {}) {
    const { companyIds } = payload;
    const { companies } = await getHydratedContext();
    const list =
      Array.isArray(companyIds) && companyIds.length > 0
        ? companies.filter((c) => companyIds.includes(c.id))
        : companies.slice(0, 12);

    const results = [];
    for (const c of list) {
      const r = await this.verifyUrl({ companyId: c.id });
      results.push({ companyId: c.id, companyName: c.name, ...r });
    }
    return { checked: results.length, results };
  },

  async getResumes() {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const sorted = [...state.resumes].sort(
      (a, b) => Number(b.is_default) - Number(a.is_default) || String(b.updated_at).localeCompare(String(a.updated_at)),
    );
    return { resumes: sorted };
  },

  async createResume(data = {}) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const now = new Date().toISOString();
    const isDefault = Boolean(data.is_default);
    if (isDefault) {
      state.resumes = state.resumes.map((r) => ({ ...r, is_default: false }));
    }
    const created = {
      id: genId('resume'),
      title: String(data.title || '').trim() || '未命名校招简历',
      template_id: data.template_id || 'tech-minimal',
      theme_color: data.theme_color || '#2563EB',
      font_scale: data.font_scale || 'standard',
      margin_preset: data.margin_preset || 'standard',
      section_order: data.section_order || ['education', 'internship', 'projects', 'skills', 'campus', 'awards', 'summary'],
      hidden_sections: data.hidden_sections || [],
      content_json: data.content_json || createEmptyResumeContent(),
      is_default: isDefault,
      created_at: now,
      updated_at: now,
    };
    state.resumes.unshift(created);
    saveLocalState(state);
    return { resume: created };
  },

  async updateResume(id, data = {}) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const idx = state.resumes.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('未找到待更新的简历版本。');
    const now = new Date().toISOString();
    if (data.is_default === true) {
      state.resumes = state.resumes.map((r) => ({ ...r, is_default: r.id === id }));
    }
    const existing = state.resumes[idx];
    const updated = {
      ...existing,
      title: data.title !== undefined ? String(data.title).trim() || existing.title : existing.title,
      template_id: data.template_id || existing.template_id,
      theme_color: data.theme_color || existing.theme_color,
      font_scale: data.font_scale || existing.font_scale,
      margin_preset: data.margin_preset || existing.margin_preset,
      section_order: data.section_order !== undefined ? data.section_order : existing.section_order,
      hidden_sections: data.hidden_sections !== undefined ? data.hidden_sections : existing.hidden_sections,
      content_json: data.content_json !== undefined ? data.content_json : existing.content_json,
      is_default: data.is_default !== undefined ? Boolean(data.is_default) : existing.is_default,
      updated_at: now,
    };
    state.resumes[idx] = updated;
    saveLocalState(state);
    return { resume: updated };
  },

  async duplicateResume(id, title) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const source = state.resumes.find((r) => r.id === id);
    if (!source) throw new Error('未找到要复制的简历版本。');
    const now = new Date().toISOString();
    const copy = {
      ...JSON.parse(JSON.stringify(source)),
      id: genId('resume'),
      title: title && String(title).trim() ? String(title).trim() : `${source.title}（副本）`,
      is_default: false,
      created_at: now,
      updated_at: now,
    };
    state.resumes.unshift(copy);
    saveLocalState(state);
    return { resume: copy };
  },

  async deleteResume(id) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    if (state.resumes.length <= 1) {
      throw new Error('至少需要保留 1 份简历版本，您可以修改内容或先新建再删除。');
    }
    const target = state.resumes.find((r) => r.id === id);
    if (!target) throw new Error('未找到要删除的简历。');
    state.resumes = state.resumes.filter((r) => r.id !== id);
    if (target.is_default && state.resumes.length > 0) {
      state.resumes[0].is_default = true;
    }
    saveLocalState(state);
    return { deleted: true, id };
  },

  async getApplications(params = {}) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const { status = '', city = '', season = '', q = '' } = params;
    const kw = String(q).trim().toLowerCase();

    const allEnriched = enrichApplications(state);
    const filtered = allEnriched
      .filter((a) => {
        if (status && status !== '全部' && a.status !== status) return false;
        if (city && city !== '全部' && a.city !== city) return false;
        if (season && season !== '全部' && a.season_tag !== season) return false;
        if (kw) {
          const hay = `${a.company_name} ${a.job_title} ${a.city} ${a.notes || ''}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aHas = a.next_event_at ? 0 : 1;
        const bHas = b.next_event_at ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        if (a.next_event_at && b.next_event_at && a.next_event_at !== b.next_event_at) {
          return String(a.next_event_at).localeCompare(String(b.next_event_at));
        }
        return String(b.updated_at).localeCompare(String(a.updated_at));
      });

    const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    for (const a of state.applications) {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    }

    return {
      applications: filtered,
      counts,
      hasDemo: state.applications.some((a) => a.is_demo),
    };
  },

  async createApplication(data = {}) {
    if (!String(data.company_name || '').trim() || !String(data.job_title || '').trim()) {
      throw new Error('请填写公司名称和岗位名称。');
    }
    const status = data.status || 'applied';
    if (!APPLICATION_STATUSES.includes(status)) {
      throw new Error('无效的投递状态值。');
    }
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const now = new Date().toISOString();
    const record = {
      id: genId('app'),
      job_id: data.job_id || null,
      company_name: String(data.company_name).trim(),
      job_title: String(data.job_title).trim(),
      city: String(data.city || '').trim(),
      official_url: String(data.official_url || '').trim(),
      season_tag: String(data.season_tag || '2027届秋招补录').trim(),
      channel: String(data.channel || '官网直投').trim(),
      referral_code: String(data.referral_code || '').trim(),
      resume_id: data.resume_id && state.resumes.some((r) => r.id === data.resume_id) ? data.resume_id : null,
      status,
      interview_round: String(data.interview_round || '').trim(),
      next_event_at: String(data.next_event_at || '').trim(),
      applied_at: String(data.applied_at || '').trim() || now.slice(0, 10),
      priority: data.priority || 'normal',
      notes: String(data.notes || '').trim(),
      is_demo: false,
      created_at: now,
      updated_at: now,
    };
    state.applications.unshift(record);
    saveLocalState(state);
    return { application: enrichApplications(state)[0] };
  },

  async updateApplication(id, data = {}) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const idx = state.applications.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('未找到该投递记录。');
    const existing = state.applications[idx];
    const nextStatus = data.status ?? existing.status;
    if (!APPLICATION_STATUSES.includes(nextStatus)) {
      throw new Error('无效的投递状态值。');
    }
    const now = new Date().toISOString();
    state.applications[idx] = {
      ...existing,
      company_name: data.company_name !== undefined ? String(data.company_name).trim() || existing.company_name : existing.company_name,
      job_title: data.job_title !== undefined ? String(data.job_title).trim() || existing.job_title : existing.job_title,
      city: data.city !== undefined ? String(data.city).trim() : existing.city,
      official_url: data.official_url !== undefined ? String(data.official_url).trim() : existing.official_url,
      season_tag: data.season_tag !== undefined ? String(data.season_tag).trim() : existing.season_tag,
      channel: data.channel !== undefined ? String(data.channel).trim() : existing.channel,
      referral_code: data.referral_code !== undefined ? String(data.referral_code).trim() : existing.referral_code,
      resume_id: data.resume_id !== undefined ? data.resume_id || null : existing.resume_id,
      status: nextStatus,
      interview_round: data.interview_round !== undefined ? String(data.interview_round).trim() : existing.interview_round,
      next_event_at: data.next_event_at !== undefined ? String(data.next_event_at).trim() : existing.next_event_at,
      applied_at: data.applied_at !== undefined ? String(data.applied_at).trim() : existing.applied_at,
      priority: data.priority !== undefined ? data.priority : existing.priority,
      notes: data.notes !== undefined ? String(data.notes).trim() : existing.notes,
      is_demo: false,
      updated_at: now,
    };
    saveLocalState(state);
    const updated = enrichApplications(state).find((a) => a.id === id);
    return { application: updated };
  },

  async patchApplicationStatus(id, status, interview_round) {
    return this.updateApplication(id, {
      status,
      ...(interview_round !== undefined ? { interview_round } : {}),
    });
  },

  async deleteApplication(id) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const before = state.applications.length;
    state.applications = state.applications.filter((a) => a.id !== id);
    if (state.applications.length === before) throw new Error('未找到待删除的投递记录。');
    saveLocalState(state);
    return { deleted: true, id };
  },

  async clearDemoApplications() {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const before = state.applications.length;
    state.applications = state.applications.filter((a) => !a.is_demo);
    saveLocalState(state);
    return { cleared: before - state.applications.length };
  },

  async downloadApplicationsCsv() {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const rows = enrichApplications(state).sort((a, b) => String(b.applied_at).localeCompare(String(a.applied_at)));
    const headers = [
      '公司名称', '岗位名称', '工作城市', '招聘季', '投递状态', '当前轮次',
      '下次日程时间', '投递日期', '投递渠道', '内推码', '使用简历版本', '官网链接', '复盘/备注',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) =>
        [
          r.company_name,
          r.job_title,
          r.city,
          r.season_tag,
          STATUS_LABELS[r.status] || r.status,
          r.interview_round,
          r.next_event_at,
          r.applied_at,
          r.channel,
          r.referral_code,
          r.resume_title || '',
          r.official_url,
          r.notes,
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];
    triggerDownload('campus-applications.csv', `\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8;');
  },

  async getSyncStatus() {
    const { catalog, state, companies, jobs } = await getHydratedContext();
    const openJobs = jobs.filter((j) => j.status === 'open' || j.status === 'closing_soon').length;
    const closingSoonJobs = jobs.filter((j) => j.status === 'closing_soon').length;
    const closedJobs = jobs.filter((j) => j.status === 'closed').length;

    const disabledSet = new Set(state.disabledBuiltinIds);
    const builtinSources = (catalog.syncSources || []).map((s) => ({
      ...s,
      enabled: !disabledSet.has(s.id),
      is_builtin: true,
      last_synced_at: s.last_synced_at || catalog.meta?.exportedAt || '',
      items_count: s.id === 'src-lifecycle-audit' ? openJobs : jobs.length,
    }));
    const sources = [...builtinSources, ...state.customSources];

    return {
      counts: {
        companies: companies.length,
        jobs: jobs.length,
        openJobs,
        closingSoonJobs,
        closedJobs,
        enabledSources: sources.filter((s) => s.enabled).length,
      },
      lastRun: state.syncRuns[0] || null,
      sources,
      recentRuns: state.syncRuns.slice(0, 10),
      staticExportedAt: catalog.meta?.exportedAt || '',
    };
  },

  async runSync({ sourceId = null } = {}) {
    const { catalog, state, jobs } = await getHydratedContext();
    const statusBefore = await this.getSyncStatus();
    const targetSources = sourceId
      ? statusBefore.sources.filter((s) => s.id === sourceId)
      : statusBefore.sources.filter((s) => s.enabled);

    if (sourceId && targetSources.length === 0) {
      throw new Error('未找到指定的订阅源。');
    }

    const now = new Date().toISOString();
    let expiredCount = 0;
    let restrictedCount = 0;
    const results = [];

    for (const s of targetSources) {
      if (s.source_type === 'builtin_catalog') {
        results.push({
          sourceId: s.id,
          name: s.name,
          status: 'synced',
          added: 0,
          updated: 0,
          expired: 0,
          message: `已加载 Actions 构建库 (${catalog.meta?.exportedAt ? catalog.meta.exportedAt.slice(0, 10) : '今日'} 同步 ${jobs.length} 岗)`,
        });
      } else if (s.source_type === 'lifecycle_audit') {
        let userExpired = 0;
        state.userJobs = state.userJobs.map((uj) => {
          const nextStatus = computeDeadlineStatus(uj);
          if (uj.status !== 'closed' && nextStatus === 'closed') userExpired += 1;
          return { ...uj, status: nextStatus };
        });
        expiredCount += userExpired;
        results.push({
          sourceId: s.id,
          name: s.name,
          status: 'synced',
          added: 0,
          updated: jobs.filter((j) => j.status === 'closing_soon').length,
          expired: userExpired,
          message: `浏览器实时巡检完成：临近截止预警 ${jobs.filter((j) => j.status === 'closing_soon').length} 岗，下线过期 ${jobs.filter((j) => j.status === 'closed').length} 岗`,
        });
      } else {
        restrictedCount += 1;
        const msg = '纯静态 GitHub Pages 环境受浏览器 CORS 限制，外网 RSS/HTML 源将在每日 GitHub Actions 自动构建或本地 npm start 时同步。';
        const idx = state.customSources.findIndex((cs) => cs.id === s.id);
        if (idx !== -1) {
          state.customSources[idx] = { ...state.customSources[idx], last_synced_at: now, last_status: 'restricted_portal', last_message: msg };
        }
        results.push({ sourceId: s.id, name: s.name, status: 'restricted_portal', added: 0, updated: 0, expired: 0, message: msg });
      }
    }

    const run = {
      id: Date.now(),
      trigger_type: 'manual',
      sources_checked: targetSources.length,
      added_count: 0,
      updated_count: results.reduce((s, r) => s + (r.updated || 0), 0),
      expired_count: expiredCount,
      restricted_count: restrictedCount,
      summary: results,
      started_at: now,
      finished_at: now,
    };
    state.syncRuns.unshift(run);
    state.syncRuns = state.syncRuns.slice(0, 15);
    saveLocalState(state);

    const statusAfter = await this.getSyncStatus();
    return {
      triggerType: 'manual',
      sourcesChecked: targetSources.length,
      addedCount: 0,
      updatedCount: run.updated_count,
      expiredCount,
      restrictedCount,
      results,
      finishedAt: now,
      counts: statusAfter.counts,
    };
  },

  async createSyncSource(data = {}) {
    const { name = '', sourceType = 'rss_atom', url = '', defaultCompanyId = null, autoIntervalHours = 6 } = data;
    if (!name.trim()) throw new Error('订阅源名称不能为空。');
    if (!['rss_atom', 'json_feed', 'html_jsonld'].includes(sourceType)) throw new Error('不支持的订阅源格式。');
    let parsedUrl;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      throw new Error('订阅源 URL 格式不合法，请输入完整的 http/https 地址。');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || isPrivateOrLoopbackHost(parsedUrl.hostname)) {
      throw new Error('仅支持公开 http/https 订阅源地址。');
    }

    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const created = {
      id: genId('src'),
      name: name.trim(),
      source_type: sourceType,
      url: parsedUrl.href,
      default_company_id: defaultCompanyId || null,
      enabled: true,
      is_builtin: false,
      auto_interval_hours: Math.max(1, Math.min(168, Number(autoIntervalHours) || 6)),
      last_synced_at: '',
      last_status: 'idle',
      last_message: '已保存；注：静态站点受浏览器跨域限制，建议用下方「批量导入」或本地服务抓取。',
      items_count: 0,
      created_at: new Date().toISOString(),
    };
    state.customSources.push(created);
    saveLocalState(state);
    return created;
  },

  async updateSyncSource(id, data = {}) {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const isBuiltin = (catalog.syncSources || []).some((s) => s.id === id);
    if (isBuiltin) {
      if (data.enabled === false) {
        if (!state.disabledBuiltinIds.includes(id)) state.disabledBuiltinIds.push(id);
      } else if (data.enabled === true) {
        state.disabledBuiltinIds = state.disabledBuiltinIds.filter((x) => x !== id);
      }
      saveLocalState(state);
      const status = await this.getSyncStatus();
      return status.sources.find((s) => s.id === id);
    }

    const idx = state.customSources.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('订阅源不存在。');
    state.customSources[idx] = {
      ...state.customSources[idx],
      ...(data.enabled !== undefined ? { enabled: Boolean(data.enabled) } : {}),
      ...(data.name !== undefined && String(data.name).trim() ? { name: String(data.name).trim() } : {}),
    };
    saveLocalState(state);
    return state.customSources[idx];
  },

  async deleteSyncSource(id) {
    const catalog = await fetchStaticCatalog();
    if ((catalog.syncSources || []).some((s) => s.id === id)) {
      throw new Error('系统内置目录与截止巡检源不可删除，可通过开关停用。');
    }
    const state = readLocalState(catalog);
    const before = state.customSources.length;
    state.customSources = state.customSources.filter((s) => s.id !== id);
    if (state.customSources.length === before) throw new Error('订阅源不存在。');
    saveLocalState(state);
    return { deleted: true, id };
  },

  async batchImportJobs(data = {}) {
    const { rawText = '', items = null, seasonTag = '' } = data;
    let parsedItems = Array.isArray(items) ? items : parseBatchLines(rawText);
    if (seasonTag && String(seasonTag).trim()) {
      parsedItems = parsedItems.map((it) => ({ ...it, seasonTag: it.seasonTag || String(seasonTag).trim() }));
    }
    if (!parsedItems.length) {
      throw new Error('未能识别有效校招条目，请使用 JSON 数组或「公司名, 岗位名, 城市, https://官网链接, [截止日期]」格式。');
    }

    const { state, companies, jobs } = await getHydratedContext();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const item of parsedItems) {
      let parsedUrl;
      try {
        parsedUrl = new URL(item.officialUrl);
      } catch {
        skipped += 1;
        continue;
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol) || isPrivateOrLoopbackHost(parsedUrl.hostname)) {
        skipped += 1;
        continue;
      }

      const rootDomain = extractRootDomain(parsedUrl.hostname);
      let company = companies.find(
        (c) => c.official_domain === rootDomain || c.name === item.companyName || c.short_name === item.companyName,
      );
      if (!company) {
        company = {
          id: genId('comp'),
          name: item.companyName,
          short_name: item.companyName.slice(0, 4),
          industry: '综合行业',
          company_type: '优质企业',
          official_domain: rootDomain,
          official_campus_url: parsedUrl.origin,
          search_url_template: parsedUrl.origin,
          badge_color: '#334155',
          hq_city: item.city || '全国多地',
          verification_status: 'user_submitted',
          last_verified_at: now,
          notes: '批量导入时自动补充的官方校招入口。',
        };
        companies.push(company);
        state.userCompanies.push(company);
      }

      const dupUserIdx = state.userJobs.findIndex((uj) => uj.official_source_url === parsedUrl.href);
      const dupBuiltin = jobs.find((j) => j.official_source_url === parsedUrl.href);
      if (dupUserIdx !== -1) {
        state.userJobs[dupUserIdx] = {
          ...state.userJobs[dupUserIdx],
          title: item.title,
          city: item.city || state.userJobs[dupUserIdx].city,
          deadline: item.deadline || state.userJobs[dupUserIdx].deadline,
          last_checked_at: now,
        };
        updated += 1;
      } else if (dupBuiltin) {
        updated += 1;
      } else {
        const cleanCity = item.city || '全国多地';
        const job = {
          id: genId('job'),
          company_id: company.id,
          title: item.title,
          category: '技术研发',
          season_tag: item.seasonTag || '2027届秋招补录',
          graduation_years: ['2027'],
          province: cleanCity,
          city: cleanCity,
          city_tier: inferCityTier(cleanCity),
          official_source_url: parsedUrl.href,
          official_domain: rootDomain,
          deadline: item.deadline || '招满即止',
          status: 'open',
          is_referral: false,
          salary_range: '',
          requirements_summary: '由用户批量导入的官方校招信息，请点击直达官网查看完整岗位说明。',
          sync_source: 'batch_import',
          last_checked_at: now,
          created_at: now,
        };
        job.status = computeDeadlineStatus(job);
        state.userJobs.unshift(job);
        updated += 0;
        added += 1;
      }
    }

    state.syncRuns.unshift({
      id: Date.now(),
      trigger_type: 'batch_import',
      sources_checked: 1,
      added_count: added,
      updated_count: updated,
      expired_count: 0,
      restricted_count: 0,
      summary: [{ sourceId: 'batch_import', name: '批量文本导入', status: 'synced', added, updated, expired: 0 }],
      started_at: now,
      finished_at: now,
    });
    saveLocalState(state);

    const status = await this.getSyncStatus();
    return {
      added,
      updated,
      skipped,
      parsedCount: parsedItems.length,
      lifecycleStats: { expiredCount: 0, closingSoonCount: 0, reopenedCount: 0 },
      counts: status.counts,
    };
  },

  async exportPersonalBackup() {
    const catalog = await fetchStaticCatalog();
    const state = readLocalState(catalog);
    const backup = {
      app: 'zhihang-campus-recruit-assistant',
      version: 1,
      exportedAt: new Date().toISOString(),
      resumes: state.resumes,
      applications: state.applications,
      userJobs: state.userJobs,
      userCompanies: state.userCompanies,
    };
    const dateTag = new Date().toISOString().slice(0, 10);
    triggerDownload(`zhihang-backup-${dateTag}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
    return { resumesCount: state.resumes.length, applicationsCount: state.applications.length };
  },

  async importPersonalBackup(rawText) {
    let parsed;
    try {
      parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    } catch {
      throw new Error('备份文件不是有效的 JSON 格式。');
    }
    if (!parsed || !Array.isArray(parsed.resumes) || !Array.isArray(parsed.applications)) {
      throw new Error('备份文件缺少 resumes 或 applications 字段，请确认是从本站导出的备份文件。');
    }
    const catalog = await fetchStaticCatalog();
    const current = readLocalState(catalog);
    const nextState = {
      ...current,
      seededVersion: 1,
      resumes: parsed.resumes.length > 0 ? parsed.resumes : current.resumes,
      applications: parsed.applications,
      userJobs: Array.isArray(parsed.userJobs) ? parsed.userJobs : current.userJobs,
      userCompanies: Array.isArray(parsed.userCompanies) ? parsed.userCompanies : current.userCompanies,
    };
    saveLocalState(nextState);
    return {
      resumesCount: nextState.resumes.length,
      applicationsCount: nextState.applications.length,
    };
  },
};
