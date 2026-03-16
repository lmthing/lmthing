## Visual Design Tokens

### Colors

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `--surface-primary` | Chat background | `#FFFFFF` | `#1A1A1A` |
| `--surface-agent` | Agent response block | `#F8F9FA` | `#222222` |
| `--surface-form` | Active form card | `#FFFFFF` | `#2A2A2A` |
| `--surface-form-submitted` | Submitted form card | `#F0F0F0` | `#1E1E1E` |
| `--surface-code` | Code block (expanded) | `#F5F5F5` | `#1E1E1E` |
| `--surface-sidebar` | Async sidebar background | `#FAFAFA` | `#1E1E1E` |
| `--border-form` | Form card border | `#E2E8F0` | `#333333` |
| `--border-form-active` | Active form focus ring | `#3B82F6` | `#60A5FA` |
| `--border-code` | Code block border | `#E5E7EB` | `#2D2D2D` |
| `--border-read` | Read block left accent | `#93C5FD` | `#3B82F6` |
| `--border-error` | Error block left accent | `#FCA5A5` | `#DC2626` |
| `--border-hook` | Hook block left accent (observe/side-effect) | `#C4B5FD` | `#7C3AED` |
| `--border-hook-interrupt` | Hook block left accent (interrupt/skip) | `#FCD34D` | `#D97706` |
| `--accent` | Submit button, active states | `#2563EB` | `#3B82F6` |
| `--text-primary` | Body text | `#1A1A1A` | `#E5E5E5` |
| `--text-secondary` | Labels, hints, collapsed summaries | `#6B7280` | `#9CA3AF` |
| `--text-error` | Error messages | `#DC2626` | `#F87171` |
| `--text-code` | Code text (base) | `#1F2937` | `#D1D5DB` |
| `--indicator` | Activity indicator, streaming icon | `#3B82F6` | `#60A5FA` |
| `--async-running` | Async task spinner/progress | `#3B82F6` | `#60A5FA` |
| `--async-complete` | Async task done | `#16A34A` | `#4ADE80` |
| `--async-cancelled` | Async task cancelled | `#D97706` | `#FBBF24` |
| `--async-failed` | Async task error | `#DC2626` | `#F87171` |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| User message | System sans-serif | 400 | 15px |
| Component content | Inherited from component | — | — |
| Form labels | System sans-serif | 500 | 14px |
| Form inputs | System sans-serif | 400 | 15px |
| Submit button | System sans-serif | 600 | 14px |
| Collapsible headers (Code/Read/Error/Hook) | Monospace | 500 | 13px |
| Collapsible content (code) | Monospace | 400 | 13px |
| Read block payload | Monospace | 400 | 13px |
| Sidebar task labels | System sans-serif | 500 | 13px |
| Sidebar task details | System sans-serif | 400 | 12px |
| Status/muted text | System sans-serif | 400 | 13px |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--gap-message` | 16px | Between user bubble and agent block |
| `--gap-element` | 8px | Between elements within an agent response block |
| `--gap-form-fields` | 16px | Between form fields within an `ask` form |
| `--padding-form` | 20px | Inner padding of the form card |
| `--padding-code` | 12px | Inner padding of expanded code/read/error blocks |
| `--padding-component` | 16px | Inner padding of display components (if host-wrapped) |
| `--padding-sidebar` | 12px | Sidebar inner padding |
| `--radius-card` | 12px | Border radius on form cards and component wrappers |
| `--radius-code` | 8px | Border radius on code/read/error blocks |
| `--radius-input` | 8px | Border radius on input fields |
| `--radius-sidebar-card` | 8px | Border radius on async task cards |
| `--width-sidebar` | 280px | Async sidebar width (desktop) |

### Motion

| Transition | Duration | Easing | Usage |
|------------|----------|--------|-------|
| Component entry | 150ms | ease-out | `display` components fading in |
| Form entry | 200ms | ease-out | `ask` forms appearing |
| Form submit | 120ms | ease-in-out | Card muting + checkmark animation |
| Collapsible toggle | 150ms | ease-in-out | Code/read/error expand/collapse |
| Scroll to new content | 300ms | ease-in-out | Auto-scroll on new element |
| Sidebar open/close | 200ms | ease-in-out | Sidebar slide in/out |
| Sidebar card fade | 500ms | ease-out | Completed/cancelled tasks fading |
| User intervention | 200ms | ease-out | User bubble appearing mid-flow |
