import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { back, navigate } from '../router.js'
import { DIFFICULTIES, formatDate, hasNotes, toNoteLines, todayISO, uid } from '../model.js'
import { ConfirmDialog, Icon, TopBar } from './ui.jsx'
import { prepareImage } from '../images.js'
import { NotesList } from './NotesList.jsx'
import { AppleMusicLink } from './AppleMusicLink.jsx'
import { TempoRow } from './Tempo.jsx'

function normaliseUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Screenshots kept with a song — the page you imported it from, a chart, a setlist photo. */
function Attachments({ song, patch }) {
  const { loadImage, saveImage, deleteImage } = useLibrary()
  const [images, setImages] = useState([])
  const [viewing, setViewing] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const ids = song.imageIds || []
    if (ids.length === 0) {
      setImages([])
      return undefined
    }
    Promise.all(ids.map((id) => loadImage(id)))
      .then((loaded) => {
        if (!cancelled) setImages(loaded.filter(Boolean))
      })
      .catch((err) => console.error('Could not load images', err))
    return () => {
      cancelled = true
    }
  }, [song.imageIds, loadImage])

  const onFiles = async (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/'))
    event.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    try {
      const ids = []
      for (const file of files) {
        const { dataUrl } = await prepareImage(file)
        ids.push(saveImage(dataUrl))
      }
      patch({ imageIds: [...(song.imageIds || []), ...ids] })
    } catch (err) {
      console.error('Could not attach image', err)
    } finally {
      setBusy(false)
    }
  }

  const remove = (id) => {
    deleteImage(id)
    patch({ imageIds: (song.imageIds || []).filter((imageId) => imageId !== id) })
  }

  return (
    <div className="card">
      <div className="field">
        <span className="field__label">Screenshots</span>
        {images.length > 0 && (
          <div className="shots">
            {images.map((image) => (
              <div key={image.id} className="shots__item">
                <button type="button" onClick={() => setViewing(image)}>
                  <img src={image.dataUrl} alt="Attached screenshot" />
                </button>
                <button
                  type="button"
                  className="shots__remove"
                  aria-label="Remove screenshot"
                  onClick={() => remove(image.id)}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        <button
          type="button"
          className="btn btn--small"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="image" size={16} /> {busy ? 'Adding…' : 'Add screenshot'}
        </button>
      </div>

      {viewing && (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button type="button" className="lightbox__scrim" aria-label="Close" onClick={() => setViewing(null)} />
          <img src={viewing.dataUrl} alt="Attached screenshot" />
          <button type="button" className="lightbox__close" onClick={() => setViewing(null)}>
            <Icon name="close" size={22} />
          </button>
        </div>
      )}
    </div>
  )
}

export function SongProfile({ songId, isNew }) {
  const { songsById, updateSong, deleteSong, ready } = useLibrary()
  const song = songsById.get(songId)
  const [tagDraft, setTagDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => nameRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isNew])

  if (!ready) return null

  if (!song) {
    return (
      <>
        <TopBar
          title="Song"
          left={
            <button type="button" className="iconbtn" onClick={() => navigate('/songs')}>
              <Icon name="back" />
            </button>
          }
        />
        <p className="notice">That song is no longer in your library.</p>
      </>
    )
  }

  const patch = (changes) => updateSong(song.id, changes)

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase()
    if (!tag) return
    if (!song.tags.includes(tag)) patch({ tags: [...song.tags, tag] })
    setTagDraft('')
  }

  const addLink = () =>
    patch({ tutorialLinks: [...song.tutorialLinks, { id: uid('link'), label: '', url: '' }] })

  const updateLink = (index, changes) =>
    patch({
      tutorialLinks: song.tutorialLinks.map((link, i) =>
        i === index ? { ...link, ...changes } : link,
      ),
    })

  const removeLink = (index) =>
    patch({ tutorialLinks: song.tutorialLinks.filter((_, i) => i !== index) })

  const goBack = () => {
    // A song added and then abandoned without a name shouldn't clutter the library.
    if (
      !song.name.trim() &&
      !(song.artist || '').trim() &&
      !hasNotes(song) &&
      song.tags.length === 0
    ) {
      deleteSong(song.id)
      navigate('/songs', { replace: true })
      return
    }
    back('/songs')
  }

  return (
    <>
      <TopBar
        title={song.name.trim() || 'New Song'}
        left={
          <button type="button" className="iconbtn iconbtn--text" onClick={goBack}>
            <Icon name="back" />
            <span>Songs</span>
          </button>
        }
      />

      <div className="profile">
        <div className="card">
          <label className="field">
            <span className="field__label">Name</span>
            <input
              ref={nameRef}
              className="field__input field__input--title"
              value={song.name}
              placeholder="Song name"
              onChange={(event) => patch({ name: event.target.value })}
              autoComplete="off"
            />
          </label>
          <div className="field field--sub">
            <input
              className="field__input field__input--artist"
              value={song.artist || ''}
              placeholder="Add artist"
              aria-label="Artist"
              onChange={(event) => patch({ artist: event.target.value })}
              autoComplete="off"
            />
          </div>
          <AppleMusicLink song={song} patch={patch} />
          <TempoRow song={song} patch={patch} />
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">Notes</span>
            <NotesList
              lines={toNoteLines(song.notes)}
              onChange={(lines) => patch({ notes: lines })}
              placeholder="Playing notes, cues, quirks — one per line"
            />
          </div>
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">Difficulty</span>
            <div className="segmented" role="group" aria-label="Difficulty">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`segmented__item ${
                    song.difficulty === level ? 'segmented__item--on' : ''
                  }`}
                  aria-pressed={song.difficulty === level}
                  onClick={() => patch({ difficulty: song.difficulty === level ? '' : level })}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">Last played</span>
            <div className="field__row">
              <input
                type="date"
                className="field__input"
                value={song.lastPlayed || ''}
                onChange={(event) => patch({ lastPlayed: event.target.value })}
              />
              <button
                type="button"
                className="btn btn--small"
                onClick={() => patch({ lastPlayed: todayISO() })}
              >
                Today
              </button>
            </div>
            {song.lastPlayed && (
              <p className="field__hint">Last played {formatDate(song.lastPlayed)}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">Tags</span>
            {song.tags.length > 0 && (
              <div className="chips">
                {song.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                    <button
                      type="button"
                      className="chip__remove"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => patch({ tags: song.tags.filter((t) => t !== tag) })}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="field__row">
              <input
                className="field__input"
                value={tagDraft}
                placeholder="funk, fill practice…"
                onChange={(event) => setTagDraft(event.target.value)}
                onBlur={addTag}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault()
                    addTag()
                  }
                }}
                autoComplete="off"
                autoCapitalize="none"
              />
              <button type="button" className="btn btn--small" onClick={addTag}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">Tutorial links</span>
            {song.tutorialLinks.map((link, index) => (
              <div key={link.id || index} className="linkrow">
                <div className="linkrow__inputs">
                  <input
                    className="field__input"
                    value={link.label}
                    placeholder="Label (e.g. Drumeo breakdown)"
                    onChange={(event) => updateLink(index, { label: event.target.value })}
                    autoComplete="off"
                  />
                  <input
                    className="field__input"
                    type="url"
                    inputMode="url"
                    value={link.url}
                    placeholder="https://youtube.com/…"
                    onChange={(event) => updateLink(index, { url: event.target.value })}
                    onBlur={(event) => updateLink(index, { url: normaliseUrl(event.target.value) })}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck="false"
                  />
                </div>
                <div className="linkrow__actions">
                  {link.url && (
                    <a
                      className="iconbtn"
                      href={normaliseUrl(link.url)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${link.label || 'tutorial link'}`}
                    >
                      <Icon name="link" size={19} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    aria-label="Remove link"
                    onClick={() => removeLink(index)}
                  >
                    <Icon name="minus" size={19} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn--small" onClick={addLink}>
              <Icon name="plus" size={16} /> Add link
            </button>
          </div>
        </div>

        <Attachments song={song} patch={patch} />

        <button
          type="button"
          className="btn btn--danger btn--block"
          onClick={() => setConfirmDelete(true)}
        >
          <Icon name="trash" size={18} /> Delete song
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${song.name.trim() || 'Untitled song'}”?`}
          body="This removes the song from your library and from every setlist it's in."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteSong(song.id)
            navigate('/songs', { replace: true })
          }}
        />
      )}
    </>
  )
}
