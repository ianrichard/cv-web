export class Detector {
    constructor() {
        this.model = null;
        this.modelType = null;
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
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
        this.canvas.width = videoElement.videoWidth;
        this.canvas.height = videoElement.videoHeight;
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
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            const startTime = performance.now();
            const predictions = await this.model.detect(videoElement);
            const inferenceTime = performance.now() - startTime;

            const filteredPredictions = predictions.filter(p => p.score >= this.confidenceThreshold);
            const smoothedPredictions = this.trackAndSmoothPredictions(filteredPredictions);

            this.objectCount = smoothedPredictions.length;
            this.drawPredictions(smoothedPredictions);
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

    trackAndSmoothPredictions(predictions) {
        const smoothedPredictions = [];
        const usedPredictions = new Set();

        // Update existing tracked objects
        for (const [id, trackedObj] of this.trackedObjects) {
            let bestMatch = null;
            let bestDistance = Infinity;

            predictions.forEach((pred, index) => {
                if (usedPredictions.has(index)) return;

                // More flexible class matching to handle variations
                const classMatch = this.classesMatch(pred.class, trackedObj.class);
                if (!classMatch) return;

                const distance = this.calculateDistance(trackedObj.bbox, pred.bbox);
                if (distance < this.maxTrackingDistance && distance < bestDistance) {
                    bestMatch = { prediction: pred, index };
                    bestDistance = distance;
                }
            });

            if (bestMatch) {
                const smoothedBbox = this.smoothBoundingBox(trackedObj.bbox, bestMatch.prediction.bbox);
                trackedObj.bbox = smoothedBbox;
                trackedObj.score = bestMatch.prediction.score;
                // Keep the original class to maintain consistency
                trackedObj.class = trackedObj.class; // Don't update class to prevent flashing
                trackedObj.framesSinceLastDetection = 0;

                smoothedPredictions.push({
                    ...bestMatch.prediction,
                    class: trackedObj.class, // Use consistent class name
                    bbox: smoothedBbox
                });
                usedPredictions.add(bestMatch.index);
            } else {
                trackedObj.framesSinceLastDetection++;
                if (trackedObj.framesSinceLastDetection < this.maxFramesWithoutDetection) {
                    smoothedPredictions.push({
                        class: trackedObj.class,
                        score: trackedObj.score * 0.95,
                        bbox: trackedObj.bbox,
                        isFaceRecognition: trackedObj.isFaceRecognition,
                        isYoloE: trackedObj.isYoloE
                    });
                }
            }
        }

        // Clean up old objects
        for (const [id, trackedObj] of this.trackedObjects) {
            if (trackedObj.framesSinceLastDetection >= this.maxFramesWithoutDetection) {
                this.trackedObjects.delete(id);
            }
        }

        // Add new detections
        predictions.forEach((pred, index) => {
            if (usedPredictions.has(index)) return;

            const newId = this.nextObjectId++;
            this.trackedObjects.set(newId, {
                id: newId,
                class: pred.class,
                bbox: pred.bbox,
                score: pred.score,
                isFaceRecognition: pred.isFaceRecognition || false,
                isYoloE: pred.isYoloE || false,
                framesSinceLastDetection: 0
            });
            smoothedPredictions.push(pred);
        });

        return smoothedPredictions;
    }

    classesMatch(class1, class2) {
        // Normalize class names for comparison
        const normalize = (className) => className.toLowerCase().trim();
        const c1 = normalize(class1);
        const c2 = normalize(class2);

        // Direct match
        if (c1 === c2) return true;

        // Handle common variations
        const variations = {
            'person': ['face', 'human'],
            'face': ['person', 'human'],
            'car': ['vehicle', 'automobile'],
            'bicycle': ['bike'],
            'motorcycle': ['motorbike']
        };

        // Check if either class is a variation of the other
        if (variations[c1] && variations[c1].includes(c2)) return true;
        if (variations[c2] && variations[c2].includes(c1)) return true;

        return false;
    }

    calculateDistance(bbox1, bbox2) {
        const [x1, y1, w1, h1] = bbox1;
        const [x2, y2, w2, h2] = bbox2;
        const cx1 = x1 + w1 / 2, cy1 = y1 + h1 / 2;
        const cx2 = x2 + w2 / 2, cy2 = y2 + h2 / 2;
        return Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
    }

    smoothBoundingBox(oldBbox, newBbox) {
        const [ox, oy, ow, oh] = oldBbox;
        const [nx, ny, nw, nh] = newBbox;
        const factor = this.smoothingFactor;

        return [
            ox * factor + nx * (1 - factor),
            oy * factor + ny * (1 - factor),
            ow * factor + nw * (1 - factor),
            oh * factor + nh * (1 - factor)
        ];
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

    drawPredictions(predictions) {
        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const isFaceRecognition = prediction.isFaceRecognition;
            const isYoloE = prediction.isYoloE;
            const isPromptGenerated = prediction.isPromptGenerated;

            // Enhanced color coding by class and model type
            let color = '#00FF00';
            if (isYoloE) {
                color = isPromptGenerated ? '#FF00FF' : '#00FFFF'; // Magenta for prompt-generated, Cyan for YOLOE
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

            // Draw bounding box with special styling for YOLOE
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = isYoloE ? 4 : (isFaceRecognition ? 3 : 2);
            if (isPromptGenerated) {
                this.ctx.setLineDash([10, 5]); // Dashed line for prompt-generated
            } else {
                this.ctx.setLineDash([]);
            }
            this.ctx.strokeRect(x, y, width, height);

            // Draw confidence bar
            const confidenceWidth = width * prediction.score;
            this.ctx.fillStyle = color + '40';
            this.ctx.fillRect(x, y - 8, confidenceWidth, 4);

            // Standardize label format - remove model-specific suffixes for consistent display
            let cleanClassName = prediction.class;
            if (isYoloE) {
                // Remove YOLOE suffix for cleaner display, but keep the visual distinction
                cleanClassName = cleanClassName.replace(' (YOLOE Enhanced)', '').replace(' (YOLOE)', '').replace(' (YOLOE Prompt)', '');
            }

            const label = `${cleanClassName}: ${(prediction.score * 100).toFixed(0)}%`;
            this.ctx.fillStyle = color;
            this.ctx.font = 'bold 14px Arial'; // Standardize font size

            const textWidth = this.ctx.measureText(label).width;
            this.ctx.fillRect(x, y - 30, textWidth + 12, 22);

            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, x + 6, y - 12);

            // Reset line dash for next prediction
            this.ctx.setLineDash([]);
        });
    }
}