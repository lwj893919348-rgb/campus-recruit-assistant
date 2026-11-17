import express from 'express';
import crypto from 'node:crypto';
import { DEFAULT_SECTION_ORDER, createBlankResumeContent } from '../../shared/resumeDefaults.js';

function formatResumeRow(row) {
  if (!row) return null;
  return {
    ...row,
    is_default: Boolean(row.is_default),
    section_order: JSON.parse(row.section_order || '[]'),
    hidden_sections: JSON.parse(row.hidden_sections || '[]'),
    content_json: JSON.parse(row.content_json || '{}'),
  };
}

export function createResumesRouter(db) {
  const router = express.Router();

  router.get('/resumes', (req, res) => {
    const rows = db.prepare('SELECT * FROM resumes ORDER BY is_default DESC, updated_at DESC').all();
    res.json({ resumes: rows.map(formatResumeRow) });
  });

  router.get('/resumes/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: '未找到该简历版本。' });
    res.json({ resume: formatResumeRow(row) });
  });

  router.post('/resumes', (req, res) => {
    const {
      title = '未命名校招简历',
      template_id = 'tech-minimal',
      theme_color = '#2563EB',
      font_scale = 'standard',
      margin_preset = 'standard',
      section_order = DEFAULT_SECTION_ORDER,
      hidden_sections = [],
      content_json = createBlankResumeContent(),
      is_default = false,
    } = req.body || {};

    const id = `resume-${crypto.randomBytes(5).toString('hex')}`;
    const now = new Date().toISOString();

    if (is_default) {
      db.prepare('UPDATE resumes SET is_default = 0').run();
    }

    db.prepare(
      `
      INSERT INTO resumes (
        id, title, template_id, theme_color, font_scale, margin_preset,
        section_order, hidden_sections, content_json, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      String(title).trim() || '未命名校招简历',
      template_id,
      theme_color,
      font_scale,
      margin_preset,
      JSON.stringify(section_order),
      JSON.stringify(hidden_sections),
      JSON.stringify(content_json),
      is_default ? 1 : 0,
      now,
      now,
    );

    const created = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id);
    res.status(201).json({ resume: formatResumeRow(created) });
  });

  router.put('/resumes/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '未找到待更新的简历版本。' });

    const {
      title,
      template_id,
      theme_color,
      font_scale,
      margin_preset,
      section_order,
      hidden_sections,
      content_json,
      is_default,
    } = req.body || {};

    const now = new Date().toISOString();
    if (is_default === true) {
      db.prepare('UPDATE resumes SET is_default = 0 WHERE id != ?').run(req.params.id);
    }

    db.prepare(
      `
      UPDATE resumes SET
        title = ?,
        template_id = ?,
        theme_color = ?,
        font_scale = ?,
        margin_preset = ?,
        section_order = ?,
        hidden_sections = ?,
        content_json = ?,
        is_default = ?,
        updated_at = ?
      WHERE id = ?
    `,
    ).run(
      title !== undefined ? String(title).trim() || existing.title : existing.title,
      template_id || existing.template_id,
      theme_color || existing.theme_color,
      font_scale || existing.font_scale,
      margin_preset || existing.margin_preset,
      section_order !== undefined ? JSON.stringify(section_order) : existing.section_order,
      hidden_sections !== undefined ? JSON.stringify(hidden_sections) : existing.hidden_sections,
      content_json !== undefined ? JSON.stringify(content_json) : existing.content_json,
      is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
      now,
      req.params.id,
    );

    const updated = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    res.json({ resume: formatResumeRow(updated) });
  });

  router.post('/resumes/:id/duplicate', (req, res) => {
    const source = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!source) return res.status(404).json({ error: '未找到要复制的简历版本。' });

    const id = `resume-${crypto.randomBytes(5).toString('hex')}`;
    const now = new Date().toISOString();
    const newTitle = req.body?.title?.trim() || `${source.title}（副本）`;

    db.prepare(
      `
      INSERT INTO resumes (
        id, title, template_id, theme_color, font_scale, margin_preset,
        section_order, hidden_sections, content_json, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `,
    ).run(
      id,
      newTitle,
      source.template_id,
      source.theme_color,
      source.font_scale,
      source.margin_preset,
      source.section_order,
      source.hidden_sections,
      source.content_json,
      now,
      now,
    );

    const created = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id);
    res.status(201).json({ resume: formatResumeRow(created) });
  });

  router.delete('/resumes/:id', (req, res) => {
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM resumes').get().cnt;
    if (count <= 1) {
      return res.status(400).json({ error: '至少需要保留 1 份简历版本，您可以修改内容或先新建再删除。' });
    }

    const existing = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '未找到要删除的简历。' });

    db.prepare('DELETE FROM resumes WHERE id = ?').run(req.params.id);

    if (existing.is_default) {
      const next = db.prepare('SELECT id FROM resumes ORDER BY updated_at DESC LIMIT 1').get();
      if (next) {
        db.prepare('UPDATE resumes SET is_default = 1 WHERE id = ?').run(next.id);
      }
    }

    res.json({ deleted: true, id: req.params.id });
  });

  return router;
}
