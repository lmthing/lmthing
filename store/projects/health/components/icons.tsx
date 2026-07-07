import React from 'react';

// Inline-SVG icon set — npm icon packs do not resolve in the app build sandbox,
// so every glyph is a hand-rolled SVG that inherits `currentColor` (token-driven)
// and takes an optional className for sizing/color.

type IconProps = { className?: string; title?: string };

function base(children: React.ReactNode, { className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const HeartIcon = (p: IconProps) =>
  base(<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />, p);

export const FlaskIcon = (p: IconProps) =>
  base(<><path d="M9 3h6" /><path d="M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M7 14h10" /></>, p);

export const PillIcon = (p: IconProps) =>
  base(<><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" /></>, p);

export const CalendarIcon = (p: IconProps) =>
  base(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>, p);

export const TargetIcon = (p: IconProps) =>
  base(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>, p);

export const FileIcon = (p: IconProps) =>
  base(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>, p);

export const HomeIcon = (p: IconProps) =>
  base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>, p);

export const CheckIcon = (p: IconProps) => base(<path d="M20 6 9 17l-5-5" />, p);

export const CheckCircleIcon = (p: IconProps) =>
  base(<><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5 11 15l4.5-5" /></>, p);

export const AlertIcon = (p: IconProps) =>
  base(<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v5M12 17.5v.5" /></>, p);

export const PhoneIcon = (p: IconProps) =>
  base(<path d="M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 2 6a2 2 0 0 1 2-2Z" />, p);

export const SparkleIcon = (p: IconProps) =>
  base(<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />, p);

export const ChatIcon = (p: IconProps) =>
  base(<path d="M21 12a8 8 0 0 1-8 8H5l-3 3V12a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8Z" />, p);

export const PlusIcon = (p: IconProps) => base(<path d="M12 5v14M5 12h14" />, p);

export const SettingsIcon = (p: IconProps) =>
  base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>, p);

export const UploadIcon = (p: IconProps) =>
  base(<><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>, p);

export const LinkIcon = (p: IconProps) =>
  base(<><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>, p);

export const BellIcon = (p: IconProps) =>
  base(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>, p);

export const ArrowRightIcon = (p: IconProps) => base(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>, p);
