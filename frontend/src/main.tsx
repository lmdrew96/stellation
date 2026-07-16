import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkAuthTokenBridge } from './components/ClerkAuthTokenBridge.tsx'
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from './clerkConfig'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkEnabled ? (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!}>
        <ClerkAuthTokenBridge>
          <App />
        </ClerkAuthTokenBridge>
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
