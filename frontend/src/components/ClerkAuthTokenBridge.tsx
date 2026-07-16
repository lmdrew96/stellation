import { useAuth } from '@clerk/react'
import type { ReactNode } from 'react'
import { AuthTokenContext } from '../authTokenContext'

interface ClerkAuthTokenBridgeProps {
  children: ReactNode
}

// Only ever mounted inside <ClerkProvider> (see main.tsx), so calling
// useAuth() here is always safe.
export function ClerkAuthTokenBridge({ children }: ClerkAuthTokenBridgeProps) {
  const { getToken } = useAuth()

  return (
    <AuthTokenContext.Provider value={() => getToken().then((token) => token ?? undefined)}>
      {children}
    </AuthTokenContext.Provider>
  )
}
