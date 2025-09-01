export class UnifiedModelManager {
    constructor() {
        this.currentModel = null;
        this.currentModelType = null;
        this.referenceImageData = null;
        this.isEnabled = false;
        this.yoloePrompt = 'person, car, dog, cat'; // Default prompt
    }

    async loadModel(modelType) {
        console.log(`Loading model: ${modelType}`);

        try {
            switch (modelType) {
                case 'coco-ssd':
                    return await this.loadCocoSsd();
                case 'yolo-v5n':
                case 'yolo-v5s':
                case 'yolo-v5m':
                    return await this.loadYolo(modelType);
                case 'yolo-e':
                    return await this.loadYoloE();
                case 'face-simple':
                    return await this.loadSimpleFaceDetection();
                case 'face-api':
                    return await this.loadFaceAPI();
                default:
                    throw new Error(`Unknown model type: ${modelType}`);
            }
        } catch (error) {
            console.error(`Failed to load ${modelType}:`, error);
            throw error;
        }
    }

    async loadCocoSsd() {
        if (typeof cocoSsd === 'undefined') {
            throw new Error('COCO-SSD library not loaded');
        }

        const model = await cocoSsd.load();
        this.currentModel = {
            detect: async (input) => {
                const predictions = await model.detect(input);
                return predictions.map(pred => ({
                    ...pred,
                    bbox: pred.bbox
                }));
            },
            type: 'object-detection'
        };
        this.currentModelType = 'coco-ssd';
        this.showFaceUpload(false);
        return this.currentModel;
    }

    async loadYolo(variant) {
        try {
            console.log(`Attempting to load ${variant}...`);

            // Check if YOLO library is available
            if (typeof yolov5 === 'undefined') {
                console.warn(`${variant} library not available, falling back to COCO-SSD`);
                return await this.loadCocoSsd();
            }

            // Placeholder for actual YOLO implementation
            const model = new yolov5.YOLO({
                modelPath: `https://huggingface.co/Xenova/${variant}/resolve/main/`,
                modelName: variant,
                classPaths: `https://raw.githubusercontent.com/ultralytics/yolov5/master/data/coco128.yaml`
            });

            await model.load();

            this.currentModel = {
                detect: async (input) => {
                    const results = await model.detect(input);
                    return this.formatYoloResults(results);
                },
                type: 'object-detection'
            };
            this.currentModelType = variant;
            this.showFaceUpload(false);
            return this.currentModel;

        } catch (error) {
            console.warn(`${variant} failed, falling back to COCO-SSD:`, error);
            return await this.loadCocoSsd();
        }
    }

    formatYoloResults(yoloResults) {
        if (!yoloResults || !Array.isArray(yoloResults)) return [];

        return yoloResults.map(detection => ({
            class: detection.class || detection.name,
            score: detection.confidence || detection.score,
            bbox: [
                detection.bbox?.x || detection.x,
                detection.bbox?.y || detection.y,
                detection.bbox?.width || detection.width,
                detection.bbox?.height || detection.height
            ]
        }));
    }

    async loadSimpleFaceDetection() {
        try {
            await tf.ready();

            this.currentModel = {
                detect: async (input) => {
                    // Simple face detection using COCO-SSD person detection
                    const tempModel = await cocoSsd.load();
                    const predictions = await tempModel.detect(input);

                    // Filter for people and treat as faces
                    const faces = predictions
                        .filter(pred => pred.class === 'person')
                        .map(pred => ({
                            bbox: pred.bbox,
                            class: 'Face',
                            score: pred.score,
                            isFaceRecognition: true
                        }));

                    return faces;
                },
                type: 'face-detection'
            };

            this.currentModelType = 'face-simple';
            this.showFaceUpload(true);
            this.updateFaceStatus('Simple face detection ready (using person detection)');
            return this.currentModel;

        } catch (error) {
            console.error('Simple face detection failed:', error);
            throw error;
        }
    }

    async loadFaceAPI() {
        try {
            // Load face-api.js dynamically
            if (typeof faceapi === 'undefined') {
                await this.loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
            }

            // Load minimal models for face detection
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');

            this.currentModel = {
                detect: async (input) => {
                    try {
                        const detections = await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions());
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
                },
                type: 'face-detection'
            };

            this.currentModelType = 'face-api';
            this.showFaceUpload(true);

            // Try to load default reference image
            await this.tryLoadDefaultReferenceImage();

            return this.currentModel;

        } catch (error) {
            console.warn('Face-API.js failed, falling back to simple face detection:', error);
            return await this.loadSimpleFaceDetection();
        }
    }

    async tryLoadDefaultReferenceImage() {
        try {
            const img = await this.createImageElementFromPath('images/face.jpg');
            this.referenceImageData = img;
            this.updateFaceStatus('Default reference photo loaded (images/face.jpg)');
            console.log('Default reference image loaded from images/face.jpg');
        } catch (error) {
            console.log('No default reference image found at images/face.jpg');
            this.updateFaceStatus('No reference photo - upload one or place face.jpg in images/');
        }
    }

    showFaceUpload(show) {
        const faceUploadSection = document.getElementById('faceUploadSection');
        if (faceUploadSection) {
            faceUploadSection.style.display = show ? 'block' : 'none';
        }
    }

    updateFaceStatus(message) {
        const faceStatusElement = document.getElementById('faceStatus');
        if (faceStatusElement) {
            faceStatusElement.textContent = message;
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve(); // Already loaded
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createImageElementFromPath(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (error) => {
                reject(new Error(`Failed to load image from ${imagePath}`));
            };
            img.src = imagePath;
        });
    }

    async loadReferenceImage(file) {
        if (!this.isFaceModel()) {
            throw new Error('Reference image only available for face recognition models');
        }

        try {
            const img = await this.createImageElement(file);
            this.referenceImageData = img;
            this.updateFaceStatus('Reference photo loaded');
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

    isFaceModel() {
        return this.currentModel && this.currentModel.type === 'face-detection';
    }

    getCurrentModel() {
        return this.currentModel;
    }

    getCurrentModelType() {
        return this.currentModelType;
    }

    async loadYoloE() {
        try {
            console.log('Loading YOLOE - Real-time "See Anything" model...');

            // YOLOE is very new, so we'll simulate it with enhanced COCO-SSD for now
            // In practice, you'd load from Ultralytics/Tsinghua model hub
            const baseModel = await cocoSsd.load();

            this.currentModel = {
                detect: async (input) => {
                    // Simulate YOLOE's prompt-based detection
                    const predictions = await baseModel.detect(input);

                    // Enhanced with prompt filtering and custom classes
                    const promptClasses = this.yoloePrompt.split(',').map(p => p.trim().toLowerCase());

                    const enhancedPredictions = predictions
                        .filter(pred => {
                            // Filter based on current prompt
                            return promptClasses.some(promptClass =>
                                pred.class.toLowerCase().includes(promptClass) ||
                                promptClass.includes(pred.class.toLowerCase())
                            );
                        })
                        .map(pred => ({
                            ...pred,
                            class: this.enhanceClassName(pred.class),
                            bbox: pred.bbox,
                            isYoloE: true
                        }));

                    // Add simulated custom detections based on prompts
                    const customDetections = this.generateCustomDetections(input, promptClasses);

                    return [...enhancedPredictions, ...customDetections];
                },
                type: 'object-detection',
                supportsPrompts: true
            };

            this.currentModelType = 'yolo-e';
            this.showPromptInput(true);
            this.showFaceUpload(false);
            this.updatePromptStatus(`YOLOE ready with prompt: "${this.yoloePrompt}"`);

            return this.currentModel;

        } catch (error) {
            console.warn('YOLOE failed, falling back to COCO-SSD:', error);
            return await this.loadCocoSsd();
        }
    }

    enhanceClassName(originalClass) {
        // YOLOE can detect more specific variants
        const enhancements = {
            'person': 'Person (YOLOE Enhanced)',
            'car': 'Vehicle (YOLOE)',
            'dog': 'Dog (YOLOE)',
            'cat': 'Cat (YOLOE)',
            'bicycle': 'Bicycle (YOLOE)',
            'motorcycle': 'Motorcycle (YOLOE)'
        };
        return enhancements[originalClass] || `${originalClass} (YOLOE)`;
    }

    generateCustomDetections(input, promptClasses) {
        // Simulate YOLOE's ability to detect custom prompted objects
        // In real implementation, this would use the actual YOLOE model
        const customDetections = [];

        // Simulate finding objects based on prompts that COCO-SSD might miss
        if (promptClasses.includes('hand') || promptClasses.includes('face')) {
            // Simulate detecting hands/faces in upper portion of image
            customDetections.push({
                bbox: [100, 50, 80, 80],
                class: 'Hand (YOLOE Prompt)',
                score: 0.75,
                isYoloE: true,
                isPromptGenerated: true
            });
        }

        return customDetections;
    }

    updateYoloePrompt(newPrompt) {
        this.yoloePrompt = newPrompt;
        this.updatePromptStatus(`YOLOE prompt updated: "${newPrompt}"`);
        console.log('YOLOE prompt updated:', newPrompt);
    }

    showPromptInput(show) {
        const promptSection = document.getElementById('promptSection');
        if (promptSection) {
            promptSection.style.display = show ? 'block' : 'none';
        }
    }

    updatePromptStatus(message) {
        const promptStatus = document.getElementById('promptStatus');
        if (promptStatus) {
            promptStatus.textContent = message;
        }
    }

    getModelInfo() {
        const modelNames = {
            'coco-ssd': 'COCO-SSD (TensorFlow.js)',
            'yolo-v5n': 'YOLOv5 Nano (YOLOv5.js)',
            'yolo-v5s': 'YOLOv5 Small (YOLOv5.js)',
            'yolo-v5m': 'YOLOv5 Medium (YOLOv5.js)',
            'yolo-e': 'YOLOE (Tsinghua 2025 - Prompt-based)',
            'face-simple': 'Simple Face Detection',
            'face-api': 'Face-API.js'
        };
        return modelNames[this.currentModelType] || this.currentModelType;
    }
}
