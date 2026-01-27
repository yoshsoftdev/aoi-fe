import { useEffect, useRef, useState, useMemo } from 'react'
import { useWebSocket } from './useWebSocket'
import type { DashboardData } from '@/types/parameter'

export interface HistoryDataPoint {
  timestamp: Date
  value: number
  status: string
}

interface UseParameterHistoryOptions {
  parameterId?: number
  maxDataPoints?: number // Maximum number of data points to keep (default: 100)
}

/**
 * Hook untuk mengumpulkan data historis dari WebSocket untuk parameter tertentu
 * Data akan terus diupdate setiap kali WebSocket menerima update untuk parameter tersebut
 */
export const useParameterHistory = (options: UseParameterHistoryOptions = {}) => {
  const { parameterId, maxDataPoints = 100 } = options
  const { data: wsData } = useWebSocket()
  const [history, setHistory] = useState<HistoryDataPoint[]>([])
  const lastTimestampRef = useRef<string | null>(null)

  // Get current parameter data using useMemo to avoid unnecessary re-renders
  const currentData = useMemo(() => {
    if (!parameterId) return null
    const key = `param_${parameterId}`
    return wsData.get(key) || null
  }, [parameterId, wsData])

  useEffect(() => {
    if (!parameterId) {
      setHistory([])
      lastTimestampRef.current = null
      return
    }

    if (!currentData) {
      return
    }

    // Check if this is a new update (by comparing timestamp)
    const currentTimestamp = currentData.timestamp
    if (lastTimestampRef.current === currentTimestamp) {
      // Same timestamp, skip update
      return
    }

    // Convert value to number
    let numericValue = 0
    if (currentData.value !== null && currentData.value !== undefined) {
      if (typeof currentData.value === 'number') {
        numericValue = currentData.value
      } else if (typeof currentData.value === 'string') {
        const numValue = parseFloat(currentData.value)
        numericValue = isNaN(numValue) ? 0 : numValue
      } else {
        numericValue = Number(currentData.value) || 0
      }
    }

    // Create new data point
    const newPoint: HistoryDataPoint = {
      timestamp: new Date(currentTimestamp),
      value: numericValue,
      status: currentData.status || 'offline',
    }

    // Add to history
    setHistory(prev => {
      const updated = [...prev]
      
      // Check if this timestamp already exists (avoid duplicates)
      const exists = updated.some(
        point => point.timestamp.getTime() === newPoint.timestamp.getTime()
      )
      
      if (!exists) {
        updated.push(newPoint)
        
        // Keep only last maxDataPoints
        if (updated.length > maxDataPoints) {
          updated.shift() // Remove oldest
        }
      }
      
      return updated
    })

    // Update last timestamp
    lastTimestampRef.current = currentTimestamp
  }, [parameterId, currentData, maxDataPoints])

  // Reset history when parameterId changes
  useEffect(() => {
    setHistory([])
    lastTimestampRef.current = null
  }, [parameterId])

  return {
    history,
    currentValue: history.length > 0 ? history[history.length - 1] : null,
    dataPointCount: history.length,
  }
}

