export class FaceRecognitionManager {
    constructor() {
        this.faceModel = null;
        this.faceModelType = 'none';
        this.referenceDescriptor = null;
        this.isEnabled = false;
        this.referenceImageData = null;
    }

    async loadFaceModel(modelType) {
        console.log(`Loading face model: ${modelType}`);

        try {
            switch (modelType) {
                case 'mediapipe':
                    await this.loadMediaPipe();
                    break;
                case 'face-api':
                    await this.loadFaceAPI();
                    break;
                case 'none':
                    this.disableFaceRecognition();
                    return true;
                default:
                    throw new Error(`Unknown face model type: ${modelType}`);
            }

            this.faceModelType = modelType;
            this.updateFaceStatus(`${modelType} loaded - ready for reference photo`);

            // Enable upload button
            document.getElementById('uploadBtn').disabled = false;

            return true;
        } catch (error) {
            console.error('Face model loading failed:', error);
            this.updateFaceStatus(`Failed to load ${modelType}: ${error.message}`);
            return false;
        }
    }

    async loadMediaPipe() {
        // Load MediaPipe dynamically
        if (typeof FaceDetection === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/face_detection.js');
        }

        this.faceModel = {
            type: 'mediapipe',
            detect: async (videoElement) => {
                // MediaPipe face detection implementation
                // This is a placeholder - MediaPipe requires more complex setup
                console.log('MediaPipe face detection not fully implemented yet');
                return [];
            }
        };
    }

    async loadFaceAPI() {
        // Load face-api.js dynamically
        if (typeof faceapi === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
        }

        // Load minimal models for face detection only
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');

        this.faceModel = {
            type: 'face-api',
            detect: async (videoElement) => {
                try {
                    const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
                    return detections.map(detection => ({
                        bbox: [
                            detection.box.x,
                            detection.box.y,
                            detection.box.width,
                            detection.box.height
                        ],
                        class: this.referenceImageData ? 'Person' : 'Face',
                        score: 0.8,
                        isFaceRecognition: true
                    }));
                } catch (error) {
                    console.error('Face-API detection error:', error);
                    return [];
                }
            }
        };
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    disableFaceRecognition() {
        this.faceModel = null;
        this.isEnabled = false;
        this.referenceImageData = null;
        this.updateFaceStatus('Face recognition disabled');
        document.getElementById('uploadBtn').disabled = true;
    }

    async loadReferenceImage(file) {
        if (!this.faceModel) {
            throw new Error('No face model loaded');
        }

        try {
            const img = await this.createImageElement(file);
            this.referenceImageData = img;
            this.isEnabled = true;

            this.updateFaceStatus(`Reference photo loaded (${this.faceModelType})`);
            console.log('Reference image loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading reference image:', error);
            this.updateFaceStatus('Failed to load reference photo');
            return false;
        }
    }

    createImageElement(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    async detectFaces(videoElement) {
        if (!this.faceModel || !this.isEnabled) {
            return [];
        }

        return await this.faceModel.detect(videoElement);
    }

    updateFaceStatus(message) {
        const faceStatusElement = document.getElementById('faceStatus');
        const currentFaceModelElement = document.getElementById('currentFaceModel');

        if (faceStatusElement) {
            faceStatusElement.textContent = message;
        }
        if (currentFaceModelElement) {
            currentFaceModelElement.textContent = this.faceModelType;
        }
    }

    isActive() {
        return this.faceModel && this.isEnabled;
    }

    getModelType() {
        return this.faceModelType;
    }
}
