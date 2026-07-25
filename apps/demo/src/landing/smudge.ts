/**
 * Cursor smudge — the trail a fingertip leaves dragged through wet clay. Soft bone-dust
 * blots under the pointer that fade over a couple of seconds. Hero-only, faint by design,
 * absent under prefers-reduced-motion (the canvas is also display:none'd in CSS) and on
 * touch devices, where there is no hover to trail.
 */
export function mountSmudge(canvas: HTMLCanvasElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (matchMedia('(hover: none)').matches) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let dpr = 1
  const layout = () => {
    dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
  }
  layout()
  addEventListener('resize', layout)

  let raf = 0
  let lastBlot = 0
  let lastX = 0
  let lastY = 0

  const fade = () => {
    // Erase a few percent per frame; the trail dissolves rather than blinking out.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgb(0 0 0 / 0.045)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    if (performance.now() - lastBlot < 2600) raf = requestAnimationFrame(fade)
    else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      raf = 0
    }
  }

  const hero = canvas.parentElement!
  hero.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * dpr
    const y = (e.clientY - rect.top) * dpr
    const now = performance.now()
    // Interpolate between events so fast strokes stay a stroke, not morse code.
    const steps = lastBlot && now - lastBlot < 120 ? Math.min(Math.hypot(x - lastX, y - lastY) / (9 * dpr), 14) : 1
    for (let i = 1; i <= steps; i++) {
      const bx = lastX + ((x - lastX) * i) / steps
      const by = lastY + ((y - lastY) * i) / steps
      const r = (16 + Math.random() * 8) * dpr
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r)
      g.addColorStop(0, 'rgb(232 224 210 / 0.05)')
      g.addColorStop(1, 'rgb(232 224 210 / 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(bx, by, r, 0, Math.PI * 2)
      ctx.fill()
    }
    lastX = x
    lastY = y
    lastBlot = now
    if (!raf) raf = requestAnimationFrame(fade)
  })
}
