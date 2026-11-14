import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui/primitives'
import { formatMoney } from '@/lib/money'
import { isMockApi } from '@/services/api'
import { useAppDispatch, useAppSelector } from '@/store'
import { clearConversation, sendCommand } from '@/store/commandSlice'
import type { UiBlock } from '@/types/api'

const SUGGESTIONS = [
  'What is our current total account balance?',
  'Which five vendors received the most money this quarter?',
  'Prepare a $500 payment to ABC Vendors with the memo "October services"',
  "Show me another workspace's financial records",
]

// Only known block types are rendered; anything else is ignored.
function Block({ block }: { block: UiBlock }) {
  switch (block.type) {
    case 'metric':
      return (
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted">{block.label}</p>
          <p className="text-xl font-semibold tabular-nums">{formatMoney(block.value_minor, block.currency)}</p>
        </div>
      )
    case 'table':
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                {block.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {r.map((cell, j) => (
                    <td key={j} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'payment_draft':
      return (
        <div className="rounded-md border border-warn/40 p-3 text-sm">
          <p className="font-medium">Payment draft — not executed</p>
          <p className="mt-1">
            {formatMoney(block.draft.amount_minor, block.draft.currency)} to {block.draft.vendor_name} from{' '}
            {block.draft.source_account_name}
          </p>
          <p className="text-muted">Memo: {block.draft.memo}</p>
          <Link to="/payments" className="mt-2 inline-block text-brand">
            Review &amp; confirm on Payments →
          </Link>
        </div>
      )
    default:
      return null
  }
}

export default function CommandPage() {
  const dispatch = useAppDispatch()
  const { messages, status } = useAppSelector((s) => s.command)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages.length])

  function submit(e: FormEvent) {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || status === 'loading') return
    setText('')
    void dispatch(sendCommand(msg))
  }

  return (
    <>
      <PageHeader
        title="Command Center"
        description={
          isMockApi
            ? 'Ask questions about your synthetic finances. Responses are mocked (no server connected).'
            : 'Ask questions about your synthetic finances. Answers are grounded in database results. Payments are only ever drafted here — you confirm them on the Payments page.'
        }
        action={
          messages.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => dispatch(clearConversation())}>
              New conversation
            </Button>
          ) : undefined
        }
      />
      <Card className="flex min-h-[28rem] flex-col">
        <div className="flex-1 space-y-4 p-4" aria-live="polite">
          {messages.length === 0 && (
            <div>
              <p className="mb-3 text-sm text-muted">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => setText(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-lg bg-brand/10 p-3 text-sm' : 'max-w-[90%] space-y-2 text-sm'}
            >
              {m.role === 'error' ? (
                <p role="alert" className="text-danger">
                  {m.text}
                </p>
              ) : (
                <p>{m.text}</p>
              )}
              {m.blocks?.map((b, i) => (
                <Block key={i} block={b} />
              ))}
              {m.tools && m.tools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.tools.map((t, i) => (
                    <Badge key={i} tone={t.status === 'succeeded' ? 'ok' : 'danger'}>
                      {t.tool_name}: {t.status}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
          {status === 'loading' && (
            <p role="status" className="animate-pulse text-sm text-muted">
              Thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
          <label htmlFor="command-input" className="sr-only">
            Message
          </label>
          <Input
            id="command-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            placeholder="Ask about balances, expenses, vendors, invoices…"
          />
          <Button type="submit" disabled={status === 'loading' || !text.trim()}>
            Send
          </Button>
        </form>
      </Card>
    </>
  )
}
