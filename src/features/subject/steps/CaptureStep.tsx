import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { toJpeg } from '../lib/image'
import {
  ChallengeTracker, createFaceEngine, frameBrightness, guidanceFor, randomChallenge,
  type Challenge, type FaceEngine, type Guidance,
} from '../lib/liveness'
import { FlowAlert, FlowButton } from '../FlowUi'

type Phase = 'loading' | 'align' | 'challenge' | 'preview' | 'simple' | 'uploading'

const ALIGN_HOLD_MS = 900
const CHALLENGE_MS = 9000
const MAX_CHALLENGES = 3
const ENGINE_TIMEOUT_MS = 15000

interface Props {
  stream: MediaStream
  onEvent: (type: string, payload?: Record<string, unknown>) => void
  onConfirm: (blob: Blob, signals: string[]) => Promise<void>
  uploadError: string | null
}

/** Captura facial com prova de vida (§6.5): moldura oval, feedback em tempo real, desafio aleatório e captura automática. */
export function CaptureStep({ stream, onEvent, onConfirm, uploadError }: Props) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const engineRef = useRef<FaceEngine | null>(null)
  const rafRef = useRef<number>(0)
  const phaseRef = useRef<Phase>('loading')
  const [phase, setPhaseState] = useState<Phase>('loading')
  const [guidance, setGuidance] = useState<Guidance>('no_face')
  const [announced, setAnnounced] = useState('')
  const [challenge, setChallenge] = useState<Challenge>(randomChallenge)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<{ blob: Blob; url: string; signals: string[] } | null>(null)

  const trackerRef = useRef(new ChallengeTracker(challenge))
  const alignSince = useRef<number | null>(null)
  const challengeStart = useRef(0)
  const failures = useRef(0)
  const multiFrames = useRef(0)
  const lastBrightness = useRef(128)
  const lastAnnounce = useRef(0)

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p) }

  // vídeo
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = stream
    void v.play().catch(() => undefined)
  }, [stream])

  const capture = useCallback(async (signals: string[]) => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    cancelAnimationFrame(rafRef.current)
    const blob = await toJpeg(v, 0.8)
    const extra = [...signals]
    if (lastBrightness.current < 80) extra.push('low_light')
    if (multiFrames.current > 8) extra.push('faces_multiple')
    setPreview({ blob, url: URL.createObjectURL(blob), signals: [...new Set(extra)] })
    setPhase('preview')
    onEvent('capture_succeeded', { signals: extra })
  }, [onEvent])

  const loop = useCallback(() => {
    const v = videoRef.current
    const engine = engineRef.current
    if (!v || !engine || v.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return }
    const now = performance.now()
    let frame
    try { frame = engine.detect(v, now) } catch { rafRef.current = requestAnimationFrame(loop); return }
    const brightness = frameBrightness(v, canvasRef.current)
    lastBrightness.current = brightness
    if (frame.faces > 1) multiFrames.current++
    const g = guidanceFor(frame, brightness)

    if (g !== guidance) setGuidance(g)
    if (now - lastAnnounce.current > 1400) { lastAnnounce.current = now; setAnnounced(g) }

    if (phaseRef.current === 'align') {
      if (g === 'ok') {
        alignSince.current ??= now
        setProgress(Math.min(1, (now - alignSince.current) / ALIGN_HOLD_MS))
        if (now - alignSince.current > ALIGN_HOLD_MS) {
          onEvent('capture_attempt', { challenge: trackerRef.current.challenge })
          challengeStart.current = now
          setProgress(0)
          setPhase('challenge')
        }
      } else {
        alignSince.current = null
        setProgress(0)
      }
    } else if (phaseRef.current === 'challenge') {
      const elapsed = now - challengeStart.current
      setProgress(Math.min(1, elapsed / CHALLENGE_MS))
      const passed = trackerRef.current.push(frame)
      if (passed && g === 'ok' && frame.blink < 0.3) {
        onEvent('liveness_challenge_passed', { challenge: trackerRef.current.challenge, ms: Math.round(elapsed) })
        void capture([])
        return
      }
      if (elapsed > CHALLENGE_MS) {
        failures.current++
        onEvent('liveness_challenge_failed', { challenge: trackerRef.current.challenge, attempt: failures.current })
        if (failures.current >= MAX_CHALLENGES) {
          void capture(['liveness_failed'])
          return
        }
        const next = randomChallenge()
        trackerRef.current = new ChallengeTracker(next)
        setChallenge(next)
        alignSince.current = null
        setPhase('align')
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [capture, guidance, onEvent])

  // motor (import dinâmico, com fallback para captura simples)
  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      if (!engineRef.current && !cancelled) { setPhase('simple'); onEvent('liveness_unavailable', { reason: 'timeout' }) }
    }, ENGINE_TIMEOUT_MS)
    createFaceEngine()
      .then((engine) => {
        if (cancelled) { engine.close(); return }
        if (phaseRef.current === 'simple') { engine.close(); return }
        engineRef.current = engine
        setPhase('align')
        rafRef.current = requestAnimationFrame(loop)
      })
      .catch((e) => {
        if (cancelled) return
        setPhase('simple')
        onEvent('liveness_unavailable', { reason: String((e as Error)?.message ?? e).slice(0, 80) })
      })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
      engineRef.current?.close()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
    multiFrames.current = 0
    alignSince.current = null
    if (engineRef.current) {
      const next = randomChallenge()
      trackerRef.current = new ChallengeTracker(next)
      setChallenge(next)
      setPhase('align')
      rafRef.current = requestAnimationFrame(loop)
    } else {
      setPhase('simple')
    }
  }

  const confirm = async () => {
    if (!preview) return
    setPhase('uploading')
    try {
      await onConfirm(preview.blob, preview.signals)
    } catch {
      setPhase('preview')
    }
  }

  const ok = guidance === 'ok'
  const ringColor = phase === 'challenge' ? 'var(--brand-500)' : ok ? '#0F7A4A' : '#FFFFFF'
  const instruction =
    phase === 'loading' ? t('subject.capture.loading')
      : phase === 'simple' ? t('subject.capture.simple')
      : phase === 'challenge' ? t(`subject.capture.challenge.${challenge}`)
      : t(`subject.capture.guidance.${guidance}`)

  return (
    <section className="flex flex-1 flex-col bg-[#10142B] text-white" aria-labelledby="h-capture">
      <div className="px-5 pb-3 pt-5">
        <h1 id="h-capture" tabIndex={-1} className="text-[20px] font-bold leading-7" style={{ fontFamily: 'var(--font-display)' }}>
          {phase === 'preview' || phase === 'uploading' ? t('subject.capture.previewTitle') : t('subject.capture.title')}
        </h1>
      </div>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-[520px] overflow-hidden bg-black">
        {phase === 'preview' || phase === 'uploading' ? (
          <img src={preview?.url} alt={t('subject.capture.previewAlt')} className="h-full w-full -scale-x-100 object-cover" />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label={t('subject.capture.videoLabel')} />
        )}

        {/* moldura oval: não pisca; só a cor da borda muda (160ms) */}
        {phase !== 'preview' && phase !== 'uploading' ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <mask id="oval-mask">
                <rect width="300" height="400" fill="white" />
                <ellipse cx="150" cy="190" rx="98" ry="130" fill="black" />
              </mask>
            </defs>
            <rect width="300" height="400" fill="rgba(16,20,43,.55)" mask="url(#oval-mask)" />
            <ellipse cx="150" cy="190" rx="98" ry="130" fill="none" stroke={ringColor} strokeWidth="4" style={{ transition: 'stroke var(--dur-fast) linear' }} />
            {progress > 0 ? (
              <ellipse cx="150" cy="190" rx="98" ry="130" fill="none" stroke="#7FDCAE" strokeWidth="4" pathLength={100}
                strokeDasharray={`${progress * 100} 100`} transform="rotate(-90 150 190)" />
            ) : null}
          </svg>
        ) : null}

        {phase === 'loading' ? (
          <div className="absolute inset-0 grid place-items-center"><Spinner size={30} label={t('subject.capture.loading')} /></div>
        ) : null}
        {phase === 'challenge' ? (
          <div className="absolute inset-x-0 top-4 flex justify-center" aria-hidden="true">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-[#10142B] shadow-[var(--shadow-overlay)]">
              <Icon name={challenge === 'blink' ? 'liveness' : challenge === 'turn_left' ? 'arrowLeft' : 'arrowRight'} size={18} />
              {t(`subject.capture.challengeShort.${challenge}`)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col bg-white px-5 pb-6 pt-4 text-[#10142B]">
        {phase !== 'preview' && phase !== 'uploading' ? (
          <>
            <p className="m-0 flex min-h-12 items-center gap-2 text-[17px] font-medium leading-6">
              <Icon name={ok || phase === 'challenge' ? 'approved' : 'info'} size={20} className={ok ? 'text-[#0F7A4A]' : 'text-[var(--brand-700)]'} />
              {instruction}
            </p>
            <p className="sr-only" aria-live="polite">{phase === 'challenge' ? t(`subject.capture.challenge.${challenge}`) : t(`subject.capture.guidance.${announced || guidance}`)}</p>
            {phase === 'simple' ? (
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <FlowAlert tone="info">{t('subject.capture.simpleNote')}</FlowAlert>
                <FlowButton icon="capture" onClick={() => void capture(['liveness_unavailable'])}>{t('subject.capture.shutter')}</FlowButton>
              </div>
            ) : (
              <p className="m-0 mt-2 text-[13px] text-[#4E5573]">{t('subject.capture.autoHint')}</p>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <p className="m-0 text-[15px] leading-6 text-[#3C4262]">{t('subject.capture.previewBody')}</p>
            {uploadError ? <FlowAlert tone="error">{uploadError}</FlowAlert> : null}
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <FlowButton onClick={confirm} loading={phase === 'uploading'} iconRight="arrowRight">{t('subject.capture.usePhoto')}</FlowButton>
              <FlowButton variant="secondary" onClick={retake} disabled={phase === 'uploading'} icon="refresh">{t('subject.capture.retake')}</FlowButton>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
