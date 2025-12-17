import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={cn(
          'border-r border-border bg-card transition-all duration-300',
          isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        )}
      >
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="flex h-16 items-center gap-3 px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-10 w-10"
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Header />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
