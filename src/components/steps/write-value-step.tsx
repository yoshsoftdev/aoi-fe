import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertCircle, ArrowRight, Power, PowerOff, Play, Info } from 'lucide-react'
import { writeService } from '@/services/writeService'
import type { Parameter } from '@/types/parameter'

interface WriteValueStepProps {
  parameter: Parameter
  config: {
    slaveId: number
    functionCode: number
    registerAddress: number
    quantity: number
    dataType: string
    byteOrder: string
  }
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void
  onValueReady?: (mode: 'preset' | 'manual', presetId?: number, registerValues?: number[]) => void
  onNext?: () => void
}

export function WriteValueStep({ parameter, config, addLog, onValueReady, onNext }: WriteValueStepProps) {
  const [mode, setMode] = useState<'preset' | 'manual'>('manual')
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [manualValues, setManualValues] = useState<number[]>([])

  // Fetch presets for this parameter
  // NOTE: For PRESET mode parameters, preset_value is stored in parameter itself, not in separate presets table
  // This query is kept for backward compatibility but will return empty array
  const { data: presets = [] } = useQuery({
    queryKey: ['presets', parameter.id],
    queryFn: () => writeService.getPresets(parameter.id),
    enabled: false, // Disable query to avoid 404 errors - presets are now in parameter.preset_value
  })

  // Initialize manual values array based on quantity
  useEffect(() => {
    if (config.quantity > 0 && manualValues.length === 0) {
      setManualValues(new Array(config.quantity).fill(0))
    }
  }, [config.quantity, manualValues.length])

  // Reset when mode changes
  useEffect(() => {
    if (mode === 'preset') {
      setSelectedPresetId(null)
    } else {
      setManualValues(new Array(config.quantity).fill(0))
    }
  }, [mode, config.quantity])

  const handleManualValueChange = (index: number, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 65535) {
      const newValues = [...manualValues]
      newValues[index] = numValue
      setManualValues(newValues)
    } else if (value === '') {
      const newValues = [...manualValues]
      newValues[index] = 0
      setManualValues(newValues)
    }
  }

  const handleNext = () => {
    if (mode === 'preset') {
      if (!selectedPresetId) {
        addLog('Please select a preset', 'warning')
        return
      }
      if (onValueReady) {
        onValueReady('preset', selectedPresetId)
      }
    } else {
      // Validate manual values
      if (manualValues.length !== config.quantity) {
        addLog(`Register values count must match quantity (${config.quantity})`, 'error')
        return
      }
      if (onValueReady) {
        onValueReady('manual', undefined, manualValues)
      }
    }

    if (onNext) {
      onNext()
    }
  }

  const canProceed =
    (mode === 'preset' && selectedPresetId !== null) || (mode === 'manual' && manualValues.length === config.quantity)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Step 3: Write Value</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose preset or enter manual register values</p>
      </div>

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Write Mode</CardTitle>
          <CardDescription>Select how to provide the write value</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'preset' | 'manual')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="preset" id="preset" />
              <Label htmlFor="preset" className="cursor-pointer ml-2">
                Preset Value
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual" className="cursor-pointer ml-2">
                Manual Input
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Preset Mode */}
      {mode === 'preset' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Preset</CardTitle>
            <CardDescription>Choose a predefined preset value</CardDescription>
          </CardHeader>
          <CardContent>
            {presets.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">No presets available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create presets in the parameter configuration. Presets allow quick access to common write values.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={selectedPresetId === preset.id ? 'default' : 'outline'}
                    className="justify-start h-auto py-3"
                    onClick={() => setSelectedPresetId(preset.id)}
                  >
                    <div className="flex items-center gap-2">
                      {preset.name === 'START' || preset.name === 'ON' ? (
                        <Power className="h-4 w-4" />
                      ) : preset.name === 'STOP' || preset.name === 'OFF' ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold">{preset.name}</div>
                        {preset.description && (
                          <div className="text-xs text-muted-foreground">{preset.description}</div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Mode */}
      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual Register Values</CardTitle>
            <CardDescription>
              Enter values for {config.quantity} register{config.quantity > 1 ? 's' : ''} (0-65535 each)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config.quantity === 1 ? (
              // Single register input
              <div className="space-y-2">
                <Label htmlFor="register-0">Register Value</Label>
                <Input
                  id="register-0"
                  type="number"
                  min="0"
                  max="65535"
                  value={manualValues[0] || 0}
                  onChange={(e) => handleManualValueChange(0, e.target.value)}
                  placeholder="0-65535"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a value between 0 and 65535 for register address {config.registerAddress}
                </p>
              </div>
            ) : (
              // Multi-register table
              <div className="space-y-4">
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Register Offset
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Address</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualValues.map((value, index) => {
                        const address = config.registerAddress + index
                        return (
                          <tr key={index} className="border-t border-border">
                            <td className="px-4 py-3 text-sm font-mono text-foreground">+{index}</td>
                            <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{address}</td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                max="65535"
                                value={value || 0}
                                onChange={(e) => handleManualValueChange(index, e.target.value)}
                                className="w-32"
                                placeholder="0-65535"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>
                    Writing {config.quantity} register{config.quantity > 1 ? 's' : ''} starting from address{' '}
                    {config.registerAddress} using Function Code {config.functionCode}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!canProceed}>
          Next: Execute Write
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

