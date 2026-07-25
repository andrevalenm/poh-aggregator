/**
 * The ink-press interaction system — one physical rule for the whole page: pressing
 * anything soft leaves ink.
 *
 * Controls are soft-bodied: they squish under the pointer and spring back with a small
 * overshoot (the squish is CSS :active; the sprung recovery is a keyframe class added on
 * release). Every press also blooms an irregular ink blot from the press point inside the
 * control, which soaks in and fades — and pressing the bare sheet leaves a small thumb
 * blot on the paper itself. On the night sections the blot is bone. Touch gets the squish
 * (native) but no blots; reduced-motion gets neither.
 */

const CONTROL = '.cta, #lookup-submit, .example-chip, .picker button, .copy-btn, .threshold-clear, .ledger-details summary'

function blotPath(rand: () => number): string {
  // An irregular blob: a wobbly circle as an SVG path (8 anchors, random radii).
  const pts: [number, number][] = []
  const N = 8
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = 0.72 + rand() * 0.42
    pts.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  let d = `M ${pts[0]![0]} ${pts[0]![1]}`
  for (let i = 0; i < N; i++) {
    const p = pts[i]!
    const n = pts[(i + 1) % N]!
    const mx = (p[0] + n[0]) / 2
    const my = (p[1] + n[1]) / 2
    d += ` Q ${p[0]} ${p[1]} ${mx} ${my}`
  }
  return d + ' Z'
}

export function mountInkPress(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let seed = 0xb107
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  // Springy recovery on release.
  addEventListener('pointerup', (e) => {
    const control = (e.target as Element).closest?.(CONTROL) as HTMLElement | null
    if (!control) return
    control.classList.remove('sprung')
    // Force a restart if two presses land within one animation.
    void control.offsetWidth
    control.classList.add('sprung')
    control.addEventListener('animationend', () => control.classList.remove('sprung'), { once: true })
  })

  if (matchMedia('(hover: none)').matches) return // squish yes, blots no

  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const target = e.target as Element
    const control = target.closest?.(CONTROL) as HTMLElement | null

    if (control) {
      // Blot inside the control, from the press point.
      const rect = control.getBoundingClientRect()
      const blot = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      blot.setAttribute('viewBox', '-1.3 -1.3 2.6 2.6')
      blot.classList.add('press-blot')
      const size = Math.max(rect.width, rect.height) * 1.1
      blot.style.width = blot.style.height = `${size}px`
      blot.style.left = `${e.clientX - rect.left - size / 2}px`
      blot.style.top = `${e.clientY - rect.top - size / 2}px`
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', blotPath(rand))
      blot.append(path)
      // Controls must clip their ink.
      if (getComputedStyle(control).position === 'static') control.style.position = 'relative'
      control.style.overflow = 'hidden'
      control.append(blot)
      blot.addEventListener('animationend', () => blot.remove(), { once: true })
      return
    }

    // Bare sheet: a small thumb blot that soaks in and fades. Skip text-ish targets.
    if (target.closest('input, textarea, a, button, [role="tab"], pre, code')) return
    // The azulejo tiles are cream — paper ink there, bone ink only on true night ground.
    const night =
      target.closest('.sponsor-card') == null &&
      target.closest('.install, .hackathon, .colophon') != null
    const blot = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    blot.setAttribute('viewBox', '-1.3 -1.3 2.6 2.6')
    blot.classList.add('sheet-blot')
    if (night) blot.classList.add('is-bone')
    const size = 14 + rand() * 14
    blot.style.width = blot.style.height = `${size}px`
    blot.style.left = `${e.clientX - size / 2}px`
    blot.style.top = `${e.clientY - size / 2}px`
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', blotPath(rand))
    blot.append(path)
    document.body.append(blot)
    blot.addEventListener('animationend', () => blot.remove(), { once: true })
  })
}
