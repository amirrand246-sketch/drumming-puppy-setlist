/**
 * Local-first persistence.
 *
 * Primary store is IndexedDB (survives app close, reopen and phone restarts).
 * If IndexedDB is unavailable — iOS private browsing, locked-down webviews —
 * we transparently fall back to localStorage. The data volume for a personal
 * song library is small enough that either works.
 */

const DB_NAME = 'drumming-puppy-setlist'
const DB_VERSION = 2
const STORES = ['songs', 'setlists', 'images']
const LS_PREFIX = 'dps:'

let dbPromise = null
let useFallback = false

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    let request
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
  return dbPromise
}

function tx(storeName, mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const store = transaction.objectStore(storeName)
        let result
        try {
          result = run(store)
        } catch (err) {
          reject(err)
          return
        }
        transaction.oncomplete = () => resolve(result && result.result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }),
  )
}

/* ---------- localStorage fallback ---------- */

function lsRead(storeName) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + storeName)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function lsWrite(storeName, rows) {
  try {
    localStorage.setItem(LS_PREFIX + storeName, JSON.stringify(rows))
  } catch (err) {
    console.warn('Could not persist to localStorage', err)
  }
}

/* ---------- public API ---------- */

export async function getAll(storeName) {
  if (!useFallback) {
    try {
      return (await tx(storeName, 'readonly', (store) => store.getAll())) || []
    } catch (err) {
      console.warn('IndexedDB read failed, falling back to localStorage', err)
      useFallback = true
    }
  }
  return lsRead(storeName)
}

export async function put(storeName, record) {
  if (!useFallback) {
    try {
      await tx(storeName, 'readwrite', (store) => store.put(record))
      return record
    } catch (err) {
      console.warn('IndexedDB write failed, falling back to localStorage', err)
      useFallback = true
    }
  }
  const rows = lsRead(storeName)
  const index = rows.findIndex((row) => row.id === record.id)
  if (index === -1) rows.push(record)
  else rows[index] = record
  lsWrite(storeName, rows)
  return record
}

export async function remove(storeName, id) {
  if (!useFallback) {
    try {
      await tx(storeName, 'readwrite', (store) => store.delete(id))
      return
    } catch (err) {
      console.warn('IndexedDB delete failed, falling back to localStorage', err)
      useFallback = true
    }
  }
  lsWrite(
    storeName,
    lsRead(storeName).filter((row) => row.id !== id),
  )
}

export async function clear(storeName) {
  if (!useFallback) {
    try {
      await tx(storeName, 'readwrite', (store) => store.clear())
      return
    } catch (err) {
      console.warn('IndexedDB clear failed, falling back to localStorage', err)
      useFallback = true
    }
  }
  lsWrite(storeName, [])
}

export function isUsingFallback() {
  return useFallback
}
