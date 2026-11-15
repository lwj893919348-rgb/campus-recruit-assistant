import { localEngine } from './localEngine.js';

export const IS_STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `请求失败 (${res.status})`;
    try {
      const payload = await res.json();
      if (payload?.error) errMsg = payload.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(errMsg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== '全部') {
      search.set(k, String(v));
    }
  });
  return search.toString();
}

export const api = {
  isStaticMode: IS_STATIC_MODE,

  getDashboard: () => (IS_STATIC_MODE ? localEngine.getDashboard() : request('/api/dashboard')),

  getJobs: (params = {}) => {
    if (IS_STATIC_MODE) return localEngine.getJobs(params);
    const qs = buildQuery(params);
    return request(`/api/jobs${qs ? `?${qs}` : ''}`);
  },
  createJob: (data) =>
    IS_STATIC_MODE ? localEngine.createJob(data) : request('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
  getCompanies: (params = {}) => {
    if (IS_STATIC_MODE) return localEngine.getCompanies(params);
    const qs = buildQuery(params);
    return request(`/api/companies${qs ? `?${qs}` : ''}`);
  },
  createCompany: (data) =>
    IS_STATIC_MODE
      ? localEngine.createCompany(data)
      : request('/api/companies', { method: 'POST', body: JSON.stringify(data) }),
  verifyUrl: (payload) =>
    IS_STATIC_MODE
      ? localEngine.verifyUrl(payload)
      : request('/api/verify/check', { method: 'POST', body: JSON.stringify(payload) }),
  verifyBatch: (payload = {}) =>
    IS_STATIC_MODE
      ? localEngine.verifyBatch(payload)
      : request('/api/verify/batch', { method: 'POST', body: JSON.stringify(payload) }),

  getResumes: () => (IS_STATIC_MODE ? localEngine.getResumes() : request('/api/resumes')),
  createResume: (data) =>
    IS_STATIC_MODE
      ? localEngine.createResume(data)
      : request('/api/resumes', { method: 'POST', body: JSON.stringify(data) }),
  updateResume: (id, data) =>
    IS_STATIC_MODE
      ? localEngine.updateResume(id, data)
      : request(`/api/resumes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  duplicateResume: (id, title) =>
    IS_STATIC_MODE
      ? localEngine.duplicateResume(id, title)
      : request(`/api/resumes/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ title }) }),
  deleteResume: (id) =>
    IS_STATIC_MODE ? localEngine.deleteResume(id) : request(`/api/resumes/${id}`, { method: 'DELETE' }),

  getApplications: (params = {}) => {
    if (IS_STATIC_MODE) return localEngine.getApplications(params);
    const qs = buildQuery(params);
    return request(`/api/applications${qs ? `?${qs}` : ''}`);
  },
  createApplication: (data) =>
    IS_STATIC_MODE
      ? localEngine.createApplication(data)
      : request('/api/applications', { method: 'POST', body: JSON.stringify(data) }),
  updateApplication: (id, data) =>
    IS_STATIC_MODE
      ? localEngine.updateApplication(id, data)
      : request(`/api/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  patchApplicationStatus: (id, status, interview_round) =>
    IS_STATIC_MODE
      ? localEngine.patchApplicationStatus(id, status, interview_round)
      : request(`/api/applications/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, interview_round }),
        }),
  deleteApplication: (id) =>
    IS_STATIC_MODE
      ? localEngine.deleteApplication(id)
      : request(`/api/applications/${id}`, { method: 'DELETE' }),
  clearDemoApplications: () =>
    IS_STATIC_MODE
      ? localEngine.clearDemoApplications()
      : request('/api/applications/demo', { method: 'DELETE' }),
  downloadApplicationsCsv: async () => {
    if (IS_STATIC_MODE) {
      return localEngine.downloadApplicationsCsv();
    }
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/applications/export.csv`;
    a.download = 'campus-applications.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  getSyncStatus: () => (IS_STATIC_MODE ? localEngine.getSyncStatus() : request('/api/sync/status')),
  runSync: (payload = {}) =>
    IS_STATIC_MODE
      ? localEngine.runSync(payload)
      : request('/api/sync/run', { method: 'POST', body: JSON.stringify(payload) }),
  createSyncSource: (data) =>
    IS_STATIC_MODE
      ? localEngine.createSyncSource(data)
      : request('/api/sync/sources', { method: 'POST', body: JSON.stringify(data) }),
  subscribeCompanySource: (data) =>
    IS_STATIC_MODE
      ? localEngine.subscribeCompanySource(data)
      : request('/api/sync/sources/subscribe-company', { method: 'POST', body: JSON.stringify(data) }),
  subscribeAllAtsSources: () =>
    IS_STATIC_MODE
      ? localEngine.subscribeAllAtsSources()
      : request('/api/sync/sources/subscribe-all-ats', { method: 'POST' }),
  updateSyncSource: (id, data) =>
    IS_STATIC_MODE
      ? localEngine.updateSyncSource(id, data)
      : request(`/api/sync/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSyncSource: (id) =>
    IS_STATIC_MODE ? localEngine.deleteSyncSource(id) : request(`/api/sync/sources/${id}`, { method: 'DELETE' }),
  batchImportJobs: (data) =>
    IS_STATIC_MODE
      ? localEngine.batchImportJobs(data)
      : request('/api/sync/import', { method: 'POST', body: JSON.stringify(data) }),
  previewBatchImport: (rawText) =>
    IS_STATIC_MODE
      ? localEngine.previewBatchImport(rawText)
      : request('/api/sync/import/preview', { method: 'POST', body: JSON.stringify({ rawText }) }),

  exportPersonalBackup: () => localEngine.exportPersonalBackup(),
  importPersonalBackup: (rawText) => localEngine.importPersonalBackup(rawText),
};
