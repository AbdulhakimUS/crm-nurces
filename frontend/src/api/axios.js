// src/api/axios.js — единый axios instance
import api from './axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'https://crm-nurces.onrender.com/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Перехватчик — НЕ делаем автоматический редирект
// Пусть каждый компонент сам обрабатывает 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Просто пробрасываем ошибку дальше без редиректа
    return Promise.reject(error);
  }
);

export default api;
