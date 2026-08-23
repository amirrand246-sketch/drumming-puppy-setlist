import { useMemo, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { matchesQuery } from '../model.js'
import { DifficultyPill, EmptyState, Icon, SearchField } from './ui.jsx'

/** Full-screen sheet for picking songs out of the library into a setlist. */
export function SongPicker({ alreadyIn, onDone, onCancel }) {
  const { songs } = useLibrary()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState([])

  const results = useMemo(
    () => songs.filter((song) => matchesQuery(song, query)),
    [songs, query],
  )

  const toggle = (id) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Add songs">
      <header className="topbar topbar--sheet">
        <div className="topbar__row">
          <div className="topbar__side topbar__side--left">
            <button type="button" className="iconbtn iconbtn--text" onClick={onCancel}>
              Cancel
            </button>
          </div>
          <h1 className="topbar__title">Add Songs</h1>
          <div className="topbar__side topbar__side--right">
            <button
              type="button"
              className="iconbtn iconbtn--text iconbtn--accent"
              onClick={() => onDone(picked)}
              disabled={picked.length === 0}
            >
              Add{picked.length > 0 ? ` (${picked.length})` : ''}
            </button>
          </div>
        </div>
      </header>

      <div className="searchwrap">
        <SearchField value={query} onChange={setQuery} placeholder="Search songs, artists, tags" />
      </div>

      {songs.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          body="Add songs on the Songs tab first, then pull them into a setlist."
        />
      ) : results.length === 0 ? (
        <EmptyState icon="search" title="No matches" body="Try a different name or tag." />
      ) : (
        <ul className="rows rows--standalone">
          {results.map((song) => {
            const inSet = alreadyIn.includes(song.id)
            const selected = picked.includes(song.id)
            return (
              <li key={song.id}>
                <button
                  type="button"
                  className={`row row--pick ${selected ? 'row--picked' : ''}`}
                  onClick={() => toggle(song.id)}
                >
                  <span className={`checkbox ${selected ? 'checkbox--on' : ''}`}>
                    {selected && <Icon name="check" size={14} />}
                  </span>
                  <span className="row__main">
                    <span className="row__title">{song.name || 'Untitled song'}</span>
                    <span className="row__sub">
                      <DifficultyPill value={song.difficulty} />
                      {inSet && <span className="row__tags">already in this set</span>}
                      {!inSet && song.tags?.length > 0 && (
                        <span className="row__tags">{song.tags.join(' · ')}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
