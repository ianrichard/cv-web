import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { useYoloDetection } from '../ModelLoader/useYoloDetection';
import { useAppState } from '../../context/useAppState';

const VideoStream = forwardRef<HTMLVideoElement, object>((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { checked } = useAppState();
  useYoloDetection(videoRef as React.RefObject<HTMLVideoElement>, checked);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  useEffect(() => {
    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false, });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        // Handle error (camera permissions, etc.)
      }
    }
    enableCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      style={{ width: '100vw', height: '100vh', objectFit: 'cover', position: 'fixed', inset: 0, zIndex: 1 }}
    />
  );
});

export default VideoStream;
