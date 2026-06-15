import * as THREE from 'three'

export const bezierRows = 4
export const bezierCols = 4

export type ControlPointGrid = THREE.Vector3[][]

export type BezierSurfaceGeometries = {
  surface: THREE.BufferGeometry
  wire: THREE.BufferGeometry
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1

  let result = 1
  for (let i = 1; i <= k; i++) {
    result = (result * (n - (k - i))) / i
  }
  return result
}

function bernstein(n: number, i: number, t: number): number {
  return binomial(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i)
}

export function evaluateBezierSurface(grid: ControlPointGrid, u: number, v: number): THREE.Vector3 {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const point = new THREE.Vector3(0, 0, 0)

  for (let i = 0; i < rows; i++) {
    const bu = bernstein(rows - 1, i, u)
    for (let j = 0; j < cols; j++) {
      const bv = bernstein(cols - 1, j, v)
      const weight = bu * bv
      point.x += grid[i][j].x * weight
      point.y += grid[i][j].y * weight
      point.z += grid[i][j].z * weight
    }
  }

  return point
}

export function buildBezierSurfaceGeometries(
  grid: ControlPointGrid,
  resolution: number,
): BezierSurfaceGeometries {
  const positions: number[] = []
  const indices: number[] = []
  const indexGrid: number[][] = []

  for (let i = 0; i <= resolution; i++) {
    indexGrid[i] = []
    const u = i / resolution
    for (let j = 0; j <= resolution; j++) {
      const v = j / resolution
      const point = evaluateBezierSurface(grid, u, v)
      indexGrid[i][j] = positions.length / 3
      positions.push(point.x, point.y, point.z)
    }
  }

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const a = indexGrid[i][j]
      const b = indexGrid[i + 1][j]
      const c = indexGrid[i][j + 1]
      const d = indexGrid[i + 1][j + 1]
      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  const surface = new THREE.BufferGeometry()
  surface.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  surface.setIndex(indices)
  surface.computeVertexNormals()

  const wirePositions: number[] = []
  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const a = indexGrid[i][j]
      const b = indexGrid[i][j + 1]
      wirePositions.push(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2])
      wirePositions.push(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2])
    }
  }
  for (let j = 0; j <= resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const a = indexGrid[i][j]
      const b = indexGrid[i + 1][j]
      wirePositions.push(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2])
      wirePositions.push(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2])
    }
  }

  const wire = new THREE.BufferGeometry()
  wire.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wirePositions), 3))

  return { surface, wire }
}
