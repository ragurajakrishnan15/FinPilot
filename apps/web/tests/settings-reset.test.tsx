import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { api, __resetMockState } from '@/services/api'
import { makeStore } from '@/store'

beforeEach(() => __resetMockState())

describe('Settings: reset demo data', () => {
  it('asks for confirmation, then restores the original sample data', async () => {
    const before = (await api.getDrafts()).length
    await api.createPaymentDraft({
      vendor_id: (await api.getVendors())[0]!.id,
      amount_minor: 5000,
      source_account_id: (await api.getAccounts())[0]!.id,
      memo: 'x',
    })
    expect((await api.getDrafts()).length).toBe(before + 1)

    render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={['/settings']}>
          <App />
        </MemoryRouter>
      </Provider>,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Reset demo data' }))

    // Nothing happens until it is confirmed.
    expect((await api.getDrafts()).length).toBe(before + 1)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Reset demo data?')
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(async () => expect((await api.getDrafts()).length).toBe(before))
  })

  it('cancelling the dialog leaves the data alone', async () => {
    const before = (await api.getDrafts()).length
    await api.createPaymentDraft({
      vendor_id: (await api.getVendors())[0]!.id,
      amount_minor: 5000,
      source_account_id: (await api.getAccounts())[0]!.id,
      memo: 'x',
    })
    render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={['/settings']}>
          <App />
        </MemoryRouter>
      </Provider>,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Reset demo data' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect((await api.getDrafts()).length).toBe(before + 1)
  })
})
