/**
 * Convert a live `<svg>` DOM node to a download-ready PNG.
 * The SVG must already include all styles inline (no external CSS dependencies).
 */
export async function exportSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  options: { scale?: number; background?: string } = {},
): Promise<void> {
  const scale = options.scale ?? 2
  const background = options.background ?? '#ffffff'

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  const widthAttr = clone.getAttribute('width')
  const heightAttr = clone.getAttribute('height')
  const viewBox = clone.getAttribute('viewBox')

  let baseWidth = 1280
  let baseHeight = 720
  if (widthAttr && heightAttr) {
    baseWidth = parseFloat(widthAttr)
    baseHeight = parseFloat(heightAttr)
  } else if (viewBox) {
    const parts = viewBox.split(/\s+/).map(parseFloat)
    if (parts.length === 4) {
      baseWidth = parts[2]
      baseHeight = parts[3]
    }
  }

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(baseWidth * scale)
        canvas.height = Math.round(baseHeight * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable.'))
          return
        }
        ctx.fillStyle = background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not encode PNG.'))
            return
          }
          const blobUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = filename
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
          resolve()
        }, 'image/png')
      }
      img.onerror = () => reject(new Error('Could not render SVG to image.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Open a print-ready window/tab with the SVG as a single landscape page,
 * then trigger the browser print dialog. User picks "Save as PDF".
 * This avoids adding a heavy PDF dependency to the bundle.
 */
export function exportSvgAsPdf(svg: SVGSVGElement, title: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.removeAttribute('width')
  clone.removeAttribute('height')
  clone.setAttribute('style', 'width:100%;height:auto;display:block;')

  const svgString = new XMLSerializer().serializeToString(clone)
  const escapedTitle = (title || 'Roadmap')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapedTitle}</title>
<style>
  @page { size: A3 landscape; margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: 'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif; }
  .wrap { width: 100%; }
  .toolbar { padding: 12px 16px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #e2e8f0; }
  .toolbar button { padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #0f172a; color: #ffffff; cursor: pointer; font-weight: 600; }
  .toolbar button.secondary { background: #ffffff; color: #0f172a; }
  .stage { padding: 16px; }
  @media print {
    .toolbar { display: none; }
    .stage { padding: 0; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <button onclick="window.print()">Save as PDF / Print</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span style="color:#475569;font-size:13px;">Use your print dialog and pick "Save as PDF" as the destination.</span>
  </div>
  <div class="stage">${svgString}</div>
</div>
<script>
  setTimeout(function () { try { window.print(); } catch (e) {} }, 250);
</script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=1200,height=900')
  if (!printWindow) {
    alert('Pop-ups are blocked. Please allow pop-ups for this site to export PDF.')
    return
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
