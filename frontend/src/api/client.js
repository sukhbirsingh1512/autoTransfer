import axios from 'axios';

const TOKEN_KEY = 'ft_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null);
      if (!location.pathname.startsWith('/login')) {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const apiGet = (url, config) => api.get(url, config).then((r) => r.data);
export const apiPost = (url, data, config) => api.post(url, data, config).then((r) => r.data);
export const apiPut = (url, data, config) => api.put(url, data, config).then((r) => r.data);
export const apiDelete = (url, config) => api.delete(url, config).then((r) => r.data);
