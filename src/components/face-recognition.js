export class FaceRecognition {
    constructor() {
        this.blazeFaceModel = null;
        this.referenceEmbedding = null;
        this.referenceImage = null;
        this.isLoaded = false;
        this.similarityThreshold = 0.7;
        this.showAllFaces = true;
        this.highlightMatches = true;
    }

    async loadModel() {
        try {
            console.log('Loading BlazeFace model...');
            this.blazeFaceModel = await blazeface.load();
            this.isLoaded = true;
            console.log('BlazeFace model loaded successfully');
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

            if (this.isLoaded) {
                this.referenceEmbedding = await this.extractFaceEmbedding(img);
                console.log('Reference image loaded and processed');
                return true;
            }
        } catch (error) {
            console.error('Failed to load reference image:', error);
            this.referenceImage = null;
            this.referenceEmbedding = null;
            return false;
        }
    }

    async extractFaceEmbedding(imageElement) {
        if (!this.isLoaded) return null;

        try {
            const predictions = await this.blazeFaceModel.estimateFaces(imageElement, false);
            if (predictions.length > 0) {
                return this.createSimpleEmbedding(predictions[0]);
            }
            return null;
        } catch (error) {
            console.error('Failed to extract face embedding:', error);
            return null;
        }
    }

    createSimpleEmbedding(face) {
        const topLeft = face.topLeft;
        const bottomRight = face.bottomRight;
        const landmarks = face.landmarks;

        if (!topLeft || !bottomRight) return null;

        const features = [
            bottomRight[0] - topLeft[0], // width
            bottomRight[1] - topLeft[1], // height
            (bottomRight[0] - topLeft[0]) / (bottomRight[1] - topLeft[1]), // aspect ratio
        ];

        if (landmarks) {
            const centerX = (topLeft[0] + bottomRight[0]) / 2;
            const centerY = (topLeft[1] + bottomRight[1]) / 2;
            const scale = Math.max(bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]);

            landmarks.forEach(point => {
                features.push((point[0] - centerX) / scale);
                features.push((point[1] - centerY) / scale);
            });
        }

        return features;
    }

    async detect(videoElement) {
        if (!this.isLoaded) return [];

        try {
            const predictions = await this.blazeFaceModel.estimateFaces(videoElement, false);
            const results = [];

            for (const face of predictions) {
                const topLeft = face.topLeft;
                const bottomRight = face.bottomRight;

                if (!topLeft || !bottomRight) continue;

                const bbox = [
                    Math.round(topLeft[0]),
                    Math.round(topLeft[1]),
                    Math.round(bottomRight[0] - topLeft[0]),
                    Math.round(bottomRight[1] - topLeft[1])
                ];

                // Skip very small faces
                if (bbox[2] < 30 || bbox[3] < 30) continue;

                let isMatch = false;
                let similarity = 0;

                // Check similarity with reference if available
                if (this.referenceEmbedding) {
                    const currentEmbedding = this.createSimpleEmbedding(face);
                    if (currentEmbedding) {
                        similarity = this.calculateSimilarity(this.referenceEmbedding, currentEmbedding);
                        isMatch = similarity >= this.similarityThreshold;
                    }
                }

                // Apply settings filters
                const shouldShow = this.showAllFaces || (isMatch && this.highlightMatches);

                if (shouldShow) {
                    results.push({
                        class: isMatch ? 'Reference Match' : 'Face',
                        score: Math.max(0.75, face.probability || 0.9),
                        bbox: bbox,
                        similarity: similarity,
                        isMatch: isMatch,
                        isFaceRecognition: true
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Face detection error:', error);
            return [];
        }
    }

    calculateSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2) return 0;

        const minLength = Math.min(embedding1.length, embedding2.length);
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < minLength; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        if (norm1 === 0 || norm2 === 0) return 0;

        const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
        return Math.max(0, Math.min(1, similarity));
    }

    updateSettings(settings) {
        if (settings.similarityThreshold !== undefined) {
            this.similarityThreshold = settings.similarityThreshold;
        }
        if (settings.showAllFaces !== undefined) {
            this.showAllFaces = settings.showAllFaces;
        }
        if (settings.highlightMatches !== undefined) {
            this.highlightMatches = settings.highlightMatches;
        }
    }
}
