import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  MapPin,
  ShieldCheck,
  ExternalLink,
  Plus,
  RefreshCw,
  Building2,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Globe,
  X,
  RotateCcw,
  Database,
} from 'lucide-react';
import { api } from '../api/client.js';
import SyncCenterModal from '../components/SyncCenterModal.jsx';
import {
  REGION_GROUPS,
  SEASON_OPTIONS,
  GRAD_YEAR_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  JOB_CATEGORY_OPTIONS,
  STAGE_MAP,
} from '../data/constants.js';

const VERIFY_BADGE_MAP = {
  verified_official: { text: '官方库核验', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reachable: { text: '实时可达', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  redirect_verified: { text: '官网跳转已核验', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  restricted_portal: { text: '官网门禁(请直达)', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  user_submitted: { text: '用户补充官方源', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  domain_mismatch: { text: '跳转域名需核对', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  unreachable: { text: '暂不可直连', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function JobSearchPage({ initialCity = '', onClearInitialCity, onQuickTrack, onToast, refreshSignal }) {
  const [subView, setSubView] = useState('jobs'); // 'jobs' | 'companies'
  const [q, setQ] = useState('');
  const [regionGroup, setRegionGroup] = useState('全部');
  const [selectedCities, setSelectedCities] = useState(() => (initialCity ? [initialCity] : []));
  const [season, setSeason] = useState('全部');
  const [gradYear, setGradYear] = useState('全部');
  const [companyType, setCompanyType] = useState('全部');
  const [category, setCategory] = useState('全部');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [onlyReferral, setOnlyReferral] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [facets, setFacets] = useState({ cities: [], seasons: [], categories: [], companyTypes: [] });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [verifyingId, setVerifyingId] = useState(null);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [updatingJobs, setUpdatingJobs] = useState(false);
  const [verifyFeedbackMap, setVerifyFeedbackMap] = useState({});

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyWallType, setCompanyWallType] = useState('全部');
  const [portalKeyword, setPortalKeyword] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    companyName: '',
    title: '',
    city: '北京',
    province: '北京',
    category: '技术研发',
    seasonTag: '2027届秋招补录',
    graduationYears: ['2027'],
    officialUrl: '',
    deadline: '招满即止',
    isReferral: false,
    requirementsSummary: '',
  });

  useEffect(() => {
    if (initialCity) {
      setSelectedCities([initialCity]);
      setRegionGroup('全部');
      onClearInitialCity?.();
    }
  }, [initialCity, onClearInitialCity]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getJobs({
        q,
        cities: selectedCities.join(','),
        cityTier: selectedCities.length === 0 ? regionGroup : '全部',
        season,
        gradYear,
        companyType,
        category,
        onlyOpen: onlyOpen ? '1' : '',
        onlyReferral: onlyReferral ? '1' : '',
      });
      setJobs(data.jobs);
      setFacets(data.facets);
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [q, selectedCities, regionGroup, season, gradYear, companyType, category, onlyOpen, onlyReferral, onToast]);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(data.companies);
    } catch (err) {
      onToast('error', err.message);
    }
  }, [onToast]);

  const loadSyncSummary = useCallback(async () => {
    try {
      const data = await api.getSyncStatus();
      setSyncSummary(data);
    } catch {
      // non-fatal status summary
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadJobs();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadJobs, refreshSignal]);

  useEffect(() => {
    loadCompanies();
    loadSyncSummary();
  }, [loadCompanies, loadSyncSummary, refreshSignal]);

  function toggleCity(cityName) {
    setSelectedCities((prev) =>
      prev.includes(cityName) ? prev.filter((c) => c !== cityName) : [...prev, cityName],
    );
  }

  function handleRegionGroupSelect(groupId) {
    setRegionGroup(groupId);
    setSelectedCities([]);
  }

  function resetAllFilters() {
    setQ('');
    setRegionGroup('全部');
    setSelectedCities([]);
    setSeason('全部');
    setGradYear('全部');
    setCompanyType('全部');
    setCategory('全部');
    setOnlyOpen(true);
    setOnlyReferral(false);
  }

  async function handleVerifySingle(payload, key) {
    setVerifyingId(key);
    try {
      const res = await api.verifyUrl(payload);
      setVerifyFeedbackMap((prev) => ({ ...prev, [key]: res }));
      onToast(res.ok ? 'success' : 'error', res.message);
      loadJobs();
      loadCompanies();
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleBatchVerify() {
    setBatchVerifying(true);
    try {
      const pool = filteredCompanies.length > 0 ? filteredCompanies : companies;
      const targetIds = pool.slice(0, 12).map((c) => c.id);
      const res = await api.verifyBatch({ companyIds: targetIds });
      const okCount = res.results.filter((r) => r.ok).length;
      onToast('info', `已完成 ${res.checked} 家官网入口实时状态核验（其中 ${okCount} 家响应正常/门禁可达）。`);
      loadCompanies();
      loadJobs();
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setBatchVerifying(false);
    }
  }

  async function handleQuickUpdateJobs() {
    setUpdatingJobs(true);
    try {
      const res = await api.runSync({});
      await Promise.all([loadJobs(), loadCompanies(), loadSyncSummary()]);
      const summaryParts = [];
      if (res.addedCount > 0) summaryParts.push(`新增 ${res.addedCount} 条`);
      if (res.updatedCount > 0) summaryParts.push(`更新/预警 ${res.updatedCount} 条`);
      if (res.expiredCount > 0) summaryParts.push(`下线过期 ${res.expiredCount} 条`);
      const detail = summaryParts.length > 0 ? summaryParts.join('，') : '已完成最新目录与截止时间巡检';
      onToast('success', `招聘信息已更新：${detail}（共 ${res.counts?.openJobs ?? jobs.length} 个在招岗）。`);
    } catch (err) {
      onToast('error', `更新失败：${err.message}`);
    } finally {
      setUpdatingJobs(false);
    }
  }

  async function handleCreateJob(e) {
    e.preventDefault();
    try {
      await api.createJob(newJob);
      onToast('success', '已校验根域名并收录至官网校招池！');
      setAddModalOpen(false);
      setNewJob({
        companyName: '',
        title: '',
        city: '北京',
        province: '北京',
        category: '技术研发',
        seasonTag: '2027届秋招补录',
        graduationYears: ['2027'],
        officialUrl: '',
        deadline: '招满即止',
        isReferral: false,
        requirementsSummary: '',
      });
      loadJobs();
      loadCompanies();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (companyWallType !== '全部' && c.company_type !== companyWallType) return false;
    if (companyQuery.trim()) {
      const kw = companyQuery.trim().toLowerCase();
      const hay = `${c.name} ${c.short_name} ${c.industry} ${c.hq_city} ${c.company_type}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });

  const visibleCityChips =
    regionGroup === '全部'
      ? facets.cities
      : facets.cities.filter((c) => {
          const g = REGION_GROUPS.find((rg) => rg.id === regionGroup);
          return g ? g.cities.includes(c.city) || c.city_tier === regionGroup : true;
        });

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">真实官网校招信息检索与地区筛选</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              {companies.length} 家官方名企 · {syncSummary?.counts?.openJobs ?? jobs.length} 在招岗
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            所有岗位均标注企业官方主域名并支持实时可达性核验；支持订阅公开校招源、截止自动下线与官网带参直搜
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => setSubView('jobs')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                subView === 'jobs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              岗位搜索 ({jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('companies')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                subView === 'companies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              官方名企入口墙 ({companies.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Database className="h-3.5 w-3.5" />
            信息更新中心
          </button>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Plus className="h-3.5 w-3.5" />
            收录官网岗位
          </button>
        </div>
      </div>

      {subView === 'jobs' ? (
        <>
          {/* Search & Multi-Tier Region Filter Card */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            {/* Search Input */}
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索公司名、岗位关键词（如：Java、大模型、产品经理、管培生、国家电网）..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleQuickUpdateJobs}
                disabled={updatingJobs}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${updatingJobs ? 'animate-spin' : ''}`} />
                {updatingJobs ? '正在更新...' : '更新招聘信息'}
              </button>

              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置全部筛选
              </button>
            </div>

            {/* Region Tier + Multi-City Filter */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  <span>地区筛选（支持城市群切换 & 多城市多选）</span>
                </div>
                {selectedCities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCities([])}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    已选 {selectedCities.length} 个城市 · 清除
                  </button>
                )}
              </div>

              {/* Tier Tabs */}
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {REGION_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleRegionGroupSelect(group.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      regionGroup === group.id && selectedCities.length === 0
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {/* Clickable City Pills */}
              <div className="flex flex-wrap gap-1.5">
                {visibleCityChips.map((c) => {
                  const active = selectedCities.includes(c.city);
                  return (
                    <button
                      key={`${c.city}-${c.province}`}
                      type="button"
                      onClick={() => toggleCity(c.city)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition ${
                        active
                          ? 'bg-slate-900 font-semibold text-white'
                          : 'border border-slate-200/90 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span>{c.city}</span>
                      <span
                        className={`tabular-nums text-[10px] ${
                          active ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {c.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Secondary Dimension Filters */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">校招季 / 类型</label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {SEASON_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">面向毕业届别</label>
                <select
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {GRAD_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y === '全部' ? '全部届别' : `${y} 届毕业生`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">企业性质</label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {COMPANY_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">岗位方向</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {JOB_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyOpen}
                    onChange={(e) => setOnlyOpen(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>仅看网申进行中</span>
                </label>
              </div>

              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyReferral}
                    onChange={(e) => setOnlyReferral(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>仅看支持校招内推</span>
                </label>
              </div>
            </div>
          </section>

          {/* Anti-Trap Student Tip */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-2.5 text-xs text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>官网防坑提示：</strong>
              所有标注绿色「官网认证」的链接均直指企业官方校招根域名；即便使用内推码，最终仍须在企业官网完成正式网申才算生效。遇到需要“付费保Offer/培训内推”的第三方渠道请直接拉黑。
            </span>
          </div>

          {/* Job List */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/60" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-slate-700">没有符合当前筛选条件的官网岗位</p>
              <p className="mt-1 text-xs text-slate-500">可以尝试减少城市限制、切换届别，或点击右上角“收录官网岗位”添加新的官方校招入口。</p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                恢复全部筛选条件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {jobs.map((job) => {
                const badge =
                  VERIFY_BADGE_MAP[job.company_verification_status] || VERIFY_BADGE_MAP.verified_official;
                const liveResult = verifyFeedbackMap[job.id];
                const trackedInfo = job.tracked ? STAGE_MAP[job.tracked.status] : null;

                return (
                  <article
                    key={job.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-xs"
                            style={{ backgroundColor: job.badge_color || '#2563EB' }}
                          >
                            {job.company_short_name?.slice(0, 2) || job.company_name.slice(0, 2)}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900">{job.company_name}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                                {job.company_type}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${badge.cls}`}
                              >
                                <ShieldCheck className="h-3 w-3" />
                                官网 · {job.official_domain}
                              </span>
                            </div>
                            <h3 className="mt-1 text-base font-bold text-slate-900">{job.title}</h3>
                          </div>
                        </div>

                        {job.status === 'closing_soon' ? (
                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            即将截止
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            网申中
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                          <MapPin className="h-3 w-3" />
                          {job.city}
                          {job.province && job.province !== job.city ? ` · ${job.province}` : ''}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{job.season_tag}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{job.category}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                          面向 {job.graduation_years.join('/')} 届
                        </span>
                        {job.is_referral && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                            <Sparkles className="h-3 w-3" /> 支持内推
                          </span>
                        )}
                      </div>

                      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{job.requirements_summary}</p>

                      {liveResult && (
                        <div
                          className={`mt-2.5 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                            liveResult.ok
                              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                              : 'border-rose-200 bg-rose-50/70 text-rose-800'
                          }`}
                        >
                          {liveResult.ok ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{liveResult.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="tabular-nums text-[11px] text-slate-500">
                        截止：<span className="font-medium text-slate-700">{job.deadline}</span>
                        {job.salary_range ? <span className="ml-2 text-slate-400">| {job.salary_range}</span> : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleVerifySingle({ jobId: job.id }, job.id)}
                          disabled={verifyingId === job.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${verifyingId === job.id ? 'animate-spin' : ''}`} />
                          核验官网
                        </button>

                        <a
                          href={job.official_source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          直达官网 <ExternalLink className="h-3 w-3" />
                        </a>

                        {trackedInfo ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${trackedInfo.badgeClass}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            看板：{trackedInfo.shortLabel}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onQuickTrack(job)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            记入投递
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Official Companies Wall */
        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="text-xs text-slate-600">
                共收录 <strong>{companies.length}</strong> 家企业官方校招唯一入口（当前筛选{' '}
                <strong>{filteredCompanies.length}</strong> 家），支持按行业分类检索与带参直搜企业官网。
              </div>
              <button
                type="button"
                onClick={handleBatchVerify}
                disabled={batchVerifying}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${batchVerifying ? 'animate-spin' : ''}`} />
                {batchVerifying ? '批量核验官网状态中...' : '实时批量核验官网'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="筛选名企名称、行业或城市（如：华为、半导体、上海、银行）..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="relative">
                <Sparkles className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-blue-500" />
                <input
                  type="text"
                  value={portalKeyword}
                  onChange={(e) => setPortalKeyword(e.target.value)}
                  placeholder="带参直搜官网岗位词（可选，如：Java、大模型、芯片、管培生）..."
                  className="w-full rounded-xl border border-blue-100 bg-blue-50/30 py-2 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {COMPANY_TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCompanyWallType(t)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    companyWallType === t
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((c) => {
              const badge = VERIFY_BADGE_MAP[c.verification_status] || VERIFY_BADGE_MAP.verified_official;
              const kw = portalKeyword.trim() || q.trim();
              const directSearchUrl =
                kw && c.search_url_template
                  ? c.search_url_template.replace('{q}', encodeURIComponent(kw))
                  : null;
              return (
                <div
                  key={c.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                          style={{ backgroundColor: c.badge_color }}
                        >
                          {c.short_name.slice(0, 2)}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
                          <div className="text-[11px] text-slate-500">
                            {c.company_type} · 总部 {c.hq_city}
                          </div>
                        </div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate font-mono text-[11px]">{c.official_campus_url}</span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{c.notes}</p>
                    {c.last_verify_message && (
                      <p className="mt-1.5 text-[11px] text-slate-500">最近核验：{c.last_verify_message}</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">在招关联 {c.open_job_count} 个岗位</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleVerifySingle({ companyId: c.id }, c.id)}
                        disabled={verifyingId === c.id}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {verifyingId === c.id ? '核验中...' : '核验'}
                      </button>
                      {directSearchUrl && (
                        <a
                          href={directSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          带参搜官网 <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <a
                        href={c.official_campus_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        进入官网 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Custom Official Job Import Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">收录企业官网校招岗位</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateJob} className="space-y-3.5 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">公司全称 *</label>
                  <input
                    required
                    value={newJob.companyName}
                    onChange={(e) => setNewJob({ ...newJob, companyName: e.target.value })}
                    placeholder="如：海康威视"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">岗位名称 *</label>
                  <input
                    required
                    value={newJob.title}
                    onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                    placeholder="如：嵌入式软件工程师"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">官网校招链接（自动提取根域名认证）*</label>
                <input
                  required
                  type="url"
                  value={newJob.officialUrl}
                  onChange={(e) => setNewJob({ ...newJob, officialUrl: e.target.value })}
                  placeholder="https://campushr.hikvision.com/..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">工作城市 *</label>
                  <input
                    required
                    value={newJob.city}
                    onChange={(e) => setNewJob({ ...newJob, city: e.target.value })}
                    placeholder="杭州"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">省份</label>
                  <input
                    value={newJob.province}
                    onChange={(e) => setNewJob({ ...newJob, province: e.target.value })}
                    placeholder="浙江"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">岗位类别</label>
                  <select
                    value={newJob.category}
                    onChange={(e) => setNewJob({ ...newJob, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {JOB_CATEGORY_OPTIONS.filter((c) => c !== '全部').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">招聘季</label>
                  <select
                    value={newJob.seasonTag}
                    onChange={(e) => setNewJob({ ...newJob, seasonTag: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {SEASON_OPTIONS.filter((s) => s !== '全部').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">网申截止日期</label>
                  <input
                    value={newJob.deadline}
                    onChange={(e) => setNewJob({ ...newJob, deadline: e.target.value })}
                    placeholder="2026-12-30 或 招满即止"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">岗位要求摘要</label>
                <textarea
                  rows={2}
                  value={newJob.requirementsSummary}
                  onChange={(e) => setNewJob({ ...newJob, requirementsSummary: e.target.value })}
                  placeholder="简要记录专业、语言或技能要求，方便后续检索对比..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  校验并保存到校招库
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SyncCenterModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSynced={() => {
          loadJobs();
          loadCompanies();
          loadSyncSummary();
        }}
        onToast={onToast}
        companies={companies}
      />
    </div>
  );
}
