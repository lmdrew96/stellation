import { Show } from '@clerk/react'
import { clerkEnabled } from '../clerkConfig'
import { LandingPage } from './LandingPage'
import { YourDayPage } from './YourDayPage'

// "/" is Landing for signed-out visitors (or any visit when Clerk isn't
// configured at all) and Your Day - the signed-in landing - once a session
// exists.
export function HomeRoute() {
  if (!clerkEnabled) return <LandingPage />
  return (
    <>
      <Show when="signed-in">
        <YourDayPage />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  )
}
