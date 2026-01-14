import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Plug, PlugZap, Trash2, TestTube } from 'lucide-react'
import type { Connection, ConnectionStatus } from '@/types'
import { ConnectionForm } from '@/components/tester/connection-form'
import { connectionService } from '@/services/connectionService'

interface ConnectionStepProps {
  connections: Connection[]
  setConnections: (connections: Connection[]) => void
  activeConnection: Connection | null
  setActiveConnection: (connection: Connection | null) => void
  addLog: (message: string, type?: 'info' | 'error' | 'success' | 'warning', connectionId?: string) => void
  onProceed: () => void
}

export function ConnectionStep({
  connections,
  setConnections,
  activeConnection,
  setActiveConnection,
  addLog,
  onProceed,
}: ConnectionStepProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)

  // Load existing connections (koneksi) from backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        const backendConnections = await connectionService.loadAll()
        if (backendConnections.length > 0) {
          setConnections(backendConnections)
          addLog(`Loaded ${backendConnections.length} connections from database`, 'info')
        }
      } catch (error: any) {
        const msg = error.response?.data?.error || error.message || 'Unknown error'
        addLog(`Failed to load connections from backend: ${msg}`, 'error')
      }
    }
    // Hanya load sekali saat awal, jika list masih kosong
    if (connections.length === 0) {
      load()
    }
  }, [])

  const handleSaveConnection = async (connection: Connection) => {
    try {
      let savedConnection: Connection

      if (editingConnection) {
        // Update existing connection in backend
        savedConnection = await connectionService.update(connection)
        setConnections(connections.map((c) => (c.id === savedConnection.id ? savedConnection : c)))
        addLog(`Updated connection: ${savedConnection.name}`, 'success', savedConnection.id)
      } else {
        // Create new connection in backend
        savedConnection = await connectionService.create(connection)
        setConnections([...connections, savedConnection])
        addLog(`Created connection: ${savedConnection.name}`, 'success', savedConnection.id)
      }

      // If this was the active connection, update it with the saved version
      if (activeConnection?.id === connection.id || activeConnection?.name === connection.name) {
        setActiveConnection(savedConnection)
      }

      setShowForm(false)
      setEditingConnection(null)
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      const statusCode = error.response?.status || 'N/A'
      addLog(`Failed to save connection (${statusCode}): ${errorMsg}`, 'error')
      console.error('Connection save error:', error)
      // Don't close form on error so user can retry
    }
  }

  const handleTestConnection = async (connection: Connection) => {
    // Skip test for Digital I/O protocols
    if (connection.protocol === 'Digital Input' || connection.protocol === 'Digital Output') {
      addLog(`Digital I/O connections don't require connection test`, 'info', connection.id)
      return
    }

    setTestingConnectionId(connection.id)
    addLog(`Testing connection to ${connection.name}...`, 'info', connection.id)

    try {
      const result = await connectionService.test({
        type: connection.protocol,
        config: connection.config,
      })

      if (result.connected) {
        addLog(`Connection test successful: ${result.message}`, 'success', connection.id)
        // Reset error status if test is successful
        if (connection.status === 'error') {
          const resetConnection = { ...connection, status: 'disconnected' as ConnectionStatus }
          setConnections(connections.map((c) => (c.id === connection.id ? resetConnection : c)))
        }
      } else {
        addLog(`Connection test failed: ${result.message}${result.details ? ` - ${result.details}` : ''}`, 'error', connection.id)
        // Update connection status to error
        const errorConnection = { ...connection, status: 'error' as ConnectionStatus }
        setConnections(connections.map((c) => (c.id === connection.id ? errorConnection : c)))
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      addLog(`Connection test error: ${errorMessage}`, 'error', connection.id)
      // Update connection status to error
      const errorConnection = { ...connection, status: 'error' as ConnectionStatus }
      setConnections(connections.map((c) => (c.id === connection.id ? errorConnection : c)))
    } finally {
      setTestingConnectionId(null)
    }
  }

  const handleConnect = async (connection: Connection) => {
    // For Digital I/O, connect directly without test
    if (connection.protocol === 'Digital Input' || connection.protocol === 'Digital Output') {
      const connected = { ...connection, status: 'connected' as ConnectionStatus }
      setConnections(connections.map((c) => (c.id === connection.id ? connected : c)))
      setActiveConnection(connected)
      addLog(`Connected to ${connection.name}`, 'success', connection.id)
      onProceed()
      return
    }

    // For other protocols, test connection first
    const updatedConnection = { ...connection, status: 'connecting' as ConnectionStatus }
    setConnections(connections.map((c) => (c.id === connection.id ? updatedConnection : c)))
    addLog(`Connecting to ${connection.name}...`, 'info', connection.id)

    try {
      const result = await connectionService.test({
        type: connection.protocol,
        config: connection.config,
      })

      if (result.connected) {
        const connected = { ...connection, status: 'connected' as ConnectionStatus }
        setConnections(connections.map((c) => (c.id === connection.id ? connected : c)))
        setActiveConnection(connected)
        addLog(`Connected to ${connection.name}`, 'success', connection.id)
        onProceed()
      } else {
        const errorConnection = { ...connection, status: 'error' as ConnectionStatus }
        setConnections(connections.map((c) => (c.id === connection.id ? errorConnection : c)))
        addLog(`Connection failed: ${result.message}${result.details ? ` - ${result.details}` : ''}`, 'error', connection.id)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      const errorConnection = { ...connection, status: 'error' as ConnectionStatus }
      setConnections(connections.map((c) => (c.id === connection.id ? errorConnection : c)))
      addLog(`Connection error: ${errorMessage}`, 'error', connection.id)
    }
  }

  const handleDisconnect = (connection: Connection) => {
    const disconnected = { ...connection, status: 'disconnected' as ConnectionStatus }
    setConnections(connections.map((c) => (c.id === connection.id ? disconnected : c)))
    if (activeConnection?.id === connection.id) {
      setActiveConnection(null)
    }
    addLog(`Disconnected from ${connection.name}`, 'info', connection.id)
  }

  const handleDelete = async (connection: Connection) => {
    try {
      await connectionService.delete(connection.id)
      setConnections(connections.filter((c) => c.id !== connection.id))
      if (activeConnection?.id === connection.id) {
        setActiveConnection(null)
      }
      addLog(`Deleted connection: ${connection.name}`, 'success')
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Unknown error'
      addLog(`Failed to delete connection: ${msg}`, 'error', connection.id)
    }
  }

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'connecting':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Langkah 1: Pengaturan Koneksi</h2>
          <p className="text-sm text-muted-foreground mt-1">Konfigurasi transport layer (tidak perlu Slave ID)</p>
        </div>
        <Button
          onClick={() => {
            setEditingConnection(null)
            setShowForm(!showForm)
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Koneksi Baru
        </Button>
      </div>

      {showForm && (
        <ConnectionForm
          onSave={handleSaveConnection}
          onCancel={() => {
            setShowForm(false)
            setEditingConnection(null)
          }}
          initialData={editingConnection}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {connections.map((connection) => (
          <Card
            key={connection.id}
            className={activeConnection?.id === connection.id ? 'border-primary ring-1 ring-primary' : ''}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {connection.name}
                    {activeConnection?.id === connection.id && (
                      <Badge variant="outline" className="text-xs">
                        Aktif
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">{connection.protocol}</CardDescription>
                </div>
                <Badge variant="outline" className={getStatusColor(connection.status)}>
                  {connection.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                {connection.protocol === 'Modbus TCP' && 'host' in connection.config && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Host:</span>
                      <span className="font-mono">{connection.config.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Port:</span>
                      <span className="font-mono">{connection.config.port}</span>
                    </div>
                  </>
                )}
                {connection.protocol === 'Modbus RTU' && 'serialPort' in connection.config && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Port:</span>
                      <span className="font-mono">{connection.config.serialPort}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Baud:</span>
                      <span className="font-mono">{connection.config.baudRate}</span>
                    </div>
                  </>
                )}
                {(connection.protocol === 'Digital Input' || connection.protocol === 'Digital Output') &&
                  'pins' in connection.config && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pins:</span>
                        <span className="font-mono">{connection.config.pins?.join(', ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode:</span>
                        <span className="font-mono">{connection.config.mode}</span>
                      </div>
                    </>
                  )}
                {connection.protocol === 'SNMP' && 'host' in connection.config && (
                  <>
                    {'host' in connection.config && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Host:</span>
                        <span className="font-mono">{connection.config.host}</span>
                      </div>
                    )}
                    {'version' in connection.config && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version:</span>
                        <span className="font-mono">{connection.config.version}</span>
                      </div>
                    )}
                    {'community' in connection.config && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Community:</span>
                        <span className="font-mono">{connection.config.community}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {connection.status === 'connected' ? (
                  <Button onClick={() => handleDisconnect(connection)} variant="outline" size="sm" className="flex-1">
                    <Plug className="h-4 w-4 mr-2" />
                    Putuskan
                  </Button>
                ) : (
                  <>
                    {(connection.protocol === 'Modbus TCP' ||
                      connection.protocol === 'Modbus RTU' ||
                      connection.protocol === 'SNMP') && (
                      <Button
                        onClick={() => handleTestConnection(connection)}
                        variant="outline"
                        size="sm"
                        disabled={connection.status === 'connecting' || testingConnectionId === connection.id}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        {testingConnectionId === connection.id ? 'Menguji...' : 'Uji'}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleConnect(connection)}
                      variant="default"
                      size="sm"
                      className="flex-1"
                      disabled={connection.status === 'connecting' || testingConnectionId === connection.id}
                    >
                      <PlugZap className="h-4 w-4 mr-2" />
                      {connection.status === 'connecting' ? 'Menyambungkan...' : 'Sambungkan'}
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => {
                    setEditingConnection(connection)
                    setShowForm(true)
                  }}
                  variant="outline"
                  size="sm"
                  disabled={connection.status === 'connected' || connection.status === 'connecting'}
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(connection)}
                  variant="ghost"
                  size="sm"
                  disabled={connection.status === 'connected' || connection.status === 'connecting'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeConnection?.status === 'connected' && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <PlugZap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Koneksi Terhubung</p>
                <p className="text-sm text-muted-foreground">Beralih ke panel uji...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

