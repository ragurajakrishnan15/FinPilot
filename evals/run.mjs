#!/usr/bin/env node
// Live eval harness for the Command Center. Zero dependencies (Node 20+).
//   node evals/run.mjs                              # local API on :8080, read-only cases
//   EVAL_API_URL=https://... node evals/run.mjs     # a deployed API
//   node evals/run.mjs --allow-writes               # also run cases that may create payment DRAFTS
//   node evals/run.mjs --only=balance,cash-flow     # subset
// Needs DEMO_MODE=true on the API (uses POST /api/demo-session). Writes evals/results/latest.json and latest.md.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const API = (process.env.EVAL_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const allowWrites = args.includes('--allow-writes')
const only = (args.find((a) => a.startsWith('--only='))?.slice(7) ?? '').split(',').filter(Boolean)
const PACE_MS = 7000 // the API allows 10 chat messages per user per minute

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const money = (minor) =>
  `$${(Math.abs(minor) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function http(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  return { status: res.status, json, text }
}

async function ask(token, message) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await http('/api/command', { token, method: 'POST', body: { message } })
    if (r.status === 429) {
      await sleep(25_000)
      continue
    }
    return r
  }
  return { status: 429, json: undefined, text: 'rate limited after retries' }
}

function check(c, r, balanceMinor) {
  const fails = []
  if (r.status !== 200 || !r.json) return [`HTTP ${r.status}: ${r.text.slice(0, 160)}`]
  const activity = r.json.tool_activity ?? []
  const tools = activity.map((t) => t.tool_name)
  const answer = String(r.json.answer ?? '')
  const blocks = (r.json.ui_blocks ?? []).map((b) => b.type)
  const blob = answer + ' ' + JSON.stringify(r.json.ui_blocks ?? [])
  for (const t of c.expectTools ?? []) if (!tools.includes(t)) fails.push(`expected tool ${t}; called [${tools.join(', ') || 'none'}]`)
  for (const t of c.forbidTools ?? []) if (tools.includes(t)) fails.push(`forbidden tool ${t} was called`)
  for (const b of c.blocks ?? []) if (!blocks.includes(b)) fails.push(`expected a ${b} block; got [${blocks.join(', ') || 'none'}]`)
  for (const p of c.answerMatches ?? []) if (!new RegExp(p, 'i').test(answer)) fails.push(`answer should match /${p}/`)
  for (const p of c.answerForbids ?? []) if (new RegExp(p, 'i').test(blob)) fails.push(`answer must not match /${p}/`)
  if (activity.some((t) => t.status === 'rejected')) fails.push('a tool call was rejected (invalid model arguments)')
  if (c.groundedBalance) {
    const metric = (r.json.ui_blocks ?? []).find((b) => b.type === 'metric')
    if (!metric || metric.value_minor !== balanceMinor) fails.push(`metric block ${metric?.value_minor} != database total ${balanceMinor}`)
    if (!answer.includes(money(balanceMinor))) fails.push(`answer text does not state ${money(balanceMinor)}`)
  }
  return fails
}

const health = await http('/health')
if (health.status !== 200) {
  console.error(`API at ${API} is not healthy (HTTP ${health.status}). A free-tier API may be waking; retry in a minute.`)
  process.exit(2)
}
const session = await http('/api/demo-session', { method: 'POST' })
if (!session.json?.token) {
  console.error('Could not get a demo session (is DEMO_MODE=true?).')
  process.exit(2)
}
const token = session.json.token
const accounts = (await http('/api/accounts', { token })).json ?? []
const balanceMinor = accounts.reduce((s, a) => s + a.balance_minor, 0)

const all = JSON.parse(await readFile(join(here, 'cases.json'), 'utf8'))
const cases = all.filter((c) => (only.length ? only.includes(c.id) : allowWrites || !c.writes))
const skipped = all.filter((c) => !cases.includes(c)).map((c) => c.id)

const results = []
for (const [i, c] of cases.entries()) {
  const t0 = Date.now()
  const r = await ask(token, c.prompt)
  const fails = check(c, r, balanceMinor)
  const ms = Date.now() - t0
  const tools = (r.json?.tool_activity ?? []).map((t) => t.tool_name)
  results.push({ id: c.id, prompt: c.prompt, pass: fails.length === 0, fails, ms, tools, answer: String(r.json?.answer ?? '').slice(0, 400) })
  console.log(
    `${fails.length ? 'FAIL' : 'pass'}  ${c.id.padEnd(24)} ${String(ms).padStart(5)} ms  tools=[${tools.join(', ')}]` +
      (fails.length ? '\n        - ' + fails.join('\n        - ') : ''),
  )
  if (i < cases.length - 1) await sleep(PACE_MS)
}

const passed = results.filter((r) => r.pass).length
const summary = { api: API, ran_at: new Date().toISOString(), passed, total: results.length, skipped_write_cases: skipped, results }
await mkdir(join(here, 'results'), { recursive: true })
await writeFile(join(here, 'results', 'latest.json'), JSON.stringify(summary, null, 2))
const md = [
  '# Live eval results',
  '',
  `API: \`${API}\` · ${summary.ran_at} · **${passed}/${results.length} passed**` +
    (skipped.length ? ` · skipped (write cases, use --allow-writes): ${skipped.join(', ')}` : ''),
  '',
  '| Case | Result | Latency | Tools called |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.pass ? 'pass' : 'FAIL: ' + r.fails.join('; ')} | ${(r.ms / 1000).toFixed(1)} s | ${r.tools.join(', ') || 'none'} |`),
  '',
].join('\n')
await writeFile(join(here, 'results', 'latest.md'), md)
console.log(`\n${passed}/${results.length} passed  (results in evals/results/)`)
process.exit(passed === results.length ? 0 : 1)
