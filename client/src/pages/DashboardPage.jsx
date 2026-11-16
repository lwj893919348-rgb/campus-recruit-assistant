import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  FileText,
  CalendarClock,
  CheckCircle2,
  MapPin,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { api } from '../api/client.js';
import { APPLICATION_STAGES, STAGE_MAP, formatEventCountdown } from '../data/constants.js';

export const DashboardPage = memo(function DashboardPage({
  onNavigate,
  onFilterCity,
  onOpenResume,
  onQuickTrack,
  refreshSignal = 0,
  isActive = true,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastLoadedSignalRef = useRef(-1);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    if (lastLoadedSignalRef.current === refreshSignal) return;
    const isInitial = lastLoadedSignalRef.current === -1;
    lastLoadedSignalRef.current = refreshSignal;
    loadDashboard({ silent: !isInitial });
  }, [isActive, refreshSignal, loadDashboard]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-3xl bg-teal-900/[0.06]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-teal-900/[0.05]" />
          ))}
        </div>
      </div>
    );
  }

  const { summary, funnel, defaultResume, upcomingEvents, closingJobs, topCities, featuredCompanies } = data;
  const funnelTotal = APPLICATION_STAGES.reduce((acc, s) => acc + (funnel[s.key] || 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="fresh-card relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#f5fcf9] to-[#eef8fc] p-6 sm:p-7">
        <div className="pointer-events-none absolute -top-16 -right-14 h-56 w-56 rounded-full bg-gradient-to-br from-teal-200/35 to-sky-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-emerald-100/40 blur-2xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/85 px-3 py-1 text-xs font-medium text-teal-800">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              直连企业官网与官方 ATS 系统 · 透明标注原岗详链与方向参考
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#132A2E] sm:text-2xl">
              职航 · 大学生校招与官方直聘工作台
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[#4F686C]">
              主攻校园招聘与实习机会（兼顾社招补录与 16 大行业职能方向）；支持简历防丢自动保存、按地区与详情直达精准选岗及全流程投递防重管理。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 font-medium text-sky-800">
                校园招聘：{summary.recruitTypeCounts?.['校园招聘'] ?? 0} 岗
              </span>
              <span className="rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 font-medium text-violet-800">
                社会招聘：{summary.recruitTypeCounts?.['社会招聘'] ?? 0} 岗
              </span>
              <span className="rounded-full border border-amber-200/80 bg-amber-50/85 px-3 py-1 font-medium text-amber-800">
                实习兼职：{summary.recruitTypeCounts?.['实习兼职'] ?? 0} 岗
              </span>
              <span className="rounded-full border border-teal-200/80 bg-teal-50/75 px-3 py-1 font-medium text-teal-800">
                全品类职能：{summary.categoryCount ?? 16} 大类
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="fresh-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <Briefcase className="h-4 w-4" />
              搜索官网校招
            </button>
            <button
              type="button"
              onClick={() => onNavigate('resume')}
              className="fresh-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              <FileText className="h-4 w-4 text-teal-600" />
              编辑校招简历
            </button>
            <button
              type="button"
              onClick={() => onNavigate('applications')}
              className="fresh-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              <TrendingUp className="h-4 w-4 text-violet-600" />
              管理投递进度
            </button>
          </div>
        </div>
      </section>

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="fresh-card fresh-card-hover p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">已核验官网 / 在招岗位</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Briefcase className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-[#132A2E]">{summary.totalCompanies}</span>
            <span className="text-xs text-slate-500">家名企 · {summary.totalOpenJobs} 个岗位</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('jobs')}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            按地区筛选岗位 <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="fresh-card fresh-card-hover p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">我的投递总数</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-[#132A2E]">{summary.totalApplications}</span>
            <span className="text-xs text-slate-500">
              含 {funnel.interview || 0} 个面试 · {funnel.offer || 0} 个 Offer
            </span>
          </div>
          <div className="mt-2.5 text-xs text-slate-500">
            约面转化率 <span className="tabular-nums font-semibold text-teal-700">{summary.interviewRate}%</span>
          </div>
        </div>

        <div className="fresh-card fresh-card-hover p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">待处理笔试 / 面试</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CalendarClock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-amber-600">
              {(funnel.assessment || 0) + (funnel.interview || 0)}
            </span>
            <span className="text-xs text-slate-500">场流程进行中</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('applications')}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            查看进度看板 <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="fresh-card fresh-card-hover p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">本地简历版本</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <FileText className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-[#132A2E]">{summary.totalResumes}</span>
            <span className="truncate text-xs text-slate-500">
              默认：{defaultResume?.title || '未命名'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenResume(defaultResume?.id)}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            打开默认简历导出 PDF <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* Funnel Bar + Upcoming Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Funnel + Top Cities */}
        <div className="space-y-6 lg:col-span-7">
          <section className="fresh-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#132A2E]">官方投递漏斗分布</h2>
              <button
                type="button"
                onClick={() => onNavigate('applications')}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                进入完整看板
              </button>
            </div>
            {funnelTotal > 0 && (
              <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-100/90">
                {APPLICATION_STAGES.map((stage) => {
                  const val = funnel[stage.key] || 0;
                  if (val <= 0) return null;
                  return (
                    <div
                      key={stage.key}
                      className={`${stage.barClass || stage.dotClass} transition-all`}
                      style={{ width: `${Math.max(4, Math.round((val / funnelTotal) * 100))}%` }}
                      title={`${stage.label}: ${val}`}
                    />
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {APPLICATION_STAGES.map((stage) => (
                <div
                  key={stage.key}
                  className={`rounded-xl border px-3 py-2.5 text-center transition hover:shadow-xs ${stage.columnBg}`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${stage.dotClass}`} />
                    <span>{stage.shortLabel}</span>
                  </div>
                  <div className="mt-1 tabular-nums text-xl font-bold text-[#132A2E]">{funnel[stage.key] || 0}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="fresh-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#132A2E]">热门直聘城市直通车</h2>
                <p className="text-xs text-slate-500">点击城市一键查看当地官方渠道在招职位与校招/实习入口</p>
              </div>
              <MapPin className="h-4 w-4 text-teal-600" />
            </div>
            <div className="flex flex-wrap gap-2">
              {topCities.map((c) => (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => onFilterCity(c.city)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-900/10 bg-teal-50/45 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-teal-400/60 hover:bg-teal-50 hover:text-teal-800"
                >
                  <span>{c.city}</span>
                  <span className="tabular-nums rounded-full bg-white/95 px-1.5 py-0.5 text-[11px] text-teal-700 ring-1 ring-teal-900/10">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Featured Companies */}
          <section className="fresh-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#132A2E]">已核验名企官方招聘入口</h2>
              <button
                type="button"
                onClick={() => onNavigate('jobs')}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                全部 {summary.totalCompanies} 家官网
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {featuredCompanies.map((c) => (
                <div
                  key={c.id}
                  className="fresh-subcard flex items-center justify-between px-3.5 py-2.5 transition hover:border-teal-300/70 hover:bg-white/90"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-2xs"
                        style={{ backgroundColor: c.badge_color }}
                      >
                        {c.short_name.slice(0, 1)}
                      </span>
                      <span className="truncate text-sm font-semibold text-[#132A2E]">{c.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="text-teal-700">{c.official_domain}</span>
                      <span>·</span>
                      <span>{c.open_job_count} 个在招</span>
                    </div>
                  </div>
                  <a
                    href={c.official_campus_url}
                    target="_blank"
                    rel="noreferrer"
                    className="fresh-btn-secondary inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium"
                  >
                    官网 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Upcoming Interviews & Closing Jobs */}
        <div className="space-y-6 lg:col-span-5">
          <section className="fresh-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-teal-600" />
                <h2 className="text-base font-semibold text-[#132A2E]">近期笔试与面试提醒</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('applications')}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                去安排
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/40 p-6 text-center text-xs text-slate-500">
                暂无即将到来的笔面试安排，可在「投递进度管理」中为推进中的岗位设置面试时间。
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.map((ev) => {
                  const stage = STAGE_MAP[ev.status] || STAGE_MAP.applied;
                  const countdown = formatEventCountdown(ev.next_event_at);
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-teal-900/[0.08] bg-white/75 p-3 transition hover:border-teal-300/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[#132A2E]">{ev.company_name}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${stage.badgeClass}`}>
                              {ev.interview_round || stage.shortLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-600">{ev.job_title}</div>
                        </div>
                        {countdown && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              countdown.tone === 'urgent'
                                ? 'bg-rose-100/80 text-rose-700'
                                : countdown.tone === 'warning'
                                  ? 'bg-amber-100/85 text-amber-800'
                                  : 'bg-sky-50 text-sky-700'
                            }`}
                          >
                            {countdown.text}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="tabular-nums">时间：{ev.next_event_at.replace('T', ' ')}</span>
                        {ev.resume_title && (
                          <button
                            type="button"
                            onClick={() => onOpenResume(ev.resume_id)}
                            className="font-medium text-teal-700 hover:underline"
                          >
                            查看简历：{ev.resume_title}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="fresh-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-base font-semibold text-[#132A2E]">即将截止官网网申</h2>
            </div>
            <div className="space-y-2.5">
              {closingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-50/55 to-orange-50/35 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#132A2E]">
                      <span>{job.company_name}</span>
                      <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-normal text-slate-600 ring-1 ring-amber-200/60">
                        {job.city}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-700">{job.title}</div>
                    <div className="mt-1 tabular-nums text-[11px] font-medium text-amber-700">
                      网申截止：{job.deadline}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <a
                      href={job.official_source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium text-teal-700"
                    >
                      官网 <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onQuickTrack(job)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                    >
                      <CheckCircle2 className="h-3 w-3" /> 记入投递
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});
