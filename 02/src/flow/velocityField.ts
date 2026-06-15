import * as THREE from 'three'

export type VelocityFieldBounds = {
  left: number
  right: number
  bottom: number
  top: number
}

export type VelocityField = {
  arrows: THREE.ArrowHelper[]
  update: (getVelocity: (position: THREE.Vector2, index: number) => THREE.Vector2) => void
}

export function createVelocityField(
  scene: THREE.Scene,
  bounds: VelocityFieldBounds,
  columns: number,
  rows: number,
  arrowLength: number,
): VelocityField {
  const arrows: THREE.ArrowHelper[] = []
  const positions: THREE.Vector2[] = []
  const fieldWidth = bounds.right - bounds.left - 0.6
  const fieldHeight = bounds.top - bounds.bottom - 0.6
  const stepX = fieldWidth / Math.max(columns - 1, 1)
  const stepY = fieldHeight / Math.max(rows - 1, 1)

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = bounds.left + 0.3 + column * stepX
      const y = bounds.bottom + 0.3 + row * stepY
      positions.push(new THREE.Vector2(x, y))

      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(x, y, 0),
        arrowLength,
        0x8ff0ff,
        0.14,
        0.09,
      )
      scene.add(arrow)
      arrows.push(arrow)
    }
  }

  function update(getVelocity: (position: THREE.Vector2, index: number) => THREE.Vector2) {
    for (let index = 0; index < arrows.length; index++) {
      const position = positions[index]
      const velocity = getVelocity(position, index)
      const direction = new THREE.Vector3(velocity.x, velocity.y, 0)

      if (direction.lengthSq() === 0) {
        direction.set(1, 0, 0)
      } else {
        direction.normalize()
      }

      arrows[index].position.set(position.x, position.y, 0)
      arrows[index].setDirection(direction)
      arrows[index].setLength(Math.max(0.08, velocity.length() * arrowLength), 0.14, 0.09)
    }
  }

  return {
    arrows,
    update,
  }
}