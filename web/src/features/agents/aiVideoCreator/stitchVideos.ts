import { videoSizeMeta } from './types'

export function pickRecorderMime(): { mimeType: string; ext: 'mp4' | 'webm' } {
  const mp4 = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
  const webmVp9 = 'video/webm;codecs=vp9,opus'
  const webmVp8 = 'video/webm;codecs=vp8,opus'
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mp4)) {
    return { mimeType: mp4, ext: 'mp4' }
  }
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(webmVp9)) {
    return { mimeType: webmVp9, ext: 'webm' }
  }
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(webmVp8)) {
    return { mimeType: webmVp8, ext: 'webm' }
  }
  return { mimeType: 'video/webm', ext: 'webm' }
}

function waitForEvent(target: EventTarget, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      target.removeEventListener(name, ok)
      target.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      target.removeEventListener(name, ok)
      target.removeEventListener('error', fail)
      reject(new Error(`Video ${name} failed.`))
    }
    target.addEventListener(name, ok)
    target.addEventListener('error', fail)
  })
}

export async function stitchVideoBlobs(
  blobs: Blob[],
  size: string,
): Promise<{ blob: Blob; ext: 'mp4' | 'webm'; mimeType: string }> {
  if (blobs.length === 0) throw new Error('No scenes to join.')
  if (blobs.length === 1) {
    return { blob: blobs[0], ext: 'mp4', mimeType: blobs[0].type || 'video/mp4' }
  }

  const { width, height } = videoSizeMeta(size)
  const { mimeType, ext } = pickRecorderMime()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not join the scenes.')

  const canvasStream = canvas.captureStream(30)
  const audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') await audioCtx.resume()
  const audioDest = audioCtx.createMediaStreamDestination()
  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ])

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(mixed, { mimeType })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('Could not record the joined video.'))
  })

  recorder.start()

  try {
    for (const blob of blobs) {
      const url = URL.createObjectURL(blob)
      const video = document.createElement('video')
      video.src = url
      video.playsInline = true
      video.muted = true
      video.crossOrigin = 'anonymous'
      try {
        await waitForEvent(video, 'loadeddata')
        let source: MediaElementAudioSourceNode | null = null
        try {
          source = audioCtx.createMediaElementSource(video)
          source.connect(audioDest)
          video.muted = false
          video.volume = 1
        } catch {
          video.muted = true
        }

        let playing = true
        const draw = () => {
          if (!playing) return
          ctx.drawImage(video, 0, 0, width, height)
          requestAnimationFrame(draw)
        }
        const ended = waitForEvent(video, 'ended')
        const playAttempt = video.play()
        if (playAttempt) await playAttempt
        draw()
        await ended
        playing = false
        source?.disconnect()
      } finally {
        video.pause()
        video.removeAttribute('src')
        video.load()
        URL.revokeObjectURL(url)
      }
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop()
    await stopped
    canvasStream.getTracks().forEach((t) => t.stop())
    mixed.getTracks().forEach((t) => t.stop())
    await audioCtx.close()
  }

  if (chunks.length === 0) throw new Error('Joining scenes produced an empty video.')
  return { blob: new Blob(chunks, { type: mimeType }), ext, mimeType }
}
