export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// Single source of truth for "is Clerk set up" - account UI, the My Charts
// tab, and the ClerkProvider mount itself all gate on this, so an
// unconfigured deploy just has no account features rather than crashing.
export const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY)
