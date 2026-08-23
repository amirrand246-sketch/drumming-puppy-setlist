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

`npm run dev` and `npm run build` first copy the OCR engine out of `node_modules`
into `public/ocr/` (see below); that folder is generated, not committed.

## Installing on a phone

Open `https://<site>/` and use **Add to Home Screen** (iOS Safari) or
**Install app** (Android Chrome). It launches standalone, with no browser chrome,
and works offline after the first load.

## What's in it

- **Song Library** — alphabetical sections with an A–Z index rail, search across
  names and tags. "The Chicken" files under C.
- **Song Profile** — name, notes, any number of tutorial links, tags, difficulty,
  last played, attached screenshots. Edits save as you type.
- **Setlists** — build an ad hoc list, drag songs into running order with a
  handle (or arrow keys), then save it with a name. Rename, duplicate, delete.
- **Live gig mode** — open a setlist and hit *Start gig mode*: full-screen, dark,
  one song at a time in set order with its notes in large type. Swipe or tap to
  move through the set, tap the counter to jump, A−/A+ resizes the notes, and the
  screen is kept awake. Tutorial links are deliberately not shown here — playing
  notes only. Finishing offers to stamp every song as played today.
- **Import from notes** — point it at a screenshot of an existing notes page and
  it reads the text on the device, splits it into songs, and shows a review list
  before anything is saved. Pasting text works the same way.

- **Backup & restore** — export the whole library (songs, setlists, screenshots)
  to a JSON file you keep somewhere else, and restore it on a new phone or after
  a wipe. Restoring either merges (adds what's missing, leaves what's there) or
  replaces everything. Imported files are rebuilt field by field, so a truncated
  or hand-edited file can't corrupt the library.

## Storage

IndexedDB (`drumming-puppy-setlist`), with a localStorage fallback for browsers
that block it, e.g. iOS private windows. Stores: `songs`, `setlists`, `images`.
Screenshots are downscaled to 1280px JPEG before being stored.

Data survives app close, reopen and phone restarts. Nothing is synced, so the
export file under **Backup & restore** is the only copy that outlives the
device — deleting the site's data or the app deletes everything else.

## OCR

`tesseract.js` runs in a web worker. The worker, the wasm core and the English
model are served from this app's own `/ocr/` rather than a CDN, so after
the first scan caches them (~7 MB, via the service worker and Tesseract's own
IndexedDB cache) the importer works with no network at all.

`npm run ocr:assets` copies those files from `node_modules`; the build runs it
automatically. Bumping `tesseract.js` or `tesseract.js-core` means re-running it
so the self-hosted core matches the library version.

## Icons

Every icon is generated from `icons-src/logo.png` by `node scripts/make-icons.mjs`
— PNGs at 64/180/192/512, a maskable 512 padded onto the logo's own `#101010`
field, and a favicon. It needs a local Chromium and is run by hand after the
logo changes, not during the build; the generated files are committed.

## Deploying

Netlify reads `netlify.toml`, so connecting this repo needs no settings typed in:
build command `npm run build`, publish directory `dist`, Node 22. Every push to
`main` redeploys, and installed apps pick the new version up on next launch.

## Layout

```
src/
  storage.js      IndexedDB with localStorage fallback
  store.jsx       React context: songs, setlists, images, CRUD
  model.js        record shapes, sorting, formatting
  ocr.js          Tesseract worker setup, image downscaling
  parseNotes.js   OCR/pasted text -> song candidates
  router.js       hash routing
  components/     screens and shared UI
```
