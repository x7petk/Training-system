import type { CSSProperties } from 'react'

const AVATAR_STYLES: Array<{ bg: string; glow: string; accent: string }> = [
  { bg: 'linear-gradient(135deg, #7c3aed 0%, #c084fc 100%)', glow: '#f5d0fe', accent: '#fdf4ff' },
  { bg: 'linear-gradient(135deg, #0d9488 0%, #5eead4 100%)', glow: '#ccfbf1', accent: '#f0fdfa' },
  { bg: 'linear-gradient(135deg, #2563eb 0%, #93c5fd 100%)', glow: '#dbeafe', accent: '#eff6ff' },
  { bg: 'linear-gradient(135deg, #db2777 0%, #f9a8d4 100%)', glow: '#fce7f3', accent: '#fff1f2' },
  { bg: 'linear-gradient(135deg, #ea580c 0%, #fdba74 100%)', glow: '#ffedd5', accent: '#fff7ed' },
  { bg: 'linear-gradient(135deg, #65a30d 0%, #bef264 100%)', glow: '#ecfccb', accent: '#f7fee7' },
  { bg: 'linear-gradient(135deg, #4f46e5 0%, #a5b4fc 100%)', glow: '#e0e7ff', accent: '#eef2ff' },
  { bg: 'linear-gradient(135deg, #64748b 0%, #cbd5e1 100%)', glow: '#e2e8f0', accent: '#f8fafc' },
]

function styleForVariant(variant: number) {
  return AVATAR_STYLES[(Math.max(1, variant) - 1) % AVATAR_STYLES.length]
}

export function LdrPersonAvatar(props: {
  initials: string
  variant: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const { initials, variant, size = 'md', className = '' } = props
  const style = styleForVariant(variant)
  const sizeClass = size === 'sm' ? 'size-8 text-[10px]' : size === 'lg' ? 'size-16 text-lg' : 'size-11 text-sm'
  const circleStyle: CSSProperties = { background: style.bg }

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/50 shadow-sm ${sizeClass} ${className}`}
      style={circleStyle}
      aria-hidden
    >
      <span
        className="absolute inset-x-[18%] top-[12%] h-[32%] rounded-full opacity-80"
        style={{ background: style.glow }}
      />
      <span
        className="absolute bottom-[-14%] h-[58%] w-[86%] rounded-[999px] opacity-95"
        style={{ background: style.accent }}
      />
      <span className="relative z-10 font-display font-semibold tracking-wide text-white drop-shadow-sm">
        {initials || 'LD'}
      </span>
    </div>
  )
}
