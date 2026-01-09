# DQ Checker - TODO & Status

**Last Updated:** 2026-01-09

## Current Status

- **Phase:** Unified Wizard Implementation COMPLETE
- **Architecture:** OneLake JSON + pandas notebook (no GraphQL, no SQL DB)
- **Build Status:** ✅ DevServer + DevGateway working (webpack 0 errors, tsc 0 errors)
- **Data Storage:** `Files/config/data/` for JSON, `Tables/` for Parquet results

### Unified Testcase Wizard - COMPLETE ✅

Merged Legacy Contract + Checks into unified Testcase wizard WITHOUT feature reduction.

**Two UX Paths (preserving Legacy patterns):**
1. **Quick Check** (`QuickCheckPanel.tsx`) - Single check, sidebar + form, immediate save
2. **Table Checks** (`TestcaseWizard.tsx`) - 3-step wizard for multiple checks

**Implementation:**
- ✅ MetricSidebar with 6 categories (14 metrics total)
- ✅ CheckForm - unified form for ALL metric types
- ✅ WizardContext - state management for wizard
- ✅ ScopeStep / ChecksStep / ReviewStep
- ✅ sodaYamlGenerator.ts - YAML preview in Review step
- ✅ TestcaseList with split button menu (New → Quick Check / Table Checks)

**Key Decisions:**
- Contract → merged into Testcase (one table with embedded checks)
- Suite = N:M grouping of testcases (unchanged)
- Check storage: polymorphic `config: {}` object per check type
- Wizard reduced to 3 steps (merged table+column checks into one step with sidebar)

---

## Completed

### Infrastructure
- [x] DevGateway + DevServer working (webpack 0 errors)
- [x] DQCheckerItem manifest registered
- [x] FluentUI v9 + Fabric tokens
- [x] Settings persistence (`getWorkloadItem`/`saveWorkloadItem`)

### Frontend (OneLake JSON)
- [x] OneLake JSON services (source, testcase, suite)
- [x] DataContext with load-all-cache-in-memory pattern
- [x] DataSourcesView CRUD connected to DataContext
- [x] TestcaseForm wizard with embedded checks
- [x] Debug logging to OneLake (`useDebugLog()`)

### Notebook (pandas + lakehouse)
- [x] ConfigReader - reads JSON from `/lakehouse/default/`
- [x] ResultWriter - writes Parquet to Tables folder
- [x] SodaExecutor - Soda Core integration
- [x] Key Vault for target DWH credentials only

---

## Architecture (2026-01-06)

### OneLake JSON Storage

| Entity | Location | Description |
|--------|----------|-------------|
| Sources | `Files/config/data/sources/*.json` | Connection configs |
| Testcases | `Files/config/data/testcases/*.json` | Table scope + embedded checks |
| Suites | `Files/config/data/suites/*.json` | Business metadata + testcase refs |
| Results | `Tables/dq_results/` | Parquet (notebook writes) |
| Execution Logs | `Tables/dq_execution_logs/` | Parquet (notebook writes) |

**Data Model:** `docs/specs/data-model/json-data-model.md`

### Why OneLake JSON?

- No cold start (GraphQL API had 5-22 second startup)
- No CU cost (GraphQL consumes capacity units)
- Load-all-cache-in-memory pattern (<200ms total load)
- Write-through mutations (<100ms CRUD)

---

## Migration Progress

### Phase 4: UI Migration ✅ COMPLETE

**Services Created:**
- `onelakeJsonService.ts` - Low-level OneLake DFS API operations
- `sourceService.ts` - Source CRUD via OneLake JSON
- `testcaseService.ts` - Testcase CRUD with embedded checks
- `suiteService.ts` - Suite CRUD with testcase refs

**Context Layer:**
- `DataContext.tsx` - Load-all-cache-in-memory pattern
- Hooks: `useSources()`, `useTestcases()`, `useChecks()`, `useSuites()`

**UI Components Updated:**
- `DataSourcesView.tsx` - Connected to DataContext
- `DataSourceList.tsx` - String UUIDs, no onRefresh (reactive)
- `DataSourceForm.tsx` - String sourceId
- `TestcaseForm.tsx` - NEW: Unified testcase + checks wizard

**Type Refactoring:**
- `dataSource.types.ts` - Re-exports Source as DataSource
- `types/index.ts` - Central exports for all types

### Phase 5: Notebook Migration ✅ COMPLETE

**Migrated from PySpark to Python notebook with pandas:**

**Key Changes:**
- Uses `/lakehouse/default/` mount point (built-in notebook auth)
- Reads JSON config via `pd.read_json()` and `glob`
- Writes Parquet results via `pd.to_parquet()`
- Key Vault only for target DWH credentials (pyodbc/Soda)

**Updated Classes:**
- `ConfigReader` - Reads JSON from lakehouse via pandas (no Spark needed)
- `ResultWriter` - Writes Parquet to Tables folder via pandas
- `DQConfig` - Key Vault only for target DWH Service Principal

**Authentication:**
- **Lakehouse:** Built-in notebook auth (no secrets needed)
- **Target DWH:** Key Vault secrets for Service Principal (Soda checks)

### Phase 6: E2E Test + Commit (NEXT)

1. **Deploy & test in Fabric Portal:**
   - Create/Edit/Delete data sources
   - Verify JSON files in OneLake
   - Run notebook, verify results

---

## Action List (Priority Order)

### ✅ Completed Features

- Settings page with Key Vault configuration
- Data Source Form - Full CRUD with all fields
- OneLake JSON architecture (no GraphQL)
- Notebook updated for pandas + lakehouse
- Legacy review (Contract wizard, Check types, Suite/Testcase)
- TestcasesView + TestcaseList components

### ✅ Completed: Unified Wizard Spec

- [x] Research Soda schema validation check syntax
- [x] Analyze Fabric/Soda feature support for all 14 check types
- [x] Define JSON schema for check storage (table vs column level)
- [x] Create detailed unified wizard spec: `docs/specs/UNIFIED-WIZARD-SPEC.md`

### ✅ Completed: Unified Wizard Implementation

**Phase 1: Update Types & Schemas**
- [x] Update `check.types.ts` with all 14 metric types + categories
- [x] Define `CheckConfig` union type for polymorphic configs
- [x] Add `defaultCheckInput` with sensible defaults

**Phase 2: Wizard Infrastructure**
- [x] Create `TestcaseWizard.tsx` with 3-step navigation
- [x] Create step components: `ScopeStep`, `ChecksStep`, `ReviewStep`
- [x] Add wizard state management via `WizardContext.tsx`

**Phase 3: Check Forms**
- [x] Create `ThresholdFields.tsx` - shared fail/warn threshold inputs
- [x] Create `CheckForm.tsx` - unified form for ALL 14 metrics
- [x] Create `MetricSidebar.tsx` - tree-based categorized metric selector
- [x] Support all check types: row_count, freshness, schema, custom_sql, scalar_comparison, missing, duplicate, invalid, min, max, avg, sum, avg_length, reference

**Phase 4: YAML Generation & Integration**
- [x] Create `sodaYamlGenerator.ts` - converts checks to YAML
- [x] Add YAML preview in ReviewStep
- [x] Wire wizard to testcaseService via DataContext
- [x] Update `TestcaseList.tsx` with split button menu (Quick Check / Table Checks)
- [x] Create `QuickCheckPanel.tsx` for single-check creation

### 🔜 Next Steps

- [ ] E2E Test - Create source/testcase → Run notebook → View results
- [ ] UX Polish - Card styling, form icons, better validation

---

## Key Vault Secrets

Required secrets in `chwakv` (for target DWH access via Soda):

| Secret Name | Purpose |
|-------------|---------|
| `dq-checker-spn-secret` | Service Principal client secret |
| `dq-checker-spn-client-id` | Service Principal client ID |

**Note:** Lakehouse access uses built-in notebook auth (no secrets needed).

---

## Notebooks

| File | Purpose | Status |
|------|---------|--------|
| `dq_checker_scan.ipynb` | Main DQ scan executor (pandas + lakehouse) | Updated for OneLake JSON |
| `smoke_test_writes.ipynb` | Lakehouse write test | Legacy |
| `db_test.ipynb` | DB connection test | Legacy |
| `smoke_test_simple.ipynb` | Soda connection test | Legacy |

**Note:** Only `.ipynb` files in `src/Notebook/`. Python notebook (not PySpark).

---

## Known Issues

None - all resolved with OneLake JSON migration.

---

## References

- **Data Model:** `docs/specs/data-model/json-data-model.md` (current)
- **Design Principles:** `docs/specs/DESIGN-PRINCIPLES.md`
- **Notebook Implementation:** `docs/specs/FABRIC-NOTEBOOK-IMPLEMENTATION.md`
- **Automation:** `docs/specs/AUTOMATION.md`
- **UX Design Proposal:** `docs/specs/UX-DESIGN-PROPOSAL.md`
- **UX Improvement Plan:** `docs/specs/UX-IMPROVEMENT-PLAN.md`

### Archived (GraphQL/SQL Database)

Previous architecture documentation moved to `archive/docs/`:
- `archive/docs/specs/data-model/er-model-simplified.md` - SQL ER model
- `archive/docs/specs/FABRIC-ARCHITECTURE.md` - SQL + GraphQL architecture
- `archive/docs/specs/items/DQCheckerItem.md` - GraphQL API spec
