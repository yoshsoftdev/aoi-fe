import axios from 'axios'

// Detect if running in production (embedded) or development
// In production, use relative path since frontend and backend are on same server
// In development, use environment variable or default localhost
const getApiBaseURL = (): string => {
  // Check if VITE_API_URL is explicitly set (development)
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== '') {
    return import.meta.env.VITE_API_URL
  }
  
  // In production (embedded), use relative path
  // This works because frontend is served from the same origin as backend
  // Check both MODE and DEV/PROD flags
  const isProduction = import.meta.env.MODE === 'production' || 
                       import.meta.env.PROD === true ||
                       (!import.meta.env.DEV && window.location.hostname !== 'localhost')
  
  if (isProduction) {
    return '/api/v1'
  }
  
  // Development fallback
  return 'http://localhost:8071/api/v1'
}

const API_BASE_URL = getApiBaseURL()

// Log for debugging (remove in production if needed)
if (import.meta.env.DEV) {
  console.log('[API] Base URL:', API_BASE_URL)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api

