import { useEffect, useState } from 'react'

function currentPath() {
  const hash = window.location.hash.replace(/^#/, '')
  return hash || '/songs'
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`
  if (replace) {
    window.history.replaceState(null, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = path
  }
}

export function back(fallback = '/songs') {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback, { replace: true })
}

export function useRoute() {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const segments = path.split('/').filter(Boolean)
  return { path, segments }
}
