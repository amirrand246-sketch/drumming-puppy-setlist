import { useLibrary } from '../store.jsx'
import { navigate } from '../router.js'
import { relativeDate } from '../model.js'
import { EmptyState, Icon, TopBar } from './ui.jsx'

export function SetlistsScreen() {
  const { setlists, createSetlist, ready } = useLibrary()

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
                        {set.songIds.length} {set.songIds.length === 1 ? 'song' : 'songs'} ·
                        updated {relativeDate(set.updatedAt)}
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
