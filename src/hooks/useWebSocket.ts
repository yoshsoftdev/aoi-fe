import { useEffect, useRef, useState } from 'react'
import type { DashboardData } from '@/types'
import { parameterService } from '@/services/parameterService'
import { snapsService } from '@/services/snapsService'
import type { Parameter } from '@/types/parameter'
import { useToast } from '@/contexts/ToastContext'

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
  return 'ws://localhost:8071/api/v1/ws'
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
  const { showToast } = useToast()

  // CRITICAL: Load snapshot from cache first, then load parameter list as fallback
  // This ensures parameters have values immediately without waiting for WebSocket
  // Using useEffect + fetch directly to avoid dependency on QueryClientProvider
  useEffect(() => {
    if (initializedRef.current) return // Already initialized
    
    const loadInitialData = async () => {
      try {
        // Step 1: Fetch snapshot from cache (contains current values)
        let snapshotData: Map<string, DashboardData> = new Map()
        try {
          const snaps = await snapsService.getAll()
          console.log(`[WebSocket] Loaded ${snaps.length} parameter snapshots from cache`)
          
          snaps.forEach((snap) => {
            const key = `param_${snap.parameter_id}`
            // Convert value to number, default to 0 if null/undefined
            let value = 0
            if (snap.value !== null && snap.value !== undefined) {
              if (typeof snap.value === 'number') {
                value = snap.value
              } else if (typeof snap.value === 'string') {
                const numValue = parseFloat(snap.value)
                value = isNaN(numValue) ? 0 : numValue
              } else {
                value = Number(snap.value) || 0
              }
            }
            
            snapshotData.set(key, {
              parameter_id: snap.parameter_id,
              device_nama: snap.device_nama || 'All Devices',
              parameter_nama: snap.parameter_nama || `Parameter ${snap.parameter_id}`,
              value: value,
              timestamp: snap.timestamp || new Date().toISOString(),
              status: snap.status || 'offline',
            })
          })
          
          console.log(`[WebSocket] Initialized ${snapshotData.size} parameters from snapshot cache`)
        } catch (snapError) {
          console.warn('[WebSocket] Failed to load snapshot from cache, falling back to parameter list:', snapError)
        }
        
        // Step 2: Load parameter list from API as fallback/backup
        // This ensures parameters remain visible even when device is offline
        try {
          const allParameters = await parameterService.getAll()
          
          if (allParameters.length === 0) {
            console.log('[WebSocket] No parameters found in database')
            // If we have snapshot data, use it; otherwise set empty map
            if (snapshotData.size > 0) {
              setData(snapshotData)
              initializedRef.current = true
            }
            return
          }
          
          // Merge parameter list with snapshot data
          // Parameters from snapshot take precedence (they have values)
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
              
              // Only add if not already in snapshot data
              if (!snapshotData.has(key)) {
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
                snapshotData.set(key, {
                  parameter_id: param.id,
                  device_nama: deviceNama,
                  parameter_nama: param.nama || `Parameter ${param.id}`,
                  value: 0, // Default to 0 until WebSocket updates
                  timestamp: new Date().toISOString(),
                  status: 'offline', // Default to offline until WebSocket confirms online
                })
              }
            }
          })
          
          console.log(`[WebSocket] Merged parameter list: total ${snapshotData.size} parameters initialized`)
        } catch (paramError) {
          console.error('[WebSocket] Failed to load parameters from API:', paramError)
          // If we have snapshot data, still use it
          if (snapshotData.size > 0) {
            console.log('[WebSocket] Using snapshot data only due to parameter load failure')
          }
        }
        
        setData(snapshotData)
        initializedRef.current = true
        console.log(`[WebSocket] Final initialization: ${snapshotData.size} parameters ready`)
      } catch (error) {
        console.error('[WebSocket] Failed to load initial data:', error)
        // Don't block WebSocket connection if loading fails
      }
    }
    
    loadInitialData()
  }, []) // Only run once on mount

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      console.log('[WebSocket] Connected successfully')
      // Subscribe to all parameters
      ws.send(JSON.stringify({
        type: 'subscribe',
        parameter_ids: null,
      }))
    }
    
    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
    }
    
    ws.onclose = () => {
      setConnected(false)
      console.log('[WebSocket] Connection closed')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        // Debug logging for alarm messages
        if (message.type === 'alarm') {
          console.log('[WebSocket] Received alarm message:', message)
        }
        
        // Handle alarm notifications (alarm created/updated)
        if (message.type === 'alarm' && message.data) {
          const alarmData = message.data
          const workflowName = alarmData.workflow_name || 'Unknown Workflow'
          const alarmMessage = alarmData.message || 'Alarm triggered'
          
          console.log('[WebSocket] Processing alarm:', { workflowName, alarmMessage })
          
          // Show toast notification (internal popup, no browser permission needed)
          // duration: 0 means notification stays until manually closed
          try {
            showToast({
              title: `Alarm: ${workflowName}`,
              message: alarmMessage,
              type: 'warning',
              duration: 0, // Stay until user closes manually
            })
            console.log('[WebSocket] Toast notification shown')
          } catch (toastError) {
            console.error('[WebSocket] Failed to show toast:', toastError)
          }
          
          // Also log to console
          console.warn(`[ALARM] ${workflowName}: ${alarmMessage}`)
          
          // Trigger custom event for alarm list component to refresh
          window.dispatchEvent(new CustomEvent('alarm-updated', { detail: { workflowId: alarmData.workflow_id } }))
          
          return
        }
        
        // Handle alarm removal notifications
        if (message.type === 'alarm_removed' && message.data) {
          const alarmData = message.data
          const workflowId = alarmData.workflow_id
          
          // Remove toast notification if exists
          // Note: We can't directly remove specific toast, but we can trigger refresh
          console.log(`[ALARM] Alarm removed for workflow ${workflowId}`)
          
          // Trigger custom event for alarm list component to refresh
          window.dispatchEvent(new CustomEvent('alarm-removed', { detail: { workflowId } }))
          
          return
        }
        
        // Handle batch updates (optimized for many parameters)
        // Format: {"batch":true,"data":{"count":N,"updates":[...]},"type":"data_update_batch"}
        if (message.type === 'data_update_batch' && message.batch === true && message.data) {
        const batchData = message.data as { updates?: DashboardData[]; count?: number }
        const updates = batchData.updates || []
        
        if (updates.length === 0) {
          return
        }
        
        console.log(`[WebSocket] Received batch update: ${updates.length} parameters`)
        
        setData(prev => {
          const newMap = new Map(prev)
          
          // Process all updates in batch
          updates.forEach((dashboardData: DashboardData) => {
            // Ensure parameter_id exists
            if (!dashboardData.parameter_id) {
              console.warn('[WebSocket] Received batch update without parameter_id, skipping')
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
            // CRITICAL: Always update, never remove parameter from Map
            newMap.set(key, {
              ...dashboardData,
              timestamp: timestampStr,
            })
          })
          
          return newMap
        })
      } else if (message.type === 'data_update' && message.data && message.batch !== true) {
        // Handle single update
        // Format: {"data":{...},"type":"data_update"}
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
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error, event.data)
      }
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
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

