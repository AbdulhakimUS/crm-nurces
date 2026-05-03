import api from './axios';

export const familiesApi = {
  list:         ()           => api.get('/families'),
  get:          (id)         => api.get(`/families/${id}`),
  create:       (data)       => api.post('/families', data),
  update:       (id, data)   => api.put(`/families/${id}`, data),
  delete:       (id)         => api.delete(`/families/${id}`),
};
