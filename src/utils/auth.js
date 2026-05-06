import { AUTH_TOKEN_KEY } from './api';

const PROFILE_KEY = 'crm_profile';

export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function getStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || sessionStorage.getItem(PROFILE_KEY)) || null;
  } catch {
    return null;
  }
}

export function setStoredProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function setAuthSession(data) {
  const profile = {
    name: data.name,
    email: data.email,
    avatar: data.avatar || null,
  };

  if (data.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
  }

  localStorage.setItem('isAuthenticated', 'true');
  sessionStorage.setItem('isAuthenticated', 'true');
  setStoredProfile(profile);
  return profile;
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('isAuthenticated');
  sessionStorage.removeItem('isAuthenticated');
  localStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}

export function hasAuthSession() {
  return Boolean(
    localStorage.getItem(AUTH_TOKEN_KEY) ||
    sessionStorage.getItem(AUTH_TOKEN_KEY) ||
    localStorage.getItem('isAuthenticated') === 'true' ||
    sessionStorage.getItem('isAuthenticated') === 'true'
  );
}
