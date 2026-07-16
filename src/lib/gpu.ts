let cached: boolean | null = null

/**
 * True when the browser has real hardware WebGL. Software rasterizers
 * (SwiftShader, llvmpipe — VMs, remote desktops, throttled audits) take
 * seconds to compile shaders and paint; those environments get the calm
 * no-WebGL page instead of a slideshow.
 */
export function hasHardwareWebGL(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true })
    if (!gl) {
      cached = false
      return cached
    }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    cached = !/swiftshader|software|llvmpipe|basic render/i.test(renderer)
  } catch {
    cached = false
  }
  return cached
}
