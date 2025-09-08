import styles from './FrameOverlay.module.css';

type FrameOverlayProps = {
  id: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function FrameOverlay({ label, x, y, width, height }: FrameOverlayProps) {
  return (
    <div
      className={styles.overlay}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
      }}
    >
      <span className={styles.label}>{label}</span>
    </div>
  );
}
