/**
 * Tempo lookup through GetSongBPM, checked against the linked iTunes track.
 *
 * The risk with tempo databases is grabbing the number for a different cut of
 * the song — a live take, a remix, a remaster. So a result is only trusted when
 * its album or its duration lines up with the track the song is actually linked
 * to; when neither can be compared the tempo is kept but flagged unconfirmed,
 * and when one clearly disagrees it is thrown away.
 */

const ENDPOINT = 'https://api.getsongbpm.com/search/'
const DURATION_TOLERANCE_SECONDS = 5

export const TEMPO_CONFIRMED = 'confirmed'
export const TEMPO_UNCONFIRMED = 'unconfirmed'
export const TEMPO_UNAVAILABLE = 'unavailable'
export const TEMPO_MANUAL = 'manual'

export function hasTempoKey() {
  return Boolean(import.meta.env.VITE_GETSONGBPM_KEY)
}

function normalise(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(deluxe|expanded|remaster(ed)?|edition|version|single|ep|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** GetSongBPM is inconsistent about where it puts these, so check every shape. */
function albumOf(result) {
  const album = result?.album
  if (typeof album === 'string') return album
  return album?.title || result?.album_title || ''
}

function durationOf(result) {
  const raw = result?.duration ?? result?.song_length ?? result?.length ?? null
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw > 10000 ? raw / 1000 : raw
  const text = String(raw).trim()
  if (/^\d+:\d{1,2}$/.test(text)) {
    const [minutes, seconds] = text.split(':').map(Number)
    return minutes * 60 + seconds
  }
  const number = Number(text)
  if (!Number.isFinite(number)) return null
  return number > 10000 ? number / 1000 : number
}

function tempoOf(result) {
  const raw = result?.tempo ?? result?.bpm
  const number = Math.round(Number(raw))
  return Number.isFinite(number) && number > 20 && number < 400 ? number : null
}

function albumsAgree(theirs, ours) {
  const a = normalise(theirs)
  const b = normalise(ours)
  if (!a || !b) return null
  return a === b || a.includes(b) || b.includes(a)
}

function durationsAgree(theirSeconds, ourSeconds) {
  if (theirSeconds === null || !ourSeconds) return null
  return Math.abs(theirSeconds - ourSeconds) <= DURATION_TOLERANCE_SECONDS
}

/**
 * Weigh one candidate against the linked track.
 * Returns 'confirmed' | 'unavailable' | 'unconfirmed'.
 */
export function judge(result, track) {
  const album = albumsAgree(albumOf(result), track?.collectionName)
  const duration = durationsAgree(
    durationOf(result),
    track?.trackTimeMillis ? track.trackTimeMillis / 1000 : null,
  )
  if (album === false || duration === false) return TEMPO_UNAVAILABLE
  if (album === true || duration === true) return TEMPO_CONFIRMED
  return TEMPO_UNCONFIRMED
}

function titleAndArtistMatch(result, track) {
  const title = normalise(result?.song_title || result?.title)
  const artist = normalise(result?.artist?.name || result?.artist)
  const wantedTitle = normalise(track?.trackName)
  const wantedArtist = normalise(track?.artistName)
  const titleOk = title && wantedTitle && (title === wantedTitle || title.includes(wantedTitle) || wantedTitle.includes(title))
  const artistOk = !wantedArtist || (artist && (artist.includes(wantedArtist) || wantedArtist.includes(artist)))
  return Boolean(titleOk && artistOk)
}

/**
 * Look up the tempo for a linked iTunes track.
 * Resolves to { bpm, confidence } — bpm is null when nothing usable was found.
 */
export async function findTempo(track) {
  const key = import.meta.env.VITE_GETSONGBPM_KEY
  if (!key) throw new Error('No GetSongBPM API key configured')
  if (!track?.trackName) return { bpm: null, confidence: TEMPO_UNAVAILABLE }

  const lookup = `song:${track.trackName} artist:${track.artistName || ''}`.trim()
  const url = `${ENDPOINT}?api_key=${encodeURIComponent(key)}&type=both&lookup=${encodeURIComponent(lookup)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Tempo search returned ${response.status}`)
  const data = await response.json()

  const results = Array.isArray(data?.search) ? data.search : []
  const candidates = results.filter((result) => titleAndArtistMatch(result, track))
  if (candidates.length === 0) return { bpm: null, confidence: TEMPO_UNAVAILABLE }

  // Prefer a candidate that can be confirmed over one that merely exists.
  let fallback = null
  for (const candidate of candidates) {
    const bpm = tempoOf(candidate)
    if (!bpm) continue
    const confidence = judge(candidate, track)
    if (confidence === TEMPO_CONFIRMED) return { bpm, confidence }
    if (confidence === TEMPO_UNCONFIRMED && !fallback) fallback = { bpm, confidence }
  }
  return fallback || { bpm: null, confidence: TEMPO_UNAVAILABLE }
}
