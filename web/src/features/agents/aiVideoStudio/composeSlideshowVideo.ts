export type SlideshowOptions = {
  secondsPerSlide?: number
  width?: number
  height?: number
  fps?: number
}

/**
 * Builds a simple Ken Burns slideshow in the browser (WebM). Works offline without AI keys.
 */
export async function composeSlideshowVideo(
  imageDataUrls: string[],
  options: SlideshowOptions = {},
): Promise<{ blob: Blob; mimeType: string }> {
  if (imageDataUrls.length === 0) {
    throw new Error('Add at least one image.')
  }

  const secondsPerSlide = options.secondsPerSlide ?? 3
  const width = options.width ?? 1280
  const height = options.height ?? 720
  const fps = options.fps ?? 24
  const framesPerSlide = Math.max(1, Math.round(secondsPerSlide * fps))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')

  const stream = canvas.captureStream(fps)
  const mimeType = pickRecorderMimeType()
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
  const chunks: Blob[] = []

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Recording failed.'))
    recorder.onstop = () => resolve()
  })

  recorder.start(200)

  for (let slideIndex = 0; slideIndex < imageDataUrls.length; slideIndex++) {
    const img = await loadImage(imageDataUrls[slideIndex]!)
    const fit = coverRect(img.naturalWidth, img.naturalHeight, width, height)
    const zoomStart = 1
    const zoomEnd = 1.08
    const panXStart = slideIndex % 2 === 0 ? -0.02 : 0.02
    const panXEnd = -panXStart

    for (let f = 0; f < framesPerSlide; f++) {
      const t = framesPerSlide <= 1 ? 1 : f / (framesPerSlide - 1)
      const zoom = lerp(zoomStart, zoomEnd, t)
      const panX = lerp(panXStart, panXEnd, t)
      drawCover(ctx, img, fit, width, height, zoom, panX)
      await waitFrame(fps)
    }
  }

  recorder.stop()
  await done
  return { blob: new Blob(chunks, { type: mimeType }), mimeType }
}

function pickRecorderMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return 'video/webm'
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function waitFrame(fps: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.round(1000 / fps)))
}

function coverRect(iw: number, ih: number, cw: number, ch: number) {
  const scale = Math.max(cw / iw, ch / ih)
  const dw = iw * scale
  const dh = ih * scale
  return { dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2 }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fit: { dw: number; dh: number; ox: number; oy: number },
  cw: number,
  ch: number,
  zoom: number,
  panX: number,
) {
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, cw, ch)
  const cx = cw / 2
  const cy = ch / 2
  ctx.save()
  ctx.translate(cx + panX * cw, cy)
  ctx.scale(zoom, zoom)
  ctx.translate(-cx, -cy)
  ctx.drawImage(img, fit.ox, fit.oy, fit.dw, fit.dh)
  ctx.restore()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for slideshow.'))
    img.src = src
  })
}
