# Real-Time CV Web Application

A modern, browser-based computer vision application that performs real-time object detection and face recognition using a webcam feed, built with TensorFlow.js and `face-api.js`.

## How to Run

This project requires Node.js (version 22 recommended) and npm. Using [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) is advised to manage Node versions.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ianrichard/cv-web.git
    cd cv-web
    ```

2.  **Set up Node.js (using nvm):**
    ```bash
    nvm install 22
    nvm use 22
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the application:**
    Open your web browser and navigate to `http://localhost:8080/`.

## GitHub Pages

This project can be deployed as a static site using GitHub Pages. After pushing to the repository, enable GitHub Pages in your repository settings and set the source to the `gh-pages` branch or the `/docs` folder, depending on your workflow.