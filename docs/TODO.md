# DQ Checker - TODO & Status

**Last Updated:** 2026-01-05

## Current Status

- **Phase:** POC Implementation - GraphQL Integration
- **Build Status:** DevServer + DevGateway both working (webpack compiled with 0 errors)
- **Schema Status:** dq_sources table updated with all connection fields
- **GraphQL Status:** Settings Test Connection working, DataSources list needs GraphQL API schema refresh

---

## Completed

- [x] DevGateway registration working
- [x] DevServer webpack build (0 errors)
- [x] DQCheckerItem manifest registered
- [x] Data Sources CRUD form (DataSourcesView.tsx) - basic version
- [x] Settings page with GraphQL Endpoint config
- [x] About/Help pages integrated
- [x] GraphQL client initialization
- [x] Fabric tokens + FluentUI v9 styling
- [x] Item manifest updated to official toolkit format
- [x] UX Design Proposal approved (docs/specs/UX-DESIGN-PROPOSAL.md)
- [x] Fabric Python Notebook with Soda Core (dq_checker_scan.py)
- [x] Key Vault integration for secure credential storage
- [x] Smoke test verified (sqlserver + Service Principal auth works)
- [x] UX Improvement Plan Phase 1-5
- [x] Notebook refactored to class-based architecture (DQConfig, MetadataDB, SodaExecutor, etc.)
- [x] Key Vault secrets deployed (client-id, meta-db-server, meta-db-name)
- [x] CLAUDE.md trimmed to best practices
- [x] Secrets verification: No hardcoded secrets in notebooks (all via Key Vault)
- [x] **P0 Schema Fix:** dq_sources table updated with correct fields (per ER model) ✅
- [x] **TypeScript types:** dataSource.types.ts - source_type, server_name, database_name, keyvault_uri, client_id, secret_name ✅
- [x] **DataSourceForm:** Full form with 3 sections (Basic, Connection, Authentication) - all 6 fields ✅
- [x] **DataSourceList:** Table shows source_type badge, server/database combined column ✅
- [x] **Service layer:** dataSourceService.ts uses SP-backed GraphQL mutations (`executesp_*`)
- [x] **Settings Persistence:** Using `getWorkloadItem`/`saveWorkloadItem` (same pattern as fabric-datalineage)
- [x] **BUG-001 FIXED:** GraphQL Auth Error 3 - redirect URI mismatch
- [x] **BUG-002 FIXED:** GraphQL endpoint from item definition (not process.env) - pattern from fabric-datalineage
- [x] **BUG-003 VERIFIED:** Settings save fails - workloadClient was optional (?) instead of required ✅
- [x] **BUG-004 FIXED:** GraphQL mutations updated to SP-backed pattern per spec
- [x] **Debug logging:** OneLake debug logger integrated (DebugLoggerContext) - logs to Files/debug_logs/

---

## Schema Changes (2026-01-05)

### dq_sources Table (per ER model)

| Column | Type | Description |
|--------|------|-------------|
| source_id | INT PK | Primary key |
| source_name | NVARCHAR(100) | Unique name |
| source_type | NVARCHAR(50) | fabric_warehouse, fabric_sqldb, spark_sql, azure_sql |
| server_name | NVARCHAR(255) | Fabric SQL endpoint |
| database_name | NVARCHAR(128) | Artifact/database name |
| keyvault_uri | NVARCHAR(500) | Optional per-source Key Vault |
| client_id | NVARCHAR(100) | Optional Service Principal client ID |
| secret_name | NVARCHAR(128) | Optional Key Vault secret name |
| description | NVARCHAR(500) | Optional description |
| is_active | BIT | Active flag |
| created_at | DATETIME2 | Created timestamp |
| updated_at | DATETIME2 | Updated timestamp |

**NOT included (skipped per design):**
- port (always 1433 for Fabric)
- username (use Service Principal instead)
- password_env_var (replaced by secret_name)
- connection_yaml (generated dynamically)

---

## Immediate Next Steps

### ✅ RESOLVED: GraphQL Mutations Now Use SP-Backed Pattern

**Fix Applied (2026-01-05):**
Per spec (docs/specs/items/DQCheckerItem.md), ALL mutations must use SP-backed `executesp_*` pattern.

**Updated dataSourceService.ts:**
- `executesp_create_data_source` - Create new data source
- `executesp_update_data_source` - Update existing data source
- `executesp_delete_data_source` - Delete data source

**Note:** Auto-generated mutations (`createDq_sources`, etc.) are NOT used per design spec.

### Deploy & Test

1. **Deploy schema changes to DB** - Run `setup/simplified-schema-minimal-ddl.sql`
   - Drops and recreates dq_sources with new columns
   - Updates vw_active_data_sources view

2. **Test in Fabric Portal:**
   - Open DQ Checker item
   - Navigate to Data Sources tab
   - Click "Add Connection" - verify form has all fields
   - Test Create/Edit/Delete functionality

3. **Upload notebooks to Fabric workspace:**
   - `src/Notebook/dq_checker_scan.ipynb` - Main scan executor
   - `src/Notebook/smoke_test_writes.ipynb` - DB + OneLake write test

---

## Action List (Priority Order)

### P0: Settings Page - Key Vault Configuration ✅ (DONE)

Settings page exists with GraphQL endpoint configuration.

### P1: Data Source Form - Full CRUD ✅ (DONE)

- [x] Connection Type Dropdown (source_type)
- [x] Server/Database Fields
- [x] Key Vault Reference Fields (keyvault_uri, client_id, secret_name)
- [x] 2-column grid layout with sections
- [x] Test Connection button (placeholder)
- [x] Status banners (success/error/checking)

### P2: UX/Styling (TODO)

- [ ] Card Styling - Colored accent border (top/left), better shadows
- [ ] Form Field Polish - Field icons, inline validation, grouped fields
- [ ] Settings Page Polish - Apply same improvements

### P3: Integration (TODO)

- [ ] Test Connection Backend - Implement actual connection test via GraphQL
- [ ] End-to-end Test - Create check → Run scan → View results

---

## Key Vault Secrets

Current secrets in `chwakv`:

| Secret Name | Purpose | Status |
|-------------|---------|--------|
| `dq-checker-spn-secret` | Service Principal client secret | Exists |
| `dq-checker-spn-client-id` | Service Principal client ID | Added |
| `dq-checker-meta-db-server` | Metadata DB server endpoint | Added |
| `dq-checker-meta-db-name` | Metadata DB name | Added |

---

## Notebooks

| File | Purpose | Status |
|------|---------|--------|
| `dq_checker_scan.py/ipynb` | Main DQ scan executor | Ready for upload |
| `smoke_test_writes.py/ipynb` | DB + OneLake write test | Ready for upload |
| `db_test.py/ipynb` | DB connection test | Deployed, working |
| `smoke_test_simple.py/ipynb` | Soda connection test | Deployed, working |

---

## Known Issues

- [x] Schema needs to be deployed to Fabric SQL DB - DONE
- [x] Settings page Test Connection 403 fix - Added Bearer token auth
- [x] **BUG-001: Settings page Test Connection fails with Error 3** - FIXED (redirect URI mismatch)
- [x] **BUG-002: GraphQL endpoint not passed from settings** - FIXED (pattern from fabric-datalineage)
- [x] **BUG-004 FIXED:** GraphQL mutations - Updated to SP-backed `executesp_*` pattern per spec
- [x] **BUG-005 FIXED:** Cascade delete for data sources with dependent checks
- [ ] Data Source Form Test Connection - Backend not implemented yet
- [ ] **🚨 CRITICAL: BUG-006 - Fabric GraphQL API Performance** - 40+ seconds per request (PROJECT BLOCKER)

---

## Resolved Bugs

### BUG-002: GraphQL Endpoint Not Passed from Settings (FIXED)

**Status:** FIXED (2026-01-05)
**Error:** `POST http://127.0.0.1:60006/DQCheckerItem-editor/... 404`

**Root Cause:** Architectural difference between DQ Checker and working fabric-datalineage:
- DQ Checker tried to use `process.env.DQ_GRAPHQL_ENDPOINT` (empty at runtime)
- fabric-datalineage stores endpoint in item definition and passes it to service

**Fix Applied:**
1. Updated `DQCheckerItemEditor.tsx` to load item definition via `getWorkloadItem()`
2. Pass `graphqlEndpoint` from settings to `initGraphQLClient(workloadClient, endpoint)`
3. Updated `graphqlClient.ts` to require endpoint, throw clear error if not configured

**Pattern (from fabric-datalineage):**
```
User configures endpoint in Settings → Saved to item definition →
Editor loads definition on mount → Passes endpoint to GraphQL client
```

**Files Changed:**
- `DQCheckerItemEditor.tsx` - Added `loadItemDefinition()`, passes endpoint to client
- `graphqlClient.ts` - Removed process.env fallback, endpoint from constructor only

---

### BUG-003: Settings Save Failure (VERIFIED ✅)

**Status:** VERIFIED WORKING (2026-01-05) - User confirmed save button works
**Error:** `Failed to save settings to Fabric`

**Root Cause:** DQCheckerItemSettings used optional workloadClient prop instead of required.
- DQ Checker: `interface DQCheckerItemSettingsProps { workloadClient?: WorkloadClientAPI; }`
- fabric-datalineage: `export function DataLineageSettingsPanel({ workloadClient }: PageProps)`

**Fix Applied:**
1. Changed `DQCheckerItemSettings` to use `PageProps` interface (required workloadClient)
2. Added comprehensive debug logging with `[Settings]` prefix
3. Better error messages showing exact failure reason

**Files Changed:**
- `DQCheckerItemSettings.tsx` - Uses PageProps, added debug logging

---

### BUG-001: GraphQL Authentication Error 3 (FIXED)

**Status:** FIXED (2026-01-05)
**Error:** `Failed to acquire access token: {"error":3}`

**Root Cause:** SPA redirect URI mismatch in Entra app
- Entra app had: `http://localhost:60006/auth`
- Code expects: `http://localhost:60006/close` (index.ts line 29)

**Fix Applied:** Updated Entra app SPA redirect URIs via Graph API:
```bash
az rest --method PATCH --url "https://graph.microsoft.com/v1.0/applications/{id}" \
  --body '{"spa":{"redirectUris":["http://localhost:60006/close",...]}}'
```

**Current Entra App Configuration:**
```json
{
  "spa": [
    "http://localhost:60006/close",
    "https://app.fabric.microsoft.com/workloadSignIn/.../Org.DQChecker",
    "https://app.fabric.microsoft.com/workloadSignIn/.../Org.DataLineage"
  ]
}
```

**Details:** [docs/bugs/BUG-001-GraphQL-Auth-Error.md](bugs/BUG-001-GraphQL-Auth-Error.md)

---

### BUG-004: GraphQL Mutations Not Working (FIXED)

**Status:** FIXED (2026-01-05)
**Error:** Delete button and CRUD operations not working

**Root Cause:** Service was using auto-generated mutations (`createDq_sources`, `deleteDq_sources`) instead of SP-backed mutations per spec.

**Fix Applied:**
Updated `dataSourceService.ts` to use SP-backed mutations:
- `executesp_create_data_source` instead of `createDq_sources`
- `executesp_update_data_source` instead of `updateDq_sources`
- `executesp_delete_data_source` instead of `deleteDq_sources`

**Spec Reference:** `docs/specs/items/DQCheckerItem.md` - ALL mutations use SP-backed pattern.

---

### BUG-005: Cascade Delete for Data Sources (FIXED)

**Status:** FIXED (2026-01-05)
**Error:** Delete fails with constraint violation when source has dependent checks

**Root Cause:** `sp_delete_data_source` did simple DELETE without handling FK constraints.

**Fix Applied:**
Updated SP to cascade delete dependent `dq_checks` records before deleting the source.

**Files Changed:**
- `scripts/Deploy/fix-delete-sp.sql` - SP with cascade delete logic

---

### 🚨 BUG-006: Fabric GraphQL API Performance (CRITICAL - PROJECT BLOCKER)

**Status:** OPEN (2026-01-05)
**Severity:** CRITICAL - May block project viability

**Problem:**
Fabric GraphQL API requests take **40+ seconds** for simple operations:
- Token acquisition: ~1.3s (acceptable)
- Simple query (list sources): **41.6s** ❌
- Mutation (delete): **41.3s** ❌

**Impact:**
- Page load takes over 1 minute
- CRUD operations feel broken to users
- UX is unacceptable for production use

**Root Cause:**
Unknown - appears to be Fabric platform issue:
- Cold start of GraphQL API?
- Throttling?
- Capacity constraints?
- GraphQL API configuration?

**Tested:**
- Direct API calls via PowerShell show same latency
- Not related to frontend code or SP execution time
- Database queries themselves are fast (<1s)

**Potential Solutions:**
1. Contact Microsoft Fabric support
2. Check if GraphQL API needs capacity upgrade
3. Investigate alternative APIs (direct SQL, REST)
4. Check workspace/capacity settings

**This issue could stop the entire project if not resolved.**

---

## References

- UX Design Proposal: `docs/specs/UX-DESIGN-PROPOSAL.md`
- UX Improvement Plan: `docs/specs/UX-IMPROVEMENT-PLAN.md`
- Notebook Implementation: `docs/specs/FABRIC-NOTEBOOK-IMPLEMENTATION.md`
- ER Model: `docs/specs/data-model/er-model-simplified.md`
- Schema DDL: `setup/simplified-schema-minimal-ddl.sql`
