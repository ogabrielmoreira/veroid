import { useTranslation } from 'react-i18next'

/**
 * Mini celular animado: mostra o diálogo de permissão do sistema e o toque em "Permitir" ANTES de o navegador pedir.
 * É a mesma tela do case do Vero ID ("explicar antes de pedir"). Só desenho: nenhuma permissão é solicitada.
 * Respeita prefers-reduced-motion (sem animação, o diálogo e o toque ficam visíveis).
 */
export function TapAllowTutorial({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  const w = compact ? 150 : 186, h = compact ? 200 : 248
  return (
    <div role="img" aria-label={t('tapAllow.aria')} className="mx-auto flex flex-col items-center">
      <div style={{ width: w, height: h, border: '3px solid #2A2D33', borderRadius: 28, background: '#F2F3F5', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 48, height: 10, background: '#2A2D33', borderRadius: 99 }} />
        <div style={{ position: 'absolute', top: 34, left: 18, right: 18 }}>
          <i style={{ display: 'block', height: 8, borderRadius: 4, background: '#E0E2E6', marginBottom: 8 }} />
          <i style={{ display: 'block', height: 8, borderRadius: 4, background: '#E0E2E6', width: '70%' }} />
        </div>
        <div className="veroid-tap-dlg" style={{ position: 'absolute', left: 14, right: 14, bottom: compact ? 44 : 58, background: '#fff', borderRadius: 14, boxShadow: '0 8px 24px rgba(16,19,24,.16)', padding: '12px 10px 0' }}>
          <div style={{ height: 6, width: '78%', margin: '0 auto 5px', background: '#D8DADF', borderRadius: 3 }} />
          <div style={{ height: 5, width: '58%', margin: '0 auto 11px', background: '#E7E9ED', borderRadius: 3 }} />
          <div style={{ display: 'flex', borderTop: '1px solid #EDEEF1' }}>
            <span style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: 9.5, fontWeight: 500, color: '#9AA0AB', whiteSpace: 'nowrap' }}>{t('tapAllow.deny')}</span>
            <span style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: 9.5, fontWeight: 700, color: 'var(--ink)', borderLeft: '1px solid #EDEEF1' }}>{t('tapAllow.allow')}</span>
          </div>
        </div>
        <span className="veroid-tap-dot" style={{ position: 'absolute', right: 30, bottom: compact ? 52 : 66, width: 30, height: 30, borderRadius: 99, background: 'rgba(16,19,24,.14)', border: '1.5px solid rgba(16,19,24,.42)', pointerEvents: 'none' }} />
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .veroid-tap-dlg { animation: veroid-dlg 3.6s ease-in-out infinite; }
          .veroid-tap-dot { animation: veroid-tapdot 3.6s ease-in-out infinite; }
        }
        @media (prefers-reduced-motion: reduce) { .veroid-tap-dot { opacity: .9; } }
        @keyframes veroid-dlg { 0% { opacity: 0; transform: translateY(8px) scale(.96) } 12%, 88% { opacity: 1; transform: none } 100% { opacity: 0 } }
        @keyframes veroid-tapdot { 0%, 34% { opacity: 0; transform: scale(.4) } 44% { opacity: 1; transform: scale(.75) } 52% { opacity: 1; transform: scale(1.05) } 58% { opacity: .9; transform: scale(.9) } 70%, 100% { opacity: 0; transform: scale(1.5) } }
      `}</style>
    </div>
  )
}
