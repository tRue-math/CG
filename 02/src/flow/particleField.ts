import * as THREE from 'three'

export type Particle = {
  position: THREE.Vector2
  velocity: THREE.Vector2
  rho?: number
  pressure?: number
}

export type ParticleFieldBounds = {
  left: number
  right: number
  bottom: number
  top: number
}

export type ParticleField = {
  particles: Particle[]
  step: (deltaSeconds: number, restDensity: number, stiffness: number, viscosity: number) => void
  getParticleCount: () => number
  sampleVelocityAt: (position: THREE.Vector2) => THREE.Vector2
}

const smoothingRadius = 0.45

function kernel(distance: number): number {
    if (distance < 0 || distance >= smoothingRadius) {
        return 0
    }

    return 315 / (64 * Math.PI * Math.pow(smoothingRadius, 9)) * Math.pow(smoothingRadius * smoothingRadius - distance * distance, 3)
}

function kernelSpikyGradient(distance: number): number {
    if (distance < 0 || distance >= smoothingRadius) {
        return 0
    }
    return -30/ (Math.PI * Math.pow(smoothingRadius, 5)) * Math.pow(smoothingRadius - distance, 2)
}

function kernelViscosityLaplacian(distance: number): number {
    if (distance < 0 || distance >= smoothingRadius) {
        return 0
    }
    return 40 / (Math.PI * Math.pow(smoothingRadius, 5)) * (smoothingRadius - distance)
}

function createParticle(bounds: ParticleFieldBounds): Particle {
  return {
    position: new THREE.Vector2(bounds.left + 0.02, THREE.MathUtils.lerp(-1.8, 1.8, Math.random())),
    velocity: new THREE.Vector2(0.85 + Math.random() * 1.5, (Math.random() - 0.5) * 0.5),
  }
}

function computeSPHDensity(particles: Particle[], index: number): number {
    const particle = particles[index]
    let density = 0
    for (let j = 0; j < particles.length; j++) {
        density += kernel(particle.position.distanceTo(particles[j].position))
    }
    return density
}

function sampleSPHVelocity(particles: Particle[], position: THREE.Vector2): THREE.Vector2 {
  const accumulatedVelocity = new THREE.Vector2(0, 0)

  for (const particle of particles) {
    const offsetX = particle.position.x - position.x
    const offsetY = particle.position.y - position.y
    const distance = Math.hypot(offsetX, offsetY)

    if (distance < 0 || distance >= smoothingRadius) {
      continue
    }

    const kernel = 315 / (64 * Math.PI * Math.pow(smoothingRadius, 9)) * Math.pow(smoothingRadius * smoothingRadius - distance * distance, 3)
    
    accumulatedVelocity.addScaledVector(particle.velocity, kernel / particle.rho!)
  }

  return accumulatedVelocity
}

export function createParticleField(bounds: ParticleFieldBounds, count: number): ParticleField {
  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    particles.push(createParticle(bounds))
  }

  function respawnParticle(particle: Particle) {
    particle.position.set(bounds.left + 0.02, THREE.MathUtils.lerp(-1.8, 1.8, Math.random()))
    particle.velocity.set(0.85 + Math.random() * 1.5, (Math.random() - 0.5) * 0.5)
  }

  function step(deltaSeconds: number, restDensity: number, stiffness: number, viscosity: number) {
    const nextPositions = new Array<THREE.Vector2>(particles.length)
    const nextVelocities = new Array<THREE.Vector2>(particles.length)

    for (let index = 0; index < particles.length; index++) {
        particles[index].rho = computeSPHDensity(particles, index)
        particles[index].pressure = stiffness * Math.max(particles[index].rho! - restDensity, 0)
    }

    for (let index = 0; index < particles.length; index++) {
        // rho du/dt = -nabla p + mu nabla^2 u + rho f
        const particle = particles[index]
        const pressureForce = new THREE.Vector2(0, 0)
        const viscosityForce = new THREE.Vector2(0, 0)

        for (let j = 0; j < particles.length; j++) {
            pressureForce.addScaledVector(
                new THREE.Vector2().subVectors(particle.position, particles[j].position).normalize(),
                kernelSpikyGradient(particle.position.distanceTo(particles[j].position)) * (particle.pressure! + particles[j].pressure!) / (2 * particles[j].rho!)
            )

            viscosityForce.addScaledVector(
                new THREE.Vector2().subVectors(particles[j].velocity, particle.velocity),
                kernelViscosityLaplacian(particle.position.distanceTo(particles[j].position)) / particles[j].rho!
            )
        }

        const potentialForce =
            (Math.hypot(particle.position.x, particle.position.y) <= 1.0) ?
                particle.position : new THREE.Vector2(0, 0)

        nextVelocities[index] = new THREE.Vector2().addVectors(
            particle.velocity,
            pressureForce.addVectors(
                viscosityForce.multiplyScalar(viscosity),
                potentialForce.multiplyScalar(particle.rho!)
            ).multiplyScalar(deltaSeconds / particle.rho!)
        )

        nextPositions[index] = new THREE.Vector2().addVectors(
            particle.position,
            nextVelocities[index].clone().multiplyScalar(deltaSeconds)
        )
    }

    for (let index = 0; index < particles.length; index++) {
      const particle = particles[index]

      const nextPosition = nextPositions[index]
      if (!nextPosition) {
        continue
      }

      if (
        nextPosition.x < bounds.left ||
        nextPosition.x > bounds.right ||
        nextPosition.y < bounds.bottom ||
        nextPosition.y > bounds.top
      ) {
        respawnParticle(particle)
        continue
      }

      particle.position.copy(nextPosition)
    }
  }

  function getParticleCount() {
    return particles.length
  }

  function sampleVelocityAt(position: THREE.Vector2) {
    return sampleSPHVelocity(particles, position)
  }

  return {
    particles,
    step,
    getParticleCount,
    sampleVelocityAt,
  }
}