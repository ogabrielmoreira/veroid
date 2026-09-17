import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FlowStep, NicheField } from '@/config/niches/types'
import { Spinner } from '@/components/ui/Spinner'
import { classifyCameraError, openCamera, stopStream, type CameraError } from './lib/browser'
import { clearStoredSession, deviceInfo, loadFormDraft, loadStoredSession, saveFormDraft, SubjectApi, subjectErrorKey } from './lib/api'
import { FlowAlert, FlowButton, FlowScreen } from './FlowUi'
import { CameraErrorStep } from './steps/CameraErrorStep'
import { CaptureStep } from './steps/CaptureStep'
import { ConsentStep } from './steps/ConsentStep'
import { DocumentStep } from './steps/DocumentStep'
import { FormStep } from './steps/FormStep'
import { ReviewStep } from './steps/ReviewStep'
import { TutorialStep } from './steps/TutorialStep'

type Screen = 'starting' | 'consent' | 'tutorial' | 'camera_error' | 'capture' | 'document' | 'form' | 'review' | 'done' | 'assisted' | 'fatal'

interface Props {
  token: string
  orgName: string
  purpose: string
  retentionDays: number
  flow: { steps: FlowStep[]; fields: Array<NicheField & { enabled?: boolean }>; consent_version: string }
}

export function SubjectFlow({ token, orgName, purpose, retentionDays, flow }: Props) {
  const { t } = useTranslation()
  const apiRef = useRef<SubjectApi | null>(null)
  const [screen, setScreen] = useState<Screen>('starting')
  const [fatal, setFatal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<CameraError>('denied')
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>(() => loadFormDraft(token))
  const signals = useRef(new Set<string>())

  const hasDocument = flow.steps.includes('document')
  const hasForm = flow.steps.includes('form')
  const fields = useMemo(() => (hasForm ? flow.fields.filter((f) => f.enabled !== false) : []), [flow.fields, hasForm])

  const order: Screen[] = useMemo(() => ['consent', 'tutorial', 'capture', ...(hasDocument ? ['document' as const] : []), ...(hasForm ? ['form' as const] : []), 'review'], [hasDocument, hasForm])
  const visibleIndex = order.indexOf(screen === 'camera_error' ? 'capture' : screen)

  const event = useCallback((type: string, payload: Record<string, unknown> = {}) => apiRef.current?.event(type, payload), [])

  const go = useCallback((s: Screen) => {
    setError(null)
    setScreen(s)
    if (['consent', 'tutorial', 'capture', 'document', 'form', 'review'].includes(s)) event('step_viewed', { step: s })
    window.scrollTo({ top: 0 })
  }, [event])

  // início ou retomada
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const stored = loadStoredSession(token)
        if (stored) {
          const api = new SubjectApi(token, stored.session_id, stored.secret)
          try {
            const r = await api.resume()
            if (!alive) return
            apiRef.current = api
            if (['submitted', 'analyzed', 'decided'].includes(r.status)) { clearStoredSession(token); setScreen('done'); return }
            const media = new Set(r.media)
            if (!r.consented) return go('consent')
            if (!media.has('selfie')) return go('tutorial')
            if (hasDocument && !(media.has('doc_front') && media.has('doc_back'))) return go('document')
            if (hasForm) return go('form')
            return go('review')
          } catch {
            clearStoredSession(token)
          }
        }
        const api = await SubjectApi.start(token, await deviceInfo())
        if (!alive) return
        apiRef.current = api
        go('consent')
      } catch (e) {
        if (!alive) return
        setFatal(t(subjectErrorKey(e)))
        setScreen('fatal')
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => () => stopStream(stream), [stream])
  useEffect(() => () => { if (selfieUrl) URL.revokeObjectURL(selfieUrl) }, [selfieUrl])

  const onFormChange = useCallback((d: Record<string, string>) => { setFormData(d); saveFormDraft(token, d) }, [token])

  const acceptConsent = async (marketing: boolean) => {
    setBusy(true)
    try {
      await apiRef.current!.consent(true, marketing, flow.consent_version || 'v1')
      go('tutorial')
    } catch (e) {
      setError(t(subjectErrorKey(e)))
    } finally { setBusy(false) }
  }

  const requestCamera = async () => {
    setBusy(true)
    event('camera_permission_requested')
    try {
      const s = await openCamera('user')
      event('camera_permission_granted')
      setStream(s)
      go('capture')
    } catch (e) {
      const kind = classifyCameraError(e)
      setCameraError(kind)
      event(kind === 'denied' || kind === 'insecure' ? 'camera_permission_denied' : kind === 'not_found' ? 'camera_not_found' : 'camera_not_readable', { name: (e as Error)?.name })
      setScreen('camera_error')
    } finally { setBusy(false) }
  }

  const confirmSelfie = async (blob: Blob, sigs: string[]) => {
    setError(null)
    try {
      await apiRef.current!.upload('selfie', blob)
      ;['faces_multiple', 'low_light', 'liveness_failed', 'liveness_unavailable'].forEach((s) => signals.current.delete(s))
      sigs.forEach((s) => signals.current.add(s))
      if (selfieUrl) URL.revokeObjectURL(selfieUrl)
      setSelfieUrl(URL.createObjectURL(blob))
      stopStream(stream)
      setStream(null)
      go(hasDocument ? 'document' : hasForm ? 'form' : 'review')
    } catch (e) {
      setError(t(subjectErrorKey(e) === 'errors.generic' ? 'subject.errors.upload' : subjectErrorKey(e)))
      throw e
    }
  }

  const uploadDoc = async (side: 'doc_front' | 'doc_back', blob: Blob, ok: boolean) => {
    await apiRef.current!.upload(side, blob)
    if (!ok) signals.current.add('document_low_quality')
    if (side === 'doc_back') go(hasForm ? 'form' : 'review')
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiRef.current!.submit(formData, [...signals.current])
      clearStoredSession(token)
      setScreen('done')
    } catch (e) {
      setError(t(subjectErrorKey(e)))
    } finally { setBusy(false) }
  }

  const progress = visibleIndex >= 0 ? (
    <div className="px-5 pt-4" aria-hidden={screen === 'capture' ? true : undefined}>
      <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[.1em] text-[#4E5573]">
        <span>{t('subject.progress', { current: visibleIndex + 1, total: order.length })}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#EBEDF4]">
        <div className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]" style={{ width: `${((visibleIndex + 1) / order.length) * 100}%`, background: 'var(--brand-primary)' }} />
      </div>
    </div>
  ) : null

  let body
  switch (screen) {
    case 'starting':
      body = <div className="grid flex-1 place-items-center text-[#4E5573]"><Spinner size={30} label={t('common.loading')} /></div>
      break
    case 'fatal':
      body = <FlowScreen stepKey="fatal" icon="review" iconTone="warning" title={t('subject.errors.fatalTitle')} subtitle={fatal} />
      break
    case 'consent':
      body = <ConsentStep orgName={orgName} purpose={purpose} retentionDays={retentionDays} busy={busy} error={error} onAccept={acceptConsent} />
      break
    case 'tutorial':
      body = <TutorialStep busy={busy} onAllow={requestCamera} />
      break
    case 'camera_error':
      body = <CameraErrorStep error={cameraError} busy={busy} onRetry={requestCamera} onHelp={() => { event('assisted_help_requested', { reason: cameraError }); setScreen('assisted') }} />
      break
    case 'capture':
      body = stream ? <CaptureStep stream={stream} onEvent={event} onConfirm={confirmSelfie} uploadError={error} /> : null
      break
    case 'document':
      body = <DocumentStep onUpload={uploadDoc} onEvent={event} />
      break
    case 'form':
      body = <FormStep fields={fields} initial={formData} onChange={onFormChange} onSubmit={(d) => { setFormData(d); event('form_completed'); go('review') }} />
      break
    case 'review':
      body = <ReviewStep fields={fields} values={formData} selfieUrl={selfieUrl} hasDocument={hasDocument} busy={busy} error={error} onSubmit={submit}
        onEdit={(s) => (s === 'capture' ? go('tutorial') : go(s))} />
      break
    case 'assisted':
      body = (
        <FlowScreen stepKey="assisted" icon="users" title={t('subject.assisted.title')} subtitle={t('subject.assisted.body', { org: orgName })}
          actions={<FlowButton variant="secondary" icon="arrowLeft" onClick={() => go('tutorial')}>{t('subject.assisted.back')}</FlowButton>} />
      )
      break
    case 'done':
      body = (
        <FlowScreen stepKey="done" icon="approved" iconTone="success" title={t('subject.done.title')} subtitle={t('subject.done.body', { org: orgName })}>
          <ol className="m-0 flex flex-col gap-2 pl-5 text-[15px] leading-6 text-[#3C4262]">
            <li>{t('subject.done.next1', { org: orgName })}</li>
            <li>{t('subject.done.next2')}</li>
          </ol>
          <FlowAlert tone="info">{t('subject.done.privacy')}</FlowAlert>
        </FlowScreen>
      )
      break
  }

  return (
    <div className="flex flex-1 flex-col">
      {screen !== 'capture' ? progress : null}
      {body}
    </div>
  )
}
