import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Globe, Play, Save, Loader2, ChevronRight, ChevronDown, Check } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { httpService } from '@/services/httpService'

export function HTTPParameterRead() {
  const { showToast } = useToast()
  const [curlCommand, setCurlCommand] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [jsonResponse, setJsonResponse] = useState<any>(null)
  const [selectedValueField, setSelectedValueField] = useState<string>('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [parameterName, setParameterName] = useState('')
  const [pollingInterval, setPollingInterval] = useState('60') // Default 60 seconds
  const [isSaving, setIsSaving] = useState(false)

  // Parse curl command to extract URL, headers, etc.
  const parseCurlCommand = (curl: string) => {
    const headers: Record<string, string> = {}

    // Extract Basic Auth (-u username:password or --user username:password)
    // Match: -u "user:pass" or -u user:pass or --user "user:pass"
    const authPatterns = [
      /-u\s+['"]([^'"]+)['"]/,           // -u "user:pass"
      /-u\s+([^\s]+)/,                    // -u user:pass
      /--user\s+['"]([^'"]+)['"]/,       // --user "user:pass"
      /--user\s+([^\s]+)/,                // --user user:pass
    ]

    for (const pattern of authPatterns) {
      const match = curl.match(pattern)
      if (match) {
        const credentials = match[1]
        headers['Authorization'] = `Basic ${btoa(credentials)}`
        break
      }
    }

    // Extract custom headers (-H "Header: Value" or --header "Header: Value")
    const headerPatterns = [
      /-H\s+['"]([^'"]+)['"]/g,           // -H "Header: Value"
      /--header\s+['"]([^'"]+)['"]/g,    // --header "Header: Value"
    ]

    for (const pattern of headerPatterns) {
      const matches = curl.matchAll(pattern)
      for (const match of matches) {
        const headerStr = match[1].trim()
        const colonIndex = headerStr.indexOf(':')
        if (colonIndex > 0) {
          const key = headerStr.substring(0, colonIndex).trim()
          const value = headerStr.substring(colonIndex + 1).trim()
          headers[key] = value
        }
      }
    }

    // Extract URL - find the first occurrence of http:// or https://
    // This is the most reliable way to find the actual URL
    const urlPatterns = [
      /['"](https?:\/\/[^'"]+)['"]/,     // URL in quotes
      /(https?:\/\/[^\s'"]+)/,            // URL without quotes (but not followed by quote)
      /(https?:\/\/[^\s]+)/,              // URL without quotes (any non-space)
    ]

    let url: string | null = null
    for (const pattern of urlPatterns) {
      const match = curl.match(pattern)
      if (match) {
        url = match[1].replace(/['"]/g, '') // Remove quotes if any
        // Validate it's a proper URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
          break
        }
      }
    }

    if (!url) {
      throw new Error('Invalid curl command: URL not found. Please provide a valid URL starting with http:// or https://')
    }

    return { url, headers }
  }

  // Get value from nested object using path
  const getValueByPath = (obj: any, path: string): any => {
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current == null) return undefined
      current = current[part]
    }
    return current
  }

  // Check if path is expanded
  const isExpanded = (path: string) => expandedPaths.has(path)

  // Toggle expand/collapse
  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  // Render JSON tree node
  const renderJsonNode = (obj: any, path: string = '', level: number = 0): JSX.Element | null => {
    if (obj === null || obj === undefined) {
      return null
    }

    const isObject = typeof obj === 'object' && !Array.isArray(obj)
    const isArray = Array.isArray(obj)
    const isLeaf = !isObject && !isArray

    // For leaf nodes (primitive values), show selectable button
    if (isLeaf) {
      const isSelected = selectedValueField === path
      return (
        <div
          key={path}
          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-secondary/50 cursor-pointer"
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setSelectedValueField(path)}
        >
          <span className="text-xs text-muted-foreground font-mono">{path.split('.').pop()}:</span>
          <span className="text-sm text-foreground">
            {typeof obj === 'string' ? `"${obj}"` : String(obj)}
          </span>
          <span className="text-xs text-muted-foreground">({typeof obj})</span>
          {isSelected && <Check className="h-4 w-4 text-primary ml-auto" />}
        </div>
      )
    }

    // For objects and arrays, show expandable node
    const keys = isArray ? Object.keys(obj).map((_, i) => i.toString()) : Object.keys(obj)
    const currentKey = path.split('.').pop() || 'root'
    const isExp = isExpanded(path)

    return (
      <div key={path} style={{ paddingLeft: `${level * 20}px` }}>
        <div
          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-secondary/50 cursor-pointer"
          onClick={() => toggleExpand(path)}
        >
          {isExp ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {currentKey}
            {isArray && ` [${keys.length}]`}
            {isObject && ` {${keys.length}}`}
          </span>
        </div>
        {isExp && (
          <div className="ml-4">
            {keys.map((key) => {
              const childPath = path ? `${path}.${key}` : key
              const childValue = obj[key]
              return renderJsonNode(childValue, childPath, level + 1)
            })}
          </div>
        )}
      </div>
    )
  }

  const handleTest = async () => {
    if (!curlCommand.trim()) {
      showToast({ title: 'Error', message: 'Please enter a curl command', type: 'error' })
      return
    }

    setIsTesting(true)
    try {
      const { url, headers } = parseCurlCommand(curlCommand)

      // Extract username and password from Authorization header if present
      let username: string | undefined
      let password: string | undefined
      const otherHeaders: Record<string, string> = {}

      if (headers['Authorization']) {
        const authHeader = headers['Authorization']
        if (authHeader.startsWith('Basic ')) {
          try {
            const credentials = atob(authHeader.substring(6))
            const [user, pass] = credentials.split(':')
            username = user
            password = pass
          } catch (e) {
            // Invalid base64, ignore
          }
        }
      }

      // Separate other headers (excluding Authorization)
      Object.keys(headers).forEach((key) => {
        if (key !== 'Authorization') {
          otherHeaders[key] = headers[key]
        }
      })

      // Call backend API to test fetch
      const response = await fetch('/api/v1/http/test-fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          method: 'GET',
          username: username || undefined,
          password: password || undefined,
          headers: Object.keys(otherHeaders).length > 0 ? otherHeaders : undefined,
          timeout_ms: 10000, // 10 seconds timeout
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data')
      }

      // Handle response
      if (result.is_json) {
        setJsonResponse(result.data)
        // Auto-expand root level
        setExpandedPaths(new Set(['']))
      } else {
        // Not JSON, show as text
        showToast({ title: 'Warning', message: 'Response is not JSON', type: 'warning' })
        setJsonResponse(null)
      }

      showToast({ title: 'Success', message: 'Successfully fetched data', type: 'success' })
    } catch (error: any) {
      showToast({ title: 'Error', message: error.message || 'Failed to fetch data', type: 'error' })
      setJsonResponse(null)
      setSelectedValueField('')
      setExpandedPaths(new Set())
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!parameterName.trim()) {
      showToast({ title: 'Error', message: 'Please enter parameter name', type: 'error' })
      return
    }

    if (!selectedValueField) {
      showToast({ title: 'Error', message: 'Please select value field', type: 'error' })
      return
    }

    if (!curlCommand.trim()) {
      showToast({ title: 'Error', message: 'Please enter a curl command', type: 'error' })
      return
    }

    setIsSaving(true)
    try {
      const { url, headers } = parseCurlCommand(curlCommand)

      // Extract username and password from Authorization header if present
      let username: string | undefined
      let password: string | undefined
      const otherHeaders: Record<string, string> = {}

      if (headers['Authorization']) {
        const authHeader = headers['Authorization']
        if (authHeader.startsWith('Basic ')) {
          try {
            const credentials = atob(authHeader.substring(6))
            const [user, pass] = credentials.split(':')
            username = user
            password = pass
          } catch (e) {
            // Invalid base64, ignore
          }
        }
      }

      // Separate other headers (excluding Authorization)
      Object.keys(headers).forEach((key) => {
        if (key !== 'Authorization') {
          otherHeaders[key] = headers[key]
        }
      })

      // Create field mappings JSON
      const fieldMappingsJson = JSON.stringify({
        value: selectedValueField,
      })

      // Prepare headers JSON
      const headersJson = Object.keys(otherHeaders).length > 0 ? JSON.stringify(otherHeaders) : undefined

      // Create HTTP config with parameter name
      // Backend will automatically create HTTP GET koneksi and parameter if needed
      // Ensure all field names match backend JSON tags (snake_case)
      const httpConfigPayload: any = {
        parameter_name: parameterName, // Backend will create parameter automatically
        url: url,
        method: 'GET',
        timeout_ms: 10000, // 10 seconds
        polling_ms: parseInt(pollingInterval) * 1000, // Convert seconds to milliseconds
        field_mappings: fieldMappingsJson,
      }

      // Add optional fields only if they exist
      if (username) {
        httpConfigPayload.username = username
      }
      if (password) {
        httpConfigPayload.password = password
      }
      if (headersJson) {
        httpConfigPayload.headers = headersJson
      }
      if (parameterName) {
        httpConfigPayload.description = `HTTP parameter: ${parameterName}`
      }

      console.log('Creating HTTP config:', { ...httpConfigPayload, password: password ? '***' : undefined })

      try {
        const createdConfig = await httpService.create(httpConfigPayload)
        console.log('HTTP config created:', createdConfig)
        showToast({ title: 'Success', message: 'Parameter saved successfully', type: 'success' })
      } catch (httpError: any) {
        console.error('Error creating HTTP config:', httpError)
        const errorMessage = httpError?.response?.data?.error || httpError?.message || 'Failed to create HTTP config'
        throw new Error(`HTTP Config Error: ${errorMessage}`)
      }

      // Reset form
      setParameterName('')
      setCurlCommand('')
      setJsonResponse(null)
      setSelectedValueField('')
      setExpandedPaths(new Set())
      setPollingInterval('60')
    } catch (error: any) {
      showToast({ title: 'Error', message: error.message || 'Failed to save parameter', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">HTTP Parameter Read</h1>
          <p className="text-sm text-muted-foreground">
            Create parameter read from HTTP GET endpoint
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Input */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parameter Configuration</CardTitle>
              <CardDescription>Enter parameter name and curl command</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parameter-name">Parameter Name</Label>
                <Input
                  id="parameter-name"
                  value={parameterName}
                  onChange={(e) => setParameterName(e.target.value)}
                  placeholder="e.g., Temperature Sensor"
                  className="border-border bg-secondary text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="curl-command">cURL Command</Label>
                <Textarea
                  id="curl-command"
                  value={curlCommand}
                  onChange={(e) => setCurlCommand(e.target.value)}
                  placeholder='curl -u "username:password" "https://example.com/api/data"'
                  rows={6}
                  className="font-mono text-sm border-border bg-secondary text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full curl command including URL, headers, and authentication
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="polling-interval">Polling Interval (seconds)</Label>
                <Input
                  id="polling-interval"
                  type="number"
                  value={pollingInterval}
                  onChange={(e) => setPollingInterval(e.target.value)}
                  placeholder="60"
                  min="1"
                  className="border-border bg-secondary text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  How often to poll this endpoint (in seconds)
                </p>
              </div>

              <Button
                onClick={handleTest}
                disabled={isTesting || !curlCommand.trim()}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Test & Fetch Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* JSON Response Preview */}
          {jsonResponse && (
            <Card>
              <CardHeader>
                <CardTitle>JSON Response</CardTitle>
                <CardDescription>Response from the endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-secondary border border-border overflow-auto max-h-96 text-xs">
                  {JSON.stringify(jsonResponse, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Value Field Selection */}
        <div className="space-y-6">
          {jsonResponse ? (
            <Card>
              <CardHeader>
                <CardTitle>Select Value Field</CardTitle>
                <CardDescription>
                  Navigate through the JSON structure and click on a value field to select it
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-border rounded-lg p-4 bg-secondary/30 max-h-[600px] overflow-auto">
                  {renderJsonNode(jsonResponse, '')}
                </div>
                {selectedValueField && (
                  <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="text-sm font-medium text-primary mb-1">Selected Value Field:</div>
                    <div className="text-sm font-mono text-foreground">{selectedValueField}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Value: {String(getValueByPath(jsonResponse, selectedValueField))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Select Value Field</CardTitle>
                <CardDescription>Test fetch data first to see JSON structure</CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Save Parameter</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSave}
                disabled={isSaving || !parameterName.trim() || !selectedValueField}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Parameter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
