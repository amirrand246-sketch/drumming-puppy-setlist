import { useEffect, useRef, useState } from 'react'

const PATHS = {
  back: 'M15 4 7 12l8 8',
  chevron: 'M9 4l8 8-8 8',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M4 12.5 9.5 18 20 6.5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  link: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  grip: 'M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01',
  minus: 'M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  note: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  list: 'M4 7h16M4 12h16M4 17h10',
  pencil: 'M4 20h4L20 8l-4-4L4 16v4z',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 3-3L20 17M15.5 9h.01',
  text: 'M5 6h14M5 12h14M5 18h9',
  play: 'M7 4.5v15l13-7.5z',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  shield: 'M12 3l8 3v6c0 4.4-3.2 7.9-8 9-4.8-1.1-8-4.6-8-9V6l8-3z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
}

export function Icon({ name, size = 22, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Screen({ children }) {
  return <div className="screen">{children}</div>
}

export function TopBar({ title, left, right, large }) {
  return (
    <header className={`topbar ${large ? 'topbar--large' : ''}`}>
      <div className="topbar__row">
        <div className="topbar__side topbar__side--left">{left}</div>
        {!large && <h1 className="topbar__title">{title}</h1>}
        <div className="topbar__side topbar__side--right">{right}</div>
      </div>
      {large && <h1 className="topbar__title topbar__title--large">{title}</h1>}
    </header>
  )
}

export function EmptyState({ icon = 'note', title, body, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} className="empty__icon" />
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {action}
    </div>
  )
}

function Modal({ onDismiss, children, labelledBy }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" className="modal__scrim" aria-label="Dismiss" onClick={onDismiss} />
      <div className="modal__card">{children}</div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal onDismiss={onCancel} labelledBy="confirm-title">
      <h2 className="modal__title" id="confirm-title">
        {title}
      </h2>
      {body && <p className="modal__body">{body}</p>}
      <div className="modal__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${destructive ? 'btn--danger' : 'btn--primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function PromptDialog({
  title,
  label = 'Name',
  initialValue = '',
  placeholder = '',
  confirmLabel = 'Save',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 60)
    return () => clearTimeout(timer)
  }, [])

  const submit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <Modal onDismiss={onCancel} labelledBy="prompt-title">
      <form onSubmit={submit}>
        <h2 className="modal__title" id="prompt-title">
          {title}
        </h2>
        <label className="modal__label" htmlFor="prompt-input">
          {label}
        </label>
        <input
          id="prompt-input"
          ref={inputRef}
          className="modal__input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
        />
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function SearchField({ value, onChange, placeholder = 'Search' }) {
  return (
    <div className="search">
      <Icon name="search" size={17} className="search__icon" />
      <input
        className="search__input"
        type="search"
        inputMode="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
      />
      {value && (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  )
}

export function DifficultyPill({ value }) {
  if (!value) return null
  return <span className={`pill pill--${value.toLowerCase()}`}>{value}</span>
}
