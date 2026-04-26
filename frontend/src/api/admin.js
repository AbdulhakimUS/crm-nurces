// src/api/admin.js — запросы администратора
import axios from 'axios';
import { ENDPOINTS } from '../constants/api';

const api = axios.create({ withCredentials: true });

export const adminApi = {
  getClients: () => api.get(ENDPOINTS.ADMIN_CLIENTS),
  createClient: (data) => api.post(ENDPOINTS.ADMIN_CLIENTS, data),
  updateClient: (id, data) => api.put(`${ENDPOINTS.ADMIN_CLIENTS}/${id}`, data),
  deleteClient: (id) => api.delete(`${ENDPOINTS.ADMIN_CLIENTS}/${id}`),
  getStats: () => api.get(ENDPOINTS.ADMIN_STATS),
  changePassword: (data) => api.put(ENDPOINTS.ADMIN_PASSWORD, data),
};

// src/api/client.js — запросы профиля клиента
export const clientApi = {
  getProfile: () => api.get(ENDPOINTS.CLIENT_PROFILE),
  updateProfile: (data) => api.put(ENDPOINTS.CLIENT_PROFILE, data),
  updatePhoto: (formData) => api.put(ENDPOINTS.CLIENT_PHOTO, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateCredentials: (data) => api.put(ENDPOINTS.CLIENT_CREDENTIALS, data),
};