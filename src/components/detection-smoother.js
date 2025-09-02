export class DetectionSmoother {
    constructor(options = {}) {
        this.smoothingFactor = options.smoothingFactor || 0.05;
        this.maxDistance = options.maxDistance || 150;
        this.maxFramesWithoutDetection = options.maxFramesWithoutDetection || 120;
        this.minUpdateThreshold = options.minUpdateThreshold || 3;

        // Visual update timing - update displayed boxes even less frequently for faces
        this.updateInterval = options.updateInterval || 30;
        this.visualUpdateInterval = options.visualUpdateInterval || 60; // ~2 seconds at 30fps
        this.frameCounter = 0;

        // Much more conservative confidence settings
        this.minConfidenceToShow = 0.05;
        this.confidenceDecayRate = 0.005;
        this.graceFrames = 30;

        this.trackedObjects = new Map();
        this.nextId = 0;
    }

    smoothDetections(rawDetections) {
        this.frameCounter++;

        const smoothedDetections = [];
        const usedDetections = new Set();

        // For face recognition, pass through completely unchanged - no additional smoothing
        const faceDetections = rawDetections.filter(d => d.isFaceRecognition);
        const otherDetections = rawDetections.filter(d => !d.isFaceRecognition);

        // Add face detections directly with no processing
        faceDetections.forEach(detection => {
            smoothedDetections.push({
                ...detection,
                id: 'face'
            });
        });

        // Handle non-face detections with normal smoothing
        const shouldUpdate = this.frameCounter % this.updateInterval === 0;
        const shouldVisuallyUpdate = this.frameCounter % this.visualUpdateInterval === 0;

        // Sort tracked objects by stability first, then confidence
        const sortedTracked = Array.from(this.trackedObjects.entries())
            .sort(([,a], [,b]) => {
                const stabilityDiff = (b.stabilityFrames || 0) - (a.stabilityFrames || 0);
                if (Math.abs(stabilityDiff) > 30) return stabilityDiff;
                return (b.confidence || 0) - (a.confidence || 0);
            });

        // Update existing tracked objects (for non-face objects only)
        for (const [id, tracked] of sortedTracked) {
            if (tracked.isFaceRecognition) continue; // Skip faces

            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;

            // Find best matching detection
            otherDetections.forEach((detection, detectionIndex) => {
                if (usedDetections.has(detectionIndex)) return;

                if (this.classesMatch(detection.class, tracked.class)) {
                    const distance = this.calculateDistance(tracked.smoothedBbox || tracked.displayedBbox, detection.bbox);
                    if (distance < this.maxDistance && distance < bestDistance) {
                        bestMatch = detection;
                        bestDistance = distance;
                        bestIndex = detectionIndex;
                    }
                }
            });

            if (bestMatch) {
                // Normal object smoothing logic
                const isStableObject = bestDistance < 20 && (tracked.stabilityFrames || 0) > 60;

                if (shouldUpdate || !isStableObject || (tracked.framesSinceDetection || 0) > 10) {
                    const newBbox = this.applySmoothingToBbox(
                        tracked.smoothedBbox || tracked.displayedBbox,
                        bestMatch.bbox
                    );

                    if (shouldVisuallyUpdate || !isStableObject || (tracked.framesSinceLastVisualUpdate || 0) > 45) {
                        tracked.displayedBbox = [...newBbox];
                        tracked.framesSinceLastVisualUpdate = 0;
                    } else {
                        tracked.framesSinceLastVisualUpdate = (tracked.framesSinceLastVisualUpdate || 0) + 1;
                    }

                    if (bestDistance > this.minUpdateThreshold || (tracked.framesSinceLastUpdate || 0) > 45) {
                        tracked.smoothedBbox = newBbox;
                        tracked.framesSinceLastUpdate = 0;
                    } else {
                        tracked.framesSinceLastUpdate = (tracked.framesSinceLastUpdate || 0) + 1;
                    }
                } else {
                    tracked.framesSinceLastUpdate = (tracked.framesSinceLastUpdate || 0) + 1;
                    tracked.framesSinceLastVisualUpdate = (tracked.framesSinceLastVisualUpdate || 0) + 1;
                }

                tracked.score = this.smoothValue(tracked.score, bestMatch.score, 0.05);
                tracked.framesSinceDetection = 0;
                tracked.confidence = Math.min((tracked.confidence || 0) + 0.1, 1.0);
                tracked.stabilityFrames = Math.min((tracked.stabilityFrames || 0) + 1, 180);
                tracked.class = bestMatch.class;

                smoothedDetections.push({
                    ...bestMatch,
                    bbox: tracked.displayedBbox || tracked.smoothedBbox,
                    score: tracked.score,
                    class: tracked.class,
                    id: id
                });

                usedDetections.add(bestIndex);
            } else {
                // Object not detected - fade logic for non-faces
                tracked.framesSinceDetection = (tracked.framesSinceDetection || 0) + 1;
                tracked.framesSinceLastVisualUpdate = (tracked.framesSinceLastVisualUpdate || 0) + 1;

                if (tracked.framesSinceDetection > this.graceFrames) {
                    tracked.confidence = Math.max(
                        (tracked.confidence || 0) - this.confidenceDecayRate,
                        this.minConfidenceToShow
                    );
                }

                tracked.stabilityFrames = Math.max((tracked.stabilityFrames || 0) - 0.2, 0);

                if (tracked.framesSinceDetection < this.maxFramesWithoutDetection) {
                    const fadeScore = tracked.score * Math.max(0.6, 1 - (tracked.framesSinceDetection * 0.003));

                    smoothedDetections.push({
                        class: tracked.class,
                        bbox: tracked.displayedBbox || tracked.smoothedBbox,
                        score: fadeScore,
                        id: id,
                        isTracked: true,
                        isFading: tracked.framesSinceDetection > 90
                    });
                }
            }
        }

        // Add new detections (non-face only)
        otherDetections.forEach((detection, detectionIndex) => {
            if (!usedDetections.has(detectionIndex)) {
                const newId = this.nextId++;

                this.trackedObjects.set(newId, {
                    id: newId,
                    class: detection.class,
                    smoothedBbox: [...detection.bbox],
                    displayedBbox: [...detection.bbox],
                    score: detection.score,
                    framesSinceDetection: 0,
                    framesSinceLastUpdate: 0,
                    framesSinceLastVisualUpdate: 0,
                    confidence: 0.9,
                    stabilityFrames: 0,
                    createdAt: Date.now()
                });

                smoothedDetections.push({
                    ...detection,
                    id: newId,
                    isNew: true
                });
            }
        });

        // Clean up old objects
        if (this.frameCounter % 300 === 0) {
            this.cleanupOldObjects();
        }

        return smoothedDetections;
    }

    applySmoothingToBbox(oldBbox, newBbox, customFactor = null) {
        const factor = customFactor || this.smoothingFactor;
        return [
            this.smoothCoordinate(oldBbox[0], newBbox[0], factor), // x
            this.smoothCoordinate(oldBbox[1], newBbox[1], factor), // y
            this.smoothCoordinate(oldBbox[2], newBbox[2], factor), // width
            this.smoothCoordinate(oldBbox[3], newBbox[3], factor)  // height
        ];
    }

    smoothCoordinate(oldValue, newValue, factor) {
        // Apply very heavy smoothing with larger deadband
        const diff = Math.abs(newValue - oldValue);

        // Ignore very small movements completely
        if (diff < 5) {
            return oldValue;
        }

        // Much heavier smoothing - boxes should barely move
        return oldValue * (1 - factor) + newValue * factor;
    }

    smoothValue(oldValue, newValue, factor) {
        return oldValue * (1 - factor) + newValue * factor;
    }

    calculateDistance(bbox1, bbox2) {
        const cx1 = bbox1[0] + bbox1[2] / 2;
        const cy1 = bbox1[1] + bbox1[3] / 2;
        const cx2 = bbox2[0] + bbox2[2] / 2;
        const cy2 = bbox2[1] + bbox2[3] / 2;

        return Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
    }

    classesMatch(class1, class2) {
        if (class1 === class2) return true;

        // For faces, be VERY strict about matching
        const variations = {
            'person': ['face', 'human'],
            'face': ['person', 'human'],
            'Reference Match': ['Reference Match'], // Only match exactly
            'car': ['vehicle'],
            'bicycle': ['bike'],
            'motorcycle': ['motorbike']
        };

        const c1 = class1.toLowerCase();
        const c2 = class2.toLowerCase();

        return variations[c1]?.includes(c2) || variations[c2]?.includes(c1) || false;
    }

    cleanupOldObjects() {
        const now = Date.now();
        for (const [id, tracked] of this.trackedObjects) {
            // Only remove objects that are VERY old and have been undetected for a long time
            if (tracked.framesSinceDetection >= this.maxFramesWithoutDetection &&
                tracked.confidence < 0.01 &&
                now - tracked.createdAt > 20000) { // 20 seconds minimum life
                this.trackedObjects.delete(id);
            }
        }
    }

    reset() {
        this.trackedObjects.clear();
        this.nextId = 0;
    }

    getTrackingStats() {
        return {
            trackedCount: this.trackedObjects.size,
            nextId: this.nextId
        };
    }
}
