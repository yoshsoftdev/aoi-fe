import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Power, Zap } from 'lucide-react'
import type { Connection } from '@/types'

interface DigitalIOTestPanelProps {
  connection: Connection
  addLog: (message: string, type?: 'info' | 'error' | 'success') => void
}

export function DigitalIOTestPanel({ connection, addLog }: DigitalIOTestPanelProps) {
  const [state, setState] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [pulseDuration, setPulseDuration] = useState('1000')

  const isInput = connection.protocol === 'Digital Input'
  const config = connection.config as any

  useEffect(() => {
    if (autoRefresh && isInput) {
      const interval = setInterval(() => {
        setState(Math.random() > 0.5)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, isInput])

  const handleRead = () => {
    const newState = Math.random() > 0.5
    setState(newState)
    addLog(`Digital Input read: ${newState ? 'HIGH' : 'LOW'}`, 'success')
  }

  const handleToggle = (checked: boolean) => {
    setState(checked)
    addLog(`Digital Output set to: ${checked ? 'HIGH' : 'LOW'}`, 'success')
  }

  const handlePulse = () => {
    setState(true)
    addLog(`Pulse started: ${pulseDuration}ms`, 'info')
    setTimeout(() => {
      setState(false)
      addLog('Pulse completed', 'success')
    }, parseInt(pulseDuration))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isInput ? 'Digital Input Status' : 'Digital Output Control'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <div
                className={`h-24 w-24 rounded-full mx-auto flex items-center justify-center transition-colors ${
                  state ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-muted'
                }`}
              >
                <Power className={`h-12 w-12 ${state ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">{state ? 'HIGH' : 'LOW'}</div>
                <div className="text-sm text-muted-foreground">
                  Channel: {config.channelId || config.pins?.join(', ') || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {isInput ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="autoRefresh">Auto Refresh</Label>
                <Switch id="autoRefresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
              <Button onClick={handleRead} className="w-full" disabled={autoRefresh}>
                Read Current State
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="outputToggle">Output State</Label>
                <Switch id="outputToggle" checked={state} onCheckedChange={handleToggle} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pulseDuration">Pulse Duration (ms)</Label>
                <Input
                  id="pulseDuration"
                  type="number"
                  min="100"
                  step="100"
                  value={pulseDuration}
                  onChange={(e) => setPulseDuration(e.target.value)}
                />
              </div>

              <Button onClick={handlePulse} variant="secondary" className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Send Pulse
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

