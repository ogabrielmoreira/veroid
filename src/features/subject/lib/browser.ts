export type BrowserKind = 'ios_safari' | 'ios_other' | 'android_chrome' | 'android_other' | 'desktop_chrome' | 'desktop_firefox' | 'desktop_safari' | 'other'

export function detectBrowser(ua = navigator.userAgent): BrowserKind {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios_other' : 'ios_safari'
  if (/Android/.test(ua)) return /Chrome\//.test(ua) && !/SamsungBrowser|EdgA|OPR/.test(ua) ? 'android_chrome' : 'android_other'
  if (/Firefox\//.test(ua)) return 'desktop_firefox'
  if (/Chrome\//.test(ua)) return 'desktop_chrome'
  if (/Safari\//.test(ua)) return 'desktop_safari'
  return 'other'
}

export type CameraError = 'denied' | 'not_found' | 'not_readable' | 'insecure' | 'unsupported'

export function classifyCameraError(e: unknown): CameraError {
  const name = (e as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return window.isSecureContext ? 'denied' : 'insecure'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not_found'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'not_readable'
  return 'unsupported'
}

export async function openCamera(facing: 'user' | 'environment'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' })
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing === 'user' ? 'user' : { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  })
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop())
}
