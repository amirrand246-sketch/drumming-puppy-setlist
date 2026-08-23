import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as storage from './storage.js'
import {
  compareSongs,
  isCountInLine,
  newSetlist,
  newSong,
  toNoteLines,
  uid,
  withCountIn,
} from './model.js'
import { BACKUP_APP, BACKUP_VERSION } from './backup.js'

const LibraryContext = createContext(null)

export function LibraryProvider({ children }) {
  const [songs, setSongs] = useState([])
  const [setlists, setSetlists] = useState([])
  const [ready, setReady] = useState(false)
  // Serialises writes so rapid edits land in order.
  const queue = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    Promise.all([storage.getAll('songs'), storage.getAll('setlists')])
      .then(([loadedSongs, loadedSetlists]) => {
        if (cancelled) return
        // Bring older records up to the current shape, and write the migration
        // back so it only ever happens once.
        const stale = []
        const migrated = loadedSongs.map((song) => {
          if (
            Array.isArray(song.notes) &&
            Array.isArray(song.imageIds) &&
            typeof song.artist === 'string' &&
            typeof song.appleMusicUrl === 'string' &&
            isCountInLine(song.notes[0])
          ) {
            return song
          }
          const next = {
            ...song,
            artist: typeof song.artist === 'string' ? song.artist : '',
            appleMusicUrl:
              typeof song.appleMusicUrl === 'string' ? song.appleMusicUrl : '',
            appleMusicSource:
              typeof song.appleMusicSource === 'string' ? song.appleMusicSource : '',
            notes: withCountIn(song.notes),
            imageIds: Array.isArray(song.imageIds) ? song.imageIds : [],
          }
          stale.push(next)
          return next
        })
        setSongs(migrated)
        setSetlists(loadedSetlists)
        for (const song of stale) {
          storage.put('songs', song).catch((err) => console.error('Migration failed', err))
        }
      })
      .catch((err) => console.error('Could not load local data', err))
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enqueue = useCallback((work) => {
    queue.current = queue.current.then(work).catch((err) => {
      console.error('Persistence error', err)
    })
    return queue.current
  }, [])

  /* ---------- songs ---------- */

  const createSong = useCallback(
    (name) => {
      const song = newSong(name)
      setSongs((prev) => [...prev, song])
      enqueue(() => storage.put('songs', song))
      return song
    },
    [enqueue],
  )

  const updateSong = useCallback(
    (id, patch) => {
      let updated = null
      setSongs((prev) =>
        prev.map((song) => {
          if (song.id !== id) return song
          updated = { ...song, ...patch }
          return updated
        }),
      )
      enqueue(async () => {
        if (updated) await storage.put('songs', updated)
      })
    },
    [enqueue],
  )

  /** Create several songs at once — used by the screenshot importer. */
  const createSongs = useCallback(
    (drafts) => {
      const created = drafts.map((draft) => {
        const song = { ...newSong(draft.name || ''), ...draft }
        return { ...song, notes: withCountIn(song.notes) }
      })
      setSongs((prev) => [...prev, ...created])
      enqueue(async () => {
        for (const song of created) await storage.put('songs', song)
      })
      return created
    },
    [enqueue],
  )

  /** Screenshots live in their own store so song records stay small. */
  const saveImage = useCallback(
    (dataUrl) => {
      const image = { id: uid('img'), dataUrl, createdAt: Date.now() }
      enqueue(() => storage.put('images', image))
      return image.id
    },
    [enqueue],
  )

  const loadImage = useCallback(async (id) => {
    const all = await storage.getAll('images')
    return all.find((image) => image.id === id) || null
  }, [])

  const deleteImage = useCallback(
    (id) => {
      enqueue(() => storage.remove('images', id))
    },
    [enqueue],
  )

  const deleteSong = useCallback(
    (id) => {
      setSongs((prev) => {
        const song = prev.find((item) => item.id === id)
        for (const imageId of song?.imageIds || []) {
          enqueue(() => storage.remove('images', imageId))
        }
        return prev.filter((item) => item.id !== id)
      })
      // A deleted song must also leave every setlist that referenced it.
      setSetlists((prev) => {
        const touched = []
        const next = prev.map((set) => {
          if (!set.songIds.includes(id)) return set
          const updated = {
            ...set,
            songIds: set.songIds.filter((songId) => songId !== id),
            updatedAt: Date.now(),
          }
          touched.push(updated)
          return updated
        })
        enqueue(async () => {
          for (const set of touched) await storage.put('setlists', set)
        })
        return next
      })
      enqueue(() => storage.remove('songs', id))
    },
    [enqueue],
  )

  /* ---------- setlists ---------- */

  const createSetlist = useCallback(
    (name, songIds = []) => {
      const set = { ...newSetlist(name), songIds }
      setSetlists((prev) => [...prev, set])
      enqueue(() => storage.put('setlists', set))
      return set
    },
    [enqueue],
  )

  const updateSetlist = useCallback(
    (id, patch) => {
      let updated = null
      setSetlists((prev) =>
        prev.map((set) => {
          if (set.id !== id) return set
          updated = { ...set, ...patch, updatedAt: Date.now() }
          return updated
        }),
      )
      enqueue(async () => {
        if (updated) await storage.put('setlists', updated)
      })
    },
    [enqueue],
  )

  const deleteSetlist = useCallback(
    (id) => {
      setSetlists((prev) => prev.filter((set) => set.id !== id))
      enqueue(() => storage.remove('setlists', id))
    },
    [enqueue],
  )

  const duplicateSetlist = useCallback(
    (id, name) => {
      let copy = null
      setSetlists((prev) => {
        const source = prev.find((set) => set.id === id)
        if (!source) return prev
        copy = { ...newSetlist(name), songIds: [...source.songIds] }
        enqueue(() => storage.put('setlists', copy))
        return [...prev, copy]
      })
      return copy
    },
    [enqueue],
  )

  /** Everything in the library, as a plain object ready to be written to a file. */
  const exportAll = useCallback(
    async ({ includeImages = true } = {}) => {
      const images = includeImages ? await storage.getAll('images') : []
      const kept = new Set(images.map((image) => image.id))
      return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        songs: songs.map((song) => ({
          ...song,
          imageIds: (song.imageIds || []).filter((id) => kept.has(id)),
        })),
        setlists,
        images,
      }
    },
    [songs, setlists],
  )

  /**
   * Restore a normalised backup. 'merge' keeps what's already here and adds what
   * is missing; 'replace' wipes the library first.
   */
  const importAll = useCallback(
    async (backup, mode = 'merge') => {
      if (mode === 'replace') {
        await Promise.all([
          storage.clear('songs'),
          storage.clear('setlists'),
          storage.clear('images'),
        ])
        for (const image of backup.images) await storage.put('images', image)
        for (const song of backup.songs) await storage.put('songs', song)
        for (const set of backup.setlists) await storage.put('setlists', set)
        setSongs(backup.songs)
        setSetlists(backup.setlists)
        return {
          songs: backup.songs.length,
          setlists: backup.setlists.length,
          images: backup.images.length,
          skipped: 0,
        }
      }

      const existingIds = new Set(songs.map((song) => song.id))
      const existingNames = new Set(songs.map((song) => song.name.trim().toLowerCase()))
      const newSongs = backup.songs.filter(
        (song) => !existingIds.has(song.id) && !existingNames.has(song.name.trim().toLowerCase()),
      )
      const keptSongIds = new Set([...existingIds, ...newSongs.map((song) => song.id)])

      const setIds = new Set(setlists.map((set) => set.id))
      const setNames = new Set(setlists.map((set) => set.name.trim().toLowerCase()))
      const newSetlists = backup.setlists
        .filter((set) => !setIds.has(set.id) && !setNames.has(set.name.trim().toLowerCase()))
        .map((set) => ({ ...set, songIds: set.songIds.filter((id) => keptSongIds.has(id)) }))

      const wantedImages = new Set(newSongs.flatMap((song) => song.imageIds))
      const newImages = backup.images.filter((image) => wantedImages.has(image.id))

      for (const image of newImages) await storage.put('images', image)
      for (const song of newSongs) await storage.put('songs', song)
      for (const set of newSetlists) await storage.put('setlists', set)

      setSongs((prev) => [...prev, ...newSongs])
      setSetlists((prev) => [...prev, ...newSetlists])

      return {
        songs: newSongs.length,
        setlists: newSetlists.length,
        images: newImages.length,
        skipped: backup.songs.length - newSongs.length,
      }
    },
    [songs, setlists],
  )

  const sortedSongs = useMemo(() => [...songs].sort(compareSongs), [songs])

  const songsById = useMemo(() => {
    const map = new Map()
    for (const song of songs) map.set(song.id, song)
    return map
  }, [songs])

  const sortedSetlists = useMemo(
    () => [...setlists].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [setlists],
  )

  const value = useMemo(
    () => ({
      ready,
      songs: sortedSongs,
      songsById,
      setlists: sortedSetlists,
      createSong,
      createSongs,
      updateSong,
      deleteSong,
      saveImage,
      loadImage,
      deleteImage,
      createSetlist,
      updateSetlist,
      deleteSetlist,
      duplicateSetlist,
      exportAll,
      importAll,
    }),
    [
      ready,
      sortedSongs,
      songsById,
      sortedSetlists,
      createSong,
      createSongs,
      updateSong,
      deleteSong,
      saveImage,
      loadImage,
      deleteImage,
      createSetlist,
      updateSetlist,
      deleteSetlist,
      duplicateSetlist,
      exportAll,
      importAll,
    ],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return context
}
