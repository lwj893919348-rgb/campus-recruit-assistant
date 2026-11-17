import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Printer,
  Save,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Download,
  Upload,
  Star,
  AlertTriangle,
  CheckCircle2,
  LayoutTemplate,
  Undo2,
} from 'lucide-react';
import { api } from '../api/client.js';
import { ResumeSheet } from '../components/ResumeSheet.jsx';
import { SectionOrderControl } from '../components/SectionOrderControl.jsx';
import {
  RESUME_TEMPLATES,
  RESUME_THEME_COLORS,
  RESUME_SECTION_LABELS,
  STAR_ACTION_VERBS,
  STAR_EXAMPLE_SNIPPETS,
} from '../data/constants.js';

const A4_HEIGHT_PX = 1122.5; // 297mm at 96dpi
const AUTO_SAVE_DELAY_MS = 1500;
const MAX_UNDO_STEPS = 20;

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ResumeBuilderPage = memo(function ResumeBuilderPage({
  activeResumeIdFromNav,
  onToast,
  onResumesChanged,
  onDataMutated,
  isActive = true,
}) {
  const [resumes, setResumes] = useState([]);
  const [currentId, setCurrentId] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState('saved'); // 'saved' | 'dirty' | 'saving' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [undoStack, setUndoStack] = useState([]);

  const [openEditorSection, setOpenEditorSection] = useState('basic');
  const [zoom, setZoom] = useState(0.72);
  const [sheetHeightPx, setSheetHeightPx] = useState(960);

  const hasLoadedRef = useRef(false);
  const sheetRef = useRef(null);
  const fileInputRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const editSeqRef = useRef(0);
  const lastUndoGroupRef = useRef(0);

  const fetchResumes = useCallback(
    async (preferId) => {
      if (!hasLoadedRef.current) setLoading(true);
      try {
        const data = await api.getResumes();
        setResumes(data.resumes);
        onResumesChanged?.(data.resumes);
        const chosen =
          data.resumes.find((r) => r.id === (preferId || activeResumeIdFromNav || currentId)) ||
          data.resumes.find((r) => r.is_default) ||
          data.resumes[0];
        if (chosen) {
          setCurrentId(chosen.id);
          setDraft(structuredClone(chosen));
          setDirty(false);
          setAutoSaveState('saved');
          setUndoStack([]);
          lastUndoGroupRef.current = 0;
        }
        hasLoadedRef.current = true;
      } catch (err) {
        onToast('error', err.message);
      } finally {
        setLoading(false);
      }
    },
    [activeResumeIdFromNav, currentId, onResumesChanged, onToast],
  );

  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchResumes(activeResumeIdFromNav);
      return;
    }
    if (activeResumeIdFromNav && activeResumeIdFromNav !== currentId) {
      const target = resumes.find((r) => r.id === activeResumeIdFromNav);
      if (target) {
        setCurrentId(target.id);
        setDraft(structuredClone(target));
        setDirty(false);
        setAutoSaveState('saved');
        setUndoStack([]);
        lastUndoGroupRef.current = 0;
      } else {
        fetchResumes(activeResumeIdFromNav);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResumeIdFromNav]);

  // Measure real rendered A4 height to detect single-page overflow
  useEffect(() => {
    if (!isActive) return undefined;
    const el = sheetRef.current;
    if (!el) return undefined;
    const measure = () => {
      const measured = el.scrollHeight || el.offsetHeight;
      if (measured > 0) setSheetHeightPx(measured);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [draft, isActive]);

  function updateDraft(updater) {
    editSeqRef.current += 1;
    setDraft((prev) => {
      if (!prev) return prev;
      const nowMs = Date.now();
      if (nowMs - lastUndoGroupRef.current > 600) {
        const snapshot = structuredClone(prev);
        setUndoStack((stack) => [...stack.slice(-(MAX_UNDO_STEPS - 1)), snapshot]);
      }
      lastUndoGroupRef.current = nowMs;
      return typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
    });
    setDirty(true);
    setAutoSaveState('dirty');
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    lastUndoGroupRef.current = 0;
    editSeqRef.current += 1;
    setDraft(prevSnapshot);
    setDirty(true);
    setAutoSaveState('dirty');
  }

  function updateContent(field, value) {
    updateDraft((prev) => ({
      ...prev,
      content_json: {
        ...prev.content_json,
        [field]: value,
      },
    }));
  }

  function updateBasic(key, val) {
    updateDraft((prev) => ({
      ...prev,
      content_json: {
        ...prev.content_json,
        basic: {
          ...(prev.content_json?.basic || {}),
          [key]: val,
        },
      },
    }));
  }

  const handleSave = useCallback(
    async (showSuccessToast = true) => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;
      const savedSeq = editSeqRef.current;
      setSaving(true);
      setAutoSaveState('saving');
      try {
        const { resume } = await api.updateResume(currentDraft.id, {
          title: currentDraft.title,
          template_id: currentDraft.template_id,
          theme_color: currentDraft.theme_color,
          font_scale: currentDraft.font_scale,
          margin_preset: currentDraft.margin_preset,
          section_order: currentDraft.section_order,
          hidden_sections: currentDraft.hidden_sections,
          content_json: currentDraft.content_json,
          is_default: currentDraft.is_default,
        });
        setResumes((prev) => {
          const nextList = prev.map((r) => (r.id === resume.id ? resume : r));
          onResumesChanged?.(nextList);
          return nextList;
        });
        if (editSeqRef.current === savedSeq) {
          setDirty(false);
          setAutoSaveState('saved');
          setLastSavedAt(
            new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
          );
        }
        onDataMutated?.();
        if (showSuccessToast) onToast('success', `简历「${resume.title}」已保存`);
      } catch (err) {
        setAutoSaveState('error');
        if (showSuccessToast) onToast('error', err.message);
      } finally {
        setSaving(false);
      }
    },
    [onResumesChanged, onDataMutated, onToast],
  );

  // Debounced auto-save after edits pause for 1.5s
  useEffect(() => {
    if (!dirty || !draft) return undefined;
    const timer = setTimeout(() => {
      handleSave(false);
    }, AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, draft, handleSave]);

  // Guard against accidental tab close / refresh while edits remain unsaved
  useEffect(() => {
    if (!dirty && !saving) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saving]);

  // Support Ctrl/Cmd + S quick save while Resume Builder is active
  useEffect(() => {
    if (!isActive || !draft) return undefined;
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, draft, handleSave]);

  async function handleSelectResume(id) {
    if (dirty && draft) {
      await handleSave(false);
    }
    const target = resumes.find((r) => r.id === id);
    if (target) {
      setCurrentId(id);
      setDraft(structuredClone(target));
      setDirty(false);
      setAutoSaveState('saved');
      setUndoStack([]);
      lastUndoGroupRef.current = 0;
    }
  }

  async function handleCreateBlank() {
    if (dirty && draft) await handleSave(false);
    const title = window.prompt('请输入新简历版本名称（例如：2027秋招-产品经理版）', '我的校招简历');
    if (!title) return;
    try {
      const { resume } = await api.createResume({
        title,
        template_id: draft?.template_id || 'tech-minimal',
        theme_color: draft?.theme_color || '#2563EB',
        font_scale: draft?.font_scale || 'standard',
        margin_preset: draft?.margin_preset || 'standard',
      });
      onToast('success', `已创建新简历「${resume.title}」`);
      await fetchResumes(resume.id);
      onDataMutated?.();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleDuplicate() {
    if (!draft) return;
    if (dirty) await handleSave(false);
    const title = window.prompt('输入衍生新版本的名称', `${draft.title}（定制版）`);
    if (!title) return;
    try {
      const { resume } = await api.duplicateResume(draft.id, title);
      onToast('success', `已派生版本「${resume.title}」`);
      await fetchResumes(resume.id);
      onDataMutated?.();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleSetDefault() {
    if (!draft) return;
    try {
      const { resume } = await api.updateResume(draft.id, { ...draft, is_default: true });
      setDraft(structuredClone(resume));
      setDirty(false);
      await fetchResumes(resume.id);
      onDataMutated?.();
      onToast('success', '已设为投递默认关联简历');
    } catch (err) {
      onToast('error', err.message);
    }
  }

  async function handleDelete() {
    if (!draft) return;
    if (!window.confirm(`确定要删除简历「${draft.title}」吗？此操作不可撤销。`)) return;
    try {
      await api.deleteResume(draft.id);
      onToast('info', '已删除该简历版本');
      await fetchResumes('');
      onDataMutated?.();
    } catch (err) {
      onToast('error', err.message);
    }
  }

  function handleExportJson() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.title || 'resume'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { resume } = await api.createResume({
        title: parsed.title ? `${parsed.title}（导入）` : '导入的校招简历',
        template_id: parsed.template_id || 'tech-minimal',
        theme_color: parsed.theme_color || '#2563EB',
        font_scale: parsed.font_scale || 'standard',
        margin_preset: parsed.margin_preset || 'standard',
        section_order: parsed.section_order,
        hidden_sections: parsed.hidden_sections,
        content_json: parsed.content_json,
      });
      onToast('success', `已导入简历「${resume.title}」`);
      await fetchResumes(resume.id);
    } catch {
      onToast('error', 'JSON 简历文件格式无法解析，请检查文件完整性。');
    } finally {
      e.target.value = '';
    }
  }

  async function handlePrintPdf() {
    if (dirty && draft) {
      await handleSave(false);
    }
    window.print();
  }

  function handleSectionReorder(nextOrder) {
    updateDraft({ section_order: nextOrder });
  }

  function toggleSectionHidden(key) {
    const hidden = draft.hidden_sections || [];
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    updateDraft({ hidden_sections: next });
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      onToast('error', '证件照图片建议小于 500KB，以免影响简历导出体积。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateBasic('avatar', String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  if (loading || !draft) {
    return <div className="h-[72vh] animate-pulse rounded-3xl bg-teal-900/[0.06]" />;
  }

  const content = draft.content_json || {};
  const basic = content.basic || {};
  const pageFillPct = Math.round((sheetHeightPx / A4_HEIGHT_PX) * 100);
  const isOverflow = pageFillPct > 102;

  return (
    <div className="print-reset space-y-4">
      {/* Top Toolbar */}
      <div className="no-print fresh-card flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <select
            value={draft.id}
            onChange={(e) => handleSelectResume(e.target.value)}
            className="fresh-input max-w-[240px] rounded-xl px-2.5 py-1.5 text-sm font-semibold text-[#132A2E]"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.is_default ? '★ ' : ''}
                {r.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateBlank}
            className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> 新建
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium"
            title="复制当前简历，针对不同公司微调岗位关键词"
          >
            <Copy className="h-3.5 w-3.5" /> 派生版本
          </button>
          {!draft.is_default && (
            <button
              type="button"
              onClick={handleSetDefault}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              <Star className="h-3.5 w-3.5" /> 设为默认
            </button>
          )}
          <button
            type="button"
            onClick={handleExportJson}
            className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium"
            title="导出 JSON 备份"
          >
            <Download className="h-3.5 w-3.5" /> 备份
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium"
          >
            <Upload className="h-3.5 w-3.5" /> 导入
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="resume-autosave-status" className="text-xs text-slate-500 tabular-nums">
            {autoSaveState === 'saving'
              ? '自动保存中...'
              : autoSaveState === 'dirty'
                ? '未保存（稍后自动保存）'
                : autoSaveState === 'error'
                  ? '自动保存失败，请手动重试'
                  : lastSavedAt
                    ? `已于 ${lastSavedAt} 自动保存`
                    : '已同步本地库'}
          </span>
          <button
            type="button"
            data-testid="resume-undo-btn"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title={undoStack.length > 0 ? `撤销上一步修改（剩余 ${undoStack.length} 步）` : '暂无可撤销操作'}
            className="fresh-btn-secondary inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            撤销
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            title="立即保存（快捷键 Ctrl+S / Cmd+S）"
            className="fresh-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5 text-blue-600" />
            {saving ? '保存中...' : '保存简历'}
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="fresh-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold"
          >
            <Printer className="h-3.5 w-3.5" />
            导出高清 A4 PDF
          </button>
        </div>
      </div>

      {/* Main Split Editor + A4 Preview */}
      <div className="print-reset grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left Editor Panel */}
        <div className="no-print space-y-3 xl:col-span-5">
          {/* Resume Version Title & Template Picker */}
          <section className="fresh-card rounded-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <LayoutTemplate className="h-4 w-4 text-blue-600" />
                <span>模板与排版样式</span>
              </div>
              <span className="text-[11px] text-slate-400">无缝切换 · 内容无损复用</span>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">当前简历版本名称</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                className="fresh-input w-full rounded-xl px-3 py-1.5 text-sm font-medium text-[#132A2E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {RESUME_TEMPLATES.map((tpl) => {
                const selected = draft.template_id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => updateDraft({ template_id: tpl.id })}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      selected
                        ? 'border-teal-600 bg-teal-50/75 ring-1 ring-teal-600/50 shadow-xs'
                        : 'border-teal-900/10 bg-white/85 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-teal-700 ring-1 ring-teal-200/70">
                        {tpl.badge}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{tpl.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Theme color + Scale + Margin */}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              <div>
                <div className="mb-1 text-[11px] font-medium text-slate-500">主色调</div>
                <div className="flex items-center gap-1.5">
                  {RESUME_THEME_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      onClick={() => updateDraft({ theme_color: c.value })}
                      className={`h-5 w-5 rounded-full border-2 transition ${
                        draft.theme_color === c.value ? 'scale-110 border-slate-900' : 'border-white shadow-xs'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium text-slate-500">字号密度</div>
                <select
                  value={draft.font_scale}
                  onChange={(e) => updateDraft({ font_scale: e.target.value })}
                  className="fresh-input w-full rounded-xl px-2 py-1 text-xs"
                >
                  <option value="compact">紧凑 (装更多)</option>
                  <option value="standard">标准</option>
                  <option value="relaxed">舒展</option>
                </select>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium text-slate-500">页边距</div>
                <select
                  value={draft.margin_preset}
                  onChange={(e) => updateDraft({ margin_preset: e.target.value })}
                  className="fresh-input w-full rounded-xl px-2 py-1 text-xs"
                >
                  <option value="compact">窄边距</option>
                  <option value="standard">标准边距</option>
                  <option value="relaxed">宽边距</option>
                </select>
              </div>
            </div>

            {/* Section Order & Visibility */}
            <SectionOrderControl
              sectionOrder={draft.section_order || []}
              hiddenSections={draft.hidden_sections || []}
              sectionLabels={RESUME_SECTION_LABELS}
              onReorder={handleSectionReorder}
              onToggleHidden={toggleSectionHidden}
            />
          </section>

          {/* Accordion Editors */}
          <div className="space-y-2.5">
            {/* 1. Basic Info */}
            <AccordionPanel
              title="个人信息与求职意向"
              isOpen={openEditorSection === 'basic'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'basic' ? '' : 'basic')}
            >
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <InputField label="姓名" placeholder="请输入你的姓名" value={basic.name} onChange={(v) => updateBasic('name', v)} />
                <InputField label="求职意向" placeholder="如：后端开发工程师（2027届）" value={basic.targetRole} onChange={(v) => updateBasic('targetRole', v)} />
                <InputField label="联系电话" placeholder="如：138-xxxx-xxxx" value={basic.phone} onChange={(v) => updateBasic('phone', v)} />
                <InputField label="电子邮箱" placeholder="如：name@example.edu.cn" value={basic.email} onChange={(v) => updateBasic('email', v)} />
                <InputField label="期望城市" placeholder="如：杭州 / 上海 / 北京" value={basic.city} onChange={(v) => updateBasic('city', v)} />
                <InputField label="毕业时间" placeholder="如：2027年6月" value={basic.gradDate} onChange={(v) => updateBasic('gradDate', v)} />
                <InputField label="英语水平" placeholder="如：CET-6 / IELTS 6.5" value={basic.englishLevel} onChange={(v) => updateBasic('englishLevel', v)} />
                <InputField label="GitHub / 作品集" placeholder="选填，如：github.com/username" value={basic.github} onChange={(v) => updateBasic('github', v)} />
                <InputField label="政治面貌（国企可用）" placeholder="如：共青团员 / 中共党员" value={basic.politicalStatus} onChange={(v) => updateBasic('politicalStatus', v)} />
                <InputField label="籍贯生源（国企可用）" placeholder="如：浙江杭州" value={basic.hometown} onChange={(v) => updateBasic('hometown', v)} />
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2.5 text-xs">
                <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
                  上传证件照 (≤500KB)
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
                {basic.avatar && (
                  <button
                    type="button"
                    onClick={() => updateBasic('avatar', '')}
                    className="text-rose-600 hover:underline"
                  >
                    清除照片
                  </button>
                )}
              </div>
            </AccordionPanel>

            {/* 2. Education */}
            <AccordionPanel
              title={`教育背景 (${(content.education || []).length})`}
              isOpen={openEditorSection === 'education'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'education' ? '' : 'education')}
            >
              <div className="space-y-3">
                {(content.education || []).map((edu, idx) => (
                  <div key={edu.id} className="fresh-subcard rounded-2xl p-3 text-xs">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">学历 #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateContent(
                            'education',
                            content.education.filter((i) => i.id !== edu.id),
                          )
                        }
                        className="text-rose-600 hover:underline"
                      >
                        删除
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <InputField
                        label="学校名称"
                        placeholder="请填写高校全称"
                        value={edu.school}
                        onChange={(v) =>
                          updateContent(
                            'education',
                            content.education.map((i) => (i.id === edu.id ? { ...i, school: v } : i)),
                          )
                        }
                      />
                      <InputField
                        label="学历层次"
                        placeholder="如：本科 / 硕士"
                        value={edu.degree}
                        onChange={(v) =>
                          updateContent(
                            'education',
                            content.education.map((i) => (i.id === edu.id ? { ...i, degree: v } : i)),
                          )
                        }
                      />
                      <InputField
                        label="专业名称"
                        placeholder="如：计算机科学与技术"
                        value={edu.major}
                        onChange={(v) =>
                          updateContent(
                            'education',
                            content.education.map((i) => (i.id === edu.id ? { ...i, major: v } : i)),
                          )
                        }
                      />
                      <InputField
                        label="起止时间"
                        placeholder="如：2023.09 - 2027.06"
                        value={edu.period}
                        onChange={(v) =>
                          updateContent(
                            'education',
                            content.education.map((i) => (i.id === edu.id ? { ...i, period: v } : i)),
                          )
                        }
                      />
                      <div className="col-span-2">
                        <InputField
                          label="GPA / 专业排名"
                          placeholder="选填，如：GPA 3.7/4.0（专业前 10%）"
                          value={edu.gpa}
                          onChange={(v) =>
                            updateContent(
                              'education',
                              content.education.map((i) => (i.id === edu.id ? { ...i, gpa: v } : i)),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <InputField
                          label="主修核心课程"
                          placeholder="选填，如：数据结构、操作系统、计算机网络"
                          value={edu.courses}
                          onChange={(v) =>
                            updateContent(
                              'education',
                              content.education.map((i) => (i.id === edu.id ? { ...i, courses: v } : i)),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateContent('education', [
                      ...(content.education || []),
                      {
                        id: makeId('edu'),
                        school: '',
                        degree: '',
                        major: '',
                        period: '',
                        gpa: '',
                        courses: '',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-teal-300/90 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-50/70"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加一段教育经历
                </button>
              </div>
            </AccordionPanel>

            {/* 3. Work & Internship */}
            <AccordionPanel
              title={`工作与实习经历 (${(content.internship || []).length})`}
              isOpen={openEditorSection === 'internship'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'internship' ? '' : 'internship')}
            >
              <ExperienceListEditor
                items={content.internship || []}
                emptyTemplate={{
                  id: '',
                  company: '',
                  role: '',
                  period: '',
                  city: '',
                  bullets: [''],
                }}
                primaryLabel="公司及部门"
                primaryKey="company"
                secondaryLabel="担任岗位"
                secondaryKey="role"
                placeholders={{
                  primary: '请填写公司及所在部门',
                  secondary: '如：后端开发实习生',
                  period: '如：2026.06 - 2026.09',
                  city: '如：杭州',
                }}
                showCity
                onChange={(next) => updateContent('internship', next)}
              />
            </AccordionPanel>

            {/* 4. Projects */}
            <AccordionPanel
              title={`项目经历 (${(content.projects || []).length})`}
              isOpen={openEditorSection === 'projects'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'projects' ? '' : 'projects')}
            >
              <ExperienceListEditor
                items={content.projects || []}
                emptyTemplate={{
                  id: '',
                  name: '',
                  role: '',
                  period: '',
                  link: '',
                  bullets: [''],
                }}
                primaryLabel="项目名称"
                primaryKey="name"
                secondaryLabel="担任角色"
                secondaryKey="role"
                placeholders={{
                  primary: '请填写核心项目名称',
                  secondary: '如：核心开发 / 项目负责人',
                  period: '如：2026.01 - 2026.05',
                  link: '选填，如 GitHub 或在线演示地址',
                }}
                showLink
                onChange={(next) => updateContent('projects', next)}
              />
            </AccordionPanel>

            {/* 5. Campus */}
            <AccordionPanel
              title={`校园与科研经历 (${(content.campus || []).length})`}
              isOpen={openEditorSection === 'campus'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'campus' ? '' : 'campus')}
            >
              <ExperienceListEditor
                items={content.campus || []}
                emptyTemplate={{
                  id: '',
                  org: '',
                  role: '',
                  period: '',
                  bullets: [''],
                }}
                primaryLabel="组织 / 实验室"
                primaryKey="org"
                secondaryLabel="担任职务"
                secondaryKey="role"
                placeholders={{
                  primary: '如：实验室 / 校学生会 / 竞赛协会',
                  secondary: '如：技术部部长 / 核心研究助理',
                  period: '如：2024.09 - 2025.09',
                }}
                onChange={(next) => updateContent('campus', next)}
              />
            </AccordionPanel>

            {/* 6. Skills */}
            <AccordionPanel
              title={`专业技能 (${(content.skills || []).length})`}
              isOpen={openEditorSection === 'skills'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'skills' ? '' : 'skills')}
            >
              <div className="space-y-2.5 text-xs">
                {(content.skills || []).map((sk) => (
                  <div key={sk.id} className="flex items-start gap-2">
                    <input
                      value={sk.label}
                      onChange={(e) =>
                        updateContent(
                          'skills',
                          content.skills.map((i) => (i.id === sk.id ? { ...i, label: e.target.value } : i)),
                        )
                      }
                      placeholder="分类（如：编程语言）"
                      className="fresh-input w-28 shrink-0 rounded-xl px-2.5 py-1.5"
                    />
                    <input
                      value={sk.items}
                      onChange={(e) =>
                        updateContent(
                          'skills',
                          content.skills.map((i) => (i.id === sk.id ? { ...i, items: e.target.value } : i)),
                        )
                      }
                      placeholder="请填写技能关键词描述"
                      className="fresh-input flex-1 rounded-xl px-2.5 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateContent(
                          'skills',
                          content.skills.filter((i) => i.id !== sk.id),
                        )
                      }
                      className="p-1.5 text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateContent('skills', [...(content.skills || []), { id: makeId('sk'), label: '', items: '' }])
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-teal-300/90 px-3 py-1.5 font-medium text-teal-700 transition hover:bg-teal-50/70"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加技能分类
                </button>
              </div>
            </AccordionPanel>

            {/* 7. Awards & Summary */}
            <AccordionPanel
              title={`荣誉证书与个人总结 (${(content.awards || []).length})`}
              isOpen={openEditorSection === 'awards'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'awards' ? '' : 'awards')}
            >
              <div className="space-y-3 text-xs">
                <div className="space-y-2">
                  {(content.awards || []).map((aw) => (
                    <div key={aw.id} className="flex items-center gap-2">
                      <input
                        value={aw.title}
                        onChange={(e) =>
                          updateContent(
                            'awards',
                            content.awards.map((i) => (i.id === aw.id ? { ...i, title: e.target.value } : i)),
                          )
                        }
                        placeholder="奖项或证书名称"
                        className="fresh-input flex-1 rounded-xl px-2.5 py-1.5"
                      />
                      <input
                        value={aw.date}
                        onChange={(e) =>
                          updateContent(
                            'awards',
                            content.awards.map((i) => (i.id === aw.id ? { ...i, date: e.target.value } : i)),
                          )
                        }
                        placeholder="如：2026.05"
                        className="fresh-input w-24 rounded-xl px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateContent(
                            'awards',
                            content.awards.filter((i) => i.id !== aw.id),
                          )
                        }
                        className="p-1.5 text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateContent('awards', [...(content.awards || []), { id: makeId('aw'), title: '', date: '' }])
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-dashed border-teal-300/90 px-3 py-1.5 font-medium text-teal-700 transition hover:bg-teal-50/70"
                  >
                    <Plus className="h-3.5 w-3.5" /> 添加荣誉/证书
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-2">
                  <label className="mb-1 block font-medium text-slate-700">个人总结（可在上方模块栏开启/关闭显示）</label>
                  <textarea
                    rows={3}
                    value={content.summary || ''}
                    onChange={(e) => updateContent('summary', e.target.value)}
                    placeholder="用 2-3 句话概括专业优势、核心经历与求职匹配度..."
                    className="fresh-input w-full rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </AccordionPanel>
          </div>
        </div>

        {/* Right Live A4 Preview */}
        <div className="print-reset xl:col-span-7">
          {/* A4 Overflow Meter & Zoom Controls */}
          <div className="no-print fresh-card mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              {isOverflow ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <div className="text-xs">
                <span className="font-semibold text-slate-800">A4 单页填充度：</span>
                <span
                  className={`tabular-nums font-bold ${
                    isOverflow ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {pageFillPct}%
                </span>
                {isOverflow ? (
                  <span className="ml-2 text-amber-700">内容略超出单页，建议切换紧凑字号或双栏模板</span>
                ) : (
                  <span className="ml-2 text-slate-500">完美匹配 A4 单页投递规范</span>
                )}
              </div>
              {isOverflow && (
                <button
                  type="button"
                  onClick={() => updateDraft({ font_scale: 'compact', margin_preset: 'compact' })}
                  className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200"
                >
                  一键紧凑排版
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>预览缩放</span>
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="fresh-input rounded-xl px-2 py-1 text-xs"
              >
                <option value={0.58}>58%</option>
                <option value={0.72}>72% (推荐)</option>
                <option value={0.85}>85%</option>
                <option value={1}>100%</option>
              </select>
            </div>
          </div>

          {/* Scaled A4 Container */}
          <div className="print-reset fresh-paper-desk overflow-auto rounded-3xl border border-teal-900/10 p-4 sm:p-6">
            <div
              id="resume-print-wrapper"
              className="mx-auto origin-top"
              style={{
                width: `calc(210mm * ${zoom})`,
                height: `calc(${Math.max(sheetHeightPx, A4_HEIGHT_PX)}px * ${zoom})`,
              }}
            >
              <div
                className="print-reset relative origin-top-left"
                style={{
                  transform: `scale(${zoom})`,
                  width: '210mm',
                }}
              >
                <ResumeSheet resume={draft} sheetRef={sheetRef} />

                {/* Visual A4 Single Page Cutoff Guide (hidden on print) */}
                {isOverflow && (
                  <div
                    className="no-print pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-amber-500"
                    style={{ top: `${A4_HEIGHT_PX}px` }}
                  >
                    <span className="absolute -top-3 right-3 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      A4 第一页底线（超出部分将分页）
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function AccordionPanel({ title, isOpen, onToggle, children }) {
  return (
    <section className="fresh-card overflow-hidden rounded-3xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[#132A2E] transition hover:bg-teal-50/45"
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {isOpen && <div className="border-t border-teal-900/10 p-4">{children}</div>}
    </section>
  );
}

function InputField({ label, value = '', onChange, placeholder = '' }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fresh-input w-full rounded-xl px-2.5 py-1.5 text-xs text-[#132A2E]"
      />
    </div>
  );
}

function ExperienceListEditor({
  items,
  emptyTemplate,
  primaryLabel,
  primaryKey,
  secondaryLabel,
  secondaryKey,
  placeholders = {},
  showCity = false,
  showLink = false,
  onChange,
}) {
  const [showStarTipsFor, setShowStarTipsFor] = useState(null);

  function updateItem(id, patch) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateBullet(itemId, bulletIdx, val) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const nextBullets = [...(item.bullets || [])];
    nextBullets[bulletIdx] = val;
    updateItem(itemId, { bullets: nextBullets });
  }

  function appendStarHelper(itemId, snippet) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const bullets = [...(item.bullets || [])];
    const lastIdx = bullets.length - 1;
    if (lastIdx >= 0 && !bullets[lastIdx].trim()) {
      bullets[lastIdx] = snippet;
    } else {
      bullets.push(snippet);
    }
    updateItem(itemId, { bullets });
  }

  return (
    <div className="space-y-3 text-xs">
      {items.map((item, idx) => (
        <div key={item.id} className="fresh-subcard rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-700">经历 #{idx + 1}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              className="text-rose-600 hover:underline"
            >
              删除
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label={primaryLabel}
              placeholder={placeholders.primary || ''}
              value={item[primaryKey]}
              onChange={(v) => updateItem(item.id, { [primaryKey]: v })}
            />
            <InputField
              label={secondaryLabel}
              placeholder={placeholders.secondary || ''}
              value={item[secondaryKey]}
              onChange={(v) => updateItem(item.id, { [secondaryKey]: v })}
            />
            <InputField
              label="起止时间"
              placeholder={placeholders.period || '如：2025.06 - 2025.09'}
              value={item.period}
              onChange={(v) => updateItem(item.id, { period: v })}
            />
            {showCity && (
              <InputField
                label="城市"
                placeholder={placeholders.city || '如：上海'}
                value={item.city}
                onChange={(v) => updateItem(item.id, { city: v })}
              />
            )}
            {showLink && (
              <InputField
                label="项目链接 (选填)"
                placeholder={placeholders.link || '选填，如项目地址'}
                value={item.link}
                onChange={(v) => updateItem(item.id, { link: v })}
              />
            )}
          </div>

          {/* Bullets + STAR helper */}
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">核心产出描述（建议量化数据）</span>
              <button
                type="button"
                onClick={() => setShowStarTipsFor(showStarTipsFor === item.id ? null : item.id)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
              >
                <Sparkles className="h-3 w-3" /> STAR 句式模板
              </button>
            </div>

            {showStarTipsFor === item.id && (
              <div className="rounded-xl border border-teal-200/90 bg-teal-50/75 p-2.5 text-[11px] text-[#2E484D]">
                <div className="mb-1 font-semibold text-blue-800">点击快捷插入高分动词或句式：</div>
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {STAR_ACTION_VERBS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => appendStarHelper(item.id, `${v}...`)}
                      className="rounded-md bg-white px-1.5 py-0.5 text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  {STAR_EXAMPLE_SNIPPETS.map((s, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => appendStarHelper(item.id, s)}
                      className="block w-full rounded bg-white/90 px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-white"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(item.bullets || []).map((b, bIdx) => (
              <div key={bIdx} className="flex items-start gap-1.5">
                <textarea
                  rows={2}
                  value={b}
                  onChange={(e) => updateBullet(item.id, bIdx, e.target.value)}
                  placeholder="例如：负责核心模块研发，通过引入缓存策略将响应耗时降低 65%..."
                  className="fresh-input flex-1 rounded-xl px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateItem(item.id, { bullets: (item.bullets || []).filter((_, i) => i !== bIdx) })
                  }
                  className="mt-1 p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => updateItem(item.id, { bullets: [...(item.bullets || []), ''] })}
              className="text-[11px] font-medium text-blue-600 hover:underline"
            >
              + 增加一条描述
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, { ...emptyTemplate, id: makeId('exp') }])}
        className="inline-flex items-center gap-1 rounded-xl border border-dashed border-teal-300/90 px-3 py-1.5 font-medium text-teal-700 transition hover:bg-teal-50/70"
      >
        <Plus className="h-3.5 w-3.5" /> 添加一段经历
      </button>
    </div>
  );
}
