import axios from 'axios';

const api = axios.create();

// Injeta token em toda requisicao
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Se 401, tenta refresh automatico
let refreshando = false;
let fila = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (refreshando) {
        return new Promise((resolve, reject) => {
          fila.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      refreshando = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        refreshando = false;
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post('/auth/refresh', { refreshToken });
        localStorage.setItem('token', data.token);
        fila.forEach(p => p.resolve(data.token));
        fila = [];
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (e) {
        fila.forEach(p => p.reject(e));
        fila = [];
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(e);
      } finally {
        refreshando = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
