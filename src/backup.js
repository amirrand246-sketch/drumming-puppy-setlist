/**
 * Backup files are plain JSON so they can be read, edited or recovered by hand.
 * Anything coming back in is treated as untrusted: every record is rebuilt field
 * by field, so a truncated or hand-edited file can't corrupt the library.
 */
import { isAppleMusicUrl } from './appleMusic.js'
import { DIFFICULTIES, TIME_SIGNATURES, toNoteLines, uid, withCountIn } from './model.js'

export const BACKUP_APP = 'drumming-puppys-setlist'
export const BACKUP_VERSION = 1

const str = (value, max = 400) => (typeof value === 'string' ? value.slice(0, max) : '')
const list = (value) => (Array.isArray(value) ? value : [])
const time = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : Date.now())
const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '')

function cleanSong(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 200).trim()
  // Backups written before notes became a list hold one block of text.
  const notes = withCountIn(toNoteLines(raw.notes).map((line) => str(line, 2000))).slice(0, 500)
  // A count-in label on its own is not content; it is on every song.
  if (!name && !notes.some((line, i) => (i === 0 ? line.replace(/^\s*count-?in\s*:\s*/i, '') : line).trim())) {
    return null
  }
  return {
    id: str(raw.id, 80) || uid('song'),
    name,
    artist: str(raw.artist, 200).trim(),
    timeSignature: TIME_SIGNATURES.includes(raw.timeSignature) ? raw.timeSignature : '4/4',
    durationSeconds:
      Number.isFinite(Number(raw.durationSeconds)) && Number(raw.durationSeconds) > 0
        ? Math.round(Number(raw.durationSeconds))
        : null,
    // A link only survives the round trip if it still looks like Apple Music.
    appleMusicUrl: isAppleMusicUrl(str(raw.appleMusicUrl, 2000)) ? str(raw.appleMusicUrl, 2000).trim() : '',
    appleMusicSource: ['auto', 'manual'].includes(raw.appleMusicSource) ? raw.appleMusicSource : '',
    appleMusicTrack:
      raw.appleMusicTrack && typeof raw.appleMusicTrack === 'object'
        ? {
            url: str(raw.appleMusicTrack.url, 2000),
            trackName: str(raw.appleMusicTrack.trackName, 200),
            artistName: str(raw.appleMusicTrack.artistName, 200),
            collectionName: str(raw.appleMusicTrack.collectionName, 200),
            trackTimeMillis: Number(raw.appleMusicTrack.trackTimeMillis) || 0,
          }
        : null,
    bpm: Number.isFinite(Number(raw.bpm)) && Number(raw.bpm) > 0 ? Math.round(Number(raw.bpm)) : null,
    tempoConfidence: ['confirmed', 'unconfirmed', 'unavailable', 'manual'].includes(raw.tempoConfidence)
      ? raw.tempoConfidence
      : '',
    tempoCheckedUrl: str(raw.tempoCheckedUrl, 2000),
    notes,
    tutorialLinks: list(raw.tutorialLinks)
      .map((link) => ({
        id: str(link?.id, 80) || uid('link'),
        label: str(link?.label, 120),
        url: str(link?.url, 2000),
      }))
      .filter((link) => link.url)
      .slice(0, 40),
    tags: list(raw.tags)
      .map((tag) => str(tag, 40).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 40),
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : '',
    lastPlayed: isoDate(str(raw.lastPlayed, 10)),
    createdAt: time(raw.createdAt),
  }
}

function cleanSetlist(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 200).trim()
  if (!name) return null
  return {
    id: str(raw.id, 80) || uid('set'),
    name,
    songIds: list(raw.songIds).map((id) => str(id, 80)).filter(Boolean).slice(0, 500),
    createdAt: time(raw.createdAt),
    updatedAt: time(raw.updatedAt),
  }
}

/** Validate and rebuild a parsed backup file. Throws if it isn't one. */
export function normaliseBackup(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('That file is not a backup.')
  if (!Array.isArray(raw.songs) && !Array.isArray(raw.setlists)) {
    throw new Error("That file doesn't have any songs or setlists in it.")
  }
  if (raw.app && raw.app !== BACKUP_APP) {
    throw new Error('That backup came from a different app.')
  }

  const songs = list(raw.songs).map(cleanSong).filter(Boolean)
  const setlists = list(raw.setlists).map(cleanSetlist).filter(Boolean)

  // Drop references that point at records the file doesn't actually contain.
  const songIds = new Set(songs.map((song) => song.id))
  for (const set of setlists) {
    set.songIds = set.songIds.filter((id) => songIds.has(id))
  }

  return { songs, setlists, exportedAt: str(raw.exportedAt, 40) }
}

export function backupFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  return `drumming-puppys-setlist-${stamp}.json`
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
