import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { authErrorMessage } from '@/lib/authErrors'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

/**
 * Fase 8 — "Simular onboarding" na página pública: cria um link de 30 min contra a
 * organização de demonstração fixa e mostra a tela do titular numa moldura de celular,
 * sem exigir login nem sair da página (§10).
 */
export function SimulateOnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['public-demo-flow'],
    enabled: open,
    staleTime: 0,
    queryFn: async (): Promise<{ token: string }> => {
      const { data, error } = await supabase.rpc('start_public_demo_flow')
      if (error) throw error
      return data as { token: string }
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={t('demo.simulate.title')} icon="capture" description={t('demo.simulate.description')} size="md">
      <div className="flex flex-col items-center gap-4">
        {q.isLoading ? (
          <div className="flex min-h-[520px] items-center justify-center"><Spinner size={28} /></div>
        ) : q.isError ? (
          <Alert variant="error">{authErrorMessage(q.error, t)}</Alert>
        ) : q.data ? (
          <div
            className="relative mx-auto w-[300px] rounded-[36px] border-[10px] border-[#14162B] bg-[#14162B] shadow-[var(--shadow-modal)]"
            style={{ aspectRatio: '9/19.5' }}
          >
            <span className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/60" aria-hidden="true" />
            <iframe
              title={t('demo.simulate.frameTitle')}
              src={`${env.basePath}/v/${q.data.token}`}
              allow="camera"
              className="size-full rounded-[26px] bg-white"
            />
          </div>
        ) : null}
        <p className="m-0 max-w-[420px] text-center t-caption text-[var(--ink-muted)]">{t('demo.simulate.note')}</p>
      </div>
    </Modal>
  )
}
