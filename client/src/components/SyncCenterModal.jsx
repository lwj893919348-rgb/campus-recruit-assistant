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
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';

import { getCompanyAtsSupport } from '../../../shared/atsPlatforms.js';

const SOURCE_TYPE_LABELS = {
  builtin_catalog: '内置名企库',
  lifecycle_audit: '生命周期巡检',
  catalog: '内置名企库',
  lifecycle: '生命周期巡检',
  ats_auto: 'ATS 智能同步',
  beisen_zhiye: '北森招聘云',
  hotjob_wecruit: '大易 HotJob',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  moka_open: 'Moka 公开源',
  feishu_hire: '飞书公开源',
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

const SAMPLE_WECHAT_ANNOUNCEMENT = `【比亚迪集团2026-2027社会招聘与急聘公告】
公众号：比亚迪招聘
一、社会招聘岗位
1、高级BMS嵌入式软件工程师 | 深圳 | 3-5年 | 30-45K | https://job.byd.com
2、新能源汽车供应链采购经理 | 西安 | 3-5年 | 25-38K | https://job.byd.com
3、动力电池电芯工艺工程师（新能源化工）| 深圳 | 1-3年 | 22-35K | https://job.byd.com
二、校园招聘补录岗位
4、自动驾驶规划控制算法工程师（2027届校招）| 深圳 | 应届毕业生 | https://job.byd.com
截止时间：2027-03-31`;

export default function SyncCenterModal({ isOpen, onClose, onSynced, onToast, companies = [] }) {
  const [activeTab, setActiveTab] = useState('sources');
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [subscribingAll, setSubscribingAll] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    sourceType: 'ats_auto',
    url: '',
    defaultCompanyId: '',
    autoIntervalHours: 6,
  });

  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewWarning, setPreviewWarning] = useState('');
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

  async function handleSubscribeAllAts() {
    setSubscribingAll(true);
    try {
      const res = await api.subscribeAllAtsSources();
      if (res?.staticModeNote || api?.isStaticMode) {
        onToast(
          'info',
          res?.staticModeNote ||
            `已保存全部 ${res?.totalSupported || 28} 家可直达企业 ATS 订阅配置；实时同步需运行本地后端 npm run start。`,
        );
      } else {
        onToast(
          'success',
          `已启用全部 ${res?.totalSupported || 0} 家可直达 ATS 企业（新增 ${res?.createdCount || 0} 家、恢复 ${res?.reenabledCount || 0} 家），点击右上角「立即全部同步」即可获取最新官网原岗！`,
        );
      }
      await loadStatus();
      onSynced?.();
    } catch (err) {
      onToast('error', `批量订阅失败：${err.message}`);
    } finally {
      setSubscribingAll(false);
    }
  }

  async function handleAddSource(e) {
    e.preventDefault();
    try {
      await api.createSyncSource({
        ...sourceForm,
        defaultCompanyId: sourceForm.defaultCompanyId || null,
      });
      onToast('success', '已添加官方 ATS / 公开招聘订阅源，可直接点击右侧同步按钮测试拉取！');
      setSourceForm({
        name: '',
        sourceType: 'ats_auto',
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

  async function handlePreviewParse() {
    if (!importText.trim()) {
      onToast('error', '请先粘贴企业公众号招聘推文正文或清单文本。');
      return;
    }
    setPreviewing(true);
    setImportResult(null);
    try {
      const res = await api.previewBatchImport(importText);
      setPreviewItems(res.items || []);
      setPreviewWarning(res.warning || '');
      if (!res.items || res.items.length === 0) {
        onToast('error', '未识别出结构化岗位，建议每行包含“岗位名 | 城市 | 经验 | 官网链接”或使用示例格式。');
      } else {
        onToast('success', `智能解析成功：识别出 ${res.items.length} 个候选岗位，请核对后入库。`);
      }
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleBatchImport(e) {
    e.preventDefault();
    const checkedItems = previewItems.filter((it) => it.selected && it.officialUrl);
    if (previewItems.length > 0 && checkedItems.length === 0) {
      onToast('error', '请至少勾选 1 条已填写企业官网投递链接的岗位再入库。');
      return;
    }
    if (previewItems.length === 0 && !importText.trim()) {
      onToast('error', '请先粘贴公众号招聘公告正文、清单文本或 JSON 数组。');
      return;
    }
    setImporting(true);
    try {
      const res =
        checkedItems.length > 0
          ? await api.batchImportJobs({ items: checkedItems })
          : await api.batchImportJobs({ rawText: importText });
      setImportResult(res);
      setPreviewItems([]);
      setPreviewWarning('');
      onToast(
        'success',
        `入库完成：识别 ${res.parsedCount} 条，新增 ${res.added} 条，更新 ${res.updated} 条！`,
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
    <div className="fresh-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fresh-modal flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-teal-900/10 bg-gradient-to-r from-teal-50/80 via-white to-sky-50/55 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-200/70">
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
        <div className="grid grid-cols-2 gap-2.5 border-b border-teal-900/10 bg-teal-50/35 px-5 py-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-teal-900/10 bg-white/90 px-3 py-2">
            <div className="text-[11px] text-slate-500">覆盖官网企业</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-slate-900">{counts.companies} 家</div>
          </div>
          <div className="rounded-2xl border border-teal-900/10 bg-white/90 px-3 py-2">
            <div className="text-[11px] text-slate-500">当前在招/全部岗位</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-blue-600">
              {counts.openJobs} <span className="text-xs font-normal text-slate-400">/ {counts.jobs}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-teal-900/10 bg-white/90 px-3 py-2">
            <div className="text-[11px] text-slate-500">10天内临近截止</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-amber-600">{counts.closingSoonJobs} 岗</div>
          </div>
          <div className="rounded-2xl border border-teal-900/10 bg-white/90 px-3 py-2">
            <div className="text-[11px] text-slate-500">已过截止自动下线</div>
            <div className="mt-0.5 tabular-nums text-base font-bold text-slate-600">{counts.closedJobs} 岗</div>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center justify-between border-b border-teal-900/10 px-5 py-2.5">
          <div className="inline-flex rounded-2xl border border-teal-900/10 bg-teal-50/55 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'sources' ? 'bg-white text-teal-800 shadow-xs' : 'text-[#4B6366] hover:text-teal-800'
              }`}
            >
              <Rss className="h-3.5 w-3.5" />
              订阅源与自动更新 ({sources.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'import' ? 'bg-white text-teal-800 shadow-xs' : 'text-[#4B6366] hover:text-teal-800'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              公众号公告解析 / 批量导入
            </button>
          </div>

          {activeTab === 'sources' && (
            <button
              type="button"
              disabled={Boolean(runningId)}
              onClick={() => handleRunSync(null)}
              className="fresh-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${runningId === 'all' ? 'animate-spin' : ''}`} />
              {runningId === 'all' ? '正在同步更新...' : '立即全量同步更新'}
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {api.isStaticMode && (
            <div className="flex items-start gap-2 rounded-2xl border border-sky-200/90 bg-sky-50/70 px-3.5 py-2.5 text-xs text-sky-900">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-700">已配置信息源与巡检策略</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSubscribeAllAts}
                    disabled={subscribingAll}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${subscribingAll ? 'animate-spin' : ''}`} />
                    {subscribingAll ? '订阅中...' : '一键订阅全部可直达 ATS 企业'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSource((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showAddSource ? '收起表单' : '添加外部订阅源'}
                  </button>
                </div>
              </div>

              {showAddSource && (
                <form
                  onSubmit={handleAddSource}
                  className="space-y-3 rounded-2xl border border-teal-200/75 bg-teal-50/45 p-4"
                >
                  {(() => {
                    const quickList = (companies || [])
                      .map((c) => ({ company: c, ats: getCompanyAtsSupport(c) }))
                      .filter((item) => item.ats?.autoSyncable);
                    if (quickList.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-emerald-900">
                          <span>快速选用内置「可自动追新」名企官网（{quickList.length} 家北森 / 大易明文公开源，点选即填入）：</span>
                        </div>
                        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                          {quickList.map(({ company: c, ats }) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setSourceForm((prev) => ({
                                  ...prev,
                                  name: `${c.short_name} · ${ats.label}`,
                                  sourceType: 'ats_auto',
                                  url: ats.url || c.official_campus_url || c.official_social_url || '',
                                  defaultCompanyId: c.id,
                                }))
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              <span>{c.short_name}</span>
                              <span className="text-[10px] text-emerald-600">({ats.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-700">订阅源名称 *</label>
                      <input
                        required
                        value={sourceForm.name}
                        onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                        placeholder="如：科大讯飞 · 北森招聘云 / 校招公告 RSS"
                        className="fresh-input w-full rounded-xl px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">解析格式</label>
                      <select
                        value={sourceForm.sourceType}
                        onChange={(e) => setSourceForm({ ...sourceForm, sourceType: e.target.value })}
                        className="fresh-input w-full rounded-xl px-2.5 py-1.5 text-sm"
                      >
                        <option value="ats_auto">ATS 智能识别 · 推荐</option>
                        <option value="beisen_zhiye">北森招聘云 (*.zhiye.com)</option>
                        <option value="hotjob_wecruit">大易 HotJob (*.hotjob.cn)</option>
                        <option value="greenhouse">Greenhouse Open Board</option>
                        <option value="lever">Lever Postings</option>
                        <option value="ashby">Ashby Job Board</option>
                        <option value="moka_open">Moka 公开源 (仅免密明文)</option>
                        <option value="feishu_hire">飞书公开源 (仅 JSON-LD)</option>
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
                        className="fresh-input w-full rounded-xl px-3 py-1.5 font-mono text-xs"
                      />
                      {/weixin\.qq\.com/i.test(sourceForm.url) && (
                        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                          <span>微信公众号文章不支持后台直爬，建议复制推送正文智能提取岗位。</span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('import')}
                            className="shrink-0 font-semibold text-blue-700 hover:underline"
                          >
                            切到公众号解析 →
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">默认归属企业（可选）</label>
                      <select
                        value={sourceForm.defaultCompanyId}
                        onChange={(e) => setSourceForm({ ...sourceForm, defaultCompanyId: e.target.value })}
                        className="fresh-input w-full rounded-xl px-2.5 py-1.5 text-xs"
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
                      合规声明：仅读取北森/大易/Greenhouse 等免密明文公开接口及标准 Feed/JSON-LD；遇到 Moka 加密或飞书签名门禁、401/403/429 限制将自动跳过并标为受保护。
                    </span>
                    <button
                      type="submit"
                      className="fresh-btn-primary rounded-xl px-3.5 py-1.5 text-xs font-semibold"
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
                        className="fresh-card fresh-card-hover flex flex-col justify-between gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center"
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
                            className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium disabled:opacity-50"
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
                  <div className="overflow-hidden rounded-2xl border border-teal-900/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-teal-50/45 text-[11px] text-[#4B6366]">
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
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 text-xs leading-relaxed text-slate-700">
                <div className="font-semibold text-emerald-900">
                  合规微信公众号招聘公告解析 & 全渠道清单一键入库：
                </div>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] text-slate-600">
                  <li>
                    <strong>公众号推文直贴解析</strong>：在微信打开企业官方招聘公众号（如「比亚迪招聘」「腾讯招聘」），直接复制推送文章中的岗位正文粘贴到下方，点击「智能解析预览」自动提取校招/社招通道、16大职能分类、工作城市与经验要求。
                  </li>
                  <li>
                    <strong>结构化清单 / JSON</strong>：支持{' '}
                    <code className="rounded bg-white px-1.5 py-0.5 text-slate-800">
                      公司名称, 岗位名称, 城市, https://官网投递链接, [截止日期], [招聘季]
                    </code>{' '}
                    或标准 JSON 数组，自动去重校验域名。
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">粘贴公众号招聘正文或结构化清单</label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImportText(SAMPLE_WECHAT_ANNOUNCEMENT);
                      setPreviewItems([]);
                      setImportResult(null);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    填入公众号公告示例（社招+校招）
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportText(SAMPLE_BATCH_TEXT);
                      setPreviewItems([]);
                      setImportResult(null);
                    }}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    填入 CSV 清单示例
                  </button>
                </div>
              </div>

              <textarea
                rows={7}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (previewItems.length > 0) setPreviewItems([]);
                }}
                placeholder="直接粘贴企业公众号文章中的招聘正文段落，例如：&#10;【某某公司2026-2027社招公告】&#10;1、资深财务审计经理 | 上海 | 3-5年 | 35-50K | https://careers.example.com"
                className="fresh-input w-full rounded-2xl p-3 font-mono text-xs text-[#132A2E]"
              />

              {previewWarning && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>{previewWarning}</span>
                </div>
              )}

              {previewItems.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-teal-200/80 bg-teal-50/45 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      解析预览列表（识别 {previewItems.length} 条，已勾选{' '}
                      {previewItems.filter((it) => it.selected && it.officialUrl).length} 条可入库）
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewItems([])}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      清空预览
                    </button>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {previewItems.map((item, idx) => (
                      <div
                        key={`${item.companyName}-${item.title}-${idx}`}
                        className="fresh-card flex flex-col gap-2 rounded-xl p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(item.selected)}
                            onChange={(e) =>
                              setPreviewItems((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, selected: e.target.checked } : row)),
                              )
                            }
                            className="mt-0.5 rounded border-slate-300 text-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900">{item.companyName}</span>
                              <span className="font-semibold text-slate-800">· {item.title}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  item.recruitType === '社会招聘'
                                    ? 'bg-violet-50 text-violet-700'
                                    : item.recruitType === '实习兼职'
                                      ? 'bg-amber-50 text-amber-800'
                                      : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {item.recruitType}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                                {item.category}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                {item.city} · {item.experienceReq}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="shrink-0 text-[11px] text-slate-500">投递官网：</span>
                              <input
                                type="url"
                                value={item.officialUrl || ''}
                                onChange={(e) => {
                                  const nextUrl = e.target.value;
                                  setPreviewItems((prev) =>
                                    prev.map((row, i) =>
                                      i === idx
                                        ? { ...row, officialUrl: nextUrl, selected: Boolean(nextUrl.trim()) }
                                        : row,
                                    ),
                                  );
                                }}
                                placeholder="缺少官网投递 URL，请补充 https://..."
                                className={`w-full rounded border px-2 py-0.5 font-mono text-[11px] focus:outline-none ${
                                  item.officialUrl
                                    ? 'border-slate-200 bg-slate-50 text-slate-700'
                                    : 'border-rose-300 bg-rose-50 text-rose-800'
                                }`}
                              />
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    成功处理 {importResult.parsedCount} 条记录：新增 <strong>{importResult.added}</strong> 条、更新{' '}
                    <strong>{importResult.updated}</strong> 条、跳过无效/非法链接 {importResult.skipped} 条。
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  拒绝微信文章直爬与内网链接，仅留存企业官网投递入口
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={previewing}
                    onClick={handlePreviewParse}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/90 px-3.5 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                  >
                    {previewing ? '解析中...' : '智能解析预览'}
                  </button>
                  <button
                    type="submit"
                    disabled={importing}
                    className="fresh-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {importing
                      ? '正在解析去重入库...'
                      : previewItems.length > 0
                        ? `确认入库 (${previewItems.filter((it) => it.selected && it.officialUrl).length} 条)`
                        : '直接解析并增量入库'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
