import { clerkEnabled } from '../clerkConfig'
import { MyChartsList } from '../components/MyChartsList'

// MyChartsList (via useMyCharts) already renders its own "sign in to see
// your saved charts" notice when the visitor is signed out - the guard here
// only exists to avoid mounting it (and its unconditional useAuth() call)
// when Clerk isn't configured at all, matching the original mode==='mine'
// tab's clerkEnabled guard.
export function SavedPage() {
  if (!clerkEnabled) {
    return <p className="notice">Sign in to see your saved charts.</p>
  }
  return <MyChartsList />
}
