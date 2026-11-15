import React, { useCallback, useEffect, useState } from 'react';
import { getCompanyAtsSupport } from '../../../shared/atsPlatforms.js';
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
  Copy,
  Check,
  Briefcase,
  MessageSquareText,
} from 'lucide-react';
import { api } from '../api/client.js';
import SyncCenterModal from '../components/SyncCenterModal.jsx';
import {
  REGION_GROUPS,
  RECRUIT_TYPE_OPTIONS,
  EXPERIENCE_OPTIONS,
  SEASON_OPTIONS,
  GRAD_YEAR_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  JOB_CATEGORY_OPTIONS,
  STARTUP_ENTITY_PRESETS,
  STAGE_MAP,
} from '../data/constants.js';

function getTianyanchaSearchUrl(keyword = '') {
  return `https://www.tianyancha.com/search?key=${encodeURIComponent(String(keyword || '').trim())}`;
}

const INITIAL_NEW_JOB = {
  companyName: '',
  companyType: '优质企业',
  legalName: '',
  entityTag: '',
  wechatAccount: '',
  recruitType: '校园招聘',
  experienceReq: '应届毕业生',
  title: '',
  city: '北京',
  province: '北京',
  category: '技术研发',
  seasonTag: '2027届秋招补录',
  graduationYears: ['2027'],
  officialUrl: '',
  salaryRange: '',
  deadline: '招满即止',
  isReferral: false,
  requirementsSummary: '',
};

const INITIAL_NEW_COMPANY = {
  name: '',
  shortName: '',
  legalName: '',
  entityTag: '初创/融资企业 · Pre-A/A轮融资',
  companyType: '初创/融资企业',
  industry: '人工智能 / 硬科技',
  hqCity: '北京',
  officialUrl: '',
  officialSocialUrl: '',
  wechatAccount: '',
  notes: '',
  addInitialJob: false,
  recruitType: '校园招聘',
  experienceReq: '应届毕业生',
  jobTitle: '',
  category: '技术研发',
  seasonTag: '2027届秋招补录',
  city: '北京',
  deadline: '招满即止',
  requirementsSummary: '',
};

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
  const [recruitType, setRecruitType] = useState('全部');
  const [experienceReq, setExperienceReq] = useState('全部');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [onlyReferral, setOnlyReferral] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [facets, setFacets] = useState({
    cities: [],
    seasons: [],
    categories: [],
    companyTypes: [],
    recruitTypes: [],
    experienceReqs: [],
  });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [verifyingId, setVerifyingId] = useState(null);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [updatingJobs, setUpdatingJobs] = useState(false);
  const [verifyFeedbackMap, setVerifyFeedbackMap] = useState({});
  const [copiedWechatId, setCopiedWechatId] = useState(null);
  const [subscribingCompanyId, setSubscribingCompanyId] = useState(null);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyWallType, setCompanyWallType] = useState('全部');
  const [portalKeyword, setPortalKeyword] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newJob, setNewJob] = useState(INITIAL_NEW_JOB);

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState(INITIAL_NEW_COMPANY);

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
        recruitType,
        experienceReq,
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
  }, [
    q,
    selectedCities,
    regionGroup,
    season,
    gradYear,
    companyType,
    category,
    recruitType,
    experienceReq,
    onlyOpen,
    onlyReferral,
    onToast,
  ]);

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
    setRecruitType('全部');
    setExperienceReq('全部');
    setOnlyOpen(true);
    setOnlyReferral(false);
  }

  async function handleSubscribeCompany(company) {
    setSubscribingCompanyId(company.id);
    try {
      const subRes = await api.subscribeCompanySource({ companyId: company.id, channel: 'auto' });
      if (subRes?.staticModeNote || api?.isStaticMode) {
        onToast(
          'info',
          subRes?.staticModeNote ||
            `已为「${company.short_name}」保存 ATS 自动追新订阅配置；实时跨站抓新需运行本地服务端 npm run start。`,
        );
        return;
      }

      const syncRes = await api.runSync({ sourceId: subRes.source.id });
      const result = syncRes?.results?.[0];
      if (result?.status === 'synced') {
        onToast(
          'success',
          `「${company.short_name}」追新完成：新增 ${result.added || 0} 条、更新 ${result.updated || 0} 条在线岗位！`,
        );
      } else if (result?.status === 'restricted_portal') {
        onToast('info', result.message || `「${company.short_name}」门户启用合规保护，请通过官网直达浏览。`);
      } else {
        onToast('info', result?.message || `已订阅「${company.short_name}」自动追新源，可在信息更新中心查看。`);
      }
      await Promise.all([loadJobs(), loadCompanies(), loadSyncSummary()]);
    } catch (err) {
      onToast('error', err.message || '订阅企业追新失败');
    } finally {
      setSubscribingCompanyId(null);
    }
  }

  async function handleCopyWechat(id, accountName) {
    try {
      await navigator.clipboard?.writeText(accountName);
      setCopiedWechatId(id);
      onToast('success', `已复制企业招聘公众号「${accountName}」，可在微信中直接搜索关注`);
      setTimeout(() => setCopiedWechatId(null), 2000);
    } catch {
      onToast('info', `企业招聘公众号：${accountName}`);
    }
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
      onToast('success', '已校验域名隔离并收录至官网校招池！');
      setAddModalOpen(false);
      setNewJob(INITIAL_NEW_JOB);
      loadJobs();
      loadCompanies();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleCreateCompany(e) {
    e.preventDefault();
    setCreatingCompany(true);
    try {
      const payload = {
        ...newCompany,
        jobTitle: newCompany.addInitialJob ? newCompany.jobTitle : '',
      };
      const res = await api.createCompany(payload);
      onToast('success', res.message || `已收录「${newCompany.name}」官方入口！`);
      setCompanyModalOpen(false);
      setCompanyWallType(res.company?.company_type || '初创/融资企业');
      setSubView('companies');
      setNewCompany(INITIAL_NEW_COMPANY);
      await Promise.all([loadCompanies(), loadJobs()]);
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setCreatingCompany(false);
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (companyWallType !== '全部' && c.company_type !== companyWallType) return false;
    if (companyQuery.trim()) {
      const kw = companyQuery.trim().toLowerCase();
      const hay = `${c.name} ${c.short_name} ${c.legal_name || ''} ${c.entity_tag || ''} ${c.wechat_account || ''} ${c.industry} ${c.hq_city} ${c.company_type}`.toLowerCase();
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

  const recruitTypeCountMap = Object.fromEntries(
    (facets.recruitTypes || []).map((item) => [item.value, item.count]),
  );
  const categoryCountMap = Object.fromEntries(
    (facets.categories || []).map((item) => [item.value, item.count]),
  );
  const totalRecruitFacetCount = (facets.recruitTypes || []).reduce((sum, item) => sum + (item.count || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">全行业官方直聘搜索与地区筛选</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              {companies.length} 家官方企业 · {syncSummary?.counts?.openJobs ?? jobs.length} 在招岗（校招/社招/实习）
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            覆盖 16 大职能全品类与校招 / 社招 / 实习通道；均标注官方主域名、工商主体与认证招聘公众号，支持公众号公告一键解析导入
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
            onClick={() => setCompanyModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
          >
            <Building2 className="h-3.5 w-3.5" />
            添加初创/正规企业
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
            {/* Recruit Type Segmented Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                  招聘通道：
                </span>
                {RECRUIT_TYPE_OPTIONS.map((rt) => {
                  const active = recruitType === rt;
                  const count = rt === '全部' ? totalRecruitFacetCount : recruitTypeCountMap[rt] ?? 0;
                  return (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => setRecruitType(rt)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'border border-slate-200 bg-slate-50/80 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      <span>{rt}</span>
                      {count > 0 && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                            active ? 'bg-white/20 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-500">经验/身份：</span>
                <select
                  aria-label="经验要求"
                  value={experienceReq}
                  onChange={(e) => setExperienceReq(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                >
                  {EXPERIENCE_OPTIONS.map((exp) => (
                    <option key={exp} value={exp}>
                      {exp === '全部' ? '经验不限（全部）' : exp}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索公司名、招聘公众号、岗位或技能（如：Java、财务审计、临床研究、大客户销售、新能源）..."
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
                  <span>仅看支持内推</span>
                </label>
              </div>
            </div>

            {/* 16 Occupational Category Quick Pills */}
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-medium text-slate-500">全行业职能分类（16 大品类）：</div>
              <div className="flex flex-wrap gap-1.5">
                {JOB_CATEGORY_OPTIONS.map((cat) => {
                  const active = category === cat;
                  const count = cat === '全部' ? null : categoryCountMap[cat] ?? 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      <span>{cat}</span>
                      {count !== null && (
                        <span className={`tabular-nums text-[10px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Anti-Trap Candidate Tip */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-2.5 text-xs text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>官网防坑与公众号核验提示：</strong>
              无论校招、社招还是实习，所有标注绿色「官网认证」的链接均直指企业官方网申主域名；如看到微信公众号推送的招聘信息，可将正文复制到「信息更新中心」智能提取岗位，但最终务必通过企业官方域名网申投递。
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
                              {job.company_entity_tag && (
                                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  {job.company_entity_tag}
                                </span>
                              )}
                            </div>
                            <h3 className="mt-1 text-base font-bold text-slate-900">{job.title}</h3>
                            {job.company_legal_name && (
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span className="truncate">工商主体：{job.company_legal_name}</span>
                                <a
                                  href={`https://www.tianyancha.com/search?key=${encodeURIComponent(job.company_legal_name)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex shrink-0 items-center gap-0.5 text-amber-700 hover:text-amber-800 hover:underline"
                                >
                                  天眼查核验 <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            )}
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
                        <span
                          className={`rounded-md border px-2 py-0.5 font-semibold ${
                            job.recruit_type === '社会招聘'
                              ? 'border-violet-200 bg-violet-50 text-violet-700'
                              : job.recruit_type === '实习兼职'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-blue-200 bg-blue-50 text-blue-700'
                          }`}
                        >
                          {job.recruit_type || '校园招聘'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                          <MapPin className="h-3 w-3" />
                          {job.city}
                          {job.province && job.province !== job.city ? ` · ${job.province}` : ''}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{job.category}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                          {job.experience_req || '应届毕业生'}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{job.season_tag}</span>
                        {job.recruit_type !== '社会招聘' &&
                          !(job.graduation_years || []).includes('社招不限') &&
                          (job.graduation_years || []).length > 0 && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                              面向 {job.graduation_years.join('/')} 届
                            </span>
                          )}
                        {job.company_wechat_account && (
                          <button
                            type="button"
                            onClick={() => handleCopyWechat(job.id, job.company_wechat_account)}
                            title="点击复制官方招聘公众号名称，可在微信搜一搜查看推文"
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            {copiedWechatId === job.id ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <MessageSquareText className="h-3 w-3" />
                            )}
                            公众号：{job.company_wechat_account}
                          </button>
                        )}
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
                          {job.recruit_type === '社会招聘' ? '直达社招官网' : '直达官网'}{' '}
                          <ExternalLink className="h-3 w-3" />
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
                共收录 <strong>{companies.length}</strong> 家正规企业官方校招入口（含大厂、高成长初创/融资企业、专精特新及央国企，当前筛选{' '}
                <strong>{filteredCompanies.length}</strong> 家），每家均附带工商注册主体与天眼查核验直链。
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加初创/正规企业
                </button>
                <button
                  type="button"
                  onClick={handleBatchVerify}
                  disabled={batchVerifying}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${batchVerifying ? 'animate-spin' : ''}`} />
                  {batchVerifying ? '批量核验官网状态中...' : '实时批量核验官网'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="筛选企业名称、微信公众号（如：腾讯招聘）、工商全称、行业或城市..."
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
              const atsSupport = getCompanyAtsSupport(c);
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
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {atsSupport?.autoSyncable && (
                          <span
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                            title={`已对接 ${atsSupport.label} 公开明文接口，支持自动追新`}
                          >
                            可自动追新 · {atsSupport.label}
                          </span>
                        )}
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate font-mono text-[11px]">{c.official_campus_url}</span>
                    </div>

                    {c.wechat_account && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] text-emerald-900">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span className="truncate">官方招聘公众号：{c.wechat_account}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyWechat(c.id, c.wechat_account)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          {copiedWechatId === c.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedWechatId === c.id ? '已复制' : '复制'}
                        </button>
                      </div>
                    )}

                    {(c.legal_name || c.entity_tag) && (
                      <div className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/60 px-2.5 py-1.5 text-[11px] text-amber-950">
                        {c.legal_name && (
                          <div className="flex items-center gap-1 font-medium">
                            <ShieldCheck className="h-3 w-3 shrink-0 text-amber-700" />
                            <span className="truncate">工商主体：{c.legal_name}</span>
                          </div>
                        )}
                        {c.entity_tag && <div className="mt-0.5 text-[10px] text-amber-800">{c.entity_tag}</div>}
                      </div>
                    )}

                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{c.notes}</p>
                    {c.last_verify_message && (
                      <p className="mt-1.5 text-[11px] text-slate-500">最近核验：{c.last_verify_message}</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">在招关联 {c.open_job_count} 个岗位</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={getTianyanchaSearchUrl(c.legal_name || c.name)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        天眼查 <ExternalLink className="h-3 w-3" />
                      </a>
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
                      {atsSupport?.autoSyncable && (
                        <button
                          type="button"
                          disabled={subscribingCompanyId === c.id}
                          onClick={() => handleSubscribeCompany(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          title={`一键订阅 ${c.short_name}（${atsSupport.label}）自动追新`}
                        >
                          <RefreshCw className={`h-3 w-3 ${subscribingCompanyId === c.id ? 'animate-spin' : ''}`} />
                          {subscribingCompanyId === c.id ? '追新中...' : '订阅追新'}
                        </button>
                      )}
                      {c.official_social_url && c.official_social_url !== c.official_campus_url && (
                        <a
                          href={c.official_social_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                        >
                          社招官网 <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <a
                        href={c.official_campus_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        {c.official_social_url ? '校招官网' : '进入官网'} <ExternalLink className="h-3 w-3" />
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">收录企业官网直招岗位（校招 / 社招 / 实习）</h3>
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
                  <label className="mb-1 block text-xs font-medium text-slate-700">企业名称 *</label>
                  <input
                    required
                    value={newJob.companyName}
                    onChange={(e) => setNewJob({ ...newJob, companyName: e.target.value })}
                    placeholder="如：面壁智能 / 海康威视"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">岗位名称 *</label>
                  <input
                    required
                    value={newJob.title}
                    onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                    placeholder="如：大模型推理研发工程师"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">企业类型</label>
                  <select
                    value={newJob.companyType}
                    onChange={(e) => setNewJob({ ...newJob, companyType: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="优质企业">优质企业</option>
                    {COMPANY_TYPE_OPTIONS.filter((t) => t !== '全部').map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">融资/主体资质标签（可选）</label>
                  <input
                    value={newJob.entityTag}
                    onChange={(e) => setNewJob({ ...newJob, entityTag: e.target.value })}
                    placeholder="如：初创/融资企业 · A轮融资"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">工商主体全称（天眼查核对）</label>
                  <a
                    href={getTianyanchaSearchUrl(newJob.legalName || newJob.companyName)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800 hover:underline"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    去天眼查核对主体 ↗
                  </a>
                </div>
                <input
                  value={newJob.legalName}
                  onChange={(e) => setNewJob({ ...newJob, legalName: e.target.value })}
                  placeholder="如：北京面壁智能科技有限责任公司（若企业壁未收录将自动建档）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  官网或专属 ATS 校招链接（支持飞书 / Moka / 北森租户隔离）*
                </label>
                <input
                  required
                  type="url"
                  value={newJob.officialUrl}
                  onChange={(e) => setNewJob({ ...newJob, officialUrl: e.target.value })}
                  placeholder="https://xxx.jobs.feishu.cn/... 或 https://app.mokahr.com/campus-recruitment/..."
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
                    placeholder="北京"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">省份</label>
                  <input
                    value={newJob.province}
                    onChange={(e) => setNewJob({ ...newJob, province: e.target.value })}
                    placeholder="北京"
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
                  <label className="mb-1 block text-xs font-medium text-slate-700">招聘通道 *</label>
                  <select
                    value={newJob.recruitType}
                    onChange={(e) => {
                      const nextRt = e.target.value;
                      setNewJob({
                        ...newJob,
                        recruitType: nextRt,
                        experienceReq:
                          nextRt === '社会招聘' ? '1-3年' : nextRt === '实习兼职' ? '在校实习生' : '应届毕业生',
                        seasonTag:
                          nextRt === '社会招聘'
                            ? '2026-2027社招急聘'
                            : nextRt === '实习兼职'
                              ? '日常实习'
                              : '2027届秋招补录',
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {RECRUIT_TYPE_OPTIONS.filter((x) => x !== '全部').map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">经验要求</label>
                  <select
                    value={newJob.experienceReq}
                    onChange={(e) => setNewJob({ ...newJob, experienceReq: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {EXPERIENCE_OPTIONS.filter((x) => x !== '全部').map((exp) => (
                      <option key={exp} value={exp}>
                        {exp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">招聘季 / 批次</label>
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
                  <label className="mb-1 block text-xs font-medium text-slate-700">参考薪资（选填）</label>
                  <input
                    value={newJob.salaryRange}
                    onChange={(e) => setNewJob({ ...newJob, salaryRange: e.target.value })}
                    placeholder="如：25-45K / 面议"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">投递截止日期</label>
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

      {/* Custom Startup / Enterprise Modal */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="text-base font-semibold text-slate-900">添加初创 / 正规企业官方入口</h3>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3.5 p-5">
              <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-violet-900">
                支持添加尚未在库中的高成长初创团队与垂直名企！若使用 <strong>飞书 (jobs.feishu.cn)</strong>、
                <strong>Moka (app.mokahr.com)</strong>、<strong>北森 (zhiye.com)</strong>、<strong>红海/Hotjob</strong> 等第三方招聘门户，系统会自动按租户子域与路径独立建档，不再与已有企业串台。
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">企业常用名称 *</label>
                  <input
                    required
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    placeholder="如：智算初创科技 / 星尘AI"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">简称（徽标显示，可选）</label>
                  <input
                    value={newCompany.shortName}
                    onChange={(e) => setNewCompany({ ...newCompany, shortName: e.target.value })}
                    placeholder="留空默认取名称前 6 字"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">企业分类</label>
                  <select
                    value={newCompany.companyType}
                    onChange={(e) => setNewCompany({ ...newCompany, companyType: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  >
                    {COMPANY_TYPE_OPTIONS.filter((t) => t !== '全部').map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">所在行业</label>
                  <input
                    value={newCompany.industry}
                    onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                    placeholder="人工智能 / 具身机器人"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">总部城市</label>
                  <input
                    value={newCompany.hqCity}
                    onChange={(e) => setNewCompany({ ...newCompany, hqCity: e.target.value })}
                    placeholder="北京 / 上海 / 深圳"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">工商注册主体全称（建议天眼查核对）</label>
                  <a
                    href={getTianyanchaSearchUrl(newCompany.legalName || newCompany.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800 hover:underline"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    去天眼查核对主体 ↗
                  </a>
                </div>
                <input
                  value={newCompany.legalName}
                  onChange={(e) => setNewCompany({ ...newCompany, legalName: e.target.value })}
                  placeholder="如：北京某某人工智能科技有限公司（留空亦可保存，建议核实统一信用主体）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">融资阶段 / 资质标签</label>
                <input
                  value={newCompany.entityTag}
                  onChange={(e) => setNewCompany({ ...newCompany, entityTag: e.target.value })}
                  placeholder="如：初创/融资企业 · A轮融资"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {STARTUP_ENTITY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewCompany({ ...newCompany, entityTag: preset })}
                      className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                        newCompany.entityTag === preset
                          ? 'border-violet-300 bg-violet-50 font-medium text-violet-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.replace('初创/融资企业 · ', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">校招 / 主招聘官网链接 *</label>
                  <input
                    required
                    type="url"
                    value={newCompany.officialUrl}
                    onChange={(e) => setNewCompany({ ...newCompany, officialUrl: e.target.value })}
                    placeholder="https://xxx.jobs.feishu.cn/ 或 https://careers.example.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">社招官网链接（可选）</label>
                  <input
                    type="url"
                    value={newCompany.officialSocialUrl}
                    onChange={(e) => setNewCompany({ ...newCompany, officialSocialUrl: e.target.value })}
                    placeholder="https://zhaopin.example.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">企业官方招聘微信公众号（可选）</label>
                <input
                  value={newCompany.wechatAccount}
                  onChange={(e) => setNewCompany({ ...newCompany, wechatAccount: e.target.value })}
                  placeholder="如：某某科技招聘（可在企业墙一键复制并检索公众号推送岗位）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">企业简介 / 备忘说明</label>
                <input
                  value={newCompany.notes}
                  onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                  placeholder="记录主打产品、融资背景、内推或面试风格备注..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={newCompany.addInitialJob}
                    onChange={(e) => setNewCompany({ ...newCompany, addInitialJob: e.target.checked })}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  同时收录该公司一个在招/内推岗位（可选）
                </label>

                {newCompany.addInitialJob && (
                  <div className="mt-3 space-y-2.5 border-t border-slate-200 pt-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">岗位名称 *</label>
                        <input
                          required
                          value={newCompany.jobTitle}
                          onChange={(e) => setNewCompany({ ...newCompany, jobTitle: e.target.value })}
                          placeholder="如：AI Agent 全栈工程师"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">工作城市</label>
                        <input
                          value={newCompany.city}
                          onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                          placeholder="北京"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">招聘通道</label>
                        <select
                          value={newCompany.recruitType}
                          onChange={(e) =>
                            setNewCompany({
                              ...newCompany,
                              recruitType: e.target.value,
                              experienceReq:
                                e.target.value === '社会招聘'
                                  ? '1-3年'
                                  : e.target.value === '实习兼职'
                                    ? '在校实习生'
                                    : '应届毕业生',
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        >
                          {RECRUIT_TYPE_OPTIONS.filter((r) => r !== '全部').map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">岗位类别</label>
                        <select
                          value={newCompany.category}
                          onChange={(e) => setNewCompany({ ...newCompany, category: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        >
                          {JOB_CATEGORY_OPTIONS.filter((c) => c !== '全部').map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">经验要求</label>
                        <select
                          value={newCompany.experienceReq}
                          onChange={(e) => setNewCompany({ ...newCompany, experienceReq: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        >
                          {EXPERIENCE_OPTIONS.filter((x) => x !== '全部').map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">招聘季</label>
                        <select
                          value={newCompany.seasonTag}
                          onChange={(e) => setNewCompany({ ...newCompany, seasonTag: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        >
                          {SEASON_OPTIONS.filter((s) => s !== '全部').map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">截止时间</label>
                        <input
                          value={newCompany.deadline}
                          onChange={(e) => setNewCompany({ ...newCompany, deadline: e.target.value })}
                          placeholder="招满即止"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {creatingCompany ? '保存中...' : '校验并加入企业墙'}
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
