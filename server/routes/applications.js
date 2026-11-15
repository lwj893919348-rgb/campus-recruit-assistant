import express from 'express';
import crypto from 'node:crypto';

export const APPLICATION_STATUSES = ['wishlist', 'applied', 'assessment', 'interview', 'offer', 'rejected'];

const STATUS_LABELS = {
  wishlist: '待投递/收藏',
  applied: '已投递',
  assessment: '测评/笔试',
  interview: '面试中',
  offer: '已拿 Offer',
  rejected: '流程终止',
};

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function createApplicationsRouter(db) {
  const router = express.Router();

  const selectWithResumeSql = `
    SELECT a.*, r.title AS resume_title
    FROM applications a
    LEFT JOIN resumes r ON r.id = a.resume_id
  `;

  router.get('/applications', (req, res) => {
    const { status = '', city = '', season = '', q = '' } = req.query;
    const conditions = [];
    const params = [];

    if (status && status !== '全部') {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (city && city !== '全部') {
      conditions.push('a.city = ?');
      params.push(city);
    }
    if (season && season !== '全部') {
      conditions.push('a.season_tag = ?');
      params.push(season);
    }
    if (q.trim()) {
      const pattern = `%${q.trim()}%`;
      conditions.push('(a.company_name LIKE ? OR a.job_title LIKE ? OR a.city LIKE ? OR a.notes LIKE ?)');
      params.push(pattern, pattern, pattern, pattern);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `
      ${selectWithResumeSql}
      ${where}
      ORDER BY
        CASE WHEN a.next_event_at != '' THEN 0 ELSE 1 END ASC,
        a.next_event_at ASC,
        a.updated_at DESC
    `,
      )
      .all(...params);

    const allCountsRaw = db
      .prepare('SELECT status, COUNT(*) AS count FROM applications GROUP BY status')
      .all();
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    for (const row of allCountsRaw) {
      counts[row.status] = row.count;
    }

    const demoCount = db.prepare('SELECT COUNT(*) AS cnt FROM applications WHERE is_demo = 1').get().cnt;

    res.json({
      applications: rows.map((r) => ({ ...r, is_demo: Boolean(r.is_demo) })),
      counts,
      hasDemo: demoCount > 0,
    });
  });

  router.get('/applications/export.csv', (req, res) => {
    const rows = db
      .prepare(`${selectWithResumeSql} ORDER BY a.applied_at DESC, a.updated_at DESC`)
      .all();

    const headers = [
      '公司名称',
      '岗位名称',
      '工作城市',
      '招聘季',
      '投递状态',
      '当前轮次',
      '下次日程时间',
      '投递日期',
      '投递渠道',
      '内推码',
      '使用简历版本',
      '官网链接',
      '复盘/备注',
    ];

    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) =>
        [
          r.company_name,
          r.job_title,
          r.city,
          r.season_tag,
          STATUS_LABELS[r.status] || r.status,
          r.interview_round,
          r.next_event_at,
          r.applied_at,
          r.channel,
          r.referral_code,
          r.resume_title || '',
          r.official_url,
          r.notes,
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];

    const csvBody = '\uFEFF' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="campus-applications.csv"');
    res.send(csvBody);
  });

  router.delete('/applications/demo', (req, res) => {
    const info = db.prepare('DELETE FROM applications WHERE is_demo = 1').run();
    res.json({ cleared: info.changes });
  });

  router.post('/applications', (req, res) => {
    const {
      job_id = null,
      company_name = '',
      job_title = '',
      city = '',
      official_url = '',
      season_tag = '2027届秋招补录',
      channel = '官网直投',
      referral_code = '',
      resume_id = null,
      status = 'applied',
      interview_round = '',
      next_event_at = '',
      applied_at = new Date().toISOString().slice(0, 10),
      priority = 'normal',
      notes = '',
    } = req.body || {};

    if (!company_name.trim() || !job_title.trim()) {
      return res.status(400).json({ error: '请填写公司名称和岗位名称。' });
    }

    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: '无效的投递状态值。' });
    }

    let safeResumeId = resume_id || null;
    if (safeResumeId) {
      const exists = db.prepare('SELECT id FROM resumes WHERE id = ?').get(safeResumeId);
      if (!exists) safeResumeId = null;
    }

    let safeJobId = job_id || null;
    if (safeJobId) {
      const exists = db.prepare('SELECT id FROM jobs WHERE id = ?').get(safeJobId);
      if (!exists) safeJobId = null;
    }

    const id = `app-${crypto.randomBytes(5).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO applications (
        id, job_id, company_name, job_title, city, official_url, season_tag,
        channel, referral_code, resume_id, status, interview_round, next_event_at,
        applied_at, priority, notes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `,
    ).run(
      id,
      safeJobId,
      company_name.trim(),
      job_title.trim(),
      city.trim(),
      official_url.trim(),
      season_tag.trim(),
      channel.trim() || '官网直投',
      referral_code.trim(),
      safeResumeId,
      status,
      interview_round.trim(),
      next_event_at.trim(),
      applied_at.trim() || now.slice(0, 10),
      priority,
      notes.trim(),
      now,
      now,
    );

    const created = db.prepare(`${selectWithResumeSql} WHERE a.id = ?`).get(id);
    res.status(201).json({ application: { ...created, is_demo: Boolean(created.is_demo) } });
  });

  router.put('/applications/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '未找到该投递记录。' });

    const {
      company_name,
      job_title,
      city,
      official_url,
      season_tag,
      channel,
      referral_code,
      resume_id,
      status,
      interview_round,
      next_event_at,
      applied_at,
      priority,
      notes,
    } = req.body || {};

    const nextStatus = status ?? existing.status;
    if (!APPLICATION_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ error: '无效的投递状态值。' });
    }

    let safeResumeId = resume_id === undefined ? existing.resume_id : resume_id || null;
    if (safeResumeId) {
      const exists = db.prepare('SELECT id FROM resumes WHERE id = ?').get(safeResumeId);
      if (!exists) safeResumeId = null;
    }

    const now = new Date().toISOString();
    db.prepare(
      `
      UPDATE applications SET
        company_name = ?,
        job_title = ?,
        city = ?,
        official_url = ?,
        season_tag = ?,
        channel = ?,
        referral_code = ?,
        resume_id = ?,
        status = ?,
        interview_round = ?,
        next_event_at = ?,
        applied_at = ?,
        priority = ?,
        notes = ?,
        is_demo = 0,
        updated_at = ?
      WHERE id = ?
    `,
    ).run(
      company_name !== undefined ? String(company_name).trim() || existing.company_name : existing.company_name,
      job_title !== undefined ? String(job_title).trim() || existing.job_title : existing.job_title,
      city !== undefined ? String(city).trim() : existing.city,
      official_url !== undefined ? String(official_url).trim() : existing.official_url,
      season_tag !== undefined ? String(season_tag).trim() : existing.season_tag,
      channel !== undefined ? String(channel).trim() : existing.channel,
      referral_code !== undefined ? String(referral_code).trim() : existing.referral_code,
      safeResumeId,
      nextStatus,
      interview_round !== undefined ? String(interview_round).trim() : existing.interview_round,
      next_event_at !== undefined ? String(next_event_at).trim() : existing.next_event_at,
      applied_at !== undefined ? String(applied_at).trim() : existing.applied_at,
      priority !== undefined ? priority : existing.priority,
      notes !== undefined ? String(notes).trim() : existing.notes,
      now,
      req.params.id,
    );

    const updated = db.prepare(`${selectWithResumeSql} WHERE a.id = ?`).get(req.params.id);
    res.json({ application: { ...updated, is_demo: Boolean(updated.is_demo) } });
  });

  router.patch('/applications/:id/status', (req, res) => {
    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '未找到该投递记录。' });

    const { status, interview_round } = req.body || {};
    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: '无效的投递状态。' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE applications SET status = ?, interview_round = ?, is_demo = 0, updated_at = ? WHERE id = ?').run(
      status,
      interview_round !== undefined ? String(interview_round).trim() : existing.interview_round,
      now,
      req.params.id,
    );

    const updated = db.prepare(`${selectWithResumeSql} WHERE a.id = ?`).get(req.params.id);
    res.json({ application: { ...updated, is_demo: Boolean(updated.is_demo) } });
  });

  router.delete('/applications/:id', (req, res) => {
    const info = db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: '未找到待删除的投递记录。' });
    res.json({ deleted: true, id: req.params.id });
  });

  return router;
}
