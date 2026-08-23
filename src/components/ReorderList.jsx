import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Touch-first reorderable list.
 *
 * Pointer events (rather than HTML5 drag-and-drop, which iOS Safari ignores)
 * drive a drag handle with a large tap target. Rows slide out of the way as
 * the dragged row passes them, and the list auto-scrolls near screen edges.
 * Arrow keys on a focused handle move an item without dragging at all.
 */
export function ReorderList({ items, getKey, renderItem, onReorder, className = '' }) {
  const containerRef = useRef(null)
  const info = useRef(null)
  const [drag, setDrag] = useState(null)

  const update = useCallback((clientY) => {
    const state = info.current
    if (!state) return
    state.clientY = clientY
    const delta = clientY + window.scrollY - state.startDocY
    const rects = state.rects
    const dragged = rects[state.index]
    // The row claims a slot once its leading edge clears that row's midpoint,
    // which stays correct when rows have different heights.
    let target = state.index
    if (delta > 0) {
      const bottom = dragged.top + dragged.height + delta
      for (let i = state.index + 1; i < rects.length; i += 1) {
        if (bottom > rects[i].top + rects[i].height / 2) target = i
      }
    } else if (delta < 0) {
      const top = dragged.top + delta
      for (let i = state.index - 1; i >= 0; i -= 1) {
        if (top < rects[i].top + rects[i].height / 2) target = i
      }
    }
    setDrag({ index: state.index, target, delta, shift: state.shift })
  }, [])

  const stopDrag = useCallback(
    (commit) => {
      const state = info.current
      if (!state) return
      cancelAnimationFrame(state.raf)
      document.body.classList.remove('is-dragging')
      info.current = null
      setDrag((current) => {
        if (commit && current && current.target !== current.index) {
          onReorder(current.index, current.target)
        }
        return null
      })
    },
    [onReorder],
  )

  useEffect(() => () => stopDrag(false), [stopDrag])

  const autoScroll = useCallback(() => {
    const state = info.current
    if (!state) return
    const edge = 96
    const y = state.clientY
    let step = 0
    if (y < edge) step = -Math.ceil((edge - y) / 5)
    else if (y > window.innerHeight - edge) step = Math.ceil((y - (window.innerHeight - edge)) / 5)
    if (step !== 0) {
      const before = window.scrollY
      window.scrollBy(0, step)
      if (window.scrollY !== before) update(y)
    }
    state.raf = requestAnimationFrame(autoScroll)
  }, [update])

  const onPointerDown = (index) => (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const rows = Array.from(containerRef.current.querySelectorAll('[data-reorder-row]'))
    if (rows.length < 2) return
    const scrollY = window.scrollY
    const rects = rows.map((row) => {
      const rect = row.getBoundingClientRect()
      return { top: rect.top + scrollY, height: rect.height }
    })
    const gap =
      rects.length > 1 ? Math.max(0, rects[1].top - rects[0].top - rects[0].height) : 0
    const shift = rects[index].height + gap
    info.current = {
      index,
      rects,
      shift,
      startDocY: event.clientY + scrollY,
      clientY: event.clientY,
      raf: 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add('is-dragging')
    setDrag({ index, target: index, delta: 0, shift })
    info.current.raf = requestAnimationFrame(autoScroll)
    event.preventDefault()
  }

  const onPointerMove = (event) => {
    if (!info.current) return
    update(event.clientY)
    event.preventDefault()
  }

  const onKeyDown = (index) => (event) => {
    const to =
      event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null
    if (to === null || to < 0 || to >= items.length) return
    event.preventDefault()
    onReorder(index, to)
  }

  const styleFor = (i) => {
    if (!drag) return undefined
    if (i === drag.index) {
      return { transform: `translateY(${drag.delta}px)`, transition: 'none' }
    }
    if (drag.index < i && i <= drag.target) return { transform: `translateY(${-drag.shift}px)` }
    if (drag.target <= i && i < drag.index) return { transform: `translateY(${drag.shift}px)` }
    return { transform: 'translateY(0px)' }
  }

  return (
    <div className={`reorder ${className}`} ref={containerRef}>
      {items.map((item, index) => {
        const dragging = drag?.index === index
        const handleProps = {
          className: 'drag-handle',
          onPointerDown: onPointerDown(index),
          onPointerMove,
          onPointerUp: () => stopDrag(true),
          onPointerCancel: () => stopDrag(false),
          onKeyDown: onKeyDown(index),
          role: 'button',
          tabIndex: 0,
          'aria-label': `Reorder, position ${index + 1} of ${items.length}`,
        }
        return (
          <div
            key={getKey(item, index)}
            data-reorder-row=""
            className={`reorder__row ${dragging ? 'reorder__row--dragging' : ''}`}
            style={styleFor(index)}
          >
            {renderItem(item, { index, dragging, handleProps })}
          </div>
        )
      })}
    </div>
  )
}
