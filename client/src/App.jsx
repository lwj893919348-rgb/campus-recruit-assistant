import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, LayoutDashboard, Search, FileText, KanbanSquare, Download, Upload, HardDrive } from 'lucide-react';
import { api } from './api/client.js';
import { ToastList } from './components/Toast.jsx';
import { QuickTrackModal } from './components/QuickTrackModal.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { JobSearchPage } from './pages/JobSearchPage.jsx';
import { ResumeBuilderPage } from './pages/ResumeBuilderPage.jsx';
import { ApplicationsPage } from './pages/ApplicationsPage.jsx';

const TABS = [
  { id: 'dashboard', label: '全景概览', icon: LayoutDashboard },
  { id: 'jobs', label: '全行业官方直聘', icon: Search },
  { id: 'resume', label: 'A4 简历工坊', icon: FileText },
  { id: 'applications', label: '投递进度管理', icon: KanbanSquare },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resumes, setResumes] = useState([]);
  const [activeResumeIdFromNav, setActiveResumeIdFromNav] = useState('');
  const [initialCityFilter, setInitialCityFilter] = useState('');

  const [trackModalJob, setTrackModalJob] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [backupGen, setBackupGen] = useState(0);
  const [toasts, setToasts] = useState([]);
  const backupInputRef = useRef(null);

  const addToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    api
      .getResumes()
      .then((res) => setResumes(res.resumes || []))
      .catch(() => {});
  }, []);

  const handleFilterCity = useCallback((city) => {
    setInitialCityFilter(city);
    setActiveTab('jobs');
  }, []);

  const handleOpenResume = useCallback((resumeId) => {
    if (resumeId) setActiveResumeIdFromNav(resumeId);
    setActiveTab('resume');
  }, []);

  const handleTrackSubmit = useCallback(
    async (payload) => {
      try {
        await api.createApplication(payload);
        addToast('success', `已将「${payload.company_name} · ${payload.job_title}」记入投递看板`);
        setRefreshSignal((s) => s + 1);
      } catch (err) {
        addToast('error', err.message);
        throw err;
      }
    },
    [addToast],
  );

  const handleExportBackup = useCallback(async () => {
    try {
      const info = await api.exportPersonalBackup();
      addToast('success', `已导出个人备份（${info.resumesCount} 份简历、${info.applicationsCount} 条投递）`);
    } catch (err) {
      addToast('error', `导出备份失败：${err.message}`);
    }
  }, [addToast]);

  const handleRestoreBackup = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const res = await api.importPersonalBackup(text);
        const resumed = await api.getResumes();
        setResumes(resumed.resumes || []);
        setBackupGen((g) => g + 1);
        setRefreshSignal((s) => s + 1);
        addToast('success', `备份恢复成功：共恢复 ${res.resumesCount} 份简历与 ${res.applicationsCount} 条投递记录`);
      } catch (err) {
        addToast('error', err.message);
      }
    },
    [addToast],
  );

  return (
    <div className="min-h-screen text-[#132A2E]">
      {/* Top Navigation */}
      <header className="no-print sticky top-0 z-40 border-b border-teal-900/[0.07] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_6px_14px_-4px_rgba(13,148,136,0.45)]">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold tracking-tight text-[#132A2E]">职航 · 全景官方直聘助手</div>
              <div className="text-[11px] text-slate-500">校招 / 社招 / 实习全品类 · 公众号公告解析 · 简历工坊</div>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-teal-900/[0.07] bg-teal-50/55 p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? 'bg-white text-teal-700 shadow-[0_2px_8px_-2px_rgba(13,148,136,0.18)]'
                        : 'text-slate-600 hover:bg-white/65 hover:text-teal-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {api.isStaticMode && (
              <div className="flex items-center gap-1 rounded-2xl border border-teal-200/80 bg-teal-50/65 px-2.5 py-1 text-[11px] text-teal-900">
                <HardDrive className="h-3.5 w-3.5 text-teal-600" />
                <span className="hidden font-medium lg:inline">浏览器本地隐私存储</span>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  title="导出个人简历与投递记录 JSON 备份"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 font-medium text-slate-700 shadow-2xs hover:bg-white"
                >
                  <Download className="h-3 w-3" />
                  备份
                </button>
                <button
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                  title="从 JSON 备份恢复数据"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 font-medium text-slate-700 shadow-2xs hover:bg-white"
                >
                  <Upload className="h-3 w-3" />
                  恢复
                </button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main key={backupGen} className="print-reset mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'dashboard' && (
          <DashboardPage
            onNavigate={setActiveTab}
            onFilterCity={handleFilterCity}
            onOpenResume={handleOpenResume}
            onQuickTrack={(job) => setTrackModalJob(job)}
          />
        )}

        {activeTab === 'jobs' && (
          <JobSearchPage
            initialCity={initialCityFilter}
            onClearInitialCity={() => setInitialCityFilter('')}
            onQuickTrack={(job) => setTrackModalJob(job)}
            onToast={addToast}
            refreshSignal={refreshSignal}
          />
        )}

        {activeTab === 'resume' && (
          <ResumeBuilderPage
            activeResumeIdFromNav={activeResumeIdFromNav}
            onToast={addToast}
            onResumesChanged={setResumes}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsPage
            resumes={resumes}
            onOpenResume={handleOpenResume}
            onToast={addToast}
            refreshSignal={refreshSignal}
          />
        )}
      </main>

      <QuickTrackModal
        open={Boolean(trackModalJob)}
        job={trackModalJob}
        resumes={resumes}
        onClose={() => setTrackModalJob(null)}
        onSubmit={handleTrackSubmit}
      />

      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
