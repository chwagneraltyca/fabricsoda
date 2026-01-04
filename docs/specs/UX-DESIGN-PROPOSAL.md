# DQ Checker UX Design Proposal

**Status:** APPROVED - Ready for Implementation
**Date:** 2026-01-04
**Goal:** Align on visual design language before implementation

---

## Design Decisions (APPROVED)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Brand Color** | Fabric default blue | Platform consistency per Fabric guidelines |
| **Action Icons** | Semantic colors on hover | Fabric status tokens + progressive disclosure |
| **Card Style** | Shadow4 + border + radiusMedium | Fabric elevation system standard |
| **Empty State** | Icon + title + description + button | Fabric empty state pattern |
| **Form Inputs** | `colorNeutralBackground2` background | Fabric form field standard |

---

## 1. Current State vs Target State

### Current Issues (from screenshot)

| Issue | Description |
|-------|-------------|
| **Flat visual hierarchy** | Title and content blend together, no visual separation |
| **Plain empty state** | Just text, no visual guidance or call-to-action emphasis |
| **Generic button styling** | Default Fabric green, doesn't match legacy brand |
| **Missing visual warmth** | Feels like a basic form, not a polished product |
| **No card depth** | Filter section and table lack visual distinction |
| **Sparse layout** | Too much white space without purpose |

### Target: Legacy Design Qualities to Preserve

| Quality | Legacy Implementation | Fabric Equivalent |
|---------|----------------------|-------------------|
| **Soft blue brand color** | `#7C9FF5` primary | Custom brand token |
| **Card accents** | Top border accent on cards | `borderTop` styling |
| **Icon-rich UI** | Icons before labels, in buttons | FluentUI icons |
| **Semantic action colors** | Green=test, Yellow=toggle, Blue=edit, Red=delete | Token overrides |
| **Warm gray palette** | `#F9FAFB` backgrounds | `colorNeutralBackground2` |
| **Professional shadows** | Subtle `shadow-sm` | `shadow4` token |

---

## 2. Color Palette Proposal

### Primary Brand Colors

```
Primary (Soft Blue)
├── 50:  #EFF6FF  (backgrounds, hover states)
├── 100: #DBEAFE  (badges, light accents)
├── 500: #7C9FF5  (primary buttons, links) ← MAIN BRAND
├── 600: #6B8FE8  (hover states)
└── 700: #5A7ED9  (pressed states)
```

### Semantic Status Colors

```
Success (Teal)           Warning (Amber)          Danger (Rose)
├── 50:  #F0FDFA         ├── 50:  #FFFBEB         ├── 50:  #FFF1F2
├── 100: #CCFBF1         ├── 100: #FEF3C7         ├── 100: #FFE4E6
├── 600: #0D9488         ├── 600: #D97706         ├── 600: #E11D48
└── 700: #0F766E         └── 700: #B45309         └── 700: #BE123C
```

### Neutral Grays

```
Gray Scale (Tailwind-aligned)
├── 50:  #F9FAFB  (page background)
├── 100: #F3F4F6  (card backgrounds, table headers)
├── 200: #E5E7EB  (borders, dividers)
├── 500: #6B7280  (secondary text)
├── 700: #374151  (body text)
└── 900: #111827  (headings)
```

---

## 3. Component Design Specifications

### 3.1 Page Header

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [Icon] Title                              [+ Primary Button]│
│         Subtitle/description text                            │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Title: 24px, weight 700, `gray-900`
- Subtitle: 14px, weight 400, `gray-500`
- Icon: 24px, `primary-600`
- Button: Primary appearance with icon, soft blue background

### 3.2 Filter Card

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [✓] Active only                    Total: 5 connection(s)  │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `colorNeutralBackground1` (white)
- Border: 1px solid `gray-200`
- Border-radius: 8px
- Padding: 12px 16px
- Shadow: `shadow4` (subtle)

### 3.3 Data Table

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  NAME          │ DESCRIPTION      │ STATUS    │ ACTIONS     │
├─────────────────────────────────────────────────────────────┤
│  Production_DWH│ Main warehouse   │ [Active]  │ ⚡ ↔ ✏ 🗑   │
│  Staging_DWH   │ Test environment │ [Inactive]│ ⚡ ↔ ✏ 🗑   │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Container: White background, 8px radius, subtle shadow
- Header row: `gray-100` background, uppercase labels, `gray-500` text
- Body rows: White background, `gray-200` border-top
- Row hover: `gray-50` background
- Cell padding: 12px 24px

**Status Badge:**
- Active: `success-100` bg, `success-700` text, pill shape
- Inactive: `gray-100` bg, `gray-700` text, pill shape

**Action Buttons:**
- Subtle appearance (transparent background)
- Icon-only with tooltips
- Colors on hover:
  - Test (⚡): `success-600`
  - Toggle (↔): `warning-600`
  - Edit (✏): `primary-600`
  - Delete (🗑): `danger-600`

### 3.4 Empty State

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    [Database Icon 48px]                     │
│                                                             │
│                  No connections found                       │
│        Click "Add Connection" to create your first one      │
│                                                             │
│                   [+ Add Connection]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Icon: 48px, `gray-300` color
- Title: 18px, weight 600, `gray-700`
- Description: 14px, `gray-500`
- Button: Secondary appearance or ghost with icon
- Padding: 64px vertical

### 3.5 Form Dialog

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Add Connection                                        [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Connection Name *                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ e.g., Production_DWH                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Description                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Optional description of this connection             │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Toggle] Active                                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Add Connection]     │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Width: 672px max (2xl)
- Header: 24px padding, `gray-100` background, border-bottom
- Body: 24px padding
- Footer: 24px padding, `gray-50` background, border-top
- Input fields: `gray-50` background, focus ring `primary-500`
- Labels: 14px, weight 500, `gray-700`

### 3.6 Delete Confirmation

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                     [Warning Icon 56px]                     │
│                                                             │
│                   Delete Connection?                        │
│                                                             │
│     Are you sure you want to delete "Production_DWH"?       │
│              This action cannot be undone.                  │
│                                                             │
│                   [Cancel]  [Delete]                        │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Width: 448px max (sm)
- Icon: 56px, `danger-600`
- Title: 18px, weight 600
- Delete button: `danger-600` background, white text
- Centered layout

---

## 4. Interactive States

### 4.1 Button States

| State | Primary Button | Secondary Button | Subtle/Icon Button |
|-------|---------------|------------------|-------------------|
| Default | `primary-500` bg | White bg, `gray-300` border | Transparent |
| Hover | `primary-600` bg, lift shadow | `gray-50` bg | `gray-100` bg |
| Pressed | `primary-700` bg | `gray-100` bg | `gray-200` bg |
| Disabled | 50% opacity | 50% opacity | 50% opacity |
| Loading | Spinner replaces icon | Spinner replaces icon | Spinner |

### 4.2 Input States

| State | Styling |
|-------|---------|
| Default | `gray-50` bg, `gray-200` border |
| Focus | White bg, `primary-500` border, soft blue ring |
| Error | `danger-50` bg, `danger-500` border |
| Disabled | `gray-100` bg, 50% opacity |

### 4.3 Notification Feedback

**Success Toast:**
- `success-500` background
- White text
- Checkmark icon
- Auto-dismiss 5s

**Error Toast:**
- `danger-500` background
- White text
- Warning icon
- Manual dismiss

---

## 5. Spacing & Layout Grid

### Spacing Scale (matches Tailwind)

```
XS:  4px   (tight gaps)
S:   8px   (icon margins, inline spacing)
M:   16px  (component padding, form gaps)
L:   24px  (section spacing, card padding)
XL:  32px  (page sections)
XXL: 48px  (empty state padding)
```

### Layout Constraints

- Max content width: 1280px (7xl)
- Page padding: 24px
- Card padding: 16px (compact) / 24px (spacious)
- Table cell padding: 12px vertical, 24px horizontal

---

## 6. Typography Scale

| Use | Size | Weight | Color |
|-----|------|--------|-------|
| Page title | 24px | 700 | `gray-900` |
| Section title | 18px | 600 | `gray-900` |
| Card title | 16px | 600 | `gray-900` |
| Body text | 14px | 400 | `gray-700` |
| Secondary text | 14px | 400 | `gray-500` |
| Labels | 14px | 500 | `gray-700` |
| Table headers | 12px | 500 | `gray-500` (uppercase) |
| Hints/captions | 12px | 400 | `gray-500` |
| Badges | 12px | 500 | varies |

---

## 7. Final Design Decisions (Based on Fabric Guidelines)

### Decision 1: Primary Brand Color - **Fabric Default**

**Choice:** Use Fabric's `colorBrandBackground` token (default blue)

**Fabric Guideline:** *"The primary brand color for Microsoft Fabric is a blue hue that aligns with Microsoft's broader color system"*

**UX Rationale:** Workloads should feel native to Fabric platform. Custom brand colors create visual inconsistency when DQ Checker appears alongside other Fabric items.

### Decision 2: Action Button Colors - **Semantic on Hover**

**Choice:** Subtle buttons with semantic status colors appearing on hover

**Fabric Guideline:** Status colors are explicitly defined - `colorStatusSuccessForeground1`, `colorStatusWarningForeground1`, `colorStatusDangerForeground1`

**UX Rationale:** Progressive disclosure keeps UI calm. Colors on hover match Fabric MenuItem patterns and Microsoft 365 apps (Outlook, Teams).

### Decision 3: Card Styling - **Shadow + Border**

**Choice:** `shadow4` + `colorNeutralStroke2` border + `borderRadiusMedium`

**Fabric Guideline:** Elevation system uses shadow tokens. `shadow4` = "subtle shadow" for cards.

**UX Rationale:** This matches Fabric's Drawer, Dialog components. Top accent borders are NOT a Fabric pattern.

### Decision 4: Empty State - **Full Pattern**

**Choice:** Icon (48-64px) + Title + Description + Action Button

**Fabric Guideline:** Explicit empty state pattern documented: *"Don't use generic messages like 'No data' without further guidance"*

**UX Rationale:** Empty states are onboarding moments. Guide users to success with clear next action.

### Decision 5: Form Inputs - **Subtle Background**

**Choice:** `colorNeutralBackground2` background on inputs

**Fabric Guideline:** Form field patterns use subtle background differentiation.

**UX Rationale:** Provides visual definition for input fields against white dialogs.

---

## 8. Visual Comparison Summary

| Element | Current | Proposed |
|---------|---------|----------|
| **Brand feel** | Generic Fabric | DQ Checker identity with soft blue |
| **Visual depth** | Flat | Layered with shadows |
| **Action clarity** | All icons same color | Semantic color coding |
| **Empty states** | Plain text | Illustrated with guidance |
| **Forms** | Basic fields | Structured with sections |
| **Feedback** | MessageBar only | Toast + inline messages |

---

## 9. Next Steps

1. **Review this proposal** - Comment on design decisions above
2. **Approve direction** - Confirm color palette and component styling
3. **Implementation** - Update tokens and components to match spec
4. **Iteration** - Review in Fabric portal and refine

---

## Appendix: Token Usage Guide

### Use Fabric Tokens Directly (No Overrides)

```typescript
import { tokens } from '@fluentui/react-components';

// Primary/Brand - use as-is
tokens.colorBrandBackground        // Primary buttons
tokens.colorBrandBackgroundHover   // Hover state
tokens.colorBrandBackgroundPressed // Pressed state

// Status Colors - for action button hovers
tokens.colorStatusSuccessForeground1  // Test connection (green)
tokens.colorStatusDangerForeground1   // Delete (red)
tokens.colorPaletteYellowForeground1  // Toggle/Warning (yellow)

// Neutral - for surfaces
tokens.colorNeutralBackground1     // Cards, dialogs
tokens.colorNeutralBackground2     // Input backgrounds
tokens.colorNeutralBackground3     // Table headers
tokens.colorNeutralStroke2         // Borders
tokens.colorNeutralForeground1     // Primary text
tokens.colorNeutralForeground3     // Secondary text

// Elevation
tokens.shadow4                     // Cards (subtle)
tokens.shadow8                     // Elevated menus
tokens.shadow16                    // Dialogs

// Spacing
tokens.spacingVerticalM            // Standard padding
tokens.spacingHorizontalL          // Card padding
tokens.borderRadiusMedium          // Standard corners
```

### Action Button Styling Pattern

```typescript
const useActionButtonStyles = makeStyles({
  // Base: subtle appearance, neutral color
  actionButton: {
    color: tokens.colorNeutralForeground2,
  },

  // Test Connection - green on hover
  actionTest: {
    '&:hover': {
      color: tokens.colorStatusSuccessForeground1,
      backgroundColor: tokens.colorStatusSuccessBackground1,
    },
  },

  // Toggle Status - yellow on hover
  actionToggle: {
    '&:hover': {
      color: tokens.colorPaletteYellowForeground1,
      backgroundColor: tokens.colorPaletteYellowBackground1,
    },
  },

  // Edit - brand blue on hover
  actionEdit: {
    '&:hover': {
      color: tokens.colorBrandForeground1,
      backgroundColor: tokens.colorBrandBackground2,
    },
  },

  // Delete - red on hover
  actionDelete: {
    '&:hover': {
      color: tokens.colorStatusDangerForeground1,
      backgroundColor: tokens.colorStatusDangerBackground1,
    },
  },
});
```

### Card Component Pattern

```typescript
const useCardStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
  },
});
```

### Empty State Pattern

```typescript
const useEmptyStateStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    color: tokens.colorNeutralForeground4,
    marginBottom: tokens.spacingVerticalM,
  },
  title: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalS,
  },
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalL,
    maxWidth: '320px',
  },
});
```
