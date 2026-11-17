import fs from 'node:fs';
import { normalizeJobLocation } from '../../shared/jobParser.js';
import { createStarterTemplateResumes, isLegacySamplePersona } from '../../shared/resumeDefaults.js';
import {
  CATALOG_UPDATED_AT,
  DEFAULT_SYNC_SOURCES,
  OFFICIAL_COMPANIES,
  OFFICIAL_JOBS,
} from '../data/officialCatalog.js';

const NOW_ISO = CATALOG_UPDATED_AT;

const DEMO_APPLICATIONS = [
  {
    id: 'app-demo-1',
    job_id: 'job-bd-beijing-backend',
    company_name: '字节跳动',
    job_title: '后端开发工程师（抖音/火山引擎方向）',
    city: '北京',
    official_url: 'https://jobs.bytedance.com/campus',
    season_tag: '2027届秋招补录',
    channel: '校招内推',
    referral_code: 'CAMPUS2027',
    resume_id: 'resume-tech-sample',
    status: 'interview',
    interview_round: '技术二面',
    next_event_at: '2026-11-17T14:30',
    applied_at: '2026-11-05',
    priority: 'high',
    notes: '一面已过：考察了 Redis 持久化、Go GMP 调度、手撕 LRU 缓存；二面重点复习系统设计（短链/抢票）。',
    is_demo: 1,
  },
  {
    id: 'app-demo-2',
    job_id: 'job-tx-shenzhen-backend',
    company_name: '腾讯',
    job_title: '后台开发方向（微信/腾讯云事业群）',
    city: '深圳',
    official_url: 'https://join.qq.com',
    season_tag: '2027届秋招补录',
    channel: '官网直投',
    referral_code: '',
    resume_id: 'resume-tech-sample',
    status: 'assessment',
    interview_round: '统一笔试',
    next_event_at: '2026-11-18T19:00',
    applied_at: '2026-11-10',
    priority: 'high',
    notes: '官网状态为“待笔试”，注意提前测试牛客摄像头与双机位环境。',
    is_demo: 1,
  },
  {
    id: 'app-demo-3',
    job_id: 'job-ali-hangzhou-java',
    company_name: '阿里巴巴集团',
    job_title: 'Java 研发工程师（阿里云基础产品）',
    city: '杭州',
    official_url: 'https://campus.alibaba.com',
    season_tag: '2027届秋招补录',
    channel: '官网直投',
    referral_code: '',
    resume_id: 'resume-tech-sample',
    status: 'applied',
    interview_round: '简历筛选中',
    next_event_at: '',
    applied_at: '2026-11-13',
    priority: 'normal',
    notes: '已完成官网测评，等待业务团队简历评估。',
    is_demo: 1,
  },
  {
    id: 'app-demo-4',
    job_id: 'job-cmb-hangzhou-fintech',
    company_name: '招商银行',
    job_title: 'Fintech 金融科技生 · 全栈与大数据方向',
    city: '杭州',
    official_url: 'https://career.cmbchina.com',
    season_tag: '2027届秋招',
    channel: '官网直投',
    referral_code: '',
    resume_id: 'resume-soe-sample',
    status: 'wishlist',
    interview_round: '',
    next_event_at: '',
    applied_at: '2026-11-15',
    priority: 'normal',
    notes: '截止日期 12-08，准备补充金融科技项目描述后再正式官网网申。',
    is_demo: 1,
  },
];

/**
 * Safely merges built-in verified companies, jobs, and default sync sources
 * into an existing or empty database without touching user-created resumes,
 * applications, or user_submitted jobs.
 */
function loadLiveAtsSnapshot(snapshotOverride) {
  if (snapshotOverride !== undefined) return snapshotOverride;
  try {
    const raw = fs.readFileSync(new URL('../data/liveAtsSnapshot.json', import.meta.url), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function upsertBuiltInCatalog(db, options = {}) {
  const { snapshotOverride } = options || {};
  const snapshot = loadLiveAtsSnapshot(snapshotOverride);
  const snapshotJobs = Array.isArray(snapshot?.jobs) ? snapshot.jobs : [];
  const coveredCompanyIds = new Set(snapshotJobs.map((j) => j.company_id).filter(Boolean));
  const snapshotJobIdSet = new Set(snapshotJobs.map((j) => j.id).filter(Boolean));

  const existingCompanyIds = new Set(db.prepare('SELECT id FROM companies').all().map((r) => r.id));
  const existingJobIds = new Set(db.prepare('SELECT id FROM jobs').all().map((r) => r.id));

  let companiesAdded = 0;
  let companiesUpdated = 0;
  let jobsAdded = 0;
  let jobsUpdated = 0;

  const upsertCompany = db.prepare(`
    INSERT INTO companies (
      id, name, short_name, industry, company_type, official_domain,
      official_campus_url, official_social_url, wechat_account, search_url_template, badge_color, hq_city,
      legal_name, entity_tag, verification_status, last_verified_at, updated_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified_official', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      short_name = excluded.short_name,
      industry = excluded.industry,
      company_type = excluded.company_type,
      official_domain = excluded.official_domain,
      official_campus_url = excluded.official_campus_url,
      official_social_url = excluded.official_social_url,
      wechat_account = excluded.wechat_account,
      search_url_template = excluded.search_url_template,
      badge_color = excluded.badge_color,
      hq_city = excluded.hq_city,
      legal_name = excluded.legal_name,
      entity_tag = excluded.entity_tag,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);

  const upsertJob = db.prepare(`
    INSERT INTO jobs (
      id, company_id, external_id, recruit_type, experience_req, title, category, season_tag, graduation_years,
      province, city, city_tier, official_source_url, official_domain,
      deadline, status, is_referral, salary_range, requirements_summary,
      sync_source, last_checked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      external_id = excluded.external_id,
      recruit_type = excluded.recruit_type,
      experience_req = excluded.experience_req,
      title = excluded.title,
      category = excluded.category,
      season_tag = excluded.season_tag,
      graduation_years = excluded.graduation_years,
      province = excluded.province,
      city = excluded.city,
      city_tier = excluded.city_tier,
      official_source_url = excluded.official_source_url,
      official_domain = excluded.official_domain,
      deadline = excluded.deadline,
      is_referral = excluded.is_referral,
      salary_range = excluded.salary_range,
      requirements_summary = excluded.requirements_summary,
      sync_source = excluded.sync_source,
      last_checked_at = excluded.last_checked_at
  `);

  const upsertSource = db.prepare(`
    INSERT INTO sync_sources (
      id, name, source_type, url, default_company_id, enabled,
      auto_interval_hours, last_synced_at, last_status, last_message,
      items_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      items_count = excluded.items_count
  `);

  db.exec('BEGIN;');
  try {
    for (const c of OFFICIAL_COMPANIES) {
      upsertCompany.run(
        c.id,
        c.name,
        c.short_name,
        c.industry,
        c.company_type,
        c.official_domain,
        c.official_campus_url,
        c.official_social_url || '',
        c.wechat_account || '',
        c.search_url_template || '',
        c.badge_color,
        c.hq_city,
        c.legal_name || '',
        c.entity_tag || '',
        NOW_ISO,
        NOW_ISO,
        c.notes,
      );
      if (existingCompanyIds.has(c.id)) companiesUpdated += 1;
      else companiesAdded += 1;
    }

    if (coveredCompanyIds.size > 0) {
      const cleanupPlaceholderStmt = db.prepare(`
        DELETE FROM jobs
        WHERE company_id = ?
          AND sync_source = 'verified_registry'
          AND id NOT IN (SELECT job_id FROM applications WHERE job_id IS NOT NULL)
      `);
      const existingSnapRowsStmt = db.prepare(`
        SELECT id FROM jobs
        WHERE company_id = ?
          AND (sync_source = 'live_ats_snapshot' OR id LIKE 'snap-%')
          AND id NOT IN (SELECT job_id FROM applications WHERE job_id IS NOT NULL)
      `);
      const deleteByIdStmt = db.prepare('DELETE FROM jobs WHERE id = ?');

      for (const cid of coveredCompanyIds) {
        cleanupPlaceholderStmt.run(cid);
        const existingSnapRows = existingSnapRowsStmt.all(cid);
        for (const row of existingSnapRows) {
          if (!snapshotJobIdSet.has(row.id)) {
            deleteByIdStmt.run(row.id);
          }
        }
      }
    }

    const jobsToUpsert = [
      ...OFFICIAL_JOBS.filter((j) => !coveredCompanyIds.has(j.company_id)),
      ...snapshotJobs,
    ];

    for (const j of jobsToUpsert) {
      const normalizedLoc = normalizeJobLocation(j.city, j.province);
      upsertJob.run(
        j.id,
        j.company_id,
        j.external_id || '',
        j.recruit_type || '校园招聘',
        j.experience_req || '应届毕业生',
        j.title,
        j.category,
        j.season_tag,
        JSON.stringify(j.graduation_years || []),
        normalizedLoc.province,
        normalizedLoc.city,
        normalizedLoc.city_tier || '省会及重点城市',
        j.official_source_url,
        j.official_domain,
        j.deadline,
        j.status || 'open',
        j.is_referral ? 1 : 0,
        j.salary_range || '',
        j.requirements_summary || '',
        j.sync_source || 'verified_registry',
        j.last_checked_at || snapshot?.generatedAt || NOW_ISO,
        NOW_ISO,
      );
      if (existingJobIds.has(j.id)) jobsUpdated += 1;
      else jobsAdded += 1;
    }

    // Heal any existing DB rows (including user_submitted or legacy ATS sync rows) with unnormalized city names, drifted city_tier, or legacy salary slogans
    const updateLocationStmt = db.prepare('UPDATE jobs SET city = ?, province = ?, city_tier = ? WHERE id = ?');
    for (const row of db.prepare('SELECT id, city, province, city_tier FROM jobs').all()) {
      const nextLoc = normalizeJobLocation(row.city, row.province);
      if (nextLoc.city !== row.city || nextLoc.province !== row.province || nextLoc.city_tier !== row.city_tier) {
        updateLocationStmt.run(nextLoc.city, nextLoc.province, nextLoc.city_tier, row.id);
      }
    }
    db.prepare(
      "UPDATE jobs SET salary_range = '以官网为准' WHERE salary_range IN ('薪资面议/官网披露', '面议/官网披露', '校招竞争力总包', '社招极具竞争力薪酬', '实习日薪+餐补/房补')",
    ).run();

    for (const src of DEFAULT_SYNC_SOURCES) {
      upsertSource.run(
        src.id,
        src.name,
        src.source_type,
        src.url,
        src.default_company_id,
        src.enabled,
        src.auto_interval_hours,
        NOW_ISO,
        src.last_status,
        src.last_message,
        src.id === 'src-builtin-registry' ? jobsToUpsert.length : src.items_count,
        NOW_ISO,
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return { companiesAdded, companiesUpdated, jobsAdded, jobsUpdated };
}

function insertStarterResumeRow(stmt, resume, timestamp) {
  stmt.run(
    resume.id,
    resume.title,
    resume.template_id,
    resume.theme_color,
    resume.font_scale,
    resume.margin_preset,
    JSON.stringify(resume.section_order),
    JSON.stringify(resume.hidden_sections),
    JSON.stringify(resume.content_json),
    resume.is_default,
    timestamp,
    timestamp,
  );
}

export function seedIfEmpty(db) {
  upsertBuiltInCatalog(db);

  const starterResumes = createStarterTemplateResumes();
  const insertResume = db.prepare(`
    INSERT INTO resumes (
      id, title, template_id, theme_color, font_scale, margin_preset,
      section_order, hidden_sections, content_json, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const existingResumes = db.prepare('SELECT * FROM resumes').all();
  if (existingResumes.length === 0) {
    for (const r of starterResumes) {
      insertStarterResumeRow(insertResume, r, NOW_ISO);
    }
  } else {
    const starterMap = new Map(starterResumes.map((r) => [r.id, r]));
    const updateResume = db.prepare(`
      UPDATE resumes SET
        title = ?,
        template_id = ?,
        theme_color = ?,
        font_scale = ?,
        margin_preset = ?,
        section_order = ?,
        hidden_sections = ?,
        content_json = ?,
        updated_at = ?
      WHERE id = ?
    `);
    let migratedLegacy = false;
    for (const row of existingResumes) {
      if (!isLegacySamplePersona(row)) continue;
      const starter = starterMap.get(row.id);
      if (!starter) continue;
      migratedLegacy = true;
      updateResume.run(
        starter.title,
        starter.template_id,
        starter.theme_color,
        starter.font_scale,
        starter.margin_preset,
        JSON.stringify(starter.section_order),
        JSON.stringify(starter.hidden_sections),
        JSON.stringify(starter.content_json),
        NOW_ISO,
        row.id,
      );
    }
    const hasCreative = existingResumes.some((row) => row.id === 'resume-creative-sample');
    if (migratedLegacy && !hasCreative) {
      const creative = starterMap.get('resume-creative-sample');
      if (creative) insertStarterResumeRow(insertResume, creative, NOW_ISO);
    }
  }

  const appCount = db.prepare('SELECT COUNT(*) AS cnt FROM applications').get().cnt;
  if (appCount === 0) {
    const insertApp = db.prepare(`
      INSERT INTO applications (
        id, job_id, company_name, job_title, city, official_url, season_tag,
        channel, referral_code, resume_id, status, interview_round, next_event_at,
        applied_at, priority, notes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of DEMO_APPLICATIONS) {
      insertApp.run(
        a.id,
        a.job_id,
        a.company_name,
        a.job_title,
        a.city,
        a.official_url,
        a.season_tag,
        a.channel,
        a.referral_code,
        a.resume_id,
        a.status,
        a.interview_round,
        a.next_event_at,
        a.applied_at,
        a.priority,
        a.notes,
        a.is_demo,
        NOW_ISO,
        NOW_ISO,
      );
    }
  }
}
