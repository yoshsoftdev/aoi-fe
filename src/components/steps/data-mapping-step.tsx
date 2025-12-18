import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Calculator, AlertCircle, ArrowRight, Save, Loader2 } from 'lucide-react'
import type { RawDataField, MappingConfig, MappedValue, Connection } from '@/types'
import { mappingService } from '@/services/mappingService'

interface DataMappingStepProps {
  rawData: RawDataField[]
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void
  onSave: (mappedValues: MappedValue[]) => void
  activeConnection: Connection
  testConfig?: {
    slaveId?: number
    functionCode?: number
    registerAddress?: number
    quantity?: number
    dataType?: string
    byteOrder?: string
    oid?: string
  } | null
  onSaveSuccess: () => void
}

export function DataMappingStep({
  rawData,
  addLog,
  onSave,
  activeConnection,
  testConfig,
  onSaveSuccess,
}: DataMappingStepProps) {
  const [mappings, setMappings] = useState<MappingConfig[]>([])
  const [mappedValues, setMappedValues] = useState<MappedValue[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const hasRawData = rawData.length > 0

  const addMapping = () => {
    const newMapping: MappingConfig = {
      id: Date.now().toString(),
      outputName: `Output_${mappings.length + 1}`,
      operation: 'add',
      operands: [],
      enabled: true,
      formula: '',
    }
    setMappings([...mappings, newMapping])
  }

  const removeMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id))
    setMappedValues(mappedValues.filter((v) => v.id !== id))
  }

  const updateMapping = (id: string, updates: Partial<MappingConfig>) => {
    setMappings(mappings.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }

  const evaluateFormula = (formula: string, dataMap: Map<string, number>): number => {
    try {
      let expression = formula.trim()
      if (!expression) {
        return 0
      }

      // Replace field names with their values
      // Handle both exact matches and partial matches (e.g., "Slave 6 Addr 4" matches "Slave 6 Addr 4")
      dataMap.forEach((value, key) => {
        // Escape special regex characters in key
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Replace all occurrences of the key with its value
        const regex = new RegExp(escapedKey, 'g')
        expression = expression.replace(regex, value.toString())
      })

      // Evaluate the mathematical expression
      const result = new Function(`'use strict'; return (${expression})`)()
      const numResult = typeof result === 'number' && !isNaN(result) ? result : 0
      
      // Round to exactly 3 decimal places using parseFloat with toFixed
      return parseFloat(numResult.toFixed(3))
    } catch (error) {
      throw new Error(`Invalid formula: ${error instanceof Error ? error.message : 'Syntax error'}`)
    }
  }

  const executeMappings = () => {
    const results: MappedValue[] = []

    const dataMap = new Map<string, number>()
    rawData.forEach((field) => {
      dataMap.set(field.name, field.value)
    })

    for (const mapping of mappings) {
      if (!mapping.enabled) continue

      try {
        if (!mapping.formula || mapping.formula.trim() === '') {
          results.push({
            id: mapping.id,
            outputName: mapping.outputName,
            rawValues: [],
            mappedValue: 0,
            formula: mapping.formula,
            error: 'Empty formula',
            timestamp: new Date(),
          })
          continue
        }

        const result = evaluateFormula(mapping.formula, dataMap)

        const usedRawValues = rawData
          .filter((field) => mapping.formula.includes(field.name))
          .map((field) => ({
            name: field.name,
            value: field.value,
          }))

        results.push({
          id: mapping.id,
          outputName: mapping.outputName,
          rawValues: usedRawValues,
          mappedValue: result,
          formula: mapping.formula,
          timestamp: new Date(),
        })

        addLog(`Mapped ${mapping.outputName} = ${parseFloat(result.toFixed(3))}`, 'success')
      } catch (error) {
        results.push({
          id: mapping.id,
          outputName: mapping.outputName,
          rawValues: [],
          mappedValue: 0,
          formula: mapping.formula,
          error: error instanceof Error ? error.message : 'Calculation error',
          timestamp: new Date(),
        })
        addLog(`Error mapping ${mapping.outputName}: ${error}`, 'error')
      }
    }

    setMappedValues(results)
  }

  // Helper function to detect if formula contains field references like "Slave X Addr Y"
  const containsFieldReference = (formula: string): boolean => {
    if (!formula) return false
    const re = /slave\s+\d+.*?(?:addr|address)\s+\d+/i
    return re.test(formula)
  }

  // Helper function to extract field references from formula
  const extractFieldReferences = (formula: string): string[] => {
    if (!formula) return []
    const re = /slave\s+\d+.*?(?:addr|address)\s+\d+/gi
    const matches = formula.match(re) || []
    // Get unique field references
    return [...new Set(matches.map(m => m.trim()))]
  }

  // Helper function to normalize formula expression
  // Replace field references with variable names (a, b, c, ...)
  const normalizeExpression = (formula: string, fieldRefs: string[]): { expression: string; variables: Array<{ name: string; fieldRef: string }> } => {
    let expression = formula
    const variables: Array<{ name: string; fieldRef: string }> = []
    const varNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
    
    // Get unique field references
    const uniqueFieldRefs = [...new Set(fieldRefs)]
    
    uniqueFieldRefs.forEach((fieldRef, index) => {
      const varName = varNames[index % varNames.length]
      // Escape special regex characters
      const escaped = fieldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'gi')
      expression = expression.replace(regex, varName)
      
      variables.push({
        name: varName,
        fieldRef: fieldRef
      })
    })
    
    return { expression, variables }
  }

  const saveMappings = async () => {
    if (mappedValues.length === 0) {
      addLog('No mapped values to save', 'warning')
      return
    }

    if (!activeConnection) {
      addLog('No active connection', 'error')
      return
    }

    setIsSaving(true)
    try {
      // Check if connection.id is numeric (from DB) or string (local)
      const koneksiId = typeof activeConnection.id === 'string' && /^\d+$/.test(activeConnection.id)
        ? parseInt(activeConnection.id, 10)
        : typeof activeConnection.id === 'number'
          ? activeConnection.id
          : undefined

      // Build mappings array with new format
      const mappings: Array<{
        type?: 'raw' | 'formula'
        outputName: string
        formula?: string
        expression?: string
        variables?: Array<{ name: string; source_parameter_name: string }>
        slaveId?: number
        functionCode?: number
        registerAddress?: number
        quantity?: number
        dataType?: string
        byteOrder?: string
        oid?: string
      }> = []

      // Track created raw parameters: fieldRef -> parameterName
      const fieldRefToParamName: Map<string, string> = new Map()

      // First pass: Create RAW parameters
      for (const mv of mappedValues) {
        const hasModbusConfig = testConfig && (
          (testConfig.slaveId !== undefined && testConfig.registerAddress !== undefined) ||
          testConfig.oid !== undefined
        )
        const hasFieldRef = containsFieldReference(mv.formula)

        if (hasModbusConfig && hasFieldRef) {
          // This mapping has both Modbus config AND formula with field reference
          // Create RAW parameter first, then FORMULA parameter will reference it
          const fieldRefs = extractFieldReferences(mv.formula)
          
          // Create RAW parameter for each unique field reference
          for (const fieldRef of fieldRefs) {
            if (!fieldRefToParamName.has(fieldRef)) {
              // Generate parameter name from field reference
              // e.g., "Slave 4 Addr 10" -> "slave_4_addr_10"
              const rawParamName = `${mv.outputName}_raw_${fieldRef.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`
              fieldRefToParamName.set(fieldRef, rawParamName)

              mappings.push({
                type: 'raw',
                outputName: rawParamName,
                ...(testConfig.slaveId !== undefined && { slaveId: testConfig.slaveId }),
                ...(testConfig.functionCode !== undefined && { functionCode: testConfig.functionCode }),
                ...(testConfig.registerAddress !== undefined && { registerAddress: testConfig.registerAddress }),
                ...(testConfig.quantity !== undefined && { quantity: testConfig.quantity }),
                ...(testConfig.dataType && { dataType: testConfig.dataType }),
                ...(testConfig.byteOrder && { byteOrder: testConfig.byteOrder }),
                ...(testConfig.oid && { oid: testConfig.oid }),
              })
            }
          }
        } else if (hasModbusConfig && !hasFieldRef) {
          // RAW parameter without field reference (simple formula or no formula)
          mappings.push({
            type: 'raw',
            outputName: mv.outputName,
            ...(mv.formula && { formula: mv.formula }), // Simple formula like "value * 2"
            ...(testConfig.slaveId !== undefined && { slaveId: testConfig.slaveId }),
            ...(testConfig.functionCode !== undefined && { functionCode: testConfig.functionCode }),
            ...(testConfig.registerAddress !== undefined && { registerAddress: testConfig.registerAddress }),
            ...(testConfig.quantity !== undefined && { quantity: testConfig.quantity }),
            ...(testConfig.dataType && { dataType: testConfig.dataType }),
            ...(testConfig.byteOrder && { byteOrder: testConfig.byteOrder }),
            ...(testConfig.oid && { oid: testConfig.oid }),
          })
        }
      }

      // Second pass: Create FORMULA parameters
      for (const mv of mappedValues) {
        const hasFieldRef = containsFieldReference(mv.formula)
        const hasModbusConfig = testConfig && (
          (testConfig.slaveId !== undefined && testConfig.registerAddress !== undefined) ||
          testConfig.oid !== undefined
        )

        if (hasFieldRef) {
          // This is a FORMULA parameter
          const fieldRefs = extractFieldReferences(mv.formula)
          const { expression, variables } = normalizeExpression(mv.formula, fieldRefs)

          // Update variables to use the correct parameter names from fieldRefToParamName map
          const updatedVariables = variables.map(v => {
            const paramName = fieldRefToParamName.get(v.fieldRef)
            if (paramName) {
              return {
                name: v.name,
                source_parameter_name: paramName
              }
            }
            
            // Fallback: generate parameter name from field reference
            const fallbackParamName = v.fieldRef.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            return {
              name: v.name,
              source_parameter_name: fallbackParamName
            }
          })

          mappings.push({
            type: 'formula',
            outputName: mv.outputName,
            expression: expression,
            variables: updatedVariables
          })
        } else if (!hasModbusConfig && mv.formula) {
          // Formula without Modbus config - this might reference existing parameters
          // For now, we'll skip it or show a warning
          addLog(`Warning: Formula "${mv.formula}" without Modbus config - skipping. Please ensure referenced parameters exist.`, 'warning')
        }
      }

      // Build request payload
      const request = {
        connection: {
          name: activeConnection.name,
          protocol: activeConnection.protocol,
          config: activeConnection.config,
        },
        ...(koneksiId && { koneksi_id: koneksiId }),
        mappings: mappings,
      }

      const response = await mappingService.save(request)

      if (response.success) {
        addLog(
          `Successfully saved ${response.data.parameters_count} parameters for connection "${response.data.koneksi_name}"`,
          'success'
        )
        // Update local state for immediate UI feedback
        onSave(mappedValues)
        // Wait a moment for backend to process and WebSocket to update
        setTimeout(() => {
          onSaveSuccess()
        }, 1000)
      } else {
        addLog('Failed to save mappings', 'error')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      addLog(`Save failed: ${errorMessage}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Step 3: Data Mapping</h2>
          <p className="text-sm text-muted-foreground mt-1">Transform raw data using custom formulas</p>
        </div>
        <Button onClick={addMapping} disabled={!hasRawData}>
          <Plus className="h-4 w-4 mr-2" />
          Add Mapping
        </Button>
      </div>

      {!hasRawData && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">No raw data available</p>
              <p className="text-sm text-muted-foreground">
                Please execute a test operation to generate raw data first
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasRawData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw Data Sources</CardTitle>
                <CardDescription>Click field names to copy for use in formulas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rawData.map((field) => (
                    <button
                      key={field.id}
                      onClick={() => {
                        navigator.clipboard.writeText(field.name)
                        addLog(`Copied "${field.name}" to clipboard`, 'info')
                      }}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{field.name}</p>
                        <p className="text-xs text-muted-foreground">{field.source}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold text-primary break-all">
                          {(() => {
                            // Format value with exactly 3 decimal places
                            const val = Number(field.value)
                            if (isNaN(val) || !isFinite(val)) {
                              return '0.000'
                            }
                            
                            // For very large numbers, toFixed might still return scientific notation
                            // So we need to handle it manually
                            const fixedStr = val.toFixed(3)
                            
                            // Check if result is still in scientific notation
                            if (fixedStr.includes('e') || fixedStr.includes('E')) {
                              // Parse scientific notation and extract only the base part
                              const parts = fixedStr.split(/[eE]/)
                              const base = parts[0]
                              const baseNum = parseFloat(base)
                              
                              // Return only the base with 3 decimal places (without exponent)
                              // This will show as "1.190" for very large numbers like 1.190e+25
                              return baseNum.toFixed(3)
                            }
                            
                            // Normal number, remove trailing zeros but keep at least .000 if needed
                            const withoutTrailingZeros = fixedStr.replace(/\.?0+$/, '')
                            return withoutTrailingZeros || '0'
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground">{field.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Example Formulas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs font-mono text-muted-foreground">
                  <p>(Slave 1 Addr 7 + Slave 1 Addr 8) / 10</p>
                  <p>Slave 2 Addr 0 * 0.5 + 273.15</p>
                  <p>(Slave 1 Addr 5 - 32) * 5 / 9</p>
                  <p className="text-xs text-muted-foreground mt-2 font-sans">
                    Supports: +, -, *, /, ( ), numbers
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <Card key={mapping.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Input
                          value={mapping.outputName}
                          onChange={(e) => updateMapping(mapping.id, { outputName: e.target.value })}
                          className="text-base font-semibold h-8 mb-2"
                          placeholder="Output variable name"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={mapping.enabled}
                          onCheckedChange={(enabled) => updateMapping(mapping.id, { enabled })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMapping(mapping.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Formula</Label>
                      <Textarea
                        value={mapping.formula}
                        onChange={(e) => updateMapping(mapping.id, { formula: e.target.value })}
                        placeholder="e.g., (Slave 1 Addr 7 + Slave 1 Addr 8) / 10"
                        className="font-mono text-sm"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Copy field names from the left panel and use +, -, *, /, ( )
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {mappings.length > 0 && (
              <Button onClick={executeMappings} className="w-full" disabled={mappings.every((m) => !m.enabled)}>
                <Calculator className="h-4 w-4 mr-2" />
                Execute Mappings
              </Button>
            )}

            {mappedValues.length > 0 && (
              <Button onClick={saveMappings} className="w-full" variant="default" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save to Dashboard
                  </>
                )}
              </Button>
            )}

            {mappedValues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mapped Results</CardTitle>
                  <CardDescription>Processed values after transformation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mappedValues.map((result) => (
                      <div key={result.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{result.outputName}</p>
                            <p className="text-xs text-muted-foreground mt-1 font-mono">{result.formula}</p>
                          </div>
                          {result.error ? (
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">{result.error}</span>
                            </div>
                          ) : (
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">
                                {(() => {
                                  // Format with 3 decimal places, avoiding scientific notation
                                  const val = result.mappedValue
                                  if (Math.abs(val) >= 1e6 || (Math.abs(val) < 0.001 && val !== 0)) {
                                    return val.toFixed(3)
                                  }
                                  const formatted = val.toFixed(3)
                                  return formatted.replace(/\.?0+$/, '') || '0'
                                })()}
                              </p>
                            </div>
                          )}
                        </div>
                        {result.rawValues.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                            <span>Used:</span>
                            {result.rawValues.map((rv, i) => (
                              <span key={i} className="font-mono">
                                {rv.name}={rv.value}
                                {i < result.rawValues.length - 1 && <ArrowRight className="inline h-3 w-3 mx-1" />}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

