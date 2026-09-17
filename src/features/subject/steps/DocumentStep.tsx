import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { classifyCameraError, openCamera, stopStream } from '../lib/browser'
import { documentQualityOk, fileToBitmap, measureQuality, toJpeg } from '../lib/image'
import { FlowAlert, FlowButton, FlowScreen } from '../FlowUi'

type Side = 'doc_front' | 'doc_back'

/** Documento frente e verso (§6.6): câmera traseira com moldura, ou arquivo; checagem de luz e nitidez. */
export function DocumentStep({ onUpload, onEvent }: {
  onUpload: (side: Side, blob: Blob, qualityOk: boolean) => Promise<void>
  onEvent: (type: string, payload?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const [side, setSide] = useState<Side>('doc_front')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [shot, setShot] = useState<{ blob: Blob; url: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => undefined) }
  }, [stream, shot])
  useEffect(() => () => stopStream(stream), [stream])

  const startCamera = async () => {
    setCameraError(null)
    try { setStream(await openCamera('environment')) } catch (e) { setCameraError(t(`subject.document.cameraError.${classifyCameraError(e)}`)) }
  }

  const takeFromVideo = async () => {
    const v = videoRef.current
    if (!v?.videoWidth) return
    const q = measureQuality(v, v.videoWidth, v.videoHeight)
    const blob = await toJpeg(v, 0.82)
    setShot({ blob, url: URL.createObjectURL(blob), ok: documentQualityOk(q) })
  }

  const takeFromFile = async (file: File) => {
    try {
      const bmp = await fileToBitmap(file)
      const q = measureQuality(bmp, bmp.width, bmp.height)
      const blob = await toJpeg(bmp as unknown as HTMLImageElement, 0.82)
      bmp.close()
      setShot({ blob, url: URL.createObjectURL(blob), ok: documentQualityOk(q) })
    } catch {
      setError(t('subject.document.fileError'))
    }
  }

  const confirm = async () => {
    if (!shot) return
    setBusy(true)
    setError(null)
    try {
      await onUpload(side, shot.blob, shot.ok)
      onEvent('document_captured', { side, quality_ok: shot.ok })
      URL.revokeObjectURL(shot.url)
      setShot(null)
      if (side === 'doc_front') setSide('doc_back')
      else stopStream(stream)
    } catch {
      setError(t('subject.errors.upload'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FlowScreen
      stepKey={side}
      title={t(`subject.document.${side}.title`)}
      subtitle={t(`subject.document.${side}.subtitle`)}
      actions={
        shot ? (
          <>
            {!shot.ok ? <FlowAlert tone="warning">{t('subject.document.lowQuality')}</FlowAlert> : null}
            {error ? <FlowAlert tone="error">{error}</FlowAlert> : null}
            <FlowButton onClick={confirm} loading={busy} iconRight="arrowRight">{t('subject.document.use')}</FlowButton>
            <FlowButton variant="secondary" icon="refresh" disabled={busy} onClick={() => { URL.revokeObjectURL(shot.url); setShot(null) }}>{t('subject.capture.retake')}</FlowButton>
          </>
        ) : (
          <>
            {cameraError ? <FlowAlert tone="warning">{cameraError}</FlowAlert> : null}
            {stream ? <FlowButton icon="capture" onClick={takeFromVideo}>{t('subject.document.shutter')}</FlowButton>
              : <FlowButton icon="capture" onClick={startCamera}>{t('subject.document.openCamera')}</FlowButton>}
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#B6BBD0] px-4 text-[15px] font-medium text-[#10142B] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus-ring)]">
              <Icon name="upload" size={18} />
              {t('subject.document.fromFile')}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void takeFromFile(f); e.target.value = '' }} />
            </label>
          </>
        )
      }
    >
      <p className="m-0 text-[13px] font-semibold uppercase tracking-[.1em] text-[#4E5573]">{t('subject.document.progress', { current: side === 'doc_front' ? 1 : 2 })}</p>
      <div className="relative aspect-[1.58] w-full overflow-hidden rounded-[var(--radius-lg)] bg-[#10142B]">
        {shot ? <img src={shot.url} alt={t(`subject.document.${side}.alt`)} className="h-full w-full object-contain" />
          : stream ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" aria-label={t('subject.document.videoLabel')} />
          : (
            <div className="grid h-full place-items-center p-6 text-center text-[#B6BBD0]">
              <div><Icon name="evidence" size={30} className="mx-auto" /><p className="m-0 mt-2 text-[14px]">{t('subject.document.placeholder')}</p></div>
            </div>
          )}
        {!shot ? <div className="pointer-events-none absolute inset-[8%] rounded-[10px] border-[3px] border-dashed border-white/80" aria-hidden="true" /> : null}
      </div>
      <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[14px] leading-[1.55] text-[#3C4262]">
        <li>{t('subject.document.tip1')}</li>
        <li>{t('subject.document.tip2')}</li>
      </ul>
    </FlowScreen>
  )
}
