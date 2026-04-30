// src/api/patients.js
import api from './axios';

export const patientsApi = {
  list:        (search = '')       => api.get('/patients', { params: search ? { search } : {} }),
  get:         (id)                => api.get(`/patients/${id}`),
  create:      (data)              => api.post('/patients', data),
  update:      (id, data)          => api.put(`/patients/${id}`, data),
  delete:      (id)                => api.delete(`/patients/${id}`),
  getProgress: (patientId)         => api.get(`/patients/${patientId}/progress`),
  addProgress: (patientId, formData) => api.post(`/patients/${patientId}/progress`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateProgress: (patientId, id, formData) => api.put(`/patients/${patientId}/progress/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteProgress: (patientId, id) => api.delete(`/patients/${patientId}/progress/${id}`),
};
