import { ArrowUp, History, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { Block, ToolLog } from '@/components/command/Blocks'
import { RichText } from '@/components/command/RichText'
import { PageHeader } from '@/components/PageHeader'
import { suggestedPrompts } from '@/components/shell/nav'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/utils'
import { isMockApi, api } from '@/services/api'
import { useAppDispatch, useAppSelector } from '@/store'
import { clearConversation, openConversation, sendCommand, type ChatMessage } from '@/store/commandSlice'

function MessageView({ m }: { m: ChatMessage }) {
  if (m.role === 'user') {
    return <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-sm leading-6">{m.text}</div>
  }
  if (m.role === 'error') {
    return (
      <p role="alert" className="max-w-[85%] rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {m.text}
      </p>
    )
  }
  return (
    <div className="flex max-w-[92%] flex-col gap-3">
      <RichText text={m.text} />
      {m.blocks && m.blocks.length > 0 ? (
        <div className="flex flex-col gap-3">
          {m.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>
      ) : null}
      {m.tools ? <ToolLog tools={m.tools} /> : null}
    </div>
  )
}

function History_({ onPick }: { onPick: (id: string) => void }) {
  const revision = useAppSelector((s) => s.command.revision)
  const activeId = useAppSelector((s) => s.command.conversationId)
  const list = useAsync(() => api.getConversations(), [revision])
  return (
    <AsyncBoundary
      state={list}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState title="No conversations yet" hint="Your questions will be saved here." />}
    >
      {(items) => (
        <ul className="flex flex-col gap-0.5 p-2">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c.id)}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeId === c.id && 'bg-accent',
                )}
              >
                <span className="block truncate text-sm">{c.preview || 'Untitled'}</span>
                <span className="block text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AsyncBoundary>
  )
}

export default function CommandPage() {
  const dispatch = useAppDispatch()
  const { messages, status } = useAppSelector((s) => s.command)
  const location = useLocation()
  const [text, setText] = useState((location.state as { prompt?: string } | null)?.prompt ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const busy = status === 'loading'

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy])

  function send(e?: FormEvent) {
    e?.preventDefault()
    const msg = text.trim()
    if (!msg || busy) return
    setText('')
    void dispatch(sendCommand(msg))
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const pick = (id: string) => {
    setHistoryOpen(false)
    void dispatch(openConversation(id))
  }

  return (
    <>
      <PageHeader
        title="Command Center"
        description={
          isMockApi
            ? 'Ask about your synthetic finances. Answers here are mocked because no server is connected.'
            : 'Ask about your money in plain language. Figures come from your records, and payments are only ever drafted here.'
        }
        action={
          <>
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <History strokeWidth={1.5} className="size-4" />
                  History
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] gap-0 p-0">
                <SheetHeader className="p-4">
                  <SheetTitle>History</SheetTitle>
                  <SheetDescription>Your earlier questions</SheetDescription>
                </SheetHeader>
                <History_ onPick={pick} />
              </SheetContent>
            </Sheet>
            <Button variant="outline" onClick={() => dispatch(clearConversation())} disabled={messages.length === 0}>
              <Plus strokeWidth={1.5} className="size-4" />
              New conversation
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="hidden gap-0 overflow-hidden py-0 lg:flex">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">History</div>
          <History_ onPick={pick} />
        </Card>

        <Card className="min-h-[60vh] gap-0 py-0">
          <div className="flex flex-1 flex-col gap-5 p-5" aria-live="polite">
            {messages.length === 0 ? (
              <div className="max-w-xl">
                <p className="text-base font-medium">Ask about your money</p>
                <p className="mt-1 text-sm text-muted-foreground">Pick a question to start, or write your own.</p>
                <ul className="mt-4 flex flex-col divide-y divide-border rounded-lg border border-border">
                  {suggestedPrompts.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => {
                          setText(p)
                          inputRef.current?.focus()
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((m) => <MessageView key={m.id} m={m} />)
            )}
            {busy ? (
              <div role="status" aria-label="Working on it" className="flex max-w-sm flex-col gap-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <span className="sr-only">Working on it…</span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="sticky bottom-0 flex items-end gap-2 rounded-b-xl border-t border-border bg-card p-3">
            <Textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={4000}
              rows={1}
              aria-label="Message"
              placeholder="Ask about balances, expenses, vendors, invoices…"
              className="max-h-40 min-h-10 resize-none"
            />
            <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
              <ArrowUp strokeWidth={1.75} className="size-4" />
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}
