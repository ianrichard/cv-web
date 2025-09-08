import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

const VideoStream = forwardRef<HTMLVideoElement, {}>((props, ref) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

  useEffect(() => {
    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        // Handle error (camera permissions, etc.)
      }
    }
    enableCamera();
    return () => {
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <video
      ref={localVideoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        objectFit: 'cover',
        zIndex: 0,
      }}
    />
  );
});

export default VideoStream;
