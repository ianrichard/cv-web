export function processFrame(frame) {
    // Process the video frame for object detection
    // This could include resizing, normalization, etc.
    return frame;
}

export function formatDetectionResults(results) {
    // Format the detection results for display
    return results.map(result => ({
        label: result.label,
        confidence: (result.confidence * 100).toFixed(2) + '%',
        boundingBox: result.boundingBox
    }));
}

export function drawBoundingBox(ctx, box) {
    // Draw a bounding box on the canvas context
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'red';
    ctx.stroke();
}