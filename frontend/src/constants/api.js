// src/constants/api.js — базовые URL для API
export const API_BASE = 'https://crm-nurces.onrender.com/api';

export const ENDPOINTS = {
  // Auth
  LOGIN:   `${API_BASE}/auth/login`,
  LOGOUT:  `${API_BASE}/auth/logout`,
  ME:      `${API_BASE}/auth/me`,

  // Admin
  ADMIN_CLIENTS:  `${API_BASE}/admin/clients`,
  ADMIN_STATS:    `${API_BASE}/admin/stats`,
  ADMIN_PASSWORD: `${API_BASE}/admin/password`,

  // Client profile
  CLIENT_PROFILE:      `${API_BASE}/client/profile`,
  CLIENT_PHOTO:        `${API_BASE}/client/profile/photo`,
  CLIENT_CREDENTIALS:  `${API_BASE}/client/profile/credentials`,

  // Patients
  PATIENTS: `${API_BASE}/patients`,
  patient:  (id) => `${API_BASE}/patients/${id}`,
  progress: (patientId) => `${API_BASE}/patients/${patientId}/progress`,
};