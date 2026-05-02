import axios from 'axios';

const api = axios.create({
  baseURL: 'https://crm-nurces.onrender.com/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

export default api;
