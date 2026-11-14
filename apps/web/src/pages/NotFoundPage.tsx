import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="That address doesn't match anything here. It may have moved, or the link may be wrong."
      />
      <Button asChild>
        <Link to="/">Go to the dashboard</Link>
      </Button>
    </>
  )
}
