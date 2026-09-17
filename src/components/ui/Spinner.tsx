export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="animate-spin motion-reduce:animate-none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
      <path d="M17 10a7 7 0 00-7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
