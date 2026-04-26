// src/constants/routes.js — пути маршрутов
export const ROUTES = {
  LOGIN:           '/',
  ADMIN_LOGIN:     '/admin',
  DASHBOARD:       '/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
  PATIENT:         (id) => `/dashboard/patient/${id}`,
  PROFILE:         '/dashboard/profile',
};