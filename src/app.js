import { Detector } from './components/detector.js';
import { SimpleModelManager } from './components/simple-model-manager.js';
import { FaceDetector } from './components/face-detector.js'; // Use the dedicated FaceDetector
import { UI } from './components/ui.js';

class App {
    constructor() {
        this.detector = new Detector();
        this.modelManager = new SimpleModelManager();
        this.faceDetector = new FaceDetector(); // Use dedicated face detector only
        this.ui = new UI();
        this.video = null;
        this.isDetectionRunning = false;
        this.currentMode = 'objects'; // 'objects' or 'face'

        // Expose for debugging
        window.detector = this.detector;
        window.modelManager = this.modelManager;
        window.faceDetector = this.faceDetector; // Fixed: correct reference

        this.modelLoadingIndicator = document.getElementById('modelLoadingIndicator');
    }

    async init() {
        try {
            this.ui.updateStatus('Initializing TensorFlow.js…');

            // Ensure TensorFlow.js is ready
            await tf.ready();
            console.log('TensorFlow.js backend:', tf.getBackend());

            this.ui.updateStatus('Setting up camera…');
            this.video = await this.setupCamera();

            // Show loading indicator for models
            this.showModelLoadingIndicator('Downloading models…');

            this.ui.updateStatus('Loading models…');
            await Promise.all([
                this.loadObjectDetectionModel(),
                this.loadFaceDetectionModel()
            ]);

            this.hideModelLoadingIndicator();

            this.ui.updateStatus('Model ready');
            this.setupEventListeners();
            this.setupDemoTabs();

        } catch (error) {
            this.hideModelLoadingIndicator();
            console.error('Initialization failed:', error);
            this.ui.updateStatus(`Initialization failed: ${error.message}`);
        }
    }

    async setupCamera() {
        const video = document.getElementById('webcam');
        // Apply mirror effect for horizontal flip
        video.style.transform = 'scaleX(-1)';
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => resolve(video);
        });
    }

    showModelLoadingIndicator(message = 'Downloading models…', progress = null) {
        if (this.modelLoadingIndicator) {
            this.modelLoadingIndicator.style.display = 'flex';
            this.modelLoadingIndicator.querySelector('.model-loading-message').textContent = message;
            if (progress !== null) {
                this.modelLoadingIndicator.querySelector('.model-loading-progress').textContent = `${progress}%`;
            } else {
                this.modelLoadingIndicator.querySelector('.model-loading-progress').textContent = '';
            }
        }
    }

    hideModelLoadingIndicator() {
        if (this.modelLoadingIndicator) {
            this.modelLoadingIndicator.style.display = 'none';
        }
        // Show settings panel sections
        const metricsSection = document.querySelector('.metrics-section');
        const demoSection = document.querySelector('.demo-section');
        if (metricsSection) metricsSection.style.display = '';
        if (demoSection) demoSection.style.display = '';
    }

    async loadObjectDetectionModel() {
        try {
            this.showModelLoadingIndicator('Downloading object detection model…');
            await this.modelManager.loadModel();
            this.hideModelLoadingIndicator();
            this.ui.setupTagFilters(this.modelManager);

            // Show the filter actions only after the tags are populated
            const filterActions = document.querySelector('.filter-actions');
            if (filterActions) {
                filterActions.style.display = 'flex';
            }

            // Initialize the detector with the object detection model immediately
            const modelWrapper = {
                detect: (input) => this.modelManager.detect(input)
            };
            this.detector.setModel(modelWrapper, 'COCO-SSD');

        } catch (error) {
            this.hideModelLoadingIndicator();
            console.error('Object detection model loading failed:', error);
        }
    }

    async loadFaceDetectionModel() {
        try {
            this.showModelLoadingIndicator('Downloading face detection model…');
            await this.faceDetector.loadModel();
            // Use Vite base path dynamically
            const base = import.meta.env.BASE_URL || '/';
            await this.faceDetector.loadReferenceImage(`${base}images/default.jpg`);
            this.faceDetector.setCanvas(document.getElementById('output'));
            this.faceDetector.referenceDescriptorName = 'default.jpg';
            this.hideModelLoadingIndicator();
        } catch (error) {
            this.hideModelLoadingIndicator();
            console.error('Face detection model loading failed:', error);
        }
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

        // Upload reference image
        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                const fileName = file.name; // Extract the file name
                reader.onload = async (e) => {
                    const img = new Image();
                    img.onload = async () => {
                        console.log(`Uploading image: ${fileName}`);
                        await this.faceDetector.loadReferenceImage(img);
                        this.faceDetector.referenceDescriptorName = fileName; // Set the name in faceDetector
                        document.getElementById('referencePreview').src = e.target.result;
                        document.getElementById('referencePreview').style.display = 'block';
                        document.querySelector('.no-image').style.display = 'none';
                        console.log('Reference image and name updated');
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset to default
        resetBtn.addEventListener('click', async () => {
            console.log('Resetting to default reference image...');
            await this.faceDetector.loadReferenceImage();
            this.faceDetector.referenceDescriptorName = 'default.jpg'; // Default to a generic name
            document.getElementById('referencePreview').src = '/images/face.jpg';
            document.getElementById('referencePreview').style.display = 'block';
            document.querySelector('.no-image').style.display = 'none';
            console.log('Reference image reset to default');
        });
    }

    switchDemoMode(mode) {
        const wasRunning = this.isDetectionRunning;

        if (wasRunning) {
            this.stopDetection();
        }

        this.currentMode = mode;

        // DO NOT set up any model wrappers for face mode - let it run independently
        if (mode === 'objects') {
            const modelWrapper = {
                detect: (input) => this.modelManager.detect(input)
            };
            this.detector.setModel(modelWrapper, 'COCO-SSD');
        }
        // Face mode doesn't use the detector at all

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
                // Close the panel only when starting detection from the button
                const bottomPanel = document.getElementById('bottomPanel');
                const mainContainer = document.querySelector('.main-container');

                if (bottomPanel && mainContainer) {
                    bottomPanel.classList.remove('expanded');
                    bottomPanel.classList.add('collapsed');
                    mainContainer.classList.remove('panel-open');
                }
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
            toggleBtn.textContent = 'Start';
        }
    }

    startDetection() {
        this.isDetectionRunning = true;
        const toggleBtn = document.getElementById('toggleDetectionBtn');

        toggleBtn.textContent = 'Stop';
        toggleBtn.classList.add('running');

        // Use the appropriate detector based on mode
        if (this.currentMode === 'face') {
            // Pass video element to faceDetector, let it flip each frame internally
            this.faceDetector.startDetection(this.video);
        } else {
            // Pass video element to detector, let it flip each frame internally
            this.detector.startDetection(this.video);
        }

        this.ui.updateStatus(`${this.currentMode === 'objects' ? 'Detecting objects…' : 'Detecting face…'}`);
    }

    stopDetection() {
        this.isDetectionRunning = false;
        const toggleBtn = document.getElementById('toggleDetectionBtn');

        toggleBtn.textContent = 'Start';
        toggleBtn.classList.remove('running');

        // Stop both detectors to be safe
        this.detector.stopDetection();
        this.faceDetector.stopDetection();

        this.ui.updateStatus('Detection stopped');
    }
}

// FAB Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const fabToggle = document.getElementById('fabToggle');
    const bottomPanel = document.getElementById('bottomPanel');
    const mainContainer = document.querySelector('.main-container');

    fabToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent this click from closing the panel immediately
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

        // Use .closest() to check if the click originated from within the panel
        if (isExpanded && !event.target.closest('#bottomPanel') && event.target !== fabToggle) {
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