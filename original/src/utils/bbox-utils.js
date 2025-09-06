/**
 * Utility functions for handling different bounding box formats
 */

/**
 * COCO-SSD format: [x, y, width, height] where (x,y) is top-left corner
 * @param {Array} bbox - [x, y, width, height]
 * @returns {Object} - Normalized bbox object
 */
export function normalizeCocoSsdBbox(bbox) {
    return {
        x: bbox[0],
        y: bbox[1],
        width: bbox[2],
        height: bbox[3],
        format: 'coco-ssd'
    };
}

/**
 * YOLO format: [center_x, center_y, width, height] (normalized 0-1)
 * @param {Array} bbox - [center_x, center_y, width, height]
 * @param {number} imageWidth - Original image width
 * @param {number} imageHeight - Original image height
 * @returns {Object} - Normalized bbox object
 */
export function normalizeYoloBbox(bbox, imageWidth, imageHeight) {
    const centerX = bbox[0] * imageWidth;
    const centerY = bbox[1] * imageHeight;
    const width = bbox[2] * imageWidth;
    const height = bbox[3] * imageHeight;

    return {
        x: centerX - width / 2,
        y: centerY - height / 2,
        width: width,
        height: height,
        format: 'yolo'
    };
}

/**
 * Convert any bbox format to standard [x, y, width, height] format
 * @param {Array|Object} bbox - Bbox in any format
 * @param {string} sourceFormat - 'coco-ssd', 'yolo', etc.
 * @param {number} imageWidth - For YOLO format conversion
 * @param {number} imageHeight - For YOLO format conversion
 * @returns {Array} - [x, y, width, height] format
 */
export function standardizeBbox(bbox, sourceFormat = 'coco-ssd', imageWidth = 640, imageHeight = 480) {
    switch (sourceFormat) {
        case 'coco-ssd':
            return Array.isArray(bbox) ? bbox : [bbox.x, bbox.y, bbox.width, bbox.height];

        case 'yolo':
            if (Array.isArray(bbox)) {
                const normalized = normalizeYoloBbox(bbox, imageWidth, imageHeight);
                return [normalized.x, normalized.y, normalized.width, normalized.height];
            }
            return [bbox.x, bbox.y, bbox.width, bbox.height];

        default:
            console.warn(`Unknown bbox format: ${sourceFormat}, assuming coco-ssd`);
            return Array.isArray(bbox) ? bbox : [bbox.x, bbox.y, bbox.width, bbox.height];
    }
}

/**
 * Format detection results with standardized bbox format
 * @param {Array} detections - Raw detection results
 * @param {string} sourceFormat - Model format ('coco-ssd', 'yolo')
 * @param {number} imageWidth - Original image width
 * @param {number} imageHeight - Original image height
 * @returns {Array} - Standardized detection results
 */
export function standardizeDetections(detections, sourceFormat = 'coco-ssd', imageWidth = 640, imageHeight = 480) {
    return detections.map(detection => ({
        class: detection.class || detection.name || 'unknown',
        score: detection.score || detection.confidence || 0,
        bbox: standardizeBbox(detection.bbox, sourceFormat, imageWidth, imageHeight),
        sourceFormat: sourceFormat,
        ...detection // preserve any extra properties
    }));
}
