import { CanvasTexture, RepeatWrapping, Vector3 } from 'three'

const SIZE = 128
const BUMP_COUNT = 500
const BUMP_RADIUS_MIN = 1.5
const BUMP_RADIUS_MAX = 4
const NORMAL_STRENGTH = 3.5

// A druzy surface (a geode's crystal lining) reads as countless small
// sparkling points, which the low-poly bulge geometry doesn't have
// enough triangles to show (buildStellatedGeometry keeps detail low on
// purpose, for the bigger gem-cut facets - see its own comment). Rather
// than add far more polygons just to fake fine detail, this bakes a
// tileable normal map from a random scatter of tiny radial bumps, baked
// once at module load since it's a fixed procedural pattern with nothing
// chart-specific in it.
function buildHeightField(): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Each bump is drawn 3x3 (shifted by +/-SIZE) so it tiles seamlessly
  // across the canvas edges.
  for (let i = 0; i < BUMP_COUNT; i++) {
    const x = Math.random() * SIZE
    const y = Math.random() * SIZE
    const r = BUMP_RADIUS_MIN + Math.random() * (BUMP_RADIUS_MAX - BUMP_RADIUS_MIN)
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        const grad = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
        grad.addColorStop(0, 'rgba(255,255,255,0.85)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  const data = ctx.getImageData(0, 0, SIZE, SIZE).data
  const heights = new Float32Array(SIZE * SIZE)
  for (let i = 0; i < heights.length; i++) heights[i] = data[i * 4] / 255
  return heights
}

function buildNormalMapCanvas(heights: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(SIZE, SIZE)

  function heightAt(x: number, y: number): number {
    const xi = (x + SIZE) % SIZE
    const yi = (y + SIZE) % SIZE
    return heights[yi * SIZE + xi]
  }

  const normal = new Vector3()
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * NORMAL_STRENGTH
      const dy = (heightAt(x, y - 1) - heightAt(x, y + 1)) * NORMAL_STRENGTH
      normal.set(dx, dy, 1).normalize()
      const idx = (y * SIZE + x) * 4
      image.data[idx] = (normal.x * 0.5 + 0.5) * 255
      image.data[idx + 1] = (normal.y * 0.5 + 0.5) * 255
      image.data[idx + 2] = (normal.z * 0.5 + 0.5) * 255
      image.data[idx + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function createDruzyNormalMap(): CanvasTexture {
  const canvas = buildNormalMapCanvas(buildHeightField())
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // Tiled many times across the sphere's UV space so each repeat cell -
  // and therefore each little bump - stays small on screen.
  texture.repeat.set(28, 14)
  return texture
}

export const DRUZY_NORMAL_MAP = createDruzyNormalMap()
