import { loadModel } from './models/model-loader.js';
import { Camera } from './components/camera.js';
import { Detector } from './components/detector.js';
import { UI } from './components/ui.js';

class App {
    constructor() {
        this.model = null;
        this.camera = new Camera();
        this.detector = new Detector();
        this.ui = new UI();
        this.init();
    }

    async init() {
        try {
            this.ui.updateStatus('Loading model...');
            this.model = await loadModel();
            this.detector.setModel(this.model);
            this.ui.updateStatus('Model loaded. Ready to start detection.');
            this.setupEventListeners();
        } catch (error) {
            this.ui.updateStatus(`Error: ${error.message}`);
        }
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('stop-btn').addEventListener('click', () => this.stop());
    }

    async start() {
        await this.camera.start();
        this.detector.startDetection(this.camera.getVideoElement());
        this.ui.toggleButtons(true);
    }

    stop() {
        this.camera.stop();
        this.detector.stopDetection();
        this.ui.toggleButtons(false);
    }
}

new App();