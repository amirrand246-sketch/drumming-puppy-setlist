/**
 * Where you were in a set, kept outside React so it survives the app being
 * killed mid-gig — a call, a photo, ten minutes in a pocket. Sessions older
 * than a night are ignored rather than resuming last month's gig.
 */
const KEY = 'dps:gig'
const MAX_AGE_MS = 12 * 60 * 60 * 1000

export function saveGigPosition(setlistId, index) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ setlistId, index, at: Date.now() }))
  } catch {
    /* a remembered position is a nicety, not a requirement */
  }
}

export function readGigPosition() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw || typeof raw.setlistId !== 'string' || !Number.isFinite(raw.index)) return null
    if (Date.now() - (raw.at || 0) > MAX_AGE_MS) return null
    return raw
  } catch {
    return null
  }
}

export function clearGigPosition() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
