// src/api/patients.js — запросы для пациентов
import axios from 'axios';
import { ENDPOINTS } from '../constants/api';

const api = axios.create({ withCredentials: true });

export const patientsApi = {
  list: (search = '') =>
    api.get(ENDPOINTS.PATIENTS, { params: search ? { search } : {} }),

  get: (id) =>
    api.get(ENDPOINTS.patient(id)),

  create: (data) =>
    api.post(ENDPOINTS.PATIENTS, data),

  update: (id, data) =>
    api.put(ENDPOINTS.patient(id), data),

  delete: (id) =>
    api.delete(ENDPOINTS.patient(id)),

  // Прогресс
  getProgress: (patientId) =>
    api.get(ENDPOINTS.progress(patientId)),

  addProgress: (patientId, formData) =>
    api.post(ENDPOINTS.progress(patientId), formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
};