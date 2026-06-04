export const COUNTRY_OPTIONS = [
  { code: 'DK', label: 'Denmark' },
  { code: 'INT', label: 'International' },
]

// Maps country code + selected game genre → Spotify genre slug used for the local-hits boost.
// Uses hyphenated slugs so no URL encoding is needed (consistent with the rest of the API calls).
export const COUNTRY_GENRE_MAP = {
  DK: {
    all:     'danish-pop',
    pop:     'danish-pop',
    rock:    'danish-rock',
    'hip-hop': 'danish-hip-hop',
    dance:   'danish-pop',
    'r&b':   'danish-pop',
  },
  // Future countries added here, e.g. SE, NO, DE …
}

const STORAGE_KEY = 'sideA_country'

export function getSavedCountry() {
  try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}

export function saveCountry(code) {
  try { localStorage.setItem(STORAGE_KEY, code) } catch {}
}

export function countryLabel(code) {
  return COUNTRY_OPTIONS.find(c => c.code === code)?.label ?? ''
}
