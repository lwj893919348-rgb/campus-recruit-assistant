import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Printer,
  Save,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Download,
  Upload,
  Star,
  AlertTriangle,
  CheckCircle2,
  LayoutTemplate,
} from 'lucide-react';
import { api } from '../api/client.js';
import { ResumeSheet } from '../components/ResumeSheet.jsx';
import {
  RESUME_TEMPLATES,
  RESUME_THEME_COLORS,
  RESUME_SECTION_LABELS,
  STAR_ACTION_VERBS,
  STAR_EXAMPLE_SNIPPETS,
} from '../data/constants.js';

const A4_HEIGHT_PX = 1122.5; // 297mm at 96dpi

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ResumeBuilderPage({ activeResumeIdFromNav, onToast, onResumesChanged }) {
  const [resumes, setResumes] = useState([]);
  const [currentId, setCurrentId] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [openEditorSection, setOpenEditorSection] = useState('basic');
  const [zoom, setZoom] = useState(0.72);
  const [sheetHeightPx, setSheetHeightPx] = useState(960);

  const sheetRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchResumes = useCallback(
    async (preferId) => {
      setLoading(true);
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
        }
      } catch (err) {
        onToast('error', err.message);
      } finally {
        setLoading(false);
      }
    },
    [activeResumeIdFromNav, currentId, onResumesChanged, onToast],
  );

  useEffect(() => {
    fetchResumes(activeResumeIdFromNav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResumeIdFromNav]);

  // Measure real rendered A4 height to detect single-page overflow
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return undefined;
    const measure = () => {
      setSheetHeightPx(el.scrollHeight || el.offsetHeight || 960);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [draft]);

  function updateDraft(updater) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setDirty(true);
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

  async function handleSave(showSuccessToast = true) {
    if (!draft) return;
    setSaving(true);
    try {
      const { resume } = await api.updateResume(draft.id, {
        title: draft.title,
        template_id: draft.template_id,
        theme_color: draft.theme_color,
        font_scale: draft.font_scale,
        margin_preset: draft.margin_preset,
        section_order: draft.section_order,
        hidden_sections: draft.hidden_sections,
        content_json: draft.content_json,
        is_default: draft.is_default,
      });
      setResumes((prev) => {
        const nextList = prev.map((r) => (r.id === resume.id ? resume : r));
        onResumesChanged?.(nextList);
        return nextList;
      });
      setDirty(false);
      if (showSuccessToast) onToast('success', `简历「${resume.title}」已保存`);
    } catch (err) {
      onToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectResume(id) {
    if (dirty && draft) {
      await handleSave(false);
    }
    const target = resumes.find((r) => r.id === id);
    if (target) {
      setCurrentId(id);
      setDraft(structuredClone(target));
      setDirty(false);
    }
  }

  async function handleCreateBlank() {
    if (dirty && draft) await handleSave(false);
    const title = window.prompt('请输入新简历版本名称（例如：2027秋招-产品经理版）', '我的校招简历');
    if (!title) return;
    try {
      const { resume } = await api.createResume({ title });
      onToast('success', `已创建新简历「${resume.title}」`);
      await fetchResumes(resume.id);
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

  function moveSection(index, direction) {
    const list = [...(draft.section_order || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    [list[index], list[targetIdx]] = [list[targetIdx], list[index]];
    updateDraft({ section_order: list });
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
    return <div className="h-[72vh] animate-pulse rounded-2xl bg-slate-200/70" />;
  }

  const content = draft.content_json || {};
  const basic = content.basic || {};
  const pageFillPct = Math.round((sheetHeightPx / A4_HEIGHT_PX) * 100);
  const isOverflow = pageFillPct > 102;

  return (
    <div className="print-reset space-y-4">
      {/* Top Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <select
            value={draft.id}
            onChange={(e) => handleSelectResume(e.target.value)}
            className="max-w-[240px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
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
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> 新建
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            title="导出 JSON 备份"
          >
            <Download className="h-3.5 w-3.5" /> 备份
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {dirty ? '有未保存修改' : '已同步本地库'}
          </span>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5 text-blue-600" />
            {saving ? '保存中...' : '保存简历'}
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
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
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
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
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-100">
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
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
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
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="compact">窄边距</option>
                  <option value="standard">标准边距</option>
                  <option value="relaxed">宽边距</option>
                </select>
              </div>
            </div>

            {/* Section Order & Visibility */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="mb-1.5 text-[11px] font-medium text-slate-500">模块顺序与显隐控制</div>
              <div className="flex flex-wrap gap-1.5">
                {(draft.section_order || []).map((secKey, idx) => {
                  const isHidden = (draft.hidden_sections || []).includes(secKey);
                  return (
                    <div
                      key={secKey}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                        isHidden
                          ? 'border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSectionHidden(secKey)}
                        title={isHidden ? '点击显示该模块' : '点击隐藏该模块'}
                      >
                        {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-blue-600" />}
                      </button>
                      <span className={isHidden ? 'line-through' : 'font-medium'}>
                        {RESUME_SECTION_LABELS[secKey]}
                      </span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                        className="hover:text-blue-600 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draft.section_order.length - 1}
                        onClick={() => moveSection(idx, 1)}
                        className="hover:text-blue-600 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
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
                <InputField label="姓名" value={basic.name} onChange={(v) => updateBasic('name', v)} />
                <InputField label="求职意向" value={basic.targetRole} onChange={(v) => updateBasic('targetRole', v)} />
                <InputField label="联系电话" value={basic.phone} onChange={(v) => updateBasic('phone', v)} />
                <InputField label="电子邮箱" value={basic.email} onChange={(v) => updateBasic('email', v)} />
                <InputField label="期望城市" value={basic.city} onChange={(v) => updateBasic('city', v)} />
                <InputField label="毕业时间" value={basic.gradDate} onChange={(v) => updateBasic('gradDate', v)} />
                <InputField label="英语水平" value={basic.englishLevel} onChange={(v) => updateBasic('englishLevel', v)} />
                <InputField label="GitHub / 作品集" value={basic.github} onChange={(v) => updateBasic('github', v)} />
                <InputField label="政治面貌（国企可用）" value={basic.politicalStatus} onChange={(v) => updateBasic('politicalStatus', v)} />
                <InputField label="籍贯生源（国企可用）" value={basic.hometown} onChange={(v) => updateBasic('hometown', v)} />
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
                  <div key={edu.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
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
                        degree: '本科',
                        major: '',
                        period: '2023.09 - 2027.06',
                        gpa: '',
                        courses: '',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加一段教育经历
                </button>
              </div>
            </AccordionPanel>

            {/* 3. Internship */}
            <AccordionPanel
              title={`实习经历 (${(content.internship || []).length})`}
              isOpen={openEditorSection === 'internship'}
              onToggle={() => setOpenEditorSection(openEditorSection === 'internship' ? '' : 'internship')}
            >
              <ExperienceListEditor
                items={content.internship || []}
                emptyTemplate={{
                  id: '',
                  company: '',
                  role: '',
                  period: '2026.06 - 2026.09',
                  city: '',
                  bullets: [''],
                }}
                primaryLabel="公司及部门"
                primaryKey="company"
                secondaryLabel="实习岗位"
                secondaryKey="role"
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
                  period: '2026.01 - 2026.05',
                  link: '',
                  bullets: [''],
                }}
                primaryLabel="项目名称"
                primaryKey="name"
                secondaryLabel="担任角色"
                secondaryKey="role"
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
                  period: '2024.09 - 2025.09',
                  bullets: [''],
                }}
                primaryLabel="组织 / 实验室"
                primaryKey="org"
                secondaryLabel="担任职务"
                secondaryKey="role"
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
                      placeholder="分类"
                      className="w-24 shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5"
                    />
                    <input
                      value={sk.items}
                      onChange={(e) =>
                        updateContent(
                          'skills',
                          content.skills.map((i) => (i.id === sk.id ? { ...i, items: e.target.value } : i)),
                        )
                      }
                      placeholder="技能关键词描述"
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5"
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
                    updateContent('skills', [...(content.skills || []), { id: makeId('sk'), label: '工具/语言', items: '' }])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-50"
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
                        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5"
                      />
                      <input
                        value={aw.date}
                        onChange={(e) =>
                          updateContent(
                            'awards',
                            content.awards.map((i) => (i.id === aw.id ? { ...i, date: e.target.value } : i)),
                          )
                        }
                        placeholder="时间"
                        className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5"
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
                      updateContent('awards', [...(content.awards || []), { id: makeId('aw'), title: '', date: '2026.05' }])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-50"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </AccordionPanel>
          </div>
        </div>

        {/* Right Live A4 Preview */}
        <div className="print-reset xl:col-span-7">
          {/* A4 Overflow Meter & Zoom Controls */}
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
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
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                <option value={0.58}>58%</option>
                <option value={0.72}>72% (推荐)</option>
                <option value={0.85}>85%</option>
                <option value={1}>100%</option>
              </select>
            </div>
          </div>

          {/* Scaled A4 Container */}
          <div className="print-reset overflow-auto rounded-2xl border border-slate-200 bg-slate-200/70 p-4 sm:p-6">
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
}

function AccordionPanel({ title, isOpen, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50/70"
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {isOpen && <div className="border-t border-slate-100 p-4">{children}</div>}
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
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
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
        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
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
              value={item[primaryKey]}
              onChange={(v) => updateItem(item.id, { [primaryKey]: v })}
            />
            <InputField
              label={secondaryLabel}
              value={item[secondaryKey]}
              onChange={(v) => updateItem(item.id, { [secondaryKey]: v })}
            />
            <InputField
              label="起止时间"
              value={item.period}
              onChange={(v) => updateItem(item.id, { period: v })}
            />
            {showCity && (
              <InputField label="城市" value={item.city} onChange={(v) => updateItem(item.id, { city: v })} />
            )}
            {showLink && (
              <InputField label="项目链接 (选填)" value={item.link} onChange={(v) => updateItem(item.id, { link: v })} />
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
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2 text-[11px] text-slate-700">
                <div className="mb-1 font-semibold text-blue-800">点击快捷插入高分动词或句式：</div>
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {STAR_ACTION_VERBS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => appendStarHelper(item.id, `${v}...`)}
                      className="rounded bg-white px-1.5 py-0.5 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
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
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
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
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-50"
      >
        <Plus className="h-3.5 w-3.5" /> 添加一段经历
      </button>
    </div>
  );
}
