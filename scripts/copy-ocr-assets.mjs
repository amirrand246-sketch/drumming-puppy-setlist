/**
 * Copy the OCR engine out of node_modules into public/ocr so the app can serve
 * the worker, wasm core and English model from its own origin. Keeping them out
 * of git avoids committing ~11 MB twice (source and build output).
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'public', 'ocr')

const assets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]

mkdirSync(target, { recursive: true })

for (const [from, to] of assets) {
  const source = join(root, 'node_modules', from)
  const destination = join(target, to)
  if (!existsSync(source)) {
    console.error(`Missing OCR asset: ${from} — run npm install first.`)
    process.exit(1)
  }
  if (existsSync(destination) && statSync(destination).size === statSync(source).size) continue
  copyFileSync(source, destination)
  console.log(`ocr: ${to}`)
}
