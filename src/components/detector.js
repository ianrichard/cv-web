export class Detector {
    constructor() {
        this.model = null;
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
        this.isDetecting = false;
        this.animationFrame = null;
    }

    setModel(model) {
        this.model = model;
    }

    async startDetection(videoElement) {
        this.isDetecting = true;
        this.canvas.width = videoElement.videoWidth;
        this.canvas.height = videoElement.videoHeight;
        this.detectLoop(videoElement);
    }

    stopDetection() {
        this.isDetecting = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    async detectLoop(videoElement) {
        if (!this.isDetecting || !this.model) return;

        try {
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Run detection - COCO-SSD takes the video element directly
            const predictions = await this.model.detect(videoElement);

            // Draw results
            this.drawPredictions(predictions);

        } catch (error) {
            console.error('Detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop(videoElement));
    }

    drawPredictions(predictions) {
        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;

            // Draw bounding box
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);

            // Draw label with class name and score
            const label = `${prediction.class}: ${(prediction.score * 100).toFixed(1)}%`;
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = '16px Arial';

            // Draw background for text
            const textWidth = this.ctx.measureText(label).width;
            this.ctx.fillRect(x, y - 25, textWidth + 10, 20);

            // Draw text
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, x + 5, y - 8);
        });
    }
}