export class Detector {
    constructor() {
        this.model = null;
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

    setModel(model) {
        this.model = model;
        console.log('COCO-SSD model loaded successfully');
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

            this.drawPredictions(smoothedPredictions);
            this.updatePerformanceStats(currentTime, inferenceTime);

        } catch (error) {
            console.error('Detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop(videoElement));
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
                if (pred.class !== trackedObj.class) return;

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
                trackedObj.framesSinceLastDetection = 0;

                smoothedPredictions.push({
                    ...bestMatch.prediction,
                    bbox: smoothedBbox
                });
                usedPredictions.add(bestMatch.index);
            } else {
                trackedObj.framesSinceLastDetection++;
                if (trackedObj.framesSinceLastDetection < this.maxFramesWithoutDetection) {
                    smoothedPredictions.push({
                        class: trackedObj.class,
                        score: trackedObj.score * 0.95,
                        bbox: trackedObj.bbox
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
                framesSinceLastDetection: 0
            });
            smoothedPredictions.push(pred);
        });

        return smoothedPredictions;
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
            console.log(`FPS: ${this.fps}, Inference: ${inferenceTime.toFixed(1)}ms`);
        }
    }

    drawPredictions(predictions) {
        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;

            // Color coding by class
            let color = '#00FF00';
            if (prediction.class === 'person') color = '#FF6B6B';
            else if (prediction.class === 'car') color = '#4ECDC4';
            else if (prediction.class === 'bicycle') color = '#45B7D1';

            // Draw bounding box
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);

            // Draw label
            const label = `${prediction.class}: ${(prediction.score * 100).toFixed(0)}%`;
            this.ctx.fillStyle = color;
            this.ctx.font = 'bold 14px Arial';

            const textWidth = this.ctx.measureText(label).width;
            this.ctx.fillRect(x, y - 25, textWidth + 10, 20);

            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, x + 5, y - 8);
        });
    }
}