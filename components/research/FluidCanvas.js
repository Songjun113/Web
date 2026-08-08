import { useEffect, useRef } from 'react'

const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const fragmentSource = `
precision mediump float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;

float glow(vec2 p, vec2 c, float radius) {
  return radius / max(length(p - c), 0.025);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  vec2 mouse = (pointer * 2.0 - 1.0) * vec2(resolution.x / resolution.y, 1.0);
  float wave = sin(uv.x * 3.1 + time * .45) * cos(uv.y * 2.7 - time * .32);
  vec2 warped = uv + vec2(wave * .045, sin(uv.y * 4.0 + time) * .025);
  float a = glow(warped, mouse, .085);
  float b = glow(warped, vec2(sin(time * .17) * .9, cos(time * .13) * .55), .055);
  vec3 navy = vec3(.012, .025, .075);
  vec3 cyan = vec3(.16, .95, .78);
  vec3 violet = vec3(.30, .38, 1.0);
  vec3 color = navy + cyan * a * .13 + violet * b * .16;
  color += vec3(.03, .045, .09) * (wave + 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

export default function FluidCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    if (!canvas || reduceMotion || coarsePointer) return

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
    if (!gl) return
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource))
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const resolution = gl.getUniformLocation(program, 'resolution')
    const pointer = gl.getUniformLocation(program, 'pointer')
    const time = gl.getUniformLocation(program, 'time')
    const mouse = { x: 0.5, y: 0.5 }
    let frame = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.floor(canvas.clientWidth * ratio)
      canvas.height = Math.floor(canvas.clientHeight * ratio)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    const move = event => {
      mouse.x = event.clientX / window.innerWidth
      mouse.y = 1 - event.clientY / window.innerHeight
    }
    const render = now => {
      gl.uniform2f(resolution, canvas.width, canvas.height)
      gl.uniform2f(pointer, mouse.x, mouse.y)
      gl.uniform1f(time, now * 0.001)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      frame = requestAnimationFrame(render)
    }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move, { passive: true })
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', move)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden='true' className='research-fluid-canvas' />
}
