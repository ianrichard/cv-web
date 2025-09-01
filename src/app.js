import { Detector } from './components/detector.js';
import { UI } from './components/ui.js';

class CVWebApp {
    constructor() {
        this.detector = new Detector();
        this.ui = new UI();
        this.video = null;
        this.performanceMode = false;
    }

    async init() {
        try {
            this.ui.updateStatus('Initializing...');

            this.ui.updateStatus('Setting up camera...');
            this.video = await this.setupCamera();

            this.ui.updateStatus('Loading detection model...');
            await this.loadCocoSsd();

            // Try to load reference image if it exists
            this.ui.updateStatus('Checking for reference photo...');
            const referenceLoaded = await this.detector.loadReferenceImage('images/face.jpg');

            if (referenceLoaded) {
                this.ui.updateStatus('Reference face loaded! Ready to start detection.');
            } else {
                this.ui.updateStatus('Ready to start detection!');
            }

            this.setupEventListeners();
            this.setupPerformanceMonitoring();

            console.log('CV Web App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.ui.updateStatus(`Initialization failed: ${error.message}`);
        }
    }

    async loadCocoSsd() {
        try {
            console.log('Loading COCO-SSD model...');
            const model = await cocoSsd.load();
            this.detector.setModel(model);
            console.log('COCO-SSD model loaded successfully');
        } catch (error) {
            console.error('Failed to load COCO-SSD model:', error);
            throw new Error('Failed to load detection model');
        }
    }

    async setupCamera() {
        const video = document.getElementById('webcam');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            video.srcObject = stream;
            return new Promise((resolve) => {
                video.onloadedmetadata = () => resolve(video);
            });
        } catch (error) {
            console.error('Camera setup failed:', error);
            throw new Error('Failed to access camera');
        }
    }

    setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.detector.startDetection(this.video);
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.detector.stopDetection();
        });

        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('referenceImage').click();
        });

        document.getElementById('referenceImage').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.detector.loadReferenceImageFile(file);
            }
        });

        const performanceBtn = document.getElementById('performanceBtn');
        if (performanceBtn) {
            performanceBtn.addEventListener('click', () => {
                this.togglePerformanceMode();
            });
        }
    }

    setupPerformanceMonitoring() {
        setInterval(() => {
            if (this.performanceMode && this.detector) {
                const fps = this.detector.fps || 0;
                const inferenceTime = this.detector.lastInferenceTime || 0;
                const objectCount = this.detector.lastDetectionCount || 0;

                this.ui.updatePerformance(fps, inferenceTime, objectCount);
            }
        }, 1000);
    }

    togglePerformanceMode() {
        this.performanceMode = !this.performanceMode;
        const statsDiv = document.getElementById('performanceStats');
        if (statsDiv) {
            statsDiv.style.display = this.performanceMode ? 'block' : 'none';
        }

        const btn = document.getElementById('performanceBtn');
        if (btn) {
            btn.textContent = this.performanceMode ? 'Hide Performance' : 'Show Performance';
        }
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CVWebApp().init();
});

export default CVWebApp;