import { Detector } from './components/detector.js';
import { UnifiedModelManager } from './components/unified-model-manager.js';
import { UI } from './components/ui.js';

class App {
    constructor() {
        this.detector = new Detector();
        this.modelManager = new UnifiedModelManager();
        this.ui = new UI();
        this.video = null;

        // Expose for debugging
        window.detector = this.detector;
        window.modelManager = this.modelManager;
    }

    async init() {
        try {
            this.ui.updateStatus('Initializing TensorFlow.js...');

            // Ensure TensorFlow.js is ready
            await tf.ready();
            console.log('TensorFlow.js backend:', tf.getBackend());

            this.ui.updateStatus('Setting up camera...');
            this.video = await this.setupCamera();

            this.ui.updateStatus('Select and load a model to begin');
            this.setupEventListeners();

        } catch (error) {
            console.error('Initialization failed:', error);
            this.ui.updateStatus(`Initialization failed: ${error.message}`);
        }
    }

    async setupCamera() {
        const video = document.getElementById('webcam');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => resolve(video);
        });
    }

    async loadSelectedModel() {
        const modelSelect = document.getElementById('modelSelect');
        const selectedModel = modelSelect.value;

        try {
            this.ui.updateStatus(`Loading ${selectedModel}...`);

            const model = await this.modelManager.loadModel(selectedModel);
            this.detector.setModel(model, this.modelManager.getModelInfo());

            // Enable start button
            document.getElementById('startBtn').disabled = false;

            this.ui.updateStatus('Model loaded! Ready to start detection.');

        } catch (error) {
            console.error('Model loading failed:', error);
            this.ui.updateStatus(`Failed to load model: ${error.message}`);
        }
    }

    setupEventListeners() {
        document.getElementById('loadModelBtn').addEventListener('click', () => {
            this.loadSelectedModel();
        });

        document.getElementById('updatePromptBtn').addEventListener('click', () => {
            const promptInput = document.getElementById('promptInput');
            if (promptInput && promptInput.value.trim()) {
                this.modelManager.updateYoloePrompt(promptInput.value.trim());
            }
        });

        document.getElementById('promptInput').addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const promptInput = event.target;
                if (promptInput.value.trim()) {
                    this.modelManager.updateYoloePrompt(promptInput.value.trim());
                }
            }
        });

        document.getElementById('startBtn').addEventListener('click', () => {
            this.detector.startDetection(this.video);
            this.ui.updateStatus('Detection running...');
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.detector.stopDetection();
            this.ui.updateStatus('Detection stopped');
        });

        document.getElementById('performanceBtn').addEventListener('click', () => {
            this.detector.togglePerformance();
        });
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App().init();
});

export default App;