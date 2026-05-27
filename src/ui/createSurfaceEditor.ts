import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { bezierCols, bezierRows, buildBezierSurfaceGeometries } from '../surfaces/bezierSurface'

type SurfaceEditorOptions = {
  app: HTMLDivElement
}

export function createSurfaceEditor(options: SurfaceEditorOptions) {
  const state = {
    resolution: 20,
    showControlPoints: true,
    showControlNet: true,
    showSurface: true,
    showWire: true,
  }

  const shell = document.createElement('div')
  shell.className = 'shell'
  options.app.appendChild(shell)

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

  const settingsTitle = document.createElement('div')
  settingsTitle.className = 'panel-subtitle'
  settingsTitle.textContent = 'View settings'
  panel.appendChild(settingsTitle)

  const resolutionField = document.createElement('label')
  resolutionField.className = 'setting-row'

  const resolutionLabel = document.createElement('span')
  resolutionLabel.textContent = 'RES'

  const resolutionValue = document.createElement('span')
  resolutionValue.textContent = String(state.resolution)

  const resolutionInput = document.createElement('input')
  resolutionInput.type = 'range'
  resolutionInput.min = '4'
  resolutionInput.max = '64'
  resolutionInput.step = '1'
  resolutionInput.value = String(state.resolution)

  resolutionInput.addEventListener('input', () => {
    state.resolution = Number(resolutionInput.value)
    resolutionValue.textContent = resolutionInput.value
    rebuildSurface()
    renderScene()
  })

  resolutionField.appendChild(resolutionLabel)
  resolutionField.appendChild(resolutionValue)
  resolutionField.appendChild(resolutionInput)
  panel.appendChild(resolutionField)

  function createToggle(labelText: string, checked: boolean, onChange: (value: boolean) => void) {
    const row = document.createElement('label')
    row.className = 'setting-toggle'

    const label = document.createElement('span')
    label.textContent = labelText

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = checked
    input.addEventListener('change', () => onChange(input.checked))

    row.appendChild(label)
    row.appendChild(input)
    panel.appendChild(row)
  }

  createToggle('Control points', state.showControlPoints, (value) => {
    state.showControlPoints = value
    pointMeshes.forEach((mesh) => {
      mesh.visible = value
    })
    renderScene()
  })

  createToggle('Control net', state.showControlNet, (value) => {
    state.showControlNet = value
    controlNet.visible = value
    renderScene()
  })

  createToggle('Surface fill', state.showSurface, (value) => {
    state.showSurface = value
    surfaceMesh.visible = value
    renderScene()
  })

  createToggle('Surface wire', state.showWire, (value) => {
    state.showWire = value
    surfaceWire.visible = value
    renderScene()
  })

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

  scene.add(new THREE.AxesHelper(1.2))

  const grid = new THREE.GridHelper(4, 4, 0x4a5568, 0x243041)
  grid.rotation.x = Math.PI / 2
  grid.position.set(1.5, 1.5, 0)
  scene.add(grid)

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

  for (let j = 0; j < bezierRows; j++) {
    for (let i = 0; i < bezierCols; i++) {
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

  const surfaceMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x6be37a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      roughness: 0.55,
      metalness: 0.05,
    }),
  )
  scene.add(surfaceMesh)

  const surfaceWire = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x94ffd0, transparent: true, opacity: 0.7 }),
  )
  scene.add(surfaceWire)

  function getControlGrid(): THREE.Vector3[][] {
    const gridPoints: THREE.Vector3[][] = []
    for (let j = 0; j < bezierRows; j++) {
      const row: THREE.Vector3[] = []
      for (let i = 0; i < bezierCols; i++) {
        row.push(pointMeshes[j * bezierCols + i].position.clone())
      }
      gridPoints.push(row)
    }
    return gridPoints
  }

  function rebuildControlNet() {
    const positions: number[] = []
    const pushSegment = (a: THREE.Vector3, b: THREE.Vector3) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }

    for (let j = 0; j < bezierRows; j++) {
      for (let i = 0; i < bezierCols - 1; i++) {
        pushSegment(pointMeshes[j * bezierCols + i].position, pointMeshes[j * bezierCols + i + 1].position)
      }
    }

    for (let i = 0; i < bezierCols; i++) {
      for (let j = 0; j < bezierRows - 1; j++) {
        pushSegment(pointMeshes[j * bezierCols + i].position, pointMeshes[(j + 1) * bezierCols + i].position)
      }
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    if (controlNet.geometry) controlNet.geometry.dispose()
    controlNet.geometry = geom
  }

  function rebuildSurface() {
    const controlGrid = getControlGrid()
    const { surface, wire } = buildBezierSurfaceGeometries(controlGrid, state.resolution)

    if (surfaceWire.geometry) surfaceWire.geometry.dispose()
    surfaceWire.geometry = wire

    if (surfaceMesh.geometry) surfaceMesh.geometry.dispose()
    surfaceMesh.geometry = surface
  }

  function renderScene() {
    renderer.render(scene, camera)
  }

  function updatePointZ(index: number, z: number) {
    pointMeshes[index].position.z = z
    rebuildControlNet()
    rebuildSurface()
    renderScene()
  }

  for (let j = 0; j < bezierRows; j++) {
    for (let i = 0; i < bezierCols; i++) {
      const index = j * bezierCols + i
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
        updatePointZ(index, Number(input.value))
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
    rebuildSurface()
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
  rebuildSurface()
  resizeRenderer()
}
