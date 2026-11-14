import { Link } from 'react-router-dom'
import { Amount } from '@/components/Amount'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAsync } from '@/hooks/useAsync'
import { api } from '@/services/api'
import type { Account } from '@/types/api'

const kindLabel: Record<Account['kind'], string> = { checking: 'Checking', savings: 'Savings', credit: 'Credit card' }

export default function AccountsPage() {
  const state = useAsync(() => api.getAccounts())
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Where the money sits. Payments can be drawn from checking and savings, never from a credit card."
      />
      <AsyncBoundary state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No accounts yet" />}>
        {(accounts) => {
          const total = accounts.reduce((s, a) => s + a.balance_minor, 0)
          return (
            <div className="space-y-4">
              <Card className="gap-1 px-5 py-4">
                <p className="text-sm text-muted-foreground">Net across all accounts</p>
                <p className="text-2xl font-medium tracking-[-0.02em]">
                  <Amount cents={total} />
                </p>
                <p className="text-xs text-muted-foreground">Credit card balances count as negative</p>
              </Card>
              <Card className="gap-0 overflow-hidden py-0">
                <Table>
                  <caption className="sr-only">Accounts</caption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="pr-5 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="pl-5 font-medium">{a.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {kindLabel[a.kind]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Amount cents={a.balance_minor} currency={a.currency} />
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          {a.kind !== 'credit' ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link to="/payments" state={{ accountId: a.id }}>
                                Pay from here
                              </Link>
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )
        }}
      </AsyncBoundary>
    </>
  )
}
