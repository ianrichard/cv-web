export class FaceDetector {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.isRunning = false;
        this.animationFrame = null;

        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.videoElement = null;

        // Face recognition
        this.referenceEmbedding = null;
        this.similarityThreshold = 0.5;

        // Single face tracking
        this.currentFace = null;
        this.frameCount = 0;

        // Performance
        this.fps = 0;
        this.lastTime = performance.now();
        this.frameCounter = 0;
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

    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
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

            console.log('Loading reference image:', typeof imageSource === 'string' ? imageSource : 'uploaded image');

            // Extract embedding from reference
            if (this.isLoaded) {
                const faces = await this.model.estimateFaces(img, false);
                console.log(`Found ${faces.length} faces in reference image`);

                if (faces.length > 0) {
                    const oldEmbedding = this.referenceEmbedding ? [...this.referenceEmbedding] : null;
                    this.referenceEmbedding = this.extractEmbedding(faces[0]);

                    console.log('Old reference embedding:', oldEmbedding ? oldEmbedding.slice(0, 4) : 'none');
                    console.log('New reference embedding:', this.referenceEmbedding ? this.referenceEmbedding.slice(0, 4) : 'failed');
                    console.log('Reference embedding updated successfully');
                } else {
                    console.warn('No faces found in reference image!');
                    this.referenceEmbedding = null;
                }
            } else {
                console.warn('Model not loaded yet, reference will be processed later');
            }

            return true;
        } catch (error) {
            console.error('Failed to load reference image:', error);
            this.referenceEmbedding = null;
            return false;
        }
    }

    extractEmbedding(face) {
        if (!face.topLeft || !face.bottomRight) return null;

        const width = face.bottomRight[0] - face.topLeft[0];
        const height = face.bottomRight[1] - face.topLeft[1];
        const aspect = width / height;

        // Start with basic face dimensions but normalize them
        const features = [
            width / 100,  // Normalize width to 0-10 range roughly
            height / 100, // Normalize height to 0-10 range roughly
            aspect,       // Keep aspect ratio as-is
            face.probability || 0.9
        ];

        // Add landmark features if available - this is key for face distinction
        if (face.landmarks && face.landmarks.length > 0) {
            const centerX = (face.topLeft[0] + face.bottomRight[0]) / 2;
            const centerY = (face.topLeft[1] + face.bottomRight[1]) / 2;

            face.landmarks.forEach(point => {
                // Normalize landmarks relative to face box AND scale them
                const normalizedX = ((point[0] - centerX) / width) * 10; // Scale up for more distinction
                const normalizedY = ((point[1] - centerY) / height) * 10; // Scale up for more distinction
                features.push(normalizedX, normalizedY);
            });
        } else {
            console.warn('No landmarks available for face - similarity will be less accurate');
        }

        return features;
    }

    calculateSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2) return 0;

        console.log('Embedding 1 length:', embedding1.length);
        console.log('Embedding 2 length:', embedding2.length);
        console.log('Embedding 1 full:', embedding1);
        console.log('Embedding 2 full:', embedding2);

        // If embeddings have very different lengths, they're definitely different faces
        if (Math.abs(embedding1.length - embedding2.length) > 2) {
            console.log('Different embedding lengths - very different faces');
            return 0;
        }

        const minLength = Math.min(embedding1.length, embedding2.length);

        // Calculate euclidean distance (lower = more similar)
        let sumSquaredDiffs = 0;
        for (let i = 0; i < minLength; i++) {
            const diff = embedding1[i] - embedding2[i];
            sumSquaredDiffs += diff * diff;
        }

        const euclideanDistance = Math.sqrt(sumSquaredDiffs);
        console.log('Euclidean distance:', euclideanDistance);

        // Convert distance to similarity (0-1, where 1 = identical)
        // Use a threshold that makes sense for face features
        const maxDistance = 50; // Adjust this based on testing
        const similarity = Math.max(0, 1 - (euclideanDistance / maxDistance));

        console.log('Calculated similarity:', similarity);
        return similarity;
    }

    async startDetection(videoElement) {
        if (!this.isLoaded || !this.canvas) {
            console.error('Face detector not ready');
            return;
        }

        this.videoElement = videoElement;
        this.isRunning = true;
        this.detectLoop();
    }

    stopDetection() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        // Clear the canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    async detectLoop() {
        if (!this.isRunning) return;

        try {
            this.frameCount++;

            // Run detection every frame
            const faces = await this.model.estimateFaces(this.videoElement, false);

            if (faces.length > 0) {
                const bestFace = faces.reduce((best, face) =>
                    (face.probability || 0.9) > (best.probability || 0.9) ? face : best
                );

                let similarity = 0;
                if (this.referenceEmbedding) {
                    const currentEmbedding = this.extractEmbedding(bestFace);
                    if (currentEmbedding) {
                        similarity = this.calculateSimilarity(this.referenceEmbedding, currentEmbedding);

                        // Debug logging every 30 frames
                        if (this.frameCount % 30 === 0) {
                            console.log(`Current embedding (first 4):`, currentEmbedding.slice(0, 4));
                            console.log(`Reference embedding (first 4):`, this.referenceEmbedding.slice(0, 4));
                            console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);
                        }
                    }
                } else {
                    console.warn('No reference embedding available for comparison');
                }

                if (similarity >= this.similarityThreshold || !this.referenceEmbedding) {
                    if (this.frameCount % 5 === 0 || !this.currentFace) {
                        this.updateFace(bestFace, similarity);
                    }
                } else {
                    this.currentFace = null;
                }
            } else {
                this.currentFace = null;
            }

            // Clear and draw
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            const canvasLogicalWidth = rect.width;
            const canvasLogicalHeight = rect.height;
            this.ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);

            if (this.currentFace) {
                this.drawFace();
            }

            this.updatePerformance();

        } catch (error) {
            console.error('Face detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop());
    }

    updateFace(face, similarity) {
        const bbox = [
            Math.round(face.topLeft[0]),
            Math.round(face.topLeft[1]),
            Math.round(face.bottomRight[0] - face.topLeft[0]),
            Math.round(face.bottomRight[1] - face.topLeft[1])
        ];

        if (this.currentFace) {
            // Light smoothing - 80% old + 20% new
            this.currentFace.bbox = [
                Math.round(this.currentFace.bbox[0] * 0.8 + bbox[0] * 0.2),
                Math.round(this.currentFace.bbox[1] * 0.8 + bbox[1] * 0.2),
                Math.round(this.currentFace.bbox[2] * 0.9 + bbox[2] * 0.1),
                Math.round(this.currentFace.bbox[3] * 0.9 + bbox[3] * 0.1)
            ];
            // Smooth similarity updates
            this.currentFace.similarity = this.currentFace.similarity * 0.8 + similarity * 0.2;
        } else {
            // Create new face box
            this.currentFace = {
                bbox: bbox,
                similarity: similarity
            };
        }
    }

    drawFace() {
        if (!this.currentFace || !this.ctx) return;

        // Use the same responsive canvas sizing as the main detector
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Get actual display dimensions (not canvas buffer dimensions)
        const canvasLogicalWidth = rect.width;
        const canvasLogicalHeight = rect.height;

        // Use the same scaling logic as the main detector's drawPredictions method
        const videoAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
        const containerAspect = canvasLogicalWidth / canvasLogicalHeight;

        let scaleX, scaleY, offsetX = 0, offsetY = 0;

        if (videoAspect > containerAspect) {
            // Video is wider than container - fit to height, crop sides
            scaleY = canvasLogicalHeight / this.videoElement.videoHeight;
            scaleX = scaleY;
            offsetX = (canvasLogicalWidth - (this.videoElement.videoWidth * scaleX)) / 2;
        } else {
            // Video is taller than container - fit to width, crop top/bottom
            scaleX = canvasLogicalWidth / this.videoElement.videoWidth;
            scaleY = scaleX;
            offsetY = (canvasLogicalHeight - (this.videoElement.videoHeight * scaleY)) / 2;
        }

        // Scale face coordinates using the same logic as main detector
        const [x, y, width, height] = this.currentFace.bbox;
        const scaledX = (x * scaleX) + offsetX;
        const scaledY = (y * scaleY) + offsetY;
        const scaledWidth = width * scaleX;
        const scaledHeight = height * scaleY;

        // Draw red box for face match
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

        // Draw label - ONLY show similarity percentage
        const label = `Face Match ${(this.currentFace.similarity * 100).toFixed(0)}%`;

        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        const textMetrics = this.ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 14 * 1.2;

        // Draw background
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(scaledX, scaledY - textHeight - 8, textWidth + 12, textHeight + 4);

        // Draw text
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(label, scaledX + 6, scaledY - textHeight - 4);
    }

    updatePerformance() {
        this.frameCounter++;
        const now = performance.now();

        if (now - this.lastTime >= 1000) {
            this.fps = this.frameCounter;
            this.frameCounter = 0;
            this.lastTime = now;

            // Update UI if elements exist
            const fpsElement = document.getElementById('fpsCounter');
            const objectCountElement = document.getElementById('objectCount');

            if (fpsElement) fpsElement.textContent = this.fps;
            if (objectCountElement) objectCountElement.textContent = this.currentFace ? 1 : 0;
        }
    }

    updateSettings(settings) {
        if (settings.similarityThreshold !== undefined) {
            this.similarityThreshold = settings.similarityThreshold;
        }
    }
}
