/**
 * Shared ATS platform detection and metadata registry.
 * Used identically by Node backend (server/services/atsAdapters.js, server/routes/sync.js)
 * and Vite frontend (SyncCenterModal.jsx, JobSearchPage.jsx, localEngine.js).
 */

export const ATS_PLATFORM_META = {
  ats_auto: {
    key: 'ats_auto',
    label: 'ATS 智能自动识别 (推荐)',
    badge: 'ATS 智能同步',
    autoSyncable: true,
    description: '自动识别北森、大易 HotJob、Greenhouse、Lever、Ashby 及网页 JSON-LD。',
  },
  beisen_zhiye: {
    key: 'beisen_zhiye',
    label: '北森招聘云 (*.zhiye.com)',
    badge: '北森招聘云',
    autoSyncable: true,
    description: '支持企业北森门户自动拉取最新社招/校招列表与详情链接。',
  },
  hotjob_wecruit: {
    key: 'hotjob_wecruit',
    label: '大易 HotJob (*.hotjob.cn)',
    badge: '大易 HotJob',
    autoSyncable: true,
    description: '支持 HotJob / Wecruit 门户自动解析 SU 租户并分页拉取在招岗位。',
  },
  greenhouse: {
    key: 'greenhouse',
    label: 'Greenhouse 公开职位榜',
    badge: 'Greenhouse',
    autoSyncable: true,
    description: '标准无鉴权 Greenhouse Job Board API 同步。',
  },
  lever: {
    key: 'lever',
    label: 'Lever 公开职位榜',
    badge: 'Lever',
    autoSyncable: true,
    description: '标准无鉴权 Lever Postings JSON API 同步。',
  },
  ashby: {
    key: 'ashby',
    label: 'Ashby 公开职位榜',
    badge: 'Ashby',
    autoSyncable: true,
    description: '标准无鉴权 Ashby Posting API 同步。',
  },
  moka_open: {
    key: 'moka_open',
    label: 'Moka 公开源 (严格防加密跳过)',
    badge: 'Moka 公开源',
    autoSyncable: false,
    description: '仅同步公开未加密 JSON/JSON-LD；遇到加密载荷将合规跳过。',
  },
  feishu_hire: {
    key: 'feishu_hire',
    label: '飞书招聘公开源 (严格防签名跳过)',
    badge: '飞书公开源',
    autoSyncable: false,
    description: '仅解析开放网页标签；遇到签名校验/门禁将合规跳过。',
  },
};

export const ATS_SOURCE_TYPES = Object.keys(ATS_PLATFORM_META);

export const ALL_SYNC_SOURCE_TYPES = [...ATS_SOURCE_TYPES, 'rss_atom', 'json_feed', 'html_jsonld'];

const EXPLICIT_SPECIFIC_TYPES = new Set([
  'beisen_zhiye',
  'hotjob_wecruit',
  'greenhouse',
  'lever',
  'ashby',
  'moka_open',
  'feishu_hire',
]);

export function detectAtsPlatform(urlStr = '', explicitType = 'ats_auto') {
  if (EXPLICIT_SPECIFIC_TYPES.has(explicitType)) {
    return explicitType;
  }
  if (explicitType === 'rss_atom' || explicitType === 'json_feed') {
    return explicitType;
  }

  let parsed;
  try {
    parsed = new URL(String(urlStr || '').trim());
  } catch {
    return 'html_jsonld';
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'zhiye.com' || host.endsWith('.zhiye.com')) {
    return 'beisen_zhiye';
  }
  if (host === 'hotjob.cn' || host.endsWith('.hotjob.cn')) {
    return 'hotjob_wecruit';
  }
  if (host === 'boards-api.greenhouse.io' || host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') {
    return 'greenhouse';
  }
  if (host === 'jobs.lever.co' || host === 'api.lever.co') {
    return 'lever';
  }
  if (host === 'jobs.ashbyhq.com' || host === 'api.ashbyhq.com') {
    return 'ashby';
  }
  if (host === 'mokahr.com' || host.endsWith('.mokahr.com')) {
    return 'moka_open';
  }
  if (host.endsWith('.jobs.feishu.cn') || host === 'jobs.feishu.cn' || host.endsWith('.jobs.larksuite.com')) {
    return 'feishu_hire';
  }

  return 'html_jsonld';
}

export function isPlaintextAutoSyncPlatform(platform = '') {
  return Boolean(ATS_PLATFORM_META[platform]?.autoSyncable && platform !== 'ats_auto');
}

export function getCompanyAtsSupport(company) {
  if (!company) return { autoSyncable: false, platform: 'html_jsonld', url: '', label: '' };
  const candidates = [company.official_social_url, company.official_campus_url]
    .map((u) => String(u || '').trim())
    .filter(Boolean);

  for (const url of candidates) {
    const platform = detectAtsPlatform(url, 'ats_auto');
    if (isPlaintextAutoSyncPlatform(platform)) {
      return {
        autoSyncable: true,
        platform,
        url,
        label: ATS_PLATFORM_META[platform]?.badge || 'ATS 可同步',
      };
    }
  }
  return {
    autoSyncable: false,
    platform: detectAtsPlatform(candidates[0] || '', 'ats_auto'),
    url: candidates[0] || '',
    label: '',
  };
}
