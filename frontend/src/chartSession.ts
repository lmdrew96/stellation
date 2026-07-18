import type { ChartData, Interpretation, SynastryData, SynastryInterpretation } from './types'

// Once a solo or synastry interpretation has been generated in this browser,
// it's cached here so a page reload restores it instead of re-submitting a
// wasted (and possibly differently-worded) Anthropic call - the same reuse
// useReveal already gives a saved-chart's presetReading, just sourced from
// localStorage instead of the backend for charts that were never explicitly
// saved.
const SOLO_KEY = 'stellation-solo-session'
const SYNASTRY_KEY = 'stellation-synastry-session'
const MODE_KEY = 'stellation-active-mode'

export interface SoloSession {
  chart: ChartData
  interpretation: Interpretation
}

export interface SynastrySession {
  synastry: SynastryData
  interpretation: SynastryInterpretation
}

export type StoredMode = 'solo' | 'synastry'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing / storage disabled - session just won't persist.
  }
}

export function loadSoloSession(): SoloSession | null {
  return readJson<SoloSession>(SOLO_KEY)
}

export function saveSoloSession(session: SoloSession): void {
  writeJson(SOLO_KEY, session)
}

export function loadSynastrySession(): SynastrySession | null {
  return readJson<SynastrySession>(SYNASTRY_KEY)
}

export function saveSynastrySession(session: SynastrySession): void {
  writeJson(SYNASTRY_KEY, session)
}

export function loadStoredMode(): StoredMode | null {
  try {
    const value = localStorage.getItem(MODE_KEY)
    return value === 'solo' || value === 'synastry' ? value : null
  } catch {
    return null
  }
}

export function saveStoredMode(mode: StoredMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // Private browsing / storage disabled - preference just won't persist.
  }
}
