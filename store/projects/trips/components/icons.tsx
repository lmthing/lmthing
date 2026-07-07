import React from 'react';

// Inline SVG icons (Lucide-style). npm icon packages are not resolvable in the
// project-app build sandbox, so every icon here is hand-inlined and paints with
// `currentColor`.

type IconProps = { className?: string };

function base(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function SparklesIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  );
}

export function LuggageIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="6" y="7" width="12" height="13" rx="2" />
      <path d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M10 20v1M14 20v1M10 11v5M14 11v5" />
    </svg>
  );
}

export function RouteIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 000-8H9a4 4 0 010-8h5" />
    </svg>
  );
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 7a2 2 0 012-2h13a1 1 0 011 1v2" />
      <path d="M3 7v10a2 2 0 002 2h14a1 1 0 001-1v-8a1 1 0 00-1-1H5a2 2 0 01-2-2z" />
      <path d="M16 12h.01" />
    </svg>
  );
}

export function ScaleIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0z" />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7-7A2 2 0 013 12.2V5a2 2 0 012-2h7.2a2 2 0 011.4.6l7 7a2 2 0 010 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  );
}

export function PlaneIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M17.8 19.2l-2.3-6.5 4.5-4.5a1.7 1.7 0 00-2.4-2.4L13 10.5 6.5 8.2a1 1 0 00-1 .3l-.9.9 5 3-2.3 2.3-2.4-.4-.8.8 3 1.6 1.6 3 .8-.8-.4-2.4L14.5 18l3 5 .9-.9a1 1 0 00.3-1z" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
