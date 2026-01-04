# DQ Checker Simplification Analysis v3

## Executive Summary

After deep code review of all legacy forms, APIs, SPs, and templates, this document provides the revised architecture that:
1. **Preserves N:M relationship**: Suite ←N:M→ Testcase →1:N→ Checks (testcase reuse across suites)
2. **Merges Suite + Contract UI** under "Suite" naming with wizard UX
3. **Makes Suite optional** for simple single-check scenarios
4. **Testcase = Table Scope** (source, schema, table) - the atomic execution unit
5. **Eliminates ONLY `dq_contracts`** - redundant entity merged into testcase
6. **Keeps `suites_testcases`** - N:M link table for testcase reuse

---

## Revised ER Model

### Hierarchy with N:M Preserved
```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  dq_suites  │────────<│ suites_testcases │>────────│dq_testcases │
│             │    N:M  └──────────────────┘    N:M  │             │
│ • suite_id  │                                      │• testcase_id│
│ • category  │                                      │• source_id  │
│ • domain    │                                      │• schema     │
│ • owner     │                                      │• table_name │
└─────────────┘                                      └──────┬──────┘
                                                            │ 1:N
                                                     ┌──────┴──────┐
                                                     │  dq_checks  │
                                                     └──────┬──────┘
                                                            │
                    ┌──────────┬────────┬─────────┬─────────┤
                    │          │        │         │         │
               freshness   schema  reference  scalar    custom
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **N:M preserved** | Same testcase reusable across multiple suites |
| Suite is OPTIONAL | Simple checks can exist in testcase without any suite |
| Testcase = Table Scope | source_id, schema_name, table_name live here |
| Suite = Business Metadata | category, data_domain, execution_order, suite_code |
| Checks reference testcase_id | Not suite_id - preserves table grouping |
| Contract ELIMINATED | Was 1:1 with testcase, redundant fields |

### Why This Works Better

**Single Check Scenario (Quick Add):**
```
User picks: Source → Schema → Table → Check Type
System creates: Testcase (auto-named) + Check
Result: Check exists without suite (no row in suites_testcases)
```

**Multi-Table Suite Scenario (Wizard):**
```
Step 1: Suite metadata (name, category, domain, owner)
Step 2: Pick Table 1 (creates/reuses Testcase 1)
Step 3: Add checks to Table 1
Step 4: [Add Another Table] → creates/reuses Testcase 2
Step 5: Review all → Save
Result: 1 Suite ←N:M→ N Testcases → M Checks
```

**Testcase Reuse Scenario:**
```
Existing: "dbo.trips" testcase with freshness + row_count checks
User creates new suite: "Monthly Audit Suite"
User adds existing "dbo.trips" testcase to suite
Result: Same testcase now in 2 suites (N:M link)
```

---

## Entity Attribute Analysis

### dq_suites (Merged from legacy Suite + Contract metadata)

| Field | Source | Keep | Notes |
|-------|--------|------|-------|
| suite_id | Suite | YES | PK |
| suite_name | Suite | YES | |
| suite_code | Suite | YES | Auto-generated if null |
| description | Both | YES | |
| category | Suite | **YES** | Critical business metadata |
| data_domain | Suite | **YES** | Critical business metadata |
| execution_order | Suite | YES | Pipeline sequencing |
| owner | Both | YES | Suite-level default |
| tags | Both | YES | JSON array |
| is_active | Both | YES | |
| created_at | Both | YES | Audit |
| updated_at | Both | YES | Audit |

### dq_testcases (Table Scope Container)

| Field | Source | Keep | Notes |
|-------|--------|------|-------|
| testcase_id | Testcase | YES | PK |
| testcase_name | Testcase | YES | Auto: "{schema}.{table}" |
| source_id | Contract | YES | Moved from Contract |
| schema_name | Both | YES | |
| table_name | Contract | YES | Moved from Contract |
| owner | Testcase | YES | Inheritable from suite |
| tags | Testcase | YES | Can extend suite tags |
| is_active | Testcase | YES | Enable/disable |
| created_at | Testcase | YES | |
| updated_at | Testcase | YES | |

**Note:** Relationship to suites via `suites_testcases` N:M table, not direct FK.

### dq_contracts - ELIMINATED

| Field | Disposition | Rationale |
|-------|-------------|-----------|
| contract_id | REMOVE | Merged into testcase concept |
| source_id | → Testcase | Already on testcase |
| schema_name | → Testcase | Already on testcase |
| table_name | → Testcase | Already on testcase |
| contract_name | → Testcase.testcase_name | Same purpose |
| required_columns | REMOVE | Duplicate of dq_checks_schema |
| forbidden_columns | REMOVE | Duplicate of dq_checks_schema |
| column_types | REMOVE | Duplicate of dq_checks_schema |
| severity | → Per check | More granular |
| testcase_id | N/A | Was 1:1, now testcase IS the entity |

### suites_testcases (Many-to-Many Link) - KEPT

| Field | Keep | Notes |
|-------|------|-------|
| suite_id | YES | FK to dq_suites (PK part) |
| testcase_id | YES | FK to dq_testcases (PK part) |
| created_at | YES | Audit timestamp |

**Rationale:** Preserves testcase reuse across multiple suites. A testcase (table scope) can belong to many suites, and a suite can contain many testcases.

---

## Feature Catalog: What to Preserve

### From Suite Form (add_suite.html)

| Feature | Priority | Implementation |
|---------|----------|----------------|
| Suite name, code, description | P1 | Step 1 of wizard |
| **Category dropdown** | P1 | Step 1 - critical metadata |
| **Data Domain dropdown** | P1 | Step 1 - critical metadata |
| Owner field | P1 | Step 1 with user preference default |
| Tags input | P1 | Step 1 |
| is_active toggle | P2 | Step 1 |
| Testcase picker with filters | P2 | Replaced by "Add Table" flow |
| Pagination | P2 | For check list in review step |
| Toggle all selection | P2 | For check list in review step |
| User preferences loading | P2 | Default owner, category, domain |

### From Contract Wizard (add_contract_wizard.html)

| Feature | Priority | Implementation |
|---------|----------|----------------|
| **Cascading dropdowns** (Source→Schema→Table) | P1 | Step 2 |
| Table-level check templates | P1 | Step 3 |
| Column-level check templates | P1 | Step 4 |
| Check config forms (22 types) | P1 | Step 3-4 dynamic forms |
| Added checks list with remove | P1 | Step 3-4 |
| Review step with tree view | P1 | Step 5 |
| "Add Another Table" button | P1 | Step 5 → loops to Step 2 |

### From Checks Form (add_check.html)

| Feature | Priority | Implementation |
|---------|----------|----------------|
| **22 check type templates** | P1 | Shared with wizard |
| Metric-specific fields | P1 | Dynamic form sections |
| Threshold config (single/range) | P1 | |
| Warn + Fail thresholds | P1 | |
| Severity dropdown | P1 | |
| Dimension dropdown | P2 | |
| Filter condition | P2 | |
| YAML preview | P3 | Optional - internal detail |

### From API Endpoints

| Endpoint | Priority | New Implementation |
|----------|----------|-------------------|
| GET /api/schemas/{source_id} | P1 | Keep - Fabric API or GraphQL |
| GET /api/tables/{source_id}/{schema} | P1 | Keep - Fabric API or GraphQL |
| GET /api/columns/{source_id}/{table} | P1 | Keep - Fabric API or GraphQL |
| GET /api/datetime-columns | P1 | For freshness check |
| GET /api/discover-schema | P2 | Autocreate schema check |
| POST /api/validate_scalar_query | P2 | For scalar comparison check |
| GET /api/metrics | P2 | Dropdown population |
| GET /api/comparison-operators | P2 | Dropdown population |

---

## Check Types: 22 Templates

| Category | Check Types | Extension Table |
|----------|-------------|-----------------|
| **Completeness** | row_count, missing_count, missing_percent | Base |
| **Accuracy** | numeric_range, aggregation_metric | Base |
| **Uniqueness** | duplicate_count, duplicate_percent | Base |
| **Validity** | invalid_count, invalid_percent, values_in_set, string_length, regex_match | Base |
| **Freshness** | freshness | dq_checks_freshness |
| **Schema** | schema | dq_checks_schema |
| **Reference** | foreign_key, reference | dq_checks_reference |
| **Custom** | custom_sql, custom_metric | dq_checks_custom |
| **Scalar** | scalar_comparison | dq_checks_scalar |

### SP Routing (Preserved)
```typescript
const SP_ROUTING = {
  // Standard metrics → sp_create_check
  'row_count': 'sp_create_check',
  'missing_count': 'sp_create_check',
  // ... etc

  // Specialized metrics → extension SPs
  'freshness': 'sp_create_freshness_check',
  'schema': 'sp_create_schema_check',
  'reference': 'sp_create_reference_check',
  'foreign_key': 'sp_create_reference_check',
  'scalar_comparison': 'sp_create_scalar_comparison_check',
  'custom_sql': 'sp_create_custom_sql_check',
};
```

---

## UX Flow: Two Entry Points

### Entry Point Decision

User chooses how to start - this determines which steps are shown:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  How would you like to add checks?                                      │
│                                                                         │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  │  [Create Suite]                 │  │  [Quick Check]                  │
│  │                                 │  │                                 │
│  │  With business metadata:        │  │  Just add checks to a table    │
│  │  • category                     │  │  (no suite metadata)           │
│  │  • data_domain                  │  │                                 │
│  │  • owner, tags                  │  │  Skips Step 1 entirely         │
│  │  • execution_order              │  │                                 │
│  │                                 │  │                                 │
│  │  → Full wizard (Steps 1-5)      │  │  → Steps 2-5 only              │
│  └─────────────────────────────────┘  └─────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

### What Gets Skipped with "Quick Check"

| Field | Create Suite | Quick Check |
|-------|--------------|-------------|
| suite_name | Step 1 | SKIPPED |
| suite_code | Step 1 (auto-gen) | SKIPPED |
| category | Step 1 | SKIPPED |
| data_domain | Step 1 | SKIPPED |
| execution_order | Step 1 | SKIPPED |
| owner | Step 1 | SKIPPED (or inherit from user) |
| tags | Step 1 | SKIPPED |
| is_active | Step 1 | SKIPPED |

**Result:** Quick Check creates testcase without any `suites_testcases` link (orphan testcase)

### API/SP Flag Mechanism

The API receives a flag to know whether to create suite records:

```typescript
// Frontend payload
const payload = {
  create_suite: true,  // or false for Quick Check

  // Suite data (only sent if create_suite: true)
  suite: {
    suite_name: "Customer DQ Suite",
    category: "Production",
    data_domain: "Customer",
    owner: "Data Engineering",
    tags: ["critical", "daily"]
  },

  // Always sent - testcase + checks
  testcases: [{
    source_id: 1,
    schema_name: "dbo",
    table_name: "trips",
    checks: [
      { metric: "row_count", fail_threshold: 1000 },
      { metric: "freshness", column_name: "updated_at", threshold: "24h" }
    ]
  }]
};
```

```sql
-- SP handles the flag
CREATE PROCEDURE sp_create_checks_batch
  @create_suite BIT = 0,           -- Flag: create suite or not
  @suite_name NVARCHAR(255) = NULL,
  @category NVARCHAR(100) = NULL,
  @data_domain NVARCHAR(100) = NULL,
  -- ... other suite fields (ignored if @create_suite = 0)
  @testcases NVARCHAR(MAX)         -- JSON array with checks
AS
BEGIN
  DECLARE @suite_id INT = NULL;

  -- Only create suite if flag is set
  IF @create_suite = 1
  BEGIN
    INSERT INTO dq_suites (suite_name, category, data_domain, ...)
    VALUES (@suite_name, @category, @data_domain, ...);
    SET @suite_id = SCOPE_IDENTITY();
  END

  -- Create or find testcase(s)
  -- Create checks...

  -- Only link to suite if suite was created (N:M)
  IF @suite_id IS NOT NULL
  BEGIN
    INSERT INTO suites_testcases (suite_id, testcase_id)
    VALUES (@suite_id, @testcase_id);
  END
END
```

### Flow Summary

| Path | Steps | Suite Created | Link Created |
|------|-------|---------------|--------------|
| **Create Suite** | 1 → 2 → 3 → 4 → 5 | YES | YES (in suites_testcases) |
| **Quick Check** | 2 → 3 → 4 → 5 | NO | NO (orphan testcase) |

Both paths share **Steps 2-5** (same React components), just different starting point.

---

## Full Wizard Flow (Create Suite)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Suite Metadata                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Suite Name: [________________________] *                               │
│  Suite Code: [________] (auto-generated)                                │
│  Description: [________________________]                                │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Category        │  │ Data Domain     │  │ Execution Order │         │
│  │ [Production ▼]  │  │ [Customer   ▼]  │  │ [0          ]   │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  Owner: [Data Engineering Team____] (from user prefs)                  │
│  Tags:  [critical, daily__________]                                    │
│                                                                         │
│  [x] Suite is active                                                    │
│                                                                         │
│                                        [Cancel]  [Next: Select Table →]│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Select Table                                    [Table 1 of N] │
├─────────────────────────────────────────────────────────────────────────┤
│  This creates a Testcase for the selected table.                       │
│                                                                         │
│  Data Source: [NYTaxi Sample DWH  ▼]                                   │
│               └── Cascading from dq_sources                            │
│                                                                         │
│  Schema:      [dbo                ▼]  ← API: /api/schemas/{source_id}  │
│               └── Loaded after source selected                         │
│                                                                         │
│  Table:       [trips              ▼]  ← API: /api/tables/{source}/{schema}
│               └── Loaded after schema selected                         │
│                                                                         │
│  Testcase Name: [dbo.trips________] (auto-filled, editable)           │
│                                                                         │
│                              [← Back]  [Next: Table Checks →]          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Table-Level Checks                          [Table: dbo.trips] │
├─────────────────────────────────────────────────────────────────────────┤
│  Add checks that apply to the entire table (no column specified)       │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Row Count    │ │ Freshness    │ │ Schema       │ │ Custom SQL   │   │
│  │   [+ Add]    │ │   [+ Add]    │ │   [+ Add]    │ │   [+ Add]    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                         │
│  ── Row Count Config (shown when [+ Add] clicked) ─────────────────── │
│  │ Check Name: [Trip count threshold_______]                          │ │
│  │ Fail when: [< ▼] [1000____]   Warn when: [< ▼] [5000____]          │ │
│  │ Severity: [High ▼]  Dimension: [Completeness ▼]                    │ │
│  │                                              [Cancel] [Add Check]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Added Checks (2):                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ - row_count: fail < 1000, warn < 5000           [Edit] [x]      │   │
│  │ - freshness: pickup_datetime < 24h               [Edit] [x]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                        [← Back]  [Skip]  [Next: Column Checks →]       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Column-Level Checks                         [Table: dbo.trips] │
├─────────────────────────────────────────────────────────────────────────┤
│  Add checks for specific columns                                        │
│                                                                         │
│  Column: [pickup_datetime ▼]  ← API: /api/columns/{source}/{table}     │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Missing      │ │ Duplicate    │ │ Invalid      │ │ Range        │   │
│  │   [+ Add]    │ │   [+ Add]    │ │   [+ Add]    │ │   [+ Add]    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                         │
│  Added Checks for dbo.trips (4 total):                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Table-level:                                                     │   │
│  │   - row_count: fail < 1000                              [x]     │   │
│  │   - freshness: pickup_datetime < 24h                    [x]     │   │
│  │ Column-level:                                                    │   │
│  │   - pickup_datetime: missing_count = 0                  [x]     │   │
│  │   - fare_amount: range 0-500                            [x]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                        [← Back]  [Next: Review →]                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Review & Save                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Suite: "Customer Data Quality Suite"                                   │
│  Code: SUITE_00042                                                      │
│  Category: Production  │  Domain: Customer  │  Order: 0                │
│  Owner: Data Engineering Team  │  Tags: critical, daily                │
│                                                                         │
│  Tables in this Suite (2):                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ > dbo.trips (4 checks)                              [Edit] [x]  │   │
│  │   |-- row_count: fail < 1000                                    │   │
│  │   |-- freshness: pickup_datetime < 24h                          │   │
│  │   |-- pickup_datetime: missing = 0                              │   │
│  │   +-- fare_amount: range 0-500                                  │   │
│  │                                                                  │   │
│  │ > dbo.customers (2 checks)                          [Edit] [x]  │   │
│  │   |-- email: missing_count = 0                                  │   │
│  │   +-- customer_id: duplicate_count = 0                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  [+ Add Another Table]   ← Returns to Step 2 for next table      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│                        [← Back]  [Save Suite]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Quick Check Flow (Skips Step 1)

When user selects "Quick Check", they start directly at Step 2:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Select Table                               [Quick Check Mode]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ℹ️ No suite will be created. Check will be saved without              │
│     business metadata (category, data_domain, etc.)                    │
│     You can assign to a suite later if needed.                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Data Source: [NYTaxi Sample DWH  ▼]                                   │
│  Schema:      [dbo                ▼]                                   │
│  Table:       [trips              ▼]                                   │
│                                                                         │
│  Testcase Name: [dbo.trips________] (auto-filled)                      │
│                                                                         │
│                              [Cancel]  [Next: Table Checks →]          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        (Same Steps 3, 4, 5 as full wizard)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Review & Save                              [Quick Check Mode]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ⚠️ No Suite - checks saved without business metadata                  │
│                                                                         │
│  Table: dbo.trips (4 checks)                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │   |-- row_count: fail < 1000                                    │   │
│  │   |-- freshness: pickup_datetime < 24h                          │   │
│  │   |-- pickup_datetime: missing = 0                              │   │
│  │   +-- fare_amount: range 0-500                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  [+ Add Another Table]                                            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│                        [← Back]  [Save Checks]                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Quick Check Result:**
- Creates `dq_testcases` record (no link in suites_testcases)
- Creates `dq_checks` records linked to testcase
- User can later assign orphan testcases to a suite via "Manage Suites" (inserts into suites_testcases)

---

## Stored Procedure Changes

### Before (31 SPs)
```
Suites:    sp_create_suite, sp_update_suite, sp_delete_suite,
           sp_get_all_suites, sp_add_testcases_to_suite,
           sp_remove_testcase_from_suite, sp_get_suite_checks

Contracts: sp_create_contract_with_testcase, sp_update_contract,
           sp_delete_contract, sp_get_contract_details,
           sp_add_column_check_to_contract, sp_remove_column_check_from_contract

Testcases: sp_create_testcase_with_checks, sp_update_testcase,
           sp_delete_testcase, sp_list_testcases, sp_get_testcase_details

Checks:    sp_create_check, sp_update_check, sp_delete_check, sp_toggle_check,
           sp_create_freshness_check, sp_update_freshness_check,
           sp_create_schema_check, sp_update_schema_check,
           sp_create_reference_check, sp_update_reference_check,
           sp_create_scalar_comparison_check, sp_update_scalar_comparison_check,
           sp_create_custom_sql_check, sp_update_custom_sql_check
```

### After (18 SPs)
```
Suites:    sp_create_suite, sp_update_suite, sp_delete_suite,
           sp_get_suite_details

Testcases: sp_create_testcase, sp_update_testcase, sp_delete_testcase,
           sp_get_testcase_details

Checks:    sp_create_check, sp_update_check, sp_delete_check, sp_toggle_check,
           sp_create_freshness_check, sp_create_schema_check,
           sp_create_reference_check, sp_create_scalar_comparison_check,
           sp_create_custom_sql_check

Data Sources: sp_create_data_source, sp_update_data_source, sp_delete_data_source
```

**Reduction: 31 → 18 SPs (42% reduction)**

### Key SP Changes

| Old SP | New Behavior |
|--------|--------------|
| sp_create_contract_with_testcase | Replaced by sp_create_testcase + sp_create_check |
| sp_add_testcases_to_suite | KEPT - INSERT into suites_testcases |
| sp_remove_testcase_from_suite | KEPT - DELETE from suites_testcases |
| sp_*_contract | REMOVED - Contract entity eliminated |

---

## Database Schema Changes

### Tables Eliminated
- `dq_contracts` - Merged into testcase concept (redundant 1:1)

### Tables KEPT
- `suites_testcases` - N:M link preserved for testcase reuse

### Tables Modified

**dq_testcases** (add table_name from Contract):
```sql
ALTER TABLE dbo.dq_testcases
ADD table_name NVARCHAR(255) NOT NULL;

-- Testcase can exist without suite (no row in suites_testcases)
-- When suite deleted, suites_testcases rows cascade delete
-- Testcase itself remains (orphaned, can be reassigned)
```

**dq_suites** (unchanged, already has all needed fields):
```sql
-- Verify category and data_domain exist (they do in legacy)
-- These are CRITICAL business metadata fields
```

**suites_testcases** (unchanged, N:M link):
```sql
-- Composite PK (suite_id, testcase_id)
-- ON DELETE CASCADE from both sides
```

---

## GraphQL API Pattern

### Reads
```graphql
# Get suite with all testcases and checks (via N:M)
query GetSuiteDetails($suiteId: Int!) {
  dq_suites(filter: { suite_id: { eq: $suiteId } }) {
    items {
      suite_id
      suite_name
      category
      data_domain
      # Related testcases via suites_testcases
      suites_testcases {
        dq_testcases {
          testcase_id
          testcase_name
          schema_name
          table_name
          # Related checks
          dq_checks {
            check_id
            check_name
            metric
            column_name
          }
        }
      }
    }
  }
}

# Get orphan testcases (not in any suite)
# Use LEFT JOIN / NOT EXISTS pattern
query GetOrphanTestcases {
  vw_orphan_testcases {  # View that filters testcases not in suites_testcases
    items {
      testcase_id
      testcase_name
    }
  }
}
```

### Writes (SP-backed)
```graphql
mutation CreateSuite($input: SuiteInput!) {
  executesp_create_suite(
    suite_name: $input.suite_name
    category: $input.category
    data_domain: $input.data_domain
    owner: $input.owner
    tags: $input.tags
  ) {
    suite_id
  }
}

mutation CreateTestcase($suiteId: Int, $input: TestcaseInput!) {
  executesp_create_testcase(
    suite_id: $suiteId  # Can be null!
    source_id: $input.source_id
    schema_name: $input.schema_name
    table_name: $input.table_name
    testcase_name: $input.testcase_name
  ) {
    testcase_id
  }
}
```

---

## API Strategy: Stored Procedures vs Auto-Generated Mutations

### Microsoft Fabric GraphQL Best Practices

Based on [Microsoft documentation](https://learn.microsoft.com/en-us/fabric/data-engineering/api-graphql-stored-procedures), Fabric GraphQL provides **two approaches** for mutations:

| Approach | When to Use | Example |
|----------|-------------|---------|
| **Auto-generated mutations** | Simple CRUD on single tables | `createDq_sources`, `updateDq_suites` |
| **Stored Procedures** | Complex business logic, multi-table transactions | `sp_create_freshness_check` (inserts into 2 tables) |

### Recommended Hybrid Approach

**Use AUTO-GENERATED mutations for:**
- `dq_sources` - Simple table CRUD
- `dq_suites` - Simple table CRUD
- `suites_testcases` - Simple N:M link table
- `dq_testcases` - Simple table CRUD (when not creating checks simultaneously)

**Use STORED PROCEDURES for:**
- Extension checks (freshness, schema, reference, scalar, custom) - **multi-table atomicity required**
- Batch operations (create testcase + checks in one call)
- Complex validation rules

### Revised SP Count

| Category | Auto-Generated | Stored Procedure | Rationale |
|----------|----------------|------------------|-----------|
| Data Sources | create, update, delete | - | Simple CRUD |
| Suites | create, update, delete | - | Simple CRUD |
| Suite Links | create, delete | - | Simple N:M |
| Testcases | create, update, delete | sp_create_testcase_with_checks | Batch + link optional |
| Standard Checks | create, update, delete, toggle | - | Simple CRUD |
| Freshness Check | - | sp_create_freshness_check | Multi-table |
| Schema Check | - | sp_create_schema_check | Multi-table |
| Reference Check | - | sp_create_reference_check | Multi-table |
| Scalar Check | - | sp_create_scalar_comparison_check | Multi-table |
| Custom SQL Check | - | sp_create_custom_sql_check | Multi-table |

**Result: Only 6 SPs required** (vs 20 in DDL)

### GraphQL Mutations (Auto-Generated)

Fabric GraphQL auto-generates these mutations for tables with PKs:

```graphql
# Auto-generated for dq_sources table
mutation { createDq_sources(item: { source_name: "NYTaxi", description: "..." }) { source_id } }
mutation { updateDq_sources(source_id: 1, item: { description: "Updated" }) { source_id } }
mutation { deleteDq_sources(source_id: 1) { source_id } }

# Auto-generated for suites_testcases link table
mutation { createSuites_testcases(item: { suite_id: 1, testcase_id: 5 }) { suite_id testcase_id } }
mutation { deleteSuites_testcases(suite_id: 1, testcase_id: 5) { suite_id testcase_id } }
```

### GraphQL Mutations (SP-Backed)

```graphql
# SP-backed for multi-table operations
mutation {
  executesp_create_freshness_check(
    testcase_id: 1,
    check_name: "Data freshness",
    freshness_column: "updated_at",
    threshold_value: 24,
    threshold_unit: "h"
  ) {
    check_id
    testcase_name
    freshness_column
    freshness_threshold_value
  }
}
```

### DDL Simplification

The DDL file (`setup/simplified-schema-ddl.sql`) includes all 20 SPs for completeness. In practice:

1. **Deploy all tables and views** - Required
2. **Deploy only 6 extension SPs** - Others are auto-generated
3. **Test both approaches** - Validate auto-generated work correctly

**Note:** Auto-generated mutations require tables to have PKs defined (which they do).

---

## Power BI Reporting Strategy

### Phase 1: Link (POC)
Add "View Report" button in workload ribbon that opens Power BI report in new tab.

```
DQ Checker Workload Ribbon
[Save] [Run Checks] [View Report ->]
                         |
                         v Opens in new tab
Power BI Report: DQ Checker Results
(Same workspace, DirectQuery to soda_db)
```

### Phase 2: Embedded (Future)
Embed Power BI report in a tab/panel within the workload iframe if seamless UX required.

---

## Summary: Before vs After

### ER Model Comparison

**BEFORE (Legacy):**
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ dq_suites   │────<│ suites_testcases │>────│ dq_testcases│
└─────────────┘     └──────────────────┘     └──────┬──────┘
                           N:M                       │
                                                     │ 1:1
                    ┌─────────────┐                  │
                    │ dq_contracts│──────────────────┘
                    └──────┬──────┘
                           │
                           │ 1:N
                    ┌──────┴──────┐
                    │  dq_checks  │
                    └──────┬──────┘
                           │
        ┌──────────┬───────┴────────┬──────────┬──────────┐
        │          │                │          │          │
   freshness    schema         reference    scalar     custom
```
- 4 user concepts: Suite, Contract, Testcase, Check
- N:M relationship via suites_testcases
- Contract duplicates testcase scope
- Contract has redundant schema fields

**AFTER (Simplified):**
```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│ dq_suites   │────────<│ suites_testcases │>────────│dq_testcases │
│             │    N:M  └──────────────────┘    N:M  │             │
│ Business    │         (preserved for reuse)       │ Table scope │
│ metadata    │                                      │ + checks    │
└─────────────┘                                      └──────┬──────┘
                                                            │ 1:N
                                                     ┌──────┴──────┐
                                                     │  dq_checks  │
                                                     └──────┬──────┘
                                                            │
                    ┌──────────┬────────┬─────────┬─────────┤
                    │          │        │         │         │
               freshness   schema  reference  scalar    custom
```
- 3 user concepts: Suite (optional), Testcase (hidden), Check
- **N:M PRESERVED** for testcase reuse across suites
- Contract ELIMINATED (was redundant 1:1)
- No duplicate fields

### Metrics

| Metric | Legacy | Simplified | Change |
|--------|--------|------------|--------|
| **Tables** | 11 | 10 | -9% |
| **Stored Procedures** | 31 | 20 | -35% |
| **User Concepts** | 4 | 3 | -25% |
| **Forms/Entry Points** | 6 | 2 | -67% |
| **Relationship Complexity** | N:M + 1:1 | N:M only | Cleaner |

### What Was Simplified

| Before | After | Benefit |
|--------|-------|---------|
| `dq_contracts` table | ELIMINATED | Merged into testcase |
| Contract schema fields | ELIMINATED | Were duplicates of dq_checks_schema |
| 6 contract SPs | ELIMINATED | Logic moved to frontend |
| Separate Suite + Contract forms | 1 unified wizard | Same components, 2 entry points |
| Suite always required | Suite optional | Quick Check for simple scenarios |

### What's PRESERVED

| Component | Rationale |
|-----------|-----------|
| `suites_testcases` N:M table | Testcase reuse across multiple suites |
| All 22 check types with specialized SPs | Core functionality |
| Category and Data Domain metadata | Critical business context |
| Cascading dropdowns | UX for table selection |
| Wizard UX | Multi-table suite creation |
| Check enable/disable toggle | Operational control |
| Execution order | Pipeline sequencing |
| "Add Another Table" loop | Multi-table workflow |

### Two Entry Points (Same Wizard)

| Entry | What's Skipped | Result |
|-------|----------------|--------|
| **Create Suite** | Nothing | Testcase linked via suites_testcases |
| **Quick Check** | Step 1 (Suite Metadata) | Testcase not linked (orphan) |
