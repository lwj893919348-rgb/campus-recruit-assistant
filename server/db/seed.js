import fs from 'node:fs';
import { normalizeJobLocation } from '../../shared/jobParser.js';
import {
  CATALOG_UPDATED_AT,
  DEFAULT_SYNC_SOURCES,
  OFFICIAL_COMPANIES,
  OFFICIAL_JOBS,
} from '../data/officialCatalog.js';

const NOW_ISO = CATALOG_UPDATED_AT;

const SAMPLE_RESUMES = [
  {
    id: 'resume-tech-sample',
    title: '2027秋招-后端/全栈开发版（示例）',
    template_id: 'tech-minimal',
    theme_color: '#2563EB',
    font_scale: 'standard',
    margin_preset: 'standard',
    section_order: ['education', 'internship', 'projects', 'skills', 'campus', 'awards', 'summary'],
    hidden_sections: ['summary'],
    is_default: 1,
    content_json: {
      basic: {
        name: '林知行',
        phone: '138-0000-2027',
        email: 'linzhixing@example.edu.cn',
        city: '期望城市：杭州 / 上海 / 深圳',
        targetRole: 'Java / Go 后端开发工程师（2027届校招）',
        github: 'github.com/linzhixing-dev',
        politicalStatus: '共青团员',
        hometown: '浙江杭州',
        englishLevel: 'CET-6 (568)',
        gradDate: '2027年6月',
        avatar: '',
      },
      education: [
        {
          id: 'edu-1',
          school: '华东理工大学（211 / 双一流）',
          degree: '本科',
          major: '计算机科学与技术',
          period: '2023.09 - 2027.06',
          gpa: 'GPA 3.78/4.0（专业前 8%）',
          courses: '主修课程：数据结构与算法、操作系统、计算机网络、数据库系统原理、分布式系统设计',
        },
      ],
      internship: [
        {
          id: 'int-1',
          company: '某大型互联网企业 · 交易平台研发部',
          role: '后端开发实习生',
          period: '2026.06 - 2026.09',
          city: '杭州',
          bullets: [
            '负责优惠券核销核心链路性能优化，通过引入 Redis 分片缓存与本地 Caffeine 二级缓存，将高峰期接口 P99 耗时从 142ms 降至 34ms（降幅 76%）。',
            '参与大促防超卖与幂等网关改造，基于 RocketMQ 事务消息实现异步对账补偿，保障日均 300 万级核销请求零资损。',
            '独立编写 18 个核心服务集成测试与压测脚本，发现并修复 2 处并发锁竞争隐患，获部门季度实习生优秀评价。',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-1',
          name: '分布式校园秒杀与统一限流网关（Go + Redis + Kafka）',
          role: '核心开发 / 项目负责人',
          period: '2026.01 - 2026.05',
          link: 'github.com/linzhixing-dev/flash-gateway',
          bullets: [
            '针对校园抢课/抢票瞬时高并发场景，设计令牌桶 + 滑动窗口双层限流中间件，结合 Redis Lua 脚本完成原子化库存预扣减。',
            '采用 Kafka 异步削峰解耦订单落库流程，引入死信队列与幂等 Token 校验，单机压测支撑 12,000+ QPS 稳定运行。',
          ],
        },
        {
          id: 'proj-2',
          name: '基于 RAG 的高校就业政策与网申助手',
          role: '全栈研发',
          period: '2025.09 - 2025.12',
          link: '',
          bullets: [
            '使用 React + FastAPI + PGVector 搭建知识库检索系统，整理 1,200+ 份校招宣讲公告并构建混合检索（BM25 + 向量召回）。',
            '在校内测试期间服务 400+ 名应届生查询三方协议与落户政策，问答准确率提升至 91%。',
          ],
        },
      ],
      campus: [
        {
          id: 'camp-1',
          org: '校 ACM 程序设计协会',
          role: '技术培训部部长',
          period: '2024.09 - 2025.09',
          bullets: [
            '组织 12 场算法周赛与校招刷题打卡营，累计编写 40+ 道动态规划/图论题解并辅导低年级同学参赛。',
          ],
        },
      ],
      skills: [
        { id: 'sk-1', label: '编程语言', items: '熟练掌握 Java（JVM/并发）、Go，熟悉 Python、TypeScript / SQL' },
        { id: 'sk-2', label: '后端与中间件', items: '熟悉 Spring Boot、Gin、MySQL（索引与事务隔离）、Redis、Kafka、Docker' },
        { id: 'sk-3', label: '计算机基础', items: '扎实掌握 TCP/IP 网络协议、Linux 常用排查命令及常见设计模式' },
      ],
      awards: [
        { id: 'aw-1', title: 'ICPC 国际大学生程序设计竞赛区域赛 银奖', date: '2025.11' },
        { id: 'aw-2', title: '国家励志奖学金 / 校一等奖学金（连续两年）', date: '2024 - 2025' },
        { id: 'aw-3', title: '大学英语六级（CET-6：568分），计算机三级网络技术', date: '2024.12' },
      ],
      summary: '具备扎实的计算机基础与大厂高并发后端实习经历，对系统性能调优与稳定性建设有强烈热情，代码风格规范，具备快速融入团队的能力。',
    },
  },
  {
    id: 'resume-soe-sample',
    title: '2027秋招-国央企/金融管培通用版（示例）',
    template_id: 'formal-soe',
    theme_color: '#1E3A8A',
    font_scale: 'standard',
    margin_preset: 'standard',
    section_order: ['education', 'internship', 'campus', 'projects', 'awards', 'skills', 'summary'],
    hidden_sections: [],
    is_default: 0,
    content_json: {
      basic: {
        name: '沈清禾',
        phone: '139-0000-2027',
        email: 'shenqinghe@example.edu.cn',
        city: '意向城市：北京 / 上海 / 深圳',
        targetRole: '金融科技 / 综合管理培训生（2027届）',
        github: '',
        politicalStatus: '中共党员',
        hometown: '江苏南京',
        englishLevel: 'CET-6 (612) / IELTS 7.0',
        gradDate: '2027年6月',
        avatar: '',
      },
      education: [
        {
          id: 'edu-s1',
          school: '中央财经大学（211 / 双一流）',
          degree: '硕士研究生',
          major: '金融科技（金融学与计算机复合方向）',
          period: '2025.09 - 2027.06',
          gpa: '加权均分 90.4 / 专业排名 3/48',
          courses: '核心课程：商业银行经营管理、公司金融、Python 量化分析、数据库管理、金融风险度量',
        },
        {
          id: 'edu-s2',
          school: '南京大学（985 / 双一流）',
          degree: '本科',
          major: '经济学',
          period: '2021.09 - 2025.06',
          gpa: 'GPA 3.81/4.0（优秀毕业生）',
          courses: '主修课程：微观/宏观经济学、计量经济学、会计学原理、国际金融',
        },
      ],
      internship: [
        {
          id: 'int-s1',
          company: '某国有大型商业银行总行 · 普惠金融部',
          role: '风险模型与业务分析实习生',
          period: '2026.06 - 2026.09',
          city: '北京',
          bullets: [
            '协助搭建小微企业授信评分卡特征指标库，使用 SQL 与 Python 清洗 18 万条历史工商与流水数据，使模型 KS 值提升 4.2%。',
            '独立撰写 6 份行业授信风险周报与《长三角制造业数字化转型调研报告》，获总行带教处室书面表扬。',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-s1',
          name: '国家自然科学基金子课题：数字人民币对商业银行流动性影响研究',
          role: '核心研究助理',
          period: '2025.10 - 2026.05',
          link: '',
          bullets: [
            '负责 32 家上市银行 2018-2025 年财报数据梳理及面板回归建模，完成实证分析章节撰写并作为第二作者投稿核心期刊。',
          ],
        },
      ],
      campus: [
        {
          id: 'camp-s1',
          org: '金融学院研究生党支部 & 校职业发展协会',
          role: '党支部组织委员 / 就业协会副会长',
          period: '2025.09 - 至今',
          bullets: [
            '统筹组织“走进总行/央企”名企参访与校招经验分享会 9 场，累计覆盖师生 1,500+ 人次，撰写宣传稿件浏览量破万。',
          ],
        },
      ],
      skills: [
        { id: 'sk-s1', label: '数据分析', items: '熟练使用 SQL、Python（Pandas/Sklearn）、Stata、Excel 高级数据透视与 VBA' },
        { id: 'sk-s2', label: '语言与资格', items: '英语六级 612 分、雅思 7.0（可作工作语言）；已通过证券从业、基金从业及初级会计职称' },
      ],
      awards: [
        { id: 'aw-s1', title: '研究生国家奖学金（2026年） / 校级优秀共产党员', date: '2026.10' },
        { id: 'aw-s2', title: '“挑战杯”全国大学生课外学术科技作品竞赛 省级一等奖', date: '2025.06' },
      ],
      summary: '中共党员，具备“经济金融 + 数据建模”复合学科背景与国有大行总行实习经历，公文写作规范严谨，责任心与抗压能力强。',
    },
  },
  {
    id: 'resume-social-sample',
    title: '社招通用版 - 资深产品与业务架构简历',
    template_id: 'compact-two-col',
    theme_color: '#0F766E',
    font_scale: 'compact',
    margin_preset: 'narrow',
    section_order: ['internship', 'projects', 'education', 'skills', 'awards', 'summary'],
    hidden_sections: ['campus'],
    is_default: 0,
    content_json: {
      basic: {
        name: '林远航',
        phone: '139-0000-5678',
        email: 'yuanhang.lin@example.com',
        city: '意向城市：上海 / 杭州',
        targetRole: '高级产品经理 / B端解决方案架构师',
        github: '',
        portfolio: 'https://linkedin.com/in/example',
        politicalStatus: '群众',
        hometown: '浙江杭州',
        englishLevel: 'CET-6 / 英语可作为工作语言',
        gradDate: '社招 · 4年经验',
        avatar: '',
      },
      education: [
        {
          id: 'edu-soc-1',
          school: '同济大学',
          degree: '本科',
          major: '工业工程',
          period: '2018.09 - 2022.06',
          gpa: 'GPA 3.7/4.0',
          courses: '核心课程：运筹学、系统工程、管理信息系统、人机交互设计',
        },
      ],
      internship: [
        {
          id: 'work-soc-1',
          company: '某头部SaaS软件科技公司 · 企业服务产品部',
          role: '高级产品经理',
          period: '2024.03 - 至今',
          city: '上海',
          bullets: [
            '负责供应链与业财一体化 SaaS 核心工作台产品规划，主导审批流引擎与权限中心重构，客户续费率提升 9.4 个百分点。',
            '联动售前与交付团队落地 14 家大型制造及零售集团标杆项目，单项目平均客单价由 45 万提升至 78 万。',
          ],
        },
        {
          id: 'work-soc-2',
          company: '某一线互联网平台 · 商业化产品团队',
          role: '产品经理',
          period: '2022.07 - 2024.02',
          city: '杭州',
          bullets: [
            '负责中小商家投放增长后台与线索归因链路设计，通过漏斗诊断工具将商家首月留存率提升 11%。',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-soc-1',
          name: 'AI 智能客服工单与知识库中台 0-1 建设',
          role: '项目负责人',
          period: '2025.04 - 2026.02',
          link: '',
          bullets: [
            '设计基于企业私有知识库的 RAG 检索增强流程与人工接管降级策略，上线后高频标准问题自动解决率达 64%，客服人效提升 38%。',
          ],
        },
      ],
      campus: [],
      skills: [
        { id: 'sk-soc-1', label: '产品与商业化', items: '熟悉 B端业财/供应链建模、SQL 数据分析、Axure/Figma 原型设计、PRD 与招投标方案撰写' },
        { id: 'sk-soc-2', label: '跨团队协同', items: '具备千万级营收产线跨部门PMO推进经验，持有 PMP 项目管理认证' },
      ],
      awards: [
        { id: 'aw-soc-1', title: '2025 年度公司级最佳商业化产品创新奖', date: '2026.01' },
      ],
      summary: '4年B端SaaS与商业化产品实战经验，擅长从复杂企业业务流程中抽象标准化产品架构，兼顾商业化落地与研发交付效率。',
    },
  },
];

const DEMO_APPLICATIONS = [
  {
    id: 'app-demo-1',
    job_id: 'job-bd-beijing-backend',
    company_name: '字节跳动',
    job_title: '后端开发工程师（抖音/火山引擎方向）',
    city: '北京',
    official_url: 'https://jobs.bytedance.com/campus',
    season_tag: '2027届秋招补录',
    channel: '校招内推',
    referral_code: 'CAMPUS2027',
    resume_id: 'resume-tech-sample',
    status: 'interview',
    interview_round: '技术二面',
    next_event_at: '2026-11-17T14:30',
    applied_at: '2026-11-05',
    priority: 'high',
    notes: '一面已过：考察了 Redis 持久化、Go GMP 调度、手撕 LRU 缓存；二面重点复习系统设计（短链/抢票）。',
    is_demo: 1,
  },
  {
    id: 'app-demo-2',
    job_id: 'job-tx-shenzhen-backend',
    company_name: '腾讯',
    job_title: '后台开发方向（微信/腾讯云事业群）',
    city: '深圳',
    official_url: 'https://join.qq.com',
    season_tag: '2027届秋招补录',
    channel: '官网直投',
    referral_code: '',
    resume_id: 'resume-tech-sample',
    status: 'assessment',
    interview_round: '统一笔试',
    next_event_at: '2026-11-18T19:00',
    applied_at: '2026-11-10',
    priority: 'high',
    notes: '官网状态为“待笔试”，注意提前测试牛客摄像头与双机位环境。',
    is_demo: 1,
  },
  {
    id: 'app-demo-3',
    job_id: 'job-ali-hangzhou-java',
    company_name: '阿里巴巴集团',
    job_title: 'Java 研发工程师（阿里云基础产品）',
    city: '杭州',
    official_url: 'https://campus.alibaba.com',
    season_tag: '2027届秋招补录',
    channel: '官网直投',
    referral_code: '',
    resume_id: 'resume-tech-sample',
    status: 'applied',
    interview_round: '简历筛选中',
    next_event_at: '',
    applied_at: '2026-11-13',
    priority: 'normal',
    notes: '已完成官网测评，等待业务团队简历评估。',
    is_demo: 1,
  },
  {
    id: 'app-demo-4',
    job_id: 'job-cmb-hangzhou-fintech',
    company_name: '招商银行',
    job_title: 'Fintech 金融科技生 · 全栈与大数据方向',
    city: '杭州',
    official_url: 'https://career.cmbchina.com',
    season_tag: '2027届秋招',
    channel: '官网直投',
    referral_code: '',
    resume_id: 'resume-soe-sample',
    status: 'wishlist',
    interview_round: '',
    next_event_at: '',
    applied_at: '2026-11-15',
    priority: 'normal',
    notes: '截止日期 12-08，准备补充金融科技项目描述后再正式官网网申。',
    is_demo: 1,
  },
];

/**
 * Safely merges built-in verified companies, jobs, and default sync sources
 * into an existing or empty database without touching user-created resumes,
 * applications, or user_submitted jobs.
 */
function loadLiveAtsSnapshot(snapshotOverride) {
  if (snapshotOverride !== undefined) return snapshotOverride;
  try {
    const raw = fs.readFileSync(new URL('../data/liveAtsSnapshot.json', import.meta.url), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function upsertBuiltInCatalog(db, options = {}) {
  const { snapshotOverride } = options || {};
  const snapshot = loadLiveAtsSnapshot(snapshotOverride);
  const snapshotJobs = Array.isArray(snapshot?.jobs) ? snapshot.jobs : [];
  const coveredCompanyIds = new Set(snapshotJobs.map((j) => j.company_id).filter(Boolean));
  const snapshotJobIdSet = new Set(snapshotJobs.map((j) => j.id).filter(Boolean));

  const existingCompanyIds = new Set(db.prepare('SELECT id FROM companies').all().map((r) => r.id));
  const existingJobIds = new Set(db.prepare('SELECT id FROM jobs').all().map((r) => r.id));

  let companiesAdded = 0;
  let companiesUpdated = 0;
  let jobsAdded = 0;
  let jobsUpdated = 0;

  const upsertCompany = db.prepare(`
    INSERT INTO companies (
      id, name, short_name, industry, company_type, official_domain,
      official_campus_url, official_social_url, wechat_account, search_url_template, badge_color, hq_city,
      legal_name, entity_tag, verification_status, last_verified_at, updated_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified_official', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      short_name = excluded.short_name,
      industry = excluded.industry,
      company_type = excluded.company_type,
      official_domain = excluded.official_domain,
      official_campus_url = excluded.official_campus_url,
      official_social_url = excluded.official_social_url,
      wechat_account = excluded.wechat_account,
      search_url_template = excluded.search_url_template,
      badge_color = excluded.badge_color,
      hq_city = excluded.hq_city,
      legal_name = excluded.legal_name,
      entity_tag = excluded.entity_tag,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);

  const upsertJob = db.prepare(`
    INSERT INTO jobs (
      id, company_id, external_id, recruit_type, experience_req, title, category, season_tag, graduation_years,
      province, city, city_tier, official_source_url, official_domain,
      deadline, status, is_referral, salary_range, requirements_summary,
      sync_source, last_checked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      external_id = excluded.external_id,
      recruit_type = excluded.recruit_type,
      experience_req = excluded.experience_req,
      title = excluded.title,
      category = excluded.category,
      season_tag = excluded.season_tag,
      graduation_years = excluded.graduation_years,
      province = excluded.province,
      city = excluded.city,
      city_tier = excluded.city_tier,
      official_source_url = excluded.official_source_url,
      official_domain = excluded.official_domain,
      deadline = excluded.deadline,
      is_referral = excluded.is_referral,
      salary_range = excluded.salary_range,
      requirements_summary = excluded.requirements_summary,
      sync_source = excluded.sync_source,
      last_checked_at = excluded.last_checked_at
  `);

  const upsertSource = db.prepare(`
    INSERT INTO sync_sources (
      id, name, source_type, url, default_company_id, enabled,
      auto_interval_hours, last_synced_at, last_status, last_message,
      items_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      items_count = excluded.items_count
  `);

  db.exec('BEGIN;');
  try {
    for (const c of OFFICIAL_COMPANIES) {
      upsertCompany.run(
        c.id,
        c.name,
        c.short_name,
        c.industry,
        c.company_type,
        c.official_domain,
        c.official_campus_url,
        c.official_social_url || '',
        c.wechat_account || '',
        c.search_url_template || '',
        c.badge_color,
        c.hq_city,
        c.legal_name || '',
        c.entity_tag || '',
        NOW_ISO,
        NOW_ISO,
        c.notes,
      );
      if (existingCompanyIds.has(c.id)) companiesUpdated += 1;
      else companiesAdded += 1;
    }

    if (coveredCompanyIds.size > 0) {
      const cleanupPlaceholderStmt = db.prepare(`
        DELETE FROM jobs
        WHERE company_id = ?
          AND sync_source = 'verified_registry'
          AND id NOT IN (SELECT job_id FROM applications WHERE job_id IS NOT NULL)
      `);
      const existingSnapRowsStmt = db.prepare(`
        SELECT id FROM jobs
        WHERE company_id = ?
          AND (sync_source = 'live_ats_snapshot' OR id LIKE 'snap-%')
          AND id NOT IN (SELECT job_id FROM applications WHERE job_id IS NOT NULL)
      `);
      const deleteByIdStmt = db.prepare('DELETE FROM jobs WHERE id = ?');

      for (const cid of coveredCompanyIds) {
        cleanupPlaceholderStmt.run(cid);
        const existingSnapRows = existingSnapRowsStmt.all(cid);
        for (const row of existingSnapRows) {
          if (!snapshotJobIdSet.has(row.id)) {
            deleteByIdStmt.run(row.id);
          }
        }
      }
    }

    const jobsToUpsert = [
      ...OFFICIAL_JOBS.filter((j) => !coveredCompanyIds.has(j.company_id)),
      ...snapshotJobs,
    ];

    for (const j of jobsToUpsert) {
      const normalizedLoc = normalizeJobLocation(j.city, j.province);
      upsertJob.run(
        j.id,
        j.company_id,
        j.external_id || '',
        j.recruit_type || '校园招聘',
        j.experience_req || '应届毕业生',
        j.title,
        j.category,
        j.season_tag,
        JSON.stringify(j.graduation_years || []),
        normalizedLoc.province,
        normalizedLoc.city,
        normalizedLoc.city_tier || '省会及重点城市',
        j.official_source_url,
        j.official_domain,
        j.deadline,
        j.status || 'open',
        j.is_referral ? 1 : 0,
        j.salary_range || '',
        j.requirements_summary || '',
        j.sync_source || 'verified_registry',
        j.last_checked_at || snapshot?.generatedAt || NOW_ISO,
        NOW_ISO,
      );
      if (existingJobIds.has(j.id)) jobsUpdated += 1;
      else jobsAdded += 1;
    }

    // Heal any existing DB rows (including user_submitted or legacy ATS sync rows) with unnormalized city names, drifted city_tier, or legacy salary slogans
    const updateLocationStmt = db.prepare('UPDATE jobs SET city = ?, province = ?, city_tier = ? WHERE id = ?');
    for (const row of db.prepare('SELECT id, city, province, city_tier FROM jobs').all()) {
      const nextLoc = normalizeJobLocation(row.city, row.province);
      if (nextLoc.city !== row.city || nextLoc.province !== row.province || nextLoc.city_tier !== row.city_tier) {
        updateLocationStmt.run(nextLoc.city, nextLoc.province, nextLoc.city_tier, row.id);
      }
    }
    db.prepare(
      "UPDATE jobs SET salary_range = '以官网为准' WHERE salary_range IN ('薪资面议/官网披露', '面议/官网披露', '校招竞争力总包', '社招极具竞争力薪酬', '实习日薪+餐补/房补')",
    ).run();

    for (const src of DEFAULT_SYNC_SOURCES) {
      upsertSource.run(
        src.id,
        src.name,
        src.source_type,
        src.url,
        src.default_company_id,
        src.enabled,
        src.auto_interval_hours,
        NOW_ISO,
        src.last_status,
        src.last_message,
        src.id === 'src-builtin-registry' ? jobsToUpsert.length : src.items_count,
        NOW_ISO,
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return { companiesAdded, companiesUpdated, jobsAdded, jobsUpdated };
}

export function seedIfEmpty(db) {
  upsertBuiltInCatalog(db);

  const resumeCount = db.prepare('SELECT COUNT(*) AS cnt FROM resumes').get().cnt;
  if (resumeCount === 0) {
    const insertResume = db.prepare(`
      INSERT INTO resumes (
        id, title, template_id, theme_color, font_scale, margin_preset,
        section_order, hidden_sections, content_json, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of SAMPLE_RESUMES) {
      insertResume.run(
        r.id,
        r.title,
        r.template_id,
        r.theme_color,
        r.font_scale,
        r.margin_preset,
        JSON.stringify(r.section_order),
        JSON.stringify(r.hidden_sections),
        JSON.stringify(r.content_json),
        r.is_default,
        NOW_ISO,
        NOW_ISO,
      );
    }
  }

  const appCount = db.prepare('SELECT COUNT(*) AS cnt FROM applications').get().cnt;
  if (appCount === 0) {
    const insertApp = db.prepare(`
      INSERT INTO applications (
        id, job_id, company_name, job_title, city, official_url, season_tag,
        channel, referral_code, resume_id, status, interview_round, next_event_at,
        applied_at, priority, notes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of DEMO_APPLICATIONS) {
      insertApp.run(
        a.id,
        a.job_id,
        a.company_name,
        a.job_title,
        a.city,
        a.official_url,
        a.season_tag,
        a.channel,
        a.referral_code,
        a.resume_id,
        a.status,
        a.interview_round,
        a.next_event_at,
        a.applied_at,
        a.priority,
        a.notes,
        a.is_demo,
        NOW_ISO,
        NOW_ISO,
      );
    }
  }
}
