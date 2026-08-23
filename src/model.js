export const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

export function uid(prefix) {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}_${random}`
}

export function newSong(name = '') {
  return {
    id: uid('song'),
    name,
    artist: '',
    appleMusicUrl: '',
    appleMusicSource: '',
    appleMusicTrack: null,
    bpm: null,
    tempoConfidence: '',
    tempoCheckedUrl: '',
    notes: [COUNT_IN_PREFIX],
    tutorialLinks: [],
    tags: [],
    difficulty: '',
    lastPlayed: '',
    createdAt: Date.now(),
  }
}

export function newSetlist(name = 'Untitled Set') {
  const now = Date.now()
  return {
    id: uid('set'),
    name,
    songIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Notes are a list of bullets. Songs saved before that change hold a single
 * block of text, so anything read off disk — or out of a backup file, or the
 * screenshot importer — comes through here and is split on its line breaks.
 * A paragraph with no line breaks simply becomes one bullet.
 */
export function toNoteLines(notes) {
  if (Array.isArray(notes)) {
    return notes.filter((line) => typeof line === 'string')
  }
  if (typeof notes === 'string') {
    return notes
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*•·]\s+/, '').trim())
      .filter(Boolean)
  }
  return []
}

/** The first bullet of every song is a fixed count-in line. */
export const COUNT_IN_PREFIX = 'Count-in:'
const COUNT_IN_RE = /^\s*count-?in\s*:/i
// Strips the label and only the single space that separates it, so a trailing
// space survives being typed — trimming here eats spaces as you type.
const COUNT_IN_STRIP = /^\s*count-?in\s*:\s?/i

export function isCountInLine(line) {
  return COUNT_IN_RE.test(line || '')
}

/** What the drummer actually typed, with the fixed label taken off. */
export function countInBody(line) {
  return (line || '').replace(COUNT_IN_STRIP, '')
}

export function composeCountIn(body) {
  return body ? `${COUNT_IN_PREFIX} ${body}` : COUNT_IN_PREFIX
}

/** Put the count-in at the top, pushing anything already there down one. */
export function withCountIn(notes) {
  const lines = toNoteLines(notes)
  if (lines.length > 0 && isCountInLine(lines[0])) return lines
  return [COUNT_IN_PREFIX, ...lines]
}

/** An untouched count-in label on its own does not count as having notes. */
export function hasNotes(song) {
  return toNoteLines(song?.notes).some((line, index) =>
    (index === 0 && isCountInLine(line) ? countInBody(line) : line).trim(),
  )
}

/** Ignore a leading article so "The Chicken" files under C, contacts-style. */
export function sortName(name) {
  const trimmed = (name || '').trim()
  return trimmed.replace(/^(the|a|an)\s+/i, '').toLowerCase()
}

export function indexLetter(name) {
  const first = sortName(name).charAt(0).toUpperCase()
  return first >= 'A' && first <= 'Z' ? first : '#'
}

export function compareSongs(a, b) {
  return sortName(a.name).localeCompare(sortName(b.name), undefined, {
    sensitivity: 'base',
  })
}

export function matchesQuery(song, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  // Artist counts: a song is as often remembered by who played it as by name.
  const haystack = [song.name, song.artist || '', ...(song.tags || [])]
    .join(' ')
    .toLowerCase()
  return q
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}

export function formatDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function relativeDate(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function todayISO() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/** "Sunday Gig" -> "Sunday Gig 2", then "Sunday Gig 3", ... */
export function copyName(name, existingNames) {
  const base = name.replace(/\s+(\d+)$/, '').trim() || 'Untitled Set'
  let n = 2
  let candidate = `${base} ${n}`
  while (existingNames.includes(candidate)) {
    n += 1
    candidate = `${base} ${n}`
  }
  return candidate
}
