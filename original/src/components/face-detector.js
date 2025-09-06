export class FaceDetector {
    constructor() {
        this.isLoaded = false;
        this.isRunning = false;
        this.animationFrame = null;
        this.videoElement = null;
        this.referenceDescriptor = null;
        this.similarityThreshold = 0.8;
        this.currentFace = null;
        this.frameCount = 0;
        this.fps = 0;
        this.lastTime = performance.now();
        this.frameCounter = 0;
        this._graceCounter = 0;
    }

    async loadModel() {
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load face-api.js models:', error);
            return false;
        }
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
                const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
                if (detection) {
                    this.referenceDescriptor = detection.descriptor;
                } else {
                    console.error('No face found in the new reference image. The previous reference will be kept.');
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to process reference image:', error);
            return false;
        }
    }

    async startDetection(videoElement, onObjectsUpdate) {
        if (!this.isLoaded) {
            console.error('Face detector not ready');
            return;
        }
        this.videoElement = videoElement;
        this.onObjectsUpdate = onObjectsUpdate;
        this.isRunning = true;
        this.detectLoop();
    }

    stopDetection() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    async detectLoop() {
        if (!this.isRunning) return;

        try {
            this.frameCount++;
            const shouldDetect = this.frameCount % 10 === 0;
            let recognizedObjects = [];

            if (shouldDetect) {
                const detection = await faceapi
                    .detectSingleFace(this.videoElement, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                let matched = false;
                if (detection && this.referenceDescriptor) {
                    const distance = faceapi.euclideanDistance(this.referenceDescriptor, detection.descriptor);
                    const isMatch = distance <= this.similarityThreshold;
                    if (isMatch) {
                        const box = detection.detection.box;
                        const overlay = document.getElementById('objectOverlay');
                        if (overlay) {
                            const overlayRect = overlay.getBoundingClientRect();
                            const videoWidth = this.videoElement.videoWidth;
                            const videoHeight = this.videoElement.videoHeight;
                            const overlayWidth = overlayRect.width;
                            const overlayHeight = overlayRect.height;
                            const videoAspect = videoWidth / videoHeight;
                            const overlayAspect = overlayWidth / overlayHeight;
                            let scaleX, scaleY, offsetX = 0, offsetY = 0;
                            if (videoAspect > overlayAspect) {
                                scaleY = overlayHeight / videoHeight;
                                scaleX = scaleY;
                                offsetX = (overlayWidth - (videoWidth * scaleX)) / 2;
                            } else {
                                scaleX = overlayWidth / videoWidth;
                                scaleY = scaleX;
                                offsetY = (overlayHeight - (videoHeight * scaleY)) / 2;
                            }
                            const xRaw = box.x * scaleX + offsetX;
                            const y = box.y * scaleY + offsetY;
                            const width = box.width * scaleX;
                            const height = box.height * scaleY;
                            // Flip horizontally for mirrored video
                            const x = overlayWidth - (xRaw + width);
                            recognizedObjects = [{
                                id: 'face',
                                label: this.referenceDescriptorName || 'Face',
                                x, y, width, height
                            }];
                        }
                        this._graceCounter = 10;
                        matched = true;
                        this.updateFace({ bbox: [box.x, box.y, box.width, box.height] }, distance);
                    }
                }
                if (!matched && this._graceCounter > 0) {
                    this._graceCounter--;
                }
            }

            if (this._graceCounter > 0 && this.currentFace) {
                const overlay = document.getElementById('objectOverlay');
                if (overlay) {
                    const overlayRect = overlay.getBoundingClientRect();
                    const videoWidth = this.videoElement.videoWidth;
                    const videoHeight = this.videoElement.videoHeight;
                    const overlayWidth = overlayRect.width;
                    const overlayHeight = overlayRect.height;
                    const videoAspect = videoWidth / videoHeight;
                    const overlayAspect = overlayWidth / overlayHeight;
                    let scaleX, scaleY, offsetX = 0, offsetY = 0;
                    if (videoAspect > overlayAspect) {
                        scaleY = overlayHeight / videoHeight;
                        scaleX = scaleY;
                        offsetX = (overlayWidth - (videoWidth * scaleX)) / 2;
                    } else {
                        scaleX = overlayWidth / videoWidth;
                        scaleY = scaleX;
                        offsetY = (overlayHeight - (videoHeight * scaleY)) / 2;
                    }
                    const [x0, y0, w0, h0] = this.currentFace.bbox;
                    const xRaw = x0 * scaleX + offsetX;
                    const y = y0 * scaleY + offsetY;
                    const width = w0 * scaleX;
                    const height = h0 * scaleY;
                    // Flip horizontally for mirrored video
                    const x = overlayWidth - (xRaw + width);
                    recognizedObjects = [{
                        id: 'face',
                        label: this.referenceDescriptorName || 'Face',
                        x, y, width, height
                    }];
                }
            }

            if (this.onObjectsUpdate) this.onObjectsUpdate(recognizedObjects);

        } catch (error) {
            console.error('Face detection error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectLoop());
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

    updateSettings(settings) {
        if (settings.similarityThreshold !== undefined) {
            this.similarityThreshold = settings.similarityThreshold;
        }
    }
}
