import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  // String mapping state for SNMP string values
  const [stringMapping, setStringMapping] = useState<{ [key: string]: number }>({})

  const hasRawData = rawData.length > 0
  
  // Check if any raw data field is a string (SNMP string value)
  const hasStringValue = rawData.some(field => field.type === 'string' || typeof field.value === 'string')
  const stringField = rawData.find(field => field.type === 'string' || typeof field.value === 'string')

  const addMapping = () => {
    const newMapping: MappingConfig = {
      id: Date.now().toString(),
      outputName: `Output_${mappings.length + 1}`,
      outputType: 'DIRECT', // Default to DIRECT, but user must explicitly choose
      operation: 'add',
      operands: [],
      enabled: true,
      formula: '',
      sourceField: '',
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
      // Convert value to number (handle string values)
      const numValue = typeof field.value === 'string' 
        ? ((stringMapping[field.value] ?? parseFloat(field.value)) || 0)
        : (typeof field.value === 'number' ? field.value : 0)
      dataMap.set(field.name, numValue)
    })

    for (const mapping of mappings) {
      if (!mapping.enabled) continue

      try {
        if (mapping.outputType === 'DIRECT') {
          // DIRECT: Use source value as-is
          if (!mapping.sourceField || mapping.sourceField.trim() === '') {
            results.push({
              id: mapping.id,
              outputName: mapping.outputName,
              rawValues: [],
              mappedValue: 0,
              formula: 'DIRECT',
              error: 'Source field is required for DIRECT type',
              timestamp: new Date(),
            })
            continue
          }

          const sourceValue = dataMap.get(mapping.sourceField)
          if (sourceValue === undefined) {
            results.push({
              id: mapping.id,
              outputName: mapping.outputName,
              rawValues: [],
              mappedValue: 0,
              formula: 'DIRECT',
              error: `Source field "${mapping.sourceField}" not found`,
              timestamp: new Date(),
            })
            continue
          }

          const numValue = typeof sourceValue === 'number' ? sourceValue : parseFloat(String(sourceValue)) || 0

          results.push({
            id: mapping.id,
            outputName: mapping.outputName,
            rawValues: [{ name: mapping.sourceField, value: numValue }],
            mappedValue: numValue,
            formula: `DIRECT: ${mapping.sourceField}`,
            timestamp: new Date(),
          })

          addLog(`Mapped ${mapping.outputName} = ${parseFloat(numValue.toFixed(3))} (DIRECT from ${mapping.sourceField})`, 'success')
        } else if (mapping.outputType === 'FORMULA') {
          // FORMULA: Calculate using expression
          if (!mapping.formula || mapping.formula.trim() === '') {
            results.push({
              id: mapping.id,
              outputName: mapping.outputName,
              rawValues: [],
              mappedValue: 0,
              formula: mapping.formula,
              error: 'Formula is required for FORMULA type',
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

          addLog(`Mapped ${mapping.outputName} = ${parseFloat(result.toFixed(3))} (FORMULA)`, 'success')
        } else {
          results.push({
            id: mapping.id,
            outputName: mapping.outputName,
            rawValues: [],
            mappedValue: 0,
            formula: '',
            error: 'Output type must be DIRECT or FORMULA',
            timestamp: new Date(),
          })
        }
      } catch (error) {
        results.push({
          id: mapping.id,
          outputName: mapping.outputName,
          rawValues: [],
          mappedValue: 0,
          formula: mapping.formula || '',
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

      // Build mappings array with explicit output_type
      const payloadMappings: Array<{
        output_type: 'DIRECT' | 'FORMULA'
        outputName: string
        source_field?: string
        source_parameter_id?: number
        formula?: string
        expression?: string
        variables?: Array<{ name: string; source_parameter_name: string }>
        source_parameter_ids?: number[]
        slaveId?: number
        functionCode?: number
        registerAddress?: number
        quantity?: number
        dataType?: string
        byteOrder?: string
        oid?: string
        string_mapping?: string // JSON string for SNMP string mapping
      }> = []

      // Track created raw parameters: fieldRef -> parameterName
      const fieldRefToParamName: Map<string, string> = new Map()

      // First pass: Create RAW parameters for FORMULA dependencies
      // If FORMULA references field names, we need to create RAW parameters first
      // Note: We iterate over state mappings, not payloadMappings
      for (const mapping of mappings) {
        if (mapping.outputType === 'FORMULA' && mapping.formula) {
          const hasFieldRef = containsFieldReference(mapping.formula)
          const hasModbusConfig = testConfig && (
            (testConfig.slaveId !== undefined && testConfig.registerAddress !== undefined) ||
            testConfig.oid !== undefined
          )

          if (hasModbusConfig && hasFieldRef) {
            // Extract field references and create RAW parameters for them
            const fieldRefs = extractFieldReferences(mapping.formula)
            
            for (const fieldRef of fieldRefs) {
              if (!fieldRefToParamName.has(fieldRef)) {
                const rawParamName = `${mapping.outputName}_raw_${fieldRef.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`
                fieldRefToParamName.set(fieldRef, rawParamName)

                payloadMappings.push({
                  output_type: 'DIRECT',
                  outputName: rawParamName,
                  source_field: fieldRef,
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
          }
        }
      }

      // Second pass: Create mappings based on output_type
      for (const mapping of mappings) {
        const hasModbusConfig = testConfig && (
          (testConfig.slaveId !== undefined && testConfig.registerAddress !== undefined) ||
          testConfig.oid !== undefined
        )

        if (mapping.outputType === 'DIRECT') {
          // DIRECT: Single source, no formula
          if (!mapping.sourceField) {
            addLog(`Error: Source field is required for DIRECT type in "${mapping.outputName}"`, 'error')
            continue
          }

          if (!hasModbusConfig) {
            addLog(`Error: Modbus config is required for DIRECT type in "${mapping.outputName}"`, 'error')
            continue
          }

          payloadMappings.push({
            output_type: 'DIRECT',
            outputName: mapping.outputName,
            source_field: mapping.sourceField,
            ...(testConfig.slaveId !== undefined && { slaveId: testConfig.slaveId }),
            ...(testConfig.functionCode !== undefined && { functionCode: testConfig.functionCode }),
            ...(testConfig.registerAddress !== undefined && { registerAddress: testConfig.registerAddress }),
            ...(testConfig.quantity !== undefined && { quantity: testConfig.quantity }),
            ...(testConfig.dataType && { dataType: testConfig.dataType }),
            ...(testConfig.byteOrder && { byteOrder: testConfig.byteOrder }),
            ...(testConfig.oid && { oid: testConfig.oid }),
          })
        } else if (mapping.outputType === 'FORMULA') {
          // FORMULA: Calculate using expression
          if (!mapping.formula || mapping.formula.trim() === '') {
            addLog(`Error: Formula is required for FORMULA type in "${mapping.outputName}"`, 'error')
            continue
          }

          const hasFieldRef = containsFieldReference(mapping.formula)
          
          if (hasFieldRef) {
            // Formula with field references - normalize and create variables
            const fieldRefs = extractFieldReferences(mapping.formula)
            const { expression, variables } = normalizeExpression(mapping.formula, fieldRefs)

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

            payloadMappings.push({
              output_type: 'FORMULA',
              outputName: mapping.outputName,
              formula: mapping.formula,
              expression: expression,
              variables: updatedVariables
            })
          } else {
            // Formula without field references - might reference existing parameters
            addLog(`Warning: Formula "${mapping.formula}" in "${mapping.outputName}" does not contain field references. Please ensure referenced parameters exist.`, 'warning')
            payloadMappings.push({
              output_type: 'FORMULA',
              outputName: mapping.outputName,
              formula: mapping.formula,
              expression: mapping.formula, // Use formula as expression if no field refs
            })
          }
        }
      }

      // Validate string mapping if string value exists
      if (hasStringValue && stringField) {
        const mappedValue = stringMapping[String(stringField.value)]
        if (mappedValue === undefined || (mappedValue !== 0 && mappedValue !== 1)) {
          addLog('Error: String mapping is required. Map string value to 0 or 1.', 'error')
          setIsSaving(false)
          return
        }
      }

      // Build request payload
      const request: any = {
        connection: {
          name: activeConnection.name,
          protocol: activeConnection.protocol,
          config: activeConnection.config,
        },
        ...(koneksiId && { koneksi_id: koneksiId }),
        mappings: payloadMappings,
      }

      // Add string mapping for SNMP if exists
      if (hasStringValue && stringField && Object.keys(stringMapping).length > 0) {
        // Add string_mapping to the first SNMP mapping (if OID exists)
        if (testConfig?.oid) {
          // Find first mapping with OID and add string_mapping
          const snmpMapping = payloadMappings.find(m => m.oid === testConfig.oid)
          if (snmpMapping) {
            snmpMapping.string_mapping = JSON.stringify(stringMapping)
          } else {
            // If no mapping found, add to request level
            request.string_mapping = JSON.stringify(stringMapping)
            request.oid = testConfig.oid
          }
        }
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
                          {field.type === 'string' || typeof field.value === 'string' 
                            ? `"${field.value}"` 
                            : (() => {
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
                        {field.type === 'string' && (
                          <p className="text-xs text-orange-500 font-semibold">STRING</p>
                        )}
                        <p className="text-xs text-muted-foreground">{field.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SNMP String Mapping UI */}
            {hasStringValue && stringField && (
              <Card className="border-orange-500">
                <CardHeader>
                  <CardTitle className="text-sm text-orange-600">SNMP String Mapping *</CardTitle>
                  <CardDescription>
                    Map string value "{stringField.value}" to numeric (0 or 1)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>String Value: "{stringField.value}"</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Map to:</Label>
                        <Input
                          type="number"
                          placeholder="0 or 1"
                          value={stringMapping[String(stringField.value)] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value)
                            if (val !== undefined && (val === 0 || val === 1)) {
                              setStringMapping({
                                ...stringMapping,
                                [String(stringField.value)]: val
                              })
                            } else if (val === undefined) {
                              const newMapping = { ...stringMapping }
                              delete newMapping[String(stringField.value)]
                              setStringMapping(newMapping)
                            }
                          }}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Required: Map string to 0 (abnormal) or 1 (normal). Value 0 will force alarmstatus = abnormal.
                    </p>
                    {stringMapping[String(stringField.value)] === undefined && (
                      <p className="text-xs text-red-500">⚠️ String mapping is required</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
                    {/* Output Type Selector */}
                    <div className="space-y-2">
                      <Label>Output Type *</Label>
                      <RadioGroup
                        value={mapping.outputType}
                        onValueChange={(value) => updateMapping(mapping.id, { 
                          outputType: value as 'DIRECT' | 'FORMULA',
                          formula: value === 'DIRECT' ? '' : mapping.formula,
                          sourceField: value === 'FORMULA' ? '' : mapping.sourceField,
                        })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="DIRECT" id={`direct-${mapping.id}`} />
                          <Label htmlFor={`direct-${mapping.id}`} className="cursor-pointer">
                            Direct (use source value as-is)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="FORMULA" id={`formula-${mapping.id}`} />
                          <Label htmlFor={`formula-${mapping.id}`} className="cursor-pointer">
                            Formula (calculate using expression)
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* DIRECT: Source Field Selector */}
                    {mapping.outputType === 'DIRECT' && (
                      <div className="space-y-2">
                        <Label>Source Field *</Label>
                        <select
                          value={mapping.sourceField || ''}
                          onChange={(e) => updateMapping(mapping.id, { sourceField: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select source field...</option>
                          {rawData.map((field) => (
                            <option key={field.id} value={field.name}>
                              {field.name} ({field.value})
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Select a single source field to use its value directly
                        </p>
                      </div>
                    )}

                    {/* FORMULA: Formula Editor */}
                    {mapping.outputType === 'FORMULA' && (
                      <div className="space-y-2">
                        <Label>Formula *</Label>
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
                    )}
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
                                  const val = typeof result.mappedValue === 'number' 
                                    ? result.mappedValue 
                                    : parseFloat(String(result.mappedValue)) || 0
                                  if (isNaN(val) || !isFinite(val)) {
                                    return '0.000'
                                  }
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

