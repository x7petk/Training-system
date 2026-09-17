import { videoSizeMeta } from './types'

const MAX_SOURCE_BYTES = 12 * 1024 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that picture. Use JPG, PNG, or WEBP.'))
    }
    img.src = url
  })
}

export async function resizeImageToVideoFrame(file: File, size: string): Promise<Blob> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error('Please upload a picture (JPG, PNG, WEBP, or a phone photo).')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Picture is too large. Please use a file under 12 MB.')
  }

  const { width, height } = videoSizeMeta(size)
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare the picture for video.')

  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  const dx = (width - dw) / 2
  const dy = (height - dh) / 2
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, dx, dy, dw, dh)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.88)
  })
  if (!blob) throw new Error('Could not convert the picture for Sora.')
  return blob
}
