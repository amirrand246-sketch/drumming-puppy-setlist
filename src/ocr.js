/**
 * On-device OCR.
 *
 * The Tesseract worker, wasm core and English model are all served from this
 * app's own /ocr/ folder — nothing is uploaded anywhere, and once the browser
 * has cached them the whole thing works offline.
 */

const BASE = import.meta.env.BASE_URL

// The canonical wasm-feature-detect probe for SIMD support.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
  253, 15, 253, 98, 11,
])

function supportsSimd() {
  try {
    return WebAssembly.validate(SIMD_PROBE)
  } catch {
    return false
  }
}

let workerPromise = null
let progressHandler = null

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      const core = supportsSimd()
        ? 'tesseract-core-simd-lstm.wasm.js'
        : 'tesseract-core-lstm.wasm.js'
      return createWorker('eng', 1, {
        workerPath: `${BASE}ocr/worker.min.js`,
        corePath: `${BASE}ocr/${core}`,
        langPath: `${BASE}ocr`,
        logger: (message) => {
          if (progressHandler) progressHandler(message)
        },
      })
    })().catch((err) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/** Read text out of an image. `onProgress` gets {status, progress 0–1}. */
export async function recognize(source, onProgress) {
  const worker = await getWorker()
  progressHandler = onProgress || null
  try {
    const { data } = await worker.recognize(source)
    return data.text || ''
  } finally {
    progressHandler = null
  }
}

/** Warm the engine up so the first real scan isn't the one that waits. */
export function prewarm() {
  getWorker().catch(() => {})
}

export async function release() {
  const pending = workerPromise
  workerPromise = null
  progressHandler = null
  if (!pending) return
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    /* nothing useful to do if the worker already went away */
  }
}

/**
 * Decode a picked file, rotate-safe via createImageBitmap, and hand back both a
 * high-resolution canvas for OCR and a smaller JPEG data URL to keep on the song.
 */
export async function prepareImage(file, { ocrMax = 2000, keepMax = 1280 } = {}) {
  const bitmap = await createImageBitmap(file)
  const draw = (max) => {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  }
  const ocrCanvas = draw(ocrMax)
  const keepCanvas = draw(keepMax)
  const dataUrl = keepCanvas.toDataURL('image/jpeg', 0.72)
  bitmap.close?.()
  return { ocrCanvas, dataUrl }
}
