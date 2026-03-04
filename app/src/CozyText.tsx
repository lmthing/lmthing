import React, { useMemo } from 'react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CozyChar: React.FC<{ char: string; index: number }> = ({ char, index }) => {
  const style = useMemo(() => {
    const palette = [
      '#eb8264', '#a0b464', '#e6b450', '#c882b4', 
      '#64a0aa', '#f08c8c', '#8c96c8', '#333333' // Added a dark "line" for contrast
    ];

    // Generate 50-100 "lines" by creating many color stops
    const stopCount = 60;
    const stops = Array.from({ length: stopCount }).map((_, i) => {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const pos = (i / stopCount) * 100;
      return `${color} ${pos}%`;
    }).join(', ');

    const duration = 15 + Math.random() * 20; // Very slow movement
    const angle = 45 + Math.random() * 90;    // Random slant for the lines

    return {
      backgroundImage: `linear-gradient(${angle}deg, ${stops})`,
      backgroundSize: '1000% 1000%', // Makes the "lines" look thin and allows for lots of travel
      animation: `cozy-flow ${duration}s linear infinite`,
      animationDelay: `-${index * 2}s`,
    };
  }, [config]);

  return (
    <span 
      ref={spanRef}
      style={{
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
        display: 'inline-block',
        filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3)) brightness(1.1)',
      }}
    >
      {char}
    </span>
  );
};

export const CozyThingText: React.FC<CozyThingTextProps> = ({ className, text = "THING" }) => {
  return (
    <span className={cn("font-serif font-bold tracking-tight inline-flex", className)}>
      {text.split('').map((char, i) => (
        <CozyChar key={i} char={char} />
      ))}
    </span>
  );
};
