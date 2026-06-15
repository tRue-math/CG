import './style.css'
import { createFluidPrepScene } from './scene/createFluidPrepScene'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Could not find #app element.')
}

createFluidPrepScene({ app })