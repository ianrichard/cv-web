export function processFrame(frame) {
    // Process the video frame for object detection
    // This could include resizing, normalization, etc.
    return frame;
}

export function formatDetectionResults(results) {
    return results.map(result => ({
        label: result.label,
        confidence: (result.confidence * 100).toFixed(2) + '%',
        boundingBox: result.boundingBox
    }));
}

// Add the missing functions that yolo-loader.js is trying to import
export function processYOLOOutput(predictions, inputWidth, inputHeight, imageWidth, imageHeight, confThreshold = 0.5) {
    const detections = [];

    try {
        // Handle different prediction formats
        let predArray;
        if (predictions.dataSync) {
            predArray = predictions.dataSync();
        } else if (Array.isArray(predictions)) {
            predArray = predictions;
        } else {
            console.warn('Unknown prediction format');
            return detections;
        }

        // Parse YOLO output format [batch, boxes, 85] where 85 = 4 bbox + 1 conf + 80 classes
        const numDetections = Math.floor(predArray.length / 85);

        for (let i = 0; i < numDetections; i++) {
            const offset = i * 85;
            const confidence = predArray[offset + 4];

            if (confidence > confThreshold) {
                // Get class with highest probability
                let maxClass = 0;
                let maxProb = 0;

                for (let j = 5; j < 85; j++) {
                    if (predArray[offset + j] > maxProb) {
                        maxProb = predArray[offset + j];
                        maxClass = j - 5;
                    }
                }

                const finalConfidence = confidence * maxProb;
                if (finalConfidence > 0.3) {
                    // YOLO format: center_x, center_y, width, height (normalized 0-1)
                    const centerX = predArray[offset] * imageWidth;
                    const centerY = predArray[offset + 1] * imageHeight;
                    const width = predArray[offset + 2] * imageWidth;
                    const height = predArray[offset + 3] * imageHeight;

                    // Convert to [x, y, width, height] format (top-left corner)
                    const x = centerX - width / 2;
                    const y = centerY - height / 2;

                    detections.push({
                        class: getCocoClassName(maxClass),
                        score: finalConfidence,
                        bbox: [Math.max(0, x), Math.max(0, y), Math.min(width, imageWidth - x), Math.min(height, imageHeight - y)]
                    });
                }
            }
        }
    } catch (error) {
        console.error('YOLO output processing error:', error);
    }

    return detections;
}

export function getCocoClassName(classIndex) {
    const cocoClasses = [
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

    return cocoClasses[classIndex] || `class_${classIndex}`;
}

export function drawBoundingBox(ctx, box) {
    // Draw a bounding box on the canvas context
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'red';
    ctx.stroke();
}