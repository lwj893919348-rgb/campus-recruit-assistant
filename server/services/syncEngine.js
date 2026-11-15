import crypto from 'node:crypto';
import { upsertBuiltInCatalog } from '../db/seed.js';
import { extractRootDomain, isPrivateOrLoopbackHost } from './officialVerifier.js';

const CITY_PROVINCE_MAP = {
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
  珠海: { province: '广东', tier: '省会及重点城市' },
  厦门: { province: '福建', tier: '省会及重点城市' },
  宁德: { province: '福建', tier: '省会及重点城市' },
  济南: { province: '山东', tier: '省会及重点城市' },
  无锡: { province: '江苏', tier: '省会及重点城市' },
  福州: { province: '福建', tier: '省会及重点城市' },
  沈阳: { province: '辽宁', tier: '省会及重点城市' },
  大连: { province: '辽宁', tier: '省会及重点城市' },
  长春: { province: '吉林', tier: '省会及重点城市' },
  哈尔滨: { province: '黑龙江', tier: '省会及重点城市' },
  昆明: { province: '云南', tier: '省会及重点城市' },
  南宁: { province: '广西', tier: '省会及重点城市' },
  全国多地: { province: '全国多地', tier: '其他/海外' },
  海外: { province: '海外', tier: '其他/海外' },
};

const KNOWN_CITY_NAMES = Object.keys(CITY_PROVINCE_MAP);

export function inferCityInfo(cityInput = '', fallbackText = '') {
  const clean = String(cityInput || '').trim();
  if (clean && CITY_PROVINCE_MAP[clean]) {
    return { city: clean, ...CITY_PROVINCE_MAP[clean] };
  }
  const combined = `${clean} ${fallbackText}`;
  for (const cityName of KNOWN_CITY_NAMES) {
    if (combined.includes(cityName)) {
      return { city: cityName, ...CITY_PROVINCE_MAP[cityName] };
    }
  }
  if (clean) {
    return { city: clean, province: clean, tier: '省会及重点城市' };
  }
  return { city: '全国多地', province: '全国多地', tier: '其他/海外' };
}

export function inferCategory(title = '') {
  const t = String(title);
  if (/算法|大模型|AI|机器学习|视觉|NLP|推荐|SLAM|感知/i.test(t)) return '算法AI';
  if (/产品|策划|交互|设计|UI|UX/i.test(t)) return '产品设计';
  if (/运营|市场|商务|采销|品牌|营销|销售|内容/i.test(t)) return '运营市场';
  if (/嵌入式|硬件|IC|芯片|射频|天线|机械|电气|工艺|结构|半导体|器件/i.test(t)) return '硬件工程';
  if (/金融|风控|银行|投行|量化|证券|审计/i.test(t)) return '金融风控';
  if (/供应链|制造|电池|物流|质量|生产/i.test(t)) return '供应链制造';
  if (/管培|财务|法务|人力|职能|综合/i.test(t)) return '职能管培';
  return '技术研发';
}

function stripTags(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTagValue(block, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(re);
  return match ? stripTags(match[1]) : '';
}

export function parseRssOrAtomFeed(xmlText = '') {
  const items = [];
  const itemMatches = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of itemMatches) {
    const title = getTagValue(block, 'title');
    const link = getTagValue(block, 'link') || getTagValue(block, 'guid');
    const description = getTagValue(block, 'description');
    const pubDate = getTagValue(block, 'pubDate');
    if (title && link) {
      items.push({ title, officialUrl: link, summary: description.slice(0, 220), pubDate });
    }
  }

  if (items.length === 0) {
    const entryMatches = xmlText.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    for (const block of entryMatches) {
      const title = getTagValue(block, 'title');
      const linkAttr = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
      const link = linkAttr ? linkAttr[1] : getTagValue(block, 'link') || getTagValue(block, 'id');
      const summary = getTagValue(block, 'summary') || getTagValue(block, 'content');
      const pubDate = getTagValue(block, 'updated') || getTagValue(block, 'published');
      if (title && link) {
        items.push({ title, officialUrl: link, summary: summary.slice(0, 220), pubDate });
      }
    }
  }

  return items;
}

export function parseJsonFeed(payload) {
  const rawList = Array.isArray(payload)
    ? payload
    : payload?.jobs || payload?.items || payload?.data || payload?.positions || [];
  if (!Array.isArray(rawList)) return [];

  return rawList
    .map((entry) => ({
      externalId: entry.id || entry.externalId || entry.jobId || '',
      companyName: entry.company || entry.companyName || entry.org || '',
      title: entry.title || entry.jobTitle || entry.name || '',
      city: entry.city || entry.location || entry.workCity || '',
      province: entry.province || '',
      category: entry.category || '',
      seasonTag: entry.seasonTag || entry.season || '2027届秋招补录',
      graduationYears: entry.graduationYears || entry.gradYears || ['2027'],
      officialUrl: entry.officialUrl || entry.url || entry.applyUrl || entry.link || '',
      deadline: entry.deadline || entry.expireAt || '招满即止',
      isReferral: Boolean(entry.isReferral),
      salaryRange: entry.salaryRange || entry.salary || '',
      summary: entry.summary || entry.description || entry.requirements || '',
    }))
    .filter((i) => i.title && i.officialUrl);
}

export function parseJsonLdJobPostings(htmlText = '') {
  const results = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(htmlText)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed];
      for (const node of candidates) {
        if (node && (node['@type'] === 'JobPosting' || (Array.isArray(node['@type']) && node['@type'].includes('JobPosting')))) {
          const city =
            node.jobLocation?.address?.addressLocality ||
            (Array.isArray(node.jobLocation) ? node.jobLocation[0]?.address?.addressLocality : '') ||
            '';
          results.push({
            externalId: node.identifier?.value || node.url || '',
            companyName: node.hiringOrganization?.name || '',
            title: stripTags(node.title || ''),
            city,
            officialUrl: node.url || '',
            deadline: node.validThrough ? String(node.validThrough).slice(0, 10) : '招满即止',
            summary: stripTags(node.description || '').slice(0, 220),
          });
        }
      }
    } catch {
      // ignore malformed json-ld blocks
    }
  }
  return results.filter((r) => r.title && r.officialUrl);
}

/**
 * Automatically updates job status based on deadline vs current date.
 */
export function refreshJobLifecycles(db, referenceDate = new Date()) {
  const todayStr = referenceDate.toISOString().slice(0, 10);
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const rows = db.prepare('SELECT id, deadline, status FROM jobs').all();

  let expiredCount = 0;
  let closingSoonCount = 0;
  let reopenedCount = 0;

  const updateStmt = db.prepare('UPDATE jobs SET status = ? WHERE id = ?');

  for (const row of rows) {
    const dl = String(row.deadline || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dl)) continue;

    const dlMs = new Date(`${dl}T00:00:00Z`).getTime();
    if (Number.isNaN(dlMs)) continue;

    const diffDays = Math.round((dlMs - todayMs) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      if (row.status !== 'closed') {
        updateStmt.run('closed', row.id);
        expiredCount += 1;
      }
    } else if (diffDays <= 10) {
      if (row.status !== 'closing_soon') {
        updateStmt.run('closing_soon', row.id);
        closingSoonCount += 1;
      }
    } else if (row.status === 'closing_soon' || row.status === 'closed') {
      updateStmt.run('open', row.id);
      reopenedCount += 1;
    }
  }

  return { expiredCount, closingSoonCount, reopenedCount };
}

function findOrCreateCompany(db, item, defaultCompanyId, rootDomain, allCompanies) {
  if (defaultCompanyId) {
    const byId = allCompanies.find((c) => c.id === defaultCompanyId);
    if (byId) return byId;
  }

  const byDomain = allCompanies.find((c) => c.official_domain === rootDomain);
  if (byDomain) return byDomain;

  const cleanName = String(item.companyName || '').trim();
  if (cleanName) {
    const exact = allCompanies.find((c) => c.name === cleanName || c.short_name === cleanName);
    if (exact) return exact;
    const partial = allCompanies.find((c) => cleanName.includes(c.short_name) && c.short_name.length >= 2);
    if (partial) return partial;
  }

  // Fallback inference from title if no companyName provided (e.g. university RSS item)
  for (const c of allCompanies) {
    if (c.short_name.length >= 2 && item.title.includes(c.short_name)) {
      return c;
    }
  }

  const resolvedName = cleanName || rootDomain || '高校校招公告单位';
  const companyId = `comp-${crypto.createHash('md5').update(`${resolvedName}:${rootDomain}`).digest('hex').slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO companies (
      id, name, short_name, industry, company_type, official_domain,
      official_campus_url, search_url_template, badge_color, hq_city,
      verification_status, last_verified_at, updated_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified_official', ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `,
  ).run(
    companyId,
    resolvedName,
    resolvedName.slice(0, 4),
    '校招同步收录',
    '优质企业',
    rootDomain,
    item.officialUrl,
    '',
    '#334155',
    item.city || '全国多地',
    now,
    now,
    '由订阅源或批量导入自动收录的企业官方校招入口。',
  );

  const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  allCompanies.push(created);
  return created;
}

export function upsertImportedItems(
  db,
  items,
  { sourceKey = 'feed', syncSource = 'external_feed', defaultCompanyId = null, allowPrivateHosts = false } = {},
) {
  const allCompanies = db.prepare('SELECT * FROM companies').all();
  const now = new Date().toISOString();

  let added = 0;
  let updated = 0;
  let skipped = 0;

  const findByExt = db.prepare('SELECT id FROM jobs WHERE external_id = ? LIMIT 1');
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      id, company_id, external_id, title, category, season_tag, graduation_years,
      province, city, city_tier, official_source_url, official_domain,
      deadline, status, is_referral, salary_range, requirements_summary,
      sync_source, last_checked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateJob = db.prepare(`
    UPDATE jobs SET
      title = ?, category = ?, season_tag = ?, graduation_years = ?,
      province = ?, city = ?, city_tier = ?, official_source_url = ?,
      deadline = ?, requirements_summary = ?, last_checked_at = ?
    WHERE id = ?
  `);

  for (const item of items) {
    let parsedUrl;
    try {
      parsedUrl = new URL(String(item.officialUrl || '').trim());
    } catch {
      skipped += 1;
      continue;
    }

    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      (!allowPrivateHosts && isPrivateOrLoopbackHost(parsedUrl.hostname))
    ) {
      skipped += 1;
      continue;
    }

    const rootDomain = extractRootDomain(parsedUrl.hostname);
    const company = findOrCreateCompany(db, item, defaultCompanyId, rootDomain, allCompanies);
    const cityInfo = inferCityInfo(item.city, `${item.title} ${item.summary || ''}`);
    const province = String(item.province || '').trim() || cityInfo.province;
    const category = String(item.category || '').trim() || inferCategory(item.title);
    const seasonTag = String(item.seasonTag || '').trim() || '2027届秋招补录';
    const gradYears = Array.isArray(item.graduationYears) && item.graduationYears.length > 0 ? item.graduationYears : ['2027'];
    const deadline = String(item.deadline || '').trim() || '招满即止';
    const summary = String(item.summary || '').trim() || '来自官方订阅源同步的校招岗位信息，请点击直达官网查看详情。';

    const extKey =
      item.externalId
        ? `${sourceKey}:${item.externalId}`
        : `${sourceKey}:${crypto.createHash('md5').update(`${company.id}:${item.title}:${item.officialUrl}`).digest('hex').slice(0, 12)}`;

    const existing = findByExt.get(extKey);
    if (existing) {
      updateJob.run(
        item.title.trim(),
        category,
        seasonTag,
        JSON.stringify(gradYears),
        province,
        cityInfo.city,
        cityInfo.tier,
        item.officialUrl.trim(),
        deadline,
        summary,
        now,
        existing.id,
      );
      updated += 1;
    } else {
      const id = `job-sync-${crypto.randomBytes(5).toString('hex')}`;
      insertJob.run(
        id,
        company.id,
        extKey,
        item.title.trim(),
        category,
        seasonTag,
        JSON.stringify(gradYears),
        province,
        cityInfo.city,
        cityInfo.tier,
        item.officialUrl.trim(),
        rootDomain,
        deadline,
        'open',
        item.isReferral ? 1 : 0,
        item.salaryRange || '',
        summary,
        syncSource,
        now,
        now,
      );
      added += 1;
    }
  }

  return { added, updated, skipped };
}

export async function syncSingleSource(
  db,
  source,
  { fetchImpl = globalThis.fetch, timeoutMs = 8000, allowPrivateHosts = false, referenceDate = new Date() } = {},
) {
  const now = new Date().toISOString();

  if (source.source_type === 'builtin_catalog') {
    const res = upsertBuiltInCatalog(db);
    db.prepare('UPDATE sync_sources SET last_synced_at = ?, last_status = ?, last_message = ?, items_count = ? WHERE id = ?').run(
      now,
      'synced',
      `内置名企校招库已增量合并（新增企业 ${res.companiesAdded} 家，新增岗位 ${res.jobsAdded} 个）`,
      db.prepare('SELECT COUNT(*) AS cnt FROM jobs WHERE sync_source = ?').get('verified_registry').cnt,
      source.id,
    );
    return {
      sourceId: source.id,
      name: source.name,
      status: 'synced',
      added: res.jobsAdded,
      updated: res.jobsUpdated,
      companiesAdded: res.companiesAdded,
      expired: 0,
      message: `名企库增量合并完成（新增企业 ${res.companiesAdded} 家 / 新增岗位 ${res.jobsAdded} 个）`,
    };
  }

  if (source.source_type === 'lifecycle_audit') {
    const lc = refreshJobLifecycles(db, referenceDate);
    const activeCnt = db.prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE status IN ('open', 'closing_soon')").get().cnt;
    db.prepare('UPDATE sync_sources SET last_synced_at = ?, last_status = ?, last_message = ?, items_count = ? WHERE id = ?').run(
      now,
      'synced',
      `巡检完毕：过期自动下线 ${lc.expiredCount} 个，10天内即将截止预警 ${lc.closingSoonCount} 个`,
      activeCnt,
      source.id,
    );
    return {
      sourceId: source.id,
      name: source.name,
      status: 'synced',
      added: 0,
      updated: lc.closingSoonCount + lc.reopenedCount,
      expired: lc.expiredCount,
      message: `截止状态巡检完成：下线 ${lc.expiredCount} 个过期岗，标记 ${lc.closingSoonCount} 个临近截止`,
    };
  }

  // External HTTP source (rss_atom | json_feed | html_jsonld)
  let parsedUrl;
  try {
    parsedUrl = new URL(source.url);
  } catch {
    return { sourceId: source.id, name: source.name, status: 'unreachable', added: 0, updated: 0, expired: 0, message: '订阅源 URL 无效' };
  }

  if (!allowPrivateHosts && isPrivateOrLoopbackHost(parsedUrl.hostname)) {
    return { sourceId: source.id, name: source.name, status: 'blocked', added: 0, updated: 0, expired: 0, message: '禁止同步内网保留地址' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetchImpl(source.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CampusNav-Sync/1.0)',
        Accept: 'application/json, application/rss+xml, application/atom+xml, text/xml, text/html;q=0.8',
      },
    });

    if (resp.status === 401 || resp.status === 403 || resp.status === 418 || resp.status === 429) {
      const msg = `源站点开启登录或反爬门禁 (HTTP ${resp.status})，严格遵守合规边界跳过抓包，请使用官网直搜。`;
      db.prepare('UPDATE sync_sources SET last_synced_at = ?, last_status = ?, last_message = ? WHERE id = ?').run(
        now,
        'restricted_portal',
        msg,
        source.id,
      );
      return { sourceId: source.id, name: source.name, status: 'restricted_portal', added: 0, updated: 0, expired: 0, message: msg };
    }

    if (!resp.ok) {
      const msg = `请求失败 (HTTP ${resp.status})`;
      db.prepare('UPDATE sync_sources SET last_synced_at = ?, last_status = ?, last_message = ? WHERE id = ?').run(
        now,
        'unreachable',
        msg,
        source.id,
      );
      return { sourceId: source.id, name: source.name, status: 'unreachable', added: 0, updated: 0, expired: 0, message: msg };
    }

    const rawText = await resp.text();
    let parsedItems = [];

    if (source.source_type === 'json_feed') {
      const jsonObj = JSON.parse(rawText);
      parsedItems = parseJsonFeed(jsonObj);
    } else if (source.source_type === 'rss_atom') {
      parsedItems = parseRssOrAtomFeed(rawText);
    } else if (source.source_type === 'html_jsonld') {
      parsedItems = parseJsonLdJobPostings(rawText);
    }

    const res = upsertImportedItems(db, parsedItems, {
      sourceKey: source.id,
      syncSource: 'external_feed',
      defaultCompanyId: source.default_company_id,
      allowPrivateHosts,
    });

    const msg =
      parsedItems.length === 0
        ? '连接成功但未发现可解析的标准岗位条目（部分动态SPA页面需直接点击官网浏览）'
        : `同步完成：解析 ${parsedItems.length} 条，新增 ${res.added} 条，更新 ${res.updated} 条`;

    db.prepare('UPDATE sync_sources SET last_synced_at = ?, last_status = ?, last_message = ?, items_count = ? WHERE id = ?').run(
      now,
      'synced',
      msg,
      parsedItems.length,
      source.id,
    );

    return {
      sourceId: source.id,
      name: source.name,
      status: 'synced',
      added: res.added,
      updated: res.updated,
      expired: 0,
      message: msg,
    };
  } catch (err) {
    const msg = `同步出错：${err?.name === 'AbortError' ? '请求超时' : err?.message || '网络不可达'}`;
    db.prepare('UPDATE sync_sources SET last_synced_at = ?, last_status = ?, last_message = ? WHERE id = ?').run(
      now,
      'unreachable',
      msg,
      source.id,
    );
    return { sourceId: source.id, name: source.name, status: 'unreachable', added: 0, updated: 0, expired: 0, message: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function runFullSync(
  db,
  { triggerType = 'manual', sourceId = null, fetchImpl = globalThis.fetch, allowPrivateHosts = false, referenceDate = new Date() } = {},
) {
  const startedAt = new Date().toISOString();
  let sources;
  if (sourceId) {
    const row = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(sourceId);
    sources = row ? [row] : [];
  } else {
    sources = db.prepare('SELECT * FROM sync_sources WHERE enabled = 1 ORDER BY created_at ASC').all();
  }

  const results = [];
  let addedCount = 0;
  let updatedCount = 0;
  let expiredCount = 0;
  let restrictedCount = 0;

  for (const src of sources) {
    const r = await syncSingleSource(db, src, { fetchImpl, allowPrivateHosts, referenceDate });
    results.push(r);
    addedCount += r.added || 0;
    updatedCount += r.updated || 0;
    expiredCount += r.expired || 0;
    if (r.status === 'restricted_portal') restrictedCount += 1;
  }

  // Always enforce deadline lifecycle after syncing new feeds
  if (!sourceId) {
    const postLifecycle = refreshJobLifecycles(db, referenceDate);
    expiredCount += postLifecycle.expiredCount;
  }

  const finishedAt = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO sync_runs (
      trigger_type, sources_checked, added_count, updated_count,
      expired_count, restricted_count, summary_json, started_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    triggerType,
    sources.length,
    addedCount,
    updatedCount,
    expiredCount,
    restrictedCount,
    JSON.stringify(results),
    startedAt,
    finishedAt,
  );

  return {
    triggerType,
    sourcesChecked: sources.length,
    addedCount,
    updatedCount,
    expiredCount,
    restrictedCount,
    results,
    finishedAt,
  };
}

/**
 * Parses either JSON array or multi-line CSV/TSV/pipe-delimited job lists pasted by a student.
 * Format for text lines: 公司名称, 岗位名称, 城市, 官网链接, [截止日期], [招聘季]
 */
export function parseBatchImportText(rawText = '') {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseJsonFeed(parsed);
    } catch {
      // fall through to line parser
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  for (const line of lines) {
    // Skip common header rows
    if (/^(公司|company)/i.test(line) && /(岗位|title|职位)/i.test(line)) continue;

    const parts = line
      .split(/[,，|\t]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length < 3) continue;

    // Locate URL field anywhere in parts
    const urlIdx = parts.findIndex((p) => /^https?:\/\//i.test(p));
    if (urlIdx === -1) continue;

    const officialUrl = parts[urlIdx];
    const nonUrl = parts.filter((_, idx) => idx !== urlIdx);
    const companyName = nonUrl[0] || '';
    const title = nonUrl[1] || '';
    const city = nonUrl[2] || '全国多地';
    const deadline = nonUrl[3] || '招满即止';
    const seasonTag = nonUrl[4] || '2027届秋招补录';

    if (companyName && title) {
      items.push({
        companyName,
        title,
        city,
        officialUrl,
        deadline,
        seasonTag,
      });
    }
  }

  return items;
}
