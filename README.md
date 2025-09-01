# Object Detection Web Application

This project is a web-based application that utilizes computer vision techniques to perform object detection using a user's webcam. The application captures video feed from the camera, processes the frames, and identifies objects in real-time.

## Project Structure

```
object-detection-webapp
├── src
│   ├── index.html          # Main HTML document
│   ├── app.js              # Entry point for the JavaScript application
│   ├── components          # Contains reusable components
│   │   ├── camera.js       # Handles webcam access and video capture
│   │   ├── detector.js     # Loads the object detection model and runs inference
│   │   └── ui.js           # Manages the user interface elements
│   ├── models              # Contains model-related files
│   │   └── model-loader.js  # Loads the pre-trained object detection model
│   ├── utils               # Utility functions
│   │   └── helpers.js      # Assists with various tasks
│   └── styles              # CSS styles for the application
│       └── main.css        # Styles for the UI
├── package.json            # npm configuration file
└── README.md               # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd object-detection-webapp
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Open `src/index.html` in a web browser to run the application.

## Usage Guidelines

- Allow camera access when prompted by the browser.
- The application will start capturing video from the webcam and will display detected objects in real-time.

## Object Detection Functionality

The application uses a pre-trained object detection model to identify objects in the video feed. The model is loaded asynchronously, and the detection results are displayed on the user interface.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.