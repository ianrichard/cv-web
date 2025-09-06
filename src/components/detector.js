import { DetectionSmoother } from './detection-smoother.js';

export class Detector {
    constructor() {
        this.model = null;
        this.modelType = null;
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
        this.isDetecting = false;
        this.animationFrame = null;

        // Canvas sizing and DPI handling
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.canvasWidth = 0;
        this.canvasHeight = 0;

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

        // Setup resize observer for responsive canvas
        this.setupResizeObserver();
    }

    setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateCanvasSize();
            });
            this.resizeObserver.observe(this.canvas.parentElement);
        } else {
            // Fallback for older browsers
            window.addEventListener('resize', () => this.updateCanvasSize());
        }
    }

    updateCanvasSize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set CSS display size
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;

        // Set actual canvas buffer size for high-DPI
        const scaledWidth = Math.floor(this.canvasWidth * this.devicePixelRatio);
        const scaledHeight = Math.floor(this.canvasHeight * this.devicePixelRatio);

        if (this.canvas.width !== scaledWidth || this.canvas.height !== scaledHeight) {
            this.canvas.width = scaledWidth;
            this.canvas.height = scaledHeight;

            // Set CSS size to maintain display dimensions
            this.canvas.style.width = this.canvasWidth + 'px';
            this.canvas.style.height = this.canvasHeight + 'px';

            // Scale context to match pixel ratio
            this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

            // Optimize text rendering
            this.ctx.textBaseline = 'top';
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        }
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

    async startDetection(videoElement) {
        this.isDetecting = true;
        this.updateCanvasSize();
        this.videoElement = videoElement; // Store original video for drawing/scaling
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
            this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

            // Flip the video frame before inference
            const flippedFrame = this.getFlippedFrame(this.videoElement);

            const startTime = performance.now();
            const rawPredictions = await this.model.detect(flippedFrame);
            const inferenceTime = performance.now() - startTime;

            // Filter by confidence threshold first
            const filteredPredictions = rawPredictions.filter(p => p.score >= this.confidenceThreshold);

            // Apply smoothing to reduce jumpiness - this handles faces and objects
            const smoothedPredictions = this.smoother.smoothDetections(filteredPredictions);

            // Use original videoElement for drawing/scaling
            this.objectCount = smoothedPredictions.length;
            this.drawPredictions(smoothedPredictions, this.videoElement);
            this.updatePerformanceStats(currentTime, inferenceTime);

        } catch (error) {
            console.error('Detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop());
    }

    // Helper to get horizontally flipped frame as canvas
    getFlippedFrame(video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        return canvas;
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

    updatePerformanceStats(currentTime, inferenceTime) {
        this.frameCount++;
        if (currentTime - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;

            // Update UI elements
            this.updatePerformanceUI(inferenceTime);

            console.log(`FPS ${this.fps}, Inference: ${inferenceTime.toFixed(1)}ms, Objects: ${this.objectCount}`);
        }
    }

    updatePerformanceUI(inferenceTime) {
        const fpsCounter = document.getElementById('fpsCounter');
        const inferenceTimeSpan = document.getElementById('inferenceTime');
        const objectCountSpan = document.getElementById('objectCount');

        if (fpsCounter) fpsCounter.textContent = this.fps;
        if (inferenceTimeSpan) inferenceTimeSpan.textContent = inferenceTime.toFixed(1);
        if (objectCountSpan) objectCountSpan.textContent = this.objectCount;
    }

    togglePerformance() {
        this.performanceVisible = !this.performanceVisible;
        const performanceStats = document.getElementById('performanceStats');
        if (performanceStats) {
            performanceStats.style.display = this.performanceVisible ? 'block' : 'none';
        }
    }

    drawPredictions(predictions, videoElement) {
        const canvasLogicalWidth = this.canvasWidth;
        const canvasLogicalHeight = this.canvasHeight;

        const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
        const containerAspect = canvasLogicalWidth / canvasLogicalHeight;

        let scaleX, scaleY, offsetX = 0, offsetY = 0;

        if (videoAspect > containerAspect) {
            scaleY = canvasLogicalHeight / videoElement.videoHeight;
            scaleX = scaleY;
            offsetX = (canvasLogicalWidth - (videoElement.videoWidth * scaleX)) / 2;
        } else {
            scaleX = canvasLogicalWidth / videoElement.videoWidth;
            scaleY = scaleX;
            offsetY = (canvasLogicalHeight - (videoElement.videoHeight * scaleY)) / 2;
        }

        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const scaledX = (x * scaleX) + offsetX;
            const scaledY = (y * scaleY) + offsetY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;

            // Color coding
            let color = '#00FF00';
            if (prediction.isFaceRecognition) {
                color = '#FF0000';
            } else {
                switch (prediction.class) {
                    case 'person': color = '#FF6B6B'; break;
                    case 'car': color = '#4ECDC4'; break;
                    case 'truck': color = '#96CEB4'; break;
                    case 'bus': color = '#FFEAA7'; break;
                    case 'bicycle': color = '#45B7D1'; break;
                    case 'motorcycle': color = '#A29BFE'; break;
                    case 'dog': color = '#FD79A8'; break;
                    case 'cat': color = '#FDCB6E'; break;
                    case 'bird': color = '#6C5CE7'; break;
                    default: color = '#00FF00';
                }
            }

            // Draw bounding box
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = prediction.isFaceRecognition ? 3 : 2;
            this.ctx.setLineDash([]);
            // Flip X for mirrored canvas
            this.ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

            // Draw label
            let label;
            if (prediction.isFaceRecognition) {
                label = `${prediction.class} ${(prediction.similarity * 100).toFixed(0)}%`;
            } else {
                label = `${prediction.class}: ${(prediction.score * 100).toFixed(0)}%`;
            }

            const baseFontSize = 14;
            this.ctx.font = `bold ${baseFontSize}px Arial`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';

            const textMetrics = this.ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = baseFontSize * 1.2;

            this.ctx.fillStyle = color;
            this.ctx.fillRect(scaledX, scaledY - textHeight - 8, textWidth + 12, textHeight + 4);

            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, scaledX + 6, scaledY - textHeight - 4);
        });
    }

    // Add method to adjust smoothing settings
    adjustSmoothingSettings(settings) {
        this.smoother = new DetectionSmoother({
            ...this.smoother,
            ...settings
        });
    }

    // Add method to reset smoothing (useful when changing models)
    resetSmoothing() {
        this.smoother.reset();
    }
}