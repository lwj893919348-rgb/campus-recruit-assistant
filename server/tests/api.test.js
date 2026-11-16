import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import { upsertBuiltInCatalog } from '../db/seed.js';
import { createApp } from '../app.js';
import { OFFICIAL_COMPANIES, OFFICIAL_JOBS } from '../data/officialCatalog.js';
import {
  extractAtsTenantPrefix,
  extractRootDomain,
  findMatchingCompany,
  isDomainMatch,
  isSharedAtsDomain,
  verifyOfficialUrl,
} from '../services/officialVerifier.js';
import {
  refreshJobLifecycles,
  parseRssOrAtomFeed,
  parseJsonLdJobPostings,
  parseBatchImportText,
  syncSingleSource,
} from '../services/syncEngine.js';
import { fetchAtsSourceJobs } from '../services/atsAdapters.js';
import {
  detectAtsPlatform,
  getCompanyAtsSupport,
} from '../../shared/atsPlatforms.js';
import {
  extractConciseSearchKeyword,
  isFunctionalSearchTemplate,
  isSpecificJobDetailUrl,
  resolveJobOfficialTarget,
} from '../../shared/jobLinkResolver.js';
import {
  inferCityInfo,
  normalizeJobLocation,
} from '../../shared/jobParser.js';
import {
  ALL_JOB_CATEGORIES,
  parseWechatAnnouncementText,
} from '../../shared/jobParser.js';

function invokeApp(app, method, url, body = null) {
  return new Promise((resolve, reject) => {
    const socket = new PassThrough();
    socket.remoteAddress = '127.0.0.1';

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost' };

    if (body !== null) {
      const payload = Buffer.from(JSON.stringify(body), 'utf8');
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(payload.length);
      req.push(payload);
    }
    req.push(null);

    const res = new http.ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return origWrite(chunk, encoding, cb);
    };

    res.end = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const result = origEnd(chunk, encoding, cb);
      const rawText = Buffer.concat(chunks).toString('utf8');
      const ct = String(res.getHeader('content-type') || '');
      let parsed = rawText;
      if (ct.includes('application/json') && rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          // keep raw
        }
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        text: rawText,
        data: parsed,
      });
      return result;
    };

    res.on('error', reject);
    app.handle(req, res);
  });
}

test('extractRootDomain and isDomainMatch handle .com and .com.cn properly', () => {
  assert.equal(extractRootDomain('jobs.bytedance.com'), 'bytedance.com');
  assert.equal(extractRootDomain('zhaopin.sgcc.com.cn'), 'sgcc.com.cn');
  assert.equal(extractRootDomain('www.chinatelecom.com.cn'), 'chinatelecom.com.cn');
  assert.equal(isDomainMatch('campus.163.com', '163.com'), true);
  assert.equal(isDomainMatch('fake-163.com', '163.com'), false);
});

test('verifyOfficialUrl detects reachable, restricted_portal, domain_mismatch, and blocks private hosts', async () => {
  const privateCheck = await verifyOfficialUrl('http://127.0.0.1:8080/admin', 'example.com');
  assert.equal(privateCheck.resultStatus, 'blocked_private_host');

  const okCheck = await verifyOfficialUrl('https://join.qq.com', 'qq.com', {
    fetchImpl: async () =>
      new Response('<html><head><title>腾讯校园招聘</title></head></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
  });
  assert.equal(okCheck.ok, true);
  assert.equal(okCheck.resultStatus, 'reachable');
  assert.equal(okCheck.pageTitle, '腾讯校园招聘');

  const wafCheck = await verifyOfficialUrl('https://career.huawei.com', 'huawei.com', {
    fetchImpl: async () => new Response('Forbidden', { status: 403 }),
  });
  assert.equal(wafCheck.ok, true);
  assert.equal(wafCheck.resultStatus, 'restricted_portal');

  const mismatchCheck = await verifyOfficialUrl('https://jobs.bytedance.com/campus', 'bytedance.com', {
    fetchImpl: async () => ({
      status: 200,
      url: 'https://third-party-training.example.com/offer',
      headers: new Headers({ 'content-type': 'text/html' }),
      body: true,
      text: async () => '<title>培训机构</title>',
    }),
  });
  assert.equal(mismatchCheck.ok, false);
  assert.equal(mismatchCheck.resultStatus, 'domain_mismatch');
});

test('Jobs filtering by city, cityTier, season, and custom official job creation work end-to-end', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db, {
    verifier: async (url, domain) => ({
      ok: true,
      targetUrl: url,
      finalUrl: url,
      httpStatus: 200,
      resolvedDomain: domain || 'qq.com',
      expectedDomain: domain || 'qq.com',
      isDomainMatch: true,
      resultStatus: 'reachable',
      pageTitle: 'Official Portal',
      message: 'OK',
      checkedAt: new Date().toISOString(),
    }),
  });

  try {
    const res1 = await invokeApp(app, 'GET', `/api/jobs?cities=${encodeURIComponent('杭州,成都')}`);
    assert.equal(res1.status, 200);
    assert.ok(res1.data.jobs.length > 0);
    assert.ok(res1.data.jobs.every((j) => j.city === '杭州' || j.city === '成都'));

    const res2 = await invokeApp(app, 'GET', `/api/jobs?q=${encodeURIComponent('大模型')}&gradYear=2027`);
    assert.equal(res2.status, 200);
    assert.ok(res2.data.jobs.length > 0);
    assert.ok(res2.data.jobs.every((j) => j.graduation_years.includes('2027')));

    const createRes = await invokeApp(app, 'POST', '/api/jobs', {
      companyName: '海康威视',
      title: '嵌入式视觉算法工程师',
      city: '杭州',
      province: '浙江',
      officialUrl: 'https://campushr.hikvision.com/positions',
      seasonTag: '2027届秋招补录',
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.official_domain, 'hikvision.com');
    assert.equal(createRes.data.city_tier, '新一线');

    const verifyRes = await invokeApp(app, 'POST', '/api/verify/check', {
      jobId: 'job-tx-shenzhen-backend',
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.resultStatus, 'reachable');
  } finally {
    db.close();
  }
});

test('Resumes CRUD, duplicate, default switching, and last-resume protection', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);

  try {
    const listRes = await invokeApp(app, 'GET', '/api/resumes');
    const { resumes } = listRes.data;
    assert.equal(resumes.length, 3);

    const dupRes = await invokeApp(app, 'POST', `/api/resumes/${resumes[0].id}/duplicate`, {
      title: '字节跳动专属简历',
    });
    assert.equal(dupRes.status, 201);
    const cloned = dupRes.data.resume;
    assert.equal(cloned.title, '字节跳动专属简历');

    const updRes = await invokeApp(app, 'PUT', `/api/resumes/${cloned.id}`, {
      template_id: 'modern-dual',
      is_default: true,
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.data.resume.template_id, 'modern-dual');
    assert.equal(updRes.data.resume.is_default, true);

    for (const r of resumes) {
      await invokeApp(app, 'DELETE', `/api/resumes/${r.id}`);
    }
    const blockDel = await invokeApp(app, 'DELETE', `/api/resumes/${cloned.id}`);
    assert.equal(blockDel.status, 400);
  } finally {
    db.close();
  }
});

test('Applications lifecycle, resume linking, demo clearing, and CSV export', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);

  try {
    const clearRes = await invokeApp(app, 'DELETE', '/api/applications/demo');
    assert.equal(clearRes.status, 200);
    assert.equal(clearRes.data.cleared, 4);

    const createRes = await invokeApp(app, 'POST', '/api/applications', {
      job_id: 'job-ali-hangzhou-java',
      company_name: '阿里巴巴集团',
      job_title: 'Java 研发工程师',
      city: '杭州',
      official_url: 'https://campus.alibaba.com',
      resume_id: 'resume-tech-sample',
      status: 'applied',
      channel: '校招内推',
      referral_code: 'ALI888',
    });
    assert.equal(createRes.status, 201);
    const createdApp = createRes.data.application;
    assert.equal(createdApp.resume_title, '2027秋招-后端/全栈开发版（示例）');

    const patchRes = await invokeApp(app, 'PATCH', `/api/applications/${createdApp.id}/status`, {
      status: 'interview',
      interview_round: '一面',
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.application.status, 'interview');
    assert.equal(patchRes.data.application.interview_round, '一面');

    const csvRes = await invokeApp(app, 'GET', '/api/applications/export.csv');
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.text.includes('阿里巴巴集团'));
    assert.ok(csvRes.text.includes('面试中'));
  } finally {
    db.close();
  }
});

test('Expanded cross-verified catalog has 155+ legitimate companies & 220+ jobs, and lossless migration preserves user data', async () => {
  assert.ok(OFFICIAL_COMPANIES.length >= 155, `Expected >= 155 companies, got ${OFFICIAL_COMPANIES.length}`);
  assert.ok(OFFICIAL_JOBS.length >= 220, `Expected >= 220 jobs, got ${OFFICIAL_JOBS.length}`);

  // Every built-in company & job URL must align strictly with its declared root domain and have verified legal entity info
  for (const c of OFFICIAL_COMPANIES) {
    assert.ok(c.legal_name && c.legal_name.trim().length > 2, `Missing legal_name for ${c.id}`);
    assert.ok(c.entity_tag && c.entity_tag.trim().length > 2, `Missing entity_tag for ${c.id}`);
    const hostname = new URL(c.official_campus_url).hostname;
    assert.ok(
      isDomainMatch(hostname, c.official_domain),
      `Company domain mismatch for ${c.id}: ${hostname} vs ${c.official_domain}`,
    );
  }
  for (const j of OFFICIAL_JOBS) {
    const hostname = new URL(j.official_source_url).hostname;
    assert.ok(
      isDomainMatch(hostname, j.official_domain),
      `Job domain mismatch for ${j.id}: ${hostname} vs ${j.official_domain}`,
    );
  }

  const freshDb = createDatabase(':memory:', { seed: true });
  try {
    const companyCount = freshDb.prepare('SELECT COUNT(*) AS cnt FROM companies').get().cnt;
    const jobCount = freshDb.prepare('SELECT COUNT(*) AS cnt FROM jobs').get().cnt;
    assert.equal(companyCount, OFFICIAL_COMPANIES.length);
    assert.ok(jobCount >= 220, `Expected >= 220 jobs, got ${jobCount}`);

    const missingMeta = freshDb
      .prepare(
        "SELECT COUNT(*) AS cnt FROM companies WHERE COALESCE(search_url_template, '') = '' OR COALESCE(legal_name, '') = '' OR COALESCE(entity_tag, '') = ''",
      )
      .get().cnt;
    assert.equal(missingMeta, 0);

    const app = createApp(freshDb);
    const chipRes = await invokeApp(app, 'GET', `/api/companies?companyType=${encodeURIComponent('半导体芯片')}`);
    assert.equal(chipRes.status, 200);
    assert.ok(chipRes.data.companies.length >= 8);
    assert.ok(chipRes.data.companies.every((c) => c.company_type === '半导体芯片'));

    for (const nonBigTechType of ['专精特新/科创上市', '软件与信创服务', '生物医药健康', '消费零售与物流']) {
      const typeRes = await invokeApp(app, 'GET', `/api/companies?companyType=${encodeURIComponent(nonBigTechType)}`);
      assert.equal(typeRes.status, 200);
      assert.ok(typeRes.data.companies.length >= 9, `Expected >= 9 companies for ${nonBigTechType}`);
    }

    const stockSearch = await invokeApp(app, 'GET', '/api/companies?q=300124');
    assert.equal(stockSearch.status, 200);
    assert.ok(stockSearch.data.companies.some((c) => c.id === 'inovance' && c.legal_name === '深圳市汇川技术股份有限公司'));
  } finally {
    freshDb.close();
  }

  // Simulate legacy v1 SQLite database before schema migration & catalog upgrade
  const legacyDb = new DatabaseSync(':memory:');
  try {
    legacyDb.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        industry TEXT NOT NULL,
        company_type TEXT NOT NULL,
        official_domain TEXT NOT NULL,
        official_campus_url TEXT NOT NULL,
        badge_color TEXT NOT NULL DEFAULT '#2563EB',
        hq_city TEXT NOT NULL DEFAULT '北京',
        verification_status TEXT NOT NULL DEFAULT 'verified_official',
        last_verified_at TEXT,
        notes TEXT DEFAULT ''
      );
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        season_tag TEXT NOT NULL,
        graduation_years TEXT NOT NULL,
        province TEXT NOT NULL,
        city TEXT NOT NULL,
        city_tier TEXT NOT NULL,
        official_source_url TEXT NOT NULL,
        official_domain TEXT NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        is_referral INTEGER NOT NULL DEFAULT 0,
        salary_range TEXT DEFAULT '',
        requirements_summary TEXT NOT NULL,
        sync_source TEXT NOT NULL DEFAULT 'official_catalog',
        last_checked_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE resumes (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, template_id TEXT NOT NULL,
        theme_color TEXT NOT NULL, font_scale TEXT NOT NULL, margin_preset TEXT NOT NULL,
        section_order TEXT NOT NULL, hidden_sections TEXT NOT NULL, content_json TEXT NOT NULL,
        is_default INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE applications (
        id TEXT PRIMARY KEY, job_id TEXT, company_name TEXT NOT NULL, job_title TEXT NOT NULL,
        city TEXT NOT NULL, official_url TEXT, season_tag TEXT, channel TEXT NOT NULL,
        referral_code TEXT, resume_id TEXT, status TEXT NOT NULL, interview_round TEXT,
        next_event_at TEXT, applied_at TEXT NOT NULL, priority TEXT NOT NULL, notes TEXT,
        is_demo INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO companies (id, name, short_name, industry, company_type, official_domain, official_campus_url, verification_status)
      VALUES ('tencent', '腾讯', '腾讯', '互联网', '大厂科技', 'qq.com', 'https://join.qq.com', 'reachable');
      INSERT INTO jobs (id, company_id, title, category, season_tag, graduation_years, province, city, city_tier, official_source_url, official_domain, deadline, requirements_summary, sync_source, created_at)
      VALUES ('user-custom-job', 'tencent', '用户手动补充校招岗', '技术研发', '2027届秋招', '["2027"]', '广东', '深圳', '一线城市', 'https://join.qq.com/custom', 'qq.com', '2027-06-01', '用户自建', 'user_submitted', '2026-10-01T00:00:00Z');
      INSERT INTO resumes VALUES ('my-resume', '我的个人简历', 'tech-minimal', '#2563EB', 'standard', 'standard', '["basic"]', '[]', '{}', 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
      INSERT INTO applications VALUES ('my-app', 'user-custom-job', '腾讯', '我的投递岗位', '深圳', 'https://join.qq.com', '2027届秋招', '官网直投', '', 'my-resume', 'interview', '二面', '', '2026-10-02', 'high', '保底保留', 0, '2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z');
    `);

    initSchema(legacyDb);
    const mergeStats = upsertBuiltInCatalog(legacyDb);
    assert.equal(mergeStats.companiesAdded, OFFICIAL_COMPANIES.length - 1);
    assert.equal(mergeStats.companiesUpdated, 1);
    assert.ok(mergeStats.jobsAdded >= 220);
    assert.equal(legacyDb.prepare('SELECT COUNT(*) AS cnt FROM companies').get().cnt, OFFICIAL_COMPANIES.length);

    // Preserve user custom job, resume, application, and prior verification_status while backfilling legal_name
    const customJob = legacyDb.prepare('SELECT * FROM jobs WHERE id = ?').get('user-custom-job');
    assert.equal(customJob.title, '用户手动补充校招岗');
    const savedResume = legacyDb.prepare('SELECT * FROM resumes WHERE id = ?').get('my-resume');
    assert.equal(savedResume.title, '我的个人简历');
    const savedApp = legacyDb.prepare('SELECT * FROM applications WHERE id = ?').get('my-app');
    assert.equal(savedApp.status, 'interview');
    const preservedTencent = legacyDb.prepare('SELECT verification_status, legal_name, entity_tag FROM companies WHERE id = ?').get('tencent');
    assert.equal(preservedTencent.verification_status, 'reachable');
    assert.equal(preservedTencent.legal_name, '深圳市腾讯计算机系统有限公司');
  } finally {
    legacyDb.close();
  }
});

test('refreshJobLifecycles handles expired, closing_soon, rolling, and reopened deadlines', () => {
  const db = createDatabase(':memory:', { seed: true });
  try {
    const now = new Date('2026-11-15T12:00:00Z');
    const baseSql = `
      INSERT INTO jobs (id, company_id, title, category, season_tag, graduation_years, province, city, city_tier, official_source_url, official_domain, deadline, status, requirements_summary, sync_source, created_at)
      VALUES (?, 'tencent', ?, '技术研发', '2027届秋招', '["2027"]', '广东', '深圳', '一线城市', ?, 'qq.com', ?, 'open', 'test', 'user_submitted', '2026-10-01T00:00:00Z')
    `;
    db.prepare(baseSql).run('lc-expired', '已过期岗位', 'https://join.qq.com/1', '2026-10-01');
    db.prepare(baseSql).run('lc-soon', '即将截止岗位', 'https://join.qq.com/2', '2026-11-20');
    db.prepare(baseSql).run('lc-open', '远期有效岗位', 'https://join.qq.com/3', '2027-03-15');
    db.prepare(baseSql).run('lc-rolling', '招满即止岗位', 'https://join.qq.com/4', '招满即止');

    const audit1 = refreshJobLifecycles(db, now);
    assert.ok(audit1.expiredCount >= 1);
    assert.ok(audit1.closingSoonCount >= 1);
    assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get('lc-expired').status, 'closed');
    assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get('lc-soon').status, 'closing_soon');
    assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get('lc-open').status, 'open');
    assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get('lc-rolling').status, 'open');

    // Extend deadline of previously expired job -> should reopen
    db.prepare('UPDATE jobs SET deadline = ? WHERE id = ?').run('2027-04-01', 'lc-expired');
    const audit2 = refreshJobLifecycles(db, now);
    assert.ok(audit2.reopenedCount >= 1);
    assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get('lc-expired').status, 'open');
  } finally {
    db.close();
  }
});

test('Sync parsers, HTTP feed sync, restricted_portal handling, and batch import API work end-to-end', async () => {
  const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel><title>校招 Feed</title>
    <item>
      <title><![CDATA[【腾讯】2027暑期实习-Go后端开发（深圳）]]></title>
      <link>https://join.qq.com/post/rss-go-1</link>
      <description>面向2027届毕业生，2027-05-20截止。</description>
    </item>
  </channel></rss>`;

  const sampleJsonLdHtml = `<html><head><script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": "大模型推理框架工程师",
    "hiringOrganization": { "name": "华为" },
    "jobLocation": { "address": { "addressLocality": "上海" } },
    "validThrough": "2027-05-01",
    "url": "https://career.huawei.com/job/ld-1"
  }
  </script></head><body></body></html>`;

  assert.equal(parseRssOrAtomFeed(sampleRss).length, 1);
  assert.equal(parseJsonLdJobPostings(sampleJsonLdHtml)[0].companyName, '华为');
  assert.equal(parseBatchImportText('字节跳动, 测试开发, 北京, https://jobs.bytedance.com/1, 2027-05-10').length, 1);

  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db, {
    syncFetchImpl: async (url) => {
      if (url.includes('rss.xml')) {
        return new Response(sampleRss, { status: 200, headers: { 'content-type': 'application/xml' } });
      }
      if (url.includes('gated.html')) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(sampleJsonLdHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });

  try {
    // Block private IP source URLs
    const badSrc = await invokeApp(app, 'POST', '/api/sync/sources', {
      name: '内网测试',
      sourceType: 'rss_atom',
      url: 'http://127.0.0.1:9999/rss.xml',
    });
    assert.equal(badSrc.status, 400);

    // Block deleting built-in sources
    const delBuiltin = await invokeApp(app, 'DELETE', '/api/sync/sources/src-builtin-catalog');
    assert.equal(delBuiltin.status, 400);

    // Add RSS source + gated 403 source
    const rssSrc = await invokeApp(app, 'POST', '/api/sync/sources', {
      name: '公开校招RSS测试',
      sourceType: 'rss_atom',
      url: 'https://join.qq.com/feeds/rss.xml',
      defaultCompanyId: 'tencent',
    });
    assert.equal(rssSrc.status, 201);

    const gatedSrc = await invokeApp(app, 'POST', '/api/sync/sources', {
      name: '门禁页面测试',
      sourceType: 'html_jsonld',
      url: 'https://career.huawei.com/gated.html',
    });
    assert.equal(gatedSrc.status, 201);

    // Run full sync
    const runRes = await invokeApp(app, 'POST', '/api/sync/run', {});
    assert.equal(runRes.status, 200);
    assert.ok(runRes.data.addedCount >= 1);
    assert.equal(runRes.data.restrictedCount, 1);

    // Re-running is idempotent (updates rather than creating duplicates)
    const runRes2 = await invokeApp(app, 'POST', '/api/sync/run', { sourceId: rssSrc.data.id });
    assert.equal(runRes2.status, 200);
    assert.equal(runRes2.data.addedCount, 0);
    assert.equal(runRes2.data.updatedCount, 1);

    // Toggle and delete custom source
    const patchSrc = await invokeApp(app, 'PATCH', `/api/sync/sources/${gatedSrc.data.id}`, { enabled: false });
    assert.equal(patchSrc.status, 200);
    assert.equal(patchSrc.data.enabled, false);

    const delSrc = await invokeApp(app, 'DELETE', `/api/sync/sources/${gatedSrc.data.id}`);
    assert.equal(delSrc.status, 200);

    // Batch text import (plus private URL filtering)
    const batchRes = await invokeApp(app, 'POST', '/api/sync/import', {
      rawText: [
        '米哈游, 客户端开发校招, 上海, https://jobs.mihoyo.com/batch-1, 2027-06-15, 2027届春招补录',
        '黑名单, 危险内网岗, 北京, http://127.0.0.1:8080/evil, 2027-06-15',
      ].join('\n'),
    });
    assert.equal(batchRes.status, 201);
    assert.equal(batchRes.data.added, 1);
    assert.equal(batchRes.data.skipped, 1);

    const statusRes = await invokeApp(app, 'GET', '/api/sync/status');
    assert.equal(statusRes.status, 200);
    assert.ok(statusRes.data.recentRuns.length >= 2);
  } finally {
    db.close();
  }
});

test('Shared ATS domain isolation, POST /api/companies, and batch import isolation work accurately', async () => {
  assert.equal(isSharedAtsDomain('feishu.cn'), true);
  assert.equal(isSharedAtsDomain('mokahr.com'), true);
  assert.equal(isSharedAtsDomain('kimi.com'), false);

  assert.notEqual(
    extractAtsTenantPrefix('https://startup-a.jobs.feishu.cn/campus'),
    extractAtsTenantPrefix('https://startup-b.jobs.feishu.cn/campus'),
  );
  assert.notEqual(
    extractAtsTenantPrefix('https://app.mokahr.com/campus-recruitment/biren/44727'),
    extractAtsTenantPrefix('https://app.mokahr.com/campus-recruitment/pony/41223'),
  );
  assert.notEqual(
    extractAtsTenantPrefix('https://app.mokahr.com/su/ebEyb'),
    extractAtsTenantPrefix('https://app.mokahr.com/su/PzVxz'),
  );

  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);

  try {
    // Reject invalid payloads and private URLs
    const missingFields = await invokeApp(app, 'POST', '/api/companies', { name: '缺链接公司' });
    assert.equal(missingFields.status, 400);

    const privateHost = await invokeApp(app, 'POST', '/api/companies', {
      name: '内网测试初创',
      officialUrl: 'http://127.0.0.1:8080/campus',
    });
    assert.equal(privateHost.status, 400);

    // 1. Standalone startup on Feishu ATS (must NOT merge into 面壁智能 modelbest.jobs.feishu.cn)
    const createStartupA = await invokeApp(app, 'POST', '/api/companies', {
      name: '星尘智算初创',
      shortName: '星尘智算',
      legalName: '北京星尘智算科技有限公司',
      entityTag: '初创/融资企业 · Pre-A/A轮融资',
      companyType: '初创/融资企业',
      industry: '具身智能与世界模型',
      hqCity: '北京',
      officialUrl: 'https://stardust-ai.jobs.feishu.cn/',
      notes: '具身大模型方向早期高成长团队',
    });
    assert.equal(createStartupA.status, 201);
    assert.equal(createStartupA.data.created, true);
    assert.equal(createStartupA.data.company.name, '星尘智算初创');
    assert.equal(createStartupA.data.company.legal_name, '北京星尘智算科技有限公司');
    assert.equal(createStartupA.data.company.company_type, '初创/融资企业');
    assert.notEqual(createStartupA.data.company.id, 'modelbest');

    // 2. Startup with Moka portal + companion job in one transaction (must NOT merge into biren/ponyai)
    const createStartupB = await invokeApp(app, 'POST', '/api/companies', {
      name: '灵境计算科技',
      legalName: '上海灵境计算科技有限公司',
      entityTag: '初创/融资企业 · B轮及以上高成长',
      companyType: '初创/融资企业',
      hqCity: '上海',
      officialUrl: 'https://app.mokahr.com/campus-recruitment/lingjing/1001',
      jobTitle: '异构计算编译器工程师',
      category: '技术研发',
      city: '上海',
      deadline: '2027-01-15',
    });
    assert.equal(createStartupB.status, 201);
    assert.equal(createStartupB.data.created, true);
    assert.equal(createStartupB.data.job.company_id, createStartupB.data.company.id);
    assert.equal(createStartupB.data.company.open_job_count, 1);

    // 3. Adding a follow-up job on same Feishu tenant attaches to 星尘智算初创 without duplicate company
    const addJobForA = await invokeApp(app, 'POST', '/api/jobs', {
      companyName: '星尘智算初创',
      companyType: '初创/融资企业',
      title: '具身仿真平台工程师',
      city: '北京',
      officialUrl: 'https://stardust-ai.jobs.feishu.cn/jobs/detail/42',
    });
    assert.equal(addJobForA.status, 201);
    assert.equal(addJobForA.data.company_id, createStartupA.data.company.id);

    // 4. Batch sync import of two startups sharing zhiye.com must keep them separate
    const syncImport = await invokeApp(app, 'POST', '/api/sync/import', {
      rawText: [
        '智云光年, 算法实习生, 北京, https://zhiyun.zhiye.com/campus/1, 2027-02-01, 2027届秋招补录',
        '深海量子, 量子控制研发, 合肥, https://deepquantum.zhiye.com/campus/2, 2027-02-01, 2027届秋招补录',
      ].join('\n'),
    });
    assert.equal(syncImport.status, 201);
    assert.equal(syncImport.data.added, 2);

    const companiesRes = await invokeApp(app, 'GET', '/api/companies?q=');
    const createdA = companiesRes.data.companies.find((c) => c.name === '星尘智算初创');
    const createdZhiyun = companiesRes.data.companies.find((c) => c.name === '智云光年');
    const createdQuantum = companiesRes.data.companies.find((c) => c.name === '深海量子');
    assert.ok(createdA);
    assert.ok(createdZhiyun);
    assert.ok(createdQuantum);
    assert.notEqual(createdZhiyun.id, createdQuantum.id);

    // Direct findMatchingCompany sanity: different Feishu tenants never match
    assert.equal(
      findMatchingCompany(companiesRes.data.companies, {
        companyName: '全新未录入AI创业',
        targetUrl: 'https://brandnew-ai.jobs.feishu.cn/',
        rootDomain: 'feishu.cn',
      }),
      null,
    );
  } finally {
    db.close();
  }
});

test('Expanded built-in all-stage catalog satisfies 16-category counts, wechat metadata, and domain alignment', () => {
  assert.ok(OFFICIAL_COMPANIES.length >= 198, `Expected >= 198 companies, got ${OFFICIAL_COMPANIES.length}`);
  assert.ok(OFFICIAL_JOBS.length >= 480, `Expected >= 480 jobs, got ${OFFICIAL_JOBS.length}`);

  const startups = OFFICIAL_COMPANIES.filter((c) => c.company_type === '初创/融资企业');
  assert.ok(startups.length >= 31, `Expected >= 31 verified startups, got ${startups.length}`);

  const companyMap = new Map();
  for (const company of OFFICIAL_COMPANIES) {
    assert.ok(!companyMap.has(company.id), `Duplicate company id: ${company.id}`);
    companyMap.set(company.id, company);
    assert.ok(company.legal_name && company.legal_name.length >= 4, `Missing legal_name on ${company.id}`);
    assert.ok(company.entity_tag && company.entity_tag.length >= 4, `Missing entity_tag on ${company.id}`);
    const portalHost = new URL(company.official_campus_url).hostname;
    assert.equal(
      isDomainMatch(portalHost, company.official_domain),
      true,
      `Portal ${company.official_campus_url} does not match domain ${company.official_domain}`,
    );
  }

  for (const startup of startups) {
    const startupJobs = OFFICIAL_JOBS.filter((job) => job.company_id === startup.id);
    assert.ok(startupJobs.length >= 1, `Startup ${startup.id} should have at least 1 built-in job`);
  }

  const catCounts = new Map(ALL_JOB_CATEGORIES.map((c) => [c, 0]));
  const recruitCounts = { 校园招聘: 0, 社会招聘: 0, 实习兼职: 0 };

  for (const job of OFFICIAL_JOBS) {
    assert.ok(companyMap.has(job.company_id), `Job ${job.id} references unknown company ${job.company_id}`);
    const jobHost = new URL(job.official_source_url).hostname;
    assert.equal(
      isDomainMatch(jobHost, job.official_domain),
      true,
      `Job ${job.id} URL ${job.official_source_url} mismatches domain ${job.official_domain}`,
    );
    catCounts.set(job.category, (catCounts.get(job.category) || 0) + 1);
    recruitCounts[job.recruit_type] = (recruitCounts[job.recruit_type] || 0) + 1;
  }

  for (const category of ALL_JOB_CATEGORIES) {
    assert.ok(
      catCounts.get(category) >= 15,
      `Category "${category}" expected >= 15 jobs, got ${catCounts.get(category)}`,
    );
  }
  assert.ok(recruitCounts['校园招聘'] >= 260, `Expected >= 260 campus jobs, got ${recruitCounts['校园招聘']}`);
  assert.ok(recruitCounts['社会招聘'] >= 150, `Expected >= 150 social jobs, got ${recruitCounts['社会招聘']}`);
  assert.ok(recruitCounts['实习兼职'] >= 50, `Expected >= 50 intern jobs, got ${recruitCounts['实习兼职']}`);
});

test('All-stage filters, WeChat announcement preview/import, and mp.weixin.qq.com feed block', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);

  try {
    // 1. recruitType & experienceReq API filters + facets
    const socialRes = await invokeApp(app, 'GET', '/api/jobs?recruitType=%E7%A4%BE%E4%BC%9A%E6%8B%9B%E8%81%98&pageSize=20');
    assert.equal(socialRes.status, 200);
    assert.ok(socialRes.data.total >= 150);
    assert.ok(socialRes.data.jobs.every((j) => j.recruit_type === '社会招聘'));
    assert.ok(Array.isArray(socialRes.data.facets.recruitTypes));
    assert.ok(Array.isArray(socialRes.data.facets.experienceReqs));

    const auditRes = await invokeApp(
      app,
      'GET',
      '/api/jobs?category=%E8%B4%A2%E5%8A%A1%E5%AE%A1%E8%AE%A1&experienceReq=3-5%E5%B9%B4',
    );
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.data.total >= 5);
    assert.ok(
      auditRes.data.jobs.every((j) => j.category === '财务审计' && j.experience_req === '3-5年'),
    );
    assert.ok(auditRes.data.jobs.some((j) => j.company_wechat_account));

    // 2. Dashboard summary recruitTypeCounts & categoryCount
    const dashRes = await invokeApp(app, 'GET', '/api/dashboard');
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.summary.recruitTypeCounts);
    assert.ok(dashRes.data.summary.categoryCount >= 16);

    // 3. WeChat Official Account announcement parser (pure + preview endpoint + import)
    const sampleWechatText = `【腾讯招聘】2026 社招+校招联合专场：
1. 资深云原生后台开发工程师（3-5年｜深圳）官网投递：https://join.qq.com/post-1001
2. 法务合规专家（3-5年｜深圳）
【德勤招聘】财务审计春季专项：
- 审计经理（3-5年｜上海）官网：https://www.deloitte.com/cn/zh/cn-careers.html`;

    const parsedDirect = parseWechatAnnouncementText(sampleWechatText, OFFICIAL_COMPANIES);
    assert.ok(parsedDirect.length >= 3);

    const previewRes = await invokeApp(app, 'POST', '/api/sync/import/preview', {
      rawText: sampleWechatText,
    });
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.data.items.length >= 3);
    assert.ok(previewRes.data.items.some((item) => item.companyName.includes('腾讯')));
    assert.ok(previewRes.data.items.some((item) => item.category === '财务审计'));

    // 4. Sync source URL blocks mp.weixin.qq.com to avoid fragile/blocked scraping
    const blockRes = await invokeApp(app, 'POST', '/api/sync/sources', {
      name: '某公众号推文直连',
      source_type: 'html_links',
      url: 'https://mp.weixin.qq.com/s/abcdef123456',
    });
    assert.equal(blockRes.status, 400);
    assert.match(blockRes.data.error, /微信|粘贴|正文/);
  } finally {
    db.close();
  }
});

function readDetectedPlatform(res) {
  return typeof res === 'string' ? res : res?.platform;
}

test('ATS platform detection classifies Zhiye, HotJob, Greenhouse, Lever, Ashby, Moka and Feishu accurately', () => {
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://iflytek.zhiye.com/campus')), 'beisen_zhiye');
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://whchem.hotjob.cn')), 'hotjob_wecruit');
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://boards.greenhouse.io/openai')), 'greenhouse');
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://jobs.lever.co/scaleai')), 'lever');
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://jobs.ashbyhq.com/linear')), 'ashby');
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://app.mokahr.com/campus-recruitment/biren')), 'moka_open');
  assert.equal(readDetectedPlatform(detectAtsPlatform('https://modelbest.jobs.feishu.cn/campus')), 'feishu_hire');

  const autoCompanies = OFFICIAL_COMPANIES.filter((c) => getCompanyAtsSupport(c)?.autoSyncable);
  assert.ok(autoCompanies.length >= 28, `Expected >= 28 autoSyncable built-in companies, got ${autoCompanies.length}`);
});

test('Beisen Zhiye adapter paginates, infers categories/recruitType, normalizes sentinel dates, and dedupes', async () => {
  const db = createDatabase(':memory:', { seed: true });
  try {
    const zhiyeCompany = db
      .prepare("SELECT * FROM companies WHERE official_campus_url LIKE '%zhiye.com%' LIMIT 1")
      .get();
    assert.ok(zhiyeCompany, 'Should have built-in zhiye.com company');

    const mockFetch = async (url, opts = {}) => {
      const target = String(url);
      if (target.startsWith('https://iflytek.zhiye.com') && (!opts.method || opts.method === 'GET')) {
        return new Response('<script>window.__CONF__={PortalId:"11111111-2222-3333-4444-555555555555"};</script>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (target === 'https://iflytek.zhiye.com/api/Jobad/GetJobAdPageList') {
        const body = JSON.parse(opts.body || '{}');
        assert.equal(body.PortalId, '11111111-2222-3333-4444-555555555555');
        if (body.PageIndex === 1) {
          return Response.json({
            Code: 200,
            Count: 3,
            Data: [
              {
                Id: 'row-1',
                JobAdId: 'ad-101',
                JobAdName: '高级税务审计经理',
                CategoryId: '1',
                LocNames: '上海',
                Salary: '25k-40k',
                Duty: '<p>负责集团税务筹划与并购审计（3-5年）</p>',
                Require: '<p>CPA优先</p>',
                PostDate: '2026-11-10T09:00:00',
                EndTime: '0001-01-01T00:00:00',
              },
              {
                Id: 'row-2',
                JobAdId: 'ad-102',
                JobAdName: '多模态大模型算法工程师',
                CategoryId: '2',
                LocNames: '合肥/北京',
                Salary: '面议',
                Duty: '研发新一代多模态认知大模型',
                Require: '2027届应届硕士/博士',
                PostDate: '2026-11-12T10:00:00',
                EndTime: '2026-12-31T23:59:59',
              },
            ],
          });
        }
        return Response.json({
          Code: 200,
          Count: 3,
          Data: [
            {
              Id: 'row-3',
              JobAdId: 'ad-103',
              JobAdName: '2027暑期实习生-嵌入式硬件工程师',
              CategoryId: '2',
              LocNames: '深圳',
              Duty: '负责端侧智能硬件原理图设计与驱动开发',
              Require: '在校实习生',
              PostDate: '2026-11-14T08:00:00',
              EndTime: '0001-01-01T00:00:00',
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch URL: ${target}`);
    };

    const pagedPreview = await fetchAtsSourceJobs(
      { id: 'src-test-beisen', name: '科大讯飞测试源', source_type: 'ats_auto', url: 'https://iflytek.zhiye.com/home' },
      { fetchImpl: mockFetch, pageSize: 2, maxPages: 3 },
    );
    assert.equal(pagedPreview.status, 'synced');
    assert.equal(pagedPreview.items.length, 3);
    assert.equal(pagedPreview.items[0].officialUrl, 'https://iflytek.zhiye.com/JobAd/Info?adid=ad-101');
    assert.equal(pagedPreview.items[0].deadline, '长期有效/招满即止');
    assert.equal(pagedPreview.items[0].recruitType, '社会招聘');
    assert.equal(pagedPreview.items[0].category, '财务审计');
    assert.equal(pagedPreview.items[1].category, '算法AI');
    assert.equal(pagedPreview.items[1].recruitType, '校园招聘');
    assert.equal(pagedPreview.items[1].deadline, '2026-12-31');
    assert.equal(pagedPreview.items[2].recruitType, '实习兼职');
    assert.equal(pagedPreview.items[2].category, '硬件工程');

    // Full syncSingleSource -> DB write & dedupe check (single page of 2 items from mock with pageSize=50)
    db.prepare(
      `INSERT INTO sync_sources (id, name, source_type, url, default_company_id, enabled, auto_interval_hours, created_at)
       VALUES (?, ?, 'ats_auto', ?, ?, 1, 6, ?)`,
    ).run('src-beisen-db', '讯飞北森源', 'https://iflytek.zhiye.com/home', zhiyeCompany.id, new Date().toISOString());

    const srcRow = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get('src-beisen-db');
    const run1 = await syncSingleSource(db, srcRow, { fetchImpl: mockFetch });
    assert.equal(run1.status, 'synced');
    assert.equal(run1.added, 2);

    const insertedJob = db.prepare("SELECT * FROM jobs WHERE external_id LIKE '%ad-101'").get();
    assert.ok(insertedJob);
    assert.equal(insertedJob.company_id, zhiyeCompany.id);
    assert.equal(insertedJob.category, '财务审计');
    assert.equal(insertedJob.recruit_type, '社会招聘');
    assert.equal(insertedJob.official_source_url, 'https://iflytek.zhiye.com/JobAd/Info?adid=ad-101');

    const run2 = await syncSingleSource(db, srcRow, { fetchImpl: mockFetch });
    assert.equal(run2.status, 'synced');
    assert.equal(run2.added, 0);
  } finally {
    db.close();
  }
});

test('HotJob Wecruit adapter resolves getSLD, fetches form-urlencoded listPosition, and blocks loopback SSRF targets', async () => {
  const db = createDatabase(':memory:', { seed: true });
  try {
    const hotjobCompany = db
      .prepare("SELECT * FROM companies WHERE official_campus_url LIKE '%hotjob.cn%' LIMIT 1")
      .get();
    assert.ok(hotjobCompany, 'Should have built-in hotjob.cn company');

    const mockFetch = async (url, opts = {}) => {
      const target = String(url);
      if (target === 'https://whchem.hotjob.cn/wecruit/common/getSLD') {
        return Response.json({
          state: '200',
          data: {
            linkData: {
              link: 'https://wecruit.hotjob.cn/SU63abcdef0123456789abcdef/pb/index.html#/',
            },
          },
        });
      }
      if (target === 'https://wecruit.hotjob.cn/wecruit/positionInfo/listPosition/SU63abcdef0123456789abcdef') {
        const params = new URLSearchParams(String(opts.body || ''));
        const ch = params.get('recruitType');
        if (ch === '1') {
          return Response.json({
            data: {
              pageForm: {
                totalPage: 1,
                pageData: [
                  {
                    postId: 'hj-campus-1',
                    postName: '新能源电池正极材料研发工程师（2027届）',
                    workPlaceStr: '烟台/宁波',
                    recruitType: 1,
                    publishDate: '2026-11-11',
                    endDate: '2026-12-20',
                    longTermRelease: 0,
                    workContent: '承担新型锂电正极材料开发',
                  },
                ],
              },
            },
          });
        }
        if (ch === '2') {
          return Response.json({
            data: {
              pageForm: {
                totalPage: 1,
                pageData: [
                  {
                    postId: 'hj-social-1',
                    postName: '供应链计划高级主管',
                    workPlaceStr: '上海',
                    recruitType: 2,
                    publishDate: '2026-11-10',
                    endDate: '3000-01-01',
                    longTermRelease: 1,
                    workContent: '统筹全球化工供应链产销排程（3-5年）',
                  },
                ],
              },
            },
          });
        }
        return Response.json({ data: { pageForm: { totalPage: 1, pageData: [] } } });
      }
      throw new Error(`Unexpected HotJob URL: ${target}`);
    };

    db.prepare(
      `INSERT INTO sync_sources (id, name, source_type, url, default_company_id, enabled, auto_interval_hours, created_at)
       VALUES (?, ?, 'hotjob_wecruit', ?, ?, 1, 6, ?)`,
    ).run('src-hotjob-db', '万华HotJob源', 'https://whchem.hotjob.cn', hotjobCompany.id, new Date().toISOString());

    const src = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get('src-hotjob-db');
    const syncRes = await syncSingleSource(db, src, { fetchImpl: mockFetch });
    assert.equal(syncRes.status, 'synced');
    assert.equal(syncRes.added, 2);

    const socialJob = db.prepare("SELECT * FROM jobs WHERE external_id LIKE '%hj-social-1'").get();
    assert.ok(socialJob);
    assert.equal(socialJob.recruit_type, '社会招聘');
    assert.equal(socialJob.category, '供应链制造');
    assert.equal(socialJob.deadline, '长期有效/招满即止');
    assert.equal(
      socialJob.official_source_url,
      'https://wecruit.hotjob.cn/SU63abcdef0123456789abcdef/pb/posDetail.html?postId=hj-social-1&postType=society',
    );

    // Secondary SSRF test when getSLD redirects to loopback IP
    const ssrfRes = await fetchAtsSourceJobs(
      { id: 'src-hotjob-ssrf', name: 'SSRF检测', source_type: 'hotjob_wecruit', url: 'https://evil.hotjob.cn' },
      {
        allowPrivateHosts: false,
        fetchImpl: async () =>
          Response.json({
            state: '200',
            data: { linkData: { link: 'http://127.0.0.1:8080/internal-admin' } },
          }),
      },
    );
    assert.equal(ssrfRes.status, 'blocked');
    assert.match(ssrfRes.message, /内网|拦截/);
  } finally {
    db.close();
  }
});

test('Greenhouse, Lever, Ashby public adapters and Moka/Feishu compliance restricted_portal guards work cleanly', async () => {
  const db = createDatabase(':memory:', { seed: true });
  try {
    // Greenhouse / Lever / Ashby
    const gh = await fetchAtsSourceJobs(
      { id: 'gh-1', name: 'GH', source_type: 'ats_auto', url: 'https://boards.greenhouse.io/demoai' },
      {
        fetchImpl: async (u) => {
          assert.equal(u, 'https://boards-api.greenhouse.io/v1/boards/demoai/jobs?content=true');
          return Response.json({
            jobs: [
              {
                id: 9001,
                title: 'Research Scientist - Multimodal AI',
                location: { name: '上海' },
                absolute_url: 'https://boards.greenhouse.io/demoai/jobs/9001',
                updated_at: '2026-11-12T00:00:00Z',
                content: '<p>Full time AI role 3-5年</p>',
              },
            ],
          });
        },
      },
    );
    assert.equal(gh.status, 'synced');
    assert.equal(gh.items.length, 1);
    assert.equal(gh.items[0].category, '算法AI');

    const lever = await fetchAtsSourceJobs(
      { id: 'lv-1', name: 'LV', source_type: 'lever', url: 'https://jobs.lever.co/demolever' },
      {
        fetchImpl: async (u) => {
          assert.equal(u, 'https://api.lever.co/v0/postings/demolever?mode=json');
          return Response.json([
            {
              id: 'lv-88',
              text: 'Senior Backend Engineer (Go)',
              categories: { location: '北京', team: 'Platform' },
              hostedUrl: 'https://jobs.lever.co/demolever/lv-88',
              descriptionPlain: 'Build distributed cloud systems',
              createdAt: 1762905600000,
            },
          ]);
        },
      },
    );
    assert.equal(lever.status, 'synced');
    assert.equal(lever.items[0].category, '技术研发');

    const ashby = await fetchAtsSourceJobs(
      { id: 'as-1', name: 'AS', source_type: 'ashby', url: 'https://jobs.ashbyhq.com/demoashby' },
      {
        fetchImpl: async (u) => {
          assert.equal(u, 'https://api.ashbyhq.com/posting-api/job-board/demoashby');
          return Response.json({
            jobs: [
              {
                id: 'as-77',
                title: 'Product Designer',
                location: 'Remote',
                jobUrl: 'https://jobs.ashbyhq.com/demoashby/as-77',
                publishedAt: '2026-11-10',
                descriptionPlain: 'Design product experience',
              },
            ],
          });
        },
      },
    );
    assert.equal(ashby.status, 'synced');
    assert.equal(ashby.items[0].category, '产品设计');

    // Moka encrypted ciphertext guard -> restricted_portal
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO sync_sources (id, name, source_type, url, enabled, auto_interval_hours, created_at)
       VALUES ('src-moka-enc', 'Moka加密测试', 'moka_open', 'https://app.mokahr.com/api/outer/ats-jc-apply/website/jobs?org=biren', 1, 6, ?)`,
    ).run(now);
    const mokaSrc = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get('src-moka-enc');
    const mokaRes = await syncSingleSource(db, mokaSrc, {
      fetchImpl: async () => Response.json({ data: 'U2FsdGVkX1/ciphertextPayloadShouldNeverBeDecrypted==' }),
    });
    assert.equal(mokaRes.status, 'restricted_portal');
    assert.equal(mokaRes.added, 0);
    assert.equal(db.prepare('SELECT last_status FROM sync_sources WHERE id = ?').get('src-moka-enc').last_status, 'restricted_portal');

    // Feishu HTTP 405 signature gate guard -> restricted_portal
    db.prepare(
      `INSERT INTO sync_sources (id, name, source_type, url, enabled, auto_interval_hours, created_at)
       VALUES ('src-feishu-405', '飞书门禁测试', 'feishu_hire', 'https://modelbest.jobs.feishu.cn/campus', 1, 6, ?)`,
    ).run(now);
    const feishuSrc = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get('src-feishu-405');
    const feishuRes = await syncSingleSource(db, feishuSrc, {
      fetchImpl: async () => new Response('Method Not Allowed', { status: 405 }),
    });
    assert.equal(feishuRes.status, 'restricted_portal');
    assert.equal(feishuRes.added, 0);
    assert.equal(db.prepare('SELECT last_status FROM sync_sources WHERE id = ?').get('src-feishu-405').last_status, 'restricted_portal');
  } finally {
    db.close();
  }
});

test('POST /api/sync/sources/subscribe-company subscribes autoSyncable firms idempotently and rejects restricted ATS portals', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);
  try {
    const zhiyeComp = db
      .prepare("SELECT * FROM companies WHERE official_campus_url LIKE '%zhiye.com%' LIMIT 1")
      .get();
    const mokaComp = db
      .prepare("SELECT * FROM companies WHERE official_campus_url LIKE '%mokahr.com%' LIMIT 1")
      .get();
    assert.ok(zhiyeComp && mokaComp);

    const sub1 = await invokeApp(app, 'POST', '/api/sync/sources/subscribe-company', {
      companyId: zhiyeComp.id,
    });
    assert.equal(sub1.status, 201);
    assert.equal(sub1.data.created, true);
    assert.equal(sub1.data.source.source_type, 'ats_auto');
    assert.equal(sub1.data.atsInfo.autoSyncable, true);

    const sub2 = await invokeApp(app, 'POST', '/api/sync/sources/subscribe-company', {
      companyId: zhiyeComp.id,
    });
    assert.equal(sub2.status, 200);
    assert.equal(sub2.data.created, false);
    assert.equal(sub2.data.source.id, sub1.data.source.id);

    const rejectedMoka = await invokeApp(app, 'POST', '/api/sync/sources/subscribe-company', {
      companyId: mokaComp.id,
    });
    assert.equal(rejectedMoka.status, 400);
    assert.match(rejectedMoka.data.error, /Moka|加密|不支持/);

    const directCreateAts = await invokeApp(app, 'POST', '/api/sync/sources', {
      name: '直接配置Greenhouse测试源',
      sourceType: 'ats_auto',
      url: 'https://boards.greenhouse.io/example-org',
    });
    assert.equal(directCreateAts.status, 201);
  } finally {
    db.close();
  }
});

test('jobLinkResolver classifies detail URLs, bespoke keyword search URLs, and portal fallbacks accurately', () => {
  assert.equal(isSpecificJobDetailUrl('https://whchem.zhiye.com/JobAd/Info?adid=12345'), true);
  assert.equal(
    isSpecificJobDetailUrl('https://whchem.hotjob.cn/SU63abcdef0123456789abcdef/pb/posDetail.html?postId=hj1&postType=campus'),
    true,
  );
  assert.equal(isSpecificJobDetailUrl('https://whchem.zhiye.com/campus'), false);

  assert.equal(isFunctionalSearchTemplate('https://join.qq.com/post.html?query=p_1&keyword={q}'), true);
  assert.equal(isFunctionalSearchTemplate('https://campus.example.com/?q={q}'), false);

  assert.equal(extractConciseSearchKeyword('腾讯 · 后端开发工程师（AI基础设施）', '腾讯', '腾讯科技'), '后端开发工程师');
  assert.equal(extractConciseSearchKeyword('全栈硬件架构师 / Senior EE', '大疆', '大疆创新'), '全栈硬件架构师');

  // 1. Live detail link (Beisen JobAd) -> detail tier
  const detailRes = resolveJobOfficialTarget({
    title: '化工工艺研发工程师',
    official_source_url: 'https://whchem.zhiye.com/JobAd/Info?adid=998877',
    company_portal_url: 'https://whchem.zhiye.com',
    sync_source: 'live_ats_snapshot',
  });
  assert.equal(detailRes.targetType, 'detail');
  assert.equal(detailRes.isExactDetail, true);
  assert.equal(detailRes.href, 'https://whchem.zhiye.com/JobAd/Info?adid=998877');
  assert.equal(detailRes.buttonLabel, '直达岗位详情页');

  // 2. Curated portal job with functional search template -> search tier with encoded concise keyword
  const searchRes = resolveJobOfficialTarget({
    title: '后端开发工程师（云与智慧产业）',
    recruit_type: '校园招聘',
    company_name: '腾讯',
    company_short_name: '腾讯',
    official_source_url: 'https://join.qq.com/index.html',
    company_portal_url: 'https://join.qq.com/index.html',
    company_search_url_template: 'https://join.qq.com/post.html?query=p_1&keyword={q}',
  });
  assert.equal(searchRes.targetType, 'search');
  assert.equal(searchRes.isExactDetail, false);
  assert.match(searchRes.href, /^https:\/\/join\.qq\.com\/post\.html\?query=p_1&keyword=/);
  assert.equal(decodeURIComponent(searchRes.href.split('keyword=')[1]), '后端开发工程师');

  // 3. Social job whose search template points to a campus-only portal should fall back to social portal
  const socialPortalRes = resolveJobOfficialTarget({
    title: '高级嵌入式系统工程师（社招）',
    recruit_type: '社会招聘',
    official_source_url: 'https://careers.example.com/social',
    company_portal_url: 'https://campus.example.com',
    company_social_url: 'https://careers.example.com/social',
    company_search_url_template: 'https://campus.example.com/jobs?keyword={q}',
  });
  assert.equal(socialPortalRes.targetType, 'portal');
  assert.equal(socialPortalRes.href, 'https://careers.example.com/social');
  assert.equal(socialPortalRes.buttonLabel, '前往社招官网页');
});

test('upsertBuiltInCatalog replaces placeholders for live snapshot firms while keeping application-linked rows', () => {
  const db = createDatabase(':memory:', { seed: false });
  initSchema(db);
  try {
    // Initial seed with no snapshot override -> all static placeholders exist
    upsertBuiltInCatalog(db, { snapshotOverride: null });
    const whPlaceholder = db
      .prepare("SELECT * FROM jobs WHERE company_id = 'wanhua' LIMIT 1")
      .get();
    assert.ok(whPlaceholder);

    // Track one placeholder job in applications to verify FK preservation
    db.prepare(
      `INSERT INTO applications (id, job_id, company_name, job_title, status, applied_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'applied', '2026-11-15', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')`,
    ).run('app-keep-fk', whPlaceholder.id, '万华化学', whPlaceholder.title);

    // Apply live snapshot for wanhua
    upsertBuiltInCatalog(db, {
      snapshotOverride: {
        generatedAt: '2026-11-15T10:00:00Z',
        jobs: [
          {
            id: 'snap-wh-real-1',
            company_id: 'wanhua',
            external_id: 'live-wh-101',
            recruit_type: '社会招聘',
            experience_req: '3-5年经验',
            title: '2026高级聚氨酯研发工程师（官网实招）',
            category: '硬件制造',
            season_tag: '社招常年',
            graduation_years: ['社招/不限届别'],
            province: '山东',
            city: '烟台',
            city_tier: '二线',
            official_source_url: 'https://whchem.hotjob.cn/SU123/pb/posDetail.html?postId=live-wh-101&postType=society',
            official_domain: 'hotjob.cn',
            deadline: '2026-12-31',
            status: 'open',
            is_referral: 0,
            salary_range: '25k-40k',
            requirements_summary: '官网真实同步岗位',
            sync_source: 'live_ats_snapshot',
          },
        ],
      },
    });

    const appLinkedStillExists = db.prepare('SELECT * FROM jobs WHERE id = ?').get(whPlaceholder.id);
    assert.ok(appLinkedStillExists);

    const otherUnlinkedPlaceholders = db
      .prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE company_id = 'wanhua' AND sync_source = 'verified_registry' AND id != ?")
      .get(whPlaceholder.id).cnt;
    assert.equal(otherUnlinkedPlaceholders, 0);

    const snapInserted = db.prepare('SELECT * FROM jobs WHERE id = ?').get('snap-wh-real-1');
    assert.ok(snapInserted);
    assert.equal(snapInserted.sync_source, 'live_ats_snapshot');
  } finally {
    db.close();
  }
});

test('GET /api/jobs?onlyExactDetail=1 and POST /api/sync/sources/subscribe-all-ats work end-to-end', async () => {
  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);
  try {
    const allRes = await invokeApp(app, 'GET', '/api/jobs');
    assert.equal(allRes.status, 200);
    assert.ok(allRes.data.facets.exactDetailCount > 0);
    assert.ok(allRes.data.total >= allRes.data.facets.exactDetailCount);

    const exactRes = await invokeApp(app, 'GET', '/api/jobs?onlyExactDetail=1');
    assert.equal(exactRes.status, 200);
    assert.equal(exactRes.data.total, allRes.data.facets.exactDetailCount);
    assert.ok(exactRes.data.jobs.length > 0);
    assert.ok(exactRes.data.jobs.every((job) => job.is_exact_detail === true));
    assert.ok(
      exactRes.data.jobs.some(
        (job) =>
          job.resolved_official_url.includes('JobAd/Info?adid=') ||
          job.resolved_official_url.includes('posDetail.html?postId='),
      ),
    );

    const bulkRes = await invokeApp(app, 'POST', '/api/sync/sources/subscribe-all-ats');
    assert.equal(bulkRes.status, 200);
    assert.ok(bulkRes.data.totalSupported >= 20);
    assert.ok(bulkRes.data.createdCount >= 1);

    // Calling again is idempotent
    const bulkAgain = await invokeApp(app, 'POST', '/api/sync/sources/subscribe-all-ats');
    assert.equal(bulkAgain.status, 200);
    assert.equal(bulkAgain.data.createdCount, 0);
  } finally {
    db.close();
  }
});

test('City normalization and facets.cities deduplicate Fuzhou and administrative suffixes', async () => {
  assert.deepEqual(inferCityInfo('烟台市-福山区'), { city: '烟台', province: '山东', tier: '省会及重点城市' });
  assert.deepEqual(inferCityInfo('烟台市'), { city: '烟台', province: '山东', tier: '省会及重点城市' });
  assert.deepEqual(inferCityInfo('福州市'), { city: '福州', province: '福建', tier: '新一线' });
  assert.deepEqual(inferCityInfo('福建省-福州市'), { city: '福州', province: '福建', tier: '新一线' });
  assert.deepEqual(inferCityInfo('楚雄彝族自治州-禄丰县'), { city: '楚雄', province: '云南', tier: '省会及重点城市' });
  assert.deepEqual(inferCityInfo('鄂尔多斯市-伊金霍洛旗'), { city: '鄂尔多斯', province: '内蒙古', tier: '省会及重点城市' });
  assert.deepEqual(normalizeJobLocation('芜湖市', '芜湖市'), { city: '芜湖', province: '安徽', city_tier: '省会及重点城市' });

  const db = createDatabase(':memory:', { seed: true });
  try {
    // Inject legacy dirty rows with drifted city_tier and district suffixes
    db.prepare(
      `INSERT INTO jobs (id, company_id, title, category, season_tag, graduation_years, province, city, city_tier, official_source_url, official_domain, deadline, status, requirements_summary, sync_source, created_at)
       VALUES (?, 'tencent', ?, '技术研发', '2027届秋招', '["2027"]', ?, ?, ?, 'https://join.qq.com/city-test', 'qq.com', '2027-06-01', 'open', 'test', 'user_submitted', '2026-11-15T00:00:00Z')`,
    ).run('legacy-fz-drift', '福州旧tier测试岗', '福建', '福州', '省会及重点城市');
    db.prepare(
      `INSERT INTO jobs (id, company_id, title, category, season_tag, graduation_years, province, city, city_tier, official_source_url, official_domain, deadline, status, requirements_summary, sync_source, created_at)
       VALUES (?, 'wanhua', ?, '新能源化工', '2027届秋招', '["2027"]', ?, ?, ?, 'https://whchem.hotjob.cn/city-test', 'hotjob.cn', '2027-06-01', 'open', 'test', 'user_submitted', '2026-11-15T00:00:00Z')`,
    ).run('legacy-yt-district', '烟台福山区旧后缀测试岗', '烟台市-福山区', '烟台市-福山区', '省会及重点城市');

    // Re-running upsertBuiltInCatalog heals legacy rows automatically
    upsertBuiltInCatalog(db);
    const healedFz = db.prepare('SELECT city, province, city_tier FROM jobs WHERE id = ?').get('legacy-fz-drift');
    assert.deepEqual({ ...healedFz }, { city: '福州', province: '福建', city_tier: '新一线' });
    const healedYt = db.prepare('SELECT city, province, city_tier FROM jobs WHERE id = ?').get('legacy-yt-district');
    assert.deepEqual({ ...healedYt }, { city: '烟台', province: '山东', city_tier: '省会及重点城市' });

    const app = createApp(db);
    // POST /api/jobs should normalize incoming '烟台市-福山区' too
    const postRes = await invokeApp(app, 'POST', '/api/jobs', {
      companyName: '万华化学',
      title: '新材料工艺工程师',
      city: '烟台市-福山区',
      officialUrl: 'https://whchem.hotjob.cn/SU123/pb/posDetail.html?postId=yt-999',
    });
    assert.equal(postRes.status, 201);
    assert.equal(postRes.data.city, '烟台');
    assert.equal(postRes.data.province, '山东');

    const jobsRes = await invokeApp(app, 'GET', '/api/jobs');
    assert.equal(jobsRes.status, 200);
    const cityNames = jobsRes.data.facets.cities.map((c) => c.city);
    assert.equal(new Set(cityNames).size, cityNames.length);
    assert.equal(jobsRes.data.facets.cities.filter((c) => c.city === '福州').length, 1);
    assert.equal(jobsRes.data.facets.cities.find((c) => c.city === '福州').city_tier, '新一线');
    assert.equal(jobsRes.data.facets.cities.filter((c) => c.city.startsWith('烟台')).length, 1);
  } finally {
    db.close();
  }
});

test('Phase 1 integrity: honest salary labels, deadline sorting, duplicate application guard, and priority support', async () => {
  // All curated verified_registry items must use honest salary label instead of unverified figures
  assert.ok(OFFICIAL_JOBS.length > 0);
  assert.ok(OFFICIAL_JOBS.every((j) => j.salary_range === '以官网为准'));

  const db = createDatabase(':memory:', { seed: true });
  const app = createApp(db);
  try {
    // Deadline sort must put dated deadlines ascending ahead of rolling text labels
    const deadlineSorted = await invokeApp(app, 'GET', '/api/jobs?sort=deadline&onlyOpen=1');
    assert.equal(deadlineSorted.status, 200);
    const firstDatedIdx = deadlineSorted.data.jobs.findIndex((j) => /^\d{4}-\d{2}-\d{2}$/.test(j.deadline));
    const firstRollingIdx = deadlineSorted.data.jobs.findIndex((j) => !/^\d{4}-\d{2}-\d{2}$/.test(j.deadline));
    assert.equal(firstDatedIdx, 0);
    if (firstRollingIdx !== -1) {
      assert.ok(firstDatedIdx < firstRollingIdx);
    }

    // Create application with high priority on an untracked job
    const firstCreate = await invokeApp(app, 'POST', '/api/applications', {
      job_id: 'job-ali-beijing-llm',
      company_name: '阿里巴巴',
      job_title: '大模型算法工程师（通义千问/夸克方向）',
      city: '北京',
      season_tag: '2027届秋招',
      priority: 'high',
      status: 'applied',
    });
    assert.equal(firstCreate.status, 201);
    assert.equal(firstCreate.data.application.priority, 'high');

    // Duplicate submission is blocked with 409 DUPLICATE_APPLICATION
    const dupCreate = await invokeApp(app, 'POST', '/api/applications', {
      job_id: 'job-ali-beijing-llm',
      company_name: '阿里巴巴',
      job_title: '大模型算法工程师（通义千问/夸克方向）',
      city: '北京',
      season_tag: '2027届秋招',
    });
    assert.equal(dupCreate.status, 409);
    assert.equal(dupCreate.data.code, 'DUPLICATE_APPLICATION');

    // Explicit allowDuplicate bypasses conflict for separate department re-submission
    const forcedCreate = await invokeApp(app, 'POST', '/api/applications', {
      job_id: 'job-ali-beijing-llm',
      company_name: '阿里巴巴',
      job_title: '大模型算法工程师（通义千问/夸克方向）',
      city: '北京',
      season_tag: '2027届秋招',
      priority: 'low',
      allowDuplicate: true,
    });
    assert.equal(forcedCreate.status, 201);
    assert.equal(forcedCreate.data.application.priority, 'low');

    // Updating priority and validating invalid priority fallback
    const updatePriority = await invokeApp(app, 'PUT', `/api/applications/${firstCreate.data.application.id}`, {
      priority: 'normal',
    });
    assert.equal(updatePriority.status, 200);
    assert.equal(updatePriority.data.application.priority, 'normal');
  } finally {
    db.close();
  }
});
