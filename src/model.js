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
    notes: '',
    tutorialLinks: [],
    tags: [],
    difficulty: '',
    lastPlayed: '',
    imageIds: [],
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
  const haystack = [song.name, ...(song.tags || [])].join(' ').toLowerCase()
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
