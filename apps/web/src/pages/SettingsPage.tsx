import { useState } from 'react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary } from '@/components/States'
import { useAsync } from '@/hooks/useAsync'
import { api, isMockApi } from '@/services/api'
import { useAppDispatch, useAppSelector } from '@/store'
import { setTheme, type ThemePreference } from '@/store/uiSlice'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

export default function SettingsPage() {
  const me = useAsync(() => api.getMe())
  const health = useAsync(() => api.getHealth())
  const dispatch = useAppDispatch()
  const theme = useAppSelector((s) => s.ui.theme)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const canReset = me.data?.role === 'owner' || me.data?.role === 'admin'

  async function resetDemo() {
    setResetting(true)
    try {
      const r = await api.resetDemo()
      const removed = r.payments_removed + r.drafts_removed + r.invoices_removed + r.conversations_removed
      toast.success(removed === 0 ? 'Demo data was already clean' : 'Demo data reset to the original sample data')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset the demo data')
    } finally {
      setResetting(false)
      setConfirmingReset(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your workspace, how the app looks, and what it is connected to." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-medium">Workspace and user</CardTitle>
          </CardHeader>
          <AsyncBoundary state={me}>
            {(m) => (
              <dl className="divide-y divide-border px-5">
                <Row label="Workspace">{m.workspace.name}</Row>
                <Row label="User">{m.display_name}</Row>
                <Row label="Email">{m.email}</Row>
                <Row label="Role">
                  <Badge variant="secondary" className="font-normal">
                    {m.role}
                  </Badge>
                </Row>
              </dl>
            )}
          </AsyncBoundary>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-medium">Appearance</CardTitle>
            <CardDescription>System follows your device setting.</CardDescription>
          </CardHeader>
          <div className="p-5">
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(v) => v && dispatch(setTheme(v as ThemePreference))}
              aria-label="Theme"
            >
              <ToggleGroupItem value="light" className="px-4">
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className="px-4">
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" className="px-4">
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-medium">Connection</CardTitle>
          </CardHeader>
          <dl className="divide-y divide-border px-5" aria-live="polite">
            <Row label="Data source">
              {isMockApi ? <Badge variant="outline">Mock data, no server</Badge> : <Badge variant="outline">Live API</Badge>}
            </Row>
            <Row label="API health">
              {health.loading ? (
                <Badge variant="outline">Checking</Badge>
              ) : health.error ? (
                <Badge variant="destructive">Unreachable</Badge>
              ) : (
                <Badge variant="outline">{health.data?.status}</Badge>
              )}
            </Row>
          </dl>
        </Card>

        {canReset && (
          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-sm font-medium">Demo data</CardTitle>
              <CardDescription>
                Removes the payments, drafts, invoices and conversations created while trying the app, and restores account balances. The
                activity log is kept.
              </CardDescription>
            </CardHeader>
            <div className="p-5">
              <Button variant="outline" onClick={() => setConfirmingReset(true)}>
                Reset demo data
              </Button>
            </div>
          </Card>
        )}

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-medium">About this demo</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-muted-foreground">
            <li>All data is invented. No real bank or customer records are used.</li>
            <li>Payments are simulated. Confirming one updates this demo&apos;s ledger and nothing else.</li>
            <li>The assistant can draft payments but can never confirm them.</li>
          </ul>
        </Card>
      </div>

      <AlertDialog open={confirmingReset} onOpenChange={(o) => !o && !resetting && setConfirmingReset(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              Payments, drafts, invoices and conversations you created will be removed and balances restored. The activity log is kept. This
              only affects this demo workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting}
              onClick={(e) => {
                e.preventDefault()
                void resetDemo()
              }}
            >
              {resetting ? 'Resetting' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
