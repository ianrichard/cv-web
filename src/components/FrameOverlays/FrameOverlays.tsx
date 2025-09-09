import { useAppState } from '../../context/useAppState';
import FrameOverlay from './FrameOverlay';

export default function FrameOverlays() {
  const { detectedObjects } = useAppState();
  console.log(detectedObjects)
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {detectedObjects.map((obj) => (
        <FrameOverlay key={obj.id} {...obj} />
      ))}
    </div>
  );
}