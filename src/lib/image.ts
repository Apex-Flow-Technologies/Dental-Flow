/**
 * Client-side image downscaling.
 *
 * Patient photos are stored as data URLs on the patient document rather than in Cloud Storage,
 * because Storage needs the Blaze plan and this clinic is on Spark. A Firestore document is capped
 * at 1 MiB, so the photo has to be small — 256px at JPEG quality 0.72 lands around 20-35 KB, which
 * is a rounding error against the rest of the record and indistinguishable at the sizes it is
 * displayed. Radiographs cannot be handled this way; those genuinely need Storage.
 */

/** Comfortably under Firestore's 1 MiB document cap, leaving room for the rest of the record. */
export const MAX_PHOTO_BYTES = 120 * 1024

export interface DownscaleOptions {
  /** Longest edge, in px. */
  maxEdge?: number
  quality?: number
}

export class ImageTooLargeError extends Error {
  constructor() {
    super('The photo is still too large after compression. Try a smaller or less detailed image.')
    this.name = 'ImageTooLargeError'
  }
}

/**
 * Reads a picked file, crops it square from the centre and returns a JPEG data URL.
 *
 * Square because every place it is shown is a round or square avatar; cropping here rather than in
 * CSS means the stored bytes are all pixels that get seen.
 */
export async function toSquareDataUrl(
  file: File,
  { maxEdge = 256, quality = 0.72 }: DownscaleOptions = {},
): Promise<string> {
  const bitmap = await loadBitmap(file)

  try {
    const edge = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - edge) / 2
    const sy = (bitmap.height - edge) / 2
    const size = Math.min(maxEdge, edge)

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not read the image — canvas is unavailable.')

    context.drawImage(bitmap, sx, sy, edge, edge, 0, 0, size, size)

    let dataUrl = canvas.toDataURL('image/jpeg', quality)
    // Step the quality down for stubborn images rather than failing outright.
    let attemptQuality = quality
    while (dataUrlBytes(dataUrl) > MAX_PHOTO_BYTES && attemptQuality > 0.35) {
      attemptQuality -= 0.12
      dataUrl = canvas.toDataURL('image/jpeg', attemptQuality)
    }

    if (dataUrlBytes(dataUrl) > MAX_PHOTO_BYTES) throw new ImageTooLargeError()
    return dataUrl
  } finally {
    // ImageBitmap holds decoded pixels; releasing matters on a tablet.
    if ('close' in bitmap) bitmap.close()
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }
  return createImageBitmap(file)
}

/** Rough decoded size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
