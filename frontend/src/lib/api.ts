const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
    // Fallback for production if env var is missing
    return 'https://ai-exam-backend-ay37.onrender.com/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export interface UserSession {
  id: number;
  username: string;
  email: string;
  role: 'student' | 'examiner' | 'admin';
  access: string;
  refresh: string;
}

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

let inFlightRefreshPromise: Promise<string | null> | null = null;
let isRedirectingToLogin = false;

export const setAuthSession = (session: { access: string; refresh: string; username: string; email: string; role: string; id: number; must_change_password?: boolean }) => {
  if (typeof window === 'undefined') return;
  isRedirectingToLogin = false;
  localStorage.setItem('access_token', session.access);
  localStorage.setItem('refresh_token', session.refresh);
  localStorage.setItem('user_role', session.role);
  localStorage.setItem('user_name', session.username);
  localStorage.setItem('user_email', session.email);
  localStorage.setItem('user_id', String(session.id));
  localStorage.setItem('must_change_password', String(session.must_change_password || false));
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_id');
  localStorage.removeItem('must_change_password');
};

export const getAuthSession = () => {
  if (typeof window === 'undefined') return null;
  const access = localStorage.getItem('access_token');
  const refresh = localStorage.getItem('refresh_token');
  const role = localStorage.getItem('user_role');
  const username = localStorage.getItem('user_name');
  const email = localStorage.getItem('user_email');
  const id = localStorage.getItem('user_id');
  const mustChange = localStorage.getItem('must_change_password');

  if (!access || !refresh) return null;

  return {
    access,
    refresh,
    role: role as 'student' | 'examiner' | 'admin',
    username,
    email,
    id: Number(id),
    must_change_password: mustChange === 'true',
  };
};

export const refreshAuthToken = async (): Promise<string | null> => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;

  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });

      if (res.status === 200) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access);
        return data.access;
      } else {
        clearAuthSession();
        return null;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      clearAuthSession();
      return null;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const headers = new Headers(options.headers || {});
  
  // Set JSON content-type if not sending FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Set Accept-Language from localStorage
  const lang = typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') : null;
  if (lang) {
    headers.set('Accept-Language', lang);
  }

  let token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedOptions = { ...options, headers };
  let url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  
  let response = await fetch(url, mergedOptions);

  // If 401 Unauthorized, try refreshing token once
  if (response.status === 401) {
    const newAccessToken = await refreshAuthToken();
    if (newAccessToken) {
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      response = await fetch(url, { ...options, headers });
    } else {
      if (!isRedirectingToLogin && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        isRedirectingToLogin = true;
        clearAuthSession();
        window.location.href = '/login';
      }
    }
  }

  return response;
};
