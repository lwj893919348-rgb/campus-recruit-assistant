import crypto from 'node:crypto';
import { Router } from 'express';
import {
  refreshJobLifecycles,
  upsertImportedItems,
  runFullSync,
  parseBatchImportText,
} from '../services/syncEngine.js';
import { isPrivateOrLoopbackHost } from '../services/officialVerifier.js';

import nodeCrypto from 'node:crypto';
import { ALL_SYNC_SOURCE_TYPES, detectAtsPlatform, getCompanyAtsSupport } from '../../shared/atsPlatforms.js';

const ALLOWED_SOURCE_TYPES = new Set(ALL_SYNC_SOURCE_TYPES);
const BUILTIN_SOURCE_IDS = new Set(['src-builtin-catalog', 'src-lifecycle-audit']);

function formatRunRow(row) {
  if (!row) return null;
  let summary = [];
  try {
    summary = JSON.parse(row.summary_json || '[]');
  } catch {
    summary = [];
  }
  return {
    ...row,
    summary,
  };
}

function getSyncCounts(db) {
  const companies = db.prepare('SELECT COUNT(*) AS cnt FROM companies').get().cnt;
  const jobs = db.prepare('SELECT COUNT(*) AS cnt FROM jobs').get().cnt;
  const openJobs = db.prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE status IN ('open', 'closing_soon')").get().cnt;
  const closingSoonJobs = db.prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE status = 'closing_soon'").get().cnt;
  const closedJobs = db.prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE status = 'closed'").get().cnt;
  const enabledSources = db.prepare('SELECT COUNT(*) AS cnt FROM sync_sources WHERE enabled = 1').get().cnt;
  return {
    companies,
    jobs,
    openJobs,
    closingSoonJobs,
    closedJobs,
    enabledSources,
  };
}

export function createSyncRouter(db, options = {}) {
  const router = Router();
  const allowPrivateHosts = Boolean(options.allowPrivateHosts);

  router.get('/sync/status', (req, res) => {
    const counts = getSyncCounts(db);
    const sources = db
      .prepare(
        `
        SELECT * FROM sync_sources
        ORDER BY
          CASE id WHEN 'src-builtin-catalog' THEN 0 WHEN 'src-lifecycle-audit' THEN 1 ELSE 2 END,
          created_at ASC
      `,
      )
      .all()
      .map((s) => ({ ...s, enabled: Boolean(s.enabled), is_builtin: BUILTIN_SOURCE_IDS.has(s.id) }));

    const recentRuns = db
      .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 10')
      .all()
      .map(formatRunRow);

    res.json({
      counts,
      lastRun: recentRuns[0] || null,
      sources,
      recentRuns,
    });
  });

  router.post('/sync/run', async (req, res, next) => {
    try {
      const { sourceId = null } = req.body || {};
      if (sourceId) {
        const exists = db.prepare('SELECT id FROM sync_sources WHERE id = ?').get(sourceId);
        if (!exists) {
          return res.status(404).json({ error: '未找到指定的订阅源。' });
        }
      }

      const result = await runFullSync(db, {
        triggerType: 'manual',
        sourceId: sourceId || null,
        fetchImpl: options.syncFetchImpl || globalThis.fetch,
        allowPrivateHosts,
      });

      res.json({
        ...result,
        counts: getSyncCounts(db),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/sync/sources', (req, res) => {
    const {
      name,
      sourceType = 'rss_atom',
      url,
      defaultCompanyId = null,
      autoIntervalHours = 6,
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '订阅源名称不能为空。' });
    }
    if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
      return res.status(400).json({
        error:
          '不支持的订阅源格式，请使用 ats_auto / beisen_zhiye / hotjob_wecruit / greenhouse / lever / ashby / rss_atom / json_feed / html_jsonld。',
      });
    }
    if (!url || !url.trim()) {
      return res.status(400).json({ error: '订阅源 URL 不能为空。' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({ error: '订阅源 URL 格式不合法，请输入完整的 http/https 地址。' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: '订阅源仅支持 http 或 https 协议。' });
    }
    const hostLower = parsedUrl.hostname.toLowerCase();
    if (hostLower === 'mp.weixin.qq.com' || hostLower.endsWith('.weixin.qq.com') || hostLower === 'weixin.qq.com') {
      return res.status(400).json({
        error:
          '微信公众号文章受微信官方访问验证限制，不支持后台直接爬取。请复制公众号招聘正文到「粘贴导入 / 公众号公告解析」中一键提取岗位。',
      });
    }
    if (!allowPrivateHosts && isPrivateOrLoopbackHost(parsedUrl.hostname)) {
      return res.status(400).json({ error: '禁止添加内网或本地回环地址作为外部订阅源。' });
    }

    let resolvedCompanyId = null;
    if (defaultCompanyId) {
      const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(defaultCompanyId);
      if (!company) {
        return res.status(400).json({ error: '关联的默认企业不存在。' });
      }
      resolvedCompanyId = company.id;
    }

    const interval = Math.max(1, Math.min(168, Number(autoIntervalHours) || 6));
    const id = `src-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO sync_sources (
        id, name, source_type, url, default_company_id,
        enabled, auto_interval_hours, last_synced_at, last_status, last_message, items_count, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, '', 'idle', '待同步：可点击立即同步拉取最新校招信息', 0, ?)
    `,
    ).run(id, name.trim(), sourceType, parsedUrl.href, resolvedCompanyId, interval, now);

    const created = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(id);
    res.status(201).json({
      ...created,
      enabled: Boolean(created.enabled),
      is_builtin: false,
    });
  });

  router.patch('/sync/sources/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '订阅源不存在。' });
    }

    const { enabled, autoIntervalHours, name } = req.body || {};
    const nextEnabled = enabled === undefined ? existing.enabled : enabled ? 1 : 0;
    const nextInterval =
      autoIntervalHours === undefined
        ? existing.auto_interval_hours
        : Math.max(1, Math.min(168, Number(autoIntervalHours) || existing.auto_interval_hours));
    const nextName = name !== undefined && String(name).trim() ? String(name).trim() : existing.name;

    db.prepare('UPDATE sync_sources SET enabled = ?, auto_interval_hours = ?, name = ? WHERE id = ?').run(
      nextEnabled,
      nextInterval,
      nextName,
      id,
    );

    const updated = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(id);
    res.json({
      ...updated,
      enabled: Boolean(updated.enabled),
      is_builtin: BUILTIN_SOURCE_IDS.has(updated.id),
    });
  });

  router.delete('/sync/sources/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM sync_sources WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '订阅源不存在。' });
    }
    if (BUILTIN_SOURCE_IDS.has(id)) {
      return res.status(400).json({ error: '系统内置目录与截止巡检源不可删除，可通过开关停用。' });
    }

    db.prepare('DELETE FROM sync_sources WHERE id = ?').run(id);
    res.json({ deleted: true, id });
  });

  router.post('/sync/import/preview', (req, res) => {
    const { rawText = '' } = req.body || {};
    const companies = db.prepare('SELECT * FROM companies').all();
    const items = parseBatchImportText(rawText, companies);
    res.json({
      count: items.length,
      items,
      warning:
        /mp\.weixin\.qq\.com/i.test(String(rawText || '')) && items.some((it) => !it.officialUrl)
          ? '检测到文本含微信公众号链接但缺少企业官网直投链接，请在下方预览表中补全官网投递 URL 后再确认入库。'
          : '',
    });
  });

  router.post('/sync/import', (req, res) => {
    const { rawText = '', items = null, seasonTag = '', syncSource = 'batch_import' } = req.body || {};
    const companies = db.prepare('SELECT * FROM companies').all();
    let parsedItems = Array.isArray(items) ? items : parseBatchImportText(rawText, companies);

    if (seasonTag && String(seasonTag).trim()) {
      const overrideSeason = String(seasonTag).trim();
      parsedItems = parsedItems.map((it) => ({ ...it, seasonTag: it.seasonTag || overrideSeason }));
    }

    if (!parsedItems.length) {
      return res.status(400).json({
        error: '未能识别有效校招条目，请使用 JSON 数组或「公司名, 岗位名, 城市, https://官网链接, [截止日期]」格式。',
      });
    }

    const startedAt = new Date().toISOString();
    const importStats = upsertImportedItems(db, parsedItems, {
      sourceKey: 'batch_import',
      syncSource,
      allowPrivateHosts,
    });
    const lifecycleStats = refreshJobLifecycles(db);
    const finishedAt = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO sync_runs (
        trigger_type, sources_checked, added_count, updated_count,
        expired_count, restricted_count, summary_json, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      'batch_import',
      1,
      importStats.added,
      importStats.updated,
      lifecycleStats.expiredCount,
      0,
      JSON.stringify([
        {
          sourceId: 'batch_import',
          name: '手动批量文本/JSON导入',
          status: 'synced',
          added: importStats.added,
          updated: importStats.updated,
          expired: lifecycleStats.expiredCount,
          message: `识别 ${parsedItems.length} 条，新增 ${importStats.added} 条，更新 ${importStats.updated} 条，跳过 ${importStats.skipped} 条`,
        },
      ]),
      startedAt,
      finishedAt,
    );

    res.status(201).json({
      ...importStats,
      parsedCount: parsedItems.length,
      lifecycleStats,
      counts: getSyncCounts(db),
    });
  });

  router.post('/sync/sources/subscribe-company', (req, res) => {
    const { companyId, channel = 'auto' } = req.body || {};
    if (!companyId) {
      return res.status(400).json({ error: '缺少 companyId 参数。' });
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) {
      return res.status(404).json({ error: '未找到指定企业。' });
    }

    const atsInfo = getCompanyAtsSupport(company);
    if (!atsInfo?.autoSyncable) {
      return res.status(400).json({
        error:
          atsInfo?.reason ||
          '该企业官网暂不支持免密明文 ATS 自动同步（若为 Moka / 飞书门户请使用官网直达或粘贴招聘公告提取）。',
        atsInfo,
      });
    }

    let targetUrl = atsInfo.url || company.official_campus_url || company.official_social_url || '';
    if (channel === 'social' && company.official_social_url) {
      const socialDetected = detectAtsPlatform(company.official_social_url, 'ats_auto');
      const socialPlatform = typeof socialDetected === 'string' ? socialDetected : socialDetected?.platform;
      if (['beisen_zhiye', 'hotjob_wecruit', 'greenhouse', 'lever', 'ashby'].includes(socialPlatform)) {
        targetUrl = company.official_social_url;
      }
    } else if (channel === 'campus' && company.official_campus_url) {
      const campusDetected = detectAtsPlatform(company.official_campus_url, 'ats_auto');
      const campusPlatform = typeof campusDetected === 'string' ? campusDetected : campusDetected?.platform;
      if (['beisen_zhiye', 'hotjob_wecruit', 'greenhouse', 'lever', 'ashby'].includes(campusPlatform)) {
        targetUrl = company.official_campus_url;
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ error: '该企业缺少有效的公开 ATS 招聘入口地址。' });
    }

    const existing = db.prepare('SELECT * FROM sync_sources WHERE url = ?').get(targetUrl);
    if (existing) {
      if (!existing.enabled) {
        db.prepare('UPDATE sync_sources SET enabled = 1 WHERE id = ?').run(existing.id);
      }
      const updatedRow = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(existing.id);
      return res.json({ source: updatedRow, created: false, atsInfo });
    }

    const id = `src-ats-${nodeCrypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const label = atsInfo.label || '官方 ATS';
    const name = `${company.short_name || company.name} · ${label}`;

    db.prepare(
      `
      INSERT INTO sync_sources (
        id, name, source_type, url, default_company_id, enabled, auto_interval_hours,
        last_status, last_message, items_count, created_at
      )
      VALUES (?, ?, 'ats_auto', ?, ?, 1, 6, 'idle', '已订阅官方 ATS 自动追新，可立即同步', 0, ?)
      `,
    ).run(id, name, targetUrl, company.id, now);

    const createdRow = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(id);
    return res.status(201).json({ source: createdRow, created: true, atsInfo });
  });

  // POST /api/sync/sources/subscribe-all-ats -> bulk-subscribe all auto-syncable open-ATS companies
  router.post('/sync/sources/subscribe-all-ats', (_req, res) => {
    const companies = db.prepare('SELECT * FROM companies').all();
    const existingRows = db.prepare('SELECT * FROM sync_sources').all();
    const byUrl = new Map(existingRows.map((row) => [row.url, row]));
    const now = new Date().toISOString();

    const insertStmt = db.prepare(
      `
      INSERT INTO sync_sources (
        id, name, source_type, url, default_company_id, enabled, auto_interval_hours,
        last_status, last_message, items_count, created_at
      )
      VALUES (?, ?, 'ats_auto', ?, ?, 1, 6, 'idle', '已批量订阅官方 ATS 自动追新，可直接一键同步', 0, ?)
      `,
    );
    const enableStmt = db.prepare('UPDATE sync_sources SET enabled = 1 WHERE id = ?');

    let createdCount = 0;
    let reenabledCount = 0;
    let totalSupported = 0;
    const sources = [];

    db.exec('BEGIN;');
    try {
      for (const company of companies) {
        const atsInfo = getCompanyAtsSupport(company);
        if (!atsInfo?.autoSyncable || !atsInfo.url) continue;
        totalSupported += 1;

        const existing = byUrl.get(atsInfo.url);
        if (existing) {
          if (!existing.enabled) {
            enableStmt.run(existing.id);
            reenabledCount += 1;
          }
          sources.push({ ...existing, enabled: 1 });
          continue;
        }

        const id = `src-ats-${nodeCrypto.randomUUID().slice(0, 8)}`;
        const name = `${company.short_name || company.name} · ${atsInfo.label || '官方 ATS'}`;
        insertStmt.run(id, name, atsInfo.url, company.id, now);
        const createdRow = db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(id);
        byUrl.set(atsInfo.url, createdRow);
        sources.push(createdRow);
        createdCount += 1;
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return res.json({
      createdCount,
      reenabledCount,
      totalSupported,
      sources,
    });
  });

  return router;
}
