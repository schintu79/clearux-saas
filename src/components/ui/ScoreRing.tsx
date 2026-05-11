'use client';

import React, { useEffect, useState } from 'react';

interface ScoreRingProps {
  score: number; // 0-100
  size?: number; // SVG size in pixels
  strokeWidth?: number;
}

const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 120,
  strokeWidth = 8,
}) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate the score on mount and when score changes (up or down)
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedScore((prev) => {
        if (prev < score) {
          return Math.min(prev + 2, score);
        }
        if (prev > score) {
          return Math.max(prev - 2, score);
        }
        return prev;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [score]);

  // v2 editorial score colors
  const getColor = (value: number) => {
    if (value < 40) return 'var(--severe)';
    if (value < 70) return 'var(--warn)';
    return 'var(--ok)';
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (animatedScore / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(animatedScore)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      {/* Score text in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-serif font-normal text-center"
          style={{
            fontSize: `${size * 0.32}px`,
            color: getColor(animatedScore),
          }}
        >
          {Math.round(animatedScore)}
        </span>
      </div>
    </div>
  );
};

export default ScoreRing;
