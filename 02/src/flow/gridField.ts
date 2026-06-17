import * as THREE from 'three'

export type GridFieldBounds = {
  left: number
  right: number
  bottom: number
  top: number
}

export type GridCell = {
  position: THREE.Vector2
  velocity: THREE.Vector2
  density: number // 速度場メインですが、型の互換性のため残しています
}

export type GridField = {
  cells: GridCell[]
  step: (deltaSeconds: number, viscosity: number) => void
  sampleVelocityAt: (position: THREE.Vector2) => THREE.Vector2
}

function createCell(position: THREE.Vector2): GridCell {
  return {
    position,
    velocity: new THREE.Vector2(1, 0),
    density: 1, // 密度計算は行わないため固定値
  }
}

export function createGridField(bounds: GridFieldBounds, columns: number, rows: number): GridField {
  const cells: GridCell[] = []
  const fieldWidth = bounds.right - bounds.left
  const fieldHeight = bounds.top - bounds.bottom
  const stepX = fieldWidth / Math.max(columns - 1, 1)
  const stepY = fieldHeight / Math.max(rows - 1, 1)

  // --- Stable Fluids 用の1D配列 ---
  const numCells = columns * rows
  const u = new Float32Array(numCells)
  const v = new Float32Array(numCells)
  const u_prev = new Float32Array(numCells)
  const v_prev = new Float32Array(numCells)
  const obstacle = new Uint8Array(numCells)

  // 境界1セル分を引いた内部グリッドサイズ
  const N_X = columns - 2
  const N_Y = rows - 2
  const iter = 10 // ポアソンソルバの反復回数
  
  // 1次元配列のインデックス計算
  const IX = (i: number, j: number) => i + j * columns

  // セルの初期化と障害物の配置
  const cx = Math.floor(columns * 0.46)
  const cy = Math.floor(rows * 0.5)
  const obstacleRadius = 1.0

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = bounds.left + column * stepX
      const y = bounds.bottom + row * stepY
      cells.push(createCell(new THREE.Vector2(x, y)))

      const idx = IX(column, row)
      u[idx] = 1.0 // 最初から右向きに流しておく

      // 円柱状の障害物を配置
      const dx = column - cx
      const dy = row - cy
      if (row > 0 && row < rows - 1 && column > 0 && column < columns - 1) {
        if (dx * dx + dy * dy <= obstacleRadius * obstacleRadius) {
          obstacle[idx] = 1
          u[idx] = 0 // 障害物内部は速度ゼロ
        }
      }
    }
  }

  // --- 流体アルゴリズム関数群 ---

  function set_bnd(b: number, x: Float32Array) {
    // 固体壁 (上下端)
    for (let i = 1; i <= N_X; i++) {
      x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)]
      x[IX(i, rows - 1)] = b === 2 ? -x[IX(i, rows - 2)] : x[IX(i, rows - 2)]
    }
    // 流入・流出境界 (左右端)
    for (let j = 1; j <= N_Y; j++) {
      // 右端: ノイマン境界(自然流出)として1つ手前の速度をコピー
      x[IX(columns - 1, j)] = b === 1 ? x[IX(columns - 2, j)] : x[IX(columns - 2, j)]
    }

    // コーナー
    x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)])
    x[IX(0, rows - 1)] = 0.5 * (x[IX(1, rows - 1)] + x[IX(0, rows - 2)])
    x[IX(columns - 1, 0)] = 0.5 * (x[IX(columns - 2, 0)] + x[IX(columns - 1, 1)])
    x[IX(columns - 1, rows - 1)] = 0.5 * (x[IX(columns - 2, rows - 1)] + x[IX(columns - 1, rows - 2)])

    // 障害物境界
    for (let j = 1; j <= N_Y; j++) {
      for (let i = 1; i <= N_X; i++) {
        if (obstacle[IX(i, j)] === 1) {
          x[IX(i, j)] = 0
        }
      }
    }
  }

  function lin_solve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number) {
    for (let k = 0; k < iter; k++) {
      for (let j = 1; j <= N_Y; j++) {
        for (let i = 1; i <= N_X; i++) {
          if (obstacle[IX(i, j)] === 0) {
            x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) / c
          }
        }
      }
      set_bnd(b, x)
    }
  }

  function diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number, dt: number) {
    const a = dt * diff * N_X * N_Y
    lin_solve(b, x, x0, a, 1 + 4 * a)
  }

  function advect(b: number, d: Float32Array, d0: Float32Array, u_vel: Float32Array, v_vel: Float32Array, dt: number) {
    let i0, j0, i1, j1
    let x, y, s0, t0, s1, t1
    const dt0_x = dt * N_X
    const dt0_y = dt * N_Y

    for (let j = 1; j <= N_Y; j++) {
      for (let i = 1; i <= N_X; i++) {
        if (obstacle[IX(i, j)] === 1) continue

        x = i - dt0_x * u_vel[IX(i, j)]
        y = j - dt0_y * v_vel[IX(i, j)]

        if (x < 0.5) x = 0.5; if (x > columns - 1.5) x = columns - 1.5
        i0 = Math.floor(x); i1 = i0 + 1
        if (y < 0.5) y = 0.5; if (y > rows - 1.5) y = rows - 1.5
        j0 = Math.floor(y); j1 = j0 + 1

        s1 = x - i0; s0 = 1.0 - s1
        t1 = y - j0; t0 = 1.0 - t1

        d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
                      s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)])
      }
    }
    set_bnd(b, d)
  }

  function project(u_vel: Float32Array, v_vel: Float32Array, p: Float32Array, div: Float32Array) {
    for (let j = 1; j <= N_Y; j++) {
      for (let i = 1; i <= N_X; i++) {
        if (obstacle[IX(i, j)] === 1) {
          div[IX(i, j)] = 0
          p[IX(i, j)] = 0
          continue
        }
        div[IX(i, j)] = -0.5 * (u_vel[IX(i + 1, j)] - u_vel[IX(i - 1, j)] + v_vel[IX(i, j + 1)] - v_vel[IX(i, j - 1)])
        p[IX(i, j)] = 0
      }
    }
    set_bnd(0, div); set_bnd(0, p)

    lin_solve(0, p, div, 1, 4)

    for (let j = 1; j <= N_Y; j++) {
      for (let i = 1; i <= N_X; i++) {
        if (obstacle[IX(i, j)] === 1) continue
        u_vel[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)])
        v_vel[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)])
      }
    }
    set_bnd(1, u_vel); set_bnd(2, v_vel)
  }

  // --- メインステップ ---
  function step(deltaSeconds: number, viscosity: number) {
    // 描画フレームレートの低下で爆発しないようdtの上限をキャップ
    const dt = Math.min(deltaSeconds, 0.05) 
    
    const inflowSpeed = 1.0

    // 毎フレーム左端から一定の速度を流し込む
    for (let j = 1; j <= N_Y; j++) {
      u[IX(0, j)] = inflowSpeed
      u[IX(1, j)] = inflowSpeed
      v[IX(0, j)] = (Math.random() - 0.5) * inflowSpeed * 0.05
      v[IX(1, j)] = v[IX(0, j)]
    }

    // 速度場の更新ステップ
    diffuse(1, u_prev, u, viscosity, dt)
    diffuse(2, v_prev, v, viscosity, dt)

    project(u_prev, v_prev, u, v)

    advect(1, u, u_prev, u_prev, v_prev, dt)
    advect(2, v, v_prev, u_prev, v_prev, dt)

    project(u, v, u_prev, v_prev)

    // Three.js の cells 配列に計算結果を同期
    for (let index = 0; index < numCells; index++) {
      const cell = cells[index]
      if (obstacle[index] === 1) {
        cell.velocity.set(0, 0)
      } else {
        cell.velocity.set(u[index], v[index])
      }
    }
  }

  // sampleVelocityAt は既存のバイリニア補間実装をそのまま利用
  function sampleVelocityAt(position: THREE.Vector2) {
    const clampedX = THREE.MathUtils.clamp(position.x, bounds.left, bounds.right)
    const clampedY = THREE.MathUtils.clamp(position.y, bounds.bottom, bounds.top)

    const gridX = (clampedX - bounds.left) / Math.max(fieldWidth, 1e-4) * Math.max(columns - 1, 1)
    const gridY = (clampedY - bounds.bottom) / Math.max(fieldHeight, 1e-4) * Math.max(rows - 1, 1)

    const x0 = Math.floor(gridX)
    const y0 = Math.floor(gridY)
    const x1 = Math.min(x0 + 1, columns - 1)
    const y1 = Math.min(y0 + 1, rows - 1)
    const tx = gridX - x0
    const ty = gridY - y0

    const index00 = y0 * columns + x0
    const index10 = y0 * columns + x1
    const index01 = y1 * columns + x0
    const index11 = y1 * columns + x1

    const v00 = cells[index00]?.velocity ?? new THREE.Vector2(1, 0)
    const v10 = cells[index10]?.velocity ?? v00
    const v01 = cells[index01]?.velocity ?? v00
    const v11 = cells[index11]?.velocity ?? v00

    const top = v00.clone().lerp(v10, tx)
    const bottom = v01.clone().lerp(v11, tx)
    return top.lerp(bottom, ty)
  }

  return {
    cells,
    step,
    sampleVelocityAt,
  }
}