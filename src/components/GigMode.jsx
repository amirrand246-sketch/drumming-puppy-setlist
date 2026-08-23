import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { back, navigate } from '../router.js'
import { todayISO } from '../model.js'
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
  const [jumping, setJumping] = useState(false)
  const [scale, setScale] = useState(readScale)
  const [swipe, setSwipe] = useState(0)
  const touch = useRef(null)

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
      else if (event.key === 'Escape') back(`/sets/${setlistId}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, setlistId])

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
  const atEnd = index === songs.length - 1

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
          onClick={() => setJumping(true)}
          aria-label="Jump to another song"
        >
          {index + 1} / {songs.length}
        </button>
        <div className="gig__zoom">
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
        </div>
      </header>

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
        {song.notes.trim() ? (
          <p className="gig__notes" style={{ fontSize: `${19 * scale}px` }}>
            {song.notes}
          </p>
        ) : (
          <p className="gig__nonotes">No notes for this one.</p>
        )}
      </div>

      <footer className="gig__foot">
        {next && <p className="gig__next">Next: {next.name || 'Untitled song'}</p>}
        <div className="gig__nav">
          <button
            type="button"
            className="gig__step"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Previous song"
          >
            <Icon name="back" size={26} />
          </button>
          <button
            type="button"
            className="gig__step gig__step--main"
            onClick={() => (atEnd ? setFinished(true) : go(1))}
          >
            {atEnd ? 'Finish set' : 'Next song'}
          </button>
        </div>
      </footer>

      {jumping && (
        <div className="gig__jump" role="dialog" aria-modal="true" aria-label="Jump to a song">
          <button
            type="button"
            className="gig__jumpscrim"
            aria-label="Close"
            onClick={() => setJumping(false)}
          />
          <ul className="gig__jumplist">
            {songs.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`gig__jumprow ${i === index ? 'gig__jumprow--on' : ''}`}
                  onClick={() => {
                    setIndex(i)
                    setJumping(false)
                  }}
                >
                  <span className="gig__jumpnum">{i + 1}</span>
                  <span>{item.name || 'Untitled song'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
