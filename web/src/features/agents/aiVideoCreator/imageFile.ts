const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,.heic,.heif'

export const IMAGE_ACCEPT = ACCEPT_ATTR

export function isProbablyImage(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type.startsWith('image/')) return true
  if (type) return false
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name)
}

function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that picture. Use JPG, PNG, WEBP, or take the photo in this page.'))
    img.src = url
  })
}

export async function fileToJpegFile(file: File, maxEdge = 1920): Promise<File> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Picture is too large. Please use a file under 12 MB.')
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageUrl(url)
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not convert that picture.')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    if (!blob) throw new Error('Could not convert that picture.')
    const base = file.name.replace(/\.[^.]+$/, '') || 'phone'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
