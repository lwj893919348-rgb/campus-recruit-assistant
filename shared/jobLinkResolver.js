/**
 * Shared link specificity resolver and core search keyword extractor.
 * Ensures jobs strictly distinguish between:
 *  - 'detail': Direct link to a specific live official job posting page
 *  - 'search': Pre-filled official website position search URL (for curated reference roles)
 *  - 'portal': Official recruitment homepage fallback
 */

const LIVE_SYNC_SOURCES = new Set([
  'beisen_zhiye',
  'hotjob_wecruit',
  'greenhouse',
  'lever',
  'ashby',
  'moka_open',
  'feishu_hire',
  'external_feed',
  'rss_atom',
  'json_feed',
  'html_jsonld',
  'user_submitted',
]);

const DETAIL_URL_PATTERNS = [
  /\/JobAd\/Info\b/i,
  /[?&]adid=[^&]+/i,
  /\/zpdetail\/[^/?#]+/i,
  /\/posDetail\.html\b/i,
  /[?&](?:postId|jobId|positionId|recruitId|job_id|position_id)=[^&]+/i,
  /boards(?:-api)?\.greenhouse\.io\/[^/]+\/jobs\/\d+/i,
  /job-boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/i,
  /jobs\.lever\.co\/[^/]+\/[0-9a-f-]{8,}/i,
  /jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{8,}/i,
  /\/(?:position|job|post|jobs|positions)\/(?:detail|info|view)\/[0-9a-zA-Z_-]{3,}/i,
  /\/(?:jobs|position|detail)\/\d{4,}/i,
];

function normalizeUrlComparable(rawUrl = '') {
  try {
    const u = new URL(String(rawUrl || '').trim());
    const pathname = u.pathname.replace(/\/+$/, '').replace(/\/index\.html?$/i, '') || '';
    const hash = u.hash === '#/' || u.hash === '#/index' || u.hash === '#' ? '' : u.hash;
    const search = u.search === '?' ? '' : u.search;
    return `${u.origin.toLowerCase()}${pathname}${search}${hash}`;
  } catch {
    return String(rawUrl || '').trim().toLowerCase();
  }
}

export function isPortalRootUrl(rawUrl = '', companyUrls = []) {
  const norm = normalizeUrlComparable(rawUrl);
  if (!norm) return true;
  for (const cand of companyUrls || []) {
    if (!cand) continue;
    if (normalizeUrlComparable(cand) === norm) return true;
  }
  return false;
}

export function isSpecificJobDetailUrl(rawUrl = '', companyUrls = []) {
  const str = String(rawUrl || '').trim();
  if (!str) return false;
  if (DETAIL_URL_PATTERNS.some((re) => re.test(str))) {
    return true;
  }
  return false;
}

export function isFunctionalSearchTemplate(template = '') {
  const tpl = String(template || '').trim();
  if (!tpl || !tpl.includes('{q}')) return false;
  // Recognize authentic website search query keys (excludes auto-generated generic ?q={q} homepage placeholders)
  return /(?:[?&#/])(?:keywords|keyword|search|k|key|name|postKey|positionName|jobName|query|searchKey|searchWord|word)=\{q\}/i.test(
    tpl,
  );
}

export function extractConciseSearchKeyword(title = '', companyShortName = '', companyName = '') {
  let text = String(title || '').trim();
  if (!text) return '';

  // Remove parenthetical qualifiers like （阿里云基础产品）、(北京/上海)、【校招】
  text = text
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .replace(/[【\[][^】\]]*[】\]]/g, ' ');

  // Remove leading/inline company name prefixes and recruitment season noise
  for (const alias of [companyName, companyShortName].filter((s) => s && s.length >= 2)) {
    text = text.split(alias).join(' ');
  }
  text = text
    .replace(/202\d\s*届?(?:春季|秋季|暑期|校园|社会)?(?:招聘|秋招|春招|补录|实习)?/gi, ' ')
    .replace(/(?:校园招聘|社会招聘|日常实习|暑期实习|校招|社招|留用制|急聘|专项计划)/g, ' ');

  // Split composite titles and select the cleanest core role phrase
  const segments = text
    .split(/[·/|｜、—]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 2);

  let core = segments[0] || text.replace(/\s+/g, ' ').trim();
  // Prefer the second segment if the first looks like a pure program title (e.g. "TET 管培生 · 供应链算法...")
  if (segments.length >= 2 && segments[0].length <= 6 && /计划|项目|之星|培训生|管培/.test(segments[0])) {
    core = segments[1];
  }

  // Strip overly broad leading modifiers ("资深", "高级") for higher official-site search recall
  core = core.replace(/^(?:资深|高级|中级|初级)\s*/g, '').trim();
  if (core.length > 14) {
    core = core.slice(0, 12).trim();
  }
  return core || String(title || '').slice(0, 10).trim();
}

export function resolveJobOfficialTarget(job = {}) {
  const sourceUrl = String(job.official_source_url || '').trim();
  const portalUrls = [job.company_portal_url, job.company_social_url].filter(Boolean);
  const externalId = String(job.external_id || '').trim();
  const syncSource = String(job.sync_source || '').trim();
  const isPortalRoot = isPortalRootUrl(sourceUrl, portalUrls);
  const matchesDetailPattern = isSpecificJobDetailUrl(sourceUrl, portalUrls);
  const isLiveOrSubmittedSource = LIVE_SYNC_SOURCES.has(syncSource);

  const isExactDetail =
    matchesDetailPattern ||
    (Boolean(externalId) && !isPortalRoot) ||
    (isLiveOrSubmittedSource && !isPortalRoot);

  if (isExactDetail && sourceUrl) {
    return {
      href: sourceUrl,
      targetType: 'detail',
      isExactDetail: true,
      badgeText: '官网原岗 · 直达详情',
      buttonLabel: '直达岗位详情页',
      searchKeyword: '',
      tooltip: `来自官网实时/明确详情直链（${sourceUrl}）`,
    };
  }

  const searchTemplate = String(job.company_search_url_template || '').trim();
  const isSocialRole = job.recruit_type === '社会招聘';
  const campusOnlyTemplate = /\/campus|recruitType=GRADUATE|校招/i.test(searchTemplate);
  const canUseSearchTemplate =
    isFunctionalSearchTemplate(searchTemplate) && !(isSocialRole && campusOnlyTemplate && job.company_social_url);

  if (canUseSearchTemplate) {
    const keyword = extractConciseSearchKeyword(
      job.title,
      job.company_short_name || '',
      job.company_name || '',
    );
    const searchHref = searchTemplate.replace('{q}', encodeURIComponent(keyword));
    return {
      href: searchHref,
      targetType: 'search',
      isExactDetail: false,
      badgeText: '参考方向 · 搜官网核验',
      buttonLabel: '去官网搜同类岗位',
      searchKeyword: keyword,
      tooltip: `该企业门户暂未接入匿名逐条抓新，将按关键词「${keyword}」打开官网实时搜岗页`,
    };
  }

  const fallbackHref =
    isSocialRole && job.company_social_url && isPortalRoot
      ? job.company_social_url
      : sourceUrl || job.company_portal_url || job.company_social_url || '';

  return {
    href: fallbackHref,
    targetType: 'portal',
    isExactDetail: false,
    badgeText: '官网入口 · 参考方向',
    buttonLabel: isSocialRole ? '前往社招官网页' : '前往官网招聘页',
    searchKeyword: '',
    tooltip: '该企业官网受登录或加密保护，点击直达官方招聘主页查看最新在招列表',
  };
}
