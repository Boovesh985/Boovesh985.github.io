import { Mesh, NoToneMapping, OrthographicCamera, PMREMGenerator, Scene } from 'three'

// Helpers that keep heavy WebGL setup from freezing the page.

// Give the main thread back so the browser can paint and scroll between build steps.
export const yieldToMain = () =>
  new Promise((resolve) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(resolve) : setTimeout(resolve, 0)))

// Wait for a quiet moment (no input, nothing animating heavily), or at most `timeout` ms.
export const idle = (timeout = 1500) =>
  new Promise((resolve) => (window.requestIdleCallback ? requestIdleCallback(resolve, { timeout }) : setTimeout(resolve, 200)))

// Compile every shader in the scene without blocking (KHR_parallel_shader_compile).
// `target` must match where the scene will really be drawn: it changes the program's output encoding.
export function precompile(renderer, scene, camera, target = null) {
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(target)
  const done = renderer.compileAsync(scene, camera)
  renderer.setRenderTarget(prev)
  return done
}

// Reading shader logs forces a synchronous wait on the GPU driver; only do it while developing.
export function quietShaders(renderer) {
  renderer.debug.checkShaderErrors = import.meta.env.DEV
}

// Prefiltered reflections (PMREM) from a small scene, with the filter shaders compiled in parallel
// first; the stock fromScene() compiles them synchronously and froze the page for most of a second.
// Leans on PMREMGenerator internals (pinned three version).
export async function bakeEnv(renderer, envScene, sigma = 0, size = 256) {
  const pm = new PMREMGenerator(renderer)
  pm._setSize(size)
  const target = pm._allocateTargets()
  const filters = new Scene()
  const plane = pm._lodMeshes[0].geometry // the program key depends on the geometry having positions
  filters.add(new Mesh(plane, pm._ggxMaterial), new Mesh(plane, pm._blurMaterial))
  const cam = new OrthographicCamera()
  const tone = renderer.toneMapping
  renderer.toneMapping = NoToneMapping // the cube faces are drawn without tone mapping
  const compiled = Promise.all([precompile(renderer, filters, cam, target), precompile(renderer, envScene, cam, target)])
  renderer.toneMapping = tone
  await compiled
  target.dispose()
  await yieldToMain()
  const tex = pm.fromScene(envScene, sigma, 0.1, 100, { size }).texture
  pm.dispose()
  return tex
}
