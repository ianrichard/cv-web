import { DetectionSmoother } from './detection-smoother.js';

export class Detector {
    constructor() {
        this.model = null;
        this.modelType = null;
        this.isDetecting = false;
        this.animationFrame = null;

        // Performance monitoring
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.targetFPS = this.detectPlatform();
        this.frameInterval = 1000 / this.targetFPS;
        this.lastFrameTime = 0;

        // Tracking and smoothing
        this.trackedObjects = new Map();
        this.nextObjectId = 0;
        this.smoothingFactor = 0.8;
        this.confidenceThreshold = 0.6;
        this.maxTrackingDistance = 100;
        this.maxFramesWithoutDetection = 8;

        // Face recognition (simplified)
        this.referenceImageData = null;
        this.faceRecognitionEnabled = false;

        // Performance UI elements
        this.performanceVisible = false;
        this.objectCount = 0;

        // Initialize smoothing system with very aggressive smoothing
        this.smoother = new DetectionSmoother({
            smoothingFactor: 0.05,       // Much lower for very heavy smoothing
            maxDistance: 150,            // Allow wider matching
            maxFramesWithoutDetection: 30, // Keep objects much longer
            minUpdateThreshold: 3,       // Lower threshold
            updateInterval: 30           // Only update every 30 frames (~1 second)
        });

        // Add frame counter for face rendering control
        this.faceRenderCounter = 0;
    }

    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        const memory = navigator.deviceMemory || 4;

        if (userAgent.includes('raspberry') || memory <= 4) {
            return 15; // RPi
        } else if (userAgent.includes('mac')) {
            return 30; // Mac
        } else {
            return 25; // Nvidia Orin and others
        }
    }

    setModel(model, modelType = 'unknown') {
        this.model = model;
        this.modelType = modelType;
        console.log(`Model set: ${modelType}`);

        // Update UI
        const currentModelSpan = document.getElementById('currentModel');
        if (currentModelSpan) {
            currentModelSpan.textContent = modelType;
        }
    }

    async startDetection(videoElement, onObjectsUpdate) {
        this.isDetecting = true;
        this.videoElement = videoElement;
        this.onObjectsUpdate = onObjectsUpdate;
        this.detectLoop();
    }

    stopDetection() {
        this.isDetecting = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    async detectLoop() {
        if (!this.isDetecting || !this.model) return;

        const currentTime = performance.now();
        if (currentTime - this.lastFrameTime < this.frameInterval) {
            this.animationFrame = requestAnimationFrame(() => this.detectLoop());
            return;
        }
        this.lastFrameTime = currentTime;

        try {
            const rawPredictions = await this.model.detect(this.videoElement);
            const filteredPredictions = rawPredictions.filter(p => p.score >= this.confidenceThreshold);
            const smoothedPredictions = this.smoother.smoothDetections(filteredPredictions);

            // --- SCALE AND OFFSET LOGIC ---
            const overlay = document.getElementById('objectOverlay');
            let overlayRect, videoWidth, videoHeight, overlayWidth, overlayHeight;
            let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
            if (overlay && this.videoElement) {
                overlayRect = overlay.getBoundingClientRect();
                videoWidth = this.videoElement.videoWidth;
                videoHeight = this.videoElement.videoHeight;
                overlayWidth = overlayRect.width;
                overlayHeight = overlayRect.height;

                const videoAspect = videoWidth / videoHeight;
                const overlayAspect = overlayWidth / overlayHeight;

                if (videoAspect > overlayAspect) {
                    scaleY = overlayHeight / videoHeight;
                    scaleX = scaleY;
                    offsetX = (overlayWidth - (videoWidth * scaleX)) / 2;
                } else {
                    scaleX = overlayWidth / videoWidth;
                    scaleY = scaleX;
                    offsetY = (overlayHeight - (videoHeight * scaleY)) / 2;
                }
            }
            // --------------------------------

            // Build recognizedObjects array with horizontally flipped positions
            const recognizedObjects = smoothedPredictions.map((obj, idx) => {
                const [x0, y0, w0, h0] = obj.bbox;
                // Flip horizontally for mirrored video
                const xFlipped = overlayWidth - (x0 * scaleX + offsetX + w0 * scaleX);
                // Use scaleY for height, not scaleX (fixes "too big" box)
                return {
                    id: obj.id || idx,
                    label: obj.class || obj.label,
                    x: xFlipped,
                    y: y0 * scaleY + offsetY,
                    width: w0 * scaleX,
                    height: h0 * scaleY
                };
            });

            if (this.onObjectsUpdate) this.onObjectsUpdate(recognizedObjects);

            this.objectCount = smoothedPredictions.length;

        } catch (error) {
            console.error('Detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop());
    }

    setFaceRecognitionManager(faceRecognitionManager) {
        this.faceRecognitionManager = faceRecognitionManager;
    }

    async loadReferenceImage(imagePath = 'images/face.jpg') {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imagePath;
            });

            // Simple face detection without complex recognition for now
            this.referenceImageData = img;
            this.faceRecognitionEnabled = true;
            console.log('Reference image loaded successfully');
            return true;
        } catch (error) {
            console.log('Reference image not found, face recognition disabled');
            return false;
        }
    }
}