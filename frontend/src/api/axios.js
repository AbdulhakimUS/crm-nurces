import axios from 'axios';

const api = axios.create({
  baseURL: 'https://crm-nurces.onrender.com/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Добавляем token из localStorage в каждый запрос
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
