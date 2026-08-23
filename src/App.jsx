import { useRoute, navigate } from './router.js'
import { SongLibrary } from './components/SongLibrary.jsx'
import { SongProfile } from './components/SongProfile.jsx'
import { SetlistsScreen } from './components/SetlistsScreen.jsx'
import { SetlistEditor } from './components/SetlistEditor.jsx'
import { ImportScreen } from './components/ImportScreen.jsx'
import { GigMode } from './components/GigMode.jsx'
import { BackupScreen } from './components/BackupScreen.jsx'
import { Icon } from './components/ui.jsx'

function TabBar({ active }) {
  const tabs = [
    { key: 'songs', label: 'Songs', icon: 'note', path: '/songs' },
    { key: 'sets', label: 'Setlists', icon: 'list', path: '/sets' },
  ]
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tabbar__tab ${active === tab.key ? 'tabbar__tab--on' : ''}`}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => navigate(tab.path)}
        >
          <Icon name={tab.icon} size={22} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const { path } = useRoute()
  const [pathname, search = ''] = path.split('?')
  const segments = pathname.split('/').filter(Boolean)
  const [section, id] = segments

  let screen
  let activeTab = 'songs'

  if (section === 'gig' && id) {
    return <GigMode key={id} setlistId={id} />
  }

  if (section === 'backup') {
    screen = <BackupScreen />
  } else if (section === 'import') {
    screen = <ImportScreen />
  } else if (section === 'sets') {
    activeTab = 'sets'
    screen = id ? <SetlistEditor key={id} setlistId={id} /> : <SetlistsScreen />
  } else if (id) {
    screen = <SongProfile key={id} songId={id} isNew={search.includes('new=1')} />
  } else {
    screen = <SongLibrary />
  }

  const isDetail = Boolean(id)

  return (
    <div className={`app ${isDetail ? 'app--detail' : ''}`}>
      <main className="screen">{screen}</main>
      <TabBar active={activeTab} />
    </div>
  )
}
