import React from 'react';
import { Phone, Mail, MapPin, Globe, Award, GraduationCap, Briefcase, FolderGit2, Users, Sparkles } from 'lucide-react';
import { RESUME_SECTION_LABELS } from '../data/constants.js';

const FONT_SCALE_STYLES = {
  compact: { basePx: 11, leading: 1.4, sectionGap: 10 },
  standard: { basePx: 12, leading: 1.48, sectionGap: 13 },
  relaxed: { basePx: 13, leading: 1.56, sectionGap: 16 },
};

const MARGIN_STYLES = {
  compact: '28px 34px',
  standard: '36px 42px',
  relaxed: '46px 50px',
};

function SectionBlock({ sectionKey, content, templateId, themeColor, basePx }) {
  const headingStyle = { color: themeColor };

  const renderSectionTitle = (title) => {
    if (templateId === 'creative-product') {
      return (
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-block h-4 w-1 rounded-full" style={{ backgroundColor: themeColor }} />
          <h2 className="font-bold tracking-wide text-slate-900" style={{ fontSize: `${basePx + 2}px` }}>
            {title}
          </h2>
        </div>
      );
    }
    if (templateId === 'formal-soe') {
      return (
        <div
          className="mb-2 flex items-center justify-between border-b pb-1"
          style={{ borderColor: themeColor }}
        >
          <h2 className="font-bold tracking-wider" style={{ ...headingStyle, fontSize: `${basePx + 2}px` }}>
            {title}
          </h2>
        </div>
      );
    }
    if (templateId === 'modern-dual') {
      return (
        <h2
          className="mb-1.5 border-b border-slate-200 pb-0.5 font-bold uppercase tracking-wide"
          style={{ ...headingStyle, fontSize: `${basePx + 1.5}px` }}
        >
          {title}
        </h2>
      );
    }
    return (
      <div className="mb-2 border-b-[1.5px] pb-0.5" style={{ borderColor: themeColor }}>
        <h2 className="font-bold tracking-wide" style={{ ...headingStyle, fontSize: `${basePx + 2}px` }}>
          {title}
        </h2>
      </div>
    );
  };

  if (sectionKey === 'education') {
    const items = content.education || [];
    if (items.length === 0) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.education)}
        <div className="space-y-2">
          {items.map((edu) => (
            <div key={edu.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-slate-900">
                  {edu.school}
                  {edu.degree ? <span className="ml-2 font-normal text-slate-700">· {edu.degree}</span> : null}
                  {edu.major ? <span className="ml-1.5 font-medium text-slate-800">{edu.major}</span> : null}
                </div>
                <span className="tabular-nums text-slate-500" style={{ fontSize: `${basePx - 0.5}px` }}>
                  {edu.period}
                </span>
              </div>
              {(edu.gpa || edu.courses) && (
                <div className="mt-0.5 text-slate-700">
                  {edu.gpa ? <span className="mr-3 font-medium text-slate-800">{edu.gpa}</span> : null}
                  {edu.courses ? <span className="text-slate-600">{edu.courses}</span> : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === 'internship') {
    const items = content.internship || [];
    if (items.length === 0) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.internship)}
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={
                templateId === 'creative-product'
                  ? 'rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2'
                  : ''
              }
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-slate-900">
                  {item.company}
                  {item.role ? <span className="ml-2 font-medium text-slate-700">| {item.role}</span> : null}
                  {item.city ? <span className="ml-2 font-normal text-slate-500">({item.city})</span> : null}
                </div>
                <span className="tabular-nums text-slate-500" style={{ fontSize: `${basePx - 0.5}px` }}>
                  {item.period}
                </span>
              </div>
              {item.bullets?.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                  {item.bullets.filter(Boolean).map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === 'projects') {
    const items = content.projects || [];
    if (items.length === 0) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.projects)}
        <div className="space-y-2.5">
          {items.map((proj) => (
            <div key={proj.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-slate-900">
                  {proj.name}
                  {proj.role ? <span className="ml-2 font-medium text-slate-700">· {proj.role}</span> : null}
                  {proj.link ? (
                    <span className="ml-2 font-normal text-slate-500" style={{ fontSize: `${basePx - 1}px` }}>
                      [{proj.link}]
                    </span>
                  ) : null}
                </div>
                <span className="tabular-nums text-slate-500" style={{ fontSize: `${basePx - 0.5}px` }}>
                  {proj.period}
                </span>
              </div>
              {proj.bullets?.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                  {proj.bullets.filter(Boolean).map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === 'campus') {
    const items = content.campus || [];
    if (items.length === 0) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.campus)}
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-slate-900">
                  {item.org}
                  {item.role ? <span className="ml-2 font-medium text-slate-700">· {item.role}</span> : null}
                </div>
                <span className="tabular-nums text-slate-500" style={{ fontSize: `${basePx - 0.5}px` }}>
                  {item.period}
                </span>
              </div>
              {item.bullets?.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                  {item.bullets.filter(Boolean).map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === 'skills') {
    const items = content.skills || [];
    if (items.length === 0) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.skills)}
        {templateId === 'creative-product' ? (
          <div className="space-y-1.5">
            {items.map((sk) => (
              <div key={sk.id} className="flex flex-wrap items-baseline gap-2">
                <span
                  className="rounded px-2 py-0.5 font-semibold text-white"
                  style={{ backgroundColor: themeColor, fontSize: `${basePx - 1}px` }}
                >
                  {sk.label}
                </span>
                <span className="flex-1 text-slate-700">{sk.items}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((sk) => (
              <div key={sk.id} className="text-slate-700">
                <span className="font-semibold text-slate-900">{sk.label}：</span>
                <span>{sk.items}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (sectionKey === 'awards') {
    const items = content.awards || [];
    if (items.length === 0) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.awards)}
        <div className="space-y-1">
          {items.map((aw) => (
            <div key={aw.id} className="flex items-baseline justify-between gap-2 text-slate-700">
              <span>• {aw.title}</span>
              <span className="shrink-0 tabular-nums text-slate-500" style={{ fontSize: `${basePx - 0.5}px` }}>
                {aw.date}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sectionKey === 'summary') {
    if (!content.summary?.trim()) return null;
    return (
      <section>
        {renderSectionTitle(RESUME_SECTION_LABELS.summary)}
        <p className="text-slate-700">{content.summary}</p>
      </section>
    );
  }

  return null;
}

export function ResumeSheet({ resume, sheetRef }) {
  const {
    template_id: templateId = 'tech-minimal',
    theme_color: themeColor = '#2563EB',
    font_scale: fontScale = 'standard',
    margin_preset: marginPreset = 'standard',
    section_order: sectionOrder = ['education', 'internship', 'projects', 'skills', 'campus', 'awards', 'summary'],
    hidden_sections: hiddenSections = [],
    content_json: content = {},
  } = resume || {};

  const basic = content.basic || {};
  const scale = FONT_SCALE_STYLES[fontScale] || FONT_SCALE_STYLES.standard;
  const padding = MARGIN_STYLES[marginPreset] || MARGIN_STYLES.standard;
  const visibleSections = sectionOrder.filter((key) => !hiddenSections.includes(key));

  // Two-column template layout
  if (templateId === 'modern-dual') {
    const leftSections = ['education', 'skills', 'awards'].filter((k) => visibleSections.includes(k));
    const rightSections = visibleSections.filter((k) => !leftSections.includes(k));

    return (
      <div
        id="resume-print-sheet"
        ref={sheetRef}
        className="a4-sheet grid grid-cols-[31%_69%] text-slate-800 shadow-xl"
        style={{ fontSize: `${scale.basePx}px`, lineHeight: scale.leading }}
      >
        {/* Left Accent Column */}
        <div
          className="flex flex-col border-r border-slate-200 px-5 py-7"
          style={{ backgroundColor: `${themeColor}0D`, gap: `${scale.sectionGap}px` }}
        >
          <div>
            {basic.avatar ? (
              <img
                src={basic.avatar}
                alt="证件照"
                className="mb-3 h-24 w-20 rounded-md border border-slate-200 object-cover"
              />
            ) : null}
            <h1 className="font-bold tracking-tight text-slate-900" style={{ fontSize: `${scale.basePx + 10}px` }}>
              {basic.name || '姓名'}
            </h1>
            {basic.targetRole && (
              <div className="mt-1 font-semibold" style={{ color: themeColor, fontSize: `${scale.basePx + 0.5}px` }}>
                {basic.targetRole}
              </div>
            )}
            <div className="mt-3 space-y-1.5 text-slate-600" style={{ fontSize: `${scale.basePx - 0.5}px` }}>
              {basic.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0" style={{ color: themeColor }} />
                  <span className="tabular-nums">{basic.phone}</span>
                </div>
              )}
              {basic.email && (
                <div className="flex items-center gap-1.5 break-all">
                  <Mail className="h-3 w-3 shrink-0" style={{ color: themeColor }} />
                  <span>{basic.email}</span>
                </div>
              )}
              {basic.city && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" style={{ color: themeColor }} />
                  <span>{basic.city}</span>
                </div>
              )}
              {basic.github && (
                <div className="flex items-center gap-1.5 break-all">
                  <Globe className="h-3 w-3 shrink-0" style={{ color: themeColor }} />
                  <span>{basic.github}</span>
                </div>
              )}
              {basic.englishLevel && <div>语言：{basic.englishLevel}</div>}
              {basic.gradDate && <div>毕业：{basic.gradDate}</div>}
            </div>
          </div>

          {leftSections.map((sec) => (
            <SectionBlock
              key={sec}
              sectionKey={sec}
              content={content}
              templateId={templateId}
              themeColor={themeColor}
              basePx={scale.basePx}
            />
          ))}
        </div>

        {/* Right Main Column */}
        <div className="flex flex-col px-7 py-7" style={{ gap: `${scale.sectionGap}px` }}>
          {rightSections.map((sec) => (
            <SectionBlock
              key={sec}
              sectionKey={sec}
              content={content}
              templateId={templateId}
              themeColor={themeColor}
              basePx={scale.basePx}
            />
          ))}
        </div>
      </div>
    );
  }

  // Creative Product Header Banner
  if (templateId === 'creative-product') {
    return (
      <div
        id="resume-print-sheet"
        ref={sheetRef}
        className="a4-sheet text-slate-800 shadow-xl"
        style={{ fontSize: `${scale.basePx}px`, lineHeight: scale.leading }}
      >
        <div
          className="px-10 py-6 text-white"
          style={{
            background: `linear-gradient(125deg, ${themeColor} 0%, #0F172A 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="font-bold tracking-tight" style={{ fontSize: `${scale.basePx + 12}px` }}>
                  {basic.name || '姓名'}
                </h1>
                {basic.targetRole && (
                  <span className="rounded-full bg-white/15 px-3 py-0.5 font-medium text-white">
                    {basic.targetRole}
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-white/90" style={{ fontSize: `${scale.basePx - 0.5}px` }}>
                {basic.phone && <span>电话：{basic.phone}</span>}
                {basic.email && <span>邮箱：{basic.email}</span>}
                {basic.city && <span>{basic.city}</span>}
                {basic.gradDate && <span>毕业时间：{basic.gradDate}</span>}
                {basic.github && <span>主页：{basic.github}</span>}
              </div>
            </div>
            {basic.avatar ? (
              <img
                src={basic.avatar}
                alt="证件照"
                className="h-20 w-16 shrink-0 rounded-lg border-2 border-white/40 object-cover"
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col" style={{ padding, gap: `${scale.sectionGap}px` }}>
          {visibleSections.map((sec) => (
            <SectionBlock
              key={sec}
              sectionKey={sec}
              content={content}
              templateId={templateId}
              themeColor={themeColor}
              basePx={scale.basePx}
            />
          ))}
        </div>
      </div>
    );
  }

  // Formal SOE / Finance Layout
  if (templateId === 'formal-soe') {
    return (
      <div
        id="resume-print-sheet"
        ref={sheetRef}
        className="a4-sheet text-slate-800 shadow-xl"
        style={{ fontSize: `${scale.basePx}px`, lineHeight: scale.leading, padding }}
      >
        <div className="border-t-4 pt-4" style={{ borderColor: themeColor }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-baseline gap-3">
                <h1 className="font-bold tracking-wider text-slate-900" style={{ fontSize: `${scale.basePx + 11}px` }}>
                  {basic.name || '姓名'}
                </h1>
                {basic.targetRole && (
                  <span className="font-semibold" style={{ color: themeColor }}>
                    求职意向：{basic.targetRole}
                  </span>
                )}
              </div>

              <div
                className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-700"
                style={{ fontSize: `${scale.basePx - 0.5}px` }}
              >
                {basic.phone && <div>联系电话：<span className="tabular-nums">{basic.phone}</span></div>}
                {basic.email && <div className="truncate">电子邮箱：{basic.email}</div>}
                {basic.politicalStatus && <div>政治面貌：{basic.politicalStatus}</div>}
                {basic.hometown && <div>籍贯生源：{basic.hometown}</div>}
                {basic.englishLevel && <div>外语能力：{basic.englishLevel}</div>}
                {basic.gradDate && <div>毕业时间：{basic.gradDate}</div>}
                {basic.city && <div className="col-span-2">{basic.city}</div>}
              </div>
            </div>

            {basic.avatar ? (
              <img
                src={basic.avatar}
                alt="证件照"
                className="h-28 w-22 shrink-0 rounded border border-slate-300 object-cover"
              />
            ) : (
              <div className="flex h-28 w-22 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-center text-[10px] text-slate-400">
                一寸证件照
                <br />
                (可选上传)
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col" style={{ gap: `${scale.sectionGap}px` }}>
          {visibleSections.map((sec) => (
            <SectionBlock
              key={sec}
              sectionKey={sec}
              content={content}
              templateId={templateId}
              themeColor={themeColor}
              basePx={scale.basePx}
            />
          ))}
        </div>
      </div>
    );
  }

  // Default: Classic Tech Minimal (ATS Friendly Single Column)
  return (
    <div
      id="resume-print-sheet"
      ref={sheetRef}
      className="a4-sheet text-slate-800 shadow-xl"
      style={{ fontSize: `${scale.basePx}px`, lineHeight: scale.leading, padding }}
    >
      <header className="mb-3 flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex-1 text-center">
          <h1 className="font-bold tracking-wide text-slate-900" style={{ fontSize: `${scale.basePx + 11}px` }}>
            {basic.name || '姓名'}
          </h1>
          {basic.targetRole && (
            <div className="mt-0.5 font-medium" style={{ color: themeColor, fontSize: `${scale.basePx + 0.5}px` }}>
              {basic.targetRole}
            </div>
          )}
          <div
            className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-slate-600"
            style={{ fontSize: `${scale.basePx - 0.5}px` }}
          >
            {basic.phone && <span className="tabular-nums">{basic.phone}</span>}
            {basic.email && <span>| {basic.email}</span>}
            {basic.city && <span>| {basic.city}</span>}
            {basic.gradDate && <span>| 毕业：{basic.gradDate}</span>}
            {basic.github && <span>| {basic.github}</span>}
          </div>
        </div>
        {basic.avatar ? (
          <img
            src={basic.avatar}
            alt="头像"
            className="h-20 w-16 shrink-0 rounded border border-slate-200 object-cover"
          />
        ) : null}
      </header>

      <div className="flex flex-col" style={{ gap: `${scale.sectionGap}px` }}>
        {visibleSections.map((sec) => (
          <SectionBlock
            key={sec}
            sectionKey={sec}
            content={content}
            templateId={templateId}
            themeColor={themeColor}
            basePx={scale.basePx}
          />
        ))}
      </div>
    </div>
  );
}
