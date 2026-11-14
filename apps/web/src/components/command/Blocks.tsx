import { Link } from 'react-router-dom'
import { Amount } from '@/components/Amount'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ToolActivity, UiBlock } from '@/types/api'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate } from '@/lib/money'

/** Renders only the block types the backend defines (schema v1); anything else is ignored. */
export function Block({ block }: { block: UiBlock }) {
  switch (block.type) {
    case 'metric':
      return (
        <Card className="gap-1 px-5 py-4">
          <p className="text-sm text-muted-foreground">{block.label}</p>
          <p className="text-2xl font-medium tracking-[-0.02em]">
            <Amount cents={block.value_minor} currency={block.currency} />
          </p>
        </Card>
      )
    case 'table':
      return (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {block.columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((cell, j) => (
                    <TableCell key={j} className="whitespace-normal">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )
    case 'payment_draft':
      return (
        <Card className="gap-3 border-lamp/50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Payment draft</p>
            <StatusBadge status={block.draft.status} />
          </div>
          <p className="text-2xl font-medium tracking-[-0.02em]">
            <Amount cents={block.draft.amount_minor} currency={block.draft.currency} />
          </p>
          <p className="text-sm text-muted-foreground">
            To {block.draft.vendor_name} from {block.draft.source_account_name} · {formatDate(block.draft.execution_date)}
            {block.draft.memo ? ` · ${block.draft.memo}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">Not executed. Nothing is paid until you confirm it yourself.</p>
          <div>
            <Button asChild size="sm">
              <Link to="/payments">Review and confirm</Link>
            </Button>
          </div>
        </Card>
      )
    default:
      return null
  }
}

/** The instrument log: which tools ran for an answer, in the order they ran. */
export function ToolLog({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground" aria-label="Tools used">
      {tools.map((t, i) => (
        <li key={i} className="flex items-center gap-2">
          <span aria-hidden className={`size-1.5 rounded-full ${t.status === 'succeeded' ? 'bg-positive' : 'bg-negative'}`} />
          {t.tool_name}
          <span className="text-muted-foreground/70">{t.status}</span>
        </li>
      ))}
    </ul>
  )
}
