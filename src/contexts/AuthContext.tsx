import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAdmin: boolean
  login: (password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Default admin password (can be changed via environment variable)
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'rahasia213'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // Check localStorage on mount
    const saved = localStorage.getItem('aoi_admin_mode')
    return saved === 'true'
  })

  useEffect(() => {
    // Save to localStorage whenever isAdmin changes
    localStorage.setItem('aoi_admin_mode', isAdmin.toString())
  }, [isAdmin])

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true)
      return true
    }
    return false
  }

  const logout = () => {
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

