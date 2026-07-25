/**
 * The signature element: a procedural ink thumbprint that draws itself in, then deforms
 * softly under the cursor like a thumb pressed into wet clay.
 *
 * v3 — the v1 language, denser. The flow-field experiment (v2) was anatomically correct
 * and aesthetically worse: sparse, blocky, dashed. What worked was v1's continuous
 * collecting rings. So: nested warped loops again, tighter and more numerous, with only a
 * hint of thumb anatomy kept — a portrait tilt, an egg-shaped envelope fuller at the base,
 * and a core that drifts low like a loop's recurve. Ridges stay parallel (shared warp
 * harmonics, slow wobble drift) and continuous (no seam at the wrap).
 *
 * Deterministic on purpose — the same seed renders the same print on every visit, because
 * a fingerprint that changed between loads would be exactly the wrong metaphor for this
 * product. No image asset.
 */

const SEED = 0x5eed
const RIDGES = 56
const POINTS = 300
const DRAW_MS = 2600

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Ridge {
  pts: { x: number; y: number }[]
  /** θ windows where the pen lifts — ridge endings, kept sparse. */
  gaps: [number, number][]
  width: number
  alpha: number
  delay: number
  speed: number
  startIdx: number
}

function buildRidges(): Ridge[] {
  const rand = mulberry32(SEED)
  // Shared warp harmonics: every ridge follows the same flow. Amplitudes stay small
  // relative to ridge spacing so neighbours never cross.
  const harmonics = [
    { n: 1, amp: 0.045, phase: rand() * Math.PI * 2 },
    { n: 2, amp: 0.085, phase: rand() * Math.PI * 2 },
    { n: 3, amp: 0.035, phase: rand() * Math.PI * 2 },
    { n: 5, amp: 0.014, phase: rand() * Math.PI * 2 },
  ]

  const ridges: Ridge[] = []
  for (let i = 0; i < RIDGES; i++) {
    const t = 0.075 + (i / (RIDGES - 1)) * 0.925
    // Fine texture drifts coherently ridge-to-ridge instead of criss-crossing.
    const wobblePhase = i * 0.5
    const wobbleAmp = t * 0.007
    // The thumb hint #1: inner rings sit low — the loop's core recurves toward the base.
    const coreDrop = (1 - t) * 0.1
    const pts: Ridge['pts'] = []
    for (let p = 0; p <= POINTS; p++) {
      const theta = (p / POINTS) * Math.PI * 2
      let r = t
      for (const h of harmonics) r += t * h.amp * Math.sin(h.n * theta + h.phase + t * 1.3)
      r += wobbleAmp * Math.sin(7 * theta + wobblePhase)
      // The thumb hint #2: portrait envelope, fuller at the base than the tip.
      const ex = r * Math.cos(theta) * 0.76
      const ey = r * Math.sin(theta) * (theta > Math.PI ? 0.94 : 1.08) + coreDrop
      // The thumb hint #3: a slight roll — a thumb never lands square.
      const tilt = -0.14
      pts.push({
        x: ex * Math.cos(tilt) - ey * Math.sin(tilt),
        y: ex * Math.sin(tilt) + ey * Math.cos(tilt),
      })
    }
    const gaps: [number, number][] = []
    const gapCount = 1 + Math.floor(rand() * 2)
    for (let g = 0; g < gapCount; g++) {
      const at = rand() * Math.PI * 2
      gaps.push([at, at + 0.04 + rand() * 0.14])
    }
    ridges.push({
      pts,
      gaps,
      width: 0.85 + rand() * 0.45,
      alpha: 0.5 + rand() * 0.34,
      delay: (i / RIDGES) * 0.66 + rand() * 0.08,
      speed: 0.3 + rand() * 0.1,
      startIdx: Math.floor(rand() * POINTS),
    })
  }
  return ridges
}

const RIDGES_DATA = buildRidges()

/**
 * Static renderer for reuse outside the hero — the iron colophon stamp. Draws the finished
 * print once, no animation, no interaction.
 */
export function stampPrint(canvas: HTMLCanvasElement, color: string, alpha = 1): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const scale = Math.min(w / 1.7, h / 2.3)
  const cx = w / 2
  const cy = h / 2
  ctx.lineCap = 'round'
  for (const ridge of RIDGES_DATA) {
    ctx.lineWidth = Math.max(ridge.width * (scale / 300), 0.45)
    ctx.strokeStyle = color
    ctx.globalAlpha = ridge.alpha * alpha
    ctx.beginPath()
    let penDown = false
    for (let i = 0; i < ridge.pts.length; i++) {
      const idx = (i + ridge.startIdx) % ridge.pts.length
      const theta = (idx / POINTS) * Math.PI * 2
      if (ridge.gaps.some(([a, b]) => theta > a && theta < b)) {
        penDown = false
        continue
      }
      const pt = ridge.pts[idx]!
      const x = cx + pt.x * scale
      const y = cy + pt.y * scale
      if (penDown) ctx.lineTo(x, y)
      else {
        ctx.moveTo(x, y)
        penDown = true
      }
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export function mountFingerprint(
  canvas: HTMLCanvasElement,
  opts?: { rgb?: string; wideAlpha?: number; narrowAlpha?: number },
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // Ink colour as an "r g b" triple; bone for dark grounds, ink for paper.
  const rgb = opts?.rgb ?? '232 224 210'
  const wideAlpha = opts?.wideAlpha ?? 0.85
  const narrowAlpha = opts?.narrowAlpha ?? 0.3

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  let w = 0
  let h = 0
  let dpr = 1
  let cx = 0
  let cy = 0
  let scale = 1
  let baseAlpha = 1

  const layout = () => {
    dpr = Math.min(devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const narrow = w < 760
    cx = narrow ? w * 0.5 : w * 0.73
    cy = h * 0.49
    // Vertical extent stays inside the hero — no bleeding into the next fold.
    scale = narrow ? Math.min(w, h) * 0.46 : Math.min(w * 0.33, h * 0.41)
    baseAlpha = narrow ? narrowAlpha : wideAlpha
  }

  const start = performance.now()
  let px = -1e4
  let py = -1e4
  let tx = -1e4
  let ty = -1e4
  let pointerIn = false

  const PRESS_RADIUS = 150
  const PRESS_DEPTH = 20

  const draw = (now: number) => {
    const p = reduced ? 1 : Math.min((now - start) / DRAW_MS, 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const pressActive = px > -1e3
    for (const ridge of RIDGES_DATA) {
      const f = Math.min(Math.max((p - ridge.delay) / ridge.speed, 0), 1)
      if (f === 0) continue
      ctx.lineWidth = ridge.width
      ctx.strokeStyle = `rgb(${rgb} / ${(ridge.alpha * baseAlpha).toFixed(3)})`
      ctx.beginPath()
      let penDown = false
      const visible = Math.floor(ridge.pts.length * f)
      // pts[0] and pts[POINTS] coincide, so drawing through the wrap leaves no seam.
      for (let i = 0; i < visible; i++) {
        const idx = (i + ridge.startIdx) % ridge.pts.length
        const theta = (idx / POINTS) * Math.PI * 2
        if (ridge.gaps.some(([a, b]) => theta > a && theta < b)) {
          penDown = false
          continue
        }
        const pt = ridge.pts[idx]!
        let x = cx + pt.x * scale
        let y = cy + pt.y * scale
        if (pressActive) {
          const dx = x - px
          const dy = y - py
          const d2 = dx * dx + dy * dy
          if (d2 < PRESS_RADIUS * PRESS_RADIUS) {
            const d = Math.sqrt(d2) || 1
            const fall = 1 - d / PRESS_RADIUS
            const push = PRESS_DEPTH * fall * fall
            x += (dx / d) * push
            y += (dy / d) * push
          }
        }
        if (penDown) ctx.lineTo(x, y)
        else {
          ctx.moveTo(x, y)
          penDown = true
        }
      }
      ctx.stroke()
    }
  }

  let raf = 0
  const settled = () => Math.abs(px - tx) < 0.5 && Math.abs(py - ty) < 0.5
  const loop = (now: number) => {
    px += (tx - px) * 0.14
    py += (ty - py) * 0.14
    draw(now)
    const animating = now - start < DRAW_MS + 200
    if (animating || pointerIn || !settled()) raf = requestAnimationFrame(loop)
    else raf = 0
  }
  const wake = () => {
    if (!raf && !reduced) raf = requestAnimationFrame(loop)
  }

  const hero = canvas.parentElement!
  hero.addEventListener('pointermove', (e) => {
    if (reduced) return
    const rect = canvas.getBoundingClientRect()
    tx = e.clientX - rect.left
    ty = e.clientY - rect.top
    if (px < -1e3) {
      px = tx
      py = ty
    }
    pointerIn = true
    wake()
  })
  hero.addEventListener('pointerleave', () => {
    pointerIn = false
    tx = -1e4
    ty = -1e4
    wake()
  })

  addEventListener('resize', () => {
    layout()
    if (reduced) draw(performance.now())
    else wake()
  })

  layout()
  if (reduced) draw(performance.now())
  else raf = requestAnimationFrame(loop)
}
