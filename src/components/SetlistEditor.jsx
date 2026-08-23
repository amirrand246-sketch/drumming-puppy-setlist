import { useState } from 'react'
import { useLibrary } from '../store.jsx'
import { back, navigate } from '../router.js'
import { copyName, relativeDate } from '../model.js'
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

  const songs = set.songIds.map((id) => songsById.get(id)).filter(Boolean)
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
            {songs.length} {songs.length === 1 ? 'song' : 'songs'} · updated{' '}
            {relativeDate(set.updatedAt)}
          </p>
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
            items={songs}
            getKey={(song) => song.id}
            onReorder={reorder}
            renderItem={(song, { index, handleProps }) => (
              <div className="setrow">
                <span className="setrow__num">{index + 1}</span>
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
            )}
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
