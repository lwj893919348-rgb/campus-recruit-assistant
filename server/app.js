import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJobsRouter } from './routes/jobs.js';
import { createResumesRouter } from './routes/resumes.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createSyncRouter } from './routes/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db, options = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'campus-recruit-assistant', timestamp: new Date().toISOString() });
  });

  app.use('/api', createDashboardRouter(db));
  app.use('/api', createJobsRouter(db, options));
  app.use('/api', createResumesRouter(db));
  app.use('/api', createApplicationsRouter(db));
  app.use('/api', createSyncRouter(db, options));

  const distDir = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: err?.message || '服务器内部错误，请稍后再试。' });
  });

  return app;
}
