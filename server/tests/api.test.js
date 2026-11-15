import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import { upsertBuiltInCatalog } from '../db/seed.js';
import { createApp } from '../app.js';
import { extractRootDomain, isDomainMatch, verifyOfficialUrl } from '../services/officialVerifier.js';
import {
  refreshJobLifecycles,
  parseRssOrAtomFeed,
  parseJsonLdJobPostings,
  parseBatchImportText,
} from '../services/syncEngine.js';

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
    assert.equal(resumes.length, 2);

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

    await invokeApp(app, 'DELETE', `/api/resumes/${resumes[0].id}`);
    await invokeApp(app, 'DELETE', `/api/resumes/${resumes[1].id}`);
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

test('Expanded catalog has 75 companies & 130+ jobs, and lossless migration preserves user data', async () => {
  const freshDb = createDatabase(':memory:', { seed: true });
  try {
    const companyCount = freshDb.prepare('SELECT COUNT(*) AS cnt FROM companies').get().cnt;
    const jobCount = freshDb.prepare('SELECT COUNT(*) AS cnt FROM jobs').get().cnt;
    assert.equal(companyCount, 75);
    assert.ok(jobCount >= 130, `Expected >= 130 jobs, got ${jobCount}`);

    const missingTemplate = freshDb
      .prepare("SELECT COUNT(*) AS cnt FROM companies WHERE COALESCE(search_url_template, '') = ''")
      .get().cnt;
    assert.equal(missingTemplate, 0);

    const app = createApp(freshDb);
    const chipRes = await invokeApp(app, 'GET', `/api/companies?companyType=${encodeURIComponent('半导体芯片')}`);
    assert.equal(chipRes.status, 200);
    assert.ok(chipRes.data.companies.length >= 5);
    assert.ok(chipRes.data.companies.every((c) => c.company_type === '半导体芯片'));
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
    assert.equal(mergeStats.companiesAdded, 74);
    assert.equal(mergeStats.companiesUpdated, 1);
    assert.ok(mergeStats.jobsAdded >= 130);
    assert.equal(legacyDb.prepare('SELECT COUNT(*) AS cnt FROM companies').get().cnt, 75);

    // Preserve user custom job, resume, application, and prior verification_status
    const customJob = legacyDb.prepare('SELECT * FROM jobs WHERE id = ?').get('user-custom-job');
    assert.equal(customJob.title, '用户手动补充校招岗');
    const savedResume = legacyDb.prepare('SELECT * FROM resumes WHERE id = ?').get('my-resume');
    assert.equal(savedResume.title, '我的个人简历');
    const savedApp = legacyDb.prepare('SELECT * FROM applications WHERE id = ?').get('my-app');
    assert.equal(savedApp.status, 'interview');
    const preservedTencent = legacyDb.prepare('SELECT verification_status FROM companies WHERE id = ?').get('tencent');
    assert.equal(preservedTencent.verification_status, 'reachable');
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
