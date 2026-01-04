# DQCheckerItem Specification

## Overview

The DQCheckerItem is a Microsoft Fabric workload item for managing data quality checks using Soda. It provides a UI for defining, organizing, and executing DQ checks against Fabric data sources.

## Item Definition

```typescript
interface DQCheckerItemDefinition {
  // Connection settings
  graphqlEndpoint?: string;
  useSampleData: boolean;

  // Active view state
  activeTab: 'sources' | 'checks' | 'testcases' | 'suites' | 'contracts' | 'scans' | 'results';

  // Selected filters
  selectedSourceId?: number;
  selectedSchemaName?: string;
  selectedTableName?: string;

  // UI state
  sidebarCollapsed: boolean;
}
```

## Views

### 1. Data Sources View

**Purpose:** Manage data source registry

**Components:**
- `DataSourcesList` - DataGrid with source_id, source_name, description, is_active
- `DataSourceForm` - Add/Edit dialog

**CRUD Operations (via Stored Procedures):**
| Action | GraphQL Mutation | SP |
|--------|------------------|-----|
| List | `query { dq_sources { items { ... } } }` | - |
| Create | `mutation { executesp_create_data_source(...) }` | sp_create_data_source |
| Update | `mutation { executesp_update_data_source(...) }` | sp_update_data_source |
| Delete | `mutation { executesp_delete_data_source(...) }` | sp_delete_data_source |

**Note:** All mutations use SP-backed `executesp_*` pattern. No direct table mutations.

### 2. Checks View

**Purpose:** Define and manage DQ checks

**Components:**
- `CheckTemplatesSidebar` - 22 template options organized by DQ dimension
- `CheckForm` - Dynamic form based on selected template
- `CascadingDropdowns` - Source → Schema → Table → Column
- `ThresholdSection` - Fail/Warn threshold configuration
- `ChecksList` - DataGrid with filters

**Template Categories:**
| Category | Templates | Requires Column |
|----------|-----------|-----------------|
| Completeness | row_count, missing_count | No, Yes |
| Accuracy | numeric_range, aggregation_metric | Yes, Yes |
| Uniqueness | duplicate_check | Yes |
| Validity | invalid_values, string_length | Yes, Yes |
| Advanced | foreign_key, custom_sql, scalar_comparison, freshness, schema | Varies |

**Conditional Form Sections:**

| Template | Additional Section |
|----------|-------------------|
| freshness | FreshnessSection (datetime_column, threshold_value, threshold_unit) |
| schema | SchemaValidationSection (required_columns JSON, forbidden_columns JSON, 8 checkboxes) |
| foreign_key | ReferenceSection (reference_table, reference_column) |
| scalar_comparison | ScalarSection (query_a, query_b, operator) |
| custom_sql | CustomSqlSection (SQL textarea) |

**SP Routing:**
```typescript
function getCreateSP(metric: string): string {
  const specialized: Record<string, string> = {
    freshness: 'sp_create_freshness_check',
    schema: 'sp_create_schema_check',
    scalar_comparison: 'sp_create_scalar_comparison_check',
    reference: 'sp_create_reference_check',
    foreign_key: 'sp_create_reference_check',
    custom_sql: 'sp_create_custom_sql_check',
    user_defined: 'sp_create_custom_sql_check',
  };
  return specialized[metric] || 'sp_create_check';
}
```

### 3. Testcases View

**Purpose:** Group checks into testcases for execution

**Components:**
- `TestcasesList` - DataGrid with testcase_id, testcase_name, source, check_count
- `TestcaseForm` - Add/Edit with check selection

**Atomic Pattern:** Testcase MUST have at least one check (enforced by API)

### 4. Suites View

**Purpose:** Group testcases into suites for batch execution

**Components:**
- `SuitesList` - DataGrid with filters (category, status)
- `SuiteForm` - Add/Edit with testcase multi-select
- `SuiteExecuteButton` - Trigger suite execution

### 5. Contracts View

**Purpose:** Define table-level data contracts with inline checks

**Components:**
- `ContractWizard` - 4-step wizard:
  1. Select Table (cascading dropdowns)
  2. Define Schema (required_columns, forbidden_columns JSON)
  3. Add Column Checks (inline check forms)
  4. Review & Create

### 6. Scans View

**Purpose:** Execute checks and view progress

**Components:**
- `ScanPanel` - Execute all enabled checks
- `SingleCheckRunner` - Execute individual check
- `ScanProgress` - Progress indicator during execution
- `ScanSummary` - Pass/Fail/Warn counts

### 7. Results View

**Purpose:** View historical scan results

**Components:**
- `ResultsGrid` - DataGrid with filters (date, outcome, check)
- `ResultDetail` - Detailed result view
- `TrendChart` - Historical trends (optional)

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DQCheckerItemEditor                          │
│  - Loads item definition                                         │
│  - Manages GraphQL connection                                    │
│  - Renders active view                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────────────────────┐
    │                      │                                       │
    ▼                      ▼                                       ▼
┌─────────────┐    ┌─────────────────┐    ┌────────────────────────┐
│DataSources  │    │ ChecksPanel     │    │ Other Views...         │
│Panel        │    │                 │    │                        │
│             │    │ ┌─────────────┐ │    │                        │
│ ┌─────────┐ │    │ │TemplatesSB │ │    │                        │
│ │ DataGrid│ │    │ └─────────────┘ │    │                        │
│ └─────────┘ │    │ ┌─────────────┐ │    │                        │
│ ┌─────────┐ │    │ │ CheckForm   │ │    │                        │
│ │ Dialog  │ │    │ │  - Cascade  │ │    │                        │
│ └─────────┘ │    │ │  - Sections │ │    │                        │
└─────────────┘    │ └─────────────┘ │    └────────────────────────┘
                   └─────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ DQCheckerService.ts    │
              │ - GraphQL client       │
              │ - SP routing logic     │
              │ - Retry with backoff   │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Fabric GraphQL API     │
              │ - Queries: tables/views│
              │ - Mutations: executesp_│
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Fabric SQL Database    │
              │ - Tables (dbo.dq_*)    │
              │ - Views (vw_*)         │
              │ - SPs (sp_*)           │
              └────────────────────────┘
```

## GraphQL API Pattern

**Reads:** Direct table/view queries
```graphql
query {
  dq_sources { items { source_id, source_name } }
  vw_checks_complete(filter: { source_id: { eq: 1 } }) { items { ... } }
}
```

**Writes:** SP-backed mutations (business logic in SP)
```graphql
mutation {
  executesp_create_check(
    testcase_id: 1,
    source_id: 1,
    schema_name: "dbo",
    table_name: "orders",
    check_name: "Row count",
    metric: "row_count"
  ) { check_id }
}
```

**Why SP-backed mutations:**
- Validation in SP (not client)
- Extension table handling (freshness, schema, etc.)
- Same pattern as legacy Flask app
- Easy migration path

## Cascading Dropdowns Implementation

```typescript
// useCascadingDropdowns.ts

function useCascadingDropdowns(sourceId: number | undefined) {
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);

  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');

  // Load schemas when source changes
  useEffect(() => {
    if (sourceId) {
      loadSchemas(sourceId).then(setSchemas);
      setSelectedSchema('');
      setTables([]);
      setSelectedTable('');
      setColumns([]);
    }
  }, [sourceId]);

  // Load tables when schema changes
  useEffect(() => {
    if (sourceId && selectedSchema) {
      loadTables(sourceId, selectedSchema).then(setTables);
      setSelectedTable('');
      setColumns([]);
    }
  }, [sourceId, selectedSchema]);

  // Load columns when table changes
  useEffect(() => {
    if (sourceId && selectedTable) {
      loadColumns(sourceId, selectedTable).then(setColumns);
    }
  }, [sourceId, selectedTable]);

  return {
    schemas, tables, columns,
    selectedSchema, setSelectedSchema,
    selectedTable, setSelectedTable,
  };
}
```

## Form Validation

Using Zod for schema validation:

```typescript
const checkFormSchema = z.object({
  source_id: z.number().positive('Data source is required'),
  schema_name: z.string().min(1, 'Schema is required'),
  table_name: z.string().min(1, 'Table is required'),
  check_name: z.string().min(1, 'Check name is required'),
  metric: z.string().min(1, 'Metric is required'),

  // Conditional: column required for column-level metrics
  column_name: z.string().optional(),

  // Threshold validation
  fail_comparison: z.string().optional(),
  fail_threshold: z.number().optional(),
  warn_comparison: z.string().optional(),
  warn_threshold: z.number().optional(),

  // At least one threshold required
}).refine(data =>
  data.fail_threshold !== undefined || data.warn_threshold !== undefined,
  { message: 'At least one threshold (fail or warn) is required' }
);
```

## Ribbon Actions

| Button | Icon | Action | Scope |
|--------|------|--------|-------|
| Refresh | ArrowClockwise | Reload current view | All views |
| Add | Add | Open add form/dialog | Sources, Checks, Testcases, Suites, Contracts |
| Run Scan | Play | Execute enabled checks | Scans view |
| Export YAML | DocumentArrowDown | Export selected checks as YAML | Checks view |

## Settings Panel

Tabs:
1. **Connection** - GraphQL endpoint, demo mode toggle
2. **Defaults** - Default owner, severity, dimension
3. **Display** - Items per page, date format

## Files Structure

```
src/Workload/app/items/DQCheckerItem/
├── DQCheckerItemDefinition.ts      # State interface
├── DQCheckerItemEditor.tsx         # Main editor lifecycle
├── DQCheckerItemEmptyView.tsx      # First-run experience
├── DQCheckerItemDefaultView.tsx    # Main view router
├── DQCheckerItemRibbon.tsx         # Toolbar actions
├── DQCheckerSettingsPanel.tsx      # Settings menu
├── DQCheckerService.ts             # GraphQL client + SP routing
├── DQCheckerItem.scss              # Styles
├── components/
│   ├── DataSourcesPanel.tsx        # Sources CRUD
│   ├── ChecksPanel.tsx             # Checks with templates
│   ├── CheckTemplatesSidebar.tsx   # 22 template options
│   ├── CheckForm.tsx               # Dynamic check form
│   ├── ThresholdSection.tsx        # Fail/Warn config
│   ├── FreshnessSection.tsx        # Freshness-specific fields
│   ├── SchemaValidationSection.tsx # Schema check fields
│   ├── ReferenceSection.tsx        # FK fields
│   ├── ScalarSection.tsx           # Scalar comparison fields
│   ├── CustomSqlSection.tsx        # Custom SQL textarea
│   ├── TestcasesPanel.tsx          # Testcase management
│   ├── SuitesPanel.tsx             # Suite management
│   ├── ContractWizard.tsx          # 4-step contract wizard
│   ├── ScansPanel.tsx              # Scan execution
│   └── ResultsPanel.tsx            # Results display
├── hooks/
│   ├── useCascadingDropdowns.ts    # Source→Schema→Table→Column
│   ├── useCheckForm.ts             # Form state + validation
│   └── useCheckTemplates.ts        # Template definitions
└── types/
    ├── Check.ts                    # Check interfaces
    ├── DataSource.ts               # Source interfaces
    └── Templates.ts                # Template definitions
```

## Migration Notes

### From Legacy to Fabric

| Legacy | Fabric |
|--------|--------|
| Alpine.js `x-show` | React conditional rendering |
| Alpine.js `x-model` | React state + onChange |
| Jinja `{{ url_for() }}` | React Router / Fabric navigation |
| Flask `@validate_json` | Zod schema validation |
| pyodbc connection | GraphQL API |
| Flask session | Fabric item definition |

### SP Parameter Filtering

Legacy uses parameter filtering to prevent "too many arguments" errors:

```python
# Legacy: check_routing_config.py
SP_CREATE_CHECK_PARAMS = {'source_id', 'schema_name', 'table_name', 'metric', ...}

# Filter params before calling SP
filtered = {k: v for k, v in data.items() if k in SP_CREATE_CHECK_PARAMS}
```

Implement same pattern in `DQCheckerService.ts`:

```typescript
const SP_CREATE_CHECK_PARAMS = new Set([
  'source_id', 'schema_name', 'table_name', 'metric', 'column_name',
  'check_name', 'fail_comparison', 'fail_threshold', 'warn_comparison', 'warn_threshold',
  'filter_condition', 'severity', 'dimension', 'owner', 'tags', 'is_enabled', 'testcase_id'
]);

function filterParams(data: Record<string, any>, allowedParams: Set<string>) {
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => allowedParams.has(k))
  );
}
```
