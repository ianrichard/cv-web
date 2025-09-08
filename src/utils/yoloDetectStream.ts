import * as tf from "@tensorflow/tfjs";

export interface Detection {
  boxes: number[]; // [y1, x1, y2, x2, ...]
  scores: number[];
  classes: number[];
}

export async function loadYoloModel(modelUrl: string) {
  await tf.ready();
  const net = await tf.loadGraphModel(modelUrl);
  return net;
}

export function yoloDetectStream(
  videoElement: HTMLVideoElement,
  model: tf.GraphModel,
  onDetections: (detections: Detection) => void,
  intervalMs: number = 1000,
  scoreThreshold: number = 0.5
) {
  let lastInferenceTime = 0;
  let stopped = false;

  const detectLoop = async () => {
    if (stopped) return;
    const now = Date.now();
    if (
      videoElement.readyState === 4 &&
      now - lastInferenceTime >= intervalMs
    ) {
      lastInferenceTime = now;
      // Preprocess frame
      const inputTensor = tf.tidy(() => {
        let img = tf.browser.fromPixels(videoElement).toFloat().div(255.0);
        // Resize to model input size (assume square)
        const [, modelHeight, modelWidth] = model.inputs[0].shape as number[];
        img = tf.image.resizeBilinear(img as tf.Tensor3D, [modelHeight, modelWidth]);
        return img.expandDims(0);
      });

      // Run inference
      const output = model.execute(inputTensor) as tf.Tensor | tf.Tensor[];
      const out = Array.isArray(output) ? output[0] : output; // [1, 84, 8400]
      // Transpose to [8400, 84]
      const transposed = out.transpose([2, 1, 0]).squeeze(); // [8400, 84]
      let data: number[][] = [];
      const arrResult = await transposed.array();
      if (Array.isArray(arrResult) && Array.isArray(arrResult[0])) {
        data = arrResult as number[][];
      } else {
        data = [];
      }

      const boxesArr: Array<[number, number, number, number]> = [];
      const scores: number[] = [];
      const classes: number[] = [];

      // Get video display size (viewport)
      const videoWidth = window.innerWidth;
      const videoHeight = window.innerHeight;

      for (let i = 0; i < data.length; i++) {
        const arr = data[i];
        const x = arr[0];
        const y = arr[1];
        const w = arr[2];
        const h = arr[3];
        const classScores = arr.slice(4);
        const maxScore = Math.max(...classScores);
        const classIdx = classScores.indexOf(maxScore);

        if (maxScore >= scoreThreshold) {
          const x1 = x - w / 2;
          const y1 = y - h / 2;
          const x2 = x + w / 2;
          const y2 = y + h / 2;

          // Model input size (e.g., 640)
          const [, modelHeight, modelWidth] = model.inputs[0].shape as number[];

          // Scale coordinates to viewport
          const scaleX = videoWidth / modelWidth;
          const scaleY = videoHeight / modelHeight;

          boxesArr.push([
            y1 * scaleY,
            x1 * scaleX,
            y2 * scaleY,
            x2 * scaleX,
          ]);
          scores.push(maxScore);
          classes.push(classIdx);
        }
      }

      // Apply non-max suppression
      if (boxesArr.length > 0) {
        const boxesTensor = tf.tensor2d(boxesArr);
        const scoresTensor = tf.tensor1d(scores);
        const nmsIndices = await tf.image.nonMaxSuppressionAsync(
          boxesTensor,
          scoresTensor,
          20,      // maxOutputSize
          0.45,    // iouThreshold
          scoreThreshold // scoreThreshold
        );
        const keep = await nmsIndices.array();

        const finalBoxes: number[] = [];
        const finalScores: number[] = [];
        const finalClasses: number[] = [];
        for (const idx of keep) {
          finalBoxes.push(...boxesArr[idx]);
          finalScores.push(scores[idx]);
          finalClasses.push(classes[idx]);
        }

        onDetections({ boxes: finalBoxes, scores: finalScores, classes: finalClasses });

        tf.dispose([boxesTensor, scoresTensor, nmsIndices]);
      } else {
        onDetections({ boxes: [], scores: [], classes: [] });
      }

      tf.dispose([inputTensor, output, transposed]);
    }
    requestAnimationFrame(detectLoop);
  };

  detectLoop();

  // Return a stop function to cancel the loop
  return () => {
    stopped = true;
  };
}
