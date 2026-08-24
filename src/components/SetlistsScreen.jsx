import { useLibrary } from '../store.jsx'
import { navigate } from '../router.js'
import { breakTotal, buildRunOrder, describeSetLength, relativeDate } from '../model.js'
import { readGigPosition } from '../gigSession.js'
import { EmptyState, Icon, TopBar } from './ui.jsx'

export function SetlistsScreen() {
  const { setlists, songsById, createSetlist, ready } = useLibrary()
  const saved = readGigPosition()
  const resume = saved ? setlists.find((set) => set.id === saved.setlistId) : null
  const resumeAt = resume ? Math.min(saved.index, Math.max(0, resume.songIds.length - 1)) : 0
  const songsOf = (set) => buildRunOrder(set.songIds, songsById).songs.map((item) => item.song)
  const setsIn = (set) => buildRunOrder(set.songIds, songsById).setCount

  const startNew = () => {
    const set = createSetlist('Untitled Set')
    navigate(`/sets/${set.id}`)
  }

  return (
    <>
      <TopBar
        large
        title="Setlists"
        right={
          <button type="button" className="iconbtn" onClick={startNew} aria-label="New setlist">
            <Icon name="plus" />
          </button>
        }
      />

      {resume && resume.songIds.length > 0 && (
        <div className="resume">
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => navigate(`/gig/${resume.id}`)}
            data-testid="resume-gig"
          >
            <Icon name="play" size={18} /> Resume {resume.name} · song {resumeAt + 1} of{' '}
            {resume.songIds.length}
          </button>
        </div>
      )}

      {!ready ? null : setlists.length === 0 ? (
        <EmptyState
          icon="list"
          title="No setlists yet"
          body="Build an ad hoc list for a gig or a practice session, then save it with a name."
          action={
            <button type="button" className="btn btn--primary" onClick={startNew}>
              New blank setlist
            </button>
          }
        />
      ) : (
        <div className="library__list">
          <ul className="rows rows--standalone">
            {setlists.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  className="row"
                  onClick={() => navigate(`/sets/${set.id}`)}
                >
                  <span className="row__main">
                    <span className="row__title">{set.name}</span>
                    <span className="row__sub">
                      <span className="row__tags">
                        {setsIn(set) > 1 ? `${setsIn(set)} sets · ` : ''}
                        {songsOf(set).length} {songsOf(set).length === 1 ? 'song' : 'songs'}
                        {describeSetLength(songsOf(set))
                          ? ` · ${describeSetLength(songsOf(set))}`
                          : ''}
                        {breakTotal(set.songIds) > 0
                          ? ` · ${breakTotal(set.songIds)} min breaks`
                          : ''}{' '}
                        · updated {relativeDate(set.updatedAt)}
                      </span>
                    </span>
                  </span>
                  <Icon name="chevron" size={17} className="row__chevron" />
                </button>
              </li>
            ))}
          </ul>
          <div className="stack">
            <button type="button" className="btn btn--primary btn--block" onClick={startNew}>
              <Icon name="plus" size={18} /> New blank setlist
            </button>
            <button type="button" className="footlink" onClick={() => navigate('/backup')}>
              <Icon name="shield" size={15} /> Backup &amp; restore
            </button>
          </div>
        </div>
      )}
    </>
  )
}
