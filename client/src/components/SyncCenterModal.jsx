import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Rss,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Plus,
  Trash2,
  X,
  Database,
} from 'lucide-react';
import { api } from '../api/client';

const SOURCE_TYPE_LABELS = {
  builtin_catalog: '内置名企库',
  lifecycle_audit: '生命周期巡检',
  catalog: '内置名企库',
  lifecycle: '生命周期巡检',
  rss_atom: 'RSS / Atom',
  json_feed: 'JSON Feed',
  html_jsonld: '网页 JSON-LD',
};

const SOURCE_STATUS_BADGE = {
  synced: { text: '同步正常', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  restricted_portal: { text: '门禁/需登录已跳过', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  unreachable: { text: '网络不可达', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  blocked: { text: '安全策略拦截', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  idle: { text: '待同步', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const TRIGGER_LABELS = {
  manual: '手动全量同步',
  scheduled: '后台定时巡检',
  batch_import: '批量导入入库',
};

const SAMPLE_BATCH_TEXT = `腾讯, 2027暑期实习-AI应用开发工程师, 深圳, https://careers.tencent.com/campus, 2027-05-30, 2027届春招提前批
米哈游, 游戏客户端开发工程师（校招）, 上海, https://jobs.mihoyo.com, 2027-04-30, 2027届秋招补录`;

export default function SyncCenterModal({ isOpen, onClose, onSynced, onToast, companies = [] }) {
  const [activeTab, setActiveTab] = useState('sources');
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    sourceType: 'rss_atom',
    url: '',
    defaultCompanyId: '',
    autoIntervalHours: 6,
  });

  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await api.getSyncStatus();
      setStatusData(data);
    } catch (err) {
      onToast('error', `加载更新中心状态失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setImportResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleRunSync(sourceId = null) {
    setRunningId(sourceId || 'all');
    try {
      const res = await api.runSync(sourceId ? { sourceId } : {});
      onToast(
        'success',
        `更新完成：检查 ${res.sourcesChecked} 个源，新增 ${res.addedCount} 条，更新 ${res.updatedCount} 条，下线过期 ${res.expiredCount} 条。`,
      );
      await loadStatus();
      onSynced?.();
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setRunningId(null);
    }
  }

  async function handleToggleSource(src) {
    try {
      await api.updateSyncSource(src.id, { enabled: !src.enabled });
      onToast('info', `${src.name} 已${src.enabled ? '暂停' : '启用'}自动同步。`);
      await loadStatus();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleDeleteSource(src) {
    try {
      await api.deleteSyncSource(src.id);
      onToast('info', `已移除订阅源「${src.name}」。`);
      await loadStatus();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleAddSource(e) {
    e.preventDefault();
    try {
      await api.createSyncSource({
        ...sourceForm,
        defaultCompanyId: sourceForm.defaultCompanyId || null,
      });
      onToast('success', '已添加公开校招订阅源，可直接点击同步测试解析效果！');
      setSourceForm({
        name: '',
        sourceType: 'rss_atom',
        url: '',
        defaultCompanyId: '',
        autoIntervalHours: 6,
      });
      setShowAddSource(false);
      await loadStatus();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleBatchImport(e) {
    e.preventDefault();
    if (!importText.trim()) {
      onToast('error', '请先粘贴校招清单文本或 JSON 数组。');
      return;
    }
    setImporting(true);
    try {
      const res = await api.batchImportJobs({ rawText: importText });
      setImportResult(res);
      onToast(
        'success',
        `批量导入完成：识别 ${res.parsedCount} 条，新增 ${res.added} 条，更新 ${res.updated} 条！`,
      );
      await loadStatus();
      onSynced?.();
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setImporting(false);
    }
  }

  const counts = statusData?.counts || {
    companies: 0,
    jobs: 0,
    openJobs: 0,
    closingSoonJobs: 0,
    closedJobs: 0,
    enabledSources: 0,
  };
  const sources = statusData?.sources || [];
  const recentRuns = statusData?.recentRuns || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Database className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">招聘信息更新与订阅中心</h3>
              <p className="text-xs text-slate-500">
                实时巡检校招截止状态 · 增量同步官方目录 · 订阅合规公开 RSS / JSON / JSON-LD 源
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 gap-2.5 border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
            <div className="text-[11px] text-slate-500">覆盖官网企业</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-slate-900">{counts.companies} 家</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
            <div className="text-[11px] text-slate-500">当前在招/全部岗位</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-blue-600">
              {counts.openJobs} <span className="text-xs font-normal text-slate-400">/ {counts.jobs}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
            <div className="text-[11px] text-slate-500">10天内临近截止</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-amber-600">{counts.closingSoonJobs} 岗</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
            <div className="text-[11px] text-slate-500">已过截止自动下线</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-slate-600">{counts.closedJobs} 岗</div>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'sources' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rss className="h-3.5 w-3.5" />
              订阅源与自动更新 ({sources.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'import' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              批量文本 / JSON 导入
            </button>
          </div>

          {activeTab === 'sources' && (
            <button
              type="button"
              disabled={Boolean(runningId)}
              onClick={() => handleRunSync(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${runningId === 'all' ? 'animate-spin' : ''}`} />
              {runningId === 'all' ? '正在同步更新...' : '立即全量同步更新'}
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {api.isStaticMode && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <strong>GitHub Pages 免服务器静态模式：</strong>
                核心名企与岗位库由 GitHub Actions 每日定时巡检更新
                {statusData?.staticExportedAt
                  ? `（本版生成于 ${new Date(statusData.staticExportedAt).toLocaleString()}）`
                  : ''}
                ；浏览器内「立即全量同步」与「批量文本导入」会实时写入当前浏览器本地存储并检查截止期。跨站 RSS 源需本地服务或 Actions 拉取。
              </div>
            </div>
          )}
          {activeTab === 'sources' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">已配置信息源与巡检策略</div>
                <button
                  type="button"
                  onClick={() => setShowAddSource((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showAddSource ? '收起表单' : '添加外部订阅源'}
                </button>
              </div>

              {showAddSource && (
                <form
                  onSubmit={handleAddSource}
                  className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-700">订阅源名称 *</label>
                      <input
                        required
                        value={sourceForm.name}
                        onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                        placeholder="如：校招公告 RSS / 某企业公开 JSON 源"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">解析格式</label>
                      <select
                        value={sourceForm.sourceType}
                        onChange={(e) => setSourceForm({ ...sourceForm, sourceType: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="rss_atom">RSS / Atom Feed</option>
                        <option value="json_feed">JSON Feed (结构化岗位)</option>
                        <option value="html_jsonld">网页 Schema.org JSON-LD</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-700">公开订阅源 URL *</label>
                      <input
                        required
                        type="url"
                        value={sourceForm.url}
                        onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">默认归属企业（可选）</label>
                      <select
                        value={sourceForm.defaultCompanyId}
                        onChange={(e) => setSourceForm({ ...sourceForm, defaultCompanyId: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">自动按标题/域名匹配</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      合规声明：仅读取公开标准 Feed/JSON-LD；遇到 401/403/429 登录或反爬门禁将自动跳过并提示。
                    </span>
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      保存订阅源
                    </button>
                  </div>
                </form>
              )}

              {loading && sources.length === 0 ? (
                <div className="rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                  正在读取同步源配置...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sources.map((src) => {
                    const badge = SOURCE_STATUS_BADGE[src.last_status] || SOURCE_STATUS_BADGE.idle;
                    return (
                      <div
                        key={src.id}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{src.name}</span>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {SOURCE_TYPE_LABELS[src.source_type] || src.source_type}
                            </span>
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                              {badge.text}
                            </span>
                          </div>
                          {src.url && (
                            <div className="truncate font-mono text-[11px] text-slate-400">{src.url}</div>
                          )}
                          <div className="text-xs text-slate-600">
                            {src.last_message || '等待触发同步'}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              周期：每 {src.auto_interval_hours} 小时
                            </span>
                            {src.last_synced_at && (
                              <span>最近执行：{new Date(src.last_synced_at).toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSource(src)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                              src.enabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {src.enabled ? '已启用' : '已暂停'}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(runningId)}
                            onClick={() => handleRunSync(src.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${runningId === src.id ? 'animate-spin' : ''}`} />
                            同步
                          </button>
                          {!src.is_builtin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSource(src)}
                              className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                              title="删除订阅源"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sync Runs Audit Log */}
              <div className="pt-2">
                <div className="mb-2 text-xs font-semibold text-slate-700">最近更新记录（自动去重留痕）</div>
                {recentRuns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    暂无手动或定时同步记录，点击右上角「立即全量同步更新」即可执行首次巡检。
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">触发方式</th>
                          <th className="px-3 py-2 font-medium">结果统计</th>
                          <th className="px-3 py-2 font-medium">完成时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {recentRuns.slice(0, 5).map((run) => (
                          <tr key={run.id}>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {TRIGGER_LABELS[run.trigger_type] || run.trigger_type}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              检查 {run.sources_checked} 源 · 新增 {run.added_count} · 更新 {run.updated_count} · 过期下线{' '}
                              {run.expired_count}
                              {run.restricted_count > 0 && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700">
                                  <ShieldAlert className="h-3 w-3" /> {run.restricted_count} 门禁跳过
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[11px] text-slate-400">
                              {new Date(run.finished_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleBatchImport} className="space-y-3.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs leading-relaxed text-slate-600">
                <div className="font-semibold text-slate-800">支持将学校就业群/师兄内推群/Excel表格导出的校招清单一键入库：</div>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px]">
                  <li>
                    每行格式：<code className="rounded bg-white px-1.5 py-0.5 text-slate-800">公司名称, 岗位名称, 城市, https://官网投递链接, [截止日期], [招聘季]</code>（逗号、竖线或 Tab 分隔均可）
                  </li>
                  <li>也支持直接粘贴标准 JSON 数组，系统会自动校验链接安全性并增量去重（同链接不会重复创建）。</li>
                </ul>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">粘贴待入库清单</label>
                <button
                  type="button"
                  onClick={() => setImportText(SAMPLE_BATCH_TEXT)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  填入示例格式（2条测试数据）
                </button>
              </div>

              <textarea
                rows={7}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="例如：&#10;字节跳动, 后端开发工程师（补录）, 北京, https://jobs.bytedance.com/campus, 2027-05-15, 2027届春招补录"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/30 p-3 font-mono text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
              />

              {importResult && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    成功处理 {importResult.parsedCount} 条记录：新增 <strong>{importResult.added}</strong> 条、更新{' '}
                    <strong>{importResult.updated}</strong> 条、跳过无效/非法链接 {importResult.skipped} 条。
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  自动拦截内网地址与非 http/https 链接
                </span>
                <button
                  type="submit"
                  disabled={importing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {importing ? '正在解析去重入库...' : '解析并增量入库'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
