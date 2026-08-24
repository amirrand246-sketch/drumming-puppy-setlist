import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { back, navigate } from '../router.js'
import {
  beatsPerBar,
  breakTotal,
  buildRunOrder,
  countInBody,
  describeSetLength,
  isCompound,
  isCountInLine,
  toNoteLines,
  todayISO,
} from '../model.js'
import { clearGigPosition, readGigPosition, saveGigPosition } from '../gigSession.js'
import { Icon } from './ui.jsx'
import { MetronomeButton } from './Tempo.jsx'

const SCALE_KEY = 'dps:gigScale'
const SCALES = [1, 1.15, 1.35, 1.6]
const SWIPE_THRESHOLD = 55

function readScale() {
  try {
    const stored = Number(localStorage.getItem(SCALE_KEY))
    return SCALES.includes(stored) ? stored : 1
  } catch {
    return 1
  }
}

/** Keep the screen on while the set is running. */
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return undefined
    let lock = null
    let released = false

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* denied or unsupported — the set still runs, the screen just dims */
      }
    }
    // iOS drops the lock whenever the app goes to the background.
    const onVisibility = () => {
      if (!released && document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release?.().catch(() => {})
    }
  }, [active])
}

/** What the phone shows between sets: how long is left, and what opens the next one. */
function BreakScreen({ minutes, setNumber, nextSong }) {
  const [endsAt] = useState(() => Date.now() + minutes * 60 * 1000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const left = Math.max(0, Math.round((endsAt - now) / 1000))
  const clock = new Date(endsAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="gigbreak">
      <p className="gigbreak__label">Break</p>
      <p className={`gigbreak__clock ${left === 0 ? 'gigbreak__clock--done' : ''}`}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </p>
      <p className="gigbreak__back">{left === 0 ? 'Time to go' : `Back at ${clock}`}</p>
      <p className="gigbreak__next">
        Set {setNumber} opens with {nextSong ? nextSong.name || 'Untitled song' : 'nothing yet'}
      </p>
    </div>
  )
}

export function GigMode({ setlistId }) {
  const { setlists, songsById, updateSong, ready } = useLibrary()
  const set = setlists.find((item) => item.id === setlistId)
  const order = buildRunOrder(set?.songIds || [], songsById)
  // "songs" is the run order now — every stop in the night, breaks included.
  const songs = order.items

  const [index, setIndex] = useState(() => {
    const saved = readGigPosition()
    return saved && saved.setlistId === setlistId ? saved.index : 0
  })
  const [finished, setFinished] = useState(false)
  const [overview, setOverview] = useState(false)
  const [scale, setScale] = useState(readScale)
  const [swipe, setSwipe] = useState(0)
  const touch = useRef(null)
  const currentRow = useRef(null)

  useWakeLock(songs.length > 0 && !finished)

  useEffect(() => {
    document.body.classList.add('gig-open')
    return () => document.body.classList.remove('gig-open')
  }, [])

  // Written on every move, so an app that dies mid-set comes back where it was.
  useEffect(() => {
    if (songs.length > 0 && index < songs.length) saveGigPosition(setlistId, index)
  }, [setlistId, index, songs.length])

  const go = useCallback(
    (delta) => {
      setIndex((current) => Math.min(songs.length - 1, Math.max(0, current + delta)))
    },
    [songs.length],
  )

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'Escape') {
        if (overview) setOverview(false)
        else back(`/sets/${setlistId}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, setlistId, overview])

  // Opening the overview on song 14 should show song 14, not the top of the set.
  useEffect(() => {
    if (overview) currentRow.current?.scrollIntoView({ block: 'center' })
  }, [overview])

  const changeScale = (delta) => {
    const next = SCALES[Math.min(SCALES.length - 1, Math.max(0, SCALES.indexOf(scale) + delta))]
    setScale(next)
    try {
      localStorage.setItem(SCALE_KEY, String(next))
    } catch {
      /* a stored preference is a nicety, not a requirement */
    }
  }

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    touch.current = { x: event.clientX, y: event.clientY, active: true }
  }

  const onPointerMove = (event) => {
    const start = touch.current
    if (!start?.active) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    // Let vertical drags scroll long notes instead of flicking to the next song.
    if (Math.abs(dy) > Math.abs(dx)) {
      touch.current = null
      setSwipe(0)
      return
    }
    setSwipe(dx)
  }

  const onPointerUp = () => {
    const dx = swipe
    touch.current = null
    setSwipe(0)
    if (dx <= -SWIPE_THRESHOLD) go(1)
    else if (dx >= SWIPE_THRESHOLD) go(-1)
  }

  const markAllPlayed = () => {
    const today = todayISO()
    for (const item of order.songs) updateSong(item.song.id, { lastPlayed: today })
    clearGigPosition()
    navigate(`/sets/${setlistId}`, { replace: true })
  }

  if (!ready) return null

  if (!set || songs.length === 0) {
    return (
      <div className="gig gig--empty">
        <p>{!set ? 'That setlist is gone.' : 'This setlist has no songs in it yet.'}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => navigate(set ? `/sets/${setlistId}` : '/sets', { replace: true })}
        >
          Back to the setlist
        </button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="gig gig--empty">
        <h2 className="gig__done">Set finished</h2>
        <p className="gig__donesub">{order.songs.length} songs — nice one.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={markAllPlayed}>
          Mark all played today
        </button>
        <button
          type="button"
          className="btn btn--block gig__btn"
          onClick={() => navigate(`/sets/${setlistId}`, { replace: true })}
        >
          Just exit
        </button>
        <button type="button" className="btn btn--block gig__btn" onClick={() => setFinished(false)}>
          Back to the set
        </button>
      </div>
    )
  }

  const current = songs[index]
  const song = current?.kind === 'song' ? current.song : null
  const nextItem = songs[index + 1]
  const previousItem = songs[index - 1]
  const labelOf = (item) =>
    !item
      ? ''
      : item.kind === 'break'
        ? `Break · ${item.minutes} min`
        : item.song.name || 'Untitled song'
  const next = nextItem ? { name: labelOf(nextItem) } : null
  const previous = previousItem ? { name: labelOf(previousItem) } : null
  const atEnd = index === songs.length - 1
  const noteLines = song
    ? toNoteLines(song.notes).filter((line, i) =>
        (i === 0 && isCountInLine(line) ? countInBody(line) : line).trim(),
      )
    : []

  return (
    <div className="gig">
      <header className="gig__bar">
        <button
          type="button"
          className="gig__icon"
          aria-label="Leave gig mode"
          onClick={() => navigate(`/sets/${setlistId}`, { replace: true })}
        >
          <Icon name="close" size={22} />
        </button>
        <button
          type="button"
          className="gig__counter"
          onClick={() => setOverview((open) => !open)}
          aria-label={overview ? 'Back to the current song' : 'Show the whole set'}
        >
          {current?.kind === 'break'
            ? `Break · set ${current.setNumber} next`
            : order.setCount > 1
              ? `Set ${current?.setNumber ?? 1} · ${current?.positionInSet ?? 1} / ${order.songsInSet(current?.setNumber ?? 1)}`
              : `${current?.positionInSet ?? 1} / ${order.songs.length}`}
        </button>
        <div className="gig__zoom">
          {!overview && (
            <>
              <button
                type="button"
                className="gig__icon"
                aria-label="Smaller text"
                disabled={scale === SCALES[0]}
                onClick={() => changeScale(-1)}
              >
                <span className="gig__zoomtext gig__zoomtext--small">A</span>
              </button>
              <button
                type="button"
                className="gig__icon"
                aria-label="Bigger text"
                disabled={scale === SCALES[SCALES.length - 1]}
                onClick={() => changeScale(1)}
              >
                <span className="gig__zoomtext">A</span>
              </button>
            </>
          )}
          <button
            type="button"
            className={`gig__icon ${overview ? 'gig__icon--on' : ''}`}
            aria-pressed={overview}
            aria-label={overview ? 'Back to the current song' : 'Show the whole set'}
            onClick={() => setOverview((open) => !open)}
          >
            <Icon name="list" size={22} />
          </button>
        </div>
      </header>

      {overview ? (
        <>
        <p className="gig__setinfo">
          {order.setCount > 1 ? `${order.setCount} sets · ` : ''}
          {order.songs.length} songs
          {describeSetLength(order.songs.map((item) => item.song))
            ? ` · ${describeSetLength(order.songs.map((item) => item.song))}`
            : ''}
          {breakTotal(set.songIds) > 0 ? ` · ${breakTotal(set.songIds)} min breaks` : ''}
          {index < songs.length - 1 &&
          describeSetLength(
            songs.slice(index).filter((item) => item.kind === 'song').map((item) => item.song),
          )
            ? ` · ${describeSetLength(songs.slice(index).filter((item) => item.kind === 'song').map((item) => item.song))} left`
            : ''}
        </p>
        <ul className="gig__list">
          {songs.map((item, i) => (
            <li key={`${item.entry}-${i}`}>
              {item.kind === 'song' && item.startsSet && order.setCount > 1 && (
                <p className="gig__setmark">Set {item.setNumber}</p>
              )}
              <button
                type="button"
                ref={i === index ? currentRow : null}
                className={`gig__listrow ${i === index ? 'gig__listrow--now' : ''} ${
                  item.kind === 'break' ? 'gig__listrow--break' : ''
                }`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => {
                  setIndex(i)
                  setOverview(false)
                }}
              >
                <span className="gig__listnum">
                  {item.kind === 'break' ? '—' : item.positionInSet}
                </span>
                <span className="gig__listname">
                  {item.kind === 'break'
                    ? `Break · ${item.minutes} min`
                    : item.song.name || 'Untitled song'}
                </span>
                {i === index && <span className="gig__now">Now</span>}
              </button>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <div
          className="gig__stage"
          style={{ transform: `translateX(${swipe / 4}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {current?.kind === 'break' ? (
            <BreakScreen
              minutes={current.minutes}
              setNumber={current.setNumber}
              nextSong={songs.slice(index + 1).find((item) => item.kind === 'song')?.song}
            />
          ) : (
          <>
          <h1 className="gig__title" style={{ fontSize: `${28 * scale}px` }}>
            {song.name || 'Untitled song'}
          </h1>
          {song && (
          <MetronomeButton
            key={song.id}
            bpm={song.bpm}
            adjustable
            className="metro--gig"
            meter={{
              beatsPerBar: beatsPerBar(song.timeSignature),
              compound: isCompound(song.timeSignature),
            }}
            label={
              song.bpm && song.tempoConfidence === 'unconfirmed'
                ? `${song.bpm} BPM · unconfirmed`
                : undefined
            }
            onTempoChange={(next) =>
              updateSong(song.id, { bpm: next, tempoConfidence: 'manual' })
            }
          />
          )}
          {noteLines.length > 0 ? (
            <ul className="gig__notes" style={{ fontSize: `${19 * scale}px` }}>
              {noteLines.map((line, i) => (
                // eslint-disable-next-line react/no-array-index-key -- read-only list
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="gig__nonotes">No notes for this one.</p>
          )}
          </>
          )}
        </div>
      )}

      <footer className="gig__foot">
        {overview ? (
          <button
            type="button"
            className="gig__step gig__step--main gig__step--wide"
            onClick={() => setOverview(false)}
          >
            Back to {current?.kind === 'break' ? 'the break' : song?.name || 'the set'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="gig__pill"
              onClick={() => setOverview(true)}
              aria-label="Show the whole set"
            >
              <Icon name="list" size={18} />
              Set list
            </button>
            {/* Always rendered, so the footer keeps its height and the Set list
                pill above it never shifts between songs. Ending early happens
                more than you would think — a set gets cut short. */}
            <button type="button" className="gig__finish" onClick={() => setFinished(true)}>
              Finish set
            </button>
            <div className="gig__nav">
              <button
                type="button"
                className="gig__step gig__step--nav"
                onClick={() => go(-1)}
                disabled={index === 0}
              >
                <span className="gig__navlabel">Previous</span>
                <span className="gig__navname">
                  {previous ? previous.name || 'Untitled song' : 'Start of set'}
                </span>
              </button>
              <button
                type="button"
                className="gig__step gig__step--nav"
                onClick={() => go(1)}
                disabled={atEnd}
              >
                <span className="gig__navlabel">Next</span>
                <span className="gig__navname">
                  {next ? next.name || 'Untitled song' : 'End of set'}
                </span>
              </button>
            </div>
          </>
        )}
      </footer>

    </div>
  )
}
