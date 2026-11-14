import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppDispatch, useAppSelector } from '@/store'
import { selectResolvedTheme, setTheme, type ThemePreference } from '@/store/uiSlice'

export function ThemeMenu() {
  const dispatch = useAppDispatch()
  const pref = useAppSelector((s) => s.ui.theme)
  const resolved = useAppSelector(selectResolvedTheme)
  const Icon = resolved === 'dark' ? Moon : Sun
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          <Icon strokeWidth={1.5} className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={pref} onValueChange={(v) => dispatch(setTheme(v as ThemePreference))}>
          <DropdownMenuRadioItem value="light">
            <Sun strokeWidth={1.5} className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon strokeWidth={1.5} className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor strokeWidth={1.5} className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
