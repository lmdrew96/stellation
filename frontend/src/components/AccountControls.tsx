import { Show, SignInButton, UserButton } from '@clerk/react'

// Only ever rendered behind clerkEnabled (see App.tsx), so it's always a
// ClerkProvider descendant. mode="modal" because Clerk's sign-in modal
// already includes a "sign up instead" link - no separate SignUpButton
// needed for this minimal a v1.
export function AccountControls() {
  return (
    <div className="masthead__account">
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="sign-in-button">
            Sign in
          </button>
        </SignInButton>
      </Show>
    </div>
  )
}
