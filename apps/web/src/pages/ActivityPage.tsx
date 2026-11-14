import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { AsyncBoundary, EmptyState } from '@/components/States'
import { StatusBadge } from '@/components/StatusBadge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAsync } from '@/hooks/useAsync'
import { api } from '@/services/api'

type Filter = 'all' | 'succeeded' | 'problems'

export default function ActivityPage() {
  const state = useAsync(() => api.getAuditEvents())
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  return (
    <>
      <PageHeader
        title="Activity"
        description="A record of every change and every AI tool call. Arguments and prompts are never stored here."
      />
      <AsyncBoundary state={state}>
        {(events) => {
          const needle = q.trim().toLowerCase()
          const rows = events.filter(
            (e) =>
              (filter === 'all' || (filter === 'succeeded' ? e.status === 'succeeded' : e.status !== 'succeeded')) &&
              (!needle || `${e.actor} ${e.action} ${e.target}`.toLowerCase().includes(needle)),
          )
          return (
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="succeeded">Succeeded</TabsTrigger>
                  <TabsTrigger value="problems">Rejected or failed</TabsTrigger>
                </TabsList>
                <Input
                  aria-label="Search activity"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search actor, action or target"
                  className="w-full sm:w-72"
                />
              </div>
              <TabsContent value={filter}>
                <Card className="gap-0 overflow-hidden py-0">
                  {rows.length === 0 ? (
                    <EmptyState title="No activity matches" hint="Change the filter or clear the search." />
                  ) : (
                    <Table>
                      <caption className="sr-only">Audit events</caption>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="hidden pl-5 sm:table-cell">Time</TableHead>
                          <TableHead className="hidden sm:table-cell">Actor</TableHead>
                          <TableHead className="pl-5 sm:pl-2">Action</TableHead>
                          <TableHead className="hidden md:table-cell">Target</TableHead>
                          <TableHead className="pr-5">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="hidden whitespace-nowrap pl-5 text-muted-foreground sm:table-cell">
                              {new Date(e.at).toLocaleString()}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{e.actor}</TableCell>
                            <TableCell className="pl-5 whitespace-normal sm:pl-2">
                              <span className="font-mono text-xs">{e.action}</span>
                              {/* On phones the actor and time fold under the action so the table never scrolls sideways. */}
                              <span className="mt-1 block text-xs text-muted-foreground sm:hidden">
                                {e.actor} · {new Date(e.at).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="hidden max-w-[16rem] truncate font-mono text-xs text-muted-foreground md:table-cell">
                              {e.target}
                            </TableCell>
                            <TableCell className="pr-5">
                              <StatusBadge status={e.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          )
        }}
      </AsyncBoundary>
    </>
  )
}
