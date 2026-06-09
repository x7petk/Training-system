import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

export async function exportElementToPng(el: HTMLElement, fileName: string) {
  const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  a.click()
}

export async function exportElementToPdf(el: HTMLElement, fileName: string) {
  const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not render image for PDF'))
  })
  const pdf = new jsPDF({
    orientation: img.width >= img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width, img.height],
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height)
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
