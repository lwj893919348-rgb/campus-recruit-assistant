import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  LayoutGrid,
  Table2,
  Download,
  ExternalLink,
  Search,
  MapPin,
  FileText,
  CalendarClock,
  ArrowRight,
  Pencil,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client.js';
import { APPLICATION_STAGES, STAGE_MAP, SEASON_OPTIONS, formatEventCountdown } from '../data/constants.js';

const EMPTY_FORM = {
  id: '',
  company_name: '',
  job_title: '',
  city: '',
  official_url: '',
  season_tag: '2027届秋招补录',
  channel: '官网直投',
  referral_code: '',
  resume_id: '',
  status: 'applied',
  interview_round: '',
  next_event_at: '',
  applied_at: new Date().toISOString().slice(0, 10),
  notes: '',
};

export function ApplicationsPage({ resumes, onOpenResume, onToast, refreshSignal }) {
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [applications, setApplications] = useState([]);
  const [counts, setCounts] = useState({});
  const [hasDemo, setHasDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('全部');
  const [filterCity, setFilterCity] = useState('全部');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getApplications({ q, status: filterStatus, city: filterCity });
      setApplications(data.applications);
      setCounts(data.counts || {});
      setHasDemo(Boolean(data.hasDemo));
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [q, filterStatus, filterCity, onToast]);

  useEffect(() => {
    const timer = setTimeout(loadApplications, 150);
    return () => clearTimeout(timer);
  }, [loadApplications, refreshSignal]);

  const uniqueCities = Array.from(new Set(applications.map((a) => a.city).filter(Boolean)));
  const totalCount = Object.values(counts).reduce((acc, n) => acc + (n || 0), 0);

  function openNewDrawer() {
    const defResume = resumes.find((r) => r.is_default) || resumes[0];
    setForm({
      ...EMPTY_FORM,
      applied_at: new Date().toISOString().slice(0, 10),
      resume_id: defResume ? defResume.id : '',
    });
    setDrawerOpen(true);
  }

  function openEditDrawer(app) {
    setForm({
      id: app.id,
      company_name: app.company_name || '',
      job_title: app.job_title || '',
      city: app.city || '',
      official_url: app.official_url || '',
      season_tag: app.season_tag || '2027届秋招补录',
      channel: app.channel || '官网直投',
      referral_code: app.referral_code || '',
      resume_id: app.resume_id || '',
      status: app.status || 'applied',
      interview_round: app.interview_round || '',
      next_event_at: app.next_event_at || '',
      applied_at: app.applied_at || new Date().toISOString().slice(0, 10),
      notes: app.notes || '',
    });
    setDrawerOpen(true);
  }

  async function handleSaveForm(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) {
        await api.updateApplication(form.id, form);
        onToast('success', `已更新「${form.company_name}」的投递进度`);
      } else {
        await api.createApplication(form);
        onToast('success', `已新增投递记录：${form.company_name}`);
      }
      setDrawerOpen(false);
      loadApplications();
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(appId, nextStatus) {
    try {
      await api.patchApplicationStatus(appId, nextStatus);
      const st = STAGE_MAP[nextStatus];
      onToast('success', `状态已更新为「${st?.label || nextStatus}」`);
      loadApplications();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleDelete(app) {
    if (!window.confirm(`确定删除「${app.company_name} - ${app.job_title}」的投递记录吗？`)) return;
    try {
      await api.deleteApplication(app.id);
      onToast('info', '已删除投递记录');
      loadApplications();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleClearDemo() {
    if (!window.confirm('将一键清除所有示例演示数据，保留您自己添加的记录，确定继续吗？')) return;
    try {
      const res = await api.clearDemoApplications();
      onToast('info', `已清除 ${res.cleared} 条演示数据`);
      loadApplications();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold text-slate-900">校招投递信息管理中心</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            记录每一次网申、笔试与面试节点，关联使用的简历版本与内推码，随时掌控求职全流程
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasDemo && (
            <button
              type="button"
              onClick={handleClearDemo}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              清空示例数据
            </button>
          )}
          <button
            type="button"
            onClick={() => api.downloadApplicationsCsv()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            导出 CSV
          </button>
          <button
            type="button"
            onClick={openNewDrawer}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            添加投递信息
          </button>
        </div>
      </div>

      {/* Stage Summary Strip */}
      <section className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {APPLICATION_STAGES.map((stage) => {
          const active = filterStatus === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setFilterStatus(active ? '全部' : stage.key)}
              className={`rounded-2xl border p-3 text-left transition ${
                active
                  ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className={`h-2 w-2 shrink-0 rounded-full ${stage.dotClass}`} />
                <span className="truncate">{stage.shortLabel}</span>
              </div>
              <div className="mt-1 tabular-nums text-2xl font-bold text-slate-900">{counts[stage.key] || 0}</div>
            </button>
          );
        })}
      </section>

      {/* Filter + View Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索公司、岗位、城市或复盘笔记..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pr-3 pl-9 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option value="全部">全部状态 ({totalCount})</option>
            {APPLICATION_STAGES.map((st) => (
              <option key={st.key} value={st.key}>
                {st.label} ({counts[st.key] || 0})
              </option>
            ))}
          </select>

          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option value="全部">全部投递城市</option>
            {uniqueCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition ${
              viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> 看板视图
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" /> 列表视图
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60" />
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {APPLICATION_STAGES.map((stage) => {
            const colApps = applications.filter((a) => a.status === stage.key);
            const nextStage = stage.next ? STAGE_MAP[stage.next] : null;
            return (
              <div
                key={stage.key}
                className={`flex min-h-[260px] flex-col rounded-2xl border p-3 ${stage.columnBg}`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <span className={`h-2 w-2 rounded-full ${stage.dotClass}`} />
                    <span>{stage.label}</span>
                  </div>
                  <span className="tabular-nums rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                    {colApps.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5">
                  {colApps.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/50 p-4 text-center text-[11px] text-slate-400">
                      暂无记录
                    </div>
                  ) : (
                    colApps.map((app) => {
                      const countdown = formatEventCountdown(app.next_event_at);
                      return (
                        <div
                          key={app.id}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition hover:border-blue-300"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-bold text-slate-900">{app.company_name}</span>
                                {app.is_demo && (
                                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">
                                    示例
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs font-medium text-slate-700">{app.job_title}</div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditDrawer(app)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                title="编辑详情"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(app)}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            {app.city && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                                <MapPin className="h-3 w-3" />
                                {app.city}
                              </span>
                            )}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{app.channel}</span>
                            {app.interview_round && (
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                                {app.interview_round}
                              </span>
                            )}
                          </div>

                          {app.next_event_at && (
                            <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50/70 px-2 py-1 text-[11px] text-amber-900">
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <CalendarClock className="h-3 w-3 text-amber-600" />
                                {app.next_event_at.replace('T', ' ')}
                              </span>
                              {countdown && <span className="font-semibold">{countdown.text}</span>}
                            </div>
                          )}

                          {app.resume_title && (
                            <button
                              type="button"
                              onClick={() => onOpenResume(app.resume_id)}
                              className="mt-2 flex w-full items-center gap-1 truncate rounded-md bg-blue-50/60 px-2 py-1 text-left text-[11px] text-blue-700 hover:bg-blue-100/70"
                            >
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="truncate">{app.resume_title}</span>
                            </button>
                          )}

                          {app.notes && (
                            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{app.notes}</p>
                          )}

                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                            <select
                              value={app.status}
                              onChange={(e) => handleStatusChange(app.id, e.target.value)}
                              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700"
                            >
                              {APPLICATION_STAGES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.shortLabel}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1.5">
                              {app.official_url && (
                                <a
                                  href={app.official_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:underline"
                                >
                                  官网 <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {nextStage && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(app.id, nextStage.key)}
                                  className="inline-flex items-center gap-0.5 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-800"
                                  title={`推进至：${nextStage.label}`}
                                >
                                  推进 <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <th className="px-4 py-3 font-semibold">公司 / 岗位</th>
                <th className="px-3 py-3 font-semibold">城市</th>
                <th className="px-3 py-3 font-semibold">状态与轮次</th>
                <th className="px-3 py-3 font-semibold">投递渠道</th>
                <th className="px-3 py-3 font-semibold">投递简历版本</th>
                <th className="px-3 py-3 font-semibold">日程 / 投递日期</th>
                <th className="px-4 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    暂无匹配的投递信息，点击右上角「添加投递信息」或前往官网搜索一键记入。
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const stage = STAGE_MAP[app.status] || STAGE_MAP.applied;
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{app.company_name}</div>
                        <div className="mt-0.5 text-slate-600">{app.job_title}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{app.city || '-'}</td>
                      <td className="px-3 py-3">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}
                          className={`rounded-md border px-2 py-1 text-xs font-medium ${stage.badgeClass}`}
                        >
                          {APPLICATION_STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {app.interview_round && (
                          <div className="mt-1 text-[11px] text-indigo-700">{app.interview_round}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div>{app.channel}</div>
                        {app.referral_code && (
                          <div className="text-[11px] text-slate-500">内推码：{app.referral_code}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {app.resume_title ? (
                          <button
                            type="button"
                            onClick={() => onOpenResume(app.resume_id)}
                            className="text-blue-600 hover:underline"
                          >
                            {app.resume_title}
                          </button>
                        ) : (
                          <span className="text-slate-400">未关联</span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        <div>投递：{app.applied_at}</div>
                        {app.next_event_at && (
                          <div className="mt-0.5 font-medium text-amber-700">
                            日程：{app.next_event_at.replace('T', ' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {app.official_url && (
                            <a
                              href={app.official_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              官网
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditDrawer(app)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(app)}
                            className="text-rose-600 hover:text-rose-800"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Slide-Over Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {form.id ? '编辑投递进度与复盘' : '添加校招投递信息'}
                </h3>
                <p className="text-xs text-slate-500">支持记录任意公司网申进度、内推码、笔面试时间及复盘</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">公司名称 *</label>
                  <input
                    required
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder="如：字节跳动"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">投递岗位 *</label>
                  <input
                    required
                    value={form.job_title}
                    onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                    placeholder="如：后端开发工程师"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">工作城市</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="如：北京 / 杭州"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">校招季</label>
                  <select
                    value={form.season_tag}
                    onChange={(e) => setForm({ ...form, season_tag: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {SEASON_OPTIONS.filter((s) => s !== '全部').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">当前状态 *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {APPLICATION_STAGES.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">细分轮次</label>
                  <input
                    value={form.interview_round}
                    onChange={(e) => setForm({ ...form, interview_round: e.target.value })}
                    placeholder="如：统一笔试 / 一面 / HR面"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">投递日期</label>
                  <input
                    type="date"
                    value={form.applied_at}
                    onChange={(e) => setForm({ ...form, applied_at: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">下次笔试/面试时间</label>
                  <input
                    type="datetime-local"
                    value={form.next_event_at}
                    onChange={(e) => setForm({ ...form, next_event_at: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">投递渠道</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="官网直投">官网直投</option>
                    <option value="校招内推">校招内推</option>
                    <option value="校园宣讲">校园宣讲 / 双选会</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">内推码 / 内推人</label>
                  <input
                    value={form.referral_code}
                    onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
                    placeholder="选填"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">关联本次投递使用的简历版本</label>
                <select
                  value={form.resume_id}
                  onChange={(e) => setForm({ ...form, resume_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">暂不关联</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">企业官网进度查询链接</label>
                <input
                  type="url"
                  value={form.official_url}
                  onChange={(e) => setForm({ ...form, official_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">面经复盘 / 官网账号备忘</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="记录官网登录邮箱/手机号、笔试考察题型、一面技术问题与待补强点..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {saving ? '保存中...' : '保存投递记录'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
