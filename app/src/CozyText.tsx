'use client';

import React, { useRef, useEffect, useState } from 'react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import spectrumPalette from '@/spectrum-palette.json';

const { spectrum50 } = spectrumPalette;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function generateCozyStyle(index: number) {
  const palette = spectrum50;
  const stopCount = 60;
  const stops = Array.from({ length: stopCount }).map((_, i) => {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const pos = (i / stopCount) * 100;
    return `${color} ${pos}%`;
  }).join(', ');

  const duration = 15 + Math.random() * 20;
  const angle = 45 + Math.random() * 90;

  return {
    backgroundImage: `linear-gradient(${angle}deg, ${stops})`,
    backgroundSize: '1000% 1000%',
    animation: `cozy-flow ${duration}s linear infinite`,
    animationDelay: `-${index * 2}s`,
  };
}

const CozyChar: React.FC<{ char: string; index: number }> = ({ char, index }) => {
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    setStyle(generateCozyStyle(index));
  }, [index]);

  return (
    <span
      style={style}
      className="inline-block bg-clip-text text-transparent brightness-125 saturate-150 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]"
    >
      {char.toLowerCase()}
    </span>
  );
};

export const CozyThingText: React.FC<{ className?: string; text?: string }> = ({
  className,
  text = "COZY",
}) => {
  const [variant, setVariant] = useState(1);
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Hazy cloud behind the text */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-[40%] -inset-y-[50%] z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.2) 25%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.1) 70%, transparent 100%)',
          filter: 'blur(28px)',
          borderRadius: '50%',
        }}
      />
      <span onClick={() => setVariant((v) => (v === 1 ? 2 : 1))} className="font-serif font-black tracking-tighter inline-flex relative z-10">
        {text.toLowerCase().split('').map((char, i) => {
          return variant === 1 ? <CozyChar key={i} index={i} char={char} /> : <CozyChar3 key={i} index={i} char={char} />
        }
        )}
      </span>
    </span>
  );
};

const CozyChar3: React.FC<{ char: string; index?: number }> = ({ char }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hexToRgb = (hex: string) => hex.match(/\w\w/g)!.map((x: string) => parseInt(x, 16));
    const basePalette = spectrum50.map(hexToRgb);

    const stops = [];
    for (let i = 0; i < 100; i++) {
      const isBlack = Math.random() < 0.5;
      stops.push({
        base: isBlack ? [100, 100, 0] : basePalette[Math.floor(Math.random() * basePalette.length)],
        phase: Math.random() * Math.PI * 3,
        speed: 0.0005 + Math.random() * 0.001,
        variation: isBlack ? 0 : (40 + Math.random() * 40)
      });
    }
    const config = { stops, initialAngle: Math.random() * 360 };

    let animationFrameId: number;

    const animate = () => {
      const now = Date.now();

      const colors = config.stops.map(stop => {
        const change = Math.sin(now * stop.speed + stop.phase);
        const r = Math.min(255, Math.max(0, stop.base[0] + change * stop.variation));
        const g = Math.min(255, Math.max(0, stop.base[1] + change * stop.variation));
        const b = Math.min(255, Math.max(0, stop.base[2] + change * stop.variation));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
      });

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
  }, []);

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
