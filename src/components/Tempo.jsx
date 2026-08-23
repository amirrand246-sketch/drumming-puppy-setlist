import { useEffect, useRef, useState } from 'react'
import { lookupTrack, trackIdFromUrl } from '../appleMusic.js'
import { createMetronome } from '../metronome.js'
import {
  TEMPO_UNAVAILABLE,
  TEMPO_UNCONFIRMED,
  findTempo,
  hasTempoKey,
} from '../tempo.js'
import { Icon } from './ui.jsx'

/** Shared metronome control: a play/pause button with a beat light. */
export function MetronomeButton({ bpm, label, className = '' }) {
  const [running, setRunning] = useState(false)
  const [pulse, setPulse] = useState(false)
  const engine = useRef(null)
  const flash = useRef(null)

  useEffect(() => {
    engine.current = createMetronome({
      onBeat: () => {
        setPulse(true)
        clearTimeout(flash.current)
        flash.current = setTimeout(() => setPulse(false), 90)
      },
    })
    return () => {
      clearTimeout(flash.current)
      engine.current?.close()
    }
  }, [])

  // A changed tempo — or a changed song — should never keep clicking the old one.
  useEffect(() => {
    engine.current?.stop()
    setRunning(false)
  }, [bpm])

  const toggle = async () => {
    if (running) {
      engine.current.stop()
      setRunning(false)
      return
    }
    const started = await engine.current.start(bpm)
    setRunning(Boolean(started))
  }

  if (!bpm) return null

  return (
    <button
      type="button"
      className={`metro ${running ? 'metro--on' : ''} ${className}`}
      onClick={toggle}
      aria-pressed={running}
      aria-label={running ? 'Stop the metronome' : `Start the metronome at ${bpm} BPM`}
      data-testid="metronome"
    >
      <Icon name={running ? 'pause' : 'play'} size={16} />
      <span>{label}</span>
      <span className={`metro__beat ${pulse ? 'metro__beat--hit' : ''}`} aria-hidden="true" />
    </button>
  )
}

function describe(song) {
  if (!song.bpm) return 'Tempo unavailable'
  return song.tempoConfidence === TEMPO_UNCONFIRMED
    ? `${song.bpm} BPM (unconfirmed)`
    : `${song.bpm} BPM`
}

/** Tempo row on the song profile: looks the tempo up once, then just plays it. */
export function TempoRow({ song, patch }) {
  const [state, setState] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  const running = useRef(false)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const linked = Boolean(song.appleMusicUrl)
  const checked = song.tempoCheckedUrl === song.appleMusicUrl && song.tempoConfidence

  useEffect(() => {
    if (!linked || checked || running.current || !online || !hasTempoKey()) return undefined
    let cancelled = false
    running.current = true
    setState('looking')

    const run = async () => {
      try {
        // The linked track is the authority — not the free-typed fields.
        let track = song.appleMusicTrack
        if (!track || track.url !== song.appleMusicUrl) {
          track = await lookupTrack(trackIdFromUrl(song.appleMusicUrl))
          if (track) track.url = song.appleMusicUrl
        }
        if (!track) {
          if (!cancelled) {
            patch({ tempoConfidence: TEMPO_UNAVAILABLE, bpm: null, tempoCheckedUrl: song.appleMusicUrl })
            setState('')
          }
          return
        }
        const { bpm, confidence } = await findTempo(track)
        if (cancelled) return
        patch({
          appleMusicTrack: track,
          bpm: bpm || null,
          tempoConfidence: confidence,
          tempoCheckedUrl: song.appleMusicUrl,
        })
        setState('')
      } catch (err) {
        console.error('Tempo lookup failed', err)
        if (!cancelled) setState('failed')
      } finally {
        running.current = false
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [linked, checked, online, song.appleMusicUrl, song.appleMusicTrack, patch])

  const retry = () => {
    patch({ tempoConfidence: '', tempoCheckedUrl: '', bpm: null })
    setState('')
  }

  let message = ''
  if (!linked) message = 'Link Apple Music first'
  else if (!hasTempoKey()) message = 'No tempo service configured'
  else if (state === 'looking') message = 'Looking up the tempo…'
  else if (state === 'failed') message = "Couldn't reach the tempo service"
  else if (!checked && !online) message = 'Connect to fetch tempo'
  else if (!song.bpm) message = 'Tempo unavailable'

  return (
    <div className="tempo">
      {song.bpm ? (
        <>
          <MetronomeButton bpm={song.bpm} label={describe(song)} />
          {song.tempoConfidence === TEMPO_UNCONFIRMED && (
            <span className="tempo__flag" title="Could not be checked against the linked track">
              unchecked version
            </span>
          )}
          {/* GetSongBPM ask for a link back wherever their data is shown. */}
          <a className="tempo__credit" href="https://getsongbpm.com" target="_blank" rel="noreferrer">
            via GetSongBPM
          </a>
        </>
      ) : (
        <span className="tempo__note">{message}</span>
      )}
      {linked && !song.bpm && checked && online && hasTempoKey() && (
        <button type="button" className="linklike" onClick={retry}>
          Look again
        </button>
      )}
    </div>
  )
}
