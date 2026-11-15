import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('buybee_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    let message = 'Something went wrong. Please try again.';
    
    if (error.response) {
      // Server responded with error status
      message = error.response.data?.message || 
                error.response.data?.error || 
                `Error ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      // Request made but no response
      message = 'Network error. Please check your connection.';
    } else {
      // Error in request setup
      message = error.message || 'An unexpected error occurred';
    }
    
    return Promise.reject(new Error(message));
  }
);

export default api;
