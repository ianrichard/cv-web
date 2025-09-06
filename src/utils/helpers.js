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
    const overlay = document.getElementById('objectOverlay');
    if (!overlay) return;

    // Track existing items by ID
    const existing = {};
    Array.from(overlay.children).forEach(child => {
        if (child.dataset.id) existing[child.dataset.id] = child;
    });

    // Mark all for removal
    Object.values(existing).forEach(el => el.classList.add('removing'));

    // Add/update items
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
            el.classList.remove('removing');
            el.querySelector('.object-label').textContent = obj.label;
        }
        // Position and size (percent of overlay)
        el.style.left = `${obj.x}px`;
        el.style.top = `${obj.y}px`;
        el.style.width = `${obj.width}px`;
        el.style.height = `${obj.height}px`;
    });

    // Remove items not in objects after transition
    Array.from(overlay.children).forEach(child => {
        if (child.classList.contains('removing')) {
            setTimeout(() => {
                if (child.parentNode) child.parentNode.removeChild(child);
            }, 300);
        }
    });
}