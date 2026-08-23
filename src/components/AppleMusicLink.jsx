import { useEffect, useState } from 'react'
import { findSong, isAppleMusicUrl } from '../appleMusic.js'
import { Icon, PromptDialog } from './ui.jsx'

const MESSAGES = {
  searching: 'Searching Apple Music…',
  noname: 'Give the song a name first.',
  noartist: 'Add the artist first — searching without one picks the wrong song too often.',
  notfound: "Couldn't find this on Apple Music. Paste the link instead.",
  failed: 'Search failed. Check your connection, or paste the link instead.',
  offline: 'Connect to the internet to search Apple Music.',
}

export function AppleMusicLink({ song, patch }) {
  const [status, setStatus] = useState('')
  const [found, setFound] = useState(null)
  const [editing, setEditing] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine !== false)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const url = song.appleMusicUrl || ''
  const manual = song.appleMusicSource === 'manual'

  const lookUp = async () => {
    setFound(null)
    if (!song.name.trim()) return setStatus('noname')
    if (!(song.artist || '').trim()) return setStatus('noartist')
    if (!online) return setStatus('offline')

    setStatus('searching')
    try {
      const match = await findSong(song.name, song.artist)
      if (!match) return setStatus('notfound')
      patch({
        appleMusicUrl: match.url,
        appleMusicSource: 'auto',
        appleMusicTrack: match,
        bpm: null,
        tempoConfidence: '',
        tempoCheckedUrl: '',
      })
      setStatus('')
      setFound(match)
      // The search broke the user gesture, so a pop-up can be refused; when it
      // is, the button below is already there to tap.
      window.open(match.url, '_blank', 'noopener')
    } catch (err) {
      console.error('Apple Music search failed', err)
      setStatus('failed')
    }
  }

  const reset = () => {
    patch({
      appleMusicUrl: '',
      appleMusicSource: '',
      appleMusicTrack: null,
      bpm: null,
      tempoConfidence: '',
      tempoCheckedUrl: '',
    })
    setFound(null)
    setStatus('')
  }

  return (
    <div className="apple">
      <div className="apple__row">
        {url ? (
          <a
            className="btn btn--small"
            href={url}
            target="_blank"
            rel="noreferrer"
            data-testid="apple-open"
          >
            <Icon name="note" size={16} /> Open in Apple Music
          </a>
        ) : (
          <button
            type="button"
            className="btn btn--small"
            onClick={lookUp}
            disabled={status === 'searching'}
            data-testid="apple-find"
          >
            <Icon name="note" size={16} />{' '}
            {status === 'searching' ? 'Searching…' : 'Find on Apple Music'}
          </button>
        )}

        <button
          type="button"
          className="iconbtn"
          aria-label={url ? 'Fix the Apple Music link' : 'Paste an Apple Music link'}
          onClick={() => setEditing(true)}
        >
          <Icon name="pencil" size={18} />
        </button>
      </div>

      {found && (
        <p className="apple__status">
          Matched {found.trackName} — {found.artistName}
        </p>
      )}
      {status && status !== 'searching' && <p className="apple__status apple__status--warn">{MESSAGES[status]}</p>}
      {status === 'searching' && <p className="apple__status">{MESSAGES.searching}</p>}
      {!status && !found && url && (
        <p className="apple__status">{manual ? 'Link set by hand.' : 'Matched automatically.'}</p>
      )}

      {url && (
        <button type="button" className="linklike" onClick={reset}>
          Reset to auto-match
        </button>
      )}

      {editing && (
        <PromptDialog
          title="Apple Music link"
          label="Paste the link"
          placeholder="https://music.apple.com/…"
          initialValue={url}
          confirmLabel="Save link"
          help="In Apple Music, use Share → Copy Link on the song."
          validate={(value) =>
            isAppleMusicUrl(value) ? '' : "That doesn't look like an Apple Music link."
          }
          onCancel={() => setEditing(false)}
          onConfirm={(value) => {
            patch({
              appleMusicUrl: value,
              appleMusicSource: 'manual',
              appleMusicTrack: null,
              bpm: null,
              tempoConfidence: '',
              tempoCheckedUrl: '',
            })
            setFound(null)
            setStatus('')
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}
