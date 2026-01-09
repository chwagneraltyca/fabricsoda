# Unified Testcase Wizard Specification

**Created:** 2026-01-08
**Status:** Draft
**Purpose:** Merge Legacy Contract + Checks into unified Testcase wizard without feature reduction

---

## Overview

The Legacy Flask application has a 4-step "Contract Wizard" that configures data quality checks for a single table. This specification defines how to implement the same functionality in the Fabric workload as a unified "Testcase" wizard.

### Entity Mapping

| Legacy Entity | New Entity | Description |
|---------------|------------|-------------|
| Contract | **Testcase** | Merged - one table with embedded checks |
| Check | **Check** (embedded) | Preserved - all 14 types |
| Suite | **Suite** | Unchanged - N:M grouping of testcases |

### Key Principles

1. **No feature reduction** - All 14 check types from Legacy must be supported
2. **Polymorphic config** - Each check has a `metric` + type-specific `config: {}`
3. **Table vs Column** - `column_name: null` for table-level checks
4. **4-step wizard** - Same UX flow as Legacy Contract wizard

---

## Wizard Steps

### Step 1: Scope (Table Selection)

**Purpose:** Select which table to apply checks to.

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `testcase_name` | text | Yes | Display name |
| `source_id` | dropdown | Yes | FK to Source |
| `schema_name` | text | Yes | Database schema |
| `table_name` | text | Yes | Table name |
| `description` | textarea | No | Description |
| `owner` | text | No | Owner email |
| `tags` | tag input | No | Tags array |

**UX Notes:**
- Source dropdown populates from `useSources()` hook
- Schema/table could be autocomplete from source metadata (future)
- Validate table exists before proceeding (optional)

---

### Step 2: Table-Level Checks

**Purpose:** Configure checks that apply to the whole table.

**5 Table-Level Check Types:**

#### 2.1 Row Count (`row_count`)

Validates the number of rows in the table.

```json
{
  "check_id": "uuid",
  "check_name": "Row count check",
  "column_name": null,
  "metric": "row_count",
  "config": {},
  "fail_comparison": "<",
  "fail_threshold": 1000,
  "warn_comparison": "<",
  "warn_threshold": 5000
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - row_count >= 1000
```

**Form Fields:**
- Threshold comparison (>, >=, <, <=, =, !=, between)
- Fail threshold value
- Warn threshold value (optional)

---

#### 2.2 Freshness (`freshness`)

Validates data is recent based on a timestamp column.

```json
{
  "check_id": "uuid",
  "check_name": "Data freshness",
  "column_name": null,
  "metric": "freshness",
  "config": {
    "freshness_column": "updated_at",
    "threshold_value": 24,
    "threshold_unit": "hours"
  },
  "fail_comparison": ">",
  "fail_threshold": 48,
  "warn_comparison": ">",
  "warn_threshold": 24
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - freshness(updated_at) < 24h
```

**Form Fields:**
- Freshness column (dropdown of date/timestamp columns)
- Threshold value (number)
- Threshold unit (hours, days, minutes)
- Fail threshold
- Warn threshold

---

#### 2.3 Schema Validation (`schema`)

Validates table structure (columns, types, presence).

```json
{
  "check_id": "uuid",
  "check_name": "Schema validation",
  "column_name": null,
  "metric": "schema",
  "config": {
    "required_columns": ["id", "created_at", "status"],
    "forbidden_columns": ["password", "ssn"],
    "column_types": {
      "id": "int",
      "created_at": "datetime",
      "status": "varchar"
    },
    "fail_on_column_add": false,
    "fail_on_column_delete": true,
    "fail_on_type_change": true
  }
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - schema:
      fail:
        when required column missing: [id, created_at, status]
        when forbidden column present: [password, ssn]
        when wrong column type:
          id: int
```

**Form Fields:**
- Required columns (multi-select or tag input)
- Forbidden columns (multi-select or tag input)
- Column types (key-value editor)
- Fail on: column add, column delete, type change (checkboxes)

---

#### 2.4 Custom SQL / User-Defined (`custom_sql`)

Executes arbitrary SQL that must return 0 rows or a truthy value.

```json
{
  "check_id": "uuid",
  "check_name": "No orphaned orders",
  "column_name": null,
  "metric": "custom_sql",
  "config": {
    "custom_sql_query": "SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE c.id IS NULL",
    "expected_value": 0,
    "comparison": "="
  },
  "fail_comparison": "!=",
  "fail_threshold": 0
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - custom_sql_query:
      query: |
        SELECT COUNT(*) FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE c.id IS NULL
      must_be: 0
```

**Form Fields:**
- SQL query (code editor / textarea)
- Expected value
- Comparison operator

---

#### 2.5 Scalar Comparison (`scalar_comparison`)

Compares two scalar values from different queries.

```json
{
  "check_id": "uuid",
  "check_name": "Source vs Target count",
  "column_name": null,
  "metric": "scalar_comparison",
  "config": {
    "query_a": "SELECT COUNT(*) FROM source_orders",
    "query_b": "SELECT COUNT(*) FROM target_orders",
    "comparison_operator": "=",
    "tolerance_percent": 0.01
  }
}
```

**Form Fields:**
- Query A (code editor)
- Query B (code editor)
- Comparison (=, >, <, >=, <=)
- Tolerance percent (optional)

---

### Step 3: Column-Level Checks

**Purpose:** Configure checks that apply to specific columns.

**9 Column-Level Check Types:**

#### 3.1 Missing Count (`missing_count`)

Count of NULL or empty values.

```json
{
  "check_id": "uuid",
  "check_name": "Missing email check",
  "column_name": "email",
  "metric": "missing_count",
  "config": {
    "missing_values": [null, "", "N/A", "NULL"]
  },
  "fail_comparison": ">",
  "fail_threshold": 0
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - missing_count(email) = 0:
      missing values: [null, "", "N/A"]
```

**Form Fields:**
- Column (dropdown)
- Additional missing values (tag input, optional)
- Threshold comparison and value

---

#### 3.2 Duplicate Count (`duplicate_count`)

Count of duplicate values in column(s).

```json
{
  "check_id": "uuid",
  "check_name": "Duplicate order ID",
  "column_name": "order_id",
  "metric": "duplicate_count",
  "config": {
    "columns": ["order_id"]
  },
  "fail_comparison": ">",
  "fail_threshold": 0
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - duplicate_count(order_id) = 0
```

**Form Fields:**
- Column(s) (multi-select for composite keys)
- Threshold

---

#### 3.3 Invalid Count (`invalid_count`)

Count of values that don't match validity rules.

```json
{
  "check_id": "uuid",
  "check_name": "Invalid email format",
  "column_name": "email",
  "metric": "invalid_count",
  "config": {
    "valid_format": "email",
    "valid_regex": null,
    "valid_values": null
  },
  "fail_comparison": ">",
  "fail_threshold": 0
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - invalid_count(email) = 0:
      valid format: email
```

**Valid Formats Supported:**
- `email`
- `phone_number`
- `uuid`
- `ip_address`
- `url`
- `date_*` patterns
- Custom regex

**Form Fields:**
- Column (dropdown)
- Validity type: format, regex, or value list
- Format dropdown / regex input / values list
- Threshold

---

#### 3.4 Minimum (`min`)

Minimum value in numeric column.

```json
{
  "check_id": "uuid",
  "check_name": "Min order amount",
  "column_name": "amount",
  "metric": "min",
  "config": {},
  "fail_comparison": "<",
  "fail_threshold": 0
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - min(amount) >= 0
```

**Form Fields:**
- Column (dropdown, numeric only)
- Threshold comparison and value

---

#### 3.5 Maximum (`max`)

Maximum value in numeric column.

```json
{
  "check_id": "uuid",
  "check_name": "Max order amount",
  "column_name": "amount",
  "metric": "max",
  "config": {},
  "fail_comparison": ">",
  "fail_threshold": 1000000
}
```

**Form Fields:**
- Column (dropdown, numeric only)
- Threshold comparison and value

---

#### 3.6 Average (`avg`)

Average value in numeric column.

```json
{
  "check_id": "uuid",
  "check_name": "Average order value",
  "column_name": "amount",
  "metric": "avg",
  "config": {},
  "fail_comparison": "<",
  "fail_threshold": 50,
  "warn_comparison": "<",
  "warn_threshold": 100
}
```

**Form Fields:**
- Column (dropdown, numeric only)
- Fail threshold
- Warn threshold (optional)

---

#### 3.7 Sum (`sum`)

Sum of values in numeric column.

```json
{
  "check_id": "uuid",
  "check_name": "Daily revenue sum",
  "column_name": "revenue",
  "metric": "sum",
  "config": {
    "filter_condition": "date = CURRENT_DATE"
  },
  "fail_comparison": "<",
  "fail_threshold": 10000
}
```

**Form Fields:**
- Column (dropdown, numeric only)
- Filter condition (optional SQL WHERE clause)
- Threshold

---

#### 3.8 Average Length (`avg_length`)

Average string length.

```json
{
  "check_id": "uuid",
  "check_name": "Description length",
  "column_name": "description",
  "metric": "avg_length",
  "config": {},
  "fail_comparison": "<",
  "fail_threshold": 10
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - avg_length(description) >= 10
```

**Form Fields:**
- Column (dropdown, string only)
- Threshold

---

#### 3.9 Foreign Key / Reference (`reference`)

Validates referential integrity to another table.

```json
{
  "check_id": "uuid",
  "check_name": "Customer FK valid",
  "column_name": "customer_id",
  "metric": "reference",
  "config": {
    "reference_source_id": "src-uuid",
    "reference_schema": "dbo",
    "reference_table": "customers",
    "reference_column": "id"
  },
  "fail_comparison": ">",
  "fail_threshold": 0
}
```

**Soda YAML:**
```yaml
checks for {table}:
  - reference(customer_id) = 100%:
      reference_dataset: customers
      reference_column: id
```

**Form Fields:**
- Column (dropdown)
- Reference source (dropdown, could be same or different)
- Reference schema
- Reference table
- Reference column
- Threshold (% or count)

---

### Step 4: Review & Generate YAML

**Purpose:** Review all checks, preview Soda YAML, save testcase.

**Display:**
1. Summary card showing testcase metadata
2. Table of all configured checks (table-level + column-level)
3. Generated Soda YAML preview (read-only code view)
4. Validation warnings (if any)

**Actions:**
- Edit check (go back to step 2 or 3)
- Delete check
- Save testcase
- Cancel

---

## Common Check Fields

All checks share these base fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `check_id` | uuid | Auto | Unique identifier |
| `check_name` | text | Yes | Display name |
| `column_name` | text | Table=null | Column for column-level checks |
| `metric` | enum | Yes | Check type identifier |
| `config` | object | Yes | Type-specific configuration |
| `fail_comparison` | enum | No | <, <=, =, >=, >, !=, between |
| `fail_threshold` | number | No | Fail threshold value |
| `warn_comparison` | enum | No | Warn comparison |
| `warn_threshold` | number | No | Warn threshold value |
| `filter_condition` | text | No | SQL WHERE filter |
| `dimension` | enum | No | DQ dimension |
| `severity` | enum | No | critical, high, medium, low |
| `is_enabled` | boolean | Yes | Enable/disable check |

### Data Quality Dimensions

| Dimension | Description |
|-----------|-------------|
| `completeness` | No missing data |
| `accuracy` | Data is correct |
| `consistency` | Data agrees across sources |
| `timeliness` | Data is fresh |
| `validity` | Data matches rules |
| `uniqueness` | No duplicates |

### Severity Levels

| Severity | Description |
|----------|-------------|
| `critical` | Must pass, blocks pipeline |
| `high` | Should pass, alerts on-call |
| `medium` | Should pass, alerts team |
| `low` | Nice to pass, logged only |

---

## Metric to Soda Mapping

| Metric | Soda Check | Level |
|--------|------------|-------|
| `row_count` | `row_count` | Table |
| `freshness` | `freshness(column)` | Table |
| `schema` | `schema:` | Table |
| `custom_sql` | `custom_sql_query:` | Table |
| `scalar_comparison` | User-defined | Table |
| `missing_count` | `missing_count(column)` | Column |
| `duplicate_count` | `duplicate_count(column)` | Column |
| `invalid_count` | `invalid_count(column)` | Column |
| `min` | `min(column)` | Column |
| `max` | `max(column)` | Column |
| `avg` | `avg(column)` | Column |
| `sum` | `sum(column)` | Column |
| `avg_length` | `avg_length(column)` | Column |
| `reference` | `reference(column)` | Column |

---

## Fabric/Soda Feature Support Matrix

| Check Type | Soda Core | Fabric DWH | Notes |
|------------|-----------|------------|-------|
| `row_count` | Yes | Yes | Standard |
| `freshness` | Yes | Yes | Requires timestamp column |
| `schema` | Yes | Yes | Needs historical comparison |
| `custom_sql` | Yes | Yes | Full T-SQL support |
| `scalar_comparison` | Yes | Yes | Via user-defined |
| `missing_count` | Yes | Yes | Standard |
| `duplicate_count` | Yes | Yes | Standard |
| `invalid_count` | Yes | Yes | All formats from Legacy |
| `min` | Yes | Yes | Numeric types |
| `max` | Yes | Yes | Numeric types |
| `avg` | Yes | Yes | Numeric types |
| `sum` | Yes | Yes | Numeric types |
| `avg_length` | Yes | Yes | String types |
| `reference` | Yes | Yes | Cross-table |

### Format Validation Support

All Legacy format validations are supported via `filter_condition`:

| Format | Syntax | Example |
|--------|--------|---------|
| Email | `valid format: email` | Standard email pattern |
| UUID | `valid format: uuid` | UUID v4 format |
| Phone | `valid format: phone_number` | Phone number pattern |
| IP Address | `valid format: ip_address` | IPv4/IPv6 |
| Date | `valid format: date` | ISO date format |
| Credit Card | `valid format: credit_card` | Credit card number |
| Whitelist | `valid values: [...]` | `valid values: [active, pending]` |
| Regex | `valid regex: pattern` | `valid regex: ^[A-Z]{2}[0-9]{4}$` |

---

## Implementation Tasks

### Dual Workflow Approach

The Legacy Flask solution had **two separate workflows** that must both be supported:

| Entry Point | Legacy | Fabric | Use Case |
|-------------|--------|--------|----------|
| **Quick Check** | `/checks/add` | QuickCheckPanel | Single check, immediate save (~30s) |
| **Table Checks** | Contract Wizard | TestcaseWizard | Multi-check batch for one table |

**UX Entry Points:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Testcases                              [+ New ▾]                │
│                                        ├─ Quick Check           │
│                                        └─ Table Checks          │
├─────────────────────────────────────────────────────────────────┤
```

---

### Phase 1: Types & Schemas (Already Done)

Types are already correct in `types/check.types.ts`:
- `column_name?: string` - Optional for table-level checks
- All 14 metrics defined
- Polymorphic `CheckConfig` union type

---

### Phase 2: Shared Form Architecture

**Key Decision:** Single `CheckForm.tsx` used in BOTH Quick Check and Wizard.

```typescript
// CheckForm.tsx - ONE form, used everywhere
interface CheckFormProps {
  selectedMetric: MetricType;
  check: Check | null;           // null = new, object = edit
  onSave: (check: Check) => void;
  onCancel?: () => void;
}
```

The form dynamically renders fields based on `selectedMetric`:
- Column field (if `hasColumn: true`)
- Threshold fields (fail/warn)
- Metric-specific config sections

---

### Phase 3: UX Components

| Task | File | Description |
|------|------|-------------|
| 3.1 | `MetricSidebar.tsx` | Categorized metric selector (left sidebar) |
| 3.2 | `QuickCheckPanel.tsx` | Source/Schema/Table + CheckForm → 1 check |
| 3.3 | `TestcaseWizard.tsx` | 3-step wizard container |
| 3.4 | `WizardContext.tsx` | State management for wizard data |
| 3.5 | `steps/ScopeStep.tsx` | Step 1: Testcase metadata |
| 3.6 | `steps/ChecksStep.tsx` | Step 2: MetricSidebar + CheckForm (multi) |
| 3.7 | `steps/ReviewStep.tsx` | Step 3: Summary + YAML preview |

**MetricSidebar Categories:**
```
▸ Completeness    (missing_count)
▸ Validity        (invalid_count)
▸ Uniqueness      (duplicate_count)
▸ Statistics      (min, max, avg, sum, avg_length)
▸ Table Level     (row_count, freshness, schema, custom_sql, scalar_comparison)
▸ Referential     (reference)
```

---

### Phase 4: Config Components

**Location:** `forms/configs/`

| Task | File | Used By Metric |
|------|------|----------------|
| 4.1 | `ThresholdFields.tsx` | All metrics |
| 4.2 | `FreshnessConfig.tsx` | freshness |
| 4.3 | `SchemaConfig.tsx` | schema |
| 4.4 | `SqlEditor.tsx` | custom_sql |
| 4.5 | `ScalarConfig.tsx` | scalar_comparison |
| 4.6 | `MissingValuesConfig.tsx` | missing_count |
| 4.7 | `ValidityRuleSelector.tsx` | invalid_count |
| 4.8 | `ReferenceConfig.tsx` | reference |

**Note:** Numeric metrics (min, max, avg, sum, avg_length) use only column + ThresholdFields (no separate config).

---

### Phase 5: YAML Generation & Integration

| Task | File | Description |
|------|------|-------------|
| 5.1 | `sodaYamlGenerator.ts` | Convert checks[] to Soda YAML |
| 5.2 | `TestcasesView.tsx` | Add split button entry points |

---

### Phase 6: E2E Testing

| Task | Description |
|------|-------------|
| 6.1 | Quick Check: Create single check, verify JSON |
| 6.2 | Table Checks: Create testcase with all 14 check types |
| 6.3 | Verify YAML generation matches Legacy output |
| 6.4 | Run notebook, confirm results |

---

## File Summary

**Folder Structure:**
```
components/Testcases/
├── index.ts
├── TestcasesView.tsx          # Modified: Add split button
├── TestcaseList.tsx           # Existing
├── TestcaseForm.tsx           # Existing
├── MetricSidebar.tsx          # NEW: Categorized metric selector
├── QuickCheckPanel.tsx        # NEW: Source/Schema/Table + CheckForm
├── TestcaseWizard.tsx         # NEW: 3-step wizard container
├── WizardContext.tsx          # NEW: Wizard state management
├── steps/
│   ├── ScopeStep.tsx          # NEW
│   ├── ChecksStep.tsx         # NEW
│   └── ReviewStep.tsx         # NEW
└── forms/
    ├── CheckForm.tsx          # NEW: Single unified form
    ├── ThresholdFields.tsx    # NEW
    └── configs/
        ├── FreshnessConfig.tsx
        ├── SchemaConfig.tsx
        ├── SqlEditor.tsx
        ├── ScalarConfig.tsx
        ├── MissingValuesConfig.tsx
        ├── ValidityRuleSelector.tsx
        └── ReferenceConfig.tsx

services/
├── sodaYamlGenerator.ts       # NEW
```

**New Files (15):**
- `MetricSidebar.tsx`
- `QuickCheckPanel.tsx`
- `TestcaseWizard.tsx`
- `WizardContext.tsx`
- `steps/*.tsx` (3 files)
- `forms/CheckForm.tsx`
- `forms/ThresholdFields.tsx`
- `forms/configs/*.tsx` (7 files)
- `services/sodaYamlGenerator.ts`

**Modified Files (1):**
- `TestcasesView.tsx` - Add split button

---

## References

- [Soda Core SodaCL Metrics](https://docs.soda.io/sodacl-reference/metrics-and-checks)
- [Soda Schema Checks](https://docs.soda.io/sodacl-reference/schema)
- [Soda User-Defined Checks](https://docs.soda.io/soda-cl/user-defined.html)
- Legacy: `Legacy/flask_app/templates/contracts/add_contract_wizard.html`
- Legacy: `Legacy/database/SCHEMA.md`
