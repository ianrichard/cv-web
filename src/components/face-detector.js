export class FaceDetector {
    constructor() {
        this.isLoaded = false;
        this.isRunning = false;
        this.animationFrame = null;

        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.videoElement = null;

        // Face recognition using face-api.js
        this.referenceDescriptor = null;
        this.similarityThreshold = 0.8; // face-api.js uses distance (lower = more similar)

        // Single face tracking
        this.currentFace = null;
        this.frameCount = 0;

        // Performance
        this.fps = 0;
        this.lastTime = performance.now();
        this.frameCounter = 0;
    }

    async loadModel() {
        try {
            console.log('Loading face-api.js models...');
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            this.isLoaded = true;
            console.log('Face-api.js models loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load face-api.js models:', error);
            return false;
        }
    }

    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    async loadReferenceImage(imageSource = '/images/face.jpg') {
        try {
            let img;
            if (typeof imageSource === 'string') {
                img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageSource;
                });
            } else {
                img = imageSource;
            }

            if (this.isLoaded) {
                console.log('Attempting to extract face descriptor from new reference image...');
                const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

                if (detection) {
                    // Only update if a new descriptor was successfully extracted
                    this.referenceDescriptor = detection.descriptor;
                    console.log('SUCCESS: New reference face descriptor extracted and set.');
                } else {
                    // CRITICAL: Do NOT nullify the existing descriptor. Log an error instead.
                    console.error('FAILED: No face found in the new reference image. The previous reference will be kept.');
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to process reference image:', error);
            // Do not nullify on error, just report it.
            return false;
        }
    }

    async startDetection(videoElement) {
        if (!this.isLoaded || !this.canvas) {
            console.error('Face detector not ready');
            return;
        }
        this.videoElement = videoElement;
        this.isRunning = true;
        this.detectLoop();
    }

    stopDetection() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    async detectLoop() {
        if (!this.isRunning) return;

        try {
            this.frameCount++;
            const shouldDetect = this.frameCount % 10 === 0; // Detect every 10 frames

            if (shouldDetect) {
                // Flip the video frame before inference
                const flippedFrame = this.getFlippedFrame(this.videoElement);

                const detection = await faceapi
                    .detectSingleFace(flippedFrame, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection && this.referenceDescriptor) {
                    const distance = faceapi.euclideanDistance(this.referenceDescriptor, detection.descriptor);
                    const isMatch = distance <= this.similarityThreshold;

                    if (isMatch) {
                        const box = detection.detection.box;
                        const bbox = [box.x, box.y, box.width, box.height];
                        this.updateFace({ bbox }, distance);
                    } else {
                        this.currentFace = null;
                    }
                } else {
                    this.currentFace = null;
                }
            }

            // Drawing happens every frame
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            this.ctx.clearRect(0, 0, rect.width, rect.height);

            if (this.currentFace) {
                this.drawFace();
            }

            this.updatePerformance();

        } catch (error) {
            console.error('Face detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop());
    }

    // Helper to get horizontally flipped frame as canvas
    getFlippedFrame(video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        return canvas;
    }

    updateFace(face, distance) {
        const bbox = face.bbox;
        const newSimilarity = Math.max(0, 1 - distance / this.similarityThreshold);

        if (this.currentFace) {
            this.currentFace.bbox = [
                Math.round(this.currentFace.bbox[0] * 0.8 + bbox[0] * 0.2),
                Math.round(this.currentFace.bbox[1] * 0.8 + bbox[1] * 0.2),
                Math.round(this.currentFace.bbox[2] * 0.9 + bbox[2] * 0.1),
                Math.round(this.currentFace.bbox[3] * 0.9 + bbox[3] * 0.1)
            ];
            this.currentFace.similarity = this.currentFace.similarity * 0.8 + newSimilarity * 0.2;
        } else {
            this.currentFace = { bbox, similarity: newSimilarity };
        }
    }

    drawFace() {
        if (!this.currentFace || !this.ctx) return;

        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const canvasLogicalWidth = rect.width;
        const canvasLogicalHeight = rect.height;

        const videoAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
        const containerAspect = canvasLogicalWidth / canvasLogicalHeight;

        let scaleX, scaleY, offsetX = 0, offsetY = 0;

        if (videoAspect > containerAspect) {
            scaleY = canvasLogicalHeight / this.videoElement.videoHeight;
            scaleX = scaleY;
            offsetX = (canvasLogicalWidth - (this.videoElement.videoWidth * scaleX)) / 2;
        } else {
            scaleX = canvasLogicalWidth / this.videoElement.videoWidth;
            scaleY = scaleX;
            offsetY = (canvasLogicalHeight - (this.videoElement.videoHeight * scaleY)) / 2;
        }

        const [x, y, width, height] = this.currentFace.bbox;
        const scaledX = (x * scaleX) + offsetX;
        const scaledY = (y * scaleY) + offsetY;
        const scaledWidth = width * scaleX;
        const scaledHeight = height * scaleY;

        const similarityPercent = Math.min(100, this.currentFace.similarity * 100);
        const isMatch = similarityPercent >= 25;

        const boxColor = isMatch ? '#00FF00' : '#FF0000'; // Green if match, red otherwise
        const name = this.referenceDescriptorName || 'Unknown'; // Default fallback if name is missing
        const label = isMatch
            ? `Face, probably ${name}`
            : `Face, probably not ${name}`;

        // Draw Bounding Box
        this.ctx.strokeStyle = boxColor;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

        // Draw label
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        const textMetrics = this.ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 14 * 1.2;

        this.ctx.fillStyle = boxColor;
        this.ctx.fillRect(scaledX, scaledY - textHeight - 8, textWidth + 12, textHeight + 4);

        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(label, scaledX + 6, scaledY - textHeight - 4);
    }

    updatePerformance() {
        this.frameCounter++;
        const now = performance.now();
        if (now - this.lastTime >= 1000) {
            this.fps = this.frameCounter;
            this.frameCounter = 0;
            this.lastTime = now;

            const fpsElement = document.getElementById('fpsCounter');
            const objectCountElement = document.getElementById('objectCount');
            if (fpsElement) fpsElement.textContent = this.fps;
            if (objectCountElement) objectCountElement.textContent = this.currentFace ? 1 : 0;
        }
    }

    updateSettings(settings) {
        if (settings.similarityThreshold !== undefined) {
            this.similarityThreshold = settings.similarityThreshold;
        }
    }
}
