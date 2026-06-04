export const COUNTRY_OPTIONS = [
  { code: 'DK', label: 'Denmark' },
  { code: 'INT', label: 'International' },
]

// Well-known artists per country, organised by decade.
// One artist is picked at random per selected decade and used to boost the track pool
// with recognisable local songs. Genre tags were tried but Spotify's catalog barely
// tags mainstream artists with country-specific genres — artist search is reliable.
export const COUNTRY_ARTISTS = {
  DK: {
    '60s': ['Bamses Venner', 'Gasolin'],
    '70s': ['Kim Larsen', 'Gnags', 'Gasolin', 'Shu-bi-dua', 'C.V. Jørgensen'],
    '80s': ['Kim Larsen', 'Gnags', 'D-A-D', 'Tommy Seebach', 'Shu-bi-dua'],
    '90s': ['Aqua', 'Michael Learns to Rock', 'Whigfield', 'Nephew', 'Kashmir'],
    '00s': ['Alphabeat', 'Nik & Jay', 'L.O.C.', 'Medina', 'The Raveonettes'],
    '10s': ['MØ', 'Lukas Graham', 'Volbeat', 'Rasmus Seebach', 'Suspekt'],
    '20s': ['Lukas Graham', 'Rasmus Seebach', 'Benny Jamz', 'MØ', 'Gilli'],
  },
  // Future countries: SE, NO, DE …
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
