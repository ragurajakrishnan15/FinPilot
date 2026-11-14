import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { __resetMockState } from '@/services/api'
import { makeStore } from '@/store'

function renderAt(path: string) {
  return render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>,
  )
}

beforeEach(() => __resetMockState())

describe('routes render with mock data', () => {
  it.each([
    ['/', 'November 2026'], // the dashboard is titled by the period it covers
    ['/command', 'Command Center'],
    ['/accounts', 'Accounts'],
    ['/transactions', 'Transactions'],
    ['/vendors', 'Vendors'],
    ['/invoices', 'Invoices'],
    ['/payments', 'Payments'],
    ['/activity', 'Activity'],
    ['/settings', 'Settings'],
  ])('%s shows the %s heading', async (path, heading) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('always shows the synthetic/simulated notice', () => {
    renderAt('/')
    const notes = screen.getAllByRole('note') // one placement per breakpoint
    expect(notes.length).toBeGreaterThan(0)
    for (const n of notes) expect(n).toHaveTextContent(/simulated/i)
  })
})

describe('dashboard', () => {
  it('offers a table view of the chart for exact figures', async () => {
    renderAt('/')
    await screen.findByRole('heading', { level: 1, name: 'November 2026' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Table' }))
    expect(await screen.findByRole('table', { name: /Money in and money out by month/ })).toBeInTheDocument()
  })
})

describe('command center', () => {
  it('renders an assistant answer for a balance question', async () => {
    renderAt('/command')
    await userEvent.type(await screen.findByLabelText('Message'), 'What is our balance?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/combined balance/i)).toBeInTheDocument()
    expect(screen.getByText(/get_account_balance/)).toBeInTheDocument()
  })
})

describe('payments page', () => {
  it('reading a draft back does not execute it, and Back leaves it pending', async () => {
    renderAt('/payments')
    await userEvent.click(await screen.findByRole('button', { name: 'Review and confirm' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/No money moves/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('status', { name: 'Payment receipt' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review and confirm' })).toBeInTheDocument()
  })

  it('requires explicit confirmation in the review dialog and shows a simulated receipt', async () => {
    renderAt('/payments')
    await userEvent.click(await screen.findByRole('button', { name: 'Review and confirm' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm simulated payment' }))
    const receipt = await screen.findByRole('status', { name: 'Payment receipt' })
    expect(receipt).toHaveTextContent('NO MONEY MOVED')
  })
})

describe('command palette', () => {
  it('opens with Ctrl+K, lists destinations and prompts, and navigates', async () => {
    renderAt('/')
    await screen.findByRole('heading', { level: 1, name: 'November 2026' })
    await userEvent.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Payments')).toBeInTheDocument()
    expect(within(dialog).getByText(/Compare AWS expenses/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByText('Payments'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Payments' })).toBeInTheDocument()
  })
})

describe('error and empty routes', () => {
  it('shows a designed 404 with a way back', async () => {
    renderAt('/no-such-page')
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/')
  })
})

describe('accounts', () => {
  it('lists accounts and offers Pay from here only for non-credit accounts', async () => {
    renderAt('/accounts')
    expect(await screen.findByText('Operating Account')).toBeInTheDocument()
    expect(screen.getByText('Corporate Card')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Pay from here' })).toHaveLength(2) // checking + savings, not the card
  })
})

describe('pay this invoice', () => {
  it('opens Payments with a draft pre-filled from an unpaid invoice, without creating anything', async () => {
    renderAt('/invoices')
    await userEvent.click(await screen.findByRole('button', { name: 'INV-1002' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Prepare payment' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Payments' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (USD)')).toHaveValue('500.00')
    expect(screen.getByLabelText(/Memo/)).toHaveValue('Invoice INV-1002')
    expect(screen.queryByRole('status', { name: 'Payment receipt' })).not.toBeInTheDocument()
  })

  it('does not offer payment for a paid invoice', async () => {
    renderAt('/invoices')
    await userEvent.click(await screen.findByRole('tab', { name: /Paid/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'INV-1005' }))
    await screen.findByText('Invoice ID')
    expect(screen.queryByRole('button', { name: 'Prepare payment' })).not.toBeInTheDocument()
  })
})
