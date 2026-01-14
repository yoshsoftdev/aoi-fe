import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Upload } from 'lucide-react'
import type { Connection } from '@/types'
import { testConnectionService } from '@/services/testConnectionService'

import type { RawDataField } from '@/types'

interface SNMPTestPanelProps {
  connection: Connection
  addLog: (message: string, type?: 'info' | 'error' | 'success') => void
  onRawDataReceived?: (
    data: RawDataField[],
    config?: {
      oid?: string
    }
  ) => void
  onTestResult?: (result: string) => void
}

export function SNMPTestPanel({ connection, addLog, onRawDataReceived, onTestResult }: SNMPTestPanelProps) {
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
          community: config.community || '', // Use community from config, don't default to 'public'
          version: config.version || 'v2c',
          oid: oid,
        },
      })

      if (result.connected && result.raw_value !== undefined) {
        const isString = typeof result.raw_value === 'string'
        const responseText = `OID: ${oid}\nValue: ${result.raw_value}\nType: ${isString ? 'STRING' : 'NUMERIC'}\nMessage: ${result.message}\nTimestamp: ${new Date().toISOString()}`
        setResponse(responseText)
        addLog(`SNMP GET successful: ${result.raw_value} (${isString ? 'STRING' : 'NUMERIC'})`, 'success')
        
        // Set test result for button visibility
        if (onTestResult) {
          onTestResult(responseText)
        }
        
        // Pass raw data to parent for data mapping
        // Include type information for string mapping
        if (onRawDataReceived) {
          const rawDataFields: RawDataField[] = [
            {
              id: `${connection.id}-${oid}`,
              name: `OID ${oid}`,
              value: isString ? result.raw_value : (typeof result.raw_value === 'number' ? result.raw_value : parseFloat(String(result.raw_value)) || 0),
              timestamp: new Date(),
              source: `${connection.name} (OID: ${oid})`,
              // Add type info for string detection
              type: isString ? 'string' : 'numeric',
            }
          ]
          onRawDataReceived(rawDataFields, { 
            oid,
          })
        }
      } else {
        const errorMsg = `${result.message}${result.details ? ` - ${result.details}` : ''}`
        setResponse(`Error: ${errorMsg}`)
        addLog(`SNMP GET failed: ${errorMsg}`, 'error')
        
        // Set error result
        if (onTestResult) {
          onTestResult(`Error: ${errorMsg}`)
        }
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
          <CardTitle className="text-base">Operasi SNMP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oid">Object Identifier (OID)</Label>
            <Input id="oid" placeholder="1.3.6.1.2.1.1.1.0" value={oid} onChange={(e) => setOid(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              OID umum: 1.3.6.1.2.1.1.1.0 (sysDescr), 1.3.6.1.2.1.1.3.0 (sysUpTime)
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGet} disabled={isLoading || !oid} variant="default" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? 'Mengambil...' : 'GET'}
            </Button>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setValue">Nilai Set</Label>
              <Input
                id="setValue"
                placeholder="Masukkan nilai untuk diset"
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
              {isLoading ? 'Menyetel...' : 'SET'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respon</CardTitle>
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

