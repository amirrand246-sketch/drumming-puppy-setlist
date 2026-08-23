import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { back, navigate } from '../router.js'
import { countInBody, isCountInLine, toNoteLines, todayISO } from '../model.js'
import { Icon } from './ui.jsx'

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

export function GigMode({ setlistId }) {
  const { setlists, songsById, updateSong, ready } = useLibrary()
  const set = setlists.find((item) => item.id === setlistId)
  const songs = (set?.songIds || []).map((id) => songsById.get(id)).filter(Boolean)

  const [index, setIndex] = useState(0)
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
    for (const song of songs) updateSong(song.id, { lastPlayed: today })
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
        <p className="gig__donesub">{songs.length} songs — nice one.</p>
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

  const song = songs[index]
  const next = songs[index + 1]
  const previous = songs[index - 1]
  const atEnd = index === songs.length - 1
  const noteLines = toNoteLines(song.notes).filter((line, i) =>
    (i === 0 && isCountInLine(line) ? countInBody(line) : line).trim(),
  )

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
          {index + 1} / {songs.length}
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
        <ul className="gig__list">
          {songs.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                ref={i === index ? currentRow : null}
                className={`gig__listrow ${i === index ? 'gig__listrow--now' : ''}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => {
                  setIndex(i)
                  setOverview(false)
                }}
              >
                <span className="gig__listnum">{i + 1}</span>
                <span className="gig__listname">{item.name || 'Untitled song'}</span>
                {i === index && <span className="gig__now">Now</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="gig__stage"
          style={{ transform: `translateX(${swipe / 4}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <h1 className="gig__title" style={{ fontSize: `${28 * scale}px` }}>
            {song.name || 'Untitled song'}
          </h1>
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
        </div>
      )}

      <footer className="gig__foot">
        {overview ? (
          <button
            type="button"
            className="gig__step gig__step--main gig__step--wide"
            onClick={() => setOverview(false)}
          >
            Back to {song.name || 'the current song'}
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
