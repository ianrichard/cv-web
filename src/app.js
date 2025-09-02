import { Detector } from './components/detector.js';
import { SimpleModelManager } from './components/simple-model-manager.js';
import { UI } from './components/ui.js';

class App {
    constructor() {
        this.detector = new Detector();
        this.modelManager = new SimpleModelManager();
        this.ui = new UI();
        this.video = null;
        this.isDetectionRunning = false;

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

            this.ui.updateStatus('Loading COCO-SSD model...');
            await this.loadModel();

            this.ui.updateStatus('Ready - Click Start Detection');
            this.setupEventListeners();

        } catch (error) {
            console.error('Initialization failed:', error);
            this.ui.updateStatus(`Initialization failed: ${error.message}`);
        }
    }

    async setupCamera() {
        const video = document.getElementById('webcam');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => resolve(video);
        });
    }

    async loadModel() {
        try {
            await this.modelManager.loadModel();

            // Set up the detector with a simple wrapper
            const modelWrapper = {
                detect: (input) => this.modelManager.detect(input),
                type: 'object-detection'
            };

            this.detector.setModel(modelWrapper, 'COCO-SSD');

            // Set up tag filters
            this.ui.setupTagFilters(this.modelManager);

            // Enable toggle button
            const toggleBtn = document.getElementById('toggleDetectionBtn');
            toggleBtn.disabled = false;
            toggleBtn.textContent = 'Start Detection';

        } catch (error) {
            console.error('Model loading failed:', error);
            this.ui.updateStatus(`Failed to load model: ${error.message}`);
        }
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('toggleDetectionBtn');

        toggleBtn.addEventListener('click', () => {
            if (this.isDetectionRunning) {
                this.stopDetection();
            } else {
                this.startDetection();
            }
        });

        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.modelManager.enableAllTags();
            this.ui.updateTagFilters(this.modelManager);
        });

        document.getElementById('selectNoneBtn').addEventListener('click', () => {
            this.modelManager.disableAllTags();
            this.ui.updateTagFilters(this.modelManager);
        });
    }

    startDetection() {
        this.isDetectionRunning = true;
        const toggleBtn = document.getElementById('toggleDetectionBtn');
        const statusSpan = document.getElementById('detectionStatus');

        toggleBtn.textContent = 'Stop Detection';
        toggleBtn.classList.add('running');
        statusSpan.textContent = 'Running';
        statusSpan.classList.remove('stopped');
        statusSpan.classList.add('running');

        // Close the panel when starting detection
        const bottomPanel = document.getElementById('bottomPanel');
        const mainContainer = document.querySelector('.main-container');

        if (bottomPanel && mainContainer) {
            bottomPanel.classList.remove('expanded');
            bottomPanel.classList.add('collapsed');
            mainContainer.classList.remove('panel-open');
        }

        this.detector.startDetection(this.video);
        this.ui.updateStatus('Detection running...');
    }

    stopDetection() {
        this.isDetectionRunning = false;
        const toggleBtn = document.getElementById('toggleDetectionBtn');
        const statusSpan = document.getElementById('detectionStatus');

        toggleBtn.textContent = 'Start Detection';
        toggleBtn.classList.remove('running');
        statusSpan.textContent = 'Stopped';
        statusSpan.classList.remove('running');
        statusSpan.classList.add('stopped');

        this.detector.stopDetection();
        this.ui.updateStatus('Detection stopped');
    }
}

// FAB Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const fabToggle = document.getElementById('fabToggle');
    const bottomPanel = document.getElementById('bottomPanel');
    const mainContainer = document.querySelector('.main-container');

    fabToggle.addEventListener('click', function() {
        const isExpanded = bottomPanel.classList.contains('expanded');

        if (isExpanded) {
            // Close panel
            bottomPanel.classList.remove('expanded');
            bottomPanel.classList.add('collapsed');
            mainContainer.classList.remove('panel-open');
        } else {
            // Open panel
            bottomPanel.classList.remove('collapsed');
            bottomPanel.classList.add('expanded');
            mainContainer.classList.add('panel-open');
        }
    });

    // Close panel when clicking outside (only when expanded)
    document.addEventListener('click', function(event) {
        const isExpanded = bottomPanel.classList.contains('expanded');

        if (isExpanded &&
            !bottomPanel.contains(event.target) &&
            !fabToggle.contains(event.target)) {

            bottomPanel.classList.remove('expanded');
            bottomPanel.classList.add('collapsed');
            mainContainer.classList.remove('panel-open');
        }
    });
});

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App().init();
});

export default App;