import { useEffect, useRef, useState } from 'react'
import type { DashboardData } from '@/types'
import { parameterService } from '@/services/parameterService'
import type { Parameter } from '@/types/parameter'

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
  // Store dashboard data by parameter_id
  const [data, setData] = useState<Map<string, DashboardData>>(new Map())
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const initializedRef = useRef(false)

  // CRITICAL: Load parameter list from API to initialize dashboard
  // This ensures parameters remain visible even when device is offline
  // Using useEffect + fetch directly to avoid dependency on QueryClientProvider
  useEffect(() => {
    if (initializedRef.current) return // Already initialized
    
    const loadParameters = async () => {
      try {
        const allParameters = await parameterService.getAll()
        
        if (allParameters.length === 0) {
          console.log('[WebSocket] No parameters found in database')
          return
        }
        
        const initialData = new Map<string, DashboardData>()
        
        allParameters.forEach((param: Parameter) => {
          // Only include READ parameters with DIRECT, CLEAN, or FORMULA mode
          const isRead = param.direction === 'READ' || (param.direction === undefined && !param.read_write)
          if (!isRead) return
          
          const paramMode = (param as any).parameter_mode || (param as any).parameterMode
          const isFormula = (param as any).is_formula === true || (param as any).isFormula === true
          
          // Include DIRECT, CLEAN, FORMULA parameters
          const shouldInclude = paramMode === 'DIRECT' || 
                               paramMode === 'CLEAN' || 
                               paramMode === 'FORMULA' || 
                               isFormula ||
                               (!paramMode && !isFormula) // Default to DIRECT for backward compatibility
          
          if (shouldInclude) {
            const key = `param_${param.id}`
            // Get device name from device relation (preloaded by backend)
            let deviceNama = 'All Devices'
            if (param.device) {
              // Device relation is preloaded by backend
              deviceNama = (param.device as any).nama || `Device ${param.device_id}` || 'All Devices'
            } else if (param.device_id) {
              // Fallback: use device_id if device relation not loaded
              deviceNama = `Device ${param.device_id}`
            }
            
            // Initialize with default values (will be updated by WebSocket)
            // CRITICAL: Parameter remains visible even when device is offline
            initialData.set(key, {
              parameter_id: param.id,
              device_nama: deviceNama,
              parameter_nama: param.nama || `Parameter ${param.id}`,
              value: 0, // Default to 0 until WebSocket updates
              timestamp: new Date().toISOString(),
              status: 'offline', // Default to offline until WebSocket confirms online
            })
          }
        })
        
        setData(initialData)
        initializedRef.current = true
        console.log(`[WebSocket] Initialized ${initialData.size} parameters from API`)
      } catch (error) {
        console.error('[WebSocket] Failed to load parameters from API:', error)
        // Don't block WebSocket connection if parameter loading fails
      }
    }
    
    loadParameters()
  }, []) // Only run once on mount

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
        
        // Ensure parameter_id exists
        if (!dashboardData.parameter_id) {
          console.warn('[WebSocket] Received data_update without parameter_id, skipping')
          return
        }
        
        // Ensure parameter_nama is not empty
        if (!dashboardData.parameter_nama || dashboardData.parameter_nama === '') {
          dashboardData.parameter_nama = `Parameter ${dashboardData.parameter_id}`
        }
        
        // Ensure device_nama is not empty
        if (!dashboardData.device_nama || dashboardData.device_nama === '') {
          dashboardData.device_nama = 'All Devices'
        }
        
        // Ensure value is never null/undefined (default to 0)
        if (dashboardData.value === null || dashboardData.value === undefined) {
          dashboardData.value = 0
        }
        
        // Ensure status is never empty (default to offline)
        if (!dashboardData.status || dashboardData.status === '') {
          dashboardData.status = 'offline'
        }
        
        // Ensure timestamp is string format
        const timestampStr = typeof dashboardData.timestamp === 'string' 
          ? dashboardData.timestamp 
          : new Date(dashboardData.timestamp).toISOString()
        
        // Use parameter_id as key (more reliable than name)
        const key = `param_${dashboardData.parameter_id}`
        setData(prev => {
          const newMap = new Map(prev)
          // CRITICAL: Always update, never remove parameter from Map
          newMap.set(key, {
            ...dashboardData,
            timestamp: timestampStr,
          })
          return newMap
        })
      } else if (message.type === 'error' && message.data) {
        // Handle error format (if backend sends error in clean format)
        const errorData = message.data
        if (!errorData.parameter_id) {
          console.warn('[WebSocket] Received error without parameter_id, skipping')
          return
        }
        
        const dashboardData: DashboardData = {
          parameter_id: errorData.parameter_id,
          device_nama: errorData.device_nama || 'All Devices',
          parameter_nama: errorData.name || errorData.parameter_nama || `Parameter ${errorData.parameter_id}`,
          value: 0, // Force to 0 on error
          timestamp: errorData.timestamp || new Date().toISOString(),
          status: 'error',
        }
        const key = `param_${dashboardData.parameter_id}`
        setData(prev => {
          const newMap = new Map(prev)
          // CRITICAL: Always update, never remove parameter from Map
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

