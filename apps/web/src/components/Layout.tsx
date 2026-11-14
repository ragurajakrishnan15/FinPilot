import { Menu, Search } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/utils'
import { api } from '@/services/api'
import { useAppDispatch, useAppSelector } from '@/store'
import { selectResolvedTheme, setPaletteOpen, setSystemDark } from '@/store/uiSlice'
import { Annunciator } from './shell/Annunciator'
import { Logo } from './shell/Logo'
import { navGroups } from './shell/nav'
import { ThemeMenu } from './shell/ThemeMenu'

// The palette (dialog + cmdk) is only downloaded the first time someone opens it.
const CommandPalette = lazy(() => import('./shell/CommandPalette'))

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs text-muted-foreground">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-foreground',
                      isActive && 'bg-sidebar-accent text-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)]',
                    )
                  }
                >
                  <Icon strokeWidth={1.5} className="size-4 shrink-0" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function WorkspaceCard() {
  const me = useAsync(() => api.getMe())
  const name = me.data?.workspace.name ?? 'Workspace'
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5">
      <Avatar className="size-8 rounded-md">
        <AvatarFallback className="rounded-md bg-secondary text-xs font-medium">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-medium break-words">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{me.data ? `${me.data.display_name} · ${me.data.role}` : ' '}</p>
      </div>
    </div>
  )
}

export default function Layout() {
  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectResolvedTheme)
  const pref = useAppSelector((s) => s.ui.theme)
  const [navOpen, setNavOpen] = useState(false)
  const paletteOpen = useAppSelector((s) => s.ui.paletteOpen)
  const [paletteLoaded, setPaletteLoaded] = useState(false)
  const { pathname } = useLocation()

  // Cmd/Ctrl+K toggles the palette from anywhere; mount it on first use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        dispatch(setPaletteOpen(!paletteOpen))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, paletteOpen])
  // Derived during render (no effect needed): once it has been opened, keep it mounted.
  if (paletteOpen && !paletteLoaded) setPaletteLoaded(true)

  // Apply the resolved theme and keep it in step with the operating system.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  useEffect(() => {
    try {
      localStorage.setItem('finpilot-theme', pref)
    } catch {
      /* storage unavailable */
    }
  }, [pref])
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => dispatch(setSystemDark(e.matches))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [dispatch])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background md:flex">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>

        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 md:flex">
          <div className="px-2 pt-1">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavList />
          </div>
          <WorkspaceCard />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background px-4 md:px-8">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu strokeWidth={1.5} className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] gap-6 p-4">
                <SheetTitle className="px-2 pt-1">
                  <Logo />
                </SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <div className="flex-1 overflow-y-auto">
                  <NavList onNavigate={() => setNavOpen(false)} />
                </div>
                <WorkspaceCard />
              </SheetContent>
            </Sheet>

            <Button
              variant="outline"
              className="h-9 w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-72 sm:px-3"
              onClick={() => dispatch(setPaletteOpen(true))}
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search strokeWidth={1.5} className="mx-auto size-4 sm:mx-0" aria-hidden />
              {/* The visible label is also the accessible name; on phones it is available to screen readers only. */}
              <span className="sr-only flex-1 text-left font-normal sm:not-sr-only">Search</span>
              <Kbd className="hidden sm:inline-flex" aria-hidden>
                Ctrl K
              </Kbd>
            </Button>

            <div className="ml-auto flex items-center gap-1">
              <Annunciator className="hidden lg:inline-flex" />
              <ThemeMenu />
            </div>
          </header>

          <Annunciator className="mx-4 mt-3 h-auto min-h-8 whitespace-normal py-1 lg:hidden md:mx-8" />

          <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8">
            <div key={pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      {paletteLoaded ? (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      ) : null}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
