import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createParticleField } from '../flow/particleField'
import { createVelocityField } from '../flow/velocityField'

type FluidPrepSceneOptions = {
  app: HTMLDivElement
}

type Mode = 'particle' | 'grid'

export function createFluidPrepScene(options: FluidPrepSceneOptions) {
  const state = {
    mode: 'particle' as Mode,
    sampleColumns: 26,
    sampleRows: 16,
    velocityScale: 0.6,
    restDensity: 1,
    stiffness: 3.2,
    viscosity: 0.02,
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

  const panelTabs = document.createElement('div')
  panelTabs.className = 'panel-tabs'
  panel.appendChild(panelTabs)

  const panelContent = document.createElement('div')
  panelContent.className = 'panel-content'
  panel.appendChild(panelContent)

  const info = document.createElement('div')
  info.className = 'info'
  info.textContent = 'Wheel: zoom / Right-drag: pan / Arrows show velocity'
  viewport.appendChild(info)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x08111a)

  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  viewport.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  controls.enableRotate = false
  controls.update()

  const ambient = new THREE.AmbientLight(0xffffff, 0.55)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(4, 7, 5)
  keyLight.castShadow = true
  scene.add(keyLight)

  const rimLight = new THREE.DirectionalLight(0x6fe1ff, 0.7)
  rimLight.position.set(-4, 2, -5)
  scene.add(rimLight)

  const bounds = {
    left: -3.2,
    right: 3.2,
    bottom: -2.3,
    top: 2.3,
  }

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(bounds.right - bounds.left, bounds.top - bounds.bottom, 0.2)),
    new THREE.LineBasicMaterial({ color: 0x93eeff, transparent: true, opacity: 0.35 }),
  )
  frame.position.set(0, 0, -0.1)
  scene.add(frame)

  const grid = new THREE.GridHelper(6.4, 16, 0x2f4256, 0x1d2a39)
  grid.rotation.x = Math.PI / 2
  grid.position.z = -0.08
  scene.add(grid)

  const particleField = createParticleField(bounds, 1000)
  const velocityField = createVelocityField(scene, bounds, state.sampleColumns, state.sampleRows, state.velocityScale)

  const tabs = [
    { id: 'particle' as const, label: 'Particle' },
    { id: 'grid' as const, label: 'Grid' },
  ]

  const tabButtons = new Map<Mode, HTMLButtonElement>()
  for (const tab of tabs) {
    const button = document.createElement('button')
    button.className = 'panel-tab'
    button.type = 'button'
    button.textContent = tab.label
    button.dataset.mode = tab.id
    button.addEventListener('click', () => {
      state.mode = tab.id
      syncMode()
    })
    panelTabs.appendChild(button)
    tabButtons.set(tab.id, button)
  }

  const content = {
    particle: document.createElement('div'),
    grid: document.createElement('div'),
  }

  content.particle.className = 'panel-pane'
  content.grid.className = 'panel-pane'
  panelContent.appendChild(content.particle)
  panelContent.appendChild(content.grid)

  const particleTitle = document.createElement('div')
  particleTitle.className = 'panel-title'
  particleTitle.textContent = 'Particle flow'
  content.particle.appendChild(particleTitle)

  const particleDescription = document.createElement('p')
  particleDescription.className = 'panel-text'
  particleDescription.textContent = '1000 個の粒子を状態として持ち、SPH で速度を求めて流れを作ります。表示は速度場の矢印だけにしています。'
  content.particle.appendChild(particleDescription)

  const particleMeta = document.createElement('div')
  particleMeta.className = 'status-card'
  content.particle.appendChild(particleMeta)

  const particleStateNote = document.createElement('div')
  particleStateNote.className = 'status-note'
  particleStateNote.textContent = '画面外へ出た粒子は消え、左端から右向きの粒子が補充されます。'
  particleMeta.appendChild(particleStateNote)

  const settingsTitle = document.createElement('div')
  settingsTitle.className = 'panel-subtitle'
  settingsTitle.textContent = 'Display settings'
  content.particle.appendChild(settingsTitle)

  const settings = [
    { label: 'Rest Density', value: state.restDensity, min: 0.5, max: 1.5, step: 0.05, apply: (value: number) => (state.restDensity = value) },
    { label: 'Stiffness', value: state.stiffness, min: 1.0, max: 5.0, step: 0.05, apply: (value: number) => (state.stiffness = value) },
    { label: 'Viscosity', value: state.viscosity, min: 0.005, max: 0.05, step: 0.001, apply: (value: number) => (state.viscosity = value) },
  ]

  for (const setting of settings) {
    const row = document.createElement('label')
    row.className = 'setting-row'

    const left = document.createElement('span')
    left.textContent = setting.label

    const value = document.createElement('span')
    value.textContent = setting.value.toFixed(3)

    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(setting.min)
    input.max = String(setting.max)
    input.step = String(setting.step)
    input.value = String(setting.value)
    input.addEventListener('input', () => {
      const next = Number(input.value)
      setting.apply(next)
      value.textContent = next.toFixed(3)
    })

    row.appendChild(left)
    row.appendChild(value)
    row.appendChild(input)
    content.particle.appendChild(row)
  }

  const gridTitle = document.createElement('div')
  gridTitle.className = 'panel-title'
  gridTitle.textContent = 'Grid mode'
  content.grid.appendChild(gridTitle)

  const gridDescription = document.createElement('p')
  gridDescription.className = 'panel-text'
  gridDescription.textContent = 'グリッド版は次の段階で実装します。今は切り替え先と設定枠だけを準備しています。'
  content.grid.appendChild(gridDescription)

  const gridCard = document.createElement('div')
  gridCard.className = 'status-card'
  content.grid.appendChild(gridCard)

  const gridStateLabel = document.createElement('div')
  gridStateLabel.className = 'status-label'
  gridStateLabel.textContent = 'Status'
  gridCard.appendChild(gridStateLabel)

  const gridStateValue = document.createElement('div')
  gridStateValue.className = 'status-value'
  gridStateValue.textContent = 'Placeholder ready'
  gridCard.appendChild(gridStateValue)

  const gridStateNote = document.createElement('div')
  gridStateNote.className = 'status-note'
  gridStateNote.textContent = 'Particle tab now renders a 2D velocity field instead of particles.'
  gridCard.appendChild(gridStateNote)

  const gridChecklist = document.createElement('div')
  gridChecklist.className = 'checklist'
  content.grid.appendChild(gridChecklist)

  const gridItems = [
    { title: 'Density field', body: '後で格子の密度を可視化する予定です。' },
    { title: 'Velocity field', body: '速度ベクトルの更新を追加する場所です。' },
    { title: 'Boundary solver', body: '壁との衝突と境界条件をここへ拡張します。' },
  ]

  for (const item of gridItems) {
    const row = document.createElement('div')
    row.className = 'check-item'

    const contentBox = document.createElement('div')
    const itemTitle = document.createElement('strong')
    itemTitle.textContent = item.title
    const itemBody = document.createElement('span')
    itemBody.textContent = item.body
    contentBox.appendChild(itemTitle)
    contentBox.appendChild(itemBody)

    row.appendChild(contentBox)
    gridChecklist.appendChild(row)
  }

  function syncMode() {
    for (const [mode, button] of tabButtons) {
      button.classList.toggle('is-active', mode === state.mode)
    }

    content.particle.hidden = state.mode !== 'particle'
    content.grid.hidden = state.mode !== 'grid'
    grid.visible = true
  }

  syncMode()

  const clock = new THREE.Clock()

  function resize() {
    const width = viewport.clientWidth
    const height = viewport.clientHeight

    const aspect = width / height
    const halfHeight = 3
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  function updateVelocityField() {
    velocityField.update((position) => particleField.sampleVelocityAt(position))
  }

  function updateParticles(deltaSeconds: number) {
    particleField.step(deltaSeconds, state.restDensity, state.stiffness, state.viscosity)
  }

  function animate() {
    const deltaSeconds = Math.min(clock.getDelta(), 0.033)

    if (state.mode === 'particle') {
      updateParticles(deltaSeconds)
      updateVelocityField()
    }

    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  window.addEventListener('resize', resize)
  resize()
  animate()
}