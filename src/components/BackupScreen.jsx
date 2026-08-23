import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../store.jsx'
import { navigate } from '../router.js'
import { backupFilename, formatBytes, normaliseBackup } from '../backup.js'
import { ConfirmDialog, Icon, TopBar } from './ui.jsx'

const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`

export function BackupScreen() {
  const { songs, setlists, exportAll, importAll } = useLibrary()
  const [includeImages, setIncludeImages] = useState(true)
  const [bundle, setBundle] = useState(null)
  const [incoming, setIncoming] = useState(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const fileRef = useRef(null)

  // Built up front so the export button can share the file inside the tap
  // itself — iOS refuses navigator.share if anything is awaited first.
  useEffect(() => {
    let cancelled = false
    setBundle(null)
    exportAll({ includeImages })
      .then((data) => {
        if (cancelled) return
        const json = JSON.stringify(data)
        const blob = new Blob([json], { type: 'application/json' })
        setBundle({ blob, size: blob.size, images: data.images.length })
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setError('Could not read the library to back it up.')
      })
    return () => {
      cancelled = true
    }
  }, [exportAll, includeImages])

  const exportNow = async () => {
    if (!bundle) return
    setSaved('')
    setError('')
    const filename = backupFilename()
    const file = new File([bundle.blob], filename, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Drumming Puppy's Setlist backup" })
        setSaved('Backup shared — save it somewhere off this phone.')
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      console.warn('Share failed, falling back to a download', err)
    }
    const url = URL.createObjectURL(bundle.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    setSaved(`Saved ${filename}.`)
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setResult(null)
    try {
      const backup = normaliseBackup(JSON.parse(await file.text()))
      if (backup.songs.length === 0 && backup.setlists.length === 0) {
        throw new Error('That backup is empty.')
      }
      setIncoming({ ...backup, filename: file.name })
    } catch (err) {
      console.error(err)
      setIncoming(null)
      setError(
        err instanceof SyntaxError ? "That file isn't valid JSON." : err.message || 'Could not read that file.',
      )
    }
  }

  const runImport = async (mode) => {
    if (!incoming) return
    try {
      const outcome = await importAll(incoming, mode)
      setResult({ ...outcome, mode })
      setIncoming(null)
      setConfirmReplace(false)
    } catch (err) {
      console.error(err)
      setError('Something went wrong restoring that backup.')
    }
  }

  return (
    <>
      <TopBar
        title="Backup & restore"
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
      />

      <div className="profile">
        <div className="card">
          <div className="field">
            <span className="field__label">This phone holds</span>
            <p className="backup__stats">
              {plural(songs.length, 'song')} · {plural(setlists.length, 'setlist')}
              {bundle ? ` · ${plural(bundle.images, 'screenshot')}` : ''}
            </p>
            <p className="field__hint">
              Nothing here is synced or backed up on its own. Export a file now and again
              and keep it somewhere else — Files, email, wherever.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">Export</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(event) => setIncludeImages(event.target.checked)}
              />
              <span>Include screenshots</span>
            </label>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={exportNow}
              disabled={!bundle}
            >
              <Icon name="download" size={18} />{' '}
              {bundle ? `Export backup (${formatBytes(bundle.size)})` : 'Preparing…'}
            </button>
            {saved && <p className="field__hint">{saved}</p>}
          </div>
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">Restore</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={onFile}
            />
            <button
              type="button"
              className="btn btn--block"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={18} /> Choose a backup file
            </button>

            {incoming && (
              <div className="backup__incoming">
                <p className="backup__stats">
                  {incoming.filename}: {plural(incoming.songs.length, 'song')},{' '}
                  {plural(incoming.setlists.length, 'setlist')},{' '}
                  {plural(incoming.images.length, 'screenshot')}
                  {incoming.exportedAt ? ` · exported ${incoming.exportedAt.slice(0, 10)}` : ''}
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={() => runImport('merge')}
                >
                  Merge into my library
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--block"
                  onClick={() => setConfirmReplace(true)}
                >
                  Replace everything
                </button>
                <p className="field__hint">
                  Merging adds anything missing and leaves songs you already have alone.
                </p>
              </div>
            )}

            {result && (
              <p className="backup__result">
                {result.mode === 'replace'
                  ? `Library replaced: ${plural(result.songs, 'song')}, ${plural(
                      result.setlists,
                      'setlist',
                    )}.`
                  : `Added ${plural(result.songs, 'song')} and ${plural(
                      result.setlists,
                      'setlist',
                    )}${result.skipped > 0 ? `, skipped ${result.skipped} already here` : ''}.`}
              </p>
            )}

            {error && <p className="backup__error">{error}</p>}
          </div>
        </div>
      </div>

      {confirmReplace && (
        <ConfirmDialog
          title="Replace everything?"
          body={`Your ${songs.length} songs and ${setlists.length} setlists on this phone are deleted and swapped for the backup. This can't be undone.`}
          confirmLabel="Replace"
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => runImport('replace')}
        />
      )}
    </>
  )
}
