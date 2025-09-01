export class UI {
    constructor() {
        this.statusElement = document.getElementById('statusText');
    }

    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        console.log('Status:', message);
    }

    updatePerformance(fps, inferenceTime, objectCount) {
        const fpsElement = document.getElementById('fpsCounter');
        const inferenceElement = document.getElementById('inferenceTime');
        const objectElement = document.getElementById('objectCount');

        if (fpsElement) fpsElement.textContent = fps;
        if (inferenceElement) inferenceElement.textContent = inferenceTime.toFixed(1);
        if (objectElement) objectElement.textContent = objectCount;
    }
}