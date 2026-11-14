import { Check, TriangleAlert } from 'lucide-react'
import { Amount } from '@/components/Amount'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/money'
import type { Account, PaymentDraft } from '@/types/api'

function Item({ ok = true, label, children }: { ok?: boolean; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        aria-hidden
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${ok ? 'border-border bg-secondary' : 'border-destructive/50 text-destructive'}`}
      >
        {ok ? <Check strokeWidth={2} className="size-3" /> : <TriangleAlert strokeWidth={2} className="size-3" />}
      </span>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="min-w-0 text-right">{children}</span>
      </div>
    </li>
  )
}

/** The pre-flight check: every line of the draft is read back before anything is executed. */
export function ConfirmDialog({
  draft,
  account,
  busy,
  onConfirm,
  onClose,
}: {
  draft: PaymentDraft | undefined
  account: Account | undefined
  busy: boolean
  onConfirm: (d: PaymentDraft) => void
  onClose: () => void
}) {
  const covered = draft && account ? account.balance_minor >= draft.amount_minor : true
  return (
    <AlertDialog open={draft !== undefined} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        {draft ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Review before confirming</AlertDialogTitle>
              <AlertDialogDescription>Confirm only if each line is right. A confirmed payment cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="divide-y divide-border rounded-lg border border-border px-4">
              <Item label="Payee">{draft.vendor_name}</Item>
              <Item label="Amount">
                <Amount cents={draft.amount_minor} currency={draft.currency} className="font-medium" />
              </Item>
              <Item label="From" ok={covered}>
                {draft.source_account_name}
                {account ? (
                  <span className="block text-xs text-muted-foreground">
                    {covered ? 'Balance ' : 'Balance too low: '}
                    <Amount cents={account.balance_minor} />
                  </span>
                ) : null}
              </Item>
              <Item label="Date">{formatDate(draft.execution_date)}</Item>
              {draft.memo ? <Item label="Memo">{draft.memo}</Item> : null}
              <Item label="Simulation">Updates the demo ledger only. No money moves.</Item>
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault() // stay open until the server answers
                  onConfirm(draft)
                }}
              >
                Confirm simulated payment
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}
