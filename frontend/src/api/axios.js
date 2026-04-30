// src/api/axios.js — единый axios instance
import axios from 'axios';
import { API_BASE } from '../constants/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Перехватчик ответов — при 401 редиректим на логин
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
