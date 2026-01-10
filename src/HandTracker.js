/**
 * HandTracker - MediaPipe Hands wrapper for gravity well detection
 * Tracks hand positions and converts them to normalized screen coordinates
 */

export class HandTracker {
  constructor() {
    this.hands = [];
    this.rawHands = [];
    this.isReady = false;
    this.smoothingFactor = 0.5; // Higher = more responsive for drawing
    this.video = null;
    this.handsApi = null;
    this.camera = null;
    this.fingerTips = []; // For drawing mode - use index finger
    
    // Gesture tracking
    this.gestures = []; // Current gesture for each hand
    this.prevGestures = []; // Previous frame gestures
    this.gestureEvents = []; // Events like "palm_opened" for explosion
  }

  async init() {
    try {
      // Get webcam video element
      this.video = document.getElementById('webcam');
      
      // Request camera access - lower resolution for faster processing
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      });
      
      this.video.srcObject = stream;
      await this.video.play();

      // Load MediaPipe from CDN (more reliable for production builds)
      await this.loadMediaPipeFromCDN();

      // Initialize MediaPipe Hands
      this.handsApi = new window.Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      this.handsApi.setOptions({
        maxNumHands: 2,
        modelComplexity: 0, // Fastest model for better responsiveness
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.4
      });

      this.handsApi.onResults((results) => this.onResults(results));

      // Start camera processing - match lower resolution
      this.camera = new window.Camera(this.video, {
        onFrame: async () => {
          await this.handsApi.send({ image: this.video });
        },
        width: 320,
        height: 240
      });

      await this.camera.start();
      this.isReady = true;
      console.log('Hand tracking initialized');

    } catch (error) {
      console.warn('Hand tracking unavailable:', error.message);
      this.isReady = false;
    }
  }

  onResults(results) {
    this.rawHands = [];

    // Debug: log when hands are detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      console.log('🖐️ Hands detected:', results.multiHandLandmarks.length);
    }

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        // Use palm center (wrist + middle finger MCP average) for stable tracking
        const wrist = landmarks[0];
        const middleMcp = landmarks[9];
        
        // Calculate palm center
        const palmX = (wrist.x + middleMcp.x) / 2;
        const palmY = (wrist.y + middleMcp.y) / 2;
        const palmZ = (wrist.z + middleMcp.z) / 2;

        // Calculate finger spread for gravity strength
        // Distance between thumb tip and pinky tip normalized
        const thumbTip = landmarks[4];
        const pinkyTip = landmarks[20];
        const fingerSpread = Math.sqrt(
          Math.pow(thumbTip.x - pinkyTip.x, 2) +
          Math.pow(thumbTip.y - pinkyTip.y, 2)
        );

        // Normalize spread to 0-1 range (typical spread is 0.1 to 0.4)
        const normalizedSpread = Math.min(1, Math.max(0, (fingerSpread - 0.05) / 0.35));

        // Get index finger tip for drawing (landmark 8)
        const indexTip = landmarks[8];
        
        // Detect gesture
        const gesture = this.detectGesture(landmarks, normalizedSpread);
        
        this.rawHands.push({
          // Mirror X for intuitive control, convert to -1 to 1 range
          x: -(palmX * 2 - 1),
          y: -(palmY * 2 - 1),
          z: palmZ,
          spread: normalizedSpread,
          landmarks: landmarks,
          // Index finger tip for precise drawing
          fingerX: -(indexTip.x * 2 - 1),
          fingerY: -(indexTip.y * 2 - 1),
          gesture: gesture
        });
      }
    }

    // Detect gesture events (transitions)
    this.detectGestureEvents();
    
    // Smooth hand positions
    this.smoothHands();
  }
  
  /**
   * Detect current gesture from hand landmarks
   */
  detectGesture(landmarks, spread) {
    // Check if fingers are extended by comparing tip to knuckle positions
    const wrist = landmarks[0];
    
    // Finger tip and pip (middle joint) landmarks
    const fingers = {
      thumb: { tip: landmarks[4], pip: landmarks[3] },
      index: { tip: landmarks[8], pip: landmarks[6] },
      middle: { tip: landmarks[12], pip: landmarks[10] },
      ring: { tip: landmarks[16], pip: landmarks[14] },
      pinky: { tip: landmarks[20], pip: landmarks[18] }
    };
    
    // Count extended fingers (tip is further from wrist than pip)
    let extendedCount = 0;
    
    // For thumb, check x distance (horizontal spread)
    const thumbExtended = Math.abs(fingers.thumb.tip.x - wrist.x) > 
                          Math.abs(fingers.thumb.pip.x - wrist.x) * 1.2;
    if (thumbExtended) extendedCount++;
    
    // For other fingers, check y distance (vertical)
    for (const name of ['index', 'middle', 'ring', 'pinky']) {
      const finger = fingers[name];
      // Tip should be above (lower y) than pip when extended
      if (finger.tip.y < finger.pip.y - 0.02) {
        extendedCount++;
      }
    }
    
    // Determine gesture
    if (spread > 0.7 && extendedCount >= 4) {
      return 'OPEN_PALM';
    } else if (extendedCount <= 1 && spread < 0.3) {
      return 'FIST';
    } else if (extendedCount === 1 || extendedCount === 2) {
      return 'POINTING';
    } else {
      return 'PARTIAL';
    }
  }
  
  /**
   * Detect gesture transition events (like palm opening = explosion)
   */
  detectGestureEvents() {
    this.gestureEvents = [];
    
    for (let i = 0; i < this.rawHands.length; i++) {
      const current = this.rawHands[i]?.gesture;
      const prev = this.prevGestures[i];
      
      // Detect palm opening (was fist or partial, now open)
      if (current === 'OPEN_PALM' && (prev === 'FIST' || prev === 'PARTIAL')) {
        this.gestureEvents.push({
          type: 'EXPLOSION',
          handIndex: i,
          x: this.rawHands[i].x,
          y: this.rawHands[i].y
        });
        console.log('💥 EXPLOSION gesture detected!');
      }
      
      // Detect fist closing (was open, now fist) = implode/attract burst
      if (current === 'FIST' && prev === 'OPEN_PALM') {
        this.gestureEvents.push({
          type: 'IMPLODE',
          handIndex: i,
          x: this.rawHands[i].x,
          y: this.rawHands[i].y
        });
        console.log('🌀 IMPLODE gesture detected!');
      }
    }
    
    // Store current gestures for next frame comparison
    this.prevGestures = this.rawHands.map(h => h?.gesture);
  }

  smoothHands() {
    // Match hand count
    while (this.hands.length < this.rawHands.length) {
      this.hands.push({ ...this.rawHands[this.hands.length] });
    }
    while (this.hands.length > this.rawHands.length) {
      this.hands.pop();
    }

    // Apply smoothing
    for (let i = 0; i < this.hands.length; i++) {
      const raw = this.rawHands[i];
      const smooth = this.hands[i];
      
      smooth.x += (raw.x - smooth.x) * this.smoothingFactor;
      smooth.y += (raw.y - smooth.y) * this.smoothingFactor;
      smooth.z += (raw.z - smooth.z) * this.smoothingFactor;
      smooth.spread += (raw.spread - smooth.spread) * this.smoothingFactor;
      
      // Finger tips need faster response for drawing - use higher factor
      const fingerSmooth = 0.7;
      if (raw.fingerX !== undefined) {
        smooth.fingerX = smooth.fingerX !== undefined 
          ? smooth.fingerX + (raw.fingerX - smooth.fingerX) * fingerSmooth
          : raw.fingerX;
        smooth.fingerY = smooth.fingerY !== undefined
          ? smooth.fingerY + (raw.fingerY - smooth.fingerY) * fingerSmooth
          : raw.fingerY;
      }
    }
  }
  
  /**
   * Get finger tip positions for drawing mode
   * Returns RAW (unsmoothed) positions for instant response
   */
  getFingerTips() {
    // Use raw positions for drawing - no smoothing delay
    return this.rawHands.map(hand => ({
      x: hand.fingerX || hand.x,
      y: hand.fingerY || hand.y
    }));
  }

  /**
   * Get gravity wells from detected hands
   * Returns array of { x, y, z, strength, gesture } in normalized coordinates (-1 to 1)
   */
  getGravityWells() {
    return this.hands.map((hand, i) => ({
      x: hand.x,
      y: hand.y,
      z: hand.z,
      // Spread affects gravity strength: open hand = stronger, closed = weaker
      strength: 0.5 + hand.spread * 0.5,
      gesture: this.rawHands[i]?.gesture || 'NONE'
    }));
  }
  
  /**
   * Get gesture events that occurred this frame (EXPLOSION, IMPLODE, etc.)
   */
  getGestureEvents() {
    return this.gestureEvents;
  }
  
  /**
   * Get current gestures for all hands
   */
  getGestures() {
    return this.rawHands.map(h => h?.gesture || 'NONE');
  }

  /**
   * Get hand velocities for slingshot effect detection
   */
  getHandVelocities() {
    // Track previous positions for velocity calculation
    if (!this._prevHands) {
      this._prevHands = [];
    }

    const velocities = [];
    
    for (let i = 0; i < this.hands.length; i++) {
      if (this._prevHands[i]) {
        velocities.push({
          vx: this.hands[i].x - this._prevHands[i].x,
          vy: this.hands[i].y - this._prevHands[i].y
        });
      } else {
        velocities.push({ vx: 0, vy: 0 });
      }
    }

    // Store current as previous for next frame
    this._prevHands = this.hands.map(h => ({ ...h }));

    return velocities;
  }

  /**
   * Load MediaPipe scripts from CDN
   */
  async loadMediaPipeFromCDN() {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (src.includes('hands') && window.Hands) {
          resolve();
          return;
        }
        if (src.includes('camera_utils') && window.Camera) {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    // Load in order
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
  }

  dispose() {
    if (this.camera) {
      this.camera.stop();
    }
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
    }
  }
}
