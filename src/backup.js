/**
 * Backup files are plain JSON so they can be read, edited or recovered by hand.
 * Anything coming back in is treated as untrusted: every record is rebuilt field
 * by field, so a truncated or hand-edited file can't corrupt the library.
 */
import { DIFFICULTIES, toNoteLines, uid } from './model.js'

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
  const notes = toNoteLines(raw.notes)
    .map((line) => str(line, 2000))
    .slice(0, 500)
  if (!name && notes.length === 0) return null
  return {
    id: str(raw.id, 80) || uid('song'),
    name,
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
    imageIds: list(raw.imageIds).map((id) => str(id, 80)).filter(Boolean).slice(0, 20),
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

function cleanImage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl : ''
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(dataUrl)) return null
  return { id: str(raw.id, 80) || uid('img'), dataUrl, createdAt: time(raw.createdAt) }
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
  const images = list(raw.images).map(cleanImage).filter(Boolean)

  // Drop references that point at records the file doesn't actually contain.
  const songIds = new Set(songs.map((song) => song.id))
  const imageIds = new Set(images.map((image) => image.id))
  for (const song of songs) {
    song.imageIds = song.imageIds.filter((id) => imageIds.has(id))
  }
  for (const set of setlists) {
    set.songIds = set.songIds.filter((id) => songIds.has(id))
  }

  return { songs, setlists, images, exportedAt: str(raw.exportedAt, 40) }
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
