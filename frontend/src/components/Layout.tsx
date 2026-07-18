import { Show } from '@clerk/react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { clerkEnabled } from '../clerkConfig'
import { AccountControls } from './AccountControls'
import { ThemeToggle } from './ThemeToggle'
import { Wordmark } from './Wordmark'

type HealthStatus = 'checking' | 'ok' | 'error'
type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'stellation-theme'

// The inline bootstrap script in index.html already set data-theme on
// <html> before first paint (avoids a flash of the wrong theme) - read that
// back rather than re-deriving it, so React's initial state always agrees
// with what's already on screen.
function initialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'light' ? 'light' : 'dark'
}

// Persistent chrome across every route: masthead (theme/wordmark/account),
// primary nav, and the backend-status footer. Theme and the health check
// live here rather than in ChartSessionContext - if that context's value
// were ever read from here, this always-mounted wrapper would re-render on
// every keystroke/fetch across both the Solo and Synastry flows.
function MastheadAndNav({ theme, onThemeChange }: { theme: Theme; onThemeChange: (t: Theme) => void }) {
  return (
    <>
      <div className="masthead__bar">
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <Wordmark />
        {clerkEnabled && <AccountControls />}
      </div>
      <nav className="site-nav" aria-label="Primary">
        <NavLink to="/" end className="site-nav__link">
          Home
        </NavLink>
        <NavLink to="/solo" className="site-nav__link">
          Solo
        </NavLink>
        <NavLink to="/synastry" className="site-nav__link">
          Synastry
        </NavLink>
        {clerkEnabled && (
          <Show when="signed-in">
            <NavLink to="/saved" className="site-nav__link">
              Saved
            </NavLink>
            <NavLink to="/profile" className="site-nav__link">
              Profile
            </NavLink>
          </Show>
        )}
      </nav>
    </>
  )
}

export function Layout() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [health, setHealth] = useState<HealthStatus>('checking')
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Private browsing / storage disabled - theme just won't persist.
    }
  }, [theme])

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? setHealth('ok') : setHealth('error')))
      .catch(() => setHealth('error'))
  }, [])

  return (
    <div className="page">
      {/* "/" renders LandingPage when signed out (or Clerk isn't
          configured at all) and YourDayPage when signed in - see
          HomeRoute.tsx. The masthead/nav is redundant chrome on the
          landing page (it has its own hero wordmark and sign-in CTA), but
          must stay for Your Day. Mirrors HomeRoute's own Show-based
          gating rather than calling useAuth() directly here, so the two
          conditions can't drift out of sync silently. */}
      {isHome ? (
        clerkEnabled && (
          <Show when="signed-in">
            <MastheadAndNav theme={theme} onThemeChange={setTheme} />
          </Show>
        )
      ) : (
        <MastheadAndNav theme={theme} onThemeChange={setTheme} />
      )}
      <main className="app">
        <Outlet />
      </main>
      <div className="backend-status" data-state={health}>
        <span className="backend-status__dot" />
        Backend {health}
      </div>
    </div>
  )
}
