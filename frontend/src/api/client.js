const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function buildUrl(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

async function getJson(path, params = {}) {
  const res = await fetch(buildUrl(path, params));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function postJson(path, body = {}) {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function getMeta() {
  return getJson('/meta');
}

export function getSummary(params) {
  return getJson('/summary', params);
}

export function getKlines(params) {
  return getJson('/klines', params);
}

export function getTradesSample(params) {
  return getJson('/trades/sample', params);
}

export function getSnapshot(params) {
  return getJson('/snapshot', params);
}

export function simulateStrategy(body) {
  return postJson('/simulate', body);
}

export function getBacktestById(id) {
  return getJson(`/backtest/${id}`);
}

export function getFeatures(params) {
  return getJson('/features', params);
}

export function getInsights(params) {
  return getJson('/insights', params);
}
