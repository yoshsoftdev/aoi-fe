import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Settings, Cpu, Network, Server } from 'lucide-react'

export default function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/devices', label: 'Devices', icon: Server },
    { path: '/parameters', label: 'Parameters', icon: Settings },
    { path: '/modbus/rtu', label: 'Modbus RTU', icon: Cpu },
    { path: '/modbus/tcp', label: 'Modbus TCP', icon: Network },
    { path: '/snmp', label: 'SNMP', icon: Network },
  ]

  return (
    <aside className="w-64 bg-gray-800 text-white">
      <div className="p-4">
        <h1 className="text-xl font-bold">AOI System</h1>
      </div>
      <nav className="mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 hover:bg-gray-700 ${
                isActive ? 'bg-gray-700 border-l-4 border-blue-500' : ''
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

