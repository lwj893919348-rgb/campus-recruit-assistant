import express from 'express';
import crypto from 'node:crypto';
import {
  extractRootDomain,
  findMatchingCompany,
  isPrivateOrLoopbackHost,
  verifyOfficialUrl,
} from '../services/officialVerifier.js';
import { inferCategory, inferRecruitTypeAndExp } from '../../shared/jobParser.js';

function inferCityTier(city = '') {
  if (['北京', '上海', '深圳', '广州'].includes(city)) return '一线城市';
  if (
    [
      '杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '重庆', '合肥', '天津', '郑州', '东莞', '佛山', '青岛', '宁波',
      '沈阳', '无锡', '昆明', '福州',
    ].includes(
      city,
    )
  ) {
    return '新一线';
  }
  if (['全国多地', '海外', '远程'].includes(city)) return '其他/海外';
  return '省会及重点城市';
}

function parseOfficialHttpUrl(rawUrl = '') {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { error: '请填写官网校招或招聘链接。' };
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { error: '官网投递链接格式无效，请以 https:// 或 http:// 开头。' };
  }
  if ((parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') || isPrivateOrLoopbackHost(parsedUrl.hostname)) {
    return { error: '请填写有效的公开企业官网 HTTP/HTTPS 链接。' };
  }
  return { parsedUrl, rootDomain: extractRootDomain(parsedUrl.hostname) };
}

function fetchCompanySummaryById(db, companyId) {
  return db
    .prepare(
      `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.status IN ('open', 'closing_soon')) AS open_job_count,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) AS total_job_count,
        (SELECT message FROM sync_logs l WHERE l.company_id = c.id ORDER BY l.id DESC LIMIT 1) AS last_verify_message,
        (SELECT result_status FROM sync_logs l WHERE l.company_id = c.id ORDER BY l.id DESC LIMIT 1) AS last_verify_result
      FROM companies c
      WHERE c.id = ?
    `,
    )
    .get(companyId);
}

/**
 * Resolves an existing company (with shared-ATS isolation) or inserts a newly submitted enterprise.
 */
function resolveOrCreateCompany(db, payload, parsedUrl, now) {
  const cleanName = String(payload.companyName || payload.name || '').trim();
  const cleanShort = String(payload.shortName || '').trim() || cleanName.slice(0, 6);
  const cleanLegal = String(payload.legalName || '').trim();
  const cleanType = String(payload.companyType || '').trim() || '优质企业';
  const cleanIndustry = String(payload.industry || '').trim() || '综合行业';
  const cleanCity = String(payload.hqCity || payload.city || '').trim() || '全国多地';
  const cleanEntityTag =
    String(payload.entityTag || '').trim() ||
    (cleanType === '初创/融资企业' ? '初创/融资企业 · 已核对官方入口' : '用户补充企业 · 已核对官方入口');
  const rawSocialUrl = String(payload.officialSocialUrl || payload.official_social_url || '').trim();
  const parsedSocial = rawSocialUrl ? parseOfficialHttpUrl(rawSocialUrl) : null;
  const cleanSocialUrl =
    parsedSocial && !parsedSocial.error
      ? parsedSocial.parsedUrl.href
      : payload.recruitType === '社会招聘'
        ? parsedUrl.href
        : '';
  const cleanWechat = String(payload.wechatAccount || payload.wechat_account || '').trim();
  const cleanNotes =
    String(payload.notes || '').trim() ||
    (cleanType === '初创/融资企业'
      ? '由用户自主收录的初创/融资企业官方招聘入口（建议结合天眼查核对主体）。'
      : '由用户自主收录并校对域名的官方招聘入口。');
  const rootDomain = extractRootDomain(parsedUrl.hostname);

  const allCompanies = db.prepare('SELECT * FROM companies').all();
  let company = findMatchingCompany(allCompanies, {
    companyName: cleanName,
    shortName: cleanShort,
    legalName: cleanLegal,
    targetUrl: parsedUrl.href,
    rootDomain,
  });

  if (company) {
    if (
      (cleanLegal && !company.legal_name) ||
      (String(payload.entityTag || '').trim() && !company.entity_tag) ||
      (cleanSocialUrl && !company.official_social_url) ||
      (cleanWechat && !company.wechat_account)
    ) {
      db.prepare(
        `UPDATE companies SET
          legal_name = COALESCE(NULLIF(legal_name, ''), ?),
          entity_tag = COALESCE(NULLIF(entity_tag, ''), ?),
          official_social_url = COALESCE(NULLIF(official_social_url, ''), ?),
          wechat_account = COALESCE(NULLIF(wechat_account, ''), ?),
          updated_at = ?
        WHERE id = ?`,
      ).run(cleanLegal, cleanEntityTag, cleanSocialUrl, cleanWechat, now, company.id);
      company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id);
    }
    return { company, created: false, rootDomain };
  }

  const companyId = `comp-${crypto.randomBytes(4).toString('hex')}`;
  const badgeColor = cleanType === '初创/融资企业' ? '#7C3AED' : '#334155';
  db.prepare(
    `
    INSERT INTO companies (
      id, name, short_name, industry, company_type, official_domain,
      official_campus_url, official_social_url, wechat_account, search_url_template, badge_color, hq_city,
      legal_name, entity_tag, verification_status, last_verified_at, updated_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    companyId,
    cleanName,
    cleanShort,
    cleanIndustry,
    cleanType,
    rootDomain,
    parsedUrl.href,
    cleanSocialUrl,
    cleanWechat,
    parsedUrl.href,
    badgeColor,
    cleanCity,
    cleanLegal,
    cleanEntityTag,
    'user_submitted',
    now,
    now,
    cleanNotes,
  );
  company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  return { company, created: true, rootDomain };
}

function insertUserJob(db, companyId, payload, parsedUrl, rootDomain, now) {
  const jobId = `job-${crypto.randomBytes(5).toString('hex')}`;
  const cleanCity = String(payload.city || '').trim();
  const cleanProvince = String(payload.province || '').trim() || cleanCity;
  const tier = inferCityTier(cleanCity);
  const title = String(payload.title || '').trim();
  const meta = inferRecruitTypeAndExp({
    title,
    seasonTag: payload.seasonTag || '',
    recruitType: payload.recruitType || '',
    experienceReq: payload.experienceReq || '',
    graduationYears: payload.graduationYears,
  });
  const years = meta.graduationYears;

  db.prepare(
    `
    INSERT INTO jobs (
      id, company_id, recruit_type, experience_req, title, category, season_tag, graduation_years,
      province, city, city_tier, official_source_url, official_domain,
      deadline, status, is_referral, salary_range, requirements_summary,
      sync_source, last_checked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    jobId,
    companyId,
    meta.recruitType,
    meta.experienceReq,
    title,
    String(payload.category || '').trim() || inferCategory(title),
    meta.seasonTag,
    JSON.stringify(years),
    cleanProvince,
    cleanCity,
    tier,
    parsedUrl.href,
    rootDomain,
    String(payload.deadline || '').trim() || '招满即止',
    'open',
    payload.isReferral ? 1 : 0,
    String(payload.salaryRange || '').trim(),
    String(payload.requirementsSummary || '').trim() || '详情请点击直达官网查看具体岗位职责与要求。',
    'user_submitted',
    now,
    now,
  );

  const created = db
    .prepare(
      `
    SELECT j.*, c.name AS company_name, c.short_name AS company_short_name,
      c.industry AS company_industry, c.company_type, c.legal_name AS company_legal_name,
      c.entity_tag AS company_entity_tag, c.badge_color,
      c.official_campus_url AS company_portal_url,
      c.official_social_url AS company_social_url,
      c.wechat_account AS company_wechat_account,
      c.verification_status AS company_verification_status
    FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ?
  `,
    )
    .get(jobId);

  return {
    ...created,
    graduation_years: JSON.parse(created.graduation_years || '[]'),
    is_referral: Boolean(created.is_referral),
  };
}

export function createJobsRouter(db, { verifier = verifyOfficialUrl } = {}) {
  const router = express.Router();

  router.get('/jobs', (req, res) => {
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
      recruitType = '',
      experienceReq = '',
      companyId = '',
      onlyOpen = '',
      onlyReferral = '',
      sort = 'latest',
    } = req.query;

    const conditions = [];
    const params = [];

    if (q.trim()) {
      const pattern = `%${q.trim()}%`;
      conditions.push(
        "(j.title LIKE ? OR j.requirements_summary LIKE ? OR c.name LIKE ? OR c.short_name LIKE ? OR COALESCE(c.legal_name, '') LIKE ? OR COALESCE(c.entity_tag, '') LIKE ? OR j.city LIKE ? OR j.category LIKE ?)",
      );
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    const cityList = String(cities)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (cityList.length > 0) {
      const placeholders = cityList.map(() => '?').join(',');
      conditions.push(`j.city IN (${placeholders})`);
      params.push(...cityList);
    }

    if (cityTier && cityTier !== '全部') {
      conditions.push('j.city_tier = ?');
      params.push(cityTier);
    }

    if (province && province !== '全部') {
      conditions.push('j.province = ?');
      params.push(province);
    }

    if (season && season !== '全部') {
      conditions.push('j.season_tag = ?');
      params.push(season);
    }

    if (gradYear && gradYear !== '全部') {
      conditions.push('j.graduation_years LIKE ?');
      params.push(`%"${gradYear.trim()}"%`);
    }

    if (industry && industry !== '全部') {
      conditions.push('c.industry = ?');
      params.push(industry);
    }

    if (companyType && companyType !== '全部') {
      conditions.push('c.company_type = ?');
      params.push(companyType);
    }

    if (category && category !== '全部') {
      conditions.push('j.category = ?');
      params.push(category);
    }

    if (companyId) {
      conditions.push('j.company_id = ?');
      params.push(companyId);
    }

    if (onlyOpen === '1' || onlyOpen === 'true') {
      conditions.push("j.status IN ('open', 'closing_soon')");
    }

    if (onlyReferral === '1' || onlyReferral === 'true') {
      conditions.push('j.is_referral = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause =
      sort === 'deadline'
        ? "ORDER BY CASE WHEN j.deadline = '招满即止' THEN '9999-12-31' ELSE j.deadline END ASC, j.created_at DESC"
        : "ORDER BY CASE j.status WHEN 'closing_soon' THEN 0 WHEN 'open' THEN 1 ELSE 2 END ASC, j.created_at DESC";

    const rows = db
      .prepare(
        `
      SELECT
        j.*,
        c.name AS company_name,
        c.short_name AS company_short_name,
        c.industry AS company_industry,
        c.company_type,
        c.legal_name AS company_legal_name,
        c.entity_tag AS company_entity_tag,
        c.badge_color,
        c.official_campus_url AS company_portal_url,
        c.official_social_url AS company_social_url,
        c.wechat_account AS company_wechat_account,
        c.search_url_template AS company_search_url_template,
        c.verification_status AS company_verification_status
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      ${whereClause}
      ${orderClause}
    `,
      )
      .all(...params);

    const trackedApps = db
      .prepare('SELECT id, job_id, status FROM applications WHERE job_id IS NOT NULL')
      .all();
    const trackedMap = Object.fromEntries(trackedApps.map((a) => [a.job_id, { id: a.id, status: a.status }]));

    let jobs = rows.map((row) => ({
      ...row,
      graduation_years: JSON.parse(row.graduation_years || '[]'),
      is_referral: Boolean(row.is_referral),
      tracked: trackedMap[row.id] || null,
    }));

    if (recruitType && recruitType !== '全部') {
      jobs = jobs.filter((item) => item.recruit_type === recruitType);
    }
    if (experienceReq && experienceReq !== '全部') {
      jobs = jobs.filter((item) => item.experience_req === experienceReq);
    }

    const cityFacets = db
      .prepare(
        `
      SELECT city, province, city_tier, COUNT(*) AS count
      FROM jobs
      GROUP BY city, province, city_tier
      ORDER BY count DESC, city ASC
    `,
      )
      .all();

    const seasonFacets = db
      .prepare('SELECT season_tag AS value, COUNT(*) AS count FROM jobs GROUP BY season_tag ORDER BY count DESC')
      .all();

    const categoryFacets = db
      .prepare('SELECT category AS value, COUNT(*) AS count FROM jobs GROUP BY category ORDER BY count DESC')
      .all();

    const companyTypeFacets = db
      .prepare(
        `
      SELECT c.company_type AS value, COUNT(*) AS count
      FROM jobs j JOIN companies c ON c.id = j.company_id
      GROUP BY c.company_type ORDER BY count DESC
    `,
      )
      .all();

    const recruitTypeFacets = db
      .prepare('SELECT recruit_type AS value, COUNT(*) AS count FROM jobs GROUP BY recruit_type ORDER BY count DESC')
      .all();

    const experienceFacets = db
      .prepare('SELECT experience_req AS value, COUNT(*) AS count FROM jobs GROUP BY experience_req ORDER BY count DESC')
      .all();

    res.json({
      total: jobs.length,
      jobs,
      facets: {
        cities: cityFacets,
        seasons: seasonFacets,
        categories: categoryFacets,
        companyTypes: companyTypeFacets,
        recruitTypes: recruitTypeFacets,
        experienceReqs: experienceFacets,
      },
    });
  });

  router.post('/jobs', (req, res) => {
    const body = req.body || {};
    const {
      companyName = '',
      title = '',
      city = '',
      officialUrl = '',
    } = body;

    if (!String(companyName).trim() || !String(title).trim() || !String(city).trim() || !String(officialUrl).trim()) {
      return res.status(400).json({ error: '请填写完整的公司名称、岗位名称、工作城市与官网投递链接。' });
    }

    const parsed = parseOfficialHttpUrl(officialUrl);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const now = new Date().toISOString();
    const { company, rootDomain } = resolveOrCreateCompany(db, body, parsed.parsedUrl, now);
    const createdJob = insertUserJob(db, company.id, body, parsed.parsedUrl, rootDomain, now);

    res.status(201).json(createdJob);
  });

  router.post('/companies', (req, res) => {
    const body = req.body || {};
    const cleanName = String(body.name || body.companyName || '').trim();
    const officialUrl = String(body.officialUrl || '').trim();

    if (!cleanName || !officialUrl) {
      return res.status(400).json({ error: '请填写完整的企业名称与官方招聘/校招入口链接。' });
    }

    const parsedCompanyUrl = parseOfficialHttpUrl(officialUrl);
    if (parsedCompanyUrl.error) {
      return res.status(400).json({ error: parsedCompanyUrl.error });
    }

    const jobTitle = String(body.jobTitle || '').trim();
    let jobUrlParsed = parsedCompanyUrl;
    if (jobTitle && String(body.jobUrl || '').trim()) {
      jobUrlParsed = parseOfficialHttpUrl(body.jobUrl);
      if (jobUrlParsed.error) {
        return res.status(400).json({ error: jobUrlParsed.error });
      }
    }

    const now = new Date().toISOString();
    const { company, created } = resolveOrCreateCompany(
      db,
      {
        ...body,
        companyName: cleanName,
        companyType: body.companyType || '初创/融资企业',
        industry: body.industry || '人工智能 / 硬科技',
        hqCity: body.hqCity || body.city || '北京',
      },
      parsedCompanyUrl.parsedUrl,
      now,
    );

    let createdJob = null;
    if (jobTitle) {
      createdJob = insertUserJob(
        db,
        company.id,
        {
          title: jobTitle,
          recruitType: body.recruitType || '',
          experienceReq: body.experienceReq || '',
          category: body.category || '',
          seasonTag: body.seasonTag || '',
          graduationYears: body.graduationYears || null,
          province: body.province || '',
          city: body.city || body.hqCity || company.hq_city || '北京',
          deadline: body.deadline || '招满即止',
          isReferral: Boolean(body.isReferral),
          salaryRange: body.salaryRange || '',
          requirementsSummary: body.requirementsSummary || '',
        },
        jobUrlParsed.parsedUrl,
        jobUrlParsed.rootDomain,
        now,
      );
    }

    const summary = fetchCompanySummaryById(db, company.id);
    res.status(created || createdJob ? 201 : 200).json({
      company: summary,
      job: createdJob,
      created,
      message: created
        ? `已成功收录「${summary.name}」官方校招入口。`
        : createdJob
          ? `「${summary.name}」已在企业墙中，已同步新增其校招岗位。`
          : `「${summary.name}」已存在于官方企业名录中。`,
    });
  });

  router.get('/companies', (req, res) => {
    const { q = '', companyType = '' } = req.query;
    const conditions = [];
    const params = [];

    if (q && String(q).trim()) {
      const kw = `%${String(q).trim()}%`;
      conditions.push(
        "(c.name LIKE ? OR c.short_name LIKE ? OR COALESCE(c.legal_name, '') LIKE ? OR COALESCE(c.entity_tag, '') LIKE ? OR COALESCE(c.wechat_account, '') LIKE ? OR c.industry LIKE ? OR c.hq_city LIKE ?)",
      );
      params.push(kw, kw, kw, kw, kw, kw, kw);
    }

    if (companyType && companyType !== '全部') {
      conditions.push('c.company_type = ?');
      params.push(companyType);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const companies = db
      .prepare(
        `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.status IN ('open', 'closing_soon')) AS open_job_count,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) AS total_job_count,
        (SELECT message FROM sync_logs l WHERE l.company_id = c.id ORDER BY l.id DESC LIMIT 1) AS last_verify_message,
        (SELECT result_status FROM sync_logs l WHERE l.company_id = c.id ORDER BY l.id DESC LIMIT 1) AS last_verify_result
      FROM companies c
      ${whereSql}
      ORDER BY open_job_count DESC, c.name ASC
    `,
      )
      .all(...params);

    res.json({ companies });
  });

  router.post('/verify/check', async (req, res) => {
    const { companyId, jobId, url } = req.body || {};
    let targetUrl = url;
    let expectedDomain = '';
    let resolvedCompanyId = companyId || null;

    if (jobId) {
      const job = db
        .prepare('SELECT j.*, c.official_domain AS company_domain FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ?')
        .get(jobId);
      if (!job) {
        return res.status(404).json({ error: '未找到对应的校招岗位记录。' });
      }
      targetUrl = targetUrl || job.official_source_url;
      expectedDomain = job.company_domain || job.official_domain;
      resolvedCompanyId = job.company_id;
    } else if (companyId) {
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
      if (!company) {
        return res.status(404).json({ error: '未找到对应的官方企业记录。' });
      }
      targetUrl = targetUrl || company.official_campus_url;
      expectedDomain = company.official_domain;
    }

    if (!targetUrl) {
      return res.status(400).json({ error: '缺少待核验的官网 URL。' });
    }

    const result = await verifier(targetUrl, expectedDomain);

    db.prepare(
      `
      INSERT INTO sync_logs (
        company_id, target_url, http_status, final_url, resolved_domain,
        is_domain_match, result_status, message, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      resolvedCompanyId,
      result.targetUrl,
      result.httpStatus,
      result.finalUrl,
      result.resolvedDomain,
      result.isDomainMatch ? 1 : 0,
      result.resultStatus,
      result.message,
      result.checkedAt,
    );

    if (resolvedCompanyId) {
      db.prepare('UPDATE companies SET verification_status = ?, last_verified_at = ? WHERE id = ?').run(
        result.resultStatus,
        result.checkedAt,
        resolvedCompanyId,
      );
    }

    if (jobId) {
      db.prepare('UPDATE jobs SET last_checked_at = ? WHERE id = ?').run(result.checkedAt, jobId);
    }

    res.json(result);
  });

  router.post('/verify/batch', async (req, res) => {
    const { companyIds } = req.body || {};
    let companies;
    if (Array.isArray(companyIds) && companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      companies = db.prepare(`SELECT * FROM companies WHERE id IN (${placeholders})`).all(...companyIds);
    } else {
      companies = db.prepare('SELECT * FROM companies ORDER BY name ASC LIMIT 12').all();
    }

    const results = [];
    const concurrency = 4;
    for (let i = 0; i < companies.length; i += concurrency) {
      const batch = companies.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (c) => {
          const check = await verifier(c.official_campus_url, c.official_domain);
          db.prepare(
            `
            INSERT INTO sync_logs (
              company_id, target_url, http_status, final_url, resolved_domain,
              is_domain_match, result_status, message, checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          ).run(
            c.id,
            check.targetUrl,
            check.httpStatus,
            check.finalUrl,
            check.resolvedDomain,
            check.isDomainMatch ? 1 : 0,
            check.resultStatus,
            check.message,
            check.checkedAt,
          );
          db.prepare('UPDATE companies SET verification_status = ?, last_verified_at = ? WHERE id = ?').run(
            check.resultStatus,
            check.checkedAt,
            c.id,
          );
          return { companyId: c.id, companyName: c.name, ...check };
        }),
      );
      results.push(...batchResults);
    }

    res.json({ checked: results.length, results });
  });

  return router;
}
