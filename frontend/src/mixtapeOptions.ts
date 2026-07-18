import type { MixtapeDecade, MixtapeGenre } from './types'

// Locked list, 13 fixed non-editable buttons - mirrors
// backend/app/services/playlist_mood.py's GENRE_SEARCH_TERMS keys exactly.
// See the mixtape ChaosPatch spec for why Hip Hop/Rap are merged and Funk/
// Disco combined.
export const MIXTAPE_GENRES: MixtapeGenre[] = [
  'Rock',
  'Pop',
  'Hip Hop',
  'R&B',
  'Alternative',
  'Indie',
  'Electronic',
  'Jazz',
  'Funk/Disco',
  'Folk',
  'Punk',
  'Metal',
  'Country',
]

export const MIXTAPE_DECADES: MixtapeDecade[] = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']

export const MIXTAPE_MAX_PICKS = 3
