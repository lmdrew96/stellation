import { clerkEnabled } from '../clerkConfig'
import { MyChartsList } from '../components/MyChartsList'
import { SavedPeopleList } from '../components/SavedPeopleList'

// MyChartsList/SavedPeopleList (via their own hooks) already render their
// own "sign in" notices when the visitor is signed out - the guard here
// only exists to avoid mounting either (and their unconditional useAuth()
// calls) when Clerk isn't configured at all, matching the original
// mode==='mine' tab's clerkEnabled guard.
export function SavedPage() {
  if (!clerkEnabled) {
    return <p className="notice">Sign in to see your saved charts.</p>
  }
  return (
    <>
      <section className="saved-section">
        <h2>My Charts</h2>
        <MyChartsList />
      </section>
      <section className="saved-section">
        <h2>Friend Diary</h2>
        <SavedPeopleList />
      </section>
    </>
  )
}
