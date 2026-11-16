import { useEffect, useRef } from 'react'

/**
 * Animação Lottie (JSON) servida do próprio domínio. Usa o player "light" (só SVG), carregado sob demanda.
 * Com prefers-reduced-motion mostra um quadro estático. Animações: Google Noto Emoji (CC BY 4.0).
 */
export function LottieIcon({ name, size = 72, className }: { name: string; size?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let anim: { destroy: () => void } | null = null
    let cancelled = false
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    void import('lottie-web/build/player/lottie_light').then((m) => {
      if (cancelled || !ref.current) return
      const lottie = m.default
      const a = lottie.loadAnimation({
        container: ref.current, renderer: 'svg', loop: !still, autoplay: !still,
        path: `${import.meta.env.BASE_URL}lottie/${name}.json`,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      })
      if (still) a.addEventListener('DOMLoaded', () => a.goToAndStop(Math.floor(a.totalFrames / 2), true))
      anim = a
    }).catch(() => undefined)
    return () => { cancelled = true; anim?.destroy() }
  }, [name])
  return <div ref={ref} aria-hidden="true" className={className} style={{ width: size, height: size }} />
}
