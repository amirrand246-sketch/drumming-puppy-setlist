import { useMemo, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { navigate } from '../router.js'
import { indexLetter, matchesQuery } from '../model.js'
import { DifficultyPill, EmptyState, Icon, SearchField, TopBar } from './ui.jsx'

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

export function SongLibrary() {
  const { songs, createSong, ready } = useLibrary()
  const [query, setQuery] = useState('')
  const railRef = useRef(null)

  const sections = useMemo(() => {
    const filtered = songs.filter((song) => matchesQuery(song, query))
    const map = new Map()
    for (const song of filtered) {
      const letter = indexLetter(song.name)
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter).push(song)
    }
    return LETTERS.filter((letter) => map.has(letter)).map((letter) => ({
      letter,
      songs: map.get(letter),
    }))
  }, [songs, query])

  const available = useMemo(
    () => new Set(sections.map((section) => section.letter)),
    [sections],
  )

  const total = sections.reduce((sum, section) => sum + section.songs.length, 0)

  const addSong = () => {
    const song = createSong('')
    navigate(`/songs/${song.id}?new=1`)
  }

  const jumpTo = (letter) => {
    const target = document.getElementById(`section-${letter === '#' ? 'hash' : letter}`)
    if (target) target.scrollIntoView({ block: 'start' })
  }

  const railPointer = (event) => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    const index = Math.min(LETTERS.length - 1, Math.max(0, Math.floor(ratio * LETTERS.length)))
    // Snap to the nearest letter that actually has songs.
    let best = null
    let bestDistance = Infinity
    LETTERS.forEach((letter, i) => {
      if (!available.has(letter)) return
      const distance = Math.abs(i - index)
      if (distance < bestDistance) {
        bestDistance = distance
        best = letter
      }
    })
    if (best) jumpTo(best)
  }

  return (
    <>
      <TopBar
        large
        title="Songs"
        right={
          <>
            <button
              type="button"
              className="iconbtn"
              onClick={() => navigate('/import')}
              aria-label="Import songs from a screenshot"
            >
              <Icon name="scan" />
            </button>
            <button type="button" className="iconbtn" onClick={addSong} aria-label="Add song">
              <Icon name="plus" />
            </button>
          </>
        }
      />
      <div className="searchwrap">
        <SearchField value={query} onChange={setQuery} placeholder="Search songs and tags" />
      </div>

      {!ready ? null : songs.length === 0 ? (
        <EmptyState
          title="No songs yet"
          body="Add every song you can play — notes, tutorial links, tags and all."
          action={
            <div className="stack stack--empty">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate('/import')}
              >
                <Icon name="scan" size={18} /> Import from a screenshot
              </button>
              <button type="button" className="btn" onClick={addSong}>
                Add a song by hand
              </button>
            </div>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon="search"
          title="No matches"
          body={`Nothing in the library matches “${query.trim()}”.`}
        />
      ) : (
        <div className="library">
          <div className="library__list">
            {sections.map((section) => (
              <section key={section.letter} className="group">
                <h2
                  className="group__header"
                  id={`section-${section.letter === '#' ? 'hash' : section.letter}`}
                >
                  {section.letter}
                </h2>
                <ul className="rows">
                  {section.songs.map((song) => (
                    <li key={song.id}>
                      <button
                        type="button"
                        className="row"
                        onClick={() => navigate(`/songs/${song.id}`)}
                      >
                        <span className="row__main">
                          <span className="row__title">{song.name || 'Untitled song'}</span>
                          {(song.tags?.length > 0 || song.difficulty) && (
                            <span className="row__sub">
                              <DifficultyPill value={song.difficulty} />
                              {song.tags?.length > 0 && (
                                <span className="row__tags">{song.tags.join(' · ')}</span>
                              )}
                            </span>
                          )}
                        </span>
                        <Icon name="chevron" size={17} className="row__chevron" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="listcount">
              {total} {total === 1 ? 'Song' : 'Songs'}
            </p>
            <button
              type="button"
              className="footlink"
              onClick={() => navigate('/backup')}
            >
              <Icon name="shield" size={15} /> Backup &amp; restore
            </button>
          </div>

          <div
            className="rail"
            ref={railRef}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              railPointer(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons === 0 && event.pointerType === 'mouse') return
              if (event.currentTarget.hasPointerCapture(event.pointerId)) railPointer(event)
            }}
            aria-hidden="true"
          >
            {LETTERS.map((letter) => (
              <span
                key={letter}
                className={`rail__letter ${available.has(letter) ? '' : 'rail__letter--off'}`}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
