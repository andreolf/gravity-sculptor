/**
 * Gravity Sculptor - Main Entry Point
 * 
 * A real-time particle simulation where hands act as gravity wells.
 * Visual-first experience meant to captivate within the first second.
 */

import { HandTracker } from './HandTracker.js';
import { Physics } from './Physics.js';
import { Renderer } from './Renderer.js';
import { GameMode } from './GameMode.js';

class GravitySculptor {
  constructor() {
    // Configuration
    this.config = {
      particleCount: 800, // Clean and distinct
      targetFPS: 60
    };
    
    // Adjustable parameters
    this.params = {
      gravityPower: 1.0,
      particleSpeed: 1.0,
      drag: 0.995,
      bloomIntensity: 1.0,
      attractMode: true, // true = attract, false = repel
      trailMode: false
    };
    
    // Core modules
    this.handTracker = null;
    this.physics = null;
    this.renderer = null;
    this.gameMode = null;
    
    // Performance tracking
    this.lastTime = 0;
    this.frameCount = 0;
    this.fps = 60;
    
    // State
    this.isRunning = false;
    this.chaosMode = false;
  }

  async init() {
    console.log('🌌 Initializing Gravity Sculptor...');
    
    // Get container
    const container = document.getElementById('canvas-container');
    
    // Initialize modules
    this.physics = new Physics(this.config.particleCount);
    this.renderer = new Renderer(container, this.config.particleCount);
    this.handTracker = new HandTracker();
    this.gameMode = new GameMode();
    
    // Initialize hand tracking (async, doesn't block)
    this.handTracker.init().then(() => {
      console.log('✋ Hand tracking ready');
    }).catch(err => {
      console.warn('Hand tracking unavailable, running in ambient mode');
    });
    
    // Set initial particle positions
    this.renderer.updatePositions(this.physics.positions);
    
    // Setup keyboard controls
    console.log('About to call setupControls');
    this.setupControls();
    console.log('setupControls complete');
    
    // Start animation loop
    this.isRunning = true;
    this.animate();
    
    console.log('✨ Gravity Sculptor ready');
  }

  setupControls() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        this.toggleChaos();
      }
      if (e.key === 'r' || e.key === 'R') {
        this.resetParticles();
      }
      if (e.key === ' ') {
        e.preventDefault();
      }
    });
    
    // Mouse drawing - works in draw mode
    this.isMouseDrawing = false;
    const canvas = document.getElementById('canvas-container');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => {
        if (this.gameMode.currentMode === 'draw') {
          this.isMouseDrawing = true;
          this.addMouseDrawPoint(e);
        }
      });
      canvas.addEventListener('mousemove', (e) => {
        if (this.isMouseDrawing && this.gameMode.currentMode === 'draw') {
          this.addMouseDrawPoint(e);
        }
      });
      canvas.addEventListener('mouseup', () => {
        this.isMouseDrawing = false;
      });
      canvas.addEventListener('mouseleave', () => {
        this.isMouseDrawing = false;
      });
      
      // Touch support for mobile
      canvas.addEventListener('touchstart', (e) => {
        if (this.gameMode.currentMode === 'draw') {
          this.isMouseDrawing = true;
          this.addTouchDrawPoint(e);
        }
      });
      canvas.addEventListener('touchmove', (e) => {
        if (this.isMouseDrawing && this.gameMode.currentMode === 'draw') {
          e.preventDefault();
          this.addTouchDrawPoint(e);
        }
      });
      canvas.addEventListener('touchend', () => {
        this.isMouseDrawing = false;
      });
    }
    
    // UI Panel Controls
    this.setupUIControls();
  }
  
  addMouseDrawPoint(e) {
    const rect = e.target.getBoundingClientRect();
    // Convert to normalized coordinates (-1 to 1)
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.gameMode.addDrawPoint(x * 1.5, y * 1.2);
  }
  
  addTouchDrawPoint(e) {
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((touch.clientY - rect.top) / rect.height) * 2 - 1);
    this.gameMode.addDrawPoint(x * 1.5, y * 1.2);
  }
  
  setupUIControls() {
    console.log('setupUIControls called');
    // Particle count slider
    const particlesSlider = document.getElementById('particles');
    if (particlesSlider) {
      particlesSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('particles-val').textContent = val;
        this.config.particleCount = val;
        // Reinitialize with new particle count
        this.physics = new Physics(val);
        this.renderer.reinitParticles(val);
      });
    }
    
    // Gravity slider
    const gravitySlider = document.getElementById('gravity');
    const gravityVal = document.getElementById('gravity-val');
    if (gravitySlider) {
      gravitySlider.addEventListener('input', (e) => {
        this.params.gravityPower = parseFloat(e.target.value);
        this.physics.G = 0.00015 * this.params.gravityPower;
        gravityVal.textContent = `${this.params.gravityPower.toFixed(1)}x`;
      });
    }
    
    // Speed slider
    const speedSlider = document.getElementById('speed');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        this.params.particleSpeed = parseFloat(e.target.value);
        speedVal.textContent = `${this.params.particleSpeed.toFixed(1)}x`;
      });
    }
    
    // Drag slider
    const dragSlider = document.getElementById('drag');
    const dragVal = document.getElementById('drag-val');
    if (dragSlider) {
      dragSlider.addEventListener('input', (e) => {
        this.params.drag = parseFloat(e.target.value);
        this.physics.drag = this.params.drag;
        dragVal.textContent = this.params.drag.toFixed(3);
      });
    }
    
    // Bloom slider
    const bloomSlider = document.getElementById('bloom');
    const bloomVal = document.getElementById('bloom-val');
    if (bloomSlider) {
      bloomSlider.addEventListener('input', (e) => {
        this.params.bloomIntensity = parseFloat(e.target.value);
        this.renderer.setBloomIntensity(this.params.bloomIntensity);
        bloomVal.textContent = `${this.params.bloomIntensity.toFixed(1)}x`;
      });
    }
    
    // Attract/Repel buttons
    const attractBtn = document.getElementById('attract-btn');
    const repelBtn = document.getElementById('repel-btn');
    if (attractBtn && repelBtn) {
      attractBtn.addEventListener('click', () => {
        this.params.attractMode = true;
        this.physics.attractMode = true;
        attractBtn.classList.add('active');
        repelBtn.classList.remove('active');
      });
      repelBtn.addEventListener('click', () => {
        this.params.attractMode = false;
        this.physics.attractMode = false;
        attractBtn.classList.remove('active');
        repelBtn.classList.add('active');
      });
    }
    
    // Chaos button
    const chaosBtn = document.getElementById('chaos-btn');
    if (chaosBtn) {
      chaosBtn.addEventListener('click', () => {
        this.toggleChaos();
        chaosBtn.classList.toggle('active', this.chaosMode);
      });
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.startFresh());
    }
    
    // Start Fresh button (prominent)
    const startFreshBtn = document.getElementById('start-fresh-btn');
    console.log('Start Fresh button found:', startFreshBtn);
    if (startFreshBtn) {
      startFreshBtn.addEventListener('click', () => {
        console.log('Start Fresh clicked!');
        this.startFresh();
      });
    }
    
    // Draw mode button
    const drawBtn = document.getElementById('draw-btn');
    console.log('Draw button found:', drawBtn);
    if (drawBtn) {
      drawBtn.addEventListener('click', () => {
        console.log('Draw Mode clicked!');
        const isDrawing = this.gameMode.currentMode === 'draw';
        console.log('Current mode:', this.gameMode.currentMode, 'isDrawing:', isDrawing);
        this.gameMode.setMode(isDrawing ? 'free' : 'draw');
        console.log('New mode:', this.gameMode.currentMode);
        drawBtn.classList.toggle('active', !isDrawing);
      });
    }
    
    // Clear path button
    const clearPathBtn = document.getElementById('clear-path-btn');
    console.log('Clear path button found:', clearPathBtn);
    if (clearPathBtn) {
      clearPathBtn.addEventListener('click', () => {
        console.log('Clear Drawing clicked!');
        this.gameMode.clearPath();
        // Also clear the visual trail in renderer
        if (this.renderer && this.renderer.updatePathTrail) {
          this.renderer.updatePathTrail([], this.gameMode.artColors);
        }
      });
    }
    
    // Color picker
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        e.target.classList.add('active');
        this.gameMode.currentColorIndex = parseInt(e.target.dataset.color);
      });
    });
    
    // Challenge buttons
    const collectBtn = document.getElementById('collect-btn');
    if (collectBtn) {
      collectBtn.addEventListener('click', () => this.startChallenge('collect'));
    }
    
    const disperseBtn = document.getElementById('disperse-btn');
    if (disperseBtn) {
      disperseBtn.addEventListener('click', () => this.startChallenge('disperse'));
    }
    
    const balanceBtn = document.getElementById('balance-btn');
    if (balanceBtn) {
      balanceBtn.addEventListener('click', () => this.startChallenge('balance'));
    }
    
    // Initialize score display
    this.updateScoreDisplay();
  }
  
  setAttractMode(attract) {
    this.params.attractMode = attract;
    this.physics.attractMode = attract;
    document.getElementById('attract-btn')?.classList.toggle('active', attract);
    document.getElementById('repel-btn')?.classList.toggle('active', !attract);
  }
  
  toggleDrawMode() {
    console.log('toggleDrawMode() called');
    const isDrawing = this.gameMode.currentMode === 'draw';
    console.log('toggleDrawMode - before:', this.gameMode.currentMode);
    this.gameMode.setMode(isDrawing ? 'free' : 'draw');
    console.log('toggleDrawMode - after:', this.gameMode.currentMode);
    document.getElementById('draw-btn')?.classList.toggle('active', !isDrawing);
  }
  
  clearDrawing() {
    console.log('clearDrawing() called');
    this.gameMode.clearPath();
    // Also clear visual trail
    if (this.renderer && this.renderer.updatePathTrail) {
      this.renderer.updatePathTrail([], this.gameMode.artColors);
    }
  }
  
  startFresh() {
    console.log('startFresh() called');
    this.resetParticles();
    this.gameMode.resetScore();
    this.gameMode.clearPath();
    this.gameMode.setMode('free');
    this.gameMode.challengeActive = false;
    
    // Reset UI state
    document.getElementById('challenge-display')?.classList.remove('active');
    document.getElementById('draw-btn')?.classList.remove('active');
    document.getElementById('chaos-btn')?.classList.remove('active');
    
    // Reset physics params
    this.chaosMode = false;
    this.physics.chaosMode = false;
    this.physics.attractMode = true;
    
    this.updateScoreDisplay();
  }
  
  startChallenge(type) {
    this.resetParticles();
    const challenge = this.gameMode.startChallenge(type);
    
    // Show challenge UI
    const display = document.getElementById('challenge-display');
    const title = document.getElementById('challenge-title');
    if (display && title) {
      display.classList.add('active');
      title.textContent = type.toUpperCase();
    }
  }
  
  updateScoreDisplay() {
    const state = this.gameMode.getState();
    
    const scoreEl = document.getElementById('score-value');
    const highScoreEl = document.getElementById('high-score-value');
    const comboEl = document.getElementById('combo-display');
    
    if (scoreEl) scoreEl.textContent = state.score.toLocaleString();
    if (highScoreEl) highScoreEl.textContent = state.highScore.toLocaleString();
    if (comboEl) {
      comboEl.textContent = `🔥 x${state.combo} Combo`;
      comboEl.classList.toggle('active', state.combo > 1);
    }
  }
  
  updateChallengeDisplay(result) {
    if (!result) return;
    
    const display = document.getElementById('challenge-display');
    const progress = document.getElementById('challenge-progress');
    const timer = document.getElementById('challenge-timer');
    
    if (result.completed) {
      if (display) display.classList.remove('active');
      return;
    }
    
    if (progress) progress.style.width = `${Math.min(100, result.progress)}%`;
    if (timer) timer.textContent = `${Math.ceil(result.remaining)}s`;
  }
  
  toggleChaos() {
    this.chaosMode = this.physics.toggleChaosMode();
    const baseBloom = this.params.bloomIntensity;
    this.renderer.setBloomIntensity(this.chaosMode ? baseBloom * 1.5 : baseBloom);
    const chaosBtn = document.getElementById('chaos-btn');
    if (chaosBtn) chaosBtn.classList.toggle('active', this.chaosMode);
  }
  
  resetParticles() {
    this.physics.initParticles();
  }

  animate() {
    if (!this.isRunning) return;
    
    requestAnimationFrame(() => this.animate());
    
    // Skip if renderer not ready
    if (!this.renderer || !this.renderer.renderer) return;
    
    // Calculate delta time for consistent physics
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 16.67, 2); // Normalize to 60fps, cap at 2x
    this.lastTime = now;
    
    // Get gravity wells from hands (with null check)
    const gravityWells = this.handTracker?.getGravityWells() || [];
    const handVelocities = this.handTracker?.getHandVelocities() || [];
    
    // Get gesture events and apply explosion/implosion effects
    const gestureEvents = this.handTracker?.getGestureEvents() || [];
    for (const event of gestureEvents) {
      if (event.type === 'EXPLOSION') {
        this.physics.applyExplosion(event.x, event.y, 1.5);
        this.gameMode.addScore(50); // Bonus for gesture
      } else if (event.type === 'IMPLODE') {
        this.physics.applyImplosion(event.x, event.y, 1.5);
        this.gameMode.addScore(30);
      }
    }
    
    // Update HUD with gesture info
    const gestures = this.handTracker?.getGestures() || [];
    this.updateHUD(gravityWells, gestures);
    
    // Get finger tips for drawing
    const fingerTips = this.handTracker?.getFingerTips() || [];
    const isDrawMode = this.gameMode?.currentMode === 'draw';
    
    // Update visual finger cursor
    if (this.renderer.updateFingerCursor) {
      this.renderer.updateFingerCursor(fingerTips, isDrawMode);
    }
    
    // Drawing mode: use ALL extended finger tips for multi-finger drawing
    if (isDrawMode) {
      for (const tip of fingerTips) {
        this.gameMode.addDrawPoint(tip.x * 1.8, tip.y * 1.4, tip.finger);
      }
    }
    
    // Get path forces for particles
    const pathForces = this.gameMode.currentMode === 'draw' ? 
      this.gameMode.getActivePath() : [];
    
    // Update physics with speed modifier and path forces
    this.physics.update(gravityWells, handVelocities, dt * this.params.particleSpeed, pathForces);
    
    // Detect orbits and award points
    const orbitCount = this.gameMode.detectOrbits(
      this.physics.positions, 
      this.physics.velocities, 
      this.config.particleCount
    );
    
    // Update challenge progress
    if (this.gameMode.challengeActive) {
      const result = this.gameMode.updateChallenge(
        this.physics.positions, 
        this.config.particleCount
      );
      this.updateChallengeDisplay(result);
    }
    
    // Update score display periodically
    if (this.frameCount % 10 === 0) {
      this.updateScoreDisplay();
    }
    
    // Update renderer
    this.renderer.updatePositions(this.physics.positions);
    
    // Update colors based on particle speeds
    const speeds = this.physics.getSpeeds();
    this.renderer.updateColors(speeds, gravityWells);
    
    // Draw the path trail
    if (pathForces.length > 0) {
      this.renderer.updatePathTrail(pathForces, this.gameMode.artColors);
    }
    
    // Render
    this.renderer.render();
    
    // FPS tracking
    this.frameCount++;
    if (this.frameCount % 30 === 0) {
      this.fps = Math.round(1000 / (performance.now() - this._lastFpsTime) * 30);
      this._lastFpsTime = performance.now();
      
      // Update FPS display
      const fpsEl = document.getElementById('fps-display');
      if (fpsEl) fpsEl.textContent = this.fps || 60;
    }
    if (!this._lastFpsTime) this._lastFpsTime = performance.now();
  }
  
  /**
   * Update the cyberpunk HUD overlay
   */
  updateHUD(gravityWells, gestures) {
    // Only update every few frames for performance
    if (this.frameCount % 5 !== 0) return;
    
    // Hand status
    const handStatusEl = document.getElementById('hand-status');
    if (handStatusEl) {
      if (gravityWells.length === 0) {
        handStatusEl.textContent = 'SCANNING...';
        handStatusEl.style.color = '#888';
      } else if (gravityWells.length === 1) {
        handStatusEl.textContent = '1 HAND DETECTED';
        handStatusEl.style.color = '#0f0';
      } else {
        handStatusEl.textContent = '2 HANDS DETECTED';
        handStatusEl.style.color = '#0ff';
      }
    }
    
    // Gesture display
    const gestureEl = document.getElementById('gesture-display');
    if (gestureEl && gestures.length > 0) {
      const gesture = gestures[0];
      gestureEl.textContent = gesture;
      
      // Color based on gesture
      switch (gesture) {
        case 'OPEN_PALM':
          gestureEl.style.color = '#f00';
          gestureEl.style.textShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
          break;
        case 'FIST':
          gestureEl.style.color = '#ff0';
          gestureEl.style.textShadow = '0 0 20px rgba(255, 255, 0, 0.8)';
          break;
        case 'POINTING':
          gestureEl.style.color = '#0f0';
          gestureEl.style.textShadow = '0 0 20px rgba(0, 255, 0, 0.8)';
          break;
        default:
          gestureEl.style.color = '#888';
          gestureEl.style.textShadow = 'none';
      }
    } else if (gestureEl) {
      gestureEl.textContent = 'NONE';
      gestureEl.style.color = '#888';
    }
    
    // Particle count
    const particleEl = document.getElementById('particle-count');
    if (particleEl) {
      particleEl.textContent = this.config.particleCount.toLocaleString();
    }
  }

  dispose() {
    this.isRunning = false;
    this.handTracker?.dispose();
    this.renderer?.dispose();
  }
}

// Auto-start on load
const app = new GravitySculptor();

// Handle visibility change to pause/resume
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    app.isRunning = false;
  } else {
    app.isRunning = true;
    app.lastTime = performance.now();
    app.animate();
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  app.dispose();
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
    // Expose globally for onclick handlers
    globalThis.gravitySculptor = app;
    window.gravitySculptor = app;
    console.log('App exposed to window:', window.gravitySculptor);
  });
} else {
  app.init();
  // Expose globally for onclick handlers
  globalThis.gravitySculptor = app;
  window.gravitySculptor = app;
  console.log('App exposed to window:', window.gravitySculptor);
}
