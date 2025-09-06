export class FaceRecognition {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.referenceImage = null;
        this.referenceEmbedding = null;
        this.similarityThreshold = 0.5;

        // Stable box management
        this.stableBox = null;
        this.lastUpdateTime = 0;
        this.updateInterval = 1000; // Update every 1 second
        this.frameCounter = 0;
        this.matchHistory = []; // Track recent matches for stability
        this.historySize = 10; // Keep last 10 detection results
    }

    async loadModel() {
        try {
            console.log('Loading BlazeFace model...');
            this.model = await blazeface.load();
            this.isLoaded = true;
            console.log('BlazeFace model loaded');
            return true;
        } catch (error) {
            console.error('Failed to load BlazeFace model:', error);
            return false;
        }
    }

    async loadReferenceImage(imageSource = '/images/face.jpg') {
        try {
            let img;

            if (typeof imageSource === 'string') {
                img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageSource;
                });
            } else {
                img = imageSource;
            }

            this.referenceImage = img;

            // Extract embedding from reference image
            if (this.isLoaded) {
                this.referenceEmbedding = await this.extractEmbedding(img);
                console.log('Reference image processed');
            }

            return true;
        } catch (error) {
            console.error('Failed to load reference image:', error);
            return false;
        }
    }

    async extractEmbedding(imageElement) {
        if (!this.isLoaded) return null;

        try {
            const predictions = await this.model.estimateFaces(imageElement, false);
            if (predictions.length > 0) {
                const face = predictions[0];
                const width = face.bottomRight[0] - face.topLeft[0];
                const height = face.bottomRight[1] - face.topLeft[1];
                const aspect = width / height;

                // Simple feature vector
                return [width, height, aspect, face.probability || 0.9];
            }
            return null;
        } catch (error) {
            console.error('Failed to extract embedding:', error);
            return null;
        }
    }

    calculateSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2) return 0;

        // Normalize the feature vectors to make comparison more stable
        const normalize = (arr) => {
            const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
            return magnitude > 0 ? arr.map(val => val / magnitude) : arr;
        };

        const norm1 = normalize(embedding1);
        const norm2 = normalize(embedding2);

        // Calculate cosine similarity instead of euclidean distance
        let dotProduct = 0;
        for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
            dotProduct += norm1[i] * norm2[i];
        }

        // Convert to similarity score (0-1), cosine similarity is already in [-1, 1]
        return Math.max(0, (dotProduct + 1) / 2); // Map [-1,1] to [0,1]
    }

    async detect(videoElement) {
        if (!this.isLoaded || !this.referenceEmbedding) {
            return this.stableBox ? [this.stableBox] : [];
        }

        this.frameCounter++;
        const currentTime = Date.now();

        // Only run actual detection periodically
        const shouldDetect = currentTime - this.lastUpdateTime >= this.updateInterval;

        if (!shouldDetect && this.stableBox) {
            // Return existing stable box
            return [this.stableBox];
        }

        try {
            const predictions = await this.model.estimateFaces(videoElement, false);

            let detectionResult = null;

            if (predictions.length > 0) {
                // Find the best face
                const bestFace = predictions.reduce((best, face) =>
                    (face.probability || 0.9) > (best.probability || 0.9) ? face : best
                );

                const bbox = [
                    Math.round(bestFace.topLeft[0]),
                    Math.round(bestFace.topLeft[1]),
                    Math.round(bestFace.bottomRight[0] - bestFace.topLeft[0]),
                    Math.round(bestFace.bottomRight[1] - bestFace.topLeft[1])
                ];

                // Skip tiny faces
                if (bbox[2] >= 30 && bbox[3] >= 30) {
                    // Calculate similarity - this is what we actually care about
                    const currentEmbedding = this.extractEmbeddingFromFace(bestFace);
                    if (currentEmbedding) {
                        const similarity = this.calculateSimilarity(this.referenceEmbedding, currentEmbedding);
                        const isMatch = similarity >= this.similarityThreshold;

                        if (isMatch) {
                            detectionResult = {
                                class: 'Face Match',
                                score: similarity, // Use similarity as the score - this is what matters
                                bbox: bbox,
                                similarity: similarity,
                                isMatch: true,
                                isFaceRecognition: true
                            };
                        }
                    }
                }
            }

            // Update match history
            this.matchHistory.push(detectionResult);
            if (this.matchHistory.length > this.historySize) {
                this.matchHistory.shift();
            }

            // Decide if we should show a stable box based on recent history
            const recentMatches = this.matchHistory.filter(r => r !== null);
            const matchRatio = recentMatches.length / this.matchHistory.length;

            if (shouldDetect) {
                this.lastUpdateTime = currentTime;

                // Update stable box if we have enough recent matches (>50%)
                if (matchRatio > 0.5 && detectionResult) {
                    if (this.stableBox) {
                        // Smooth transition to new position
                        this.stableBox = {
                            ...detectionResult,
                            bbox: [
                                Math.round(this.stableBox.bbox[0] * 0.7 + detectionResult.bbox[0] * 0.3),
                                Math.round(this.stableBox.bbox[1] * 0.7 + detectionResult.bbox[1] * 0.3),
                                Math.round(this.stableBox.bbox[2] * 0.8 + detectionResult.bbox[2] * 0.2),
                                Math.round(this.stableBox.bbox[3] * 0.8 + detectionResult.bbox[3] * 0.2)
                            ],
                            // Smooth the similarity score too
                            similarity: this.stableBox.similarity * 0.8 + detectionResult.similarity * 0.2,
                            score: this.stableBox.similarity * 0.8 + detectionResult.similarity * 0.2
                        };
                    } else {
                        // Create new stable box
                        this.stableBox = { ...detectionResult };
                    }
                } else if (matchRatio < 0.3) {
                    // Remove stable box if too few recent matches
                    this.stableBox = null;
                }
            }

            return this.stableBox ? [this.stableBox] : [];

        } catch (error) {
            console.error('Face detection error:', error);
            return this.stableBox ? [this.stableBox] : [];
        }
    }

    // Extract embedding from a specific face detection
    extractEmbeddingFromFace(face) {
        if (!face.topLeft || !face.bottomRight) return null;

        const width = face.bottomRight[0] - face.topLeft[0];
        const height = face.bottomRight[1] - face.topLeft[1];
        const aspect = width / height;

        // Simple feature vector based on face dimensions and landmarks
        const features = [width, height, aspect, face.probability || 0.9];

        // Add landmark features if available
        if (face.landmarks && face.landmarks.length > 0) {
            // Normalize landmarks relative to face box
            const centerX = (face.topLeft[0] + face.bottomRight[0]) / 2;
            const centerY = (face.topLeft[1] + face.bottomRight[1]) / 2;

            face.landmarks.forEach(point => {
                features.push((point[0] - centerX) / width);
                features.push((point[1] - centerY) / height);
            });
        }

        return features;
    }

    updateSettings(settings) {
        if (settings.similarityThreshold !== undefined) {
            this.similarityThreshold = settings.similarityThreshold;
        }
    }
}
