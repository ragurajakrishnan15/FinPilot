import {
  Activity,
  Banknote,
  Building2,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Receipt,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '@/store'
import { closeMobileNav, setTheme, toggleMobileNav } from '@/store/uiSlice'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/command', label: 'Command', icon: MessageSquare },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/vendors', label: 'Vendors', icon: Building2 },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/payments', label: 'Payments', icon: Banknote },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const dispatch = useAppDispatch()
  const theme = useAppSelector((s) => s.ui.theme)
  const open = useAppSelector((s) => s.ui.mobileNavOpen)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('finpilot-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-2">
        Skip to content
      </a>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 border-r border-border bg-surface p-4 transition-transform md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Primary"
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">FinPilot</span>
          <button className="md:hidden" aria-label="Close menu" onClick={() => dispatch(closeMobileNav())}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => dispatch(closeMobileNav())}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-brand/10 font-medium text-brand' : 'text-muted hover:bg-bg hover:text-fg',
                )
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => dispatch(closeMobileNav())} aria-hidden />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-warn/10 px-4 py-1.5 text-center text-xs text-warn" role="note">
          Synthetic demo data · All payments are simulated — no money moves
        </div>
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
          <Button variant="ghost" size="sm" className="md:hidden" aria-label="Open menu" onClick={() => dispatch(toggleMobileNav())}>
            <Menu size={18} />
          </Button>
          <span className="hidden text-sm text-muted md:block">Acme Robotics (Demo)</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
