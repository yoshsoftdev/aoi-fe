import { useQuery } from '@tanstack/react-query'
import { parameterService } from '@/services/parameterService'
import { Link } from 'react-router-dom'
import { Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'

export default function ParameterList() {
  const { isAdmin } = useAuth()
  const { data: parameters, isLoading } = useQuery({
    queryKey: ['parameters'],
    queryFn: parameterService.getAll,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading parameters...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Parameters</h2>
        <p className="text-sm text-muted-foreground mt-1">Konfigurasi parameter data</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {parameters?.length || 0} {parameters?.length === 1 ? 'parameter' : 'parameter'}
        </div>
        {isAdmin && (
          <Button>
            <Link to="/parameters/new" className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Parameter Baru
            </Link>
          </Button>
        )}
      </div>

      {parameters && parameters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">Belum ada parameter yang dikonfigurasi</p>
            <p className="text-sm text-muted-foreground mt-2">
              Klik "Parameter Baru" untuk membuat parameter pertama
            </p>
            {isAdmin && (
              <Button className="mt-4">
                <Link to="/parameters/new">Buat Parameter Pertama</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {parameters?.map((param) => (
            <Card key={param.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{param.nama}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {param.type}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mode:</span>
                    <Badge variant={param.read_write ? 'default' : 'secondary'} className="text-xs">
                      {param.read_write ? 'Read/Write' : 'Read Only'}
                    </Badge>
                  </div>
                  {param.custom_rumus && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-muted-foreground text-xs">Formula:</span>
                      <p className="text-xs font-mono mt-1">{param.custom_rumus}</p>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <Button variant="outline" size="sm" className="flex-1">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Hapus
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
