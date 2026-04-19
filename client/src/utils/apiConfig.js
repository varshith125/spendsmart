// Centralized API configuration
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const getApiUrl = (endpoint) => {
  return `${API_BASE}${endpoint}`;
};
