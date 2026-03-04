import React, { useMemo } from 'react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CozyThingTextProps {
  className?: string;
  text?: string;
}
import { useEffect, useRef } from 'react';

interface CozyThingTextProps {
  className?: string;
  text?: string;
}

const CozyChar: React.FC<{ char: string }> = ({ char }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  // Static configuration for this character instance
  const config = useMemo(() => {
    const basePalette = [
      [235, 130, 100], // Soft Terracotta
      [160, 180, 100], // Sage Green
      [230, 180, 80],  // Warm Mustard
      [200, 130, 180], // Dusty Mauve
      [100, 160, 170], // Soft Teal
      [240, 140, 140], // Muted Salmon
      [140, 150, 200], // Periwinkle
    ];
    
    const stops = [];
    for (let i = 0; i < 100; i++) {
        const isBlack = Math.random() < 0.5;
        stops.push({
            base: isBlack ? [100, 100, 0] : basePalette[Math.floor(Math.random() * basePalette.length)],
            phase: Math.random() * Math.PI * 2,
            speed: 0.0005 + Math.random() * 0.001, // Slow, organic speed
            variation: isBlack ? 0 : (40 + Math.random() * 40)
        });
    }
    return { stops, initialAngle: Math.random() * 360 };
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      const now = Date.now();
      
      const colors = config.stops.map(stop => {
        // Oscillate variation smoothly
        const change = Math.sin(now * stop.speed + stop.phase); 
        
        // Apply variation to base color
        const r = Math.min(255, Math.max(0, stop.base[0] + change * stop.variation));
        const g = Math.min(255, Math.max(0, stop.base[1] + change * stop.variation));
        const b = Math.min(255, Math.max(0, stop.base[2] + change * stop.variation));
        
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
      });

      // Slowly rotate angle
      const currentAngle = (config.initialAngle + now * 0.002) % 360;
      const gradient = `linear-gradient(${currentAngle}deg, ${colors.join(', ')})`;

      if (spanRef.current) {
        spanRef.current.style.backgroundImage = gradient;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
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
