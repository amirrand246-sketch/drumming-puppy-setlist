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

/**
 * Shared metronome control: play/pause with a beat light, and optional −/+ so a
 * tempo can be found without leaving the screen. Holding a nudge repeats.
 *
 * Every song can click, whether or not a tempo was ever looked up: with none
 * stored it starts from a sensible default, and whatever you set is saved to
 * the song so it is there next time.
 */
export const DEFAULT_BPM = 100

export function MetronomeButton({ bpm, label, className = '', onTempoChange, adjustable = false }) {
  const [running, setRunning] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [working, setWorking] = useState(() => bpm || DEFAULT_BPM)
  // Mirrors `working` synchronously: saving a tempo bounces straight back as a
  // prop, and without this the effect below would stop the click we just began.
  const workingRef = useRef(bpm || DEFAULT_BPM)
  const engine = useRef(null)
  const flash = useRef(null)
  const hold = useRef(null)

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
      clearTimeout(hold.current)
      engine.current?.close()
    }
  }, [])

  // A tempo that genuinely changed underneath us — a different song, a lookup
  // landing — stops the click. Our own saves are not that.
  useEffect(() => {
    const next = bpm || DEFAULT_BPM
    if (next === workingRef.current) return
    engine.current?.stop()
    setRunning(false)
    workingRef.current = next
    setWorking(next)
  }, [bpm])

  const toggle = async () => {
    if (running) {
      engine.current.stop()
      setRunning(false)
      return
    }
    const started = await engine.current.start(workingRef.current)
    setRunning(Boolean(started))
    // Starting from the default is a decision about this song; keep it.
    if (started && !bpm && onTempoChange) onTempoChange(workingRef.current)
  }

  const step = (delta) => {
    setWorking((current) => {
      const next = Math.min(400, Math.max(20, current + delta))
      if (next === current) return current
      workingRef.current = next
      if (onTempoChange) onTempoChange(next)
      if (running) {
        engine.current.stop()
        engine.current.start(next)
      }
      return next
    })
  }

  const startHold = (delta) => {
    step(delta)
    let wait = 420
    const tick = () => {
      step(delta)
      wait = Math.max(60, wait - 60)
      hold.current = setTimeout(tick, wait)
    }
    hold.current = setTimeout(tick, wait)
  }

  const endHold = () => clearTimeout(hold.current)

  const nudge = (delta, name) => ({
    type: 'button',
    className: 'metro__nudge',
    'aria-label': name,
    onPointerDown: () => startHold(delta),
    onPointerUp: endHold,
    onPointerLeave: endHold,
    onPointerCancel: endHold,
  })

  return (
    <span className={`metro ${running ? 'metro--on' : ''} ${className}`}>
      {adjustable && (
        <button {...nudge(-1, 'Slower')}>
          <Icon name="minus" size={15} />
        </button>
      )}
      <button
        type="button"
        className="metro__play"
        onClick={toggle}
        aria-pressed={running}
        aria-label={running ? 'Stop the metronome' : `Start the metronome at ${working} BPM`}
        data-testid="metronome"
      >
        <Icon name={running ? 'pause' : 'play'} size={16} />
        <span>{label ?? `${working} BPM`}</span>
        <span className={`metro__beat ${pulse ? 'metro__beat--hit' : ''}`} aria-hidden="true" />
      </button>
      {adjustable && (
        <button {...nudge(1, 'Faster')}>
          <Icon name="plus" size={15} />
        </button>
      )}
    </span>
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

        <MetronomeButton
          bpm={song.bpm}
          adjustable
          label={song.bpm ? describe(song) : 'Metronome'}
          onTempoChange={(next) =>
            patch({
              bpm: next,
              tempoConfidence: TEMPO_MANUAL,
              tempoCheckedUrl: song.appleMusicUrl || '',
            })
          }
        />

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
