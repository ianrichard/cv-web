import { Detector } from './components/detector.js';
import { SimpleModelManager } from './components/simple-model-manager.js';
import { FaceRecognition } from './components/face-recognition.js';
import { UI } from './components/ui.js';

class App {
    constructor() {
        this.detector = new Detector();
        this.modelManager = new SimpleModelManager();
        this.faceRecognition = new FaceRecognition();
        this.ui = new UI();
        this.video = null;
        this.isDetectionRunning = false;
        this.currentMode = 'objects'; // 'objects' or 'face'

        // Expose for debugging
        window.detector = this.detector;
        window.modelManager = this.modelManager;
        window.faceRecognition = this.faceRecognition;
    }

    async init() {
        try {
            this.ui.updateStatus('Initializing TensorFlow.js...');

            // Ensure TensorFlow.js is ready
            await tf.ready();
            console.log('TensorFlow.js backend:', tf.getBackend());

            this.ui.updateStatus('Setting up camera...');
            this.video = await this.setupCamera();

            this.ui.updateStatus('Loading models...');
            await Promise.all([
                this.loadObjectDetectionModel(),
                this.loadFaceRecognitionModel()
            ]);

            this.ui.updateStatus('Ready - Click Start Detection');
            this.setupEventListeners();
            this.setupDemoTabs();

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

    async loadObjectDetectionModel() {
        try {
            await this.modelManager.loadModel();
            this.ui.setupTagFilters(this.modelManager);

            // Initialize the detector with the object detection model immediately
            const modelWrapper = {
                detect: (input) => this.modelManager.detect(input)
            };
            this.detector.setModel(modelWrapper, 'COCO-SSD');

        } catch (error) {
            console.error('Object detection model loading failed:', error);
        }
    }

    async loadFaceRecognitionModel() {
        try {
            await this.faceRecognition.loadModel();
            await this.faceRecognition.loadReferenceImage();
        } catch (error) {
            console.error('Face recognition model loading failed:', error);
        }
    }

    setupDemoTabs() {
        const tabs = document.querySelectorAll('.demo-tab');
        const contents = document.querySelectorAll('.demo-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent panel from closing

                const targetTab = tab.dataset.tab;
                this.switchDemoMode(targetTab);

                // Update tab UI
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.style.display = 'none');

                tab.classList.add('active');
                document.getElementById(`${targetTab}-content`).style.display = 'block';
            });
        });

        // Setup face recognition controls
        this.setupFaceControls();
    }

    setupFaceControls() {
        const uploadBtn = document.getElementById('uploadReferenceBtn');
        const fileInput = document.getElementById('referenceUpload');
        const resetBtn = document.getElementById('resetReferenceBtn');
        const thresholdSlider = document.getElementById('similarityThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        const showAllFaces = document.getElementById('showAllFaces');
        const highlightMatches = document.getElementById('highlightMatches');

        // Upload reference image
        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        this.faceRecognition.loadReferenceImage(img);
                        document.getElementById('referencePreview').src = e.target.result;
                        document.getElementById('referencePreview').style.display = 'block';
                        document.querySelector('.no-image').style.display = 'none';
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset to default
        resetBtn.addEventListener('click', () => {
            this.faceRecognition.loadReferenceImage();
            document.getElementById('referencePreview').src = '/images/face.jpg';
            document.getElementById('referencePreview').style.display = 'block';
            document.querySelector('.no-image').style.display = 'none';
        });

        // Similarity threshold
        thresholdSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            thresholdValue.textContent = value.toFixed(1);
            this.faceRecognition.updateSettings({ similarityThreshold: value });
        });

        // Checkboxes
        showAllFaces.addEventListener('change', (e) => {
            this.faceRecognition.updateSettings({ showAllFaces: e.target.checked });
        });

        highlightMatches.addEventListener('change', (e) => {
            this.faceRecognition.updateSettings({ highlightMatches: e.target.checked });
        });
    }

    switchDemoMode(mode) {
        const wasRunning = this.isDetectionRunning;

        if (wasRunning) {
            this.stopDetection();
        }

        this.currentMode = mode;
        document.getElementById('currentMode').textContent = mode === 'objects' ? 'Objects' : 'Face';

        // Update detector model
        if (mode === 'objects') {
            const modelWrapper = {
                detect: (input) => this.modelManager.detect(input)
            };
            this.detector.setModel(modelWrapper, 'COCO-SSD');
        } else {
            const modelWrapper = {
                detect: (input) => this.faceRecognition.detect(input)
            };
            this.detector.setModel(modelWrapper, 'BlazeFace');
        }

        // Reset smoothing when switching modes
        this.detector.resetSmoothing();

        if (wasRunning) {
            setTimeout(() => this.startDetection(), 100);
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

        // Enable button once models are loaded - ensure we have a model set
        if (this.detector.model) {
            toggleBtn.disabled = false;
            toggleBtn.textContent = 'Start Detection';
        }
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
        this.ui.updateStatus(`${this.currentMode === 'objects' ? 'Object' : 'Face'} detection running...`);
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