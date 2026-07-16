import { useState } from 'react'

interface SolarReturnTriggerProps {
  birthPlaceName: string
  loading: boolean
  error: string | null
  onSubmit: (locationOverride?: string) => void
}

export function SolarReturnTrigger({
  birthPlaceName,
  loading,
  error,
  onSubmit,
}: SolarReturnTriggerProps) {
  const [expanded, setExpanded] = useState(false)
  const [useOverride, setUseOverride] = useState(false)
  const [overrideText, setOverrideText] = useState('')

  if (!expanded) {
    return (
      <div className="reveal-trigger">
        <button
          type="button"
          className="reveal-trigger__button"
          data-icon="↻"
          onClick={() => setExpanded(true)}
        >
          View This Year's Chart
        </button>
      </div>
    )
  }

  function handleGenerate() {
    onSubmit(useOverride && overrideText.trim() ? overrideText.trim() : undefined)
  }

  return (
    <div className="solar-return-trigger">
      <p className="solar-return-trigger__prompt">Cast for which location?</p>
      <label className="solar-return-trigger__option">
        <input
          type="radio"
          name="solar-return-location"
          checked={!useOverride}
          onChange={() => setUseOverride(false)}
        />
        Birth location ({birthPlaceName})
      </label>
      <label className="solar-return-trigger__option">
        <input
          type="radio"
          name="solar-return-location"
          checked={useOverride}
          onChange={() => setUseOverride(true)}
        />
        A different location
      </label>
      {useOverride && (
        <input
          type="text"
          className="solar-return-trigger__input"
          placeholder="City, State/Country"
          value={overrideText}
          onChange={(e) => setOverrideText(e.target.value)}
        />
      )}
      <div className="solar-return-trigger__actions">
        <button
          type="button"
          className="reveal-trigger__button"
          data-icon="↻"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? 'Casting this year…' : 'Generate'}
        </button>
        <button type="button" className="sub-reveal__close" onClick={() => setExpanded(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="notice notice-error">{error}</p>}
    </div>
  )
}
