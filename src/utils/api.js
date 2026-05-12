export const AUTH_TOKEN_KEY = 'crm_auth_token';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const API_BASE = import.meta.env.VITE_API_URL
  ? trimTrailingSlash(import.meta.env.VITE_API_URL)
  : '';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function apiFetch(path, options = {}, config = {}) {
  const {
    auth = true,
    timeoutMs = 25000,
    retries = 0,
    retryDelayMs = 1500,
  } = config;

  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (auth && token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === retries) throw error;
      await sleep(retryDelayMs);
    }
  }
}

export async function apiJson(path, options = {}, config = {}) {
  const response = await apiFetch(path, options, config);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.detail || data?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
