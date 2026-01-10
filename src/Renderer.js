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

        // Color attribute - vibrant cyan/blue palette
        const colors = new Float32Array(this.particleCount * 3);
        for (let i = 0; i < this.particleCount; i++) {
            const hue = 0.5 + Math.random() * 0.2; // Cyan to blue range
            const sat = 0.7 + Math.random() * 0.3;
            const light = 0.55 + Math.random() * 0.35;
            const color = new THREE.Color().setHSL(hue, sat, light);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Glowing particles - clean and distinct
        this.material = new THREE.PointsMaterial({
            size: 0.05, // Visible individual particles
            vertexColors: true,
            transparent: true,
            opacity: 0.7, // Each particle visible
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            depthWrite: false
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
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
            const maxPoints = 200;
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
        for (let i = 0; i < 200; i++) {
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
        this.trailGeometry.setDrawRange(0, Math.min(pathPoints.length, 200));
    }

    /**
     * Update finger cursor position for visual feedback during drawing
     */
    updateFingerCursor(fingerTips, isDrawMode) {
        if (!this.fingerCursor) {
            // Create finger cursor indicator
            const cursorGeom = new THREE.RingGeometry(0.08, 0.12, 32);
            const cursorMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            this.fingerCursor = new THREE.Mesh(cursorGeom, cursorMat);
            this.fingerCursor.position.z = 0;
            this.scene.add(this.fingerCursor);
        }

        if (isDrawMode && fingerTips.length > 0) {
            const tip = fingerTips[0];
            // Scale to scene coordinates
            this.fingerCursor.position.x = tip.x * 1.8;
            this.fingerCursor.position.y = tip.y * 1.4;
            this.fingerCursor.visible = true;
            // Pulse effect
            const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            this.fingerCursor.scale.set(pulse, pulse, 1);
        } else {
            this.fingerCursor.visible = false;
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

        for (let i = 0; i < count; i++) {
            colors[i * 3] = 0.4;
            colors[i * 3 + 1] = 0.8;
            colors[i * 3 + 2] = 1.0;
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
