export class SimpleModelManager {
    constructor() {
        this.model = null;
        this.modelLoaded = false;
        this.enabledTags = new Set();
        this.allTags = [
            'person',
            'cell phone',
            'bottle', 'cup', 'fork', 'spoon', 'bowl', 'banana',
            'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog',
            'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
            'dining table', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
            'book', 'clock', 'scissors', 'teddy bear',
            'toothbrush'
        ];

        // Enable only 'person' and 'cell phone' by default
        this.enabledTags = new Set(['person', 'cell phone']);
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
