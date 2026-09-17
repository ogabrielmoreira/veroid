/** Captura, compressão e checagem de qualidade de imagem no navegador (§3.10). */

export const MAX_SIDE = 1280

/** Desenha a origem num canvas redimensionado e exporta JPEG ~0,8. Re-encode no canvas remove EXIF/localização. */
export async function toJpeg(source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength }, quality = 0.8): Promise<Blob> {
  const w = source.videoWidth || source.naturalWidth || (source.width as number)
  const h = source.videoHeight || source.naturalHeight || (source.height as number)
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', quality))
}

export async function fileToBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

/** Média de luminância (0–255) e variância do Laplaciano (nitidez) numa amostra de 320px. */
export function measureQuality(source: CanvasImageSource, w: number, h: number) {
  const scale = 320 / Math.max(w, h)
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, cw, ch)
  const { data } = ctx.getImageData(0, 0, cw, ch)
  return analyzePixels(data, cw, ch)
}

export function analyzePixels(data: Uint8ClampedArray, w: number, h: number) {
  const gray = new Float32Array(w * h)
  let sum = 0
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    gray[p] = g
    sum += g
  }
  const brightness = sum / gray.length
  let lapSum = 0
  let lapSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
      lapSum += lap
      lapSq += lap * lap
      n++
    }
  }
  const mean = n ? lapSum / n : 0
  const sharpness = n ? lapSq / n - mean * mean : 0
  return { brightness, sharpness }
}

export function documentQualityOk(q: { brightness: number; sharpness: number }) {
  return q.brightness >= 55 && q.brightness <= 235 && q.sharpness >= 40
}
