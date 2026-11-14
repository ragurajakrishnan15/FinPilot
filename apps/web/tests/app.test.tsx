import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
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

describe('routes render with mock data', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/command', 'Command Center'],
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

  it('always shows the synthetic/simulated banner', () => {
    renderAt('/')
    expect(screen.getByRole('note')).toHaveTextContent(/simulated/i)
  })
})

describe('command center', () => {
  it('renders an assistant answer for a balance question', async () => {
    renderAt('/command')
    await userEvent.type(screen.getByLabelText('Message'), 'What is our balance?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/combined balance/i)).toBeInTheDocument()
    expect(screen.getByText(/get_account_balance/)).toBeInTheDocument()
  })
})

describe('payments page', () => {
  it('requires explicit confirmation and shows a simulated receipt', async () => {
    renderAt('/payments')
    const confirm = await screen.findByRole('button', { name: 'Confirm payment' })
    await userEvent.click(confirm)
    await waitFor(() => expect(screen.getByText(/NO MONEY MOVED/, { selector: 'p' })).toBeInTheDocument())
  })
})
