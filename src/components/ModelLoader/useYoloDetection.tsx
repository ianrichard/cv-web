import { useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import { loadYoloModel, yoloDetectStream, type Detection } from "../../utils/yoloDetectStream";
import { useAppState } from "../../context/useAppState";

const COCO_LABELS = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
  "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana",
  "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard",
  "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
  "scissors", "teddy bear", "hair drier", "toothbrush"
];

export function useYoloDetection(videoRef: React.RefObject<HTMLVideoElement>, filterLabels: string[]) {
  const { setDetectedObjects } = useAppState();

  useEffect(() => {
    let stopDetect: (() => void) | undefined;
    let model: tf.GraphModel | null = null;
    let isMounted = true;
    const FILTER_LABELS = new Set(filterLabels);

    const runYolo = async () => {
      await tf.setBackend("webgl");
      await tf.ready();
      model = await loadYoloModel("/models/yolo11n/model.json");
      if (!model) {
        console.error("YOLO model failed to load.");
        return;
      }
      const videoElement = videoRef.current!;
      await new Promise((resolve) => {
        if (videoElement.readyState >= 2) resolve(true);
        else videoElement.onloadedmetadata = () => resolve(true);
      });

      stopDetect = yoloDetectStream(
        videoElement,
        model,
        (detections: Detection) => {
          if (!isMounted) return;
          const objects = [];
          for (let i = 0; i < detections.boxes.length / 4; i++) {
            const y1 = detections.boxes[i * 4 + 0];
            const x1 = detections.boxes[i * 4 + 1];
            const y2 = detections.boxes[i * 4 + 2];
            const x2 = detections.boxes[i * 4 + 3];
            const width = x2 - x1;
            const height = y2 - y1;
            const classIdx = detections.classes[i];
            const label = COCO_LABELS[classIdx] ?? "object";
            const score = detections.scores[i];
            if (
              [x1, y1, width, height].every((v) => typeof v === "number" && !isNaN(v)) &&
              FILTER_LABELS.has(label)
            ) {
              objects.push({
                id: i,
                label: `${label} (${(score * 100).toFixed(1)}%)`,
                x: x1,
                y: y1,
                width,
                height,
              });
            }
          }
          setDetectedObjects(objects);
        },
        1000, // 1x per second
        0.5   // score threshold
      );
    };

    runYolo();

    return () => {
      isMounted = false;
      if (stopDetect) stopDetect();
    };
  }, [videoRef, setDetectedObjects, filterLabels]);
}