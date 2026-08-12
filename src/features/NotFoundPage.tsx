import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/primitives'

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="That address does not match anything in Dental Flow."
      action={
        <Link to="/patients" className="text-sm font-medium text-clinic hover:underline">
          Back to patients
        </Link>
      }
    />
  )
}
