/**
 * 简历基础模板与空白初始数据结构（前后端 & 静态版共用）。
 * 面向真实求职用户：提供结构清晰的基础模板，个人与经历字段默认保持空白。
 */

export const DEFAULT_SECTION_ORDER = [
  'education',
  'internship',
  'projects',
  'skills',
  'campus',
  'awards',
  'summary',
];

export const LEGACY_SAMPLE_TITLES_BY_ID = {
  'resume-tech-sample': '2027秋招-后端/全栈开发版（示例）',
  'resume-soe-sample': '2027秋招-国央企/金融管培通用版（示例）',
  'resume-social-sample': '社招通用版 - 资深产品与业务架构简历',
};

export const LEGACY_SAMPLE_NAMES = new Set(['林知行', '沈清禾', '林远航']);

export function createBlankResumeContent() {
  return {
    basic: {
      name: '',
      phone: '',
      email: '',
      city: '',
      targetRole: '',
      github: '',
      politicalStatus: '',
      hometown: '',
      englishLevel: '',
      gradDate: '',
      avatar: '',
    },
    education: [],
    internship: [],
    projects: [],
    campus: [],
    skills: [],
    awards: [],
    summary: '',
  };
}

export function createStarterTemplateResumes() {
  const definitions = [
    {
      id: 'resume-tech-sample',
      title: '基础模板 · 极简技术单栏',
      template_id: 'tech-minimal',
      theme_color: '#2563EB',
      font_scale: 'standard',
      margin_preset: 'standard',
      is_default: 1,
    },
    {
      id: 'resume-social-sample',
      title: '基础模板 · 现代双栏紧凑',
      template_id: 'modern-dual',
      theme_color: '#0F172A',
      font_scale: 'compact',
      margin_preset: 'compact',
      is_default: 0,
    },
    {
      id: 'resume-soe-sample',
      title: '基础模板 · 国央企稳重版',
      template_id: 'formal-soe',
      theme_color: '#1E3A8A',
      font_scale: 'standard',
      margin_preset: 'standard',
      is_default: 0,
    },
    {
      id: 'resume-creative-sample',
      title: '基础模板 · 产品运营亮色',
      template_id: 'creative-product',
      theme_color: '#4F46E5',
      font_scale: 'standard',
      margin_preset: 'standard',
      is_default: 0,
    },
  ];

  return definitions.map((tpl) => ({
    ...tpl,
    section_order: [...DEFAULT_SECTION_ORDER],
    hidden_sections: [],
    content_json: createBlankResumeContent(),
  }));
}

function hasBlankLegacySkeletonContent(content) {
  if (!content || typeof content !== 'object') return true;
  const basic = content.basic || {};
  const hasBasicValue = Object.values(basic).some((v) => String(v || '').trim().length > 0);
  if (hasBasicValue) return false;

  const hasText = (arr, keys) =>
    Array.isArray(arr) &&
    arr.some(
      (item) =>
        keys.some((k) => String(item?.[k] || '').trim().length > 0) ||
        (Array.isArray(item?.bullets) && item.bullets.some((b) => String(b || '').trim().length > 0)),
    );

  if (hasText(content.education, ['school', 'major', 'gpa', 'courses'])) return false;
  if (hasText(content.internship, ['company', 'role', 'city'])) return false;
  if (hasText(content.projects, ['name', 'role', 'link'])) return false;
  if (hasText(content.campus, ['org', 'role'])) return false;
  if (hasText(content.skills, ['items'])) return false;
  if (hasText(content.awards, ['title'])) return false;
  if (String(content.summary || '').trim().length > 0) return false;

  return true;
}

/**
 * 判断一条历史存储的简历是否为尚未被用户修改过的旧版虚构示例人设（或遗留空骨架）。
 * 仅当 ID、旧示例标题匹配，且内容为虚构示例姓名或空白骨架时才返回 true，绝不覆盖用户真实编辑过的内容。
 */
export function isLegacySamplePersona(resumeRow) {
  if (!resumeRow || typeof resumeRow !== 'object') return false;
  const legacyTitle = LEGACY_SAMPLE_TITLES_BY_ID[resumeRow.id];
  if (!legacyTitle || resumeRow.title !== legacyTitle) return false;

  let content = resumeRow.content_json;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return false;
    }
  }
  const basicName = String(content?.basic?.name || '').trim();
  return LEGACY_SAMPLE_NAMES.has(basicName) || hasBlankLegacySkeletonContent(content);
}
