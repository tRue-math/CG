import './style.css'
import { createSurfaceEditor } from './ui/createSurfaceEditor'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Could not find #app element.')
}

createSurfaceEditor({ app })
