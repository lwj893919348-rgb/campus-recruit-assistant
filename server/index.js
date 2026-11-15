import { createDatabase } from './db/database.js';
import { createApp } from './app.js';
import { refreshJobLifecycles, runFullSync } from './services/syncEngine.js';

const PORT = Number(process.env.PORT) || 3001;
const db = createDatabase();

// Run initial deadline lifecycle audit on startup
try {
  const lifecycle = refreshJobLifecycles(db);
  console.log(
    `[职航校招助手] 启动巡检完成：过期自动下线 ${lifecycle.expiredCount} 岗，临近截止预警 ${lifecycle.closingSoonCount} 岗`,
  );
} catch (err) {
  console.error('[职航校招助手] 启动巡检异常:', err);
}

// Schedule periodic auto-sync checks for enabled sources whose interval has elapsed
const AUTO_SYNC_POLL_MS = 60 * 60 * 1000;
const autoSyncTimer = setInterval(async () => {
  try {
    const enabledSources = db.prepare('SELECT * FROM sync_sources WHERE enabled = 1').all();
    const nowMs = Date.now();
    const hasDueSource = enabledSources.some((src) => {
      const intervalMs = Math.max(1, Number(src.auto_interval_hours) || 6) * 60 * 60 * 1000;
      const lastMs = src.last_synced_at ? Date.parse(src.last_synced_at) : 0;
      return !lastMs || Number.isNaN(lastMs) || nowMs - lastMs >= intervalMs;
    });
    if (hasDueSource) {
      await runFullSync(db, { triggerType: 'scheduled' });
    }
  } catch (err) {
    console.error('[职航校招助手] 定时自动更新异常:', err);
  }
}, AUTO_SYNC_POLL_MS);
autoSyncTimer.unref();

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`[职航校招助手] API 服务已就绪: http://localhost:${PORT}`);
});
