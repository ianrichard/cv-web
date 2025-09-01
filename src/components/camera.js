export class Camera {
    constructor() {
        this.video = document.getElementById('camera');
        this.stream = null;
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'environment' // Use back camera if available
                }
            });
            this.video.srcObject = this.stream;
            await this.video.play();
            console.log('Camera started successfully');
        } catch (error) {
            console.error('Error accessing camera:', error);
            throw new Error('Could not access camera');
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
    }

    getVideoElement() {
        return this.video;
    }
}