import { useEffect, useRef } from 'react'

/**
 * Bullet-list editor for a song's notes.
 *
 * One auto-growing textarea per bullet, so long notes wrap instead of scrolling
 * sideways. Enter splits the bullet at the cursor, Enter on an empty one removes
 * it, and Backspace at the very start merges a bullet into the one above —
 * the list editing people already know from their notes app.
 */
export function NotesList({ lines, onChange, placeholder }) {
  const refs = useRef([])
  // Where the caret should land after a split, merge or removal re-renders.
  const pendingFocus = useRef(null)

  const rows = lines.length > 0 ? lines : ['']

  const grow = (element) => {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }

  useEffect(() => {
    refs.current.forEach(grow)
  })

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const element = refs.current[target.index]
    if (!element) return
    element.focus()
    const caret = target.caret === 'end' ? element.value.length : target.caret
    element.setSelectionRange(caret, caret)
    grow(element)
  })

  const commit = (next) => onChange(next)

  const setLine = (index, value) => {
    const next = [...rows]
    next[index] = value
    commit(next)
  }

  const onKeyDown = (index) => (event) => {
    const element = event.currentTarget

    if (event.key === 'Enter') {
      event.preventDefault()
      const value = element.value
      if (!value.trim()) {
        // Nothing typed here — don't stack up another empty bullet.
        if (rows.length > 1) {
          commit(rows.filter((_, i) => i !== index))
          pendingFocus.current = { index: Math.max(0, index - 1), caret: 'end' }
        } else {
          element.blur()
        }
        return
      }
      const caret = element.selectionStart ?? value.length
      const next = [...rows]
      next[index] = value.slice(0, caret)
      next.splice(index + 1, 0, value.slice(caret))
      commit(next)
      pendingFocus.current = { index: index + 1, caret: 0 }
      return
    }

    if (
      event.key === 'Backspace' &&
      index > 0 &&
      element.selectionStart === 0 &&
      element.selectionEnd === 0
    ) {
      event.preventDefault()
      const previous = rows[index - 1]
      const next = [...rows]
      next[index - 1] = previous + element.value
      next.splice(index, 1)
      commit(next)
      pendingFocus.current = { index: index - 1, caret: previous.length }
    }
  }

  // Pasting a list should land as a list, not one bullet holding line breaks.
  const onPaste = (index) => (event) => {
    const text = event.clipboardData?.getData('text') ?? ''
    if (!/\r?\n/.test(text)) return
    event.preventDefault()
    const element = event.currentTarget
    const caret = element.selectionStart ?? element.value.length
    const before = element.value.slice(0, caret)
    const after = element.value.slice(caret)
    const parts = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*•·]\s+/, '').trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...rows]
    next.splice(index, 1, ...parts.map((part, i) => (i === 0 ? before + part : part)))
    const lastIndex = index + parts.length - 1
    const caretAt = next[lastIndex].length
    next[lastIndex] += after
    commit(next)
    pendingFocus.current = { index: lastIndex, caret: caretAt }
  }

  return (
    <ul className="notes">
      {rows.map((line, index) => (
        // eslint-disable-next-line react/no-array-index-key -- position is the identity here
        <li className="notes__item" key={index}>
          <span className="notes__dot" aria-hidden="true" />
          <textarea
            ref={(element) => {
              refs.current[index] = element
            }}
            className="notes__input"
            value={line}
            rows={1}
            placeholder={index === 0 && rows.length === 1 ? placeholder : ''}
            onChange={(event) => setLine(index, event.target.value)}
            onKeyDown={onKeyDown(index)}
            onPaste={onPaste(index)}
            aria-label={`Note ${index + 1}`}
          />
        </li>
      ))}
    </ul>
  )
}
