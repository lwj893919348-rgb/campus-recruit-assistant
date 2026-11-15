import { inferCategory, inferCityInfo, inferRecruitTypeAndExp } from '../../shared/jobParser.js';
import { detectAtsPlatform } from '../../shared/atsPlatforms.js';
import { isPrivateOrLoopbackHost } from './officialVerifier.js';

const BLOCKED_PORTAL_STATUSES = new Set([401, 403, 405, 418, 429]);

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

function isWechatHostname(hostname = '') {
  const h = String(hostname || '').toLowerCase();
  return h === 'mp.weixin.qq.com' || h.endsWith('.weixin.qq.com') || h === 'weixin.qq.com';
}

function validateSafeTargetUrl(rawUrl, allowPrivateHosts = false) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return { ok: false, blocked: false, reason: 'URL 格式无效' };
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    return { ok: false, blocked: true, reason: '仅支持 http/https 协议' };
  }
  if (isWechatHostname(u.hostname)) {
    return { ok: false, blocked: true, reason: '严守微信合规边界：禁止自动抓取公众号文章链接' };
  }
  if (!allowPrivateHosts && isPrivateOrLoopbackHost(u.hostname)) {
    return { ok: false, blocked: true, reason: '禁止请求内网或回环保留地址' };
  }
  return { ok: true, url: u };
}

function stripHtmlTags(raw = '', maxLen = 400) {
  const cleaned = String(raw || '')
    .replace(/<br\s*\/?>/gi, '；')
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '；')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .replace(/(；\s*){2,}/g, '；')
    .trim();
  if (!cleaned) return '';
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function normalizeDateOnly(raw = '') {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return '';
  const year = Number(m[1]);
  // Filter sentinel placeholder dates used by ATS systems (e.g. 0001-01-01, 1900-01-01, 3000-01-01)
  if (year < 2000 || year >= 2999) return '';
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildNormalizedItem({
  externalId,
  title,
  companyName = '',
  officialUrl,
  cityRaw = '',
  recruitTypeHint = '',
  experienceHint = '',
  seasonHint = '',
  salaryRange = '',
  deadline = '',
  publishedAt = '',
  description = '',
  requirements = '',
  categoryHint = '',
  sourceTags = [],
}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return null;

  const combinedText = `${cleanTitle} ${categoryHint} ${description} ${requirements}`;
  const cityInfo = inferCityInfo(cityRaw, combinedText);
  const category = inferCategory(cleanTitle, `${categoryHint} ${description}`);
  const inferredType = inferRecruitTypeAndExp({
    title: cleanTitle,
    recruitType: recruitTypeHint,
    experienceReq: experienceHint,
    seasonTag: seasonHint,
    contextText: combinedText,
  });

  return {
    externalId: String(externalId || `${officialUrl}:${cleanTitle}`).trim(),
    title: cleanTitle,
    companyName: String(companyName || '').trim(),
    officialUrl: String(officialUrl || '').trim(),
    city: cityInfo.city,
    category,
    recruitType: inferredType.recruitType,
    experienceReq: inferredType.experienceReq,
    seasonTag: inferredType.seasonTag,
    graduationYears: inferredType.graduationYears,
    salaryRange: String(salaryRange || '').trim() || '薪资面议/官网披露',
    deadline: String(deadline || '').trim() || '长期有效/招满即止',
    publishedAt: String(publishedAt || '').trim() || new Date().toISOString().slice(0, 10),
    description: String(description || '').trim(),
    requirements: String(requirements || '').trim() || '详情见官网职位要求',
    sourceTags: Array.isArray(sourceTags) ? sourceTags : [],
  };
}

function extractBeisenPortalId(html = '', urlObj) {
  const queryId =
    urlObj?.searchParams?.get('portalId') ||
    urlObj?.searchParams?.get('PortalId') ||
    urlObj?.searchParams?.get('portalid');
  if (queryId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryId.trim())) {
    return queryId.trim();
  }
  const patterns = [
    /PortalId[^0-9a-fA-F]{1,20}([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i,
    /portalId["'\s:=]+([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i,
    /data-portal-id=["']([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})["']/i,
  ];
  for (const re of patterns) {
    const m = String(html || '').match(re);
    if (m?.[1]) return m[1];
  }
  return '';
}

async function syncBeisenZhiye(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs, maxPages = 3, pageSize = 50, parseJsonLdJobPostings } = ctx;
  const pageRes = await fetchWithTimeout(fetchImpl, parsedUrl.href, { method: 'GET' }, timeoutMs);
  if (pageRes.url) {
    const redirCheck = validateSafeTargetUrl(pageRes.url, allowPrivateHosts);
    if (!redirCheck.ok) {
      return {
        status: redirCheck.blocked ? 'blocked' : 'unreachable',
        items: [],
        message: `北森门户重定向地址安全校验失败：${redirCheck.reason}`,
      };
    }
  }
  if (BLOCKED_PORTAL_STATUSES.has(pageRes.status)) {
    return {
      status: 'restricted_portal',
      items: [],
      message: `北森门户返回访问限制（HTTP ${pageRes.status}），严守合规边界跳过`,
    };
  }
  if (!pageRes.ok) {
    return { status: 'unreachable', items: [], message: `北森门户响应 HTTP ${pageRes.status}` };
  }

  const html = await pageRes.text();
  const portalId = extractBeisenPortalId(html, parsedUrl);
  if (!portalId) {
    const jsonLdItems = parseJsonLdJobPostings?.(html, parsedUrl.href, source.name) || [];
    if (jsonLdItems.length > 0) {
      return {
        status: 'synced',
        items: jsonLdItems,
        message: `从北森页面公开 JSON-LD 同步 ${jsonLdItems.length} 条岗位`,
      };
    }
    return {
      status: 'unreachable',
      items: [],
      message: '未能在北森公开门户 HTML 中提取 PortalId，请确认配置为企业招聘主页地址',
    };
  }

  const lowerHref = parsedUrl.href.toLowerCase();
  const categories =
    lowerHref.includes('/campus') || lowerHref.includes('xiaozhao')
      ? ['2']
      : lowerHref.includes('/social') || lowerHref.includes('shezhao')
        ? ['1']
        : ['1', '2'];

  const apiUrl = `${parsedUrl.origin}/api/Jobad/GetJobAdPageList`;
  const items = [];
  const seenKeys = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    const apiRes = await fetchWithTimeout(
      fetchImpl,
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json',
          Referer: parsedUrl.href,
        },
        body: JSON.stringify({
          PageIndex: page,
          PageSize: pageSize,
          KeyWords: '',
          SpecialType: 0,
          PortalId: portalId,
          Category: categories,
        }),
      },
      timeoutMs,
    );

    if (BLOCKED_PORTAL_STATUSES.has(apiRes.status)) {
      if (items.length > 0) break;
      return {
        status: 'restricted_portal',
        items: [],
        message: `北森公开列表接口返回限制（HTTP ${apiRes.status}），严守合规边界跳过`,
      };
    }
    if (!apiRes.ok) {
      if (items.length > 0) break;
      return { status: 'unreachable', items: [], message: `北森列表接口响应 HTTP ${apiRes.status}` };
    }

    let payload;
    try {
      payload = await apiRes.json();
    } catch {
      if (items.length > 0) break;
      return { status: 'unreachable', items: [], message: '北森列表接口返回非 JSON 内容' };
    }

    const rows = Array.isArray(payload?.Data) ? payload.Data : [];
    const totalCount = Number(payload?.Count || 0);
    if (rows.length === 0) break;

    for (const row of rows) {
      const adId = String(row.JobAdId || row.Id || '').trim();
      const title = String(row.JobAdName || row.Title || '').trim();
      if (!title) continue;

      const dedupeKey = adId || title;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const catId = String(row.CategoryId || '').trim();
      const catName = String(row.CategoryName || '').trim();
      let recruitTypeHint = '';
      if (/实习|intern/i.test(title) || /实习/.test(catName)) {
        recruitTypeHint = '实习兼职';
      } else if (catId === '2' || /校/.test(catName)) {
        recruitTypeHint = '校园招聘';
      } else if (catId === '1' || /社/.test(catName)) {
        recruitTypeHint = '社会招聘';
      }

      const cityRaw =
        String(row.LocNames || row.WorkCityName || row.CityName || '')
          .split(/[、,/|；;]/)
          .map((s) => s.trim())
          .find(Boolean) || '';
      const duty = stripHtmlTags(row.Duty || row.JobDuty || '', 240);
      const require = stripHtmlTags(row.Require || row.JobRequire || '', 240);
      const officialUrl = adId
        ? `${parsedUrl.origin}/JobAd/Info?adid=${encodeURIComponent(adId)}`
        : parsedUrl.href;

      const normalized = buildNormalizedItem({
        externalId: `beisen:${portalId}:${dedupeKey}`,
        title,
        companyName: String(row.CompanyName || row.OrgName || '').trim(),
        officialUrl,
        cityRaw,
        recruitTypeHint,
        salaryRange: String(row.Salary || row.SalaryName || '').trim(),
        deadline: normalizeDateOnly(row.EndTime || row.EndDate || '') || '长期有效/招满即止',
        publishedAt: normalizeDateOnly(row.PostDate || row.ChangeDate || ''),
        description: duty,
        requirements: require || duty,
        categoryHint: `${catName} ${row.ClassificationName || ''} ${row.DepartmentName || ''}`,
        sourceTags: ['beisen_zhiye', 'ats_verified'],
      });
      if (normalized) items.push(normalized);
    }

    if (rows.length < pageSize || (totalCount > 0 && seenKeys.size >= totalCount)) {
      break;
    }
  }

  return {
    status: 'synced',
    items,
    message: `北森公开接口同步完成（PortalId: ${portalId.slice(0, 8)}…，获取 ${items.length} 条岗位）`,
  };
}

function extractSuKey(text = '') {
  const m = String(text || '').match(/\b(SU[0-9a-fA-F]{16,})\b/);
  return m?.[1] || '';
}

async function syncHotjobWecruit(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs, maxPages = 2, pageSize = 50 } = ctx;
  let portalLink = parsedUrl.href;
  let suKey = extractSuKey(parsedUrl.href);

  if (!suKey) {
    const sldUrl = `${parsedUrl.origin}/wecruit/common/getSLD`;
    const sldRes = await fetchWithTimeout(
      fetchImpl,
      sldUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
          Referer: parsedUrl.href,
        },
        body: new URLSearchParams({ sld: parsedUrl.hostname }).toString(),
      },
      timeoutMs,
    );

    if (BLOCKED_PORTAL_STATUSES.has(sldRes.status)) {
      return {
        status: 'restricted_portal',
        items: [],
        message: `大易 HotJob 域名解析接口返回限制（HTTP ${sldRes.status}），严守合规边界跳过`,
      };
    }

    if (sldRes.ok) {
      try {
        const sldJson = await sldRes.json();
        const rawTargetLink = sldJson?.data?.linkData?.link || sldJson?.data?.link || '';
        if (rawTargetLink) {
          let resolved;
          try {
            resolved = new URL(rawTargetLink, parsedUrl.origin);
          } catch {
            resolved = null;
          }
          if (!resolved) {
            return { status: 'unreachable', items: [], message: 'HotJob getSLD 返回跳转链接格式无效' };
          }
          const safety = validateSafeTargetUrl(resolved.href, allowPrivateHosts);
          if (!safety.ok) {
            return {
              status: safety.blocked ? 'blocked' : 'unreachable',
              items: [],
              message: `HotJob getSLD 返回不安全目标地址已拦截：${safety.reason}`,
            };
          }
          portalLink = safety.url.href;
          suKey = extractSuKey(portalLink);
          if (!suKey && safety.url.pathname.includes('/wt/')) {
            return {
              status: 'synced',
              items: [],
              message: '旧版 HotJob /wt/ 静态门户未开放标准 SU 接口，请直达官网浏览或手动录入',
            };
          }
        }
      } catch {
        // Continue to gentle HTML check below
      }
    }
  }

  if (!suKey) {
    const htmlRes = await fetchWithTimeout(fetchImpl, portalLink, { method: 'GET' }, timeoutMs);
    if (BLOCKED_PORTAL_STATUSES.has(htmlRes.status)) {
      return {
        status: 'restricted_portal',
        items: [],
        message: `HotJob 门户返回访问限制（HTTP ${htmlRes.status}），严守合规边界跳过`,
      };
    }
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      suKey = extractSuKey(html);
    }
  }

  if (!suKey) {
    return {
      status: 'synced',
      items: [],
      message: '未检测到 HotJob 标准 SU 企业标识（可能为旧版模板），请使用官网直达或公告粘贴导入',
    };
  }

  const apiOrigin =
    allowPrivateHosts && isPrivateOrLoopbackHost(parsedUrl.hostname)
      ? parsedUrl.origin
      : 'https://wecruit.hotjob.cn';
  const originSafety = validateSafeTargetUrl(apiOrigin, allowPrivateHosts);
  if (!originSafety.ok) {
    return {
      status: 'blocked',
      items: [],
      message: `HotJob API 域名安全校验未通过：${originSafety.reason}`,
    };
  }

  const channels = [];
  const lowerLink = portalLink.toLowerCase();
  if (lowerLink.includes('recruittype=1')) channels.push('1');
  else if (lowerLink.includes('recruittype=2')) channels.push('2');
  else if (lowerLink.includes('recruittype=3')) channels.push('3');
  else channels.push('1', '2', '3');

  const apiUrl = `${apiOrigin}/wecruit/positionInfo/listPosition/${encodeURIComponent(suKey)}`;
  const items = [];
  const seenKeys = new Set();

  for (const ch of channels) {
    for (let page = 1; page <= maxPages; page += 1) {
      const formBody = new URLSearchParams({
        isFrompb: 'true',
        recruitType: ch,
        pageSize: String(pageSize),
        currentPage: String(page),
        pageNum: String(page),
      }).toString();

      const res = await fetchWithTimeout(
        fetchImpl,
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
            Referer: portalLink,
          },
          body: formBody,
        },
        timeoutMs,
      );

      if (BLOCKED_PORTAL_STATUSES.has(res.status)) {
        if (items.length > 0) break;
        return {
          status: 'restricted_portal',
          items: [],
          message: `HotJob 岗位接口返回限制（HTTP ${res.status}），严守合规边界跳过`,
        };
      }
      if (!res.ok) break;

      let json;
      try {
        json = await res.json();
      } catch {
        break;
      }

      const pageForm = json?.data?.pageForm || {};
      const rows = Array.isArray(pageForm.pageData)
        ? pageForm.pageData
        : Array.isArray(json?.data?.list)
          ? json.data.list
          : [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const postId = String(row.postId || row.externalKey || row.id || '').trim();
        const title = String(row.postName || row.title || '').trim();
        if (!title) continue;

        const key = `${ch}:${postId || title}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const rTypeCode = String(row.recruitType ?? ch).trim();
        let recruitTypeHint = '';
        if (rTypeCode === '3' || /实习|intern/i.test(title)) {
          recruitTypeHint = '实习兼职';
        } else if (rTypeCode === '1') {
          recruitTypeHint = '校园招聘';
        } else if (rTypeCode === '2') {
          recruitTypeHint = '社会招聘';
        }

        const cityRaw =
          String(row.workPlaceStr || row.workPlace || row.cityName || '')
            .split(/[、,/|；;]/)
            .map((s) => s.trim())
            .find(Boolean) || '';
        const normalizedEnd = normalizeDateOnly(row.endDate || row.closeDate || '');
        const isLongTerm = row.longTermRelease === 1 || row.longTermRelease === true;
        const deadline = isLongTerm || !normalizedEnd ? '长期有效/招满即止' : normalizedEnd;
        const requirements = stripHtmlTags(
          row.serviceCondition || row.workContent || row.department || row.postTypeName || '',
          320,
        );

        const normalized = buildNormalizedItem({
          externalId: `hotjob:${suKey}:${key}`,
          title,
          companyName: String(row.companyName || row.corpName || '').trim(),
          officialUrl: portalLink,
          cityRaw,
          recruitTypeHint,
          salaryRange: String(row.salaryStr || row.salary || '').trim(),
          deadline,
          publishedAt: normalizeDateOnly(row.publishDate || row.createTime || ''),
          description: stripHtmlTags(row.workContent || row.department || '', 280),
          requirements,
          categoryHint: `${row.postTypeName || ''} ${row.department || ''} ${row.recruitmentType || ''}`,
          sourceTags: ['hotjob_wecruit', 'ats_verified'],
        });
        if (normalized) items.push(normalized);
      }

      const totalPage = Number(pageForm.totalPage || 0);
      if (rows.length < pageSize || (totalPage > 0 && page >= totalPage)) {
        break;
      }
    }
  }

  return {
    status: 'synced',
    items,
    message: `大易 HotJob 公开接口同步完成（${suKey}，获取 ${items.length} 条岗位）`,
  };
}

function extractLastNonEmptySegment(pathname = '') {
  const segs = String(pathname || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  return segs[0] || '';
}

async function syncGreenhouseBoard(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs } = ctx;
  const host = parsedUrl.hostname.toLowerCase();
  const isLocalTest = allowPrivateHosts && isPrivateOrLoopbackHost(host);
  const segs = parsedUrl.pathname.split('/').filter(Boolean);
  const token =
    host === 'boards-api.greenhouse.io' && segs[2] ? segs[2] : extractLastNonEmptySegment(parsedUrl.pathname);

  if (!token) {
    return { status: 'unreachable', items: [], message: '无法从 Greenhouse URL 提取企业 board token' };
  }

  const apiUrl = isLocalTest
    ? parsedUrl.pathname.includes('/v1/boards/')
      ? parsedUrl.href
      : `${parsedUrl.origin}/v1/boards/${encodeURIComponent(token)}/jobs?content=true`
    : `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;

  const res = await fetchWithTimeout(fetchImpl, apiUrl, { method: 'GET', headers: { Accept: 'application/json' } }, timeoutMs);
  if (BLOCKED_PORTAL_STATUSES.has(res.status)) {
    return { status: 'restricted_portal', items: [], message: `Greenhouse 返回访问限制 HTTP ${res.status}` };
  }
  if (!res.ok) {
    return { status: 'unreachable', items: [], message: `Greenhouse 接口响应 HTTP ${res.status}` };
  }

  const json = await res.json();
  const rows = Array.isArray(json?.jobs) ? json.jobs : [];
  const items = rows
    .map((job) =>
      buildNormalizedItem({
        externalId: `greenhouse:${token}:${job.id || job.title}`,
        title: job.title,
        companyName: job.company_name || '',
        officialUrl: job.absolute_url || parsedUrl.href,
        cityRaw: job.location?.name || '',
        publishedAt: normalizeDateOnly(job.updated_at || ''),
        description: stripHtmlTags(job.content || '', 350),
        requirements: stripHtmlTags(job.content || '', 300),
        categoryHint: (job.departments || []).map((d) => d.name).join(' '),
        sourceTags: ['greenhouse', 'ats_verified'],
      }),
    )
    .filter(Boolean);

  return {
    status: 'synced',
    items,
    message: `Greenhouse 公开看板（${token}）同步 ${items.length} 条岗位`,
  };
}

async function syncLeverBoard(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs } = ctx;
  const host = parsedUrl.hostname.toLowerCase();
  const isLocalTest = allowPrivateHosts && isPrivateOrLoopbackHost(host);
  const segs = parsedUrl.pathname.split('/').filter(Boolean);
  const site = host === 'api.lever.co' && segs[2] ? segs[2] : segs[0] || '';

  if (!site) {
    return { status: 'unreachable', items: [], message: '无法从 Lever URL 提取企业站点标识' };
  }

  const apiUrl = isLocalTest
    ? parsedUrl.pathname.includes('/v0/postings/')
      ? parsedUrl.href
      : `${parsedUrl.origin}/v0/postings/${encodeURIComponent(site)}?mode=json`
    : `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;

  const res = await fetchWithTimeout(fetchImpl, apiUrl, { method: 'GET', headers: { Accept: 'application/json' } }, timeoutMs);
  if (BLOCKED_PORTAL_STATUSES.has(res.status)) {
    return { status: 'restricted_portal', items: [], message: `Lever 返回访问限制 HTTP ${res.status}` };
  }
  if (!res.ok) {
    return { status: 'unreachable', items: [], message: `Lever 接口响应 HTTP ${res.status}` };
  }

  const rows = await res.json();
  const list = Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
  const items = list
    .map((p) => {
      const createdDate = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '';
      return buildNormalizedItem({
        externalId: `lever:${site}:${p.id || p.text}`,
        title: p.text,
        officialUrl: p.hostedUrl || p.applyUrl || parsedUrl.href,
        cityRaw: p.categories?.location || '',
        publishedAt: createdDate,
        description: stripHtmlTags(p.descriptionPlain || p.description || '', 350),
        requirements: stripHtmlTags(p.descriptionPlain || p.additionalPlain || '', 300),
        categoryHint: `${p.categories?.team || ''} ${p.categories?.department || ''} ${p.categories?.commitment || ''}`,
        sourceTags: ['lever', 'ats_verified'],
      });
    })
    .filter(Boolean);

  return {
    status: 'synced',
    items,
    message: `Lever 公开看板（${site}）同步 ${items.length} 条岗位`,
  };
}

async function syncAshbyBoard(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs } = ctx;
  const host = parsedUrl.hostname.toLowerCase();
  const isLocalTest = allowPrivateHosts && isPrivateOrLoopbackHost(host);
  const segs = parsedUrl.pathname.split('/').filter(Boolean);
  const org = host === 'api.ashbyhq.com' && segs[2] ? segs[2] : segs[0] || '';

  if (!org) {
    return { status: 'unreachable', items: [], message: '无法从 Ashby URL 提取企业标识' };
  }

  const apiUrl = isLocalTest
    ? parsedUrl.pathname.includes('/posting-api/')
      ? parsedUrl.href
      : `${parsedUrl.origin}/posting-api/job-board/${encodeURIComponent(org)}`
    : `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`;

  const res = await fetchWithTimeout(fetchImpl, apiUrl, { method: 'GET', headers: { Accept: 'application/json' } }, timeoutMs);
  if (BLOCKED_PORTAL_STATUSES.has(res.status)) {
    return { status: 'restricted_portal', items: [], message: `Ashby 返回访问限制 HTTP ${res.status}` };
  }
  if (!res.ok) {
    return { status: 'unreachable', items: [], message: `Ashby 接口响应 HTTP ${res.status}` };
  }

  const json = await res.json();
  const rows = Array.isArray(json?.jobs) ? json.jobs : [];
  const items = rows
    .map((j) =>
      buildNormalizedItem({
        externalId: `ashby:${org}:${j.id || j.title}`,
        title: j.title,
        officialUrl: j.jobUrl || j.applyUrl || parsedUrl.href,
        cityRaw: j.location || (Array.isArray(j.secondaryLocations) ? j.secondaryLocations[0]?.location : ''),
        publishedAt: normalizeDateOnly(j.publishedAt || ''),
        description: stripHtmlTags(j.descriptionPlain || j.descriptionHtml || '', 350),
        requirements: stripHtmlTags(j.descriptionPlain || '', 300),
        categoryHint: `${j.department || ''} ${j.team || ''} ${j.employmentType || ''}`,
        sourceTags: ['ashby', 'ats_verified'],
      }),
    )
    .filter(Boolean);

  return {
    status: 'synced',
    items,
    message: `Ashby 公开看板（${org}）同步 ${items.length} 条岗位`,
  };
}

function parsePlaintextMokaList(rows = [], portalUrl = '') {
  return rows
    .map((row) =>
      buildNormalizedItem({
        externalId: `moka:${row.id || row.mjCode || row.title}`,
        title: row.title || row.jobName,
        companyName: row.orgName || row.companyName || '',
        officialUrl: row.url || row.applyUrl || portalUrl,
        cityRaw:
          (Array.isArray(row.locations) ? row.locations[0]?.address || row.locations[0]?.city : '') ||
          row.city ||
          '',
        publishedAt: normalizeDateOnly(row.publishedAt || row.updatedAt || ''),
        description: stripHtmlTags(row.description || row.jobDescription || '', 320),
        requirements: stripHtmlTags(row.requirement || row.requirements || '', 300),
        categoryHint: `${row.department?.name || ''} ${row.zhineng?.name || ''} ${row.commitment || ''}`,
        sourceTags: ['moka_open', 'ats_verified'],
      }),
    )
    .filter(Boolean);
}

async function syncMokaOpen(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs, parseJsonLdJobPostings } = ctx;
  const res = await fetchWithTimeout(fetchImpl, parsedUrl.href, { method: 'GET' }, timeoutMs);
  if (res.url) {
    const redirCheck = validateSafeTargetUrl(res.url, allowPrivateHosts);
    if (!redirCheck.ok) {
      return {
        status: redirCheck.blocked ? 'blocked' : 'unreachable',
        items: [],
        message: `Moka 门户跳转校验失败：${redirCheck.reason}`,
      };
    }
  }
  if (BLOCKED_PORTAL_STATUSES.has(res.status)) {
    return {
      status: 'restricted_portal',
      items: [],
      message: `Moka 门户返回访问限制（HTTP ${res.status}），严守合规边界跳过，请通过官网直达或公众号公告提取`,
    };
  }
  if (!res.ok) {
    return { status: 'unreachable', items: [], message: `Moka 门户响应 HTTP ${res.status}` };
  }

  const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
  const rawBody = await res.text();
  const trimmed = rawBody.trim();

  // Check if response itself is JSON (e.g. a configured Moka API endpoint or ciphertext JSON)
  if (contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      // STRICT COMPLIANCE GUARD: Moka encrypted payload {"data": "<ciphertext string>"}
      if (parsed && typeof parsed.data === 'string' && !Array.isArray(parsed.jobs)) {
        return {
          status: 'restricted_portal',
          items: [],
          message: 'Moka 门户启用载荷加密保护（密文响应），严守合规边界跳过破解，请使用官网直达或公众号公告解析',
        };
      }
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.jobs)
          ? parsed.jobs
          : Array.isArray(parsed?.data?.jobs)
            ? parsed.data.jobs
            : null;
      if (rows) {
        const items = parsePlaintextMokaList(rows, parsedUrl.href);
        return {
          status: 'synced',
          items,
          message: `从 Moka 公开明文接口同步 ${items.length} 条岗位`,
        };
      }
    } catch {
      // Not valid JSON; continue to HTML JSON-LD check
    }
  }

  const jsonLdItems = parseJsonLdJobPostings?.(rawBody, parsedUrl.href, source.name) || [];
  if (jsonLdItems.length > 0) {
    return {
      status: 'synced',
      items: jsonLdItems,
      message: `从 Moka 公开页面提取到 ${jsonLdItems.length} 条明文 JSON-LD 岗位`,
    };
  }

  return {
    status: 'restricted_portal',
    items: [],
    message: 'Moka 门户启用加密载荷或动态渲染保护（无公开明文 JSON-LD），严守合规边界跳过破解，请使用官网直达或公告粘贴导入',
  };
}

async function syncFeishuHire(source, parsedUrl, ctx) {
  const { fetchImpl, allowPrivateHosts, timeoutMs, parseJsonLdJobPostings } = ctx;
  const res = await fetchWithTimeout(fetchImpl, parsedUrl.href, { method: 'GET' }, timeoutMs);
  if (res.url) {
    const redirCheck = validateSafeTargetUrl(res.url, allowPrivateHosts);
    if (!redirCheck.ok) {
      return {
        status: redirCheck.blocked ? 'blocked' : 'unreachable',
        items: [],
        message: `飞书招聘跳转校验失败：${redirCheck.reason}`,
      };
    }
  }
  if (BLOCKED_PORTAL_STATUSES.has(res.status)) {
    return {
      status: 'restricted_portal',
      items: [],
      message: `飞书招聘门户启用签名或访问限制（HTTP ${res.status}），严守合规边界跳过，请使用官网直达或公告粘贴提取`,
    };
  }
  if (!res.ok) {
    return { status: 'unreachable', items: [], message: `飞书招聘门户响应 HTTP ${res.status}` };
  }

  const html = await res.text();
  const jsonLdItems = parseJsonLdJobPostings?.(html, parsedUrl.href, source.name) || [];
  if (jsonLdItems.length > 0) {
    return {
      status: 'synced',
      items: jsonLdItems,
      message: `从飞书招聘公开页面提取到 ${jsonLdItems.length} 条 JSON-LD 岗位`,
    };
  }

  return {
    status: 'restricted_portal',
    items: [],
    message: '飞书招聘门户未开放免签明文 JSON-LD 列表，严守合规边界跳过（绝不伪造签名），请使用官网直达或公众号公告解析',
  };
}

export async function fetchAtsSourceJobs(source, ctx = {}) {
  const fetchImpl = ctx.fetchImpl || fetch;
  const timeoutMs = ctx.timeoutMs || 12000;
  const allowPrivateHosts = Boolean(ctx.allowPrivateHosts);

  const safety = validateSafeTargetUrl(source?.url, allowPrivateHosts);
  if (!safety.ok) {
    return {
      status: safety.blocked ? 'blocked' : 'unreachable',
      items: [],
      message: safety.reason,
    };
  }

  const parsedUrl = safety.url;
  const detected = detectAtsPlatform(parsedUrl.href, source.source_type);
  const platform = typeof detected === 'string' ? detected : detected?.platform || 'html_jsonld';

  const nextCtx = {
    ...ctx,
    fetchImpl,
    timeoutMs,
    allowPrivateHosts,
  };

  try {
    if (platform === 'beisen_zhiye') return await syncBeisenZhiye(source, parsedUrl, nextCtx);
    if (platform === 'hotjob_wecruit') return await syncHotjobWecruit(source, parsedUrl, nextCtx);
    if (platform === 'greenhouse') return await syncGreenhouseBoard(source, parsedUrl, nextCtx);
    if (platform === 'lever') return await syncLeverBoard(source, parsedUrl, nextCtx);
    if (platform === 'ashby') return await syncAshbyBoard(source, parsedUrl, nextCtx);
    if (platform === 'moka_open') return await syncMokaOpen(source, parsedUrl, nextCtx);
    if (platform === 'feishu_hire') return await syncFeishuHire(source, parsedUrl, nextCtx);

    return {
      status: 'fallback_generic',
      fallbackType: platform === 'rss_atom' || platform === 'json_feed' ? platform : 'html_jsonld',
      items: [],
      message: '未匹配专用 ATS 域名，回退至标准公开网页/Feed 解析流程',
    };
  } catch (err) {
    return {
      status: 'unreachable',
      items: [],
      message: `ATS 适配器请求失败：${err?.message || '网络超时'}`,
    };
  }
}
