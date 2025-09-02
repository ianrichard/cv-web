export class SimpleModelManager {
    constructor() {
        this.model = null;
        this.modelLoaded = false;
        this.enabledTags = new Set();
        this.allTags = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
            'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
            'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
            'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
            'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
            'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
            'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
            'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
            'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
            'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
            'toothbrush'
        ];

        // Enable all tags by default
        this.enabledTags = new Set(this.allTags);
    }

    async loadModel() {
        if (this.modelLoaded) {
            return this.model;
        }

        if (typeof cocoSsd === 'undefined') {
            throw new Error('COCO-SSD library not loaded');
        }

        console.log('Loading COCO-SSD model...');
        this.model = await cocoSsd.load();
        this.modelLoaded = true;
        console.log('COCO-SSD model loaded successfully');

        return this.model;
    }

    async detect(input) {
        if (!this.modelLoaded || !this.model) {
            throw new Error('Model not loaded');
        }

        const predictions = await this.model.detect(input);

        // Filter predictions based on enabled tags
        return predictions.filter(pred => this.enabledTags.has(pred.class));
    }

    getAllTags() {
        return this.allTags;
    }

    getEnabledTags() {
        return Array.from(this.enabledTags);
    }

    setEnabledTags(tags) {
        this.enabledTags = new Set(tags);
    }

    enableTag(tag) {
        this.enabledTags.add(tag);
    }

    disableTag(tag) {
        this.enabledTags.delete(tag);
    }

    isTagEnabled(tag) {
        return this.enabledTags.has(tag);
    }

    enableAllTags() {
        this.enabledTags = new Set(this.allTags);
    }

    disableAllTags() {
        this.enabledTags.clear();
    }

    getActiveFilterCount() {
        return this.enabledTags.size;
    }

    isModelLoaded() {
        return this.modelLoaded;
    }
}
