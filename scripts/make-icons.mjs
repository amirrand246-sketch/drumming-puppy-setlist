/**
 * Regenerate the app icons from icons-src/logo.png.
 *
 * Run by hand after changing the logo — not part of the build, since it needs a
 * local Chromium to rasterise:  node scripts/make-icons.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'icons-src', 'logo.png')
const outDir = join(root, 'public', 'icons')

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const chromium = CHROMIUM_CANDIDATES.find((path) => existsSync(path))
if (!chromium) {
  console.error('No Chromium found. Set CHROMIUM_PATH to a Chrome or Chromium binary.')
  process.exit(1)
}
if (!existsSync(source)) {
  console.error(`Missing ${source}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'setlist-icons-'))

/**
 * `inset` is the share of the tile left empty around the artwork. Android masks
 * icons to arbitrary shapes and only the middle ~80% is guaranteed visible, so
 * the maskable icon is drawn smaller on a filled tile.
 */
function render(size, out, { inset = 0, background = 'transparent' } = {}) {
  const page = join(work, `shot-${size}-${inset}.html`)
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;width:100vw;height:100vh;background:${background};
        display:flex;align-items:center;justify-content:center;overflow:hidden}
      img{width:${100 - inset * 2}vw;height:${100 - inset * 2}vw;display:block;
        image-rendering:auto}
    </style><img src="file://${source}">`,
  )
  execFileSync(
    chromium,
    [
      '--headless',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${size},${size}`,
      `--screenshot=${out}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' },
  )
  console.log(`icon: ${out.replace(root + '/', '')}`)
}

/** Minimal ICO container holding PNG entries, which every current browser reads. */
function writeIco(sources, out) {
  const entries = []
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sources.length, 4)
  let offset = 6 + sources.length * 16
  for (const { size, data } of sources) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(entry)
  }
  writeFileSync(out, Buffer.concat([header, ...entries, ...sources.map((s) => s.data)]))
  console.log(`icon: ${out.replace(root + '/', '')}`)
}

try {
  render(512, join(outDir, 'icon-512.png'))
  render(192, join(outDir, 'icon-192.png'))
  render(180, join(outDir, 'apple-touch-icon-180.png'))
  render(64, join(outDir, 'icon-64.png'))
  // #101010 is the logo's own field colour, so the padding is seamless.
  render(512, join(outDir, 'icon-maskable-512.png'), { inset: 17, background: '#101010' })

  const small = [16, 32].map((size) => {
    const path = join(work, `favicon-${size}.png`)
    render(size, path)
    return { size, data: readFileSync(path) }
  })
  writeIco(small, join(outDir, 'favicon.ico'))
} finally {
  rmSync(work, { recursive: true, force: true })
}
