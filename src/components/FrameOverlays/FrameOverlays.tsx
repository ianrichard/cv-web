import FrameOverlay from './FrameOverlay';

type DetectedObject = {
  id: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

interface Props {
  detectedObjects: DetectedObject[];
}

export default function FrameOverlays({ detectedObjects = [] }: Props) {
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
      {detectedObjects.map((obj: DetectedObject) => (
        <FrameOverlay key={obj.id} {...obj} />
      ))}
    </div>
  );
}