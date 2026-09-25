import { cn } from './ui/cn'
import logoNavy from '@/assets/logo.png'
import logoWhite from '@/assets/logo-white.png'

// Logomarca oficial (raster, fundo transparente — ver DECISIONS.md). Duas versões porque a marca
// é de cor única: `logoWhite` cobre os fundos escuros (AuthLayout inverted); `logoNavy` cobre o resto.
const LOGO_ASPECT = 1644 / 680

export function Logo({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src={inverted ? logoWhite : logoNavy}
        alt="Vero ID"
        height={28}
        width={Math.round(28 * LOGO_ASPECT)}
        style={{ height: 28, width: 'auto' }}
      />
    </span>
  )
}
