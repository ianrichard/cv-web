export class ModelSelector {
    constructor() {
        this.currentModel = null;
        this.currentModelType = null;
        this.models = {
            'coco-ssd': {
                name: 'COCO-SSD',
                loader: () => this.loadCocoSsd(),
                classes: 80
            },
            'yolo-v5n': {
                name: 'YOLOv5 Nano',
                loader: () => this.loadYolo('yolov5n'),
                classes: 80
            },
            'yolo-v5s': {
                name: 'YOLOv5 Small',
                loader: () => this.loadYolo('yolov5s'),
                classes: 80
            },
            'yolo-v5m': {
                name: 'YOLOv5 Medium',
                loader: () => this.loadYolo('yolov5m'),
                classes: 80
            }
        };
    }

    async loadModel(modelType) {
        if (!this.models[modelType]) {
            throw new Error(`Unknown model type: ${modelType}`);
        }

        console.log(`Loading ${this.models[modelType].name}...`);
        this.currentModel = await this.models[modelType].loader();
        this.currentModelType = modelType;

        console.log(`${this.models[modelType].name} loaded successfully`);
        return this.currentModel;
    }

    async loadCocoSsd() {
        if (typeof cocoSsd === 'undefined') {
            throw new Error('COCO-SSD library not loaded');
        }
        return await cocoSsd.load();
    }

    async loadYolo(variant) {
        try {
            // Use YOLOv5.js library
            const model = new yolov5.YOLO({
                modelPath: `https://huggingface.co/Xenova/${variant}/resolve/main/`,
                modelName: variant,
                classPaths: `https://raw.githubusercontent.com/ultralytics/yolov5/master/data/coco128.yaml`
            });

            await model.load();
            return {
                detect: async (input) => {
                    const results = await model.detect(input);
                    return this.formatYoloResults(results);
                }
            };
        } catch (error) {
            console.warn('YOLOv5.js failed, falling back to COCO-SSD:', error);
            return await this.loadCocoSsd();
        }
    }

    formatYoloResults(yoloResults) {
        // Convert YOLO format to COCO-SSD compatible format
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

    getCurrentModel() {
        return this.currentModel;
    }

    getCurrentModelType() {
        return this.currentModelType;
    }

    getModelInfo(modelType) {
        return this.models[modelType];
    }
}
