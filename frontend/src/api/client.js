// Keep the API base configurable while Vite proxies /api locally.
const BASE = import.meta.env.VITE_API_BASE ?? '';
const forced = import.meta.env.VITE_USE_MOCK === 'true';
// Same-origin-aware tile URL for the backend basemap proxy (CARTO key stays server-side).
export const basemapProxyUrl = (style) => `${BASE}/api/basemap/${style}/{z}/{x}/{y}`;
// Fail over quickly so an unreachable backend does not leave the control room waiting.
const timeout = 4000;
// Vite injects fixture filenames so absent optional mocks do not produce avoidable 404s.
const mockFiles = __HYDROPULSE_MOCK_FILES__;
async function request(path, options = {}) {
  const controller = new AbortController();
  const { timeoutMs, signal: externalSignal, ...fetchOptions } = options;
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? timeout);
  // A caller signal is merged with the timeout controller, never substituted for it.
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      let detailMsg = `Request failed (${response.status})`;
      if (Array.isArray(data.detail)) {
        detailMsg = data.detail.map((d) => (d.loc ? d.loc.join('.') + ': ' : '') + d.msg).join('; ');
      } else if (typeof data.detail === 'string') {
        detailMsg = data.detail;
      }
      const e = new Error(detailMsg);
      e.status = response.status;
      throw e;
    }
    return data;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
const mock = async (file) => {
  const res = await fetch(`/mock/${file}`);
  if (!res.ok) throw new Error(`Missing mock data: ${file}`);
  const text = await res.text();
  const jsonStart = text.indexOf('{');
  const payload = jsonStart !== -1 ? text.slice(jsonStart) : text;
  return JSON.parse(payload);
};
const LIVE_ONLY_MSG = 'Import needs the live backend';
// Admin-protected network calls: never fake success offline, map auth/conflict statuses to plain messages.
async function networkAdminRequest(path, body, adminToken) {
  if (forced) throw new Error(LIVE_ONLY_MSG);
  try {
    return await request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
      timeoutMs: 30000,
    });
  } catch (e) {
    if (e.status === 401 || e.status === 403) e.message = 'Admin token required or invalid';
    else if (e.status === 409) e.message = 'Network changed, re-validate';
    else if (e.status === undefined) e.message = LIVE_ONLY_MSG;
    throw e;
  }
}

// AI assistant calls (suggestions, what-if, IntelliSense, pipe condition). Never fake data offline.
const ASSISTANT_OFFLINE_MSG = 'This needs the live backend';
async function assistantRequest(path, { method = 'GET', body, headers, timeoutMs, signal } = {}) {
  if (forced) throw new Error(ASSISTANT_OFFLINE_MSG);
  try {
    return await request(path, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      headers: headers || {},
      timeoutMs,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      if (signal?.aborted) throw e; // the caller cancelled; let it ignore the result
      e.message = 'The backend took too long to answer';
    } else if (e.status === undefined) {
      e.message = ASSISTANT_OFFLINE_MSG;
    }
    throw e;
  }
}
export const client = {
  forcedMock: forced,
  hasMockFile: (file) => mockFiles.includes(file),
  getHealth: () => request('/api/health'),
  getNetwork: () => request('/api/network'),
  getPresets: () => request('/api/presets'),
  mockHealth: () => mock('health.json'),
  mockNetwork: () => mock('network.json'),
  mockPresets: () => mock('presets.json'),
  mockSimulate: (body, presetId) => {
    // Preset snapshots are optional; callers synthesize a labeled demo result when none exists.
    const file = `simulate_leak_${presetId || 'default'}.json`;
    return mockFiles.includes(file) ? mock(file) : Promise.resolve(null);
  },
  simulateLeak: (body) =>
    request('/api/simulate-leak', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  isolate: (body) =>
    request('/api/isolate', { method: 'POST', body: JSON.stringify(body) }),
  importPreview: async ({ format, filename, content, network_name }) => {
    if (forced) throw new Error(LIVE_ONLY_MSG);
    const body = { format, filename, content };
    if (network_name) body.network_name = network_name;
    try {
      return await request('/api/network/import/preview', {
        method: 'POST',
        body: JSON.stringify(body),
        timeoutMs: 30000,
      });
    } catch (e) {
      if (e.status === undefined) e.message = LIVE_ONLY_MSG;
      throw e;
    }
  },
  importCommit: ({ preview_token, expected_network_revision, adminToken }) =>
    networkAdminRequest(
      '/api/network/import/commit',
      { preview_token, expected_network_revision, confirm: true },
      adminToken,
    ),
  resetNetwork: ({ target = 'baseline', adminToken } = {}) =>
    networkAdminRequest('/api/network/reset', { target, confirm: true }, adminToken),
  // The OpenRouter key goes in a header only, never the query string.
  getSuggestions: ({ openRouterKey } = {}) =>
    assistantRequest('/api/ai/suggestions', {
      headers: openRouterKey ? { 'X-OpenRouter-Key': openRouterKey } : {},
      timeoutMs: 15000,
    }),
  whatIf: (body) => assistantRequest('/api/what-if', { method: 'POST', body, timeoutMs: 30000 }),
  intellisense: (body, signal) =>
    assistantRequest('/api/network/intellisense', { method: 'POST', body, timeoutMs: 8000, signal }),
  buildPreview: (body) =>
    assistantRequest('/api/network/build/preview', { method: 'POST', body, timeoutMs: 30000 }),
  getPipeCondition: () => assistantRequest('/api/pipes/condition', { timeoutMs: 15000 }),
  applySuggestion: async ({ suggestion_id, expected_network_revision, adminToken }) => {
    if (forced) throw new Error(ASSISTANT_OFFLINE_MSG);
    try {
      return await networkAdminRequest(
        '/api/ai/apply-suggestion',
        { suggestion_id, expected_network_revision, confirm: true },
        adminToken,
      );
    } catch (e) {
      if (e.status === 404) e.message = 'Suggestion no longer exists';
      else if (e.status === 409) e.message = 'The network changed. Refresh the suggestions';
      else if (e.message === LIVE_ONLY_MSG) e.message = ASSISTANT_OFFLINE_MSG;
      throw e;
    }
  },
  // Undo = go back one network revision (the backend keeps exactly one).
  undoLast: async ({ adminToken } = {}) => {
    if (forced) throw new Error(ASSISTANT_OFFLINE_MSG);
    try {
      return await networkAdminRequest('/api/network/reset', { target: 'previous', confirm: true }, adminToken);
    } catch (e) {
      if (e.message === LIVE_ONLY_MSG) e.message = ASSISTANT_OFFLINE_MSG;
      throw e;
    }
  },
};
