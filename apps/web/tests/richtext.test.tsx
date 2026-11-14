import { render, screen } from '@testing-library/react'
import { RichText } from '@/components/command/RichText'

describe('RichText (model answers)', () => {
  it('renders bold, lists and tables as real elements, with no raw markdown left', () => {
    const { container } = render(
      <RichText
        text={'Totals were **$1,529.00** and **$1,265.00**.\n\n1. First\n2. Second\n\n| Vendor | Spend |\n|---|---|\n| AWS | $2,772.00 |'}
      />,
    )
    expect(container.textContent).not.toContain('**')
    expect(screen.getAllByText(/\$1,529\.00/)[0].tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Vendor' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '$2,772.00' })).toBeInTheDocument()
  })

  it('never turns model output into markup', () => {
    const { container } = render(<RichText text={'<img src=x onerror=alert(1)> and <script>alert(1)</script> **ok**'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>')
  })

  it('survives malformed tables', () => {
    expect(() => render(<RichText text={'|---|---|'} />)).not.toThrow()
  })
})
