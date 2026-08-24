import { useEffect, useRef, useState } from 'react'
import { lookupTrack, trackIdFromUrl } from '../appleMusic.js'
import { createMetronome } from '../metronome.js'
import {
  TEMPO_MANUAL,
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
  return song.tempoConfidence === TEMPO_UNCONFIRMED
    ? `${song.bpm} BPM (unconfirmed)`
    : `${song.bpm} BPM`
}

/** Keep a typed tempo inside what a metronome can sensibly click. */
function cleanBpm(value) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.min(400, Math.max(20, number))
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
    const typedByHand = song.tempoConfidence === TEMPO_MANUAL
    if (!linked || checked || typedByHand || running.current || !online || !hasTempoKey()) {
      return undefined
    }
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
  }, [linked, checked, online, song.appleMusicUrl, song.appleMusicTrack, song.tempoConfidence, patch])

  const retry = () => {
    patch({ tempoConfidence: '', tempoCheckedUrl: '', bpm: null })
    setState('')
  }

  const manual = song.tempoConfidence === TEMPO_MANUAL

  let hint = ''
  if (state === 'looking') hint = 'Looking up the tempo…'
  else if (state === 'failed') hint = "Couldn't reach the tempo service"
  else if (!song.bpm && linked && !checked && !online) hint = 'Connect to fetch tempo'
  else if (!song.bpm && linked && checked) hint = 'Tempo unavailable — type one in'
  else if (!song.bpm && !linked) hint = 'Type a tempo, or link Apple Music to look it up'

  return (
    <div className="tempo">
      <div className="tempo__row">
        <label className="tempo__entry">
          <input
            className="tempo__input"
            type="number"
            inputMode="numeric"
            min="20"
            max="400"
            step="1"
            value={song.bpm ?? ''}
            placeholder="—"
            aria-label="Beats per minute"
            data-testid="bpm-input"
            onChange={(event) => {
              const bpm = cleanBpm(event.target.value)
              patch({
                bpm,
                tempoConfidence: bpm ? TEMPO_MANUAL : '',
                tempoCheckedUrl: bpm ? song.appleMusicUrl || '' : '',
              })
            }}
          />
          <span className="tempo__unit">BPM</span>
        </label>

        {song.bpm ? <MetronomeButton bpm={song.bpm} label="Metronome" /> : null}

        {song.bpm && song.tempoConfidence === TEMPO_UNCONFIRMED && (
          <span className="tempo__flag" title="Could not be checked against the linked track">
            unchecked version
          </span>
        )}
      </div>

      {hint && <span className="tempo__note">{hint}</span>}

      {song.bpm && !manual && (
        <a className="tempo__credit" href="https://getsongbpm.com" target="_blank" rel="noreferrer">
          via GetSongBPM
        </a>
      )}
      {linked && manual && hasTempoKey() && (
        <button
          type="button"
          className="linklike"
          onClick={() => patch({ bpm: null, tempoConfidence: '', tempoCheckedUrl: '' })}
        >
          Look it up instead
        </button>
      )}
    </div>
  )
}
