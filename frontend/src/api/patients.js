import api from './axios';

export const patientsApi = {
  list:             (params)        => api.get('/patients', { params }),
  get:              (id)            => api.get(`/patients/${id}`),
  create:           (data)          => api.post('/patients', data),
  update:           (id, data)      => api.put(`/patients/${id}`, data),
  delete:           (id)            => api.delete(`/patients/${id}`),
  // visits
  getVisits:        (id)            => api.get(`/patients/${id}/visits`),
  addVisit:         (id, data)      => api.post(`/patients/${id}/visits`, data),
  deleteVisit:      (id, vid)       => api.delete(`/patients/${id}/visits/${vid}`),
  // history
  getHistory:       (id)            => api.get(`/patients/${id}/history`),
  addHistory:       (id, data)      => api.post(`/patients/${id}/history`, data),
  deleteHistory:    (id, hid)       => api.delete(`/patients/${id}/history/${hid}`),
  // vaccines
  getVaccines:      (id)            => api.get(`/patients/${id}/vaccines`),
  addVaccine:       (id, data)      => api.post(`/patients/${id}/vaccines`, data),
  deleteVaccine:    (id, vid)       => api.delete(`/patients/${id}/vaccines/${vid}`),
  // medications
  getMedications:   (id)            => api.get(`/patients/${id}/medications`),
  addMedication:    (id, data)      => api.post(`/patients/${id}/medications`, data),
  deleteMedication: (id, mid)       => api.delete(`/patients/${id}/medications/${mid}`),
  // images
  getImages:        (id)            => api.get(`/patients/${id}/images`),
  addImage:         (id, data)      => api.post(`/patients/${id}/images`, data),
  deleteImage:      (id, iid)       => api.delete(`/patients/${id}/images/${iid}`),
};
