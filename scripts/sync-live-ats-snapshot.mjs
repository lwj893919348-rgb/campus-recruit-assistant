import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OFFICIAL_COMPANIES } from '../server/data/officialCatalog.js';
import { fetchAtsSourceJobs } from '../server/services/atsAdapters.js';
import { getCompanyAtsSupport, detectAtsPlatform } from '../shared/atsPlatforms.js';
import { inferCityInfo } from '../shared/jobParser.js';
import { isSpecificJobDetailUrl } from '../shared/jobLinkResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const snapshotPath = path.resolve(projectRoot, 'server', 'data', 'liveAtsSnapshot.json');
const softMode = process.argv.includes('--soft');

function computeSnapshotStatus(deadlineStr, todayIso) {
  const clean = String(deadlineStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return 'open';
  const target = new Date(`${clean}T23:59:59Z`).getTime();
  const now = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return 'open';
  if (target < now) return 'closed';
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diffDays <= 10 ? 'closing_soon' : 'open';
}

function selectDiverseCompanyItems(items = [], limit = 12) {
  const byType = {
    校园招聘: [],
    社会招聘: [],
    实习兼职: [],
  };
  const seenExt = new Set();
  for (const item of items) {
    if (!item?.externalId || seenExt.has(item.externalId)) continue;
    seenExt.add(item.externalId);
    const rt = byType[item.recruitType] ? item.recruitType : '校园招聘';
    byType[rt].push(item);
  }
  const picked = [];
  const queues = [byType['校园招聘'], byType['社会招聘'], byType['实习兼职']];
  let idx = 0;
  while (picked.length < limit && queues.some((q) => q.length > 0)) {
    const q = queues[idx % queues.length];
    if (q.length > 0) picked.push(q.shift());
    idx += 1;
  }
  return picked;
}

async function runPool(tasks, concurrency = 4) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

async function main() {
  let previousSnapshot = { coveredCompanyIds: [], jobs: [] };
  if (fs.existsSync(snapshotPath)) {
    try {
      previousSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      previousSnapshot = { coveredCompanyIds: [], jobs: [] };
    }
  }

  const prevByCompany = new Map();
  for (const job of previousSnapshot.jobs || []) {
    if (!prevByCompany.has(job.company_id)) prevByCompany.set(job.company_id, []);
    prevByCompany.get(job.company_id).push(job);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const autoCompanies = OFFICIAL_COMPANIES.filter((c) => getCompanyAtsSupport(c)?.autoSyncable);

  const tasks = autoCompanies.map((company) => async () => {
    const ats = getCompanyAtsSupport(company);
    const candidateUrls = [];
    for (const u of [company.official_campus_url, company.official_social_url]) {
      if (!u) continue;
      const detected = detectAtsPlatform(u, 'ats_auto');
      const p = typeof detected === 'string' ? detected : detected?.platform;
      if (['beisen_zhiye', 'hotjob_wecruit', 'greenhouse', 'lever', 'ashby'].includes(p) && !candidateUrls.includes(u)) {
        candidateUrls.push(u);
      }
    }

    const collected = [];
    const statuses = [];
    for (const url of candidateUrls) {
      const res = await fetchAtsSourceJobs(
        {
          id: `snapshot-${company.id}`,
          name: company.name,
          source_type: ats.platform,
          url,
        },
        { timeoutMs: 10000, maxPages: 1, pageSize: 15 },
      );
      statuses.push(res.status);
      if (res.status === 'synced' && Array.isArray(res.items)) {
        collected.push(...res.items);
      }
    }

    const openValid = collected.filter((item) => {
      if (!item?.title || !item?.officialUrl || !item?.externalId) return false;
      if (!isSpecificJobDetailUrl(item.officialUrl)) return false;
      return computeSnapshotStatus(item.deadline, todayIso) !== 'closed';
    });

    const selected = selectDiverseCompanyItems(openValid, 12);
    if (selected.length > 0) {
      const normalizedRows = selected.map((item) => {
        const cityInfo = inferCityInfo(item.city, item.title);
        const published =
          item.publishedAt && /^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)
            ? `${item.publishedAt}T08:00:00.000Z`
            : nowIso;
        return {
          id: `snap-${crypto.createHash('md5').update(`${company.id}:${item.externalId}`).digest('hex').slice(0, 10)}`,
          company_id: company.id,
          external_id: item.externalId,
          recruit_type: item.recruitType || '校园招聘',
          experience_req: item.experienceReq || '应届毕业生',
          title: item.title,
          category: item.category || '技术研发',
          season_tag: item.seasonTag || '官网实时热招',
          graduation_years: item.graduationYears || ['2027'],
          province: cityInfo.province,
          city: cityInfo.city,
          city_tier: cityInfo.tier,
          official_source_url: item.officialUrl,
          official_domain: company.official_domain,
          deadline: item.deadline || '长期有效/招满即止',
          status: computeSnapshotStatus(item.deadline, todayIso),
          is_referral: 0,
          salary_range: item.salaryRange || '以官网为准',
          requirements_summary:
            item.requirements || item.description || '来自企业官方 ATS 公开接口实时同步，点击“直达岗位详情页”查看完整要求。',
          sync_source: ats.platform,
          last_checked_at: nowIso,
          created_at: published,
        };
      });
      return { companyId: company.id, name: company.short_name, mode: 'live', rows: normalizedRows, statuses };
    }

    const fallbackRows = prevByCompany.get(company.id) || [];
    return {
      companyId: company.id,
      name: company.short_name,
      mode: fallbackRows.length > 0 ? 'cached_fallback' : 'empty',
      rows: fallbackRows,
      statuses,
    };
  });

  const settled = await runPool(tasks, 4);
  const allJobs = [];
  const coveredCompanyIds = [];
  let liveSuccessCount = 0;
  let cachedCount = 0;
  let emptyCount = 0;

  for (const r of settled) {
    if (r.rows.length > 0) {
      coveredCompanyIds.push(r.companyId);
      allJobs.push(...r.rows);
    }
    if (r.mode === 'live') liveSuccessCount += 1;
    else if (r.mode === 'cached_fallback') cachedCount += 1;
    else emptyCount += 1;
  }

  const outPayload = {
    generatedAt: nowIso,
    totalAutoCompanies: autoCompanies.length,
    liveSyncedCompanies: liveSuccessCount,
    coveredCompanyIds,
    jobs: allJobs,
  };

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify(outPayload, null, 2), 'utf8');

  console.log(
    `[sync:snapshot] 扫描 ${autoCompanies.length} 家开源 ATS 企业：实时抓取 ${liveSuccessCount} 家，回退缓存 ${cachedCount} 家，暂无公开列表 ${emptyCount} 家；共生成 ${allJobs.length} 条可直达详情页真实岗位。`,
  );

  for (const r of settled) {
    console.log(`  - ${r.name} (${r.companyId}): ${r.mode}, ${r.rows.length} 条 [${r.statuses.join(',')}]`);
  }

  if (!softMode && coveredCompanyIds.length === 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[sync:snapshot] 异常：', err);
  if (!softMode) process.exitCode = 1;
});
