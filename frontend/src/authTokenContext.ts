import { createContext } from 'react'

// Lets the always-mounted SaveLink call sites (anonymous saves must keep
// working whether or not Clerk is configured) get a token when signed in,
// without ever calling Clerk's own useAuth() directly - that throws outside
// a ClerkProvider, and conditionally calling a hook violates React's rules.
// The default is a safe no-op; ClerkAuthTokenBridge overrides it with the
// real thing, and is only ever mounted when Clerk is actually configured.
export const AuthTokenContext = createContext<() => Promise<string | undefined>>(() =>
  Promise.resolve(undefined),
)
