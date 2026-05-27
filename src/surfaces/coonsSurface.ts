import * as THREE from 'three'

export type ControlPointGrid = THREE.Vector3[][]

function catmullRom(t: number, positions: THREE.Vector3[]): THREE.Vector3 {
    // z座標のみをCatmull-Romスプラインで補間する
    const delta = 1 / (positions.length - 1)
    const i = Math.min(Math.max(1, Math.floor(t / delta)), positions.length - 3)
    const ratio = (t - i * delta) / delta
    const z = [positions[i - 1].z, positions[i].z, positions[i + 1].z, positions[i + 2].z]
    let l = [];
    for (let j = 0; j < 3; j++) {
        l[j] = (j - ratio) * z[j] + (ratio + 1 - j) * z[j + 1]
    }
    let q = [];
    for (let j = 0; j < 2; j++) {
        q[j] = (1 + j - ratio) / 2 * l[j] + (1 + ratio - j) / 2 * l[j + 1]
    }
    // x,y座標は線形補間
    const idx = Math.floor(t / delta)
    const r = (t - idx * delta) / delta
    const x = positions[idx].x * (1 - r) + positions[Math.ceil(t/delta)].x * r
    const y = positions[idx].y * (1 - r) + positions[Math.ceil(t/delta)].y * r
    return new THREE.Vector3(x, y, q[0] * Math.min(Math.max(0, (1 - ratio)), 1) + q[1] * Math.min(Math.max(0, ratio), 1))
}

export function buildCoonsSurfaceGeometries(grid: ControlPointGrid, resolution: number) {
    const c0 = grid[0]
    const c1 = grid[grid.length - 1]
    const d0 = grid.map(row => row[0])
    const d1 = grid.map(row => row[row.length - 1])

    const positions: number[] = []
    const indices: number[] = []
    const indexGrid: number[][] = []

    for (let i = 0; i <= resolution; i++) {
        indexGrid[i] = []
        const s = i / resolution
        const d0s = catmullRom(s, d0)
        const d1s = catmullRom(s, d1)
        for (let j = 0; j <= resolution; j++) {
            const t = j / resolution
            const c0t = catmullRom(t, c0)
            const c1t = catmullRom(t, c1)
            // 基準点を通る曲線を使っているため，バイリニア補完で使う値は基準点の座標をそのまま使う
            const point = new THREE.Vector3(
                (1 - s) * c0t.x + s * c1t.x + (1 - t) * d0s.x + t * d1s.x - ((1 - s) * (1 - t) * d0[0].x + s * (1 - t) * d0[d0.length - 1].x + (1 - s) * t * d1[0].x + s * t * d1[d1.length - 1].x),
                (1 - s) * c0t.y + s * c1t.y + (1 - t) * d0s.y + t * d1s.y - ((1 - s) * (1 - t) * d0[0].y + s * (1 - t) * d0[d0.length - 1].y + (1 - s) * t * d1[0].y + s * t * d1[d1.length - 1].y),
                (1 - s) * c0t.z + s * c1t.z + (1 - t) * d0s.z + t * d1s.z - ((1 - s) * (1 - t) * d0[0].z + s * (1 - t) * d0[d0.length - 1].z + (1 - s) * t * d1[0].z + s * t * d1[d1.length - 1].z)
            )
            indexGrid[i][j] = positions.length / 3
            positions.push(point.x, point.y, point.z)
        }
    }

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const a = indexGrid[i][j]
            const b = indexGrid[i + 1][j]
            const c = indexGrid[i + 1][j + 1]
            const d = indexGrid[i][j + 1]
            indices.push(a, b, d)
            indices.push(b, c, d)
        }
    }

    const surface = new THREE.BufferGeometry()
    surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    surface.setIndex(indices)

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
    wire.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3))

    return { surface, wire }
}
