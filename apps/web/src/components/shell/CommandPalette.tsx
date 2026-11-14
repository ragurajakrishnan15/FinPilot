import { MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useAppDispatch, useAppSelector } from '@/store'
import { setPaletteOpen } from '@/store/uiSlice'
import { navGroups, suggestedPrompts } from './nav'

/** Jump to a page, or start a Command Center question. Loaded lazily; the Cmd/Ctrl+K listener lives in the layout. */
export default function CommandPalette() {
  const open = useAppSelector((s) => s.ui.paletteOpen)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const go = (path: string, prompt?: string) => {
    dispatch(setPaletteOpen(false))
    void navigate(path, prompt ? { state: { prompt } } : undefined)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => dispatch(setPaletteOpen(o))}
      title="Search and ask"
      description="Go to a page or start a question"
    >
      {/* radix-nova's CommandDialog does not provide the cmdk root; the palette must. */}
      <Command>
        <CommandInput placeholder="Go to a page or ask a question" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Go to">
            {navGroups
              .flatMap((g) => g.items)
              .map(({ to, label, icon: Icon }) => (
                <CommandItem key={to} value={`go ${label}`} onSelect={() => go(to)}>
                  <Icon strokeWidth={1.5} className="size-4 text-muted-foreground" />
                  {label}
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Ask the Command Center">
            {suggestedPrompts.map((p) => (
              <CommandItem key={p} value={`ask ${p}`} onSelect={() => go('/command', p)}>
                <MessageSquare strokeWidth={1.5} className="size-4 text-muted-foreground" />
                <span className="truncate">{p}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
