import type { SavedLinkPrefix } from '../hooks/useSaveLink'
import { useSaveLink } from '../hooks/useSaveLink'

interface SaveLinkProps {
  save: () => Promise<string>
  pathPrefix: SavedLinkPrefix
}

export function SaveLink({ save, pathPrefix }: SaveLinkProps) {
  const { status, errorMessage, copied, handleSave, handleCopy } = useSaveLink(save, pathPrefix)

  if (status === 'saved') {
    return (
      <div className="save-link">
        <button type="button" className="save-link-button" onClick={handleCopy}>
          Copy link
        </button>
        <span className="save-link__status" role="status" aria-live="polite">
          {copied ? 'Link copied!' : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="save-link">
      <button
        type="button"
        className="save-link-button"
        onClick={handleSave}
        disabled={status === 'saving'}
      >
        {status === 'saving' ? 'Saving…' : 'Save & get link'}
      </button>
      {status === 'error' && <p className="notice notice-error">{errorMessage}</p>}
    </div>
  )
}
