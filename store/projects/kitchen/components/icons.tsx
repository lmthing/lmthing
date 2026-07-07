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

/** Star with an explicit filled/outline mode for the rating control. */
export function StarIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <Svg className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M11.5 2.5 9 7.6l-5.6.8 4 3.9-1 5.6 5.1-2.7 5 2.7-1-5.6 4-3.9-5.6-.8z" />
    </Svg>
  );
}
