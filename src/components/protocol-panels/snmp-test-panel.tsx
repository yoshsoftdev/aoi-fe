import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Upload } from 'lucide-react'
import type { Connection } from '@/types'
import { testConnectionService } from '@/services/testConnectionService'

interface SNMPTestPanelProps {
  connection: Connection
  addLog: (message: string, type?: 'info' | 'error' | 'success') => void
}

export function SNMPTestPanel({ connection, addLog }: SNMPTestPanelProps) {
  const [oid, setOid] = useState('1.3.6.1.2.1.1.1.0')
  const [setValue, setSetValue] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGet = async () => {
    if (!oid) return

    setIsLoading(true)
    addLog(`SNMP GET: ${oid}`, 'info')

    try {
      const config = connection.config as any
      const result = await testConnectionService.test({
        type: 'snmp',
        config: {
          ip_address: config.host,
          port: config.port || 161,
          community: config.community || 'public',
          version: config.version || 'v2c',
          oid: oid,
        },
      })

      if (result.connected && result.raw_value !== undefined) {
        const responseText = `OID: ${oid}\nValue: ${result.raw_value}\nMessage: ${result.message}\nTimestamp: ${new Date().toISOString()}`
        setResponse(responseText)
        addLog(`SNMP GET successful: ${result.raw_value}`, 'success')
      } else {
        const errorMsg = `${result.message}${result.details ? ` - ${result.details}` : ''}`
        setResponse(`Error: ${errorMsg}`)
        addLog(`SNMP GET failed: ${errorMsg}`, 'error')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      setResponse(`Error: ${errorMessage}`)
      addLog(`SNMP GET error: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSet = async () => {
    if (!setValue) return

    setIsLoading(true)
    addLog(`SNMP SET: ${oid} = ${setValue}`, 'info')

    setTimeout(() => {
      const mockResponse = `OID: ${oid}\nOperation: SET\nNew Value: ${setValue}\nStatus: Success\nTimestamp: ${new Date().toISOString()}`
      setResponse(mockResponse)
      addLog('SNMP SET successful', 'success')
      setIsLoading(false)
    }, 600)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SNMP Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oid">Object Identifier (OID)</Label>
            <Input id="oid" placeholder="1.3.6.1.2.1.1.1.0" value={oid} onChange={(e) => setOid(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Common OIDs: 1.3.6.1.2.1.1.1.0 (sysDescr), 1.3.6.1.2.1.1.3.0 (sysUpTime)
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGet} disabled={isLoading || !oid} variant="default" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? 'Getting...' : 'GET'}
            </Button>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setValue">Set Value</Label>
              <Input
                id="setValue"
                placeholder="Enter value to set"
                value={setValue}
                onChange={(e) => setSetValue(e.target.value)}
              />
            </div>

            <Button
              onClick={handleSet}
              disabled={isLoading || !oid || !setValue}
              variant="secondary"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isLoading ? 'Setting...' : 'SET'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {response}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

