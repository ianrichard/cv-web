import { useState, useEffect } from 'react';

type LoadingEllipsisProps = {
  active?: boolean;
};

export default function LoadingEllipsis({ active = true }: LoadingEllipsisProps) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    if (!active) {
      setDots('');
      return;
    }
    const interval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 400);
    return () => clearInterval(interval);
  }, [active]);
  return <>{dots}</>;
}
