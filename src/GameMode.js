/**
 * GameMode - Gamification system for Gravity Sculptor
 * Includes drawing mode, scoring, and challenges
 */

export class GameMode {
  constructor() {
    // Mode state
    this.currentMode = 'free'; // 'free', 'draw', 'collect', 'disperse', 'balance'
    this.isDrawing = false;
    
    // Drawing/Art system
    this.drawPath = []; // Array of {x, y, time} points
    this.pathMaxLength = 300; // More points for smoother trails
    this.pathFadeTime = 8000; // Longer fade time - 8 seconds
    this.brushSize = 0.5; // Larger brush for easier attraction
    
    // Score system
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.comboTimeout = 2000; // ms to maintain combo
    this.highScore = parseInt(localStorage.getItem('gravitySculptor_highScore') || '0');
    
    // Challenge system
    this.challengeActive = false;
    this.challengeTimer = 0;
    this.challengeDuration = 30000; // 30 seconds
    this.challengeGoal = 0;
    this.challengeProgress = 0;
    
    // Orbit detection
    this.orbitParticles = new Set();
    this.lastOrbitCheck = 0;
    
    // Art mode colors
    this.artColors = [
      { h: 0.55, s: 0.8, l: 0.6 },  // Cyan
      { h: 0.7, s: 0.8, l: 0.6 },   // Purple
      { h: 0.85, s: 0.8, l: 0.6 },  // Pink
      { h: 0.1, s: 0.9, l: 0.6 },   // Orange
      { h: 0.3, s: 0.8, l: 0.5 },   // Green
    ];
    this.currentColorIndex = 0;
  }

  /**
   * Add point to drawing path from hand position
   */
  addDrawPoint(x, y) {
    const now = Date.now();
    this.drawPath.push({ x, y, time: now, color: this.currentColorIndex });
    
    // Limit path length
    if (this.drawPath.length > this.pathMaxLength) {
      this.drawPath.shift();
    }
    
    // Award points for drawing
    this.addScore(1);
  }

  /**
   * Get active path points (remove faded ones)
   */
  getActivePath() {
    const now = Date.now();
    // Remove old points
    this.drawPath = this.drawPath.filter(p => now - p.time < this.pathFadeTime);
    return this.drawPath;
  }

  /**
   * Clear the drawing path
   */
  clearPath() {
    this.drawPath = [];
  }

  /**
   * Cycle through art colors
   */
  nextColor() {
    this.currentColorIndex = (this.currentColorIndex + 1) % this.artColors.length;
    return this.artColors[this.currentColorIndex];
  }

  /**
   * Add score with combo multiplier
   */
  addScore(points) {
    const now = Date.now();
    
    // Reset combo if too much time passed
    if (now - this.comboTimer > this.comboTimeout) {
      this.combo = 1;
    }
    
    this.score += points * this.combo;
    this.comboTimer = now;
    
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('gravitySculptor_highScore', this.highScore.toString());
    }
    
    return this.score;
  }

  /**
   * Increase combo multiplier
   */
  increaseCombo() {
    this.combo = Math.min(this.combo + 1, 10);
    this.comboTimer = Date.now();
    return this.combo;
  }

  /**
   * Start a challenge
   */
  startChallenge(type) {
    this.currentMode = type;
    this.challengeActive = true;
    this.challengeTimer = Date.now();
    this.challengeProgress = 0;
    
    switch (type) {
      case 'collect':
        this.challengeGoal = 80; // Get 80% of particles to center
        break;
      case 'disperse':
        this.challengeGoal = 70; // Spread 70% to edges
        break;
      case 'balance':
        this.challengeGoal = 60; // Maintain 60% even distribution for 5 seconds
        break;
    }
    
    return { goal: this.challengeGoal, duration: this.challengeDuration };
  }

  /**
   * Update challenge progress
   */
  updateChallenge(particles, count) {
    if (!this.challengeActive) return null;
    
    const elapsed = Date.now() - this.challengeTimer;
    const remaining = Math.max(0, this.challengeDuration - elapsed);
    
    // Check if time's up
    if (remaining <= 0) {
      const success = this.challengeProgress >= this.challengeGoal;
      this.endChallenge(success);
      return { completed: true, success, score: this.score };
    }
    
    // Calculate progress based on challenge type
    let centerCount = 0;
    let edgeCount = 0;
    const centerRadius = 0.5;
    const edgeRadius = 1.5;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = particles[i3];
      const y = particles[i3 + 1];
      const dist = Math.sqrt(x * x + y * y);
      
      if (dist < centerRadius) centerCount++;
      if (dist > edgeRadius) edgeCount++;
    }
    
    switch (this.currentMode) {
      case 'collect':
        this.challengeProgress = (centerCount / count) * 100;
        break;
      case 'disperse':
        this.challengeProgress = (edgeCount / count) * 100;
        break;
      case 'balance':
        // Check quadrant distribution
        const quadrants = [0, 0, 0, 0];
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const x = particles[i3];
          const y = particles[i3 + 1];
          if (x >= 0 && y >= 0) quadrants[0]++;
          else if (x < 0 && y >= 0) quadrants[1]++;
          else if (x < 0 && y < 0) quadrants[2]++;
          else quadrants[3]++;
        }
        const ideal = count / 4;
        const variance = quadrants.reduce((sum, q) => sum + Math.abs(q - ideal), 0) / count;
        this.challengeProgress = Math.max(0, 100 - variance * 200);
        break;
    }
    
    // Award points for progress
    if (this.challengeProgress >= this.challengeGoal) {
      this.addScore(10);
      this.increaseCombo();
    }
    
    return {
      progress: this.challengeProgress,
      goal: this.challengeGoal,
      remaining: remaining / 1000,
      combo: this.combo
    };
  }

  /**
   * End the current challenge
   */
  endChallenge(success) {
    if (success) {
      this.addScore(500 * this.combo);
    }
    this.challengeActive = false;
    this.currentMode = 'free';
    return { success, finalScore: this.score };
  }

  /**
   * Check for stable orbits (particles moving in circles)
   */
  detectOrbits(positions, velocities, count) {
    const now = Date.now();
    if (now - this.lastOrbitCheck < 500) return 0; // Check every 500ms
    this.lastOrbitCheck = now;
    
    let orbitingCount = 0;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = positions[i3];
      const y = positions[i3 + 1];
      const vx = velocities[i3];
      const vy = velocities[i3 + 1];
      
      const dist = Math.sqrt(x * x + y * y);
      const speed = Math.sqrt(vx * vx + vy * vy);
      
      // Check if velocity is roughly perpendicular to position (orbital motion)
      if (dist > 0.3 && speed > 0.001) {
        const dotProduct = (x * vx + y * vy) / (dist * speed);
        // If dot product is close to 0, motion is perpendicular (orbital)
        if (Math.abs(dotProduct) < 0.3) {
          orbitingCount++;
        }
      }
    }
    
    // Award points for orbits
    const orbitPercent = orbitingCount / count;
    if (orbitPercent > 0.3) {
      this.addScore(Math.floor(orbitPercent * 10));
      if (orbitPercent > 0.5) {
        this.increaseCombo();
      }
    }
    
    return orbitingCount;
  }

  /**
   * Get forces from drawing path for particles
   */
  getPathForces(px, py) {
    if (this.drawPath.length === 0) return { fx: 0, fy: 0 };
    
    let fx = 0, fy = 0;
    const now = Date.now();
    
    for (const point of this.drawPath) {
      const age = (now - point.time) / this.pathFadeTime;
      const strength = (1 - age) * 0.0001;
      
      const dx = point.x - px;
      const dy = point.y - py;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      if (dist < this.brushSize && dist > 0.01) {
        const force = strength / (dist + 0.05);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
    }
    
    return { fx, fy };
  }

  /**
   * Get current game state for UI
   */
  getState() {
    return {
      mode: this.currentMode,
      score: this.score,
      highScore: this.highScore,
      combo: this.combo,
      isDrawing: this.currentMode === 'draw',
      challengeActive: this.challengeActive,
      progress: this.challengeProgress,
      pathLength: this.drawPath.length
    };
  }

  /**
   * Reset score
   */
  resetScore() {
    this.score = 0;
    this.combo = 1;
  }

  /**
   * Set mode
   */
  setMode(mode) {
    this.currentMode = mode;
    if (mode !== 'draw') {
      this.clearPath();
    }
  }
}
