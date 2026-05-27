import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Could not find #app element.')
}

const shell = document.createElement('div')
shell.className = 'shell'
app.appendChild(shell)

const viewport = document.createElement('div')
viewport.className = 'viewport'
shell.appendChild(viewport)

const panel = document.createElement('aside')
panel.className = 'panel'
shell.appendChild(panel)

const info = document.createElement('div')
info.className = 'info'
info.textContent = 'Drag: rotate / Wheel: zoom / Right-drag: pan'
viewport.appendChild(info)

const panelTitle = document.createElement('div')
panelTitle.className = 'panel-title'
panelTitle.textContent = '4x4 control points'
panel.appendChild(panelTitle)

const panelText = document.createElement('p')
panelText.className = 'panel-text'
panelText.textContent = 'Each slider controls the z value of one control point. The points are fixed at (i, j, 0) for i, j = 0..3.'
panel.appendChild(panelText)

const resetButton = document.createElement('button')
resetButton.className = 'reset-button'
resetButton.textContent = 'Reset Z'
panel.appendChild(resetButton)

const sliderGrid = document.createElement('div')
sliderGrid.className = 'slider-grid'
panel.appendChild(sliderGrid)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x10171f)

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(1.5, 1.5, 8.5)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
viewport.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(1.5, 1.5, 0)
controls.update()

const keyLight = new THREE.DirectionalLight(0xffffff, 1.3)
keyLight.position.set(3, 4, 6)
scene.add(keyLight)

const fillLight = new THREE.AmbientLight(0xffffff, 0.45)
scene.add(fillLight)


const grid = new THREE.GridHelper(4, 4, 0x4a5568, 0x243041)
grid.rotation.x = Math.PI / 2
grid.position.set(1.5, 1.5, 0)
scene.add(grid)

const rows = 4
const cols = 4
const pointSpacing = 1

const basePositions: THREE.Vector3[] = []
const pointMeshes: THREE.Mesh[] = []
const sliderInputs: HTMLInputElement[] = []

const cpGeom = new THREE.SphereGeometry(0.08, 20, 16)
const cpMat = new THREE.MeshStandardMaterial({
  color: 0xff7b7b,
  roughness: 0.35,
  metalness: 0.08,
})

for (let j = 0; j < rows; j++) {
  for (let i = 0; i < cols; i++) {
    basePositions.push(new THREE.Vector3(i * pointSpacing, j * pointSpacing, 0))
  }
}

for (let index = 0; index < basePositions.length; index++) {
  const mesh = new THREE.Mesh(cpGeom, cpMat.clone())
  mesh.position.copy(basePositions[index])
  scene.add(mesh)
  pointMeshes.push(mesh)
}

const controlNet = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x7ee6ff, transparent: true, opacity: 0.55 }),
)
scene.add(controlNet)

function rebuildControlNet() {
  const positions: number[] = []

  const pushSegment = (a: THREE.Vector3, b: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols - 1; i++) {
      pushSegment(pointMeshes[j * cols + i].position, pointMeshes[j * cols + i + 1].position)
    }
  }

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows - 1; j++) {
      pushSegment(pointMeshes[j * cols + i].position, pointMeshes[(j + 1) * cols + i].position)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  if (controlNet.geometry) controlNet.geometry.dispose()
  controlNet.geometry = geom
}

const bino_coeff = (n: number, k: number) : number => {
    if (k < 0 || k > n) return 0
    if (k > n - k) return bino_coeff(n, n - k)
    if (k === 0) return 1
    return (n - k + 1) * bino_coeff(n, k - 1) / k
}

const bernstein_poly = (n: number, i: number, t: number) : number => {
    return bino_coeff(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i)
}

const RES = 20

const surfacePoints: THREE.Vector3[][] = []


const surfaceNet = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x7ee6ff, transparent: true, opacity: 0.55 }),
)
scene.add(surfaceNet)

function rebuildSurfaceNet() {
    for (let x = 0; x <= RES; x++) {
        const u = x / RES
        surfacePoints[x] = []
        for (let y = 0; y <= RES; y++) {
            const v = y / RES
            const point = new THREE.Vector3(0, 0, 0)
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    point.x += pointMeshes[i * cols + j].position.x * bernstein_poly(rows - 1, i, u) * bernstein_poly(cols - 1, j, v)
                    point.y += pointMeshes[i * cols + j].position.y * bernstein_poly(rows - 1, i, u) * bernstein_poly(cols - 1, j, v)
                    point.z += pointMeshes[i * cols + j].position.z * bernstein_poly(rows - 1, i, u) * bernstein_poly(cols - 1, j, v)
                }
            }
            surfacePoints[x][y] = point
        }
    }
  const positions: number[] = []

  const pushSegment = (a: THREE.Vector3, b: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }

  for (let i = 0; i<= RES; i++) {
    for (let j = 0; j <= RES; j++) {
        j<RES && pushSegment(surfacePoints[i][j], surfacePoints[i][j + 1])
        i<RES && pushSegment(surfacePoints[i][j], surfacePoints[i + 1][j])
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  if (surfaceNet.geometry) surfaceNet.geometry.dispose()
  surfaceNet.geometry = geom
}

function renderScene() {
  renderer.render(scene, camera)
}

function setPointZ(index: number, z: number) {
  pointMeshes[index].position.z = z
  rebuildControlNet()
  rebuildSurfaceNet()
  renderScene()
}

for (let j = 0; j < rows; j++) {
  for (let i = 0; i < cols; i++) {
    const index = j * cols + i
    const cell = document.createElement('label')
    cell.className = 'slider-cell'

    const label = document.createElement('div')
    label.className = 'slider-cell-label'
    label.textContent = `P${i}${j}`

    const value = document.createElement('div')
    value.className = 'slider-cell-value'
    value.textContent = '0.00'

    const input = document.createElement('input')
    input.type = 'range'
    input.min = '-1.5'
    input.max = '1.5'
    input.step = '0.01'
    input.value = '0'
    input.addEventListener('input', () => {
      value.textContent = Number(input.value).toFixed(2)
      setPointZ(index, Number(input.value))
    })

    cell.appendChild(label)
    cell.appendChild(value)
    cell.appendChild(input)
    sliderGrid.appendChild(cell)
    sliderInputs[index] = input
  }
}

resetButton.addEventListener('click', () => {
  pointMeshes.forEach((point, index) => {
    point.position.set(basePositions[index].x, basePositions[index].y, 0)
    sliderInputs[index].value = '0'
  })
  rebuildControlNet()
  rebuildSurfaceNet()
  renderScene()
})

function resizeRenderer() {
  const width = viewport.clientWidth
  const height = viewport.clientHeight
  if (width === 0 || height === 0) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  renderScene()
}

const resizeObserver = new ResizeObserver(() => resizeRenderer())
resizeObserver.observe(viewport)

controls.addEventListener('change', renderScene)

rebuildControlNet()
rebuildSurfaceNet()
resizeRenderer()
