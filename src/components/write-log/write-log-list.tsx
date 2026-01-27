import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { writeLogService, WriteLog } from '@/services/writeLogService'
import { FileText, CheckCircle2, XCircle, RefreshCw, Search } from 'lucide-react'
import { formatNumber } from '@/utils/formatters'

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function WriteLogList() {
  const [logs, setLogs] = useState<WriteLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [limit, setLimit] = useState(100)
  const [filterSuccess, setFilterSuccess] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const data = await writeLogService.getAll(limit)
      setLogs(data)
    } catch (error) {
      console.error('Failed to fetch write logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [limit])

  // Filter logs based on success status and search query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by success status
      if (filterSuccess === 'success' && !log.success) return false
      if (filterSuccess === 'error' && log.success) return false
      
      // Filter by search query (search in parameter name, device name, message, error)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          log.parameter_nama?.toLowerCase().includes(query) ||
          log.device_nama?.toLowerCase().includes(query) ||
          log.message?.toLowerCase().includes(query) ||
          log.error?.toLowerCase().includes(query) ||
          log.workflow_nama?.toLowerCase().includes(query) ||
          log.write_mode.toLowerCase().includes(query) ||
          log.triggered_by.toLowerCase().includes(query)
        
        if (!matchesSearch) return false
      }
      
      return true
    })
  }, [logs, filterSuccess, searchQuery])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Write Log</CardTitle>
          <CardDescription>Memuat log...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Write Log
            </CardTitle>
            <CardDescription>Riwayat semua write action ke parameter</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Cari Log</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Cari berdasarkan parameter, device, message, error..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-32">
              <label className="text-sm font-medium mb-1 block">Limit</label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
              />
            </div>
            <div className="w-40">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={filterSuccess}
                onChange={(e) => setFilterSuccess(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Semua</option>
                <option value="success">Berhasil</option>
                <option value="error">Gagal</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || filterSuccess !== 'all'
                ? 'Tidak ada log yang sesuai dengan filter'
                : 'Tidak ada log yang ditemukan'}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Waktu</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Parameter</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Workflow</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Message/Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        className={`border-t border-border hover:bg-muted/30 ${
                          log.success ? '' : 'bg-red-50/50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          {log.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">{log.parameter_nama || `ID: ${log.parameter_id}`}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{log.device_nama || `ID: ${log.device_id}`}</td>
                        <td className="px-4 py-3 text-sm">
                          {log.value !== undefined ? formatNumber(log.value) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {log.workflow_nama ? (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              {log.workflow_nama}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.error ? (
                            <div className="text-sm text-red-700 font-medium max-w-xs truncate" title={log.error}>
                              {log.error}
                            </div>
                          ) : log.message ? (
                            <div className="text-sm text-gray-700 max-w-xs truncate" title={log.message}>
                              {log.message}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-muted/30 border-t border-border text-sm text-muted-foreground">
                Menampilkan {filteredLogs.length} dari {logs.length} log
                {searchQuery && ` (filtered by: "${searchQuery}")`}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
