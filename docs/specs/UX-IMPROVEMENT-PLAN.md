# DQ Checker UX Improvement Plan - Modern CRUD Template

**Status:** ✅ UNBLOCKED - Ready to Continue
**Date:** 2026-01-05 (Updated)
**Goal:** Transform DataSources CRUD from "functional" to "professional-grade" following 2025 modern standards

---

## Blocker Resolved

### BUG-001: GraphQL Authentication Error 3 (FIXED)

**Status:** FIXED (2026-01-05)
**Root Cause:** SPA redirect URI mismatch in Entra app

The Entra app had `http://localhost:60006/auth` but the code in `index.ts` expects `/close`:
```javascript
const redirectUriPath = '/close';
```

**Fix Applied:** Updated Entra app SPA redirect URIs via Graph API:
- Changed `http://localhost:60006/auth` to `http://localhost:60006/close`
- Added production redirect URIs for both Org.DQChecker and Org.DataLineage

**Details:** [docs/bugs/BUG-001-GraphQL-Auth-Error.md](../bugs/BUG-001-GraphQL-Auth-Error.md)

---

## Implementation Status

### Phase 1-5: Basic Improvements (DONE but not enough)
| Phase | Change | Status |
|-------|--------|--------|
| 1. Typography | 28px title, letter-spacing | ✅ Done |
| 2. Empty State | 96px gradient wrapper, 48px icon | ✅ Done |
| 3. Elevation | shadow2 filter, shadow4 table | ✅ Done |
| 4. Action Buttons | scale(1.05) hover, cubic-bezier | ✅ Done |
| 5. Background | colorNeutralBackground2 container | ✅ Done |

### User Feedback: "Still looks like school project"
The implemented changes are not enough. Need more significant improvements.

---

## Phase 6-10: Major Overhaul (TODO)

### Phase 5.5: Settings Tab Fix (DONE)
**Problem:** Custom "Preferences" tab not appearing in Fabric Settings dialog
**Root Cause:** Item manifest missing `itemSettings.getItemSettings` configuration
**Fix Applied:**
```json
"itemSettings": {
    "getItemSettings": {
        "action": "getItemSettings"
    }
}
```
**Status:** ✅ Fixed - [DQCheckerItem.json](../../src/Workload/Manifest/items/DQCheckerItem/DQCheckerItem.json)

---

### Phase 6: DATABASE SCHEMA FIX (DONE) ✅
**Problem:** Current `dq_sources` table was missing connection attributes
**Status:** ✅ Fixed - DDL updated per ER model

**Updated Schema (per ER model - NO port/username/password_env_var):**
```sql
CREATE TABLE dbo.dq_sources (
    source_id INT IDENTITY(1,1) PRIMARY KEY,
    source_name NVARCHAR(100) NOT NULL,
    source_type NVARCHAR(50) NOT NULL DEFAULT 'fabric_warehouse',  -- fabric_warehouse, fabric_sqldb, spark_sql, azure_sql
    server_name NVARCHAR(255) NOT NULL DEFAULT '',                  -- Fabric SQL endpoint
    database_name NVARCHAR(128) NOT NULL DEFAULT '',                -- Artifact/database name
    keyvault_uri NVARCHAR(500),                                     -- Azure Key Vault URI (nullable)
    client_id NVARCHAR(100),                                        -- Service Principal client ID (nullable)
    secret_name NVARCHAR(128),                                      -- Key Vault secret name (nullable)
    description NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
```

**Skipped fields (per design decision):**
- port (always 1433 for Fabric)
- username (use Service Principal instead)
- password_env_var (replaced by secret_name for Key Vault)
- connection_yaml (generated dynamically)

**Action Items:**
- [x] Update DDL: `setup/simplified-schema-minimal-ddl.sql` ✅
- [x] Update view: `vw_active_data_sources` ✅
- [x] Update TypeScript types: `dataSource.types.ts` ✅
- [x] Update form: `DataSourceForm.tsx` ✅

### Phase 7: Data Source Form - Full CRUD (DONE) ✅
**Problem:** Form only has name/description, needs full connection fields
**Status:** ✅ Fixed - Form has 3 sections with all fields

**Implemented Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source_name | text | ✓ | Unique identifier |
| source_type | dropdown | ✓ | fabric_warehouse, fabric_sqldb, spark_sql, azure_sql |
| server_name | text | ✓ | Fabric SQL endpoint |
| database_name | text | ✓ | Artifact/database name |
| keyvault_uri | text | - | Optional per-source Key Vault URI |
| client_id | text | - | Optional Service Principal client ID |
| secret_name | text | - | Optional Key Vault secret name |
| description | textarea | - | Optional description |
| is_active | toggle | ✓ | Active/inactive |

**Action Items:**
- [x] Update `DataSourceForm.tsx` with all fields ✅
- [x] Add source type dropdown ✅
- [x] Add 2-column grid layout with 3 sections ✅
- [x] Add Test Connection button (placeholder) ✅
- [x] Add connection status banners ✅

### Phase 8: Update/Delete Form Implementation (DONE) ✅
**Problem:** No edit/delete functionality for data sources
**Status:** ✅ Already implemented in DataSourceList.tsx

**Action Items:**
- [x] Implement Edit mode in form ✅
- [x] Implement Delete confirmation dialog ✅
- [x] Add form validation ✅
- [x] Add inline validation feedback ✅

### Phase 9: Data Lineage Style Connection UI (DONE) ✅
**Problem:** Need professional connection testing like data lineage solution
**Status:** ✅ Fixed - Added to both DataSourceForm and Settings page

**Implemented:**
```tsx
// Connection status states
type ConnectionStatus = 'idle' | 'checking' | 'success' | 'error';

// Status banners with Fabric tokens:
// - Green (success): MessageBar intent="success"
// - Red (error): MessageBar intent="error"
// - Blue + spinner (checking): MessageBar intent="info"
```

**Action Items:**
- [x] Add ConnectionStatus type ✅
- [x] Add colored status banners (MessageBar) ✅
- [x] Add Test Connection button ✅
- [x] Settings page: Fixed 403 by adding Bearer token auth ✅

### Phase 9.5: Settings Page Auth Fix (DONE) ✅
**Problem:** Test Connection in Settings page returned 403 Forbidden
**Root Cause:** Plain `fetch()` without Bearer token authentication
**Fix Applied:** Use `FabricAuthenticationService` to acquire token before request

```typescript
// Before (broken):
const response = await fetch(settings.graphqlEndpoint, {
    headers: { 'Content-Type': 'application/json' },
});

// After (fixed):
const authService = new FabricAuthenticationService(workloadClient);
const tokenResult = await authService.acquireAccessToken(FABRIC_BASE_SCOPES.POWERBI_API);
const response = await fetch(settings.graphqlEndpoint, {
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenResult.token}`,
    },
});
```
**Status:** ✅ Fixed

### Phase 9.7: Connection Test UX Fix (DONE) ✅
**Problem:** Duplicate "Testing..." messages during connection test
**Root Cause:** Two intermediate status messages shown during test phases
**Reference:** fabric-datalineage project (simpler pattern with no intermediate messages)

**Before (confusing UX):**
- Button: "Testing..."
- Status area: "Authenticating with Fabric..." → "Testing GraphQL connection..."

**After (clean UX):**
- Button: "Testing..." with spinner (single indicator)
- Result card: Only shown after completion (success/error)

**Fix Applied:**
```typescript
// Before (two intermediate messages):
setConnectionTest({ status: 'testing', message: 'Authenticating with Fabric...' });
// ... auth code ...
setConnectionTest({ status: 'testing', message: 'Testing GraphQL connection...' });

// After (simple testing state, no intermediate messages):
setConnectionTest({ status: 'testing', message: '' });
// ... auth + query in one block ...
// Result only shown after completion

// UI: Only show result card for success/error, not during testing
{(connectionTest.status === 'success' || connectionTest.status === 'error') && (
    <div className={...}>{connectionTest.message}</div>
)}
```

**Status:** ✅ Fixed - Matches Data Lineage pattern

### Phase 9.6: Settings Persistence Fix (DONE) ✅
**Problem:** Settings used localStorage (browser-only, not persistent across sessions/devices)
**Root Cause:** Fallback implementation instead of proper Fabric item definition storage
**Reference:** fabric-datalineage project (`DataLineageSettingsPanel.tsx`)

**Fix Applied:** Use `getWorkloadItem`/`saveWorkloadItem` from ItemCRUDController

```typescript
// Before (broken - localStorage):
const stored = localStorage.getItem(`dqchecker-settings-${itemObjectId}`);
localStorage.setItem(`dqchecker-settings-${itemObjectId}`, JSON.stringify(settings));

// After (fixed - Fabric persistence):
import { getWorkloadItem, saveWorkloadItem, ItemWithDefinition } from '../../controller/ItemCRUDController';

// Load from Fabric backend
const loadedItem = await getWorkloadItem<DQCheckerSettings>(workloadClient, itemObjectId, DEFAULT_SETTINGS);
setItem(loadedItem);
setSettings(loadedItem.definition);

// Save to Fabric backend
await saveWorkloadItem<DQCheckerSettings>(workloadClient, { ...item, definition: settings });
```

**Benefits:**
- ✅ Persists across page refresh
- ✅ Persists across browser sessions
- ✅ Works across devices (stored in Fabric SQL backend)
- ✅ Same pattern as fabric-datalineage reference project

**Status:** ✅ Fixed - [DQCheckerItemSettings.tsx](../../src/Workload/app/items/DQCheckerItem/DQCheckerItemSettings.tsx)

### Phase 10: Professional Card & Form Styling
**Problem:** Cards look flat, forms look basic
**Improvements Needed:**
- [ ] Card with colored accent border (top or left)
- [ ] 2-column grid layout for form fields
- [ ] Section icons with colored backgrounds
- [ ] Field icons (like legacy Flask app)
- [ ] Better placeholder text
- [ ] Inline validation feedback
- [ ] Match Linear/Notion card depth

---

## Research Sources

- [Refine - React CRUD Framework](https://refine.dev/blog/react-admin-template/)
- [Fluent 2 Design System](https://fluent2.microsoft.design/)
- [Linear App UI Redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Empty State UX Best Practices](https://www.eleken.co/blog-posts/empty-state-ux)
- [FluentUI v9 Components](https://react.fluentui.dev/)

---

## 1. Current State Analysis

### Screenshot Assessment (6/10)

| What Works | What Needs Improvement |
|------------|------------------------|
| Tab navigation clean | Empty state icon too small (40px) |
| Page header has hierarchy | No visual warmth/brand identity |
| Filter card has shadow | Filter and table same elevation |
| Primary CTA visible | Description text cut off |
| Basic structure correct | Generic Fabric green button |

### Gap Analysis: Legacy Flask vs Current

| Feature | Legacy Flask | Current Fabric | Gap |
|---------|-------------|----------------|-----|
| Brand color | `#7C9FF5` soft blue | Generic green | Missing identity |
| Color depth | 9-step scales | Single tokens | Flat appearance |
| Empty state | Warm illustrations | Cold icon | Missing warmth |
| Hover effects | Rich transitions | Basic | Missing polish |
| Typography | Dramatic hierarchy | Safe defaults | Lacks impact |

---

## 2. Modern CRUD Template Standards (2025)

Based on research from Linear, Notion, Refine, and CoreUI:

### 2.1 Visual Hierarchy Principles

```
Title Impact Scale:
├── Page Title: 28-32px (Hero900) - Bold, high contrast
├── Section Title: 20-24px (Hero700) - Semibold
├── Card Title: 16-18px (Base500) - Medium
├── Body Text: 14px (Base300) - Regular
└── Caption/Meta: 12px (Base200) - Light gray
```

### 2.2 Empty State Best Practices

From [Eleken Empty State UX](https://www.eleken.co/blog-posts/empty-state-ux):

**Do:**
- Use context-specific messaging ("No connections yet" not "No data")
- Include clear CTA with action verb ("Add Connection")
- Match product's visual language
- Keep illustration simple, monochrome (Linear/Notion style)

**Don't:**
- Leave blank screens
- Use generic copy-paste messages
- Overload with multiple CTAs
- Use distracting colorful illustrations

### 2.3 Card Elevation System

```
Elevation Levels:
├── Level 0: Flat (inline content)
├── Level 1: shadow2 (filter bars, secondary)
├── Level 2: shadow4 (cards, main content)
├── Level 3: shadow8 (elevated cards, hover)
├── Level 4: shadow16 (dialogs, popovers)
└── Level 5: shadow28 (modals, overlays)
```

### 2.4 Animation Standards

From Linear design system:

| Element | Duration | Easing |
|---------|----------|--------|
| Button hover | 150ms | ease-out |
| Card hover lift | 200ms | cubic-bezier(0.33, 1, 0.68, 1) |
| Dialog enter | 200ms | cubic-bezier(0.33, 1, 0.68, 1) |
| Dialog exit | 150ms | cubic-bezier(0.32, 0, 0.67, 0) |
| Fade transitions | 150ms | ease-in-out |

---

## 3. Techniques Available in Fabric iframe Frontend

### 3.1 What CAN Be Used (Supported)

| Technique | Implementation | Notes |
|-----------|----------------|-------|
| **CSS-in-JS** | `makeStyles` hook | Full support |
| **CSS Transitions** | All properties | Performance optimized |
| **CSS Transforms** | translate, scale, rotate | GPU accelerated |
| **CSS Animations** | @keyframes via makeStyles | Limited support |
| **Fabric Tokens** | All `tokens.*` | Required for theming |
| **FluentUI v9 Components** | All documented components | Native support |
| **SVG Icons** | @fluentui/react-icons | Full library |
| **Inline SVG** | Custom illustrations | Supported |
| **CSS Variables** | Via tokens | Theme-aware |
| **Media Queries** | Responsive design | Supported |
| **CSS Grid/Flexbox** | Modern layout | Full support |

### 3.2 What CANNOT/SHOULD NOT Be Used

| Technique | Reason |
|-----------|--------|
| External CSS libraries | Sandbox restrictions |
| Tailwind CSS | Not in build pipeline |
| Custom fonts | Must use Fabric fonts |
| External images (CDN) | CSP restrictions |
| Custom brand colors | Should use Fabric tokens |
| localStorage/cookies | Limited in iframe |
| External JS libraries | Bundle size, security |

### 3.3 FluentUI v9 Components for CRUD

| Component | Use Case | Status |
|-----------|----------|--------|
| `Table` / `DataGrid` | Data display | Available |
| `Dialog` | Forms, confirmations | Available |
| `Card` | Containers | Available |
| `Badge` | Status indicators | Available |
| `Button` | Actions | Available |
| `Field` + `Input` | Form fields | Available |
| `Spinner` | Loading states | Available |
| `MessageBar` | Notifications | Available |
| `Tooltip` | Action hints | Available |
| `Menu` | Context actions | Available |

---

## 4. Improvement Plan

### Phase 1: Visual Hierarchy & Typography (HIGH IMPACT)

**Goal:** Make the page title more impactful, create clear visual hierarchy

**Changes:**

```typescript
// DataSourceList.tsx - Increase title impact
pageTitle: {
  fontSize: tokens.fontSizeHero900,  // Increase from Hero800
  fontWeight: tokens.fontWeightBold,
  color: tokens.colorNeutralForeground1,
  letterSpacing: '-0.02em',  // Tighter tracking for headlines
  margin: 0,
},

pageSubtitle: {
  fontSize: tokens.fontSizeBase400,  // Increase from Base300
  color: tokens.colorNeutralForeground2,  // Slightly darker
  marginTop: tokens.spacingVerticalS,
},
```

### Phase 2: Empty State Enhancement (HIGH IMPACT)

**Goal:** Transform cold empty state into warm, guiding experience

**Current:**
```
┌─────────────────────────────────────────┐
│         [40px icon, no wrapper]          │
│         No connections yet               │
│         Get started by adding...         │
│              [Button]                    │
└─────────────────────────────────────────┘
```

**Improved:**
```
┌─────────────────────────────────────────┐
│                                         │
│     ┌─────────────────────────────┐     │
│     │                             │     │
│     │    [64px icon with         │     │
│     │     gradient background     │     │
│     │     and subtle shadow]      │     │
│     │                             │     │
│     └─────────────────────────────┘     │
│                                         │
│      No connections yet                 │
│      (18px, semibold, dark)             │
│                                         │
│      Get started by adding a database   │
│      connection. You'll be able to run  │
│      data quality checks on your        │
│      Fabric Warehouse.                  │
│      (14px, regular, gray, max 400px)   │
│                                         │
│         [+ Add Connection]              │
│         (Primary button, prominent)     │
│                                         │
└─────────────────────────────────────────┘
```

**Code Changes:**

```typescript
// DataSourceList.tsx - Enhanced empty state
emptyStateIconWrapper: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '96px',
  height: '96px',
  ...shorthands.borderRadius('50%'),
  background: `linear-gradient(135deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground1} 100%)`,
  boxShadow: tokens.shadow8,
  marginBottom: tokens.spacingVerticalXL,
},

emptyStateIcon: {
  fontSize: '48px',  // Increase from 40px
  color: tokens.colorBrandForeground1,
},

emptyStateTitle: {
  fontSize: tokens.fontSizeBase600,  // Increase from Base500
  fontWeight: tokens.fontWeightSemibold,
  color: tokens.colorNeutralForeground1,
  marginBottom: tokens.spacingVerticalM,
},

emptyStateDescription: {
  fontSize: tokens.fontSizeBase300,
  color: tokens.colorNeutralForeground3,
  textAlign: 'center' as const,
  maxWidth: '360px',
  lineHeight: '1.6',
  marginBottom: tokens.spacingVerticalXL,
},
```

### Phase 3: Elevation Differentiation (MEDIUM IMPACT)

**Goal:** Create visual depth between filter card and table

**Changes:**

```typescript
// Filter card - Lower elevation
filterCard: {
  backgroundColor: tokens.colorNeutralBackground1,
  boxShadow: tokens.shadow2,  // Reduce from shadow4
  ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
  // Remove hover elevation change
},

// Table container - Higher elevation
tableContainer: {
  backgroundColor: tokens.colorNeutralBackground1,
  boxShadow: tokens.shadow4,
  ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  // Keep hover elevation
  '&:hover': {
    boxShadow: tokens.shadow8,
  },
},
```

### Phase 4: Action Button Polish (MEDIUM IMPACT)

**Goal:** Make action buttons more discoverable with subtle always-visible tint

**Changes:**

```typescript
// Subtle tint visible at rest, stronger on hover
actionSuccess: {
  color: tokens.colorNeutralForeground2,
  backgroundColor: tokens.colorSubtleBackground,  // Subtle tint
  transition: 'all 0.15s ease-out',
  '&:hover': {
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
    transform: 'scale(1.05)',  // Subtle grow
  },
},
```

### Phase 5: Page Background (LOW IMPACT, HIGH POLISH)

**Goal:** Add subtle warmth to page background

**Changes:**

```typescript
// In parent container or ItemEditor styles
pageBackground: {
  backgroundColor: tokens.colorNeutralBackground2,  // Slightly off-white
  minHeight: '100%',
},
```

---

## 5. Implementation Checklist

### Phase 1: Typography (Est. 15 min)
- [ ] Update `pageTitle` to `fontSizeHero900` with letter-spacing
- [ ] Update `pageSubtitle` to `fontSizeBase400` with darker color
- [ ] Verify build compiles
- [ ] User tests visual change

### Phase 2: Empty State (Est. 30 min)
- [ ] Add `emptyStateIconWrapper` style with gradient background
- [ ] Increase icon size to 48px
- [ ] Update title to `fontSizeBase600`
- [ ] Ensure full description text visible
- [ ] Update JSX to wrap icon in new wrapper
- [ ] Verify build compiles
- [ ] User tests visual change

### Phase 3: Elevation (Est. 15 min)
- [ ] Reduce filterCard shadow to `shadow2`
- [ ] Keep tableContainer at `shadow4`
- [ ] Verify build compiles
- [ ] User tests visual change

### Phase 4: Action Buttons (Est. 15 min)
- [ ] Add subtle background tint at rest
- [ ] Add scale transform on hover
- [ ] Verify build compiles
- [ ] User tests visual change

### Phase 5: Page Background (Est. 10 min)
- [ ] Add container background color
- [ ] Verify build compiles
- [ ] User tests visual change

---

## 6. Before/After Comparison

### Before (Current)
- Flat, clinical appearance
- Small empty state icon
- Generic Fabric green
- Same elevation everywhere
- Safe typography choices

### After (Improved)
- Layered, warm appearance
- Prominent empty state with gradient
- Fabric brand blue (native)
- Clear elevation hierarchy
- Impactful typography with letter-spacing

---

## 7. Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Empty state icon size | 40px | 48px in 96px wrapper |
| Page title size | Hero800 (~24px) | Hero900 (~28px) |
| Filter card shadow | shadow4 | shadow2 |
| Table container shadow | shadow4 | shadow4 (hover: shadow8) |
| Visual depth layers | 1 | 3 |
| Typography scale ratio | 1.2x | 1.5x |

---

## 8. MS Fabric UX Compliance Check

| Requirement | Implementation | Compliant |
|-------------|----------------|-----------|
| FluentUI v9 only | All components from @fluentui/react-components | ✓ |
| Fabric tokens only | All colors from `tokens.*` | ✓ |
| No custom colors | Using colorBrandBackground2 for gradient | ✓ |
| CSS-in-JS | makeStyles hook | ✓ |
| Accessibility | Fabric tokens pre-validated | ✓ |
| Theme support | Tokens auto-switch for dark mode | ✓ |

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Gradient not supported | Fallback to solid colorBrandBackground2 |
| fontSizeHero900 not available | Use fontSizeHero800 with custom fontSize |
| Performance impact | CSS transforms are GPU-accelerated |
| Theme inconsistency | All values from Fabric tokens |

---

## 10. Next Steps

1. **User Approval** - Review this plan and approve direction
2. **Phase 1 Implementation** - Typography changes
3. **User Testing** - Verify in Fabric portal
4. **Phase 2-5 Implementation** - Iterate based on feedback
5. **Documentation** - Update UX-DESIGN-PROPOSAL.md with learnings

---

## Appendix: Code Templates

### A. Gradient Icon Wrapper (Copy-Paste Ready)

```typescript
emptyStateIconWrapper: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '96px',
  height: '96px',
  ...shorthands.borderRadius('50%'),
  background: `linear-gradient(135deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground1} 100%)`,
  boxShadow: tokens.shadow8,
  marginBottom: tokens.spacingVerticalXL,
},
```

### B. Enhanced Title Style (Copy-Paste Ready)

```typescript
pageTitle: {
  fontSize: '28px',  // Explicit for Hero900 equivalent
  fontWeight: tokens.fontWeightBold,
  color: tokens.colorNeutralForeground1,
  letterSpacing: '-0.02em',
  lineHeight: '1.2',
  margin: 0,
},
```

### C. Scale-on-Hover Button (Copy-Paste Ready)

```typescript
actionButton: {
  color: tokens.colorNeutralForeground2,
  backgroundColor: tokens.colorSubtleBackground,
  transition: 'all 0.15s cubic-bezier(0.33, 1, 0.68, 1)',
  '&:hover': {
    transform: 'scale(1.05)',
  },
  '&:active': {
    transform: 'scale(0.98)',
  },
},
```
