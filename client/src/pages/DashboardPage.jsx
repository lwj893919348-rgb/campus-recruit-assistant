import React, { useEffect, useState } from 'react';
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

export function DashboardPage({ onNavigate, onFilterCity, onOpenResume, onQuickTrack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getDashboard()
      .then((res) => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      </div>
    );
  }

  const { summary, funnel, defaultResume, upcomingEvents, closingJobs, topCities, featuredCompanies } = data;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              直连企业校招 / 社招官网 · 杜绝虚假二手岗与培训引流
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              职航 · 全景官方直聘工作台
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              覆盖校园招聘、社会招聘与实习兼职 16 大行业职能方向；支持企业公众号公告智能解析、A4 简历精排与全流程投递追踪。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                校园招聘：{summary.recruitTypeCounts?.['校园招聘'] ?? 0} 岗
              </span>
              <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
                社会招聘：{summary.recruitTypeCounts?.['社会招聘'] ?? 0} 岗
              </span>
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
                实习兼职：{summary.recruitTypeCounts?.['实习兼职'] ?? 0} 岗
              </span>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                全品类职能：{summary.categoryCount ?? 16} 大类
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-700"
            >
              <Briefcase className="h-4 w-4" />
              搜索官网校招
            </button>
            <button
              type="button"
              onClick={() => onNavigate('resume')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              编辑校招简历
            </button>
            <button
              type="button"
              onClick={() => onNavigate('applications')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              管理投递进度
            </button>
          </div>
        </div>
      </section>

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">已核验官网 / 在招岗位</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-slate-900">{summary.totalCompanies}</span>
            <span className="text-xs text-slate-500">家名企 · {summary.totalOpenJobs} 个岗位</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('jobs')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            按地区筛选岗位 <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">我的投递总数</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-slate-900">{summary.totalApplications}</span>
            <span className="text-xs text-slate-500">
              含 {funnel.interview || 0} 个面试 · {funnel.offer || 0} 个 Offer
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            约面转化率 <span className="tabular-nums font-semibold text-indigo-600">{summary.interviewRate}%</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">待处理笔试 / 面试</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-amber-600">
              {(funnel.assessment || 0) + (funnel.interview || 0)}
            </span>
            <span className="text-xs text-slate-500">场流程进行中</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('applications')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            查看进度看板 <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">本地简历版本</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-bold text-slate-900">{summary.totalResumes}</span>
            <span className="truncate text-xs text-slate-500">
              默认：{defaultResume?.title || '未命名'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenResume(defaultResume?.id)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            打开默认简历导出 PDF <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* Funnel Bar + Upcoming Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Funnel + Top Cities */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">官方投递漏斗分布</h2>
              <button
                type="button"
                onClick={() => onNavigate('applications')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                进入完整看板
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {APPLICATION_STAGES.map((stage) => (
                <div
                  key={stage.key}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${stage.dotClass}`} />
                    <span>{stage.shortLabel}</span>
                  </div>
                  <div className="mt-1 tabular-nums text-xl font-bold text-slate-900">{funnel[stage.key] || 0}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">热门直聘城市直通车</h2>
                <p className="text-xs text-slate-500">点击城市一键查看当地真实官网在招岗位（校招 + 社招）</p>
              </div>
              <MapPin className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex flex-wrap gap-2">
              {topCities.map((c) => (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => onFilterCity(c.city)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  <span>{c.city}</span>
                  <span className="tabular-nums rounded-md bg-white px-1.5 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Featured Companies */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">已核验名企官方招聘入口</h2>
              <button
                type="button"
                onClick={() => onNavigate('jobs')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                全部 {summary.totalCompanies} 家官网
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {featuredCompanies.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                        style={{ backgroundColor: c.badge_color }}
                      >
                        {c.short_name.slice(0, 1)}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-900">{c.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="text-emerald-700">{c.official_domain}</span>
                      <span>·</span>
                      <span>{c.open_job_count} 个在招</span>
                    </div>
                  </div>
                  <a
                    href={c.official_campus_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600"
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">近期笔试与面试提醒</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('applications')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                去安排
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
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
                      className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 transition hover:border-indigo-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">{ev.company_name}</span>
                            <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${stage.badgeClass}`}>
                              {ev.interview_round || stage.shortLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-600">{ev.job_title}</div>
                        </div>
                        {countdown && (
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              countdown.tone === 'urgent'
                                ? 'bg-rose-100 text-rose-700'
                                : countdown.tone === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-50 text-blue-700'
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
                            className="text-blue-600 hover:underline"
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">即将截止官网网申</h2>
            </div>
            <div className="space-y-2.5">
              {closingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span>{job.company_name}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-normal text-slate-600 ring-1 ring-slate-200">
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
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-blue-600 ring-1 ring-slate-200 hover:bg-blue-50"
                    >
                      官网 <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onQuickTrack(job)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
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
}
