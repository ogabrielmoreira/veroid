import type { SVGProps } from 'react'
import { MATERIAL_PATHS } from './materialPaths'

/** Ícones Material Symbols (Rounded, peso 400) da Google — grade 960, currentColor. Uma família só (§2.11). */
export type IconName = keyof typeof MATERIAL_PATHS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: 16 | 18 | 20 | 24 | 30
  label?: string
}

export function Icon({ name, size = 18, label, ...rest }: IconProps) {
  // Material desenha com mais respiro interno que o traço antigo: +4px mantém o peso visual.
  const px = size + 4
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 -960 960 960"
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={MATERIAL_PATHS[name]} />
    </svg>
  )
}
