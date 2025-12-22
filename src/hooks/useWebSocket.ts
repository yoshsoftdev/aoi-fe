import { useEffect, useRef, useState } from 'react'
import type { DashboardData } from '@/types'

// Detect WebSocket URL - use relative path in production (embedded)
const getWebSocketURL = (): string => {
  // Check if VITE_WS_URL is explicitly set (development)
  if (import.meta.env.VITE_WS_URL && import.meta.env.VITE_WS_URL !== '') {
    return import.meta.env.VITE_WS_URL
  }
  
  // In production (embedded), use relative WebSocket URL
  // Detect protocol (ws or wss) based on current page protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  
  // Check both MODE and DEV/PROD flags
  const isProduction = import.meta.env.MODE === 'production' || 
                       import.meta.env.PROD === true ||
                       (!import.meta.env.DEV && window.location.hostname !== 'localhost')
  
  if (isProduction) {
    return `${protocol}//${host}/api/v1/ws`
  }
  
  // Development fallback
  return 'ws://localhost:8080/api/v1/ws'
}

const WS_URL = getWebSocketURL()

// Log for debugging (remove in production if needed)
if (import.meta.env.DEV) {
  console.log('[WebSocket] URL:', WS_URL)
}

export const useWebSocket = () => {
  // Store dashboard data by parameter_nama (or use a unique key)
  const [data, setData] = useState<Map<string, DashboardData>>(new Map())
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Subscribe to all parameters
      ws.send(JSON.stringify({
        type: 'subscribe',
        parameter_ids: null,
      }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      if (message.type === 'data_update' && message.data) {
        // Backend sends DashboardData format with device_nama and parameter_nama
        const dashboardData: DashboardData = message.data
        
        // Ensure parameter_nama is not empty
        if (!dashboardData.parameter_nama || dashboardData.parameter_nama === '') {
          dashboardData.parameter_nama = `Parameter ${dashboardData.parameter_id}`
        }
        
        // Ensure device_nama is not empty
        if (!dashboardData.device_nama || dashboardData.device_nama === '') {
          dashboardData.device_nama = 'All Devices'
        }
        
        // Ensure timestamp is string format
        const timestampStr = typeof dashboardData.timestamp === 'string' 
          ? dashboardData.timestamp 
          : new Date(dashboardData.timestamp).toISOString()
        
        // Use parameter_id as key (more reliable than name)
        const key = `param_${dashboardData.parameter_id}`
        setData(prev => {
          const newMap = new Map(prev)
          newMap.set(key, {
            ...dashboardData,
            timestamp: timestampStr,
          })
          return newMap
        })
      } else if (message.type === 'error' && message.data) {
        // Handle error format (if backend sends error in clean format)
        const errorData = message.data
        const dashboardData: DashboardData = {
          parameter_id: errorData.parameter_id || 0,
          device_nama: errorData.device_nama || '',
          parameter_nama: errorData.name || errorData.parameter_nama || 'Unknown',
          value: 0,
          timestamp: errorData.timestamp || new Date().toISOString(),
          status: 'error',
        }
        const key = `param_${dashboardData.parameter_id}`
        setData(prev => {
          const newMap = new Map(prev)
          newMap.set(key, dashboardData)
          return newMap
        })
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnected(false)
    }

    ws.onclose = () => {
      setConnected(false)
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          // Reconnect logic handled by useEffect
        }
      }, 3000)
    }

    return () => {
      ws.close()
    }
  }, [])

  return { data, connected }
}

