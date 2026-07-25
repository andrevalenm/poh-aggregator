/**
 * The signature element: a procedural ink thumbprint that draws itself in, then deforms
 * softly under the cursor like a thumb pressed into wet clay.
 *
 * v2 — real ridge anatomy. A fingerprint is not concentric rings: it is a smooth line
 * field with exactly two kinds of singularity — a core (Poincaré index +1/2, where ridges
 * recurve) and a delta (index −1/2, where three ridge families meet). We build that
 * orientation field directly (the classic Sherlock–Monro construction), then trace
 * evenly-spaced streamlines through it (Jobard–Lehman), which is how actual synthetic
 * fingerprint generators work. The result has the loop, the delta, and the near-horizontal
 * base ridges of a right thumb.
 *
 * Deterministic on purpose — the same seed renders the same print on every visit, because
 * a fingerprint that changed between loads would be exactly the wrong metaphor for this
 * product. No image asset anywhere.
 */

const SEED = 0x5eed

// Thumb-shaped mask: a tilted superellipse, taller than wide.
const TILT = -0.13
const MASK_A = 0.72
const MASK_B = 1.0
const MASK_N = 2.5

// Singularities in unit space. Core upper-centre, delta lower-right — a right-hand loop.
const CORE = { x: 0.02, y: -0.26 }
const DELTA = { x: 0.3, y: 0.48 }

// Streamline spacing (unit space): ridge separation and the kill distance.
const D_SEP = 0.052
const D_TEST = D_SEP * 0.48
const STEP = 0.011
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

/** Superellipse value: <1 inside the thumb, 1 on the boundary. */
function maskVal(x: number, y: number): number {
  const xr = x * Math.cos(-TILT) - y * Math.sin(-TILT)
  const yr = x * Math.sin(-TILT) + y * Math.cos(-TILT)
  return Math.abs(xr / MASK_A) ** MASK_N + Math.abs(yr / MASK_B) ** MASK_N
}

/**
 * Ridge orientation at a point: +1/2 index at the core, −1/2 at the delta, horizontal in
 * the far field (the base-of-thumb ridges), plus a gentle seeded waviness.
 */
function orientation(x: number, y: number, p1: number, p2: number): number {
  const a = 0.5 * Math.atan2(y - CORE.y, x - CORE.x)
  const b = -0.5 * Math.atan2(y - DELTA.y, x - DELTA.x)
  const wave = 0.055 * Math.sin(2.3 * x + 1.4 * y + p1) + 0.045 * Math.sin(3.6 * x - 2.2 * y + p2)
  return a + b + wave
}

interface Pt {
  x: number
  y: number
  /** Edge falloff × hand pressure — ink is lighter where the thumb barely touched. */
  a: number
}

interface Ridge {
  pts: Pt[]
  gaps: [number, number][] // index ranges where the pen lifts (minutiae)
  width: number
  alpha: number
  delay: number
  speed: number
}

function buildRidges(): Ridge[] {
  const rand = mulberry32(SEED)
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2

  // Occupancy grid for streamline spacing.
  const cell = D_SEP
  const grid = new Map<string, { x: number; y: number }[]>()
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`
  const deposit = (x: number, y: number) => {
    const k = key(x, y)
    const arr = grid.get(k)
    if (arr) arr.push({ x, y })
    else grid.set(k, [{ x, y }])
  }
  const nearest2 = (x: number, y: number): number => {
    const ix = Math.floor(x / cell)
    const iy = Math.floor(y / cell)
    let best = Infinity
    for (let gx = ix - 1; gx <= ix + 1; gx++)
      for (let gy = iy - 1; gy <= iy + 1; gy++) {
        const arr = grid.get(`${gx},${gy}`)
        if (!arr) continue
        for (const p of arr) {
          const d = (p.x - x) ** 2 + (p.y - y) ** 2
          if (d < best) best = d
        }
      }
    return best
  }

  const dirAt = (x: number, y: number, prev: { x: number; y: number }) => {
    const th = orientation(x, y, p1, p2)
    let dx = Math.cos(th)
    let dy = Math.sin(th)
    if (dx * prev.x + dy * prev.y < 0) {
      dx = -dx
      dy = -dy
    }
    return { x: dx, y: dy }
  }

  const integrate = (sx: number, sy: number, sign: number): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = []
    let x = sx
    let y = sy
    let prev = { x: sign * Math.cos(orientation(sx, sy, p1, p2)), y: sign * Math.sin(orientation(sx, sy, p1, p2)) }
    for (let i = 0; i < 420; i++) {
      // Midpoint step through the line field, resolving the mod-π ambiguity against the
      // previous heading so the trace never doubles back.
      const d1 = dirAt(x, y, prev)
      const mx = x + d1.x * STEP * 0.5
      const my = y + d1.y * STEP * 0.5
      const d2 = dirAt(mx, my, d1)
      const nx = x + d2.x * STEP
      const ny = y + d2.y * STEP
      if (maskVal(nx, ny) > 1.12) break
      // Stop when we run into any committed ridge — this is what keeps spacing even.
      if (nearest2(nx, ny) < D_TEST * D_TEST) break
      out.push({ x: nx, y: ny })
      x = nx
      y = ny
      prev = d2
    }
    return out
  }

  const polylines: { x: number; y: number }[][] = []
  const seeds: { x: number; y: number }[] = []
  // Prime the queue: around the core (the recurving loop), beside the delta, and along the
  // vertical axis so the base ridges get traced even if candidate propagation runs dry.
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2
    seeds.push({ x: CORE.x + Math.cos(ang) * D_SEP * 1.3, y: CORE.y + Math.sin(ang) * D_SEP * 1.3 })
  }
  for (let y = -0.95; y < 1; y += D_SEP * 1.05) seeds.push({ x: 0.01 + y * 0.03, y })
  for (let i = 0; i < 5; i++) seeds.push({ x: DELTA.x + (rand() - 0.5) * 0.2, y: DELTA.y + (rand() - 0.5) * 0.2 })

  while (seeds.length && polylines.length < 90) {
    const s = seeds.shift()!
    if (maskVal(s.x, s.y) > 1.05) continue
    if (nearest2(s.x, s.y) < (D_SEP * 0.9) ** 2) continue
    const fwd = integrate(s.x, s.y, +1)
    const bwd = integrate(s.x, s.y, -1)
    const line = [...bwd.reverse(), { x: s.x, y: s.y }, ...fwd]
    if (line.length < 16) continue
    polylines.push(line)
    for (let i = 0; i < line.length; i += 2) deposit(line[i]!.x, line[i]!.y)
    // Candidate seeds one ridge-width to each side, every few samples.
    for (let i = 4; i < line.length - 4; i += 6) {
      const a = line[i - 1]!
      const b = line[i + 1]!
      const tx = b.x - a.x
      const ty = b.y - a.y
      const len = Math.hypot(tx, ty) || 1
      const nxn = -ty / len
      const nyn = tx / len
      seeds.push({ x: line[i]!.x + nxn * D_SEP, y: line[i]!.y + nyn * D_SEP })
      seeds.push({ x: line[i]!.x - nxn * D_SEP, y: line[i]!.y - nyn * D_SEP })
    }
  }

  // Dress each traced ridge: edge falloff, hand-pressure noise, minutiae, ink variation.
  const ridges: Ridge[] = []
  for (const line of polylines) {
    const pts: Pt[] = line
      .filter((_, i) => i % 2 === 0)
      .map((p) => {
        const m = maskVal(p.x, p.y)
        const edge = Math.max(0, Math.min(1, (1.04 - m) / 0.22))
        const pressure = 0.75 + 0.25 * Math.sin(p.x * 5.1 + p.y * 3.7 + p1)
        return { x: p.x, y: p.y, a: edge * pressure }
      })
    if (pts.length < 8) continue
    const gaps: [number, number][] = []
    const gapCount = Math.floor(rand() * 3)
    for (let g = 0; g < gapCount; g++) {
      const at = Math.floor(rand() * (pts.length - 6)) + 2
      gaps.push([at, at + 1 + Math.floor(rand() * 3)])
    }
    const mid = pts[Math.floor(pts.length / 2)]!
    const distCore = Math.hypot(mid.x - CORE.x, mid.y - CORE.y)
    ridges.push({
      pts,
      gaps,
      width: 1.05 + rand() * 0.55,
      alpha: 0.55 + rand() * 0.3,
      delay: Math.min(distCore * 0.42 + rand() * 0.1, 0.62),
      speed: 0.34 + rand() * 0.1,
    })
  }
  return ridges
}

const RIDGES = buildRidges()

/**
 * Static renderer for reuse outside the hero — e.g. the iron colophon stamp. Draws the
 * finished print once, no animation, no interaction.
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
  const scale = Math.min(w / 1.6, h / 2.1)
  const cx = w / 2
  const cy = h / 2
  ctx.lineCap = 'round'
  for (const ridge of RIDGES) {
    ctx.lineWidth = Math.max(ridge.width * (scale / 340), 0.5)
    ctx.beginPath()
    let penDown = false
    for (let i = 0; i < ridge.pts.length; i++) {
      if (ridge.gaps.some(([a, b]) => i >= a && i <= b)) {
        penDown = false
        continue
      }
      const pt = ridge.pts[i]!
      const x = cx + pt.x * scale
      const y = cy + pt.y * scale
      if (penDown) ctx.lineTo(x, y)
      else {
        ctx.moveTo(x, y)
        penDown = true
      }
    }
    ctx.strokeStyle = color
    ctx.globalAlpha = ridge.alpha * alpha
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export function mountFingerprint(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

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
    cx = narrow ? w * 0.5 : w * 0.72
    cy = h * 0.5
    // The print must live inside the hero: MASK_B ≈ 1 unit each way vertically, so cap the
    // scale at ~42% of the hero height and it can never bleed into the next section.
    scale = narrow ? Math.min(w, h) * 0.46 : Math.min(w * 0.33, h * 0.42)
    baseAlpha = narrow ? 0.3 : 0.85
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
    for (const ridge of RIDGES) {
      const f = Math.min(Math.max((p - ridge.delay) / ridge.speed, 0), 1)
      if (f === 0) continue
      ctx.lineWidth = ridge.width
      const visible = Math.floor(ridge.pts.length * f)
      let penDown = false
      ctx.beginPath()
      // One path per ridge, alpha per ridge; per-point pressure is folded into segment
      // skipping (very light points lift the pen like dry ink).
      for (let i = 0; i < visible; i++) {
        if (ridge.gaps.some(([a, b]) => i >= a && i <= b)) {
          penDown = false
          continue
        }
        const pt = ridge.pts[i]!
        if (pt.a < 0.16) {
          penDown = false
          continue
        }
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
      ctx.strokeStyle = `rgb(232 224 210 / ${(ridge.alpha * baseAlpha).toFixed(3)})`
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
