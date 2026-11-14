import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { Amount } from '@/components/Amount'
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { monthLong, monthShort } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import type { MonthlyPoint } from '@/types/api'

// Two series: the accent leads (money in), a quiet neutral follows (money out). Identity is never colour alone:
// there is a legend, a tooltip, a direct label on the current month and a table view.
const config = {
  inflow: { label: 'Money in', color: 'var(--signal)' },
  outflow: { label: 'Money out', color: 'var(--chart-out)' },
} satisfies ChartConfig

const compact = (cents: number) => (cents === 0 ? '$0' : `$${Math.round(cents / 100000)}k`)

function Legend() {
  return (
    <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
      {(['inflow', 'outflow'] as const).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px]" style={{ background: config[k].color }} />
          {config[k].label}
        </li>
      ))}
    </ul>
  )
}

// Recharts passes loosely typed label props; read only what is needed and coerce explicitly.
interface LabelProps {
  x?: unknown
  y?: unknown
  width?: unknown
  index?: unknown
  value?: unknown
}

export function CashFlowChart({ monthly }: { monthly: MonthlyPoint[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const last = monthly.length - 1
  const data = monthly.map((m) => ({ month: m.month, label: monthShort(m.month), inflow: m.inflow_minor, outflow: m.outflow_minor }))
  const currentLabel = (p: LabelProps) => {
    if (p.index !== last) return <g />
    return (
      <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 6} textAnchor="middle" className="fill-foreground font-mono text-[10px]">
        {compact(Number(p.value))}
      </text>
    )
  }

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as 'chart' | 'table')} className="h-full gap-0">
      <Card className="h-full gap-0 py-0">
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-sm font-medium">Cash flow, last {monthly.length} months</CardTitle>
          {/* On phones the controls drop under the title instead of squeezing it. */}
          <CardAction className="flex flex-wrap items-center gap-x-4 gap-y-2 max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-3 max-sm:justify-self-start">
            <Legend />
            <TabsList className="h-8">
              <TabsTrigger value="chart" className="px-2.5 text-xs">
                Chart
              </TabsTrigger>
              <TabsTrigger value="table" className="px-2.5 text-xs">
                Table
              </TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>

        <TabsContent value="chart" className="flex flex-1 flex-col">
          <div
            className="flex-1 p-5 pt-6"
            role="img"
            aria-label="Bar chart of money in and money out for each of the last months. Use the Table view for exact figures."
          >
            <ChartContainer config={config} className="aspect-auto h-full min-h-72 w-full">
              <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} tickMargin={4} className="font-mono" />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, items) => monthLong(String(items?.[0]?.payload?.month ?? ''))}
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-6">
                          <span className="text-muted-foreground">{name === 'inflow' ? 'Money in' : 'Money out'}</span>
                          <span className="num font-mono font-medium">{formatMoney(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="inflow" fill="var(--color-inflow)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false}>
                  <LabelList dataKey="inflow" content={currentLabel} />
                </Bar>
                <Bar dataKey="outflow" fill="var(--color-outflow)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Table>
            <caption className="sr-only">Money in and money out by month</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Month</TableHead>
                <TableHead className="text-right">Money in</TableHead>
                <TableHead className="text-right">Money out</TableHead>
                <TableHead className="pr-5 text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...monthly].reverse().map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="pl-5">{monthLong(m.month)}</TableCell>
                  <TableCell className="text-right">
                    <Amount cents={m.inflow_minor} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Amount cents={m.outflow_minor} />
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Amount cents={m.inflow_minor - m.outflow_minor} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Card>
    </Tabs>
  )
}
