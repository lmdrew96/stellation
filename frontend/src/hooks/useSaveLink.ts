import { useCallback, useContext, useState } from 'react'
import { ApiError } from '../api'
import { AuthTokenContext } from '../authTokenContext'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type SavedLinkPrefix = '/c/' | '/s/'

// The app route (pushed to the address bar, for the owner's own bookmarking)
// vs. the share route (what gets copied to share with others). They differ
// because the frontend is a pure SPA - a social crawler unfurling the app
// route only ever sees index.html's generic static preview, never this
// specific chart. /api/share/... is a backend-rendered shell with real
// per-chart OG tags that redirects real humans straight into the app route.
const SHARE_PREFIX: Record<SavedLinkPrefix, string> = {
  '/c/': '/api/share/c/',
  '/s/': '/api/share/s/',
}

export interface SaveLinkState {
  status: SaveStatus
  slug: string | null
  errorMessage: string | null
  copied: boolean
  handleSave: () => void
  handleCopy: () => void
  cardImageUrl: string | null
}

// Shared by the solo and synastry reveal screens - only the save call and
// the URL prefix ('/c/' vs '/s/') differ between them. initialSlug is set
// when the page was opened via its own /c|s/:slug permalink - the chart is
// already saved, so this starts straight in the 'saved' state (Copy
// link/Download card) instead of showing "Save & get link" again, which
// would just insert a duplicate row for a chart that's already there.
export function useSaveLink(
  save: (token: string | undefined) => Promise<string>,
  pathPrefix: SavedLinkPrefix,
  initialSlug?: string,
): SaveLinkState {
  const [status, setStatus] = useState<SaveStatus>(initialSlug ? 'saved' : 'idle')
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const getToken = useContext(AuthTokenContext)

  const handleSave = useCallback(() => {
    setStatus('saving')
    setErrorMessage(null)
    getToken()
      .then((token) => save(token))
      .then((newSlug) => {
        setSlug(newSlug)
        setStatus('saved')
        // Makes the address bar itself the shareable link, not just the copy button.
        window.history.pushState({}, '', pathPrefix + newSlug)
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err instanceof ApiError ? err.detail.message : 'Could not save this chart.')
      })
  }, [save, pathPrefix, getToken])

  const handleCopy = useCallback(() => {
    if (!slug) return
    const url = `${window.location.origin}${SHARE_PREFIX[pathPrefix]}${slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [slug, pathPrefix])

  const cardImageUrl = slug ? `${SHARE_PREFIX[pathPrefix]}${slug}/card.png` : null

  return { status, slug, errorMessage, copied, handleSave, handleCopy, cardImageUrl }
}
