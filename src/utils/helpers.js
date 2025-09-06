let lastOverlayUpdate = 0;
const OVERLAY_UPDATE_INTERVAL = 250; // ms (4x per second)

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

export function renderRecognizedObjects(objects) {
    const now = performance.now();
    if (now - lastOverlayUpdate < OVERLAY_UPDATE_INTERVAL) return;
    lastOverlayUpdate = now;

    const overlay = document.getElementById('objectOverlay');
    if (!overlay) return;

    // Log the recognized objects array for debugging
    console.log('Recognized objects:', JSON.stringify(objects));

    // Track overlays by ID
    const existing = {};
    Array.from(overlay.children).forEach(child => {
        if (child.dataset.id) existing[child.dataset.id] = child;
    });

    // Remove overlays not present in the new array immediately (no fade, no delay)
    Object.keys(existing).forEach(id => {
        if (!objects.some(obj => obj.id == id)) {
            overlay.removeChild(existing[id]);
        }
    });

    // Add/update overlays for current objects
    objects.forEach(obj => {
        let el = existing[obj.id];
        if (!el) {
            el = document.createElement('div');
            el.className = 'object-item';
            el.dataset.id = obj.id;
            const label = document.createElement('span');
            label.className = 'object-label';
            label.textContent = obj.label;
            el.appendChild(label);
            overlay.appendChild(el);
        } else {
            el.querySelector('.object-label').textContent = obj.label;
        }
        el.style.left = `${obj.x}px`;
        el.style.top = `${obj.y}px`;
        el.style.width = `${obj.width}px`;
        el.style.height = `${obj.height}px`;
        el.style.opacity = '1';
    });
}