// src/api/admin.js
import api from './axios';

export const adminApi = {
  getClients:    ()              => api.get('/admin/clients'),
  createClient:  (data)          => api.post('/admin/clients', data),
  updateClient:  (id, data)      => api.put(`/admin/clients/${id}`, data),
  deleteClient:  (id)            => api.delete(`/admin/clients/${id}`),
  getStats:      ()              => api.get('/admin/stats'),
  changePassword:(data)          => api.put('/admin/password', data),
};
