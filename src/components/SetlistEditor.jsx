import { useState } from 'react'
import { useLibrary } from '../store.jsx'
import { back, navigate } from '../router.js'
import {
  DEFAULT_BREAK_MINUTES,
  breakMinutes,
  breakTotal,
  buildRunOrder,
  copyName,
  describeSetLength,
  isBreakEntry,
  makeBreak,
  relativeDate,
  setLength,
} from '../model.js'
import { ConfirmDialog, EmptyState, Icon, PromptDialog, TopBar } from './ui.jsx'
import { ReorderList } from './ReorderList.jsx'
import { SongPicker } from './SongPicker.jsx'

const DEFAULT_NAME = 'Untitled Set'

export function SetlistEditor({ setlistId }) {
  const {
    setlists,
    songsById,
    updateSetlist,
    deleteSetlist,
    duplicateSetlist,
    ready,
  } = useLibrary()
  const set = setlists.find((item) => item.id === setlistId)
  const [dialog, setDialog] = useState(null)

  if (!ready) return null

  if (!set) {
    return (
      <>
        <TopBar
          title="Setlist"
          left={
            <button type="button" className="iconbtn" onClick={() => navigate('/sets')}>
              <Icon name="back" />
            </button>
          }
        />
        <p className="notice">That setlist is no longer here.</p>
      </>
    )
  }

  const order = buildRunOrder(set.songIds, songsById)
  const songs = order.songs.map((item) => item.song)
  const breakTotalMinutes = breakTotal(set.songIds)
  const isUntitled = set.name === DEFAULT_NAME

  const goBack = () => {
    // Discard an ad hoc list that was opened and left completely untouched.
    if (isUntitled && set.songIds.length === 0) {
      deleteSetlist(set.id)
      navigate('/sets', { replace: true })
      return
    }
    back('/sets')
  }

  const reorder = (from, to) => {
    const next = [...set.songIds]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateSetlist(set.id, { songIds: next })
  }

  const removeAt = (index) =>
    updateSetlist(set.id, { songIds: set.songIds.filter((_, i) => i !== index) })

  const addBreak = () =>
    updateSetlist(set.id, { songIds: [...set.songIds, makeBreak(DEFAULT_BREAK_MINUTES)] })

  const setBreakMinutes = (index, minutes) =>
    updateSetlist(set.id, {
      songIds: set.songIds.map((entry, i) => (i === index ? makeBreak(minutes) : entry)),
    })

  const addSongs = (ids) => {
    const additions = ids.filter((id) => !set.songIds.includes(id))
    updateSetlist(set.id, { songIds: [...set.songIds, ...additions] })
    setDialog(null)
  }

  return (
    <>
      <TopBar
        title={set.name}
        left={
          <button type="button" className="iconbtn iconbtn--text" onClick={goBack}>
            <Icon name="back" />
            <span>Setlists</span>
          </button>
        }
        right={
          <button
            type="button"
            className="iconbtn"
            aria-label="Add songs"
            onClick={() => setDialog({ type: 'pick' })}
          >
            <Icon name="plus" />
          </button>
        }
      />

      <div className="profile">
        <div className="setmeta">
          <button
            type="button"
            className="setmeta__name"
            onClick={() => setDialog({ type: 'rename' })}
          >
            <span>{set.name}</span>
            <Icon name="pencil" size={16} />
          </button>
          <p className="setmeta__sub">
            {order.setCount > 1 ? `${order.setCount} sets · ` : ''}
            {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            {describeSetLength(songs) ? ` · ${describeSetLength(songs)}` : ''}
            {breakTotalMinutes > 0 ? ` · ${breakTotalMinutes} min breaks` : ''} · updated{' '}
            {relativeDate(set.updatedAt)}
          </p>
          {songs.length > 0 && setLength(songs).timed < songs.length && (
            <p className="setmeta__hint">
              {setLength(songs).timed} of {songs.length} songs have a length — add one on a
              song to sharpen the total.
            </p>
          )}
        </div>

        {songs.length > 0 && (
          <button
            type="button"
            className="btn btn--primary btn--block btn--gig"
            onClick={() => navigate(`/gig/${set.id}`)}
          >
            <Icon name="play" size={20} /> Start gig mode
          </button>
        )}

        {isUntitled && (
          <button
            type="button"
            className="btn btn--block"
            onClick={() => setDialog({ type: 'save' })}
          >
            Save as Setlist
          </button>
        )}

        {songs.length === 0 ? (
          <EmptyState
            icon="list"
            title="Empty set"
            body="Pull songs in from your library, then drag them into running order."
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setDialog({ type: 'pick' })}
              >
                <Icon name="plus" size={18} /> Add songs
              </button>
            }
          />
        ) : (
          <ReorderList
            items={set.songIds}
            getKey={(entry, index) => `${entry}-${index}`}
            onReorder={reorder}
            renderItem={(entry, { index, handleProps }) => {
              if (isBreakEntry(entry)) {
                const minutes = breakMinutes(entry)
                const nextSet = order.items.find((item) => item.index === index)?.setNumber
                return (
                  <div className="setrow setrow--break">
                    <span className="setrow__num">—</span>
                    <div className="setrow__main">
                      <span className="row__title">Break · {minutes} min</span>
                      <span className="row__tags">Set {nextSet} starts after this</span>
                    </div>
                    <div className="breakstep">
                      <button
                        type="button"
                        className="iconbtn"
                        aria-label="Shorter break"
                        onClick={() => setBreakMinutes(index, minutes - 5)}
                      >
                        <Icon name="minus" size={17} />
                      </button>
                      <button
                        type="button"
                        className="iconbtn"
                        aria-label="Longer break"
                        onClick={() => setBreakMinutes(index, minutes + 5)}
                      >
                        <Icon name="plus" size={17} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="iconbtn iconbtn--danger"
                      aria-label="Remove this break"
                      onClick={() => removeAt(index)}
                    >
                      <Icon name="close" size={18} />
                    </button>
                    <span {...handleProps}>
                      <Icon name="grip" size={22} />
                    </span>
                  </div>
                )
              }

              const item = order.items.find((candidate) => candidate.index === index)
              const song = item?.song || songsById.get(entry)
              if (!song) return null
              return (
                <div className="setrow">
                  <span className="setrow__num">
                    {order.setCount > 1 && item?.startsSet && (
                      <span className="setrow__set">SET {item.setNumber}</span>
                    )}
                    {item?.positionInSet ?? index + 1}
                  </span>
                  <button
                    type="button"
                    className="setrow__main"
                    onClick={() => navigate(`/songs/${song.id}`)}
                  >
                    <span className="row__title">{song.name || 'Untitled song'}</span>
                    {song.tags?.length > 0 && (
                      <span className="row__tags">{song.tags.join(' · ')}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    aria-label={`Remove ${song.name || 'song'} from setlist`}
                    onClick={() => removeAt(index)}
                  >
                    <Icon name="minus" size={19} />
                  </button>
                  <span {...handleProps}>
                    <Icon name="grip" size={22} />
                  </span>
                </div>
              )
            }}
          />
        )}

        <div className="stack">
          <button
            type="button"
            className="btn btn--block"
            onClick={() => setDialog({ type: 'pick' })}
          >
            <Icon name="plus" size={18} /> Add songs
          </button>
          <button
            type="button"
            className="btn btn--block"
            onClick={addBreak}
            data-testid="add-break"
          >
            <Icon name="pause" size={18} /> Add a break
          </button>
          <button
            type="button"
            className="btn btn--block"
            onClick={() => setDialog({ type: 'duplicate' })}
          >
            <Icon name="copy" size={18} /> Duplicate this setlist
          </button>
          <button
            type="button"
            className="btn btn--danger btn--block"
            onClick={() => setDialog({ type: 'delete' })}
          >
            <Icon name="trash" size={18} /> Delete setlist
          </button>
        </div>
      </div>

      {dialog?.type === 'pick' && (
        <SongPicker
          alreadyIn={set.songIds}
          onDone={addSongs}
          onCancel={() => setDialog(null)}
        />
      )}

      {(dialog?.type === 'rename' || dialog?.type === 'save') && (
        <PromptDialog
          title={dialog.type === 'save' ? 'Save as Setlist' : 'Rename setlist'}
          label="Setlist name"
          placeholder="Sunday Gig"
          initialValue={isUntitled && dialog.type === 'save' ? '' : set.name}
          confirmLabel={dialog.type === 'save' ? 'Save' : 'Rename'}
          onCancel={() => setDialog(null)}
          onConfirm={(name) => {
            updateSetlist(set.id, { name })
            setDialog(null)
          }}
        />
      )}

      {dialog?.type === 'duplicate' && (
        <PromptDialog
          title="Duplicate setlist"
          label="Name for the copy"
          initialValue={copyName(
            set.name,
            setlists.map((item) => item.name),
          )}
          confirmLabel="Duplicate"
          onCancel={() => setDialog(null)}
          onConfirm={(name) => {
            const copy = duplicateSetlist(set.id, name)
            setDialog(null)
            if (copy) navigate(`/sets/${copy.id}`)
          }}
        />
      )}

      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title={`Delete “${set.name}”?`}
          body="The songs stay in your library — only this setlist goes away."
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            deleteSetlist(set.id)
            navigate('/sets', { replace: true })
          }}
        />
      )}
    </>
  )
}
