// src/api/auth.js — запросы авторизации
import axios from 'axios';
import { ENDPOINTS } from '../constants/api';

const api = axios.create({ withCredentials: true });

export const authApi = {
  login: (login, password) =>
    api.post(ENDPOINTS.LOGIN, { login, password }),

  logout: () =>
    api.post(ENDPOINTS.LOGOUT),

  me: () =>
    api.get(ENDPOINTS.ME),
};