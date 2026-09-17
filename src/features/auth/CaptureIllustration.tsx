import { useTranslation } from 'react-i18next'

/**
 * Motivo visual do produto: a moldura oval de captura com pontos de referência faciais
 * (sem rosto real) e dois cartões de resultado. Decorativo — aria-hidden.
 * A linha de varredura só se move sem prefers-reduced-motion; a moldura não pisca (§2.10).
 */
export function CaptureIllustration() {
  const { t } = useTranslation()
  const landmarks: Array<[number, number]> = [
    [150, 120], [170, 112], [190, 110], [210, 112], [230, 120],
    [162, 150], [178, 146], [222, 146], [238, 150],
    [200, 165], [200, 190], [190, 205], [210, 205],
    [172, 232], [186, 238], [200, 240], [214, 238], [228, 232],
    [140, 170], [260, 170], [150, 230], [250, 230], [170, 270], [230, 270], [200, 282],
  ]
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[340px]" aria-hidden="true">
      <svg viewBox="0 0 400 500" className="h-full w-full">
        <defs>
          <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#939EE2" stopOpacity="0" />
            <stop offset="1" stopColor="#939EE2" stopOpacity=".55" />
          </linearGradient>
          <clipPath id="oval">
            <ellipse cx="200" cy="200" rx="118" ry="152" />
          </clipPath>
        </defs>

        {/* cantoneiras */}
        <g stroke="#6C79D4" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".9">
          <path d="M62 60V36h24" /><path d="M338 60V36h-24" />
          <path d="M62 364v24h24" /><path d="M338 364v24h-24" />
        </g>

        {/* moldura oval */}
        <ellipse cx="200" cy="200" rx="118" ry="152" fill="rgba(71,86,201,.08)" stroke="#939EE2" strokeWidth="2.5" />
        <ellipse cx="200" cy="200" rx="132" ry="166" fill="none" stroke="#939EE2" strokeOpacity=".18" strokeDasharray="2 8" strokeWidth="2" />

        {/* malha de pontos */}
        <g clipPath="url(#oval)">
          <g stroke="#939EE2" strokeOpacity=".22" strokeWidth="1">
            <path d="M150 120L170 112L190 110L210 112L230 120M162 150L178 146M222 146L238 150M200 165L200 190L190 205M200 190L210 205M172 232L186 238L200 240L214 238L228 232M140 170L150 230L170 270L200 282L230 270L250 230L260 170" fill="none" />
          </g>
          {landmarks.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.6" fill="#DDE1F6" opacity={0.55 + (i % 3) * 0.15} />
          ))}
          <rect className="veroid-scan" x="60" y="40" width="280" height="56" fill="url(#scan)" />
        </g>
      </svg>

      {/* cartão: prova de vida */}
      <div className="absolute -left-2 top-[58%] flex items-center gap-2 rounded-md border border-white/10 bg-[#0C1024]/85 px-3 py-2 shadow-[0_14px_36px_rgba(0,0,0,.35)] backdrop-blur">
        <span className="grid size-6 place-items-center rounded-full bg-[rgba(15,122,74,.25)] text-[#7FDCAE]">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
        </span>
        <span className="t-caption text-[#EDEFF7]">{t('auth.illustration.liveness')}</span>
      </div>

      {/* cartão: score */}
      <div className="absolute -right-3 bottom-[4%] w-[188px] rounded-md border border-white/10 bg-[#0C1024]/85 p-3 shadow-[0_14px_36px_rgba(0,0,0,.35)] backdrop-blur">
        <div className="flex items-baseline justify-between">
          <span className="t-overline text-[#B6BBD0]">{t('auth.illustration.score')}</span>
          <span className="tabular font-semibold text-[15px] text-[#7FDCAE]">12 / 100</span>
        </div>
        <div className="relative mt-2 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#0F7A4A 0 30%,#B06A00 30% 70%,#B3261E 70% 100%)' }}>
          <span className="absolute -top-1 h-4 w-[3px] rounded-[2px] bg-white" style={{ left: '12%' }} />
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .veroid-scan { animation: veroid-scan 3.2s cubic-bezier(.4,0,.2,1) infinite; }
          @keyframes veroid-scan { 0% { transform: translateY(0); } 50% { transform: translateY(290px); } 100% { transform: translateY(0); } }
        }
      `}</style>
    </div>
  )
}
