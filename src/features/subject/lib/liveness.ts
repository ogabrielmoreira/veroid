/**
 * Motor de rosto e prova de vida no navegador (MediaPipe Face Landmarker).
 * Carregado só na etapa de captura (import dinâmico). Arquivos servidos de /veroid/mediapipe.
 * Honestidade técnica: heurística de demonstração, não substitui liveness certificado (ISO/IEC 30107-3).
 */
import { env } from '@/lib/env'

export type Challenge = 'blink' | 'turn_left' | 'turn_right'

export interface FaceFrame {
  faces: number
  /** caixa normalizada (0–1) no referencial da imagem da câmera, sem espelhamento */
  box: { x: number; y: number; w: number; h: number } | null
  blink: number
  /** yaw aproximado: positivo = titular virou para a própria esquerda */
  yaw: number
}

export interface FaceEngine {
  detect(video: HTMLVideoElement, ts: number): FaceFrame
  close(): void
}

const CDN_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export async function createFaceEngine(): Promise<FaceEngine> {
  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(`${env.basePath}/mediapipe/wasm`)
  const make = (modelAssetPath: string, delegate: 'GPU' | 'CPU') =>
    vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
    })
  let landmarker
  const local = `${env.basePath}/mediapipe/face_landmarker.task`
  try {
    landmarker = await make(local, 'GPU')
  } catch {
    try { landmarker = await make(local, 'CPU') } catch { landmarker = await make(CDN_MODEL, 'CPU') }
  }

  return {
    detect(video, ts) {
      const r = landmarker.detectForVideo(video, ts)
      const faces = r.faceLandmarks?.length ?? 0
      if (!faces) return { faces: 0, box: null, blink: 0, yaw: 0 }
      const lm = r.faceLandmarks[0]
      return { faces, ...frameMetrics(lm, r.faceBlendshapes?.[0]?.categories) }
    },
    close() { landmarker.close() },
  }
}

/** Métricas puras a partir dos landmarks (testáveis sem câmera). */
export function frameMetrics(
  lm: Array<{ x: number; y: number }>,
  blend?: Array<{ categoryName: string; score: number }>,
): Omit<FaceFrame, 'faces'> {
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const p of lm) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  // 1 = ponta do nariz, 234/454 = laterais do rosto
  const nose = lm[1]
  const left = lm[234]
  const right = lm[454]
  const width = Math.abs(right.x - left.x) || box.w || 1
  const yaw = nose && left && right ? (nose.x - (left.x + right.x) / 2) / width : 0
  const bl = blend?.find((c) => c.categoryName === 'eyeBlinkLeft')?.score ?? 0
  const br = blend?.find((c) => c.categoryName === 'eyeBlinkRight')?.score ?? 0
  return { box, blink: Math.min(bl, br), yaw }
}

export type Guidance = 'no_face' | 'multiple' | 'closer' | 'farther' | 'center' | 'light' | 'hold' | 'ok'

/** Traduz um quadro em orientação ao titular (uma instrução por vez). */
export function guidanceFor(f: FaceFrame, brightness: number): Guidance {
  if (f.faces === 0 || !f.box) return 'no_face'
  if (f.faces > 1) return 'multiple'
  if (brightness < 60) return 'light'
  if (f.box.w < 0.26) return 'closer'
  if (f.box.w > 0.72) return 'farther'
  const cx = f.box.x + f.box.w / 2
  const cy = f.box.y + f.box.h / 2
  if (cx < 0.33 || cx > 0.67 || cy < 0.28 || cy > 0.72) return 'center'
  if (Math.abs(f.yaw) > 0.12) return 'hold'
  return 'ok'
}

/** Máquina do desafio: piscar (fechar e abrir) ou virar e voltar ao centro. */
export class ChallengeTracker {
  private closed = false
  private turned = false
  passed = false
  constructor(public challenge: Challenge) {}
  push(f: FaceFrame) {
    if (this.passed || f.faces !== 1) return this.passed
    if (this.challenge === 'blink') {
      if (f.blink > 0.55) this.closed = true
      else if (this.closed && f.blink < 0.25) this.passed = true
    } else {
      const dir = this.challenge === 'turn_left' ? 1 : -1
      if (f.yaw * dir > 0.14) this.turned = true
      else if (this.turned && Math.abs(f.yaw) < 0.06) this.passed = true
    }
    return this.passed
  }
}

export function randomChallenge(): Challenge {
  const all: Challenge[] = ['blink', 'turn_left', 'turn_right']
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return all[buf[0] % all.length]
}

export function frameBrightness(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const w = 48, h = 36
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || !video.videoWidth) return 128
  ctx.drawImage(video, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  let s = 0
  for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  return s / (w * h)
}
