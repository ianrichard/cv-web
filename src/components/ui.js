export class UI {
    constructor() {
        this.statusElement = document.getElementById('status');
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
    }

    updateStatus(message) {
        this.statusElement.textContent = message;
        console.log('Status:', message);
    }

    toggleButtons(isRunning) {
        this.startBtn.disabled = isRunning;
        this.stopBtn.disabled = !isRunning;
    }
}