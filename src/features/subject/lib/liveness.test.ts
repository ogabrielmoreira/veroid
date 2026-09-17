import { describe, expect, it } from 'vitest'
import { analyzePixels, documentQualityOk } from './image'
import { ChallengeTracker, frameMetrics, guidanceFor, type FaceFrame } from './liveness'
import { classifyCameraError, detectBrowser } from './browser'

const face = (over: Partial<FaceFrame> = {}): FaceFrame => ({ faces: 1, box: { x: 0.35, y: 0.3, w: 0.32, h: 0.42 }, blink: 0, yaw: 0, ...over })

describe('orientação da captura', () => {
  it('uma instrução por vez, na ordem certa', () => {
    expect(guidanceFor(face({ faces: 0, box: null }), 120)).toBe('no_face')
    expect(guidanceFor(face({ faces: 2 }), 120)).toBe('multiple')
    expect(guidanceFor(face(), 30)).toBe('light')
    expect(guidanceFor(face({ box: { x: 0.45, y: 0.4, w: 0.1, h: 0.15 } }), 120)).toBe('closer')
    expect(guidanceFor(face({ box: { x: 0.02, y: 0.3, w: 0.3, h: 0.4 } }), 120)).toBe('center')
    expect(guidanceFor(face({ yaw: 0.2 }), 120)).toBe('hold')
    expect(guidanceFor(face(), 120)).toBe('ok')
  })
})

describe('desafio de prova de vida', () => {
  it('piscar exige fechar e abrir', () => {
    const t = new ChallengeTracker('blink')
    expect(t.push(face({ blink: 0.1 }))).toBe(false)
    expect(t.push(face({ blink: 0.8 }))).toBe(false)
    expect(t.push(face({ blink: 0.1 }))).toBe(true)
  })
  it('virar exige ir e voltar ao centro, na direção pedida', () => {
    const left = new ChallengeTracker('turn_left')
    left.push(face({ yaw: -0.3 }))
    expect(left.push(face({ yaw: 0 }))).toBe(false)
    left.push(face({ yaw: 0.2 }))
    expect(left.push(face({ yaw: 0.02 }))).toBe(true)
  })
  it('ignora quadros com mais de um rosto', () => {
    const t = new ChallengeTracker('blink')
    t.push(face({ faces: 2, blink: 0.9 }))
    expect(t.push(face({ blink: 0 }))).toBe(false)
  })
})

describe('métricas de landmarks', () => {
  it('yaw positivo quando o nariz se desloca para a direita da imagem', () => {
    const lm = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }))
    lm[234] = { x: 0.4, y: 0.5 }; lm[454] = { x: 0.6, y: 0.5 }; lm[1] = { x: 0.55, y: 0.5 }
    const m = frameMetrics(lm, [{ categoryName: 'eyeBlinkLeft', score: 0.9 }, { categoryName: 'eyeBlinkRight', score: 0.7 }])
    expect(m.yaw).toBeCloseTo(0.25, 2)
    expect(m.blink).toBeCloseTo(0.7, 2)
  })
})

describe('qualidade do documento', () => {
  it('imagem uniforme é desfocada; padrão xadrez é nítido', () => {
    const w = 40, h = 40
    const flat = new Uint8ClampedArray(w * h * 4).fill(140)
    expect(documentQualityOk(analyzePixels(flat, w, h))).toBe(false)
    const checker = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (x + y) % 2 ? 230 : 40; const i = (y * w + x) * 4; checker[i] = checker[i + 1] = checker[i + 2] = v; checker[i + 3] = 255 }
    expect(documentQualityOk(analyzePixels(checker, w, h))).toBe(true)
  })
})

describe('navegador e erros de câmera', () => {
  it('detecta iOS Safari e Android Chrome', () => {
    expect(detectBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('ios_safari')
    expect(detectBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36')).toBe('android_chrome')
  })
  it('classifica erros do getUserMedia', () => {
    expect(classifyCameraError({ name: 'NotFoundError' })).toBe('not_found')
    expect(classifyCameraError({ name: 'NotReadableError' })).toBe('not_readable')
  })
})
