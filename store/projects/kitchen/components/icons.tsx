import React from 'react';

/**
 * Tiny inline-SVG icon set (Lucide-style geometry) so the app has no runtime
 * icon dependency — the app build sandbox only resolves react / react-dom /
 * @app/*, not npm icon packages. Each icon takes a `className` and inherits
 * `currentColor`.
 */

type IconProps = { className?: string };

function Svg({
  className,
  children,
  fill = 'none',
}: IconProps & { children: React.ReactNode; fill?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CalendarDays({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </Svg>
  );
}

export function BookOpen({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Svg>
  );
}

export function Package({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </Svg>
  );
}

export function ShoppingCart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </Svg>
  );
}

export function Activity({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Svg>
  );
}

export function Settings({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function Download({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Svg>
  );
}

export function Timer({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 2h4M12 14l3-3" />
      <circle cx="12" cy="14" r="8" />
    </Svg>
  );
}

export function AlertTriangle({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" />
    </Svg>
  );
}

export function Check({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function X({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function Clock({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Svg>
  );
}

export function Repeat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
    </Svg>
  );
}

export function Lightbulb({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" />
    </Svg>
  );
}

export function ChefHat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
      <path d="M6 17h12" />
    </Svg>
  );
}

export function Sparkles({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M6.3 6.3 9 9M15 15l2.7 2.7M17.7 6.3 15 9M9 15l-2.7 2.7" />
    </Svg>
  );
}

export function Flame({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

export function ChevronLeft({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function Send({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
    </Svg>
  );
}

export function Plus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function RotateCw({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </Svg>
  );
}

export function MessageSquare({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function Utensils({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 2v7a3 3 0 0 0 3 3v10M6 2v10M9 2v7a3 3 0 0 1-3 3M17 2v20M17 12c2 0 4-2 4-6s-2-6-4-6" />
    </Svg>
  );
}

export function ClipboardList({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </Svg>
  );
}

export function CalendarPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 2v4M16 2v4M3 10h18M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M16 19h6M19 16v6" />
    </Svg>
  );
}

export function Leaf({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </Svg>
  );
}

/** Star with an explicit filled/outline mode for the rating control. */
export function StarIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <Svg className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M11.5 2.5 9 7.6l-5.6.8 4 3.9-1 5.6 5.1-2.7 5 2.7-1-5.6 4-3.9-5.6-.8z" />
    </Svg>
  );
}
