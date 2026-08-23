import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { navigate } from '../router.js'
import { DIFFICULTIES, uid } from '../model.js'
import { mergeCandidates, parseNotesText } from '../parseNotes.js'
import { prepareImage, recognize, release } from '../ocr.js'
import { EmptyState, Icon, TopBar } from './ui.jsx'

const STATUS_LABELS = {
  'loading tesseract core': 'Starting the reader',
  'initializing tesseract': 'Starting the reader',
  'loading language traineddata': 'Loading the English model',
  'initializing api': 'Warming up',
  'recognizing text': 'Reading your screenshot',
}

function CandidateCard({ candidate, onChange, onRemove }) {
  const setTags = (value) =>
    onChange({
      tags: value
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    })

  return (
    <div className={`card candidate ${candidate.include ? '' : 'candidate--off'}`}>
      <div className="candidate__head">
        <button
          type="button"
          className={`checkbox ${candidate.include ? 'checkbox--on' : ''}`}
          aria-label={candidate.include ? 'Skip this song' : 'Include this song'}
          aria-pressed={candidate.include}
          onClick={() => onChange({ include: !candidate.include })}
        >
          {candidate.include && <Icon name="check" size={14} />}
        </button>
        <input
          className="field__input field__input--title"
          value={candidate.name}
          placeholder="Song name"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <button
          type="button"
          className="iconbtn iconbtn--danger"
          aria-label="Discard this song"
          onClick={onRemove}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="segmented segmented--compact" role="group" aria-label="Difficulty">
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            className={`segmented__item ${
              candidate.difficulty === level ? 'segmented__item--on' : ''
            }`}
            aria-pressed={candidate.difficulty === level}
            onClick={() =>
              onChange({ difficulty: candidate.difficulty === level ? '' : level })
            }
          >
            {level}
          </button>
        ))}
      </div>

      <input
        className="field__input"
        value={candidate.tags.join(', ')}
        placeholder="Tags, comma separated"
        onChange={(event) => setTags(event.target.value)}
        autoCapitalize="none"
      />

      <textarea
        className="field__textarea"
        value={candidate.notes}
        placeholder="Notes"
        rows={candidate.notes ? 3 : 2}
        onChange={(event) => onChange({ notes: event.target.value })}
      />

      {candidate.tutorialLinks.length > 0 && (
        <ul className="candidate__links">
          {candidate.tutorialLinks.map((link) => (
            <li key={link.id}>
              <Icon name="link" size={15} />
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
              <button
                type="button"
                className="chip__remove"
                aria-label={`Remove link ${link.label}`}
                onClick={() =>
                  onChange({
                    tutorialLinks: candidate.tutorialLinks.filter((item) => item.id !== link.id),
                  })
                }
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ImportScreen() {
  const { createSongs, saveImage } = useLibrary()
  const [stage, setStage] = useState('choose')
  const [progress, setProgress] = useState({ label: '', value: 0, file: '' })
  const [candidates, setCandidates] = useState([])
  const [shots, setShots] = useState([])
  const [attach, setAttach] = useState(true)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => () => release(), [])

  const runOcr = async (files) => {
    setStage('working')
    setError('')
    const scans = []
    const found = []
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]
        setProgress({ label: 'Preparing the image', value: 0, file: file.name })
        const { ocrCanvas, dataUrl } = await prepareImage(file)
        const text = await recognize(ocrCanvas, (message) => {
          setProgress({
            label: STATUS_LABELS[message.status] || 'Reading your screenshot',
            value: message.progress || 0,
            file: files.length > 1 ? `${i + 1} of ${files.length}` : '',
          })
        })
        scans.push({ id: uid('shot'), dataUrl, text })
        found.push(...parseNotesText(text))
      }
      setShots(scans)
      setCandidates(found)
      setStage(found.length > 0 ? 'review' : 'nothing')
    } catch (err) {
      console.error(err)
      setError(
        err?.message?.includes('fetch') || err?.name === 'TypeError'
          ? "Couldn't load the text reader. Connect to the internet once so it can cache, then try again."
          : "Something went wrong reading that image. You can paste the text instead.",
      )
      setStage('error')
    }
  }

  const onFiles = (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('image/'))
    event.target.value = ''
    if (files.length > 0) runOcr(files)
  }

  const usePastedText = () => {
    const found = parseNotesText(pasted)
    setShots([])
    setCandidates(found)
    setStage(found.length > 0 ? 'review' : 'nothing')
  }

  const patchCandidate = (id, changes) =>
    setCandidates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )

  const addToLibrary = () => {
    const chosen = candidates.filter((item) => item.include && item.name.trim())
    if (chosen.length === 0) return
    const imageIds = attach ? shots.map((shot) => saveImage(shot.dataUrl)) : []
    const created = createSongs(
      chosen.map((item) => ({
        name: item.name.trim(),
        notes: item.notes.trim(),
        tags: item.tags,
        difficulty: item.difficulty,
        lastPlayed: item.lastPlayed,
        tutorialLinks: item.tutorialLinks,
        imageIds,
      })),
    )
    navigate(created.length === 1 ? `/songs/${created[0].id}` : '/songs', { replace: true })
  }

  const includedCount = candidates.filter((item) => item.include && item.name.trim()).length

  return (
    <>
      <TopBar
        title="Import from notes"
        left={
          <button
            type="button"
            className="iconbtn iconbtn--text"
            onClick={() => navigate('/songs', { replace: true })}
          >
            <Icon name="back" />
            <span>Songs</span>
          </button>
        }
        right={
          stage === 'review' ? (
            <button
              type="button"
              className="iconbtn iconbtn--text iconbtn--accent"
              onClick={addToLibrary}
              disabled={includedCount === 0}
            >
              Add{includedCount > 0 ? ` (${includedCount})` : ''}
            </button>
          ) : null
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFiles}
      />

      <div className="profile">
        {stage === 'choose' && (
          <>
            <div className="card importintro">
              <Icon name="scan" size={34} className="importintro__icon" />
              <h2 className="importintro__title">Let the app do the typing</h2>
              <p className="importintro__body">
                Pick a screenshot of your notes page. The text is read here on your phone —
                nothing is uploaded — and every song it finds lands in a review list before
                anything is saved.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="image" size={18} /> Choose screenshots
            </button>
            <div className="card">
              <label className="field">
                <span className="field__label">Or paste the text</span>
                <textarea
                  className="field__textarea"
                  value={pasted}
                  placeholder="Paste straight from your notes app…"
                  rows={5}
                  onChange={(event) => setPasted(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn--block"
                disabled={!pasted.trim()}
                onClick={usePastedText}
              >
                <Icon name="text" size={18} /> Read pasted text
              </button>
            </div>
          </>
        )}

        {stage === 'working' && (
          <div className="card working">
            <p className="working__label">{progress.label}</p>
            {progress.file && <p className="working__file">{progress.file}</p>}
            <div className="bar">
              <div className="bar__fill" style={{ width: `${Math.round(progress.value * 100)}%` }} />
            </div>
            <p className="working__hint">
              First scan also downloads the English model once, then it works offline.
            </p>
          </div>
        )}

        {stage === 'nothing' && (
          <EmptyState
            icon="scan"
            title="No songs found in that"
            body="Try a tighter crop, or paste the text straight from your notes app."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setStage('choose')}>
                Try again
              </button>
            }
          />
        )}

        {stage === 'error' && (
          <EmptyState
            icon="scan"
            title="Couldn't read that"
            body={error}
            action={
              <button type="button" className="btn btn--primary" onClick={() => setStage('choose')}>
                Back
              </button>
            }
          />
        )}

        {stage === 'review' && (
          <>
            <p className="reviewnote">
              Found {candidates.length} {candidates.length === 1 ? 'song' : 'songs'}. Fix
              anything that came out wrong, untick what you don't want, then add them.
            </p>

            {shots.length > 0 && (
              <>
                <div className="shots">
                  {shots.map((shot) => (
                    <img key={shot.id} src={shot.dataUrl} alt="Imported screenshot" />
                  ))}
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={attach}
                    onChange={(event) => setAttach(event.target.checked)}
                  />
                  <span>Keep the screenshot on these songs</span>
                </label>
              </>
            )}

            {candidates.length > 1 && (
              <button
                type="button"
                className="btn btn--block"
                onClick={() => setCandidates(mergeCandidates(candidates))}
              >
                This is all one song — merge it
              </button>
            )}

            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onChange={(changes) => patchCandidate(candidate.id, changes)}
                onRemove={() =>
                  setCandidates((prev) => prev.filter((item) => item.id !== candidate.id))
                }
              />
            ))}

            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={addToLibrary}
              disabled={includedCount === 0}
            >
              Add {includedCount} {includedCount === 1 ? 'song' : 'songs'} to library
            </button>
            <button type="button" className="btn btn--block" onClick={() => setStage('choose')}>
              Start over
            </button>
          </>
        )}
      </div>
    </>
  )
}
