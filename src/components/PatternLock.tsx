import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";

interface PatternLockProps {
  onComplete: (pattern: number[]) => void;
  disabled?: boolean;
  error?: boolean;
  size?: number;
}

const DOT_COUNT = 9;
const GRID = 3;

const PatternLock = ({ onComplete, disabled = false, error = false, size = 240 }: PatternLockProps) => {
  const [selected, setSelected] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotPositions = useRef<{ x: number; y: number }[]>([]);

  const gap = size / GRID;
  const dotRadius = 10;
  const hitRadius = gap * 0.45;

  // Calculate dot centers
  const dots = Array.from({ length: DOT_COUNT }, (_, i) => ({
    row: Math.floor(i / GRID),
    col: i % GRID,
    cx: (i % GRID) * gap + gap / 2,
    cy: Math.floor(i / GRID) * gap + gap / 2,
  }));

  const getHitDot = useCallback((clientX: number, clientY: number): number | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = 0; i < dots.length; i++) {
      const dx = x - dots[i].cx;
      const dy = y - dots[i].cy;
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) return i;
    }
    return null;
  }, [dots, hitRadius]);

  const handleStart = (clientX: number, clientY: number) => {
    if (disabled) return;
    const dot = getHitDot(clientX, clientY);
    if (dot !== null) {
      setSelected([dot]);
      setDrawing(true);
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!drawing || disabled) return;
    const dot = getHitDot(clientX, clientY);
    if (dot !== null && !selected.includes(dot)) {
      setSelected((prev) => [...prev, dot]);
    }
  };

  const handleEnd = () => {
    if (!drawing) return;
    setDrawing(false);
    if (selected.length >= 4) {
      onComplete(selected);
    }
    setTimeout(() => setSelected([]), 400);
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const onMouseUp = () => handleEnd();

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    handleStart(t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    handleMove(t.clientX, t.clientY);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleEnd();
  };

  const lineColor = error ? "hsl(0, 72%, 51%)" : "hsl(262, 83%, 58%)";

  return (
    <div
      ref={containerRef}
      className="relative select-none touch-none"
      style={{ width: size, height: size }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={handleEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* SVG lines between selected dots */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {selected.map((dotIdx, i) => {
          if (i === 0) return null;
          const prev = dots[selected[i - 1]];
          const curr = dots[dotIdx];
          return (
            <line
              key={`${i}`}
              x1={prev.cx} y1={prev.cy}
              x2={curr.cx} y2={curr.cy}
              stroke={lineColor}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })}
      </svg>

      {/* Dots */}
      {dots.map((dot, i) => {
        const isSelected = selected.includes(i);
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center"
            style={{
              left: dot.cx - 20,
              top: dot.cy - 20,
              width: 40,
              height: 40,
              zIndex: 2,
            }}
          >
            {/* Outer ring */}
            <motion.div
              animate={{
                scale: isSelected ? 1.3 : 1,
                borderColor: isSelected
                  ? error ? "hsl(0, 72%, 51%)" : "hsl(262, 83%, 58%)"
                  : "hsl(240, 6%, 25%)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute rounded-full border-2"
              style={{ width: 32, height: 32 }}
            />
            {/* Inner dot */}
            <motion.div
              animate={{
                scale: isSelected ? 1 : 0.5,
                backgroundColor: isSelected
                  ? error ? "hsl(0, 72%, 51%)" : "hsl(262, 83%, 58%)"
                  : "hsl(240, 6%, 30%)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-full"
              style={{ width: dotRadius * 2, height: dotRadius * 2 }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PatternLock;
