import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Settings, Cpu, Network, Server, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/devices', label: 'Koneksi', icon: Server },
    { path: '/parameters', label: 'Parameters', icon: Settings },
    { path: '/modbus/rtu', label: 'Modbus RTU', icon: Cpu },
    { path: '/modbus/tcp', label: 'Modbus TCP', icon: Network },
    { path: '/snmp', label: 'SNMP', icon: Network },
  ]

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">AOI System</h1>
          <p className="text-xs text-muted-foreground">Industrial Comm</p>
        </div>
      </div>

      {menuItems.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.path
        return (
          <Link key={item.path} to={item.path}>
            <Button
              variant={isActive ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start',
                isActive && 'bg-primary text-primary-foreground'
              )}
            >
              <Icon className="h-4 w-4 mr-2" />
              {item.label}
            </Button>
          </Link>
        )
      })}
    </div>
  )
}
