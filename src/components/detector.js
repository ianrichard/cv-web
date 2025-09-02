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
        this.updateCanvasSize(); // Ensure proper sizing before starting
        this.detectLoop(videoElement);
    }

    stopDetection() {
        this.isDetecting = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    async detectLoop(videoElement) {
        if (!this.isDetecting || !this.model) return;

        const currentTime = performance.now();
        if (currentTime - this.lastFrameTime < this.frameInterval) {
            this.animationFrame = requestAnimationFrame(() => this.detectLoop(videoElement));
            return;
        }
        this.lastFrameTime = currentTime;

        try {
            // Clear with proper scaling
            this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

            const startTime = performance.now();
            const rawPredictions = await this.model.detect(videoElement);
            const inferenceTime = performance.now() - startTime;

            // Filter by confidence threshold first
            const filteredPredictions = rawPredictions.filter(p => p.score >= this.confidenceThreshold);

            // Apply smoothing to reduce jumpiness - this is the key step
            const smoothedPredictions = this.smoother.smoothDetections(filteredPredictions);

            this.objectCount = smoothedPredictions.length;
            this.drawPredictions(smoothedPredictions, videoElement);
            this.updatePerformanceStats(currentTime, inferenceTime);

        } catch (error) {
            console.error('Detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop(videoElement));
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

            console.log(`FPS: ${this.fps}, Inference: ${inferenceTime.toFixed(1)}ms, Objects: ${this.objectCount}`);
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
        // Calculate scaling factors for responsive drawing
        const videoRect = videoElement.getBoundingClientRect();
        const containerRect = this.canvas.parentElement.getBoundingClientRect();

        // Account for object-fit: cover scaling
        const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
        const containerAspect = this.canvasWidth / this.canvasHeight;

        let scaleX, scaleY, offsetX = 0, offsetY = 0;

        if (videoAspect > containerAspect) {
            // Video is wider than container - fit to height, crop sides
            scaleY = this.canvasHeight / videoElement.videoHeight;
            scaleX = scaleY;
            offsetX = (this.canvasWidth - (videoElement.videoWidth * scaleX)) / 2;
        } else {
            // Video is taller than container - fit to width, crop top/bottom
            scaleX = this.canvasWidth / videoElement.videoWidth;
            scaleY = scaleX;
            offsetY = (this.canvasHeight - (videoElement.videoHeight * scaleY)) / 2;
        }

        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const isFaceRecognition = prediction.isFaceRecognition;
            const isYoloE = prediction.isYoloE;
            const isPromptGenerated = prediction.isPromptGenerated;
            const isTracked = prediction.isTracked;
            const isFading = prediction.isFading;
            const isNew = prediction.isNew;

            // Scale coordinates to canvas size
            const scaledX = (x * scaleX) + offsetX;
            const scaledY = (y * scaleY) + offsetY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;

            // Enhanced color coding
            let color = '#00FF00';
            if (isYoloE) {
                color = isPromptGenerated ? '#FF00FF' : '#00FFFF';
            } else if (isFaceRecognition) {
                color = prediction.class === 'You' ? '#FF0000' : '#FFA500';
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

            // Adjust opacity based on tracking state to reduce flickering
            let alpha = 'FF';
            let lineWidth = 2;

            if (isNew) {
                alpha = 'AA'; // Slightly transparent for new objects
            } else if (isFading) {
                alpha = '60'; // More transparent for fading objects
                lineWidth = 1.5;
            } else if (isTracked) {
                alpha = '90'; // Slightly transparent for tracked objects
                lineWidth = 1.8;
            }

            // Draw bounding box
            this.ctx.strokeStyle = color + alpha;
            this.ctx.lineWidth = isYoloE ? 4 : (isFaceRecognition ? 3 : lineWidth);
            if (isPromptGenerated) {
                this.ctx.setLineDash([10, 5]);
            } else {
                this.ctx.setLineDash([]);
            }
            this.ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

            // Clean label format
            let cleanClassName = prediction.class;
            if (isYoloE) {
                cleanClassName = cleanClassName.replace(' (YOLOE Enhanced)', '').replace(' (YOLOE)', '').replace(' (YOLOE Prompt)', '');
            }

            const label = `${cleanClassName}: ${(prediction.score * 100).toFixed(0)}%`;

            // Set font size properly scaled for high-DPI
            const baseFontSize = 14;
            this.ctx.font = `bold ${baseFontSize}px Arial`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';

            const textMetrics = this.ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = baseFontSize * 1.2;

            // Draw background for text with same alpha
            this.ctx.fillStyle = color + alpha;
            this.ctx.fillRect(scaledX, scaledY - textHeight - 8, textWidth + 12, textHeight + 4);

            // Draw text
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, scaledX + 6, scaledY - textHeight - 4);

            // Reset line dash
            this.ctx.setLineDash([]);
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