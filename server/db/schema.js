/**
 * SQLite schema initialization and backward-compatible incremental migrations.
 * Uses Node.js built-in node:sqlite (DatabaseSync).
 */
function ensureColumn(db, tableName, columnName, columnDef) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = cols.some((c) => c.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
  }
}

export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      industry TEXT NOT NULL,
      company_type TEXT NOT NULL,
      official_domain TEXT NOT NULL,
      official_campus_url TEXT NOT NULL,
      search_url_template TEXT DEFAULT '',
      badge_color TEXT NOT NULL DEFAULT '#2563EB',
      hq_city TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'verified_official',
      last_verified_at TEXT,
      updated_at TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      external_id TEXT DEFAULT '',
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
      sync_source TEXT NOT NULL DEFAULT 'verified_registry',
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);
    CREATE INDEX IF NOT EXISTS idx_jobs_city_tier ON jobs(city_tier);
    CREATE INDEX IF NOT EXISTS idx_jobs_season ON jobs(season_tag);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      template_id TEXT NOT NULL DEFAULT 'tech-minimal',
      theme_color TEXT NOT NULL DEFAULT '#2563EB',
      font_scale TEXT NOT NULL DEFAULT 'standard',
      margin_preset TEXT NOT NULL DEFAULT 'standard',
      section_order TEXT NOT NULL,
      hidden_sections TEXT NOT NULL DEFAULT '[]',
      content_json TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      company_name TEXT NOT NULL,
      job_title TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      official_url TEXT DEFAULT '',
      season_tag TEXT DEFAULT '2027届秋招',
      channel TEXT NOT NULL DEFAULT '官网直投',
      referral_code TEXT DEFAULT '',
      resume_id TEXT,
      status TEXT NOT NULL DEFAULT 'applied',
      interview_round TEXT DEFAULT '',
      next_event_at TEXT DEFAULT '',
      applied_at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      notes TEXT DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_apps_next_event ON applications(next_event_at);

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT,
      target_url TEXT NOT NULL,
      http_status INTEGER,
      final_url TEXT DEFAULT '',
      resolved_domain TEXT DEFAULT '',
      is_domain_match INTEGER NOT NULL DEFAULT 0,
      result_status TEXT NOT NULL,
      message TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sync_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'rss_atom',
      url TEXT NOT NULL DEFAULT '',
      default_company_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      auto_interval_hours INTEGER NOT NULL DEFAULT 6,
      last_synced_at TEXT DEFAULT '',
      last_status TEXT DEFAULT 'idle',
      last_message TEXT DEFAULT '',
      items_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (default_company_id) REFERENCES companies(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      sources_checked INTEGER NOT NULL DEFAULT 0,
      added_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      expired_count INTEGER NOT NULL DEFAULT 0,
      restricted_count INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT DEFAULT '[]',
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL
    );
  `);

  // Backward-compatible migrations for existing v1 databases
  ensureColumn(db, 'companies', 'search_url_template', "TEXT DEFAULT ''");
  ensureColumn(db, 'companies', 'updated_at', "TEXT DEFAULT ''");
  ensureColumn(db, 'jobs', 'external_id', "TEXT DEFAULT ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id);');
}
