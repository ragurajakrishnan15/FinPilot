import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function Boom(): never {
  throw new Error('secret internal detail')
}

describe('ErrorBoundary', () => {
  it('shows a safe message instead of blanking the app, and never leaks the error text', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong on this page')
    expect(alert).not.toHaveTextContent('secret internal detail')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders children normally when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
