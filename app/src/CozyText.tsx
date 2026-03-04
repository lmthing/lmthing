import React, { useMemo, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


const CozyChar2: React.FC<{ char: string; index: number }> = ({ char, index }) => {
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
  }, [index]);

  return (
    <span 
      style={style}
      className="inline-block bg-clip-text text-transparent brightness-125 saturate-150 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]"
    >
      {char}
    </span>
  );
};



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
  }, [index]);

  return (
    <span 
      style={style}
      className="inline-block bg-clip-text text-transparent brightness-125 saturate-150 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]"
    >
      {char}
    </span>
  );
};

export const CozyThingText: React.FC<{ className?: string; text?: string }> = ({ 
  className, 
  text = "COZY",
}) => {
  const [variant, setVariant] = React.useState(1);
  return (
    <span onClick={() => setVariant((v) => (v === 1 ? 2 : 1))} className={cn("font-serif font-black tracking-tighter inline-flex", className)}>
      {text.split('').map((char, i) => 
          {
          return variant === 1 ? <CozyChar key={i} index={i} char={char} /> : <CozyChar3 key={i} index={i} char={char} />
        }
      )}
    </span>
  );
};






const CozyChar3: React.FC<{ char: string }> = ({ char }) => {
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
            phase: Math.random() * Math.PI *  3,
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
