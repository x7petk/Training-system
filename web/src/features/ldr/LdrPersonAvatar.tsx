import { memo, type CSSProperties } from 'react'

/** Solid fills (variants 1–8); same order as `LDR_AVATAR_VARIANTS` in types. */
const AVATAR_SOLID_BG: string[] = [
  '#7c3aed', // violet
  '#0d9488', // teal
  '#2563eb', // blue
  '#db2777', // pink
  '#ea580c', // orange
  '#65a30d', // lime
  '#4f46e5', // indigo
  '#475569', // slate
]

function solidForVariant(variant: number): string {
  return AVATAR_SOLID_BG[(Math.max(1, variant) - 1) % AVATAR_SOLID_BG.length]
}

function LdrPersonAvatarInner(props: {
  initials: string
  variant: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const { initials, variant, size = 'md', className = '' } = props
  const circleStyle: CSSProperties = { backgroundColor: solidForVariant(variant) }
  const sizeClass =
    size === 'xs'
      ? 'size-6 text-[9px]'
      : size === 'sm'
        ? 'size-8 text-[10px]'
        : size === 'lg'
          ? 'size-16 text-lg'
          : 'size-11 text-sm'
  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/35 shadow-sm ${sizeClass} ${className}`}
      style={circleStyle}
      aria-hidden
    >
      <span
        className="relative z-10 font-display font-bold tracking-wide text-white"
        style={{ textShadow: '0 1px 2px rgba(15,23,42,0.85)' }}
      >
        {initials || 'LD'}
      </span>
    </div>
  )
}

export const LdrPersonAvatar = memo(LdrPersonAvatarInner)
