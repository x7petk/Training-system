export type MatrixDensity = 'tight' | 'compact' | 'comfortable'

export type MatrixLayout = {
  labelW: number
  colW: number
  cellMinH: number
  headerH: number
  density: MatrixDensity
  blockScale: number
  gridW: number
}

const MIN_COL_W = 56

/** Role columns always span the remaining viewport width; blockScale shrinks/grows blocks only. */
export function computeMatrixLayout(
  containerWidth: number,
  roleCount: number,
  blockScale: number,
): MatrixLayout {
  const safeWidth = Math.max(containerWidth, 320)
  const labelW = Math.max(84, Math.min(120, Math.round(safeWidth * 0.1)))
  const roles = Math.max(roleCount, 1)
  const colW = Math.max(MIN_COL_W, Math.floor((safeWidth - labelW) / roles))
  const scale = Math.max(0.25, Math.min(2, blockScale))
  const cellMinH = Math.max(44, Math.round(48 * scale))
  const headerH = Math.max(34, Math.min(48, Math.round(40 * scale)))
  const density: MatrixDensity =
    scale < 0.55 || colW < 80 ? 'tight' : scale < 0.85 || colW < 105 ? 'compact' : 'comfortable'
  const gridW = safeWidth
  return { labelW, colW, cellMinH, headerH, density, blockScale: scale, gridW }
}

export const MATRIX_ZOOM_MIN = 0.25
export const MATRIX_ZOOM_MAX = 2
export const MATRIX_ZOOM_STEP = 0.1

export function clampMatrixZoom(z: number): number {
  return Math.round(Math.max(MATRIX_ZOOM_MIN, Math.min(MATRIX_ZOOM_MAX, z)) * 100) / 100
}

export function matrixBlockMaxWidth(colW: number, blockScale: number, kind: 'standard' | 'terminal' | 'decision'): number {
  const pad = 8
  const cellInner = Math.max(36, colW - pad)
  if (kind === 'decision') return Math.min(cellInner, Math.round(64 * blockScale))
  if (kind === 'terminal') return Math.min(cellInner, Math.round(92 * blockScale))
  return Math.min(cellInner, Math.round(108 * blockScale))
}

export function matrixBlockTypography(blockScale: number) {
  const s = Math.max(0.25, Math.min(2, blockScale))
  return {
    label: Math.max(5, Math.round(7 * s)),
    meta: Math.max(5, Math.round(5.5 * s)),
    tag: Math.max(5, Math.round(5 * s)),
  }
}

export type MatrixBlockTextPlan = {
  typography: ReturnType<typeof matrixBlockTypography>
  labelLines: 1 | 2 | 3
  showMeta: boolean
  showTags: boolean
}

/** Tune truncation and secondary lines so labels stay inside scaled blocks. */
export function matrixBlockTextPlan(
  blockScale: number,
  maxWidth: number,
  density: MatrixDensity,
): MatrixBlockTextPlan {
  const typography = matrixBlockTypography(blockScale)
  const tiny = blockScale < 0.42 || maxWidth < 42
  const narrow = maxWidth < 56
  const labelCap = Math.max(5, Math.floor(maxWidth / 6.5))
  const label = Math.min(typography.label, labelCap)

  if (tiny) {
    return {
      typography: { ...typography, label, meta: typography.meta, tag: typography.tag },
      labelLines: 1,
      showMeta: false,
      showTags: false,
    }
  }

  if (density === 'tight' || narrow) {
    return {
      typography: { ...typography, label },
      labelLines: narrow ? 1 : 2,
      showMeta: false,
      showTags: false,
    }
  }

  if (density === 'compact') {
    return {
      typography: { ...typography, label },
      labelLines: 2,
      showMeta: true,
      showTags: true,
    }
  }

  return {
    typography: { ...typography, label },
    labelLines: 2,
    showMeta: true,
    showTags: true,
  }
}

export const matrixBlockTextClass = 'min-w-0 w-full overflow-hidden break-words [overflow-wrap:anywhere]'

export function matrixBlockLabelClass(lines: 1 | 2 | 3): string {
  if (lines === 1) return `${matrixBlockTextClass} line-clamp-1`
  if (lines === 3) return `${matrixBlockTextClass} line-clamp-3`
  return `${matrixBlockTextClass} line-clamp-2`
}
