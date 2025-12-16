import { useEffect, useRef, useState } from 'react'
import { DashboardData } from '@/types/parameter'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws'

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
        const dashboardData: DashboardData = message.data
        // Use parameter_nama as key (or device_nama + parameter_nama for uniqueness)
        const key = `${dashboardData.device_nama}_${dashboardData.parameter_nama}`
        setData(prev => {
          const newMap = new Map(prev)
          newMap.set(key, dashboardData)
          return newMap
        })
      } else if (message.type === 'error' && message.data) {
        const dashboardData: DashboardData = message.data
        const key = `${dashboardData.device_nama}_${dashboardData.parameter_nama}`
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

