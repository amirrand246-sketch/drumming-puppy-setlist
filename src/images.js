/**
 * Decode a picked image, rotate-safe via createImageBitmap, and hand back a
 * downscaled JPEG data URL small enough to keep alongside a song.
 */
export async function prepareImage(file, { keepMax = 1280 } = {}) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, keepMax / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
  bitmap.close?.()
  return { dataUrl }
}
