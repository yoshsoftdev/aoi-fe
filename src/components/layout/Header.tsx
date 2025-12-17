import { useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()
  
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
        return 'AOI System'
    }
  }

  const getPageDescription = () => {
    switch (location.pathname) {
      case '/':
        return 'Monitor mapped data values'
      case '/devices':
        return 'Manage connection configurations'
      case '/parameters':
        return 'Configure data parameters'
      default:
        return ''
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">
        {getPageTitle()}
      </h1>
      <p className="text-xs text-muted-foreground">
        {getPageDescription()}
      </p>
    </div>
  )
}
