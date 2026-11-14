import { AsyncBoundary } from '@/components/States'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { api, isMockApi } from '@/services/api'

export default function SettingsPage() {
  const me = useAsync(() => api.getMe())
  const health = useAsync(() => api.getHealth())
  return (
    <>
      <PageHeader title="Settings" description="Demo workspace information." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Workspace & user" />
          <AsyncBoundary state={me}>
            {(m) => (
              <dl className="grid grid-cols-[8rem_1fr] gap-2 p-4 text-sm">
                <dt className="text-muted">Workspace</dt>
                <dd>{m.workspace.name}</dd>
                <dt className="text-muted">User</dt>
                <dd>{m.display_name}</dd>
                <dt className="text-muted">Email</dt>
                <dd>{m.email}</dd>
                <dt className="text-muted">Role</dt>
                <dd>
                  <Badge>{m.role}</Badge>
                </dd>
              </dl>
            )}
          </AsyncBoundary>
        </Card>
        <Card>
          <CardHeader title="Demo status" />
          <div className="space-y-2 p-4 text-sm">
            <p>
              {isMockApi ? (
                <>
                  <Badge tone="warn">Mock data</Badge> Running on in-memory synthetic data (no server).
                </>
              ) : (
                <>
                  <Badge tone="ok">Live API</Badge> Data is served from PostgreSQL through the Haskell API.
                </>
              )}
            </p>
            <p aria-live="polite">
              API health:{' '}
              {health.loading ? (
                <Badge>checking…</Badge>
              ) : health.error ? (
                <Badge tone="danger">unreachable</Badge>
              ) : (
                <Badge tone="ok">{health.data?.status}</Badge>
              )}
            </p>
            <p className="text-muted">All data is invented and all payments are simulated.</p>
          </div>
        </Card>
      </div>
    </>
  )
}
