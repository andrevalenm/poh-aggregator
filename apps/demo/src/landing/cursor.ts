/**
 * Trailing ring cursor. The native cursor stays (an I-beam over an input is information);
 * a thin ink ring eases along behind it and swells over anything interactive. Inverts
 * itself over the night sections via difference blending. Gone on touch and under
 * prefers-reduced-motion.
 */

export function mountCursor(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (matchMedia('(hover: none)').matches) return

  const ring = document.createElement('div')
  ring.className = 'cursor-ring'
  ring.setAttribute('aria-hidden', 'true')
  document.body.append(ring)

  let tx = -100
  let ty = -100
  let x = -100
  let y = -100
  let raf = 0
  let active = false

  const loop = () => {
    x += (tx - x) * 0.16
    y += (ty - y) * 0.16
    ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${active ? 1.8 : 1})`
    if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) raf = requestAnimationFrame(loop)
    else raf = 0
  }

  addEventListener(
    'pointermove',
    (e) => {
      tx = e.clientX
      ty = e.clientY
      ring.classList.add('is-on')
      if (!raf) raf = requestAnimationFrame(loop)
    },
    { passive: true },
  )

  const INTERACTIVE = 'a, button, [role="tab"], input, .example-chip, .copy-btn'
  addEventListener('pointerover', (e) => {
    active = (e.target as Element).closest?.(INTERACTIVE) != null
    ring.classList.toggle('is-active', active)
    if (!raf) raf = requestAnimationFrame(loop)
  })

  document.addEventListener('pointerleave', () => ring.classList.remove('is-on'))
}
