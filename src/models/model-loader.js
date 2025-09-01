import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export async function loadModel() {
    try {
        await tf.ready();
        console.log('TensorFlow.js backend:', tf.getBackend());

        // Platform-specific optimization
        const modelConfig = getOptimalModelConfig();

        // Load COCO-SSD model with optimizations
        const model = await cocoSsd.load({
            base: modelConfig.base,
        });

        console.log("COCO-SSD model loaded successfully");
        console.log("Model config:", modelConfig);
        return model;
    } catch (error) {
        console.error("Error loading model:", error);
        throw error;
    }
}

function getOptimalModelConfig() {
    const userAgent = navigator.userAgent.toLowerCase();
    const memory = navigator.deviceMemory || 4;
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;

    // Platform detection and optimization
    if (userAgent.includes('raspberry') || memory <= 4) {
        // Raspberry Pi - use lightweight model
        return {
            base: 'mobilenet_v2',
            inputResolution: [320, 240],
            maxDetections: 10
        };
    } else if (userAgent.includes('mac')) {
        // Mac - use full performance
        return {
            base: 'mobilenet_v2',
            inputResolution: [640, 480],
            maxDetections: 20
        };
    } else {
        // NVIDIA/Other - balanced approach
        return {
            base: 'mobilenet_v2',
            inputResolution: [480, 360],
            maxDetections: 15
        };
    }
}

// Export tf for use in other components
export { tf };

export const MODEL_CONFIG = {
    inputSize: [640, 480], // COCO-SSD handles input sizing automatically
    classes: [
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
    ],
    platformOptimizations: {
        pi: { inputSize: [320, 240], maxDetections: 10 },
        nvidia: { inputSize: [480, 360], maxDetections: 15 },
        mac: { inputSize: [640, 480], maxDetections: 20 }
    }
};