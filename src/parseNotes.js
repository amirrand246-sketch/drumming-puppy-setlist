/**
 * Turn the text scraped off a notes screenshot into song candidates.
 *
 * Notes pages are freeform, so this leans on layout signals — blank lines,
 * bullets, indentation — plus obvious content markers like URLs and "tags:".
 * Everything it produces goes to a review screen before it reaches the library.
 */
import { DIFFICULTIES, uid } from './model.js'

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s,;]+|[a-z0-9-]+\.(?:com|net|org|io|tv|be|co|app|me)\/[^\s,;]*/gi
const BULLET_RE = /^\s*(?:[-*•·▪◦o]|\d+[.)])\s+/
const HEADING_RE =
  /^(songs?|set ?lists?|tunes?|repertoire|to learn|learning|practice|drums?|drumming|notes?|list)\s*:?$/i
const NOISE_RE = /^[^a-z0-9]*$/i
// A page title like "Drum songs I know" is not a song. Plural/heading wording
// only, so a real title such as "Song 2" survives.
const PAGE_TITLE_RE =
  /\b(songs|tunes|set ?lists?|repertoire|practice|drums|drumming|to learn|learning|list of)\b/i
const DETAIL_PREFIX_RE =
  /^(notes?|note|tags?|tutorial|tutorials|link|links|video|youtube|difficulty|level|bpm|tempo|key|last played|played|artist|by)\s*[:\-–]/i
const TAG_LINE_RE = /^tags?\s*[:\-–]\s*(.+)$/i
const DIFFICULTY_LINE_RE = /^(?:difficulty|level)\s*[:\-–]\s*(easy|medium|hard)\b/i
const DIFFICULTY_WORD_RE = /\b(easy|medium|hard)\b/i
const LAST_PLAYED_RE = /^(?:last played|played)\s*[:\-–]\s*(.+)$/i
const HASHTAG_RE = /#([a-z0-9][a-z0-9 _-]*)/gi

function tidy(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
}

function indentOf(line) {
  const match = line.match(/^[ \t]*/)
  return match ? match[0].replace(/\t/g, '    ').length : 0
}

function looksLikeDetail(text) {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (URL_RE.test(trimmed)) {
    URL_RE.lastIndex = 0
    return true
  }
  if (DETAIL_PREFIX_RE.test(trimmed)) return true
  if (trimmed.length > 55) return true
  if (/^[a-z]/.test(trimmed)) return true
  return false
}

function toISODate(text) {
  const parsed = new Date(text.trim())
  if (Number.isNaN(parsed.getTime())) return ''
  const offset = parsed.getTimezoneOffset() * 60000
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 10)
}

function cleanName(text) {
  return text
    .replace(BULLET_RE, '')
    .replace(/\s*[:\-–—]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Split the raw text into one group of lines per song. */
function groupLines(text) {
  const rawLines = tidy(text).split(/\r?\n/)
  const meaningful = rawLines.filter((line) => line.trim() && !NOISE_RE.test(line.trim()))
  if (meaningful.length === 0) return []

  const baseIndent = Math.min(...meaningful.map(indentOf))
  const groups = []
  let current = null
  let previousBlank = true

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed || NOISE_RE.test(trimmed)) {
      previousBlank = true
      continue
    }
    if (!current && HEADING_RE.test(trimmed)) {
      previousBlank = true
      continue
    }

    const indented = indentOf(raw) > baseIndent + 1
    const bulleted = BULLET_RE.test(raw)
    const detail = indented || (!bulleted && looksLikeDetail(trimmed))
    const startsSong = !current || (!detail && (bulleted || previousBlank || !indented))

    if (startsSong) {
      current = { title: trimmed, details: [] }
      groups.push(current)
    } else {
      current.details.push(trimmed.replace(BULLET_RE, ''))
    }
    previousBlank = false
  }

  return groups
}

function extract(lines) {
  const song = {
    notes: [],
    tags: [],
    tutorialLinks: [],
    difficulty: '',
    lastPlayed: '',
  }

  for (const line of lines) {
    let rest = line

    const tagLine = rest.match(TAG_LINE_RE)
    if (tagLine) {
      song.tags.push(...tagLine[1].split(/[,;]/))
      continue
    }

    const difficultyLine = rest.match(DIFFICULTY_LINE_RE)
    if (difficultyLine) {
      song.difficulty = capitalise(difficultyLine[1])
      continue
    }

    const playedLine = rest.match(LAST_PLAYED_RE)
    if (playedLine) {
      const iso = toISODate(playedLine[1])
      if (iso) {
        song.lastPlayed = iso
        continue
      }
    }

    const urls = rest.match(URL_RE)
    if (urls) {
      for (const url of urls) {
        const label = rest
          .slice(0, rest.indexOf(url))
          .replace(DETAIL_PREFIX_RE, '')
          .replace(/[-–—:•*]+\s*$/, '')
          .trim()
        song.tutorialLinks.push({
          id: uid('link'),
          label: label.slice(0, 60) || `Tutorial ${song.tutorialLinks.length + 1}`,
          url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
        })
        rest = rest.replace(url, ' ')
      }
      rest = rest.replace(DETAIL_PREFIX_RE, '').trim()
      if (!rest || rest.length < 3) continue
    }

    const hashtags = [...rest.matchAll(HASHTAG_RE)].map((match) => match[1])
    if (hashtags.length > 0) {
      song.tags.push(...hashtags)
      rest = rest.replace(HASHTAG_RE, '').trim()
    }

    if (!song.difficulty) {
      const word = rest.match(DIFFICULTY_WORD_RE)
      if (word) song.difficulty = capitalise(word[1])
    }

    rest = rest.replace(/^(notes?|note)\s*[:\-–]\s*/i, '').trim()
    if (rest) song.notes.push(rest)
  }

  return song
}

function capitalise(word) {
  const lower = word.toLowerCase()
  return DIFFICULTIES.find((level) => level.toLowerCase() === lower) || ''
}

function normaliseTags(tags) {
  const seen = new Set()
  const out = []
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase().replace(/\s{2,}/g, ' ')
    if (!clean || clean.length > 24 || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

/** Parse OCR (or pasted) text into reviewable song candidates. */
export function parseNotesText(text) {
  return groupLines(text)
    .map((group) => {
      const title = cleanName(group.title)
      const extracted = extract(group.details)
      // A title line can carry its own URL or hashtags; fold those in too.
      const fromTitle = extract([group.title])
      const name = cleanName(fromTitle.notes.join(' ')) || title
      return {
        id: uid('cand'),
        include: true,
        name,
        notes: extracted.notes.join('\n'),
        tags: normaliseTags([...fromTitle.tags, ...extracted.tags]),
        difficulty: extracted.difficulty || '',
        lastPlayed: extracted.lastPlayed || '',
        tutorialLinks: [...fromTitle.tutorialLinks, ...extracted.tutorialLinks],
      }
    })
    .filter((candidate) => candidate.name || candidate.notes)
    .filter((candidate, index, all) => {
      if (index > 0 || all.length < 2) return true
      const bare =
        !candidate.notes &&
        candidate.tags.length === 0 &&
        candidate.tutorialLinks.length === 0 &&
        !candidate.difficulty
      return !(bare && PAGE_TITLE_RE.test(candidate.name))
    })
}

/** Fallback for a screenshot that is really one song's page of notes. */
export function mergeCandidates(candidates) {
  if (candidates.length === 0) return []
  const [first, ...rest] = candidates
  const notes = [first.notes, ...rest.flatMap((c) => [c.name, c.notes])]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join('\n')
  return [
    {
      ...first,
      notes,
      tags: normaliseTags(candidates.flatMap((c) => c.tags)),
      difficulty: candidates.find((c) => c.difficulty)?.difficulty || '',
      lastPlayed: candidates.find((c) => c.lastPlayed)?.lastPlayed || '',
      tutorialLinks: candidates.flatMap((c) => c.tutorialLinks),
    },
  ]
}
