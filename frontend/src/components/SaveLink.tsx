import type { SavedLinkPrefix } from '../hooks/useSaveLink'
import { useSaveLink } from '../hooks/useSaveLink'

interface SaveLinkProps {
  save: (token: string | undefined) => Promise<string>
  pathPrefix: SavedLinkPrefix
  initialSlug?: string
}

export function SaveLink({ save, pathPrefix, initialSlug }: SaveLinkProps) {
  const { status, errorMessage, copied, handleSave, handleCopy, handleDownloadCard, cardImageUrl } =
    useSaveLink(save, pathPrefix, initialSlug)

  if (status === 'saved') {
    return (
      <div className="save-link">
        <button type="button" className="save-link-button" onClick={handleCopy}>
          Copy link
        </button>
        {cardImageUrl && (
          <button
            type="button"
            className="save-link-button save-link-button--secondary"
            onClick={handleDownloadCard}
          >
            Download card
          </button>
        )}
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
