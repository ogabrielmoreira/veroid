import { resolveBrand, type BrandKit } from '@/lib/brand'

/** Logo da organização, ou monograma na cor primária quando não há arquivo. */
export function BrandMark({ name, kit, size = 40 }: { name: string; kit: BrandKit | null | undefined; size?: number }) {
  const b = resolveBrand(kit)
  if (b.logo_light_url) {
    return <img src={b.logo_light_url} alt={name} style={{ height: size, width: 'auto', maxWidth: size * 4 }} className="object-contain" />
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center font-semibold text-white"
      style={{ width: size, height: size, background: b.primary, borderRadius: 'var(--radius-md)', fontSize: size * 0.38, fontFamily: 'var(--font-display)' }}
    >
      {initials || '•'}
    </span>
  )
}
