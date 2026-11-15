import React, { useEffect, useState } from 'react';
import { X, Building2, MapPin, Link2, FileText, Sparkles } from 'lucide-react';
import { APPLICATION_STAGES } from '../data/constants.js';

export function QuickTrackModal({ open, job, resumes, onClose, onSubmit }) {
  const [status, setStatus] = useState('applied');
  const [channel, setChannel] = useState('官网直投');
  const [referralCode, setReferralCode] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [interviewRound, setInterviewRound] = useState('');
  const [nextEventAt, setNextEventAt] = useState('');
  const [appliedAt, setAppliedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const def = resumes.find((r) => r.is_default) || resumes[0];
      setResumeId(def ? def.id : '');
      setStatus('applied');
      setChannel(job?.is_referral ? '官网直投' : '官网直投');
      setReferralCode('');
      setInterviewRound('');
      setNextEventAt('');
      setAppliedAt(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open, job, resumes]);

  if (!open || !job) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        job_id: job.id,
        company_name: job.company_name,
        job_title: job.title,
        city: job.city,
        official_url: job.official_source_url,
        season_tag: job.season_tag,
        channel,
        referral_code: referralCode,
        resume_id: resumeId || null,
        status,
        interview_round: interviewRound,
        next_event_at: nextEventAt,
        applied_at: appliedAt,
        notes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="no-print fresh-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fresh-modal w-full max-w-lg overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-teal-900/[0.06] bg-gradient-to-r from-teal-50/80 via-white to-sky-50/60 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-[#132A2E]">记入校招投递看板</h3>
            <p className="text-xs text-slate-500">自动关联官网投递入口与本地简历版本，再也不怕海投忘进度</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-teal-900/[0.06] hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="fresh-subcard p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#132A2E]">
              <Building2 className="h-4 w-4 text-teal-600" />
              <span>{job.company_name}</span>
              <span className="text-teal-300">·</span>
              <span className="truncate">{job.title}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-teal-600" />
                {job.city}
              </span>
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-slate-600 ring-1 ring-teal-900/10">
                {job.season_tag}
              </span>
              <span className="inline-flex items-center gap-1 text-teal-700">
                <Link2 className="h-3.5 w-3.5" />
                {job.official_domain}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">当前投递状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="fresh-input w-full rounded-xl px-3 py-2 text-sm"
              >
                {APPLICATION_STAGES.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">投递渠道</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="fresh-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="官网直投">官网直投</option>
                <option value="内推通道">校招 / 社招内推</option>
                <option value="公众号网申">企业公众号推文网申</option>
                <option value="校园宣讲">校园宣讲 / 双选会</option>
                <option value="猎头/HR直联">猎头 / HR 直联</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">关联使用的简历版本</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-teal-500" />
                <select
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                  className="fresh-input w-full rounded-xl py-2 pr-3 pl-8 text-sm"
                >
                  <option value="">暂不关联</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">投递日期</label>
              <input
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                className="fresh-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">内推码（选填）</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="如有内推码可记录在此"
                className="fresh-input w-full rounded-xl px-3 py-2 text-sm placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">下次笔试/面试时间（选填）</label>
              <input
                type="datetime-local"
                value={nextEventAt}
                onChange={(e) => setNextEventAt(e.target.value)}
                className="fresh-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {(status === 'interview' || status === 'assessment') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">当前轮次说明</label>
              <input
                type="text"
                value={interviewRound}
                onChange={(e) => setInterviewRound(e.target.value)}
                placeholder="如：统一笔试 / 技术一面 / HR终面"
                className="fresh-input w-full rounded-xl px-3 py-2 text-sm placeholder:text-slate-400"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">备忘笔记（官网账号 / 岗位重点）</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：用学校邮箱注册网申；需注意该岗位无笔试直接约面..."
              className="fresh-input w-full rounded-xl px-3 py-2 text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-teal-900/[0.06] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="fresh-btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="fresh-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {submitting ? '保存中...' : '保存并同步到投递看板'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
