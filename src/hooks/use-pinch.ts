import { useRef } from "react";

export function usePinch(
  value: number,
  onChange: (v: number) => void,
  isActive: boolean,
) {
  const startValRef = useRef(value);
  const startDistRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (isActive && e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      startDistRef.current = d;
      startValRef.current = value;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isActive && e.touches.length === 2 && startDistRef.current) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const newValue = startValRef.current * (d / startDistRef.current);
      onChange(newValue);
    }
  };

  const onTouchEnd = () => {
    startDistRef.current = null;
  };

  return { onTouchEnd, onTouchMove, onTouchStart };
}
