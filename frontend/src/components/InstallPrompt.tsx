import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'stellation-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome/Edge only fire beforeinstallprompt once per page load and expect
// preventDefault() synchronously in the handler if we want to replay it
// later via our own button - so it's captured in state the moment it fires
// and only *used* on click. iOS Safari never fires this event at all (there
// is no programmatic install prompt there), so this component naturally
// never renders on iOS - that's expected, not a bug to fix.
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Private browsing / storage disabled - prompt will just reappear
      // next session, which is a harmless fallback.
    }
  }

  const install = async () => {
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="install-prompt" role="group" aria-label="Install Stellation">
      <span>Install Stellation for one-tap access</span>
      <button type="button" className="install-prompt__action" onClick={install}>
        Install
      </button>
      <button
        type="button"
        className="install-prompt__dismiss"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
      >
        ×
      </button>
    </div>
  )
}
