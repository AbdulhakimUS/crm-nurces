import api from './axios';
export const importApi = {
  analyze: (formData) => api.post('/import/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  process: (formData) => api.post('/import/process', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};
