export class DetectionSmoother {
    constructor(options = {}) {
        this.smoothingFactor = options.smoothingFactor || 0.05;
        this.maxDistance = options.maxDistance || 150;
        this.maxFramesWithoutDetection = options.maxFramesWithoutDetection || 120; // Much longer - 4 seconds
        this.minUpdateThreshold = options.minUpdateThreshold || 3;

        // New properties for temporal smoothing
        this.updateInterval = options.updateInterval || 30;
        this.frameCounter = 0;

        // Much more conservative confidence settings
        this.minConfidenceToShow = 0.05; // Show objects with very low confidence
        this.confidenceDecayRate = 0.005; // Very slow decay
        this.graceFrames = 30; // 1 second of grace before any decay

        this.trackedObjects = new Map();
        this.nextId = 0;
    }

    smoothDetections(rawDetections) {
        this.frameCounter++;

        const shouldUpdate = this.frameCounter % this.updateInterval === 0;
        const smoothedDetections = [];
        const usedDetections = new Set();

        // Update existing tracked objects
        for (const [id, tracked] of this.trackedObjects) {
            let bestMatch = null;
            let bestDistance = Infinity;

            // Find best matching detection
            rawDetections.forEach((detection, index) => {
                if (usedDetections.has(index)) return;

                if (this.classesMatch(detection.class, tracked.class)) {
                    const distance = this.calculateDistance(tracked.smoothedBbox, detection.bbox);
                    if (distance < this.maxDistance && distance < bestDistance) {
                        bestMatch = { detection, index, distance };
                        bestDistance = distance;
                    }
                }
            });

            if (bestMatch) {
                // Object detected - reset all decay
                const isStableObject = bestMatch.distance < 20 && tracked.stabilityFrames > 60;

                if (shouldUpdate || !isStableObject || tracked.framesSinceDetection > 10) {
                    const newBbox = this.applySmoothingToBbox(
                        tracked.smoothedBbox,
                        bestMatch.detection.bbox
                    );

                    if (bestMatch.distance > this.minUpdateThreshold || tracked.framesSinceLastUpdate > 45) {
                        tracked.smoothedBbox = newBbox;
                        tracked.framesSinceLastUpdate = 0;
                    } else {
                        tracked.framesSinceLastUpdate++;
                    }
                } else {
                    tracked.framesSinceLastUpdate++;
                }

                // Strong confidence boost when detected
                tracked.score = this.smoothValue(tracked.score, bestMatch.detection.score, 0.1);
                tracked.framesSinceDetection = 0;
                tracked.confidence = Math.min(tracked.confidence + 0.1, 1.0); // Stronger boost
                tracked.stabilityFrames = Math.min(tracked.stabilityFrames + 1, 120);

                smoothedDetections.push({
                    ...bestMatch.detection,
                    bbox: tracked.smoothedBbox,
                    score: tracked.score,
                    id: id
                });

                usedDetections.add(bestMatch.index);
            } else {
                // Object not detected - but be very conservative about fading
                tracked.framesSinceDetection++;

                // Much longer grace period and slower decay
                if (tracked.framesSinceDetection > this.graceFrames) {
                    tracked.confidence = Math.max(
                        tracked.confidence - this.confidenceDecayRate,
                        this.minConfidenceToShow
                    );
                }

                tracked.stabilityFrames = Math.max(tracked.stabilityFrames - 0.5, 0);

                // Keep showing object for much longer - almost never remove
                if (tracked.framesSinceDetection < this.maxFramesWithoutDetection) {

                    // Very gradual score reduction
                    const fadeScore = tracked.score * Math.max(
                        0.5, // Never go below 50% of original score
                        1 - (tracked.framesSinceDetection * 0.005) // Very slow fade
                    );

                    smoothedDetections.push({
                        class: tracked.class,
                        bbox: tracked.smoothedBbox,
                        score: fadeScore,
                        id: id,
                        isTracked: true,
                        isFading: tracked.framesSinceDetection > 60 // Only fade after 2 seconds
                    });
                }
            }
        }

        // Add new detections with very high initial confidence
        rawDetections.forEach((detection, index) => {
            if (!usedDetections.has(index)) {
                const newId = this.nextId++;

                this.trackedObjects.set(newId, {
                    id: newId,
                    class: detection.class,
                    smoothedBbox: [...detection.bbox],
                    score: detection.score,
                    framesSinceDetection: 0,
                    framesSinceLastUpdate: 0,
                    confidence: 0.9, // Very high initial confidence
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

        // Clean up very rarely - only every 10 seconds worth of frames
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

        // Handle common class variations
        const variations = {
            'person': ['face', 'human'],
            'face': ['person', 'human'],
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
