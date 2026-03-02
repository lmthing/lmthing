# Home Page (`/`)

**Layout:** [L1: Single-Column Centered Layout](LAYOUT.md#l1-single-column-centered-layout)

## User Stories

### US-001: Understand the Platform Value Proposition
**As a** first-time visitor  
**I want to** see a clear description of what the platform does  
**So that** I can quickly understand if it meets my needs

**Acceptance Criteria:**
- Hero section displays the main heading "Turn Knowledge into AI Agents"
- Tagline "Your expertise, amplified by AI" is visible in the header
- Description emphasizes "No code required" and explains the workflow (organize knowledge, design workflows, deploy)
- Uses [C1: Application Header](LAYOUT.md#c1-application-header) for consistent branding
- Typography follows Display and H1 scale from [Typography Scale](LAYOUT.md#typography-scale)

**Components:** Hero section with display heading, body text, and brand tagline

---

### US-002: Authenticate with GitHub
**As a** user  
**I want to** sign in using my GitHub account  
**So that** I can access personalized workspaces and save my work

**Acceptance Criteria:**
- "Login with GitHub" button is prominently displayed in the top-right header
- Button uses dark slate color scheme (near-black) for high contrast
- Clicking the button initiates GitHub OAuth authentication flow
- Button follows [Interactive States](LAYOUT.md#interactive-states) for hover/focus
- Uses [C1: Application Header](LAYOUT.md#c1-application-header) component

**Components:** Primary action button (Login)

---

### US-003: Explore Studio Capabilities
**As a** potential user  
**I want to** learn about the Studio's core features  
**So that** I can understand what I'll be able to build

**Acceptance Criteria:**
- Large, elevated card displays "Build, test, and run everything in one place" heading
- Studio badge with gear icon appears in card top-left
- Three horizontal pill-like info cards describe capabilities:
  - "Knowledge → markdown-driven context"
  - "Agents → forms, prompts, and tools"
  - "Runtime → in-studio conversations"
- Card follows [C3: Card Grid](LAYOUT.md#c3-card-grid) styling with medium shadow
- Uses Large border radius (12px+) from [Border Radius Scale](LAYOUT.md#border-radius-scale)

**Components:** Studio CTA card with badge, heading, description, and informative pills

---

### US-004: Access the Studio Workspace
**As a** authenticated or anonymous user  
**I want to** open the Studio interface  
**So that** I can start building AI agents

**Acceptance Criteria:**
- "Open Studio →" button is prominently placed in the top-right of the Studio card
- Clicking the button opens the "Select Demo Workspace" modal overlay
- Modal includes:
  - Search input "Search or create repository..."
  - List of available local workspaces (local/education, local/plants, local/web-development)
  - Close button to dismiss
- Uses [C8: Modal Dialog](LAYOUT.md#c8-modal-dialog) with backdrop
- Button uses dark slate color consistent with primary CTA styling

**Components:** Primary button, [C8: Modal Dialog](LAYOUT.md#c8-modal-dialog) (Selection modal variant)

---

### US-005: Explore Pre-configured Demo Workspaces
**As a** new user  
**I want to** see and access example workspaces for specific domains  
**So that** I can learn how AI agents work through practical examples

**Acceptance Criteria:**
- "Demo Workspaces" section displays below the Studio CTA
- Section heading and descriptive subtext: "Explore pre-configured workspaces to see how AI agents work"
- Three workspace cards arranged in a grid:
  - **local/education:** Green icon, "Learning and tutoring agents"
  - **local/plants:** Purple icon, "Indoor plant care coaching"
  - **local/web-development:** Orange icon, "React and web component building"
- Each card includes:
  - Colored square icon with building symbol
  - Title (workspace name)
  - Descriptive subtitle
  - Full-width "Open" button with gear icon
  - Small forward arrow (`→`) in top-right corner
- Uses [C3: Card Grid](LAYOUT.md#c3-card-grid) with 3-column layout
- Hover states from [Interactive States](LAYOUT.md#hover) apply (shadow deepens)
- Accent colors (Green, Purple, Orange) distinguish cards

**Components:** Section heading, [C3: Card Grid](LAYOUT.md#c3-card-grid) with 3 cards

---

### US-006: Navigate to a Demo Workspace
**As a** user exploring demos  
**I want to** click on a demo workspace card  
**So that** I can enter that specific workspace in the Studio

**Acceptance Criteria:**
- Clicking "Open" button on any demo card navigates to that workspace's Studio dashboard
- Navigation target: `/workspace/{workspaceId}/studio`
- Supported workspaces: local/education, local/plants, local/web-development
- Button hover state shows visual feedback (scale, shadow)
- Uses [Interactive States](LAYOUT.md#hover) for button interaction

**Components:** Card action button with navigation

---

## Visual Design Reference

**Color Scheme:**
- Background: Off-white/light gray (slate-50) with subtle blue gradient glow
- Text: Dark slate for headings (slate-900), lighter gray for body (slate-600)
- Primary CTA: Dark near-black slate
- Accent colors: Green, Purple, Orange (demo workspace icons only)
- See [Color System](LAYOUT.md#color-system) for exact values

**Typography:**
- Font family: Modern sans-serif (Inter or similar)
- Hierarchy: Bold headings, regular body text with good contrast
- See [Typography Scale](LAYOUT.md#typography-scale)

**Spacing:**
- Ample whitespace between sections (8-16 units)
- Soft, rounded border frame around main content
- See [Spacing System](LAYOUT.md#spacing-system)

**Component Styles:**
- Heavy use of rounded corners (large border-radius)
- Cards use subtle drop shadows for depth
- See [Border Radius Scale](LAYOUT.md#border-radius-scale) and [Shadow Scale](LAYOUT.md#shadow-scale)
