# Drumming Puppy's Setlist

A mobile-first PWA: a personal song library and setlist builder for a drummer,
laid out like a contacts app. Everything lives on the device — no account, no
server, no sync.

This repo is the whole site: it builds to `dist/`, which Netlify publishes at the
root, so the installed app lives at `https://<site>/`.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173/
npm run build    # writes dist/
npm run preview  # serves the built app
```

## Installing on a phone

Open `https://<site>/` and use **Add to Home Screen** (iOS Safari) or
**Install app** (Android Chrome). It launches standalone, with no browser chrome,
and works offline after the first load.

## What's in it

- **Song Library** — alphabetical sections with an A–Z index rail, search across
  names and tags. "The Chicken" files under C.
- **Song Profile** — name, artist, notes, any number of tutorial links, tags,
  difficulty, last played. Edits save as you type.
- **Setlists** — build an ad hoc list, drag songs into running order with a
  handle (or arrow keys), then save it with a name. Rename, duplicate, delete.
- **Live gig mode** — open a setlist and hit *Start gig mode*: full-screen, dark,
  one song at a time in set order with its notes in large type. Swipe or tap to
  move through the set, tap the counter to jump, A−/A+ resizes the notes, and the
  screen is kept awake. Tutorial links are deliberately not shown here — playing
  notes only. Finishing offers to stamp every song as played today.
- **Tempo and metronome** — type a BPM on any song, or let a song with an Apple
  Music link look one up through GetSongBPM, cross-checked against the linked
  track's album and duration so a live take or remix cannot supply the wrong
  number. A typed tempo always wins and is never overwritten. A Web Audio
  metronome plays it on the profile and in gig mode, offline.

- **Backup & restore** — export the library to a JSON file you keep somewhere
  else, and restore it on a new phone or after a wipe. Restoring merges (adds
  what's missing), updates (writes changed fields onto songs already here,
  matched on name and artist — the way to fill in tempos in bulk), or replaces
  everything. Imported files are rebuilt field by field, so a truncated or
  hand-edited file can't corrupt the library.

## Storage

IndexedDB (`drumming-puppy-setlist`, version 3), with a localStorage fallback for
browsers that block it, e.g. iOS private windows. Stores: `songs`, `setlists`.
Version 3 drops the old `images` store that held song screenshots.

Data survives app close, reopen and phone restarts. Nothing is synced, so the
export file under **Backup & restore** is the only copy that outlives the
device — deleting the site's data or the app deletes everything else.

## Filling in tempos in bulk

Export from **Backup & restore**, set `bpm` on the songs in that JSON however
you like — by hand, a spreadsheet, an assistant — then bring the file back and
choose **Update songs I already have**. Songs match on id, falling back to name
plus artist, and only fields with a value in the file are written, so blanks
never wipe what is already there.

## Tempo lookups

`VITE_GETSONGBPM_KEY` holds a free key from https://getsongbpm.com/api. Copy
`.env.example` to `.env` locally, and set the same variable in Netlify under
Site configuration → Environment variables. Without a key the app runs normally
and the tempo row reads "No tempo service configured".

Being a browser app, the key ships inside the bundle — it is a public,
rate-limited key, not a secret. Move the call behind a Netlify function if that
ever matters.

The metronome itself is Web Audio, so once a tempo is stored it works with no
network at all.

## Layout

```
src/
  storage.js      IndexedDB with localStorage fallback
  store.jsx       React context: songs, setlists, images, CRUD
  model.js        record shapes, sorting, formatting
  appleMusic.js   iTunes search and lookup, match confidence
  tempo.js        GetSongBPM lookup plus the version cross-check
  metronome.js    Web Audio click scheduling
  router.js       hash routing
  components/     screens and shared UI
```
