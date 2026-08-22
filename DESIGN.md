---
name: IoT Face Attendance System
description: Modern, real-time AI face recognition attendance and IoT door control admin dashboard
colors:
  primary: "#3b82f6"
  primary-dark: "#1d4ed8"
  primary-light: "#dbeafe"
  sidebar-bg: "#0f172a"
  sidebar-hover: "#1e293b"
  sidebar-active: "#334155"
  surface: "#ffffff"
  surface-alt: "#f8fafc"
  surface-hover: "#f1f5f9"
  border: "#e2e8f0"
  border-light: "#f1f5f9"
  text-primary: "#0f172a"
  text-secondary: "#64748b"
  text-muted: "#94a3b8"
  success: "#10b981"
  success-light: "#d1fae5"
  success-dark: "#059669"
  warning: "#f59e0b"
  warning-light: "#fef3c7"
  warning-dark: "#d97706"
  danger: "#ef4444"
  danger-light: "#fee2e2"
  danger-dark: "#dc2626"
  info: "#6366f1"
  info-light: "#e0e7ff"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge-success:
    backgroundColor: "{colors.success-light}"
    textColor: "{colors.success-dark}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: IoT Face Attendance System

## Overview

**Creative North Star: "The Intelligent Biometric Sentinel"**

The IoT Face Attendance dashboard visual system is engineered for high-trust institutional and educational operations. It balances a high-tech biometric surveillance aesthetic with the clean, approachable precision of modern SaaS analytics. The interface recedes to let live video telemetry, face recognition bounding boxes, and attendance data lead the visual hierarchy.

Dark slate chrome (#0f172a) establishes an authoritative command-center backdrop on the navigation rail, while the content canvas utilizes crisp white cards (#ffffff) over an ultra-clean cool slate surface (#f1f5f9). Subtle glassmorphic gradients and micro-glows provide depth without distraction.

**Key Characteristics:**
- **High-Contrast Telemetry:** Clear separation between ambient surveillance monitors and tactical data tables.
- **Biometric Color Semantics:** Instant color-coded feedback (Emerald for recognized/on-time, Amber for late/review, Rose for stranger/absent).
- **Tabular Precision:** Monospace tabular numbers for timestamps, student IDs, confidence scores, and countdown meters.
- **Card-First Spatial Model:** Structured bento-grid modularity with rounded-2xl geometry.

## Colors

The palette uses an institutional slate foundation punctuated by crisp electric blues for interaction and clear semantic tri-color indicators.

### Primary
- **Electric Blue** (#3b82f6): Primary actions, active navigation states, camera bounding frames, and active filter highlights.
- **Deep Cobalt** (#1d4ed8): Active button states, focused input borders, and primary gradient endpoints.
- **Soft Azure Tint** (#dbeafe): Selected item backgrounds, icon badge containers, and hover pill highlights.

### Neutral
- **Midnight Slate** (#0f172a): Navigation sidebar, primary typography, high-priority metric values.
- **Card Surface White** (#ffffff): Main card containers, modals, table backgrounds, and active tab highlights.
- **Canvas Slate** (#f1f5f9): App shell background providing subtle contrast behind white cards.
- **Muted Slate Text** (#64748b): Secondary labels, table column headers, metadata subtext.
- **Border Slate** (#e2e8f0): Card dividing lines, input outlines, and component bounding strokes.

### Semantic
- **Emerald Green** (#10b981 / bg: #d1fae5 / text: #059669): On-time check-in, recognized face match, connected IoT device online status.
- **Amber Gold** (#f59e0b / bg: #fef3c7 / text: #d97706): Late arrival classification, warnings, unregistered face advisory.
- **Rose Red** (#ef4444 / bg: #fee2e2 / text: #dc2626): Absent records, unidentified stranger alert, connection loss, delete actions.
- **Indigo Violet** (#6366f1 / bg: #e0e7ff): AI model telemetry, descriptor extraction badges, secondary system metrics.

### Named Rules
**The Strict Semantic Triad Rule.** Never use green for decorative accents; green strictly signals verified recognition or online hardware. Red strictly signals unrecognized faces or critical system errors.
**The High-Legibility Contrast Rule.** All text on tinted status badges must use the dark tone variant (#059669 on #d1fae5, #dc2626 on #fee2e2) maintaining minimum WCAG AAA contrast ratio.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, sans-serif fallback)
**Body Font:** Inter
**Label/Mono Font:** Inter with `font-variant-numeric: tabular-nums`

**Character:** Clean, objective neo-grotesque typography engineered for rapid scanning of student IDs, times, and biometric confidence ratings.

### Hierarchy
- **Display** (Font Weight: 800, Size: 1.5rem / 24px, Line Height: 1.2): Main page headers and hero metric figures.
- **Headline** (Font Weight: 700, Size: 1.25rem / 20px, Line Height: 1.3): Card section headers and modal titles.
- **Title** (Font Weight: 700, Size: 1rem / 16px, Line Height: 1.4): Table headers, student names, and setting group titles.
- **Body** (Font Weight: 400/500, Size: 0.875rem / 14px, Line Height: 1.5): Descriptions, form input text, table cell data.
- **Label** (Font Weight: 700, Size: 0.75rem / 12px, Letter Spacing: 0.05em uppercase): Form field labels, status tags, KPI trends.

### Named Rules
**The Tabular Data Rule.** All timestamps, countdown timers, student IDs, and percentage rates must carry the `.tabular-nums` class to eliminate column jitter during real-time streaming updates.

## Layout

The spatial model uses an asymmetric layout with a fixed persistent sidebar (260px expanded / 72px collapsed) and a fixed frosted-glass top header (height: 64px, `backdrop-blur-md`). The main content area adapts dynamically (`p-6`, `max-w-7xl` or full-width) using responsive grid structures:
- **KPI Metrics:** `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5`.
- **Telemetry + HUD View:** `grid grid-cols-1 lg:grid-cols-3 gap-6` (2 columns for live camera feed, 1 column for live event stream).
- **Forms & Filters:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`.

## Elevation & Depth

The system uses a crisp, modern tonal layering model combined with soft ambient drop shadows. Deep elevation is reserved strictly for interactive overlays (Modals: `z-[9999]`, Dropdown menus: `shadow-xl`, Toasts: `shadow-2xl`).

### Shadow Vocabulary
- **Resting Card:** `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)` (subtle structural separation).
- **Elevated Hover:** `box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)` (interactive cards and buttons).
- **Modal & Popover:** `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)`.

### Named Rules
**The Ghost Border Fallback Rule.** Every elevated white card must include a 1px border stroke (`border border-slate-200/80`) to guarantee contrast against bright displays and off-angle viewports.

## Shapes

- **Base Radius:** 16px (`rounded-2xl`) for major cards, modals, and container shells.
- **Component Radius:** 12px (`rounded-xl`) for buttons, text inputs, dropdown selects, and badge chips.
- **Avatars & Status Pills:** Fully rounded (`rounded-full` / 9999px) for student avatar circles and live pulse status dots.

## Components

### Buttons
- **Shape:** 12px border radius (`rounded-xl`).
- **Primary:** Electric Blue background (`#3b82f6`), crisp white text, bold font-weight, subtle blue drop shadow (`shadow-sm shadow-blue-500/25`).
- **Secondary / White:** Pure white background, 1px slate-200 border, dark slate text, subtle hover lift.
- **Danger / Delete:** Rose background tint (`bg-rose-50`) or solid red on confirmation.

### Status Badges (StatusBadge)
- **Structure:** Pill shape (`rounded-full`), leading status dot with optional pulse animation (`animate-pulse-dot`).
- **Variants:**
  - `on-time` / `registered`: Emerald background `#d1fae5`, Emerald text `#059669`.
  - `late`: Amber background `#fef3c7`, Amber text `#d97706`.
  - `not_registered` / `absent`: Rose background `#fee2e2`, Rose text `#dc2626`.

### Modals (Modal)
- **Rendering:** Portaled directly to `document.body` (`z-[9999]`) to avoid CSS transform stacking traps.
- **Backdrop:** Dark slate backdrop blur (`bg-slate-900/60 backdrop-blur-sm`).
- **Entrance Animation:** `animate-scale-in` (scale 0.96 to 1.0, 150ms ease-out).

### Live Camera HUD Overlay
- **Bounding Box (Match):** Neon Emerald 2px border with corner brackets, glowing top name badge, and confidence percentage.
- **Bounding Box (Unknown):** Warning Rose 2px border with alert tag `Người lạ (Chưa đăng ký)`.

## Do's and Don'ts

### Do:
- **Do** format all time strings with leading zeros (e.g. `07:15 AM`) and use `.tabular-nums`.
- **Do** render all dialogs and popovers via `createPortal(..., document.body)` with `z-[9999]`.
- **Do** preserve the 60-second anti-spam check-in cooldown on real-time face matching loops.
- **Do** include loading skeleton/spinner feedback on all asynchronous API actions.

### Don't:
- **Don't** use pure black (#000000) for text; always use Midnight Slate (#0f172a) for natural contrast.
- **Don't** place fixed-position modals inside elements with CSS `transform` or `animation` properties.
- **Don't** allow raw base64 data URLs to be stored directly in `VARCHAR` database columns.
- **Don't** disable scan/recognition action buttons when the database has 0 registered faces.
