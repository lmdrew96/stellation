import { PLANET_GLYPH } from '../glyphs'

type Theme = 'light' | 'dark'

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

// A single sliding switch rather than two separate pills - the sun/moon
// glyphs are the same ones PLANET_GLYPH already uses for Sun/Moon elsewhere
// in the app, so the toggle speaks the same astrological-glyph language as
// the rest of the UI instead of introducing its own icon set.
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      <span className="theme-toggle__thumb" data-theme={theme} aria-hidden="true" />
      <button
        type="button"
        className="theme-toggle__option"
        data-active={theme === 'light'}
        aria-pressed={theme === 'light'}
        aria-label="Light theme"
        onClick={() => onChange('light')}
      >
        {PLANET_GLYPH.Sun}
      </button>
      <button
        type="button"
        className="theme-toggle__option"
        data-active={theme === 'dark'}
        aria-pressed={theme === 'dark'}
        aria-label="Dark theme"
        onClick={() => onChange('dark')}
      >
        {PLANET_GLYPH.Moon}
      </button>
    </div>
  )
}
