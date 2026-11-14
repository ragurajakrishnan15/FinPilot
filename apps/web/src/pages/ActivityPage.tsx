import { AsyncBoundary, EmptyState } from '@/components/States'
import { Badge, Card, PageHeader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { api } from '@/services/api'

export default function ActivityPage() {
  const state = useAsync(() => api.getAuditEvents())
  return (
    <>
      <PageHeader title="Activity" description="Audit log of state-changing operations and AI tool use." />
      <Card>
        <AsyncBoundary state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No activity yet" />}>
          {(events) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Time
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Actor
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Action
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Target
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2">{new Date(e.at).toLocaleString()}</td>
                      <td className="px-4 py-2">{e.actor}</td>
                      <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                      <td className="px-4 py-2">{e.target}</td>
                      <td className="px-4 py-2">
                        <Badge tone={e.status === 'succeeded' ? 'ok' : 'danger'}>{e.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncBoundary>
      </Card>
    </>
  )
}
