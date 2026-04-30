// src/api/auth.js
import api from './axios';

export const authApi = {
  login:  (login, password) => api.post('/auth/login', { login, password }),
  logout: ()                 => api.post('/auth/logout'),
  me:     ()                 => api.get('/auth/me'),
};
