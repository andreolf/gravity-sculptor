/**
 * Physics - GPU-friendly particle physics simulation
 * Uses typed arrays for maximum performance
 */

export class Physics {
  constructor(particleCount = 12000) {
    this.count = particleCount;
    
    // Particle state arrays (SOA for cache efficiency)
    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.accelerations = new Float32Array(particleCount * 3);
    
    // Per-particle properties
    this.masses = new Float32Array(particleCount);
    this.lifetimes = new Float32Array(particleCount);
    
    // Physics constants
    this.G = 0.00015; // Gravitational constant (tuned for visual appeal)
    this.drag = 0.995; // Velocity damping per frame
    this.maxVelocity = 0.08; // Velocity clamp to prevent particle loss
    this.minDistance = 0.05; // Softening to prevent singularities
    this.fieldRadius = 2.5; // Gravity influence radius
    
    // Chaos mode
    this.chaosMode = false;
    this.chaosFactor = 1.0;
    
    // Attract/Repel mode
    this.attractMode = true; // true = attract, false = repel
    
    // Initialize particles
    this.initParticles();
  }

  initParticles() {
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      
      // Spawn spread across visible area - center biased
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.5; // Closer to center for visibility
      
      this.positions[i3] = Math.cos(angle) * radius;
      this.positions[i3 + 1] = Math.sin(angle) * radius * 0.8;
      this.positions[i3 + 2] = 0; // Keep all particles at z=0 (in front of webcam at z=-2)
      
      // Slow random drift - particles stay spread out until hands interact
      const driftSpeed = 0.001;
      this.velocities[i3] = (Math.random() - 0.5) * driftSpeed;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * driftSpeed;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.0002;
      
      // Random mass affects gravity response
      this.masses[i] = 0.5 + Math.random() * 0.5;
      
      // Lifetime for subtle respawn effects
      this.lifetimes[i] = Math.random();
    }
  }

  /**
   * Main physics update - called every frame
   * @param {Array} gravityWells - Array of { x, y, z, strength }
   * @param {Array} velocities - Hand velocities for slingshot
   * @param {number} dt - Delta time (normalized to 60fps)
   * @param {Array} pathForces - Drawing path points for art mode
   */
  update(gravityWells = [], handVelocities = [], dt = 1, pathForces = []) {
    const G = this.G * (this.chaosMode ? this.chaosFactor * 2 : 1);
    const drag = this.drag;
    const maxV = this.maxVelocity;
    const minDist = this.minDistance;
    const fieldR = this.fieldRadius;
    
    // Precompute well positions (convert from normalized to world space)
    const wells = gravityWells.map((w, idx) => ({
      x: w.x * 1.5, // Scale to match scene
      y: w.y * 1.2,
      z: w.z * 0.5,
      strength: w.strength,
      vx: handVelocities[idx]?.vx || 0,
      vy: handVelocities[idx]?.vy || 0
    }));

    // Calculate merged gravity when hands are close
    let mergedWell = null;
    if (wells.length === 2) {
      const dx = wells[0].x - wells[1].x;
      const dy = wells[0].y - wells[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 0.5) {
        // Merge into single stronger well
        const mergeFactor = 1 - (dist / 0.5);
        mergedWell = {
          x: (wells[0].x + wells[1].x) / 2,
          y: (wells[0].y + wells[1].y) / 2,
          z: (wells[0].z + wells[1].z) / 2,
          strength: (wells[0].strength + wells[1].strength) * (1 + mergeFactor * 0.5),
          vx: (wells[0].vx + wells[1].vx) / 2,
          vy: (wells[0].vy + wells[1].vy) / 2
        };
      }
    }

    // Update each particle
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      
      let ax = 0, ay = 0, az = 0;
      
      // Apply gravity from each well
      const effectiveWells = mergedWell ? [mergedWell] : wells;
      
      for (const well of effectiveWells) {
        const dx = well.x - this.positions[i3];
        const dy = well.y - this.positions[i3 + 1];
        const dz = well.z - this.positions[i3 + 2];
        
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        
        if (dist < fieldR) {
          // Softened inverse-square gravity
          const softDist = Math.max(dist, minDist);
          const force = (G * well.strength) / (softDist * softDist);
          
          // Normalize and apply force (negative for repulsion)
          const invDist = 1 / dist;
          const direction = this.attractMode ? 1 : -1;
          ax += dx * invDist * force * direction;
          ay += dy * invDist * force * direction;
          az += dz * invDist * force * direction;
          
          // Slingshot effect: rapid hand movement adds velocity
          const handSpeed = Math.sqrt(well.vx * well.vx + well.vy * well.vy);
          if (handSpeed > 0.01 && dist < 0.5) {
            const slingshotForce = handSpeed * 0.5 * (1 - dist / 0.5);
            ax += well.vx * slingshotForce;
            ay += well.vy * slingshotForce;
          }
        }
      }
      
      // NO central attraction when no hands - free floating
      // Particles only respond to hand gestures
      
      // Apply path forces (drawing/art mode) - stronger attraction
      if (pathForces.length > 0) {
        const now = Date.now();
        for (const point of pathForces) {
          const age = (now - point.time) / 8000; // 8 second fade
          if (age < 1) {
            const strength = (1 - age) * 0.0005; // Stronger attraction
            const dx = point.x - this.positions[i3];
            const dy = point.y - this.positions[i3 + 1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 0.6 && dist > 0.01) { // Larger attraction range
              const force = strength / (dist + 0.03);
              ax += (dx / dist) * force;
              ay += (dy / dist) * force;
            }
          }
        }
      }
      
      // Add subtle turbulence in chaos mode
      if (this.chaosMode) {
        ax += (Math.random() - 0.5) * 0.0002;
        ay += (Math.random() - 0.5) * 0.0002;
      }
      
      // Integrate velocity
      this.velocities[i3] = (this.velocities[i3] + ax * dt) * drag;
      this.velocities[i3 + 1] = (this.velocities[i3 + 1] + ay * dt) * drag;
      this.velocities[i3 + 2] = (this.velocities[i3 + 2] + az * dt) * drag;
      
      // Clamp velocity
      const vx = this.velocities[i3];
      const vy = this.velocities[i3 + 1];
      const vz = this.velocities[i3 + 2];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      
      if (speed > maxV) {
        const scale = maxV / speed;
        this.velocities[i3] *= scale;
        this.velocities[i3 + 1] *= scale;
        this.velocities[i3 + 2] *= scale;
      }
      
      // Integrate position
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;
      
      // Respawn particles that escape bounds
      const px = this.positions[i3];
      const py = this.positions[i3 + 1];
      if (px * px + py * py > 16) { // Beyond radius 4
        this.respawnParticle(i);
      }
      
      // Update lifetime
      this.lifetimes[i] = Math.min(1, this.lifetimes[i] + 0.001);
    }
  }

  respawnParticle(i) {
    const i3 = i * 3;
    
    // Respawn near center with slight randomness
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.1 + Math.random() * 0.3;
    
    this.positions[i3] = Math.cos(angle) * radius;
    this.positions[i3 + 1] = Math.sin(angle) * radius;
    this.positions[i3 + 2] = (Math.random() - 0.5) * 0.1;
    
    this.velocities[i3] = (Math.random() - 0.5) * 0.01;
    this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
    this.velocities[i3 + 2] = 0;
    
    this.lifetimes[i] = 0;
  }

  toggleChaosMode() {
    this.chaosMode = !this.chaosMode;
    this.chaosFactor = this.chaosMode ? 3 : 1;
    return this.chaosMode;
  }
  
  /**
   * Apply explosion force from a point (palm opening gesture)
   */
  applyExplosion(x, y, strength = 1.0) {
    const worldX = x * 1.5;
    const worldY = y * 1.2;
    const explosionForce = 0.08 * strength;
    const explosionRadius = 1.5;
    
    console.log(`💥 Applying explosion at (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
    
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      
      const dx = this.positions[i3] - worldX;
      const dy = this.positions[i3 + 1] - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < explosionRadius && dist > 0.01) {
        // Force decreases with distance
        const force = explosionForce * (1 - dist / explosionRadius);
        const invDist = 1 / dist;
        
        this.velocities[i3] += dx * invDist * force;
        this.velocities[i3 + 1] += dy * invDist * force;
      }
    }
  }
  
  /**
   * Apply implosion force to a point (fist closing gesture)
   */
  applyImplosion(x, y, strength = 1.0) {
    const worldX = x * 1.5;
    const worldY = y * 1.2;
    const implosionForce = 0.06 * strength;
    const implosionRadius = 2.0;
    
    console.log(`🌀 Applying implosion at (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
    
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      
      const dx = worldX - this.positions[i3];
      const dy = worldY - this.positions[i3 + 1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < implosionRadius && dist > 0.01) {
        // Force increases toward center
        const force = implosionForce * (1 - dist / implosionRadius);
        const invDist = 1 / dist;
        
        this.velocities[i3] += dx * invDist * force;
        this.velocities[i3 + 1] += dy * invDist * force;
      }
    }
  }

  /**
   * Get particle speeds for color/size modulation
   */
  getSpeeds() {
    const speeds = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      speeds[i] = Math.sqrt(
        this.velocities[i3] ** 2 +
        this.velocities[i3 + 1] ** 2 +
        this.velocities[i3 + 2] ** 2
      );
    }
    return speeds;
  }
}
