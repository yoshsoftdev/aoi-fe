import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import DeviceList from './pages/Devices/DeviceList'
import DeviceForm from './pages/Devices/DeviceForm'
import ParameterList from './pages/Parameters/ParameterList'
import ParameterForm from './pages/Parameters/ParameterForm'
import ModbusRTUConfig from './pages/Modbus/ModbusRTUConfig'
import ModbusTCPConfig from './pages/Modbus/ModbusTCPConfig'
import SNMPConfig from './pages/SNMP/SNMPConfig'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<DeviceList />} />
            <Route path="/devices/new" element={<DeviceForm />} />
            <Route path="/devices/:id/edit" element={<DeviceForm />} />
            <Route path="/parameters" element={<ParameterList />} />
            <Route path="/parameters/new" element={<ParameterForm />} />
            <Route path="/modbus/rtu" element={<ModbusRTUConfig />} />
            <Route path="/modbus/tcp" element={<ModbusTCPConfig />} />
            <Route path="/snmp" element={<SNMPConfig />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  )
}

export default App

