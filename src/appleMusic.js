/**
 * Apple Music lookup via Apple's public iTunes Search API — no key, no account.
 *
 * The endpoint normally answers cross-origin requests, but not from every
 * browser or network, so a JSONP fallback covers the cases where fetch is
 * refused. A match has to actually look like the song being searched for:
 * linking to the wrong track is worse than linking to nothing.
 */

const ENDPOINT = 'https://itunes.apple.com/search'
const TIMEOUT = 12000

export function isAppleMusicUrl(value) {
  return /^https?:\/\/(music|itunes)\.apple\.com\/[^\s]*$/i.test((value || '').trim())
}

/** Strip the noise that stops an otherwise identical title from matching. */
function normalise(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring|remaster(ed)?|live|version|mono|stereo)\b.*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function overlaps(a, b) {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function isConfident(result, name, artist) {
  const wantedTitle = normalise(name)
  const wantedArtist = normalise(artist)
  if (!wantedTitle) return false
  if (!overlaps(normalise(result.trackName), wantedTitle)) return false
  return overlaps(normalise(result.artistName), wantedArtist)
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const name = `itunesSearch_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const done = (fn) => (value) => {
      clearTimeout(timer)
      delete window[name]
      script.remove()
      fn(value)
    }
    const timer = setTimeout(() => done(reject)(new Error('Search timed out')), TIMEOUT)
    window[name] = done(resolve)
    script.onerror = () => done(reject)(new Error('Search failed'))
    script.src = `${url}&callback=${name}`
    document.head.appendChild(script)
  })
}

async function search(term) {
  const url = `${ENDPOINT}?term=${encodeURIComponent(term)}&entity=song&limit=10`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) throw new Error(`Search returned ${response.status}`)
    return await response.json()
  } catch (err) {
    // Blocked cross-origin, or the network refused it — try the JSONP route.
    return jsonp(url)
  }
}

/**
 * Look a song up. Resolves to {url, trackName, artistName} for a confident
 * match, or null when nothing in the results is convincing enough to link to.
 */
export async function findSong(name, artist) {
  const data = await search(`${name} ${artist}`.trim())
  const results = Array.isArray(data?.results) ? data.results : []
  const match = results.find(
    (result) => result.trackViewUrl && isConfident(result, name, artist),
  )
  if (!match) return null
  return trackFrom(match)
}

/** The fields the tempo lookup cross-checks against. */
function trackFrom(result) {
  return {
    url: result.trackViewUrl,
    trackName: result.trackName || '',
    artistName: result.artistName || '',
    collectionName: result.collectionName || '',
    trackTimeMillis: Number(result.trackTimeMillis) || 0,
  }
}

/** Apple Music song links carry the track id as ?i= — e.g. …/album/x/123?i=456 */
export function trackIdFromUrl(url) {
  const match = /[?&]i=(\d+)/.exec(url || '')
  if (match) return match[1]
  const tail = /\/(?:song|album)\/[^/]*\/(\d+)/.exec(url || '')
  return tail ? tail[1] : ''
}

/** Fetch a track's metadata for a link the user pasted rather than searched. */
export async function lookupTrack(id) {
  if (!id) return null
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=song`
  let data
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Lookup returned ${response.status}`)
    data = await response.json()
  } catch (err) {
    data = await jsonp(url)
  }
  const result = (data?.results || []).find((item) => item.wrapperType === 'track' || item.trackName)
  return result ? trackFrom(result) : null
}
