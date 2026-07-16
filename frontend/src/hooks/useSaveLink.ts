import { useCallback, useState } from 'react'
import { ApiError } from '../api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type SavedLinkPrefix = '/c/' | '/s/'

export interface SaveLinkState {
  status: SaveStatus
  slug: string | null
  errorMessage: string | null
  copied: boolean
  handleSave: () => void
  handleCopy: () => void
}

// Shared by the solo and synastry reveal screens - only the save call and
// the URL prefix ('/c/' vs '/s/') differ between them.
export function useSaveLink(save: () => Promise<string>, pathPrefix: SavedLinkPrefix): SaveLinkState {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [slug, setSlug] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSave = useCallback(() => {
    setStatus('saving')
    setErrorMessage(null)
    save()
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
  }, [save, pathPrefix])

  const handleCopy = useCallback(() => {
    if (!slug) return
    const url = `${window.location.origin}${pathPrefix}${slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [slug, pathPrefix])

  return { status, slug, errorMessage, copied, handleSave, handleCopy }
}
