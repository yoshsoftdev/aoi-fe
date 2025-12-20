import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, XCircle, Send } from 'lucide-react'
import { writeService } from '@/services/writeService'
import { formatNumber } from '@/utils/formatters'
import type { Parameter } from '@/types/parameter'

interface ExecuteWriteStepProps {
  parameter: Parameter
  config: {
    slaveId: number
    functionCode: number
    registerAddress: number
    quantity: number
    dataType: string
    byteOrder: string
  }
  writeMode: 'preset' | 'manual'
  presetId?: number
  registerValues?: number[]
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void
  onWriteComplete?: (success: boolean, readBackValue?: number) => void
  onReset?: () => void
}

export function ExecuteWriteStep({
  parameter,
  config,
  writeMode,
  presetId,
  registerValues,
  addLog,
  onWriteComplete,
  onReset,
}: ExecuteWriteStepProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [writeResult, setWriteResult] = useState<{
    success: boolean
    message: string
    readBackValue?: number
    error?: string
  } | null>(null)

  const handleExecute = async () => {
    setIsExecuting(true)
    setWriteResult(null)

    try {
      const response = await writeService.execute(
        parameter.id,
        writeMode,
        presetId,
        registerValues
      )

      setWriteResult({
        success: response.success,
        message: response.message,
        readBackValue: response.data?.read_back_value,
        error: response.error,
      })

      if (response.success) {
        addLog(`Write successful: ${response.message}`, 'success')
        if (response.data?.read_back_value !== undefined) {
          addLog(`Read-back value: ${formatNumber(response.data.read_back_value, 2)} ${parameter.unit || ''}`, 'info')
        }
      } else {
        addLog(`Write failed: ${response.error || response.message}`, 'error')
      }

      if (onWriteComplete) {
        onWriteComplete(response.success, response.data?.read_back_value)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      setWriteResult({
        success: false,
        message: 'Write failed',
        error: errorMessage,
      })
      addLog(`Write error: ${errorMessage}`, 'error')
      if (onWriteComplete) {
        onWriteComplete(false)
      }
    } finally {
      setIsExecuting(false)
      setShowConfirmDialog(false)
    }
  }

  const handleShowConfirm = () => {
    setShowConfirmDialog(true)
  }

  const formatRegisterValues = () => {
    if (writeMode === 'manual' && registerValues) {
      return registerValues.map((v, i) => ({
        offset: i,
        address: config.registerAddress + i,
        value: v,
      }))
    }
    return []
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Step 4: Execute Write</h2>
        <p className="text-sm text-muted-foreground mt-1">Review and execute the write operation</p>
      </div>

      {/* Write Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Write Summary</CardTitle>
          <CardDescription>Review the write operation details before executing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Parameter</Label>
              <p className="text-sm font-medium text-foreground">{parameter.nama}</p>
            </div>
            {parameter.unit && (
              <div>
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <p className="text-sm font-medium text-foreground">{parameter.unit}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Slave ID</Label>
              <p className="text-sm font-medium text-foreground">{config.slaveId}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Function Code</Label>
              <p className="text-sm font-medium text-foreground">
                {config.functionCode} ({config.functionCode === 6 ? 'Write Single Register' : 'Write Multiple Registers'})
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Register Address</Label>
              <p className="text-sm font-medium text-foreground">
                {config.registerAddress}
                {config.quantity > 1 && ` – ${config.registerAddress + config.quantity - 1}`}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quantity</Label>
              <p className="text-sm font-medium text-foreground">{config.quantity} register(s)</p>
            </div>
          </div>

          {/* Register Values Preview */}
          {writeMode === 'manual' && registerValues && (
            <div className="mt-4 pt-4 border-t border-border">
              <Label className="text-xs text-muted-foreground mb-2 block">Register Values</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Offset</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Address</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formatRegisterValues().map((reg) => (
                      <tr key={reg.offset} className="border-t border-border">
                        <td className="px-3 py-2 text-sm font-mono text-foreground">+{reg.offset}</td>
                        <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{reg.address}</td>
                        <td className="px-3 py-2 text-sm font-mono font-semibold text-foreground">{reg.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {writeMode === 'preset' && (
            <div className="mt-4 pt-4 border-t border-border">
              <Label className="text-xs text-muted-foreground mb-2 block">Preset Mode</Label>
              <Badge variant="outline">Using preset configuration</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Write Result */}
      {writeResult && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={`rounded-lg border p-4 ${
                writeResult.success
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-red-500 bg-red-50 dark:bg-red-950'
              }`}
            >
              <div className="flex items-start gap-3">
                {writeResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <p
                    className={`font-medium ${
                      writeResult.success
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-red-900 dark:text-red-100'
                    }`}
                  >
                    {writeResult.message}
                  </p>
                  {writeResult.error && (
                    <p className="text-sm text-red-700 dark:text-red-300">{writeResult.error}</p>
                  )}
                  {writeResult.success && writeResult.readBackValue !== undefined && (
                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Read-back value: <span className="font-mono font-semibold">{formatNumber(writeResult.readBackValue, 2)}</span>
                        {parameter.unit && ` ${parameter.unit}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onReset} disabled={isExecuting}>
          Start Over
        </Button>
        <Button onClick={handleShowConfirm} disabled={isExecuting || writeResult?.success === true}>
          {isExecuting ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
              Executing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Execute Write
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Write Operation</DialogTitle>
            <DialogDescription>
              You are about to write {config.quantity} register{config.quantity > 1 ? 's' : ''} to the device. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="text-sm font-medium text-foreground">Parameter: {parameter.nama}</div>
              <div className="text-sm text-muted-foreground">
                Slave ID: {config.slaveId} | Function Code: {config.functionCode} | Address: {config.registerAddress}
                {config.quantity > 1 && `-${config.registerAddress + config.quantity - 1}`}
              </div>
              {writeMode === 'manual' && registerValues && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1">Register Values:</div>
                  <div className="font-mono text-sm text-foreground">
                    [{registerValues.map((v, i) => (i > 0 ? ', ' : '') + v).join('')}]
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                Make sure the device is ready to receive this write command. Incorrect values may cause unexpected
                behavior.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isExecuting}>
              Cancel
            </Button>
            <Button onClick={handleExecute} disabled={isExecuting} variant="default">
              {isExecuting ? 'Executing...' : 'Confirm & Execute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

