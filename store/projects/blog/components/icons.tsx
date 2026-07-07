import React from 'react';

/**
 * Inline-SVG icon set for the blog app. npm icon packs do NOT resolve in the
 * app build sandbox, so every glyph here is hand-authored SVG that inherits the
 * current text color (`stroke="currentColor"`) — styling comes from the caller's
 * design-token text classes.
 */

export type IconName =
  | 'feed'
  | 'discover'
  | 'topics'
  | 'search'
  | 'collections'
  | 'digests'
  | 'briefings'
  | 'alerts'
  | 'subscriptions'
  | 'insights'
  | 'settings'
  | 'assistant'
  | 'read'
  | 'library'
  | 'signals'
  | 'pin'
  | 'save'
  | 'dismiss'
  | 'plus'
  | 'deepDive'
  | 'refresh'
  | 'send'
  | 'sparkle'
  | 'close';

const PATHS: Record<IconName, React.ReactNode> = {
  feed: (
    <>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h10" />
    </>
  ),
  discover: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </>
  ),
  topics: (
    <>
      <path d="M20.6 13.4l-6.2-6.2a2 2 0 0 0-1.4-.6H6a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l6.2 6.2a2 2 0 0 0 2.8 0l4.9-4.9a2 2 0 0 0 .1-2.9z" />
      <circle cx="8.5" cy="8.5" r="1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  collections: (
    <>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="13" y="4" width="8" height="10" rx="1" />
    </>
  ),
  digests: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </>
  ),
  briefings: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>
  ),
  alerts: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  subscriptions: (
    <>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.5" />
    </>
  ),
  insights: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16l3-4 3 2 4-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 8.8 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.4.9z" />
    </>
  ),
  assistant: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 7V4" />
      <circle cx="9" cy="13" r="1" />
      <circle cx="15" cy="13" r="1" />
      <path d="M2 12v3" />
      <path d="M22 12v3" />
    </>
  ),
  read: (
    <>
      <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z" />
      <path d="M12 6v14" />
    </>
  ),
  library: (
    <>
      <path d="M5 4v16" />
      <path d="M9 4v16" />
      <path d="M13 5l5 15" />
      <rect x="3" y="4" width="2" height="16" />
    </>
  ),
  signals: (
    <>
      <path d="M4 12a8 8 0 0 1 8-8" />
      <path d="M4 12a8 8 0 0 0 8 8" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  pin: (
    <>
      <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
      <path d="M12 15v5" />
    </>
  ),
  save: <path d="M6 3h12v18l-6-4-6 4z" />,
  dismiss: (
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  deepDive: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
  ),
  close: (
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
};

export function Icon({
  name,
  className = 'h-5 w-5',
  filled = false,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
