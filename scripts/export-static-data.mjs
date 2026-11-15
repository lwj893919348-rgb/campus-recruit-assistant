import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../server/db/database.js';
import { refreshJobLifecycles } from '../server/services/syncEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outFile = path.resolve(projectRoot, 'client', 'public', 'catalog.json');

const db = createDatabase(':memory:', { seed: true });

try {
  const lifecycle = refreshJobLifecycles(db);

  const companies = db.prepare('SELECT * FROM companies ORDER BY id ASC').all();
  const jobs = db
    .prepare('SELECT * FROM jobs ORDER BY created_at DESC')
    .all()
    .map((j) => ({
      ...j,
      graduation_years: JSON.parse(j.graduation_years || '[]'),
      is_referral: Boolean(j.is_referral),
    }));

  const resumes = db
    .prepare('SELECT * FROM resumes ORDER BY is_default DESC, updated_at DESC')
    .all()
    .map((r) => ({
      ...r,
      is_default: Boolean(r.is_default),
      section_order: JSON.parse(r.section_order || '[]'),
      hidden_sections: JSON.parse(r.hidden_sections || '[]'),
      content_json: JSON.parse(r.content_json || '{}'),
    }));

  const applications = db
    .prepare('SELECT * FROM applications ORDER BY updated_at DESC')
    .all()
    .map((a) => ({
      ...a,
      is_demo: Boolean(a.is_demo),
    }));

  const syncSources = db
    .prepare('SELECT * FROM sync_sources ORDER BY created_at ASC')
    .all()
    .map((s) => ({
      ...s,
      enabled: Boolean(s.enabled),
      is_builtin: s.id === 'src-builtin-catalog' || s.id === 'src-lifecycle-audit',
    }));

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      companiesCount: companies.length,
      jobsCount: jobs.length,
      lifecycle,
    },
    companies,
    jobs,
    resumes,
    applications,
    syncSources,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload), 'utf8');

  console.log(
    `[export:static] 已生成 ${path.relative(projectRoot, outFile)} (${companies.length} 家企业, ${jobs.length} 个岗位, 过期下线 ${lifecycle.expiredCount}, 临近预警 ${lifecycle.closingSoonCount})`,
  );
} finally {
  db.close();
}
