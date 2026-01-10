/**
 * Renderer - Three.js particle visualization
 * Simplified version using built-in PointsMaterial
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Renderer {
    constructor(container, particleCount = 12000) {
        this.container = container;
        this.particleCount = particleCount;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;

        // Particle system
        this.particles = null;
        this.geometry = null;
        this.material = null;

        // Animation
        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Scene
        this.scene = new THREE.Scene();

        // Camera close for full-screen particle field
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
        this.camera.position.z = 3;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });

        // Setup webcam as background
        this.setupWebcamBackground();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Create particle system
        this.createParticles();

        // Post-processing with subtle bloom
        this.setupPostProcessing();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    createParticles() {
        // BufferGeometry for optimal performance
        this.geometry = new THREE.BufferGeometry();

        // Position attribute (will be updated from physics)
        const positions = new Float32Array(this.particleCount * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Color attribute - vibrant rainbow butterfly colors
        const colors = new Float32Array(this.particleCount * 3);
        const butterflyHues = [
            0.0,   // Red
            0.05,  // Orange
            0.12,  // Yellow
            0.3,   // Green
            0.55,  // Cyan
            0.65,  // Blue
            0.75,  // Purple
            0.85,  // Pink
            0.95   // Magenta
        ];

        for (let i = 0; i < this.particleCount; i++) {
            // Pick a random butterfly color
            const hue = butterflyHues[Math.floor(Math.random() * butterflyHues.length)];
            const sat = 0.85 + Math.random() * 0.15; // Very saturated
            const light = 0.5 + Math.random() * 0.3;
            const color = new THREE.Color().setHSL(hue, sat, light);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Create butterfly texture
        const butterflyTexture = this.createButterflyTexture();

        // Butterfly particles - visible but delicate
        this.material = new THREE.PointsMaterial({
            size: 0.08, // Visible butterflies
            map: butterflyTexture,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            depthWrite: false,
            alphaTest: 0.01
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
    }

    /**
     * Create a butterfly-shaped texture using canvas
     */
    createButterflyTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Clear with transparent
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;

        // Draw butterfly wings using bezier curves
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 1;

        // Left wing (upper)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx - 25, cy - 20, cx - 30, cy - 10, cx - 20, cy + 5);
        ctx.bezierCurveTo(cx - 10, cy + 2, cx, cy, cx, cy);
        ctx.fill();

        // Left wing (lower)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx - 20, cy + 5, cx - 25, cy + 20, cx - 15, cy + 15);
        ctx.bezierCurveTo(cx - 5, cy + 8, cx, cy, cx, cy);
        ctx.fill();

        // Right wing (upper)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx + 25, cy - 20, cx + 30, cy - 10, cx + 20, cy + 5);
        ctx.bezierCurveTo(cx + 10, cy + 2, cx, cy, cx, cy);
        ctx.fill();

        // Right wing (lower)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx + 20, cy + 5, cx + 25, cy + 20, cx + 15, cy + 15);
        ctx.bezierCurveTo(cx + 5, cy + 8, cx, cy, cx, cy);
        ctx.fill();

        // Body (small oval)
        ctx.beginPath();
        ctx.ellipse(cx, cy, 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Add soft glow
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
        gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    setupWebcamBackground() {
        // Get the video element
        const video = document.getElementById('webcam');
        if (!video) return;

        // Create video texture
        this.videoTexture = new THREE.VideoTexture(video);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;

        // Create fullscreen background plane (behind particles)
        const aspect = window.innerWidth / window.innerHeight;
        const planeHeight = 8; // Large enough to fill view
        const planeWidth = planeHeight * aspect;

        const bgGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const bgMaterial = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.FrontSide,
            transparent: true,
            opacity: 0.6 // Dim the video so particles pop
        });

        this.webcamPlane = new THREE.Mesh(bgGeometry, bgMaterial);
        this.webcamPlane.position.z = -2; // Behind particles
        this.webcamPlane.scale.x = -1; // Mirror for intuitive interaction
        this.scene.add(this.webcamPlane);
    }

    setupPostProcessing() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Composer
        this.composer = new EffectComposer(this.renderer);

        // Render pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Minimal bloom - just a hint of glow
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.35,  // strength - very subtle
            0.2,   // radius - tight
            0.75   // threshold - only brightest
        );
        this.composer.addPass(bloomPass);
        this.bloomPass = bloomPass;
    }

    /**
     * Update particle positions from physics simulation
     */
    updatePositions(positions) {
        const posAttr = this.geometry.attributes.position;
        posAttr.array.set(positions);
        posAttr.needsUpdate = true;
    }

    /**
     * Update particle colors based on velocity/speed
     */
    updateColors(speeds, gravityWells = []) {
        const colors = this.geometry.attributes.color.array;
        const maxSpeed = 0.05;

        for (let i = 0; i < this.particleCount; i++) {
            const speed = speeds[i];
            const t = Math.min(speed / maxSpeed, 1);

            // Gradient from cyan to white to pink based on speed
            let hue, sat, light;

            if (gravityWells.length === 0) {
                // Ambient: cool blue-cyan
                hue = 0.55 - t * 0.1;
                sat = 0.7;
                light = 0.6 + t * 0.3;
            } else if (gravityWells.length === 1) {
                // Single well: shift to warmer purple
                hue = 0.7 - t * 0.2;
                sat = 0.8;
                light = 0.6 + t * 0.3;
            } else {
                // Two wells: hot pink/magenta
                hue = 0.85 - t * 0.15;
                sat = 0.9;
                light = 0.65 + t * 0.25;
            }

            const color = new THREE.Color().setHSL(hue, sat, light);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        this.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * Adjust bloom for chaos mode
     */
    setBloomIntensity(intensity) {
        if (this.bloomPass) {
            this.bloomPass.strength = intensity;
        }
    }

    /**
     * Update path trail for drawing/art mode
     */
    updatePathTrail(pathPoints, artColors) {
        // Create trail geometry if not exists
        if (!this.trailGeometry) {
            this.trailGeometry = new THREE.BufferGeometry();
            const maxPoints = 600; // More points for multi-finger trails
            const positions = new Float32Array(maxPoints * 3);
            const colors = new Float32Array(maxPoints * 3);
            const sizes = new Float32Array(maxPoints);

            this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            this.trailGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

            this.trailMaterial = new THREE.PointsMaterial({
                size: 0.15, // Larger trail dots
                vertexColors: true,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: true,
                depthWrite: false
            });

            this.trailPoints = new THREE.Points(this.trailGeometry, this.trailMaterial);
            this.scene.add(this.trailPoints);
        }

        const positions = this.trailGeometry.attributes.position.array;
        const colors = this.trailGeometry.attributes.color.array;
        const now = Date.now();

        // Update trail positions
        for (let i = 0; i < 600; i++) {
            if (i < pathPoints.length) {
                const point = pathPoints[i];
                const age = (now - point.time) / 5000;
                const alpha = 1 - age;

                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = 0;

                // Color based on art color selection
                const colorIdx = point.color || 0;
                const artColor = artColors[colorIdx] || artColors[0];
                const color = new THREE.Color().setHSL(artColor.h, artColor.s, artColor.l * alpha);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            } else {
                // Hide unused points
                positions[i * 3] = 0;
                positions[i * 3 + 1] = 0;
                positions[i * 3 + 2] = -100; // Behind camera
            }
        }

        this.trailGeometry.attributes.position.needsUpdate = true;
        this.trailGeometry.attributes.color.needsUpdate = true;
        this.trailGeometry.setDrawRange(0, Math.min(pathPoints.length, 600));
    }

    /**
     * Update finger cursors for visual feedback during drawing
     * Now supports multiple fingers!
     */
    updateFingerCursor(fingerTips, isDrawMode) {
        // Create cursor pool if needed (max 10 cursors)
        if (!this.fingerCursors) {
            this.fingerCursors = [];
            const colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00, 0xff6600];

            for (let i = 0; i < 10; i++) {
                const cursorGeom = new THREE.RingGeometry(0.06, 0.10, 32);
                const cursorMat = new THREE.MeshBasicMaterial({
                    color: colors[i % colors.length],
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });
                const cursor = new THREE.Mesh(cursorGeom, cursorMat);
                cursor.position.z = 0.1;
                cursor.visible = false;
                this.scene.add(cursor);
                this.fingerCursors.push(cursor);
            }
        }

        // Update cursors based on finger tips
        for (let i = 0; i < this.fingerCursors.length; i++) {
            const cursor = this.fingerCursors[i];

            if (isDrawMode && i < fingerTips.length) {
                const tip = fingerTips[i];
                cursor.position.x = tip.x * 1.8;
                cursor.position.y = tip.y * 1.4;
                cursor.visible = true;

                // Pulse effect
                const pulse = 1 + Math.sin(Date.now() * 0.01 + i) * 0.2;
                cursor.scale.set(pulse, pulse, 1);
            } else {
                cursor.visible = false;
            }
        }
    }

    render() {
        // Use composer for bloom effect
        this.composer.render();
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);

        // Resize webcam plane
        if (this.webcamPlane) {
            const aspect = width / height;
            const planeHeight = 8;
            const planeWidth = planeHeight * aspect;
            this.webcamPlane.geometry.dispose();
            this.webcamPlane.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        }
    }

    reinitParticles(count) {
        // Remove old particles
        this.scene.remove(this.particles);
        this.geometry.dispose();

        // Create new geometry
        this.particleCount = count;
        this.geometry = new THREE.BufferGeometry();

        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        // Butterfly rainbow colors
        const butterflyHues = [0.0, 0.05, 0.12, 0.3, 0.55, 0.65, 0.75, 0.85, 0.95];
        for (let i = 0; i < count; i++) {
            const hue = butterflyHues[Math.floor(Math.random() * butterflyHues.length)];
            const color = new THREE.Color().setHSL(hue, 0.9, 0.6);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.renderer.dispose();
    }
}
