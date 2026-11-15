import express from 'express';
import { APPLICATION_STATUSES } from './applications.js';

export function createDashboardRouter(db) {
  const router = express.Router();

  router.get('/dashboard', (req, res) => {
    const totalCompanies = db.prepare('SELECT COUNT(*) AS cnt FROM companies').get().cnt;
    const totalJobs = db.prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE status IN ('open', 'closing_soon')").get().cnt;
    const totalResumes = db.prepare('SELECT COUNT(*) AS cnt FROM resumes').get().cnt;
    const defaultResume = db
      .prepare('SELECT id, title, template_id, updated_at FROM resumes ORDER BY is_default DESC, updated_at DESC LIMIT 1')
      .get();

    const appCountsRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM applications GROUP BY status').all();
    const funnel = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    let totalApplications = 0;
    for (const r of appCountsRows) {
      funnel[r.status] = r.cnt;
      totalApplications += r.cnt;
    }

    const activeAppliedCount =
      funnel.applied + funnel.assessment + funnel.interview + funnel.offer + funnel.rejected;
    const progressedToAssessmentOrAbove = funnel.assessment + funnel.interview + funnel.offer;
    const progressedToInterviewOrAbove = funnel.interview + funnel.offer;

    const upcomingEvents = db
      .prepare(
        `
      SELECT a.*, r.title AS resume_title
      FROM applications a
      LEFT JOIN resumes r ON r.id = a.resume_id
      WHERE a.next_event_at != '' AND a.status NOT IN ('rejected', 'offer')
      ORDER BY a.next_event_at ASC
      LIMIT 6
    `,
      )
      .all();

    const closingJobs = db
      .prepare(
        `
      SELECT j.*, c.name AS company_name, c.short_name AS company_short_name, c.badge_color
      FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.status = 'closing_soon'
      ORDER BY j.deadline ASC
      LIMIT 5
    `,
      )
      .all()
      .map((j) => ({
        ...j,
        graduation_years: JSON.parse(j.graduation_years || '[]'),
        is_referral: Boolean(j.is_referral),
      }));

    const topCities = db
      .prepare(
        `
      SELECT city, city_tier, COUNT(*) AS count
      FROM jobs
      WHERE status IN ('open', 'closing_soon')
      GROUP BY city, city_tier
      ORDER BY count DESC
      LIMIT 10
    `,
      )
      .all();

    const featuredCompanies = db
      .prepare(
        `
      SELECT c.*, (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.status IN ('open', 'closing_soon')) AS open_job_count
      FROM companies c
      ORDER BY open_job_count DESC
      LIMIT 8
    `,
      )
      .all();

    res.json({
      summary: {
        totalCompanies,
        totalOpenJobs: totalJobs,
        totalResumes,
        totalApplications,
        activeAppliedCount,
        interviewRate:
          activeAppliedCount > 0 ? Math.round((progressedToInterviewOrAbove / activeAppliedCount) * 100) : 0,
        assessmentRate:
          activeAppliedCount > 0 ? Math.round((progressedToAssessmentOrAbove / activeAppliedCount) * 100) : 0,
      },
      funnel,
      defaultResume,
      upcomingEvents,
      closingJobs,
      topCities,
      featuredCompanies,
    });
  });

  return router;
}
