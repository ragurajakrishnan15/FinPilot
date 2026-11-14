import { Fragment, type ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// A deliberately small markdown subset for model answers: paragraphs, bullet/numbered lists, tables, **bold**, `code`.
// Everything is built from React elements, so model output can never inject markup.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    out.push(
      tok.startsWith('**') ? (
        <strong key={i++} className="font-medium">
          {tok.slice(2, -2)}
        </strong>
      ) : (
        <code key={i++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      ),
    )
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

const isTableLine = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|')
const isRule = (l: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l.trim())

export function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
    } else if (isTableLine(line)) {
      const rows: string[] = []
      while (i < lines.length && isTableLine(lines[i])) rows.push(lines[i++])
      const body = rows.filter((r) => !isRule(r)).map(cells)
      const [head, ...rest] = body
      if (!head) continue // a lone separator row: nothing to render
      blocks.push(
        <div key={key++} className="my-2 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {head.map((c, j) => (
                  <TableHead key={j}>{inline(c)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rest.map((r, ri) => (
                <TableRow key={ri}>
                  {r.map((c, ci) => (
                    <TableCell key={ci}>{inline(c)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>,
      )
    } else if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ''))
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={key++} className={`my-2 space-y-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </Tag>,
      )
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !isTableLine(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++])
      blocks.push(
        <p key={key++} className="my-2 first:mt-0 last:mb-0">
          {para.map((p, j) => (
            <Fragment key={j}>
              {j > 0 ? <br /> : null}
              {inline(p)}
            </Fragment>
          ))}
        </p>,
      )
    }
  }
  return <div className="text-sm leading-6">{blocks}</div>
}
