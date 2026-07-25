/**
 * Cursor ink, v3 — an actual fluid. A compact GPU stable-fluids solver (Stam '99):
 * semi-Lagrangian advection, Jacobi pressure projection, dye injection under the pointer.
 * The cursor stirs a velocity field and drops bone-coloured ink into it; the ink curls,
 * diffuses and dies the way ink in water does, because it is being simulated, not faked.
 *
 * The canvas sits fixed over the whole page with `mix-blend-mode: exclusion`, so one ink
 * reads pale on the kiln sections and pressed-dark on the paper ones.
 *
 * Requires WebGL2 + EXT_color_buffer_float; returns false when unavailable so the caller
 * can fall back to the 2D ribbon. Absent under prefers-reduced-motion and on touch.
 */

const SIM_RES = 144
const DYE_RES = 512
const PRESSURE_ITERS = 20
const VELOCITY_DISSIPATION = 0.22
const DYE_DISSIPATION = 0.75
const SPLAT_FORCE = 5200
const SPLAT_RADIUS = 0.0048
const IDLE_STOP_MS = 6000

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const SPLAT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uValue;
uniform vec2 uPoint;
uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uValue;
  vec3 base = texture(uTarget, vUv).xyz;
  o = vec4(base + splat, 1.0);
}`

const ADVECT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexelSize;
  vec4 result = texture(uSource, coord);
  float decay = 1.0 + uDissipation * uDt;
  o = result / decay;
}`

const DIVERGENCE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main () {
  float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vUv.x - uTexelSize.x < 0.0) { L = -C.x; }
  if (vUv.x + uTexelSize.x > 1.0) { R = -C.x; }
  if (vUv.y - uTexelSize.y < 0.0) { B = -C.y; }
  if (vUv.y + uTexelSize.y > 1.0) { T = -C.y; }
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`

const PRESSURE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
void main () {
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float divergence = texture(uDivergence, vUv).x;
  o = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`

const GRADIENT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main () {
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  o = vec4(velocity, 0.0, 1.0);
}`

const DISPLAY_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uDye;
uniform vec3 uTint;
void main () {
  float d = texture(uDye, vUv).x;
  float a = clamp(d, 0.0, 1.0);
  a = a * a * (3.0 - 2.0 * a); // smoothstep the falloff — softer edges
  a *= 0.85;
  o = vec4(uTint * a, a); // premultiplied
}`

interface FBO {
  fb: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
  texel: [number, number]
}

interface DoubleFBO {
  read: FBO
  write: FBO
  swap(): void
}

export function mountFluid(canvas: HTMLCanvasElement, onContextLost?: () => void): boolean {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true // no trail at all
  if (matchMedia('(hover: none)').matches) return true
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) return false
  if (!gl.getExtension('EXT_color_buffer_float')) return false

  // Software rasterizers (and overloaded GPUs) can drop the context after init. When that
  // happens the sim silently no-ops, so kill the loop outright and hand the canvas back
  // for the 2D fallback — a zombie loop on a restored context spews GL errors forever.
  let dead = false
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    dead = true
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    onContextLost?.()
  })

  const compile = (type: number, src: string): WebGLShader | null => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null
    return s
  }
  const vert = compile(gl.VERTEX_SHADER, VERT)
  if (!vert) return false
  const program = (fragSrc: string): WebGLProgram | null => {
    const f = compile(gl.FRAGMENT_SHADER, fragSrc)
    if (!f) return null
    const p = gl.createProgram()!
    gl.attachShader(p, vert)
    gl.attachShader(p, f)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null
    return p
  }

  const progSplat = program(SPLAT_FRAG)
  const progAdvect = program(ADVECT_FRAG)
  const progDiv = program(DIVERGENCE_FRAG)
  const progPressure = program(PRESSURE_FRAG)
  const progGradient = program(GRADIENT_FRAG)
  const progDisplay = program(DISPLAY_FRAG)
  if (!progSplat || !progAdvect || !progDiv || !progPressure || !progGradient || !progDisplay) return false

  // Fullscreen triangle-strip quad.
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const makeFBO = (w: number, h: number, internal: number, format: number): FBO => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    void format
    return { fb, tex, w, h, texel: [1 / w, 1 / h] }
  }

  const makeDouble = (w: number, h: number, internal: number, format: number): DoubleFBO => {
    let a = makeFBO(w, h, internal, format)
    let b = makeFBO(w, h, internal, format)
    return {
      get read() {
        return a
      },
      get write() {
        return b
      },
      swap() {
        const t = a
        a = b
        b = t
      },
    } as DoubleFBO
  }

  let velocity!: DoubleFBO
  let dye!: DoubleFBO
  let pressure!: DoubleFBO
  let divergence!: FBO

  let simW = 0
  let simH = 0
  let dyeW = 0
  let dyeH = 0

  const layout = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(innerWidth * dpr * 0.5) // display buffer at half res — ink is soft anyway
    canvas.height = Math.round(innerHeight * dpr * 0.5)
    const aspect = innerWidth / innerHeight
    simW = aspect > 1 ? Math.round(SIM_RES * aspect) : SIM_RES
    simH = aspect > 1 ? SIM_RES : Math.round(SIM_RES / aspect)
    dyeW = aspect > 1 ? Math.round(DYE_RES * aspect) : DYE_RES
    dyeH = aspect > 1 ? DYE_RES : Math.round(DYE_RES / aspect)
    velocity = makeDouble(simW, simH, gl.RG16F, gl.RG)
    dye = makeDouble(dyeW, dyeH, gl.R16F, gl.RED)
    pressure = makeDouble(simW, simH, gl.R16F, gl.RED)
    divergence = makeFBO(simW, simH, gl.R16F, gl.RED)
  }
  layout()
  addEventListener('resize', layout)

  const blit = (target: FBO | null) => {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb)
      gl.viewport(0, 0, target.w, target.h)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const bindTex = (tex: WebGLTexture, unit: number): number => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    return unit
  }

  const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name)

  // Pointer state, in UV space (y up).
  let lastX = -1
  let lastY = -1
  let lastMove = -IDLE_STOP_MS
  const splats: { x: number; y: number; dx: number; dy: number }[] = []

  addEventListener(
    'pointermove',
    (e) => {
      const x = e.clientX / innerWidth
      const y = 1 - e.clientY / innerHeight
      if (lastX >= 0) {
        const dx = x - lastX
        const dy = y - lastY
        if (Math.abs(dx) + Math.abs(dy) > 0.2) {
          // A teleport (scroll jump), not a stroke — re-anchor without splatting.
          lastX = x
          lastY = y
          return
        }
        splats.push({ x, y, dx: dx * SPLAT_FORCE, dy: dy * SPLAT_FORCE })
      }
      lastX = x
      lastY = y
      lastMove = performance.now()
      wake()
    },
    { passive: true },
  )

  const aspect = () => innerWidth / innerHeight

  let lastFrame = performance.now()
  let raf = 0

  const step = (now: number) => {
    const dt = Math.min((now - lastFrame) / 1000, 1 / 30)
    lastFrame = now

    // Inject pending strokes into velocity and dye.
    while (splats.length) {
      const s = splats.shift()!
      const speed = Math.hypot(s.dx, s.dy)
      gl.useProgram(progSplat)
      gl.uniform1f(u(progSplat, 'uAspect'), aspect())
      gl.uniform2f(u(progSplat, 'uPoint'), s.x, s.y)
      gl.uniform1f(u(progSplat, 'uRadius'), SPLAT_RADIUS)
      gl.uniform1i(u(progSplat, 'uTarget'), bindTex(velocity.read.tex, 0))
      gl.uniform3f(u(progSplat, 'uValue'), s.dx, s.dy, 0)
      blit(velocity.write)
      velocity.swap()
      gl.uniform1i(u(progSplat, 'uTarget'), bindTex(dye.read.tex, 0))
      gl.uniform3f(u(progSplat, 'uValue'), Math.max(Math.min(speed * 0.004, 0.9), 0.18), 0, 0)
      blit(dye.write)
      dye.swap()
    }

    // Advect velocity through itself, then project out divergence.
    gl.useProgram(progAdvect)
    gl.uniform2f(u(progAdvect, 'uTexelSize'), velocity.read.texel[0], velocity.read.texel[1])
    gl.uniform1f(u(progAdvect, 'uDt'), dt)
    gl.uniform1f(u(progAdvect, 'uDissipation'), VELOCITY_DISSIPATION)
    gl.uniform1i(u(progAdvect, 'uVelocity'), bindTex(velocity.read.tex, 0))
    gl.uniform1i(u(progAdvect, 'uSource'), bindTex(velocity.read.tex, 0))
    blit(velocity.write)
    velocity.swap()

    gl.useProgram(progDiv)
    gl.uniform2f(u(progDiv, 'uTexelSize'), velocity.read.texel[0], velocity.read.texel[1])
    gl.uniform1i(u(progDiv, 'uVelocity'), bindTex(velocity.read.tex, 0))
    blit(divergence)

    gl.useProgram(progPressure)
    gl.uniform2f(u(progPressure, 'uTexelSize'), pressure.read.texel[0], pressure.read.texel[1])
    gl.uniform1i(u(progPressure, 'uDivergence'), bindTex(divergence.tex, 1))
    for (let i = 0; i < PRESSURE_ITERS; i++) {
      gl.uniform1i(u(progPressure, 'uPressure'), bindTex(pressure.read.tex, 0))
      blit(pressure.write)
      pressure.swap()
    }

    gl.useProgram(progGradient)
    gl.uniform2f(u(progGradient, 'uTexelSize'), pressure.read.texel[0], pressure.read.texel[1])
    gl.uniform1i(u(progGradient, 'uPressure'), bindTex(pressure.read.tex, 0))
    gl.uniform1i(u(progGradient, 'uVelocity'), bindTex(velocity.read.tex, 1))
    blit(velocity.write)
    velocity.swap()

    // Advect the ink through the projected field.
    gl.useProgram(progAdvect)
    gl.uniform2f(u(progAdvect, 'uTexelSize'), velocity.read.texel[0], velocity.read.texel[1])
    gl.uniform1f(u(progAdvect, 'uDt'), dt)
    gl.uniform1f(u(progAdvect, 'uDissipation'), DYE_DISSIPATION)
    gl.uniform1i(u(progAdvect, 'uVelocity'), bindTex(velocity.read.tex, 0))
    gl.uniform1i(u(progAdvect, 'uSource'), bindTex(dye.read.tex, 1))
    blit(dye.write)
    dye.swap()

    // Composite: premultiplied ink over the transparent canvas.
    gl.useProgram(progDisplay)
    gl.uniform3f(u(progDisplay, 'uTint'), 232 / 255, 224 / 255, 210 / 255)
    gl.uniform1i(u(progDisplay, 'uDye'), bindTex(dye.read.tex, 0))
    blit(null)

    if (dead) return
    if (now - lastMove < IDLE_STOP_MS) raf = requestAnimationFrame(step)
    else {
      // Ink has long since dissipated; stop burning GPU and clear.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      raf = 0
    }
  }

  const wake = () => {
    if (!raf && !dead) {
      lastFrame = performance.now()
      raf = requestAnimationFrame(step)
    }
  }

  return true
}
