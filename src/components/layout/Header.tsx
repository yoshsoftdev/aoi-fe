import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AdminLoginDialog } from '@/components/auth/AdminLoginDialog'
import { useAuth } from '@/contexts/AuthContext'
import { Lock, Unlock, LogOut } from 'lucide-react'

export default function Header() {
  const location = useLocation()
  const { isAdmin, logout } = useAuth()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard'
      case '/devices':
        return 'Koneksi'
      case '/parameters':
        return 'Parameters'
      case '/modbus/rtu':
        return 'Modbus RTU'
      case '/modbus/tcp':
        return 'Modbus TCP'
      case '/snmp':
        return 'SNMP'
      default:
        return 'CTG System'
    }
  }

  const getPageDescription = () => {
    switch (location.pathname) {
      case '/':
        return 'Pantau nilai data yang telah dipetakan'
      case '/devices':
        return 'Kelola konfigurasi koneksi'
      case '/parameters':
        return 'Konfigurasi parameter data'
      default:
        return ''
    }
  }

  return (
    <div className="flex items-center justify-between w-full">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {getPageTitle()}
        </h1>
        <p className="text-xs text-muted-foreground">
          {getPageDescription()}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm">
              <Unlock className="h-4 w-4" />
              <span>Mode Admin</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar</span>
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLoginDialogOpen(true)}
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            <span>Admin Mode</span>
          </Button>
        )}
      </div>

      <AdminLoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
      />
    </div>
  )
}
