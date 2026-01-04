# DQ Checker POC Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the POC that validates the DQ Checker migration from Flask to Microsoft Fabric SDK.

## POC Scope

**Forms:**
1. Data Sources (simple CRUD)
2. DQ Checks (22 templates, cascading dropdowns, conditional sections)

**Stack:**
- Frontend: React + FluentUI v9 in Fabric Workload
- API: Fabric GraphQL
- Database: Fabric SQL Database

## Prerequisites

- Access to Microsoft Fabric workspace
- DevGateway installed (`tools/DevGateway/`)
- Node.js 18+
- Azure CLI (for SPN authentication)

---

## Step 1: Database Setup

### 1.1 Create Fabric SQL Database

1. Go to Fabric Portal → Your Workspace
2. Create → SQL Database → Name: `dq_checker`

### 1.2 Deploy Schema

Connect to database and deploy the POC schema:

```powershell
# Deploy schema from file
sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
  --authentication-method ActiveDirectoryServicePrincipal `
  -U $env:AZURE_CLIENT_ID -P $env:AZURE_CLIENT_SECRET `
  -i setup/poc-schema-ddl.sql
```

Or run the DDL manually (uses `dbo` schema - Fabric SQL DB default):

```sql
-- Data Sources table
CREATE TABLE dbo.dq_sources (
    source_id INT IDENTITY(1,1) PRIMARY KEY,
    source_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Testcases table
CREATE TABLE dbo.dq_testcases (
    testcase_id INT IDENTITY(1,1) PRIMARY KEY,
    testcase_name NVARCHAR(255) NOT NULL,
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    owner NVARCHAR(100),
    tags NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Base checks table
CREATE TABLE dbo.dq_checks (
    check_id INT IDENTITY(1,1) PRIMARY KEY,
    testcase_id INT NOT NULL REFERENCES dbo.dq_testcases(testcase_id),
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    schema_name NVARCHAR(128) NOT NULL,
    table_name NVARCHAR(255) NOT NULL,
    column_name NVARCHAR(255),
    check_name NVARCHAR(255) NOT NULL,
    metric NVARCHAR(50) NOT NULL,
    fail_comparison NVARCHAR(10),
    fail_threshold DECIMAL(18,4),
    warn_comparison NVARCHAR(10),
    warn_threshold DECIMAL(18,4),
    filter_condition NVARCHAR(1000),
    dimension NVARCHAR(50) DEFAULT 'completeness',
    severity NVARCHAR(20) DEFAULT 'high',
    owner NVARCHAR(100),
    tags NVARCHAR(500),
    is_enabled BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Extension: Freshness checks
CREATE TABLE dbo.dq_checks_freshness (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    freshness_column NVARCHAR(255) NOT NULL,
    threshold_value INT NOT NULL,
    threshold_unit NVARCHAR(10) NOT NULL -- 'd', 'h', 'm'
);

-- Extension: Schema validation
CREATE TABLE dbo.dq_checks_schema (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    required_columns NVARCHAR(MAX), -- JSON array
    forbidden_columns NVARCHAR(MAX), -- JSON array
    column_types NVARCHAR(MAX), -- JSON object
    column_indexes NVARCHAR(MAX), -- JSON object
    warn_required_missing BIT DEFAULT 0,
    warn_forbidden_present BIT DEFAULT 0,
    warn_wrong_type BIT DEFAULT 0,
    warn_wrong_index BIT DEFAULT 0,
    fail_required_missing BIT DEFAULT 1,
    fail_forbidden_present BIT DEFAULT 1,
    fail_wrong_type BIT DEFAULT 0,
    fail_wrong_index BIT DEFAULT 0
);

-- Extension: Reference (FK) checks
CREATE TABLE dbo.dq_checks_reference (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    reference_table NVARCHAR(255) NOT NULL,
    reference_column NVARCHAR(255) NOT NULL,
    reference_sql_query NVARCHAR(MAX)
);

-- Extension: Scalar comparison
CREATE TABLE dbo.dq_checks_scalar (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    query_a NVARCHAR(MAX) NOT NULL,
    query_b NVARCHAR(MAX) NOT NULL,
    comparison_operator NVARCHAR(10) NOT NULL DEFAULT '==',
    tolerance_value DECIMAL(18,4),
    tolerance_type NVARCHAR(20) -- 'absolute' or 'percentage'
);

-- Extension: Custom SQL
CREATE TABLE dbo.dq_checks_custom (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    custom_sql_query NVARCHAR(MAX) NOT NULL
);

-- Cached Fabric metadata (for cascading dropdowns)
CREATE TABLE dbo.fabric_metadata (
    metadata_id INT IDENTITY(1,1) PRIMARY KEY,
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    schema_name NVARCHAR(128) NOT NULL,
    table_name NVARCHAR(255),
    column_name NVARCHAR(255),
    data_type NVARCHAR(128),
    refreshed_at DATETIME2 DEFAULT GETDATE()
);

-- Indexes
CREATE INDEX IX_dq_checks_source ON dbo.dq_checks(source_id);
CREATE INDEX IX_dq_checks_testcase ON dbo.dq_checks(testcase_id);
CREATE INDEX IX_fabric_metadata_source ON dbo.fabric_metadata(source_id);
GO
```

### 1.3 Create Views

```sql
-- Active data sources for dropdowns
CREATE VIEW dbo.vw_active_data_sources AS
SELECT source_id, source_name, description
FROM dbo.dq_sources
WHERE is_active = 1;
GO

-- Complete check view (joins all extensions)
CREATE VIEW dbo.vw_checks_complete AS
SELECT
    c.*,
    -- Freshness extension
    f.freshness_column,
    f.threshold_value AS freshness_threshold_value,
    f.threshold_unit AS freshness_threshold_unit,
    -- Schema extension
    s.required_columns,
    s.forbidden_columns,
    s.column_types,
    s.column_indexes,
    s.warn_required_missing,
    s.warn_forbidden_present,
    s.warn_wrong_type,
    s.warn_wrong_index,
    s.fail_required_missing,
    s.fail_forbidden_present,
    s.fail_wrong_type,
    s.fail_wrong_index,
    -- Reference extension
    r.reference_table,
    r.reference_column,
    r.reference_sql_query,
    -- Scalar extension
    sc.query_a,
    sc.query_b,
    sc.comparison_operator,
    sc.tolerance_value,
    sc.tolerance_type,
    -- Custom SQL extension
    cu.custom_sql_query
FROM dbo.dq_checks c
LEFT JOIN dbo.dq_checks_freshness f ON c.check_id = f.check_id
LEFT JOIN dbo.dq_checks_schema s ON c.check_id = s.check_id
LEFT JOIN dbo.dq_checks_reference r ON c.check_id = r.check_id
LEFT JOIN dbo.dq_checks_scalar sc ON c.check_id = sc.check_id
LEFT JOIN dbo.dq_checks_custom cu ON c.check_id = cu.check_id;
GO

-- Schemas for cascading dropdown
CREATE VIEW dbo.vw_fabric_schemas AS
SELECT DISTINCT source_id, schema_name
FROM dbo.fabric_metadata
WHERE table_name IS NULL OR table_name = '';
GO

-- Tables for cascading dropdown
CREATE VIEW dbo.vw_fabric_tables AS
SELECT DISTINCT source_id, schema_name, table_name
FROM dbo.fabric_metadata
WHERE table_name IS NOT NULL AND column_name IS NULL;
GO

-- Columns for cascading dropdown
CREATE VIEW dbo.vw_fabric_columns AS
SELECT source_id, schema_name, table_name, column_name, data_type
FROM dbo.fabric_metadata
WHERE column_name IS NOT NULL;
GO
```

### 1.4 Create Stored Procedures

See `Legacy/database/stored_procedures/` for complete SPs. Key ones for POC:

```sql
-- sp_create_data_source
CREATE PROCEDURE dbo.sp_create_data_source
    @source_name NVARCHAR(100),
    @description NVARCHAR(500) = NULL,
    @is_active BIT = 1
AS
BEGIN
    INSERT INTO dbo.dq_sources (source_name, description, is_active)
    VALUES (@source_name, @description, @is_active);

    SELECT * FROM dbo.dq_sources WHERE source_id = SCOPE_IDENTITY();
END;
GO

-- sp_create_check (standard)
CREATE PROCEDURE dbo.sp_create_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
    @check_name NVARCHAR(255),
    @metric NVARCHAR(50),
    @column_name NVARCHAR(255) = NULL,
    @fail_comparison NVARCHAR(10) = NULL,
    @fail_threshold DECIMAL(18,4) = NULL,
    @warn_comparison NVARCHAR(10) = NULL,
    @warn_threshold DECIMAL(18,4) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'completeness',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, @metric, @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SELECT * FROM dbo.dq_checks WHERE check_id = SCOPE_IDENTITY();
END;
GO

-- See Legacy/database/stored_procedures/ for all SPs:
-- sp_create_freshness_check, sp_create_schema_check, etc.
```

---

## Step 2: GraphQL API Setup

### 2.1 Create GraphQL API Item

1. Fabric Portal → Your Workspace
2. Create → GraphQL API → Name: `dq_checker_api`
3. Connect to `dq_checker` SQL Database

### 2.2 Configure Schema

1. Open GraphQL API item
2. Edit schema
3. Select tables/views to expose:
   - `dbo.dq_sources`
   - `dbo.dq_checks`
   - `dbo.dq_testcases`
   - `dbo.dq_checks_freshness`
   - `dbo.dq_checks_schema`
   - `dbo.dq_checks_reference`
   - `dbo.dq_checks_scalar`
   - `dbo.dq_checks_custom`
   - `dbo.vw_checks_complete`
   - `dbo.vw_active_data_sources`
   - `dbo.vw_fabric_schemas`
   - `dbo.vw_fabric_tables`
   - `dbo.vw_fabric_columns`

**Note:** POC uses `dbo` schema (Fabric SQL DB default), not `meta`.

### 2.3 Test Queries

```graphql
# List data sources
query {
  dq_sources {
    items {
      source_id
      source_name
      description
      is_active
    }
  }
}

# Get schemas for dropdown
query {
  vw_fabric_schemas(filter: { source_id: { eq: 1 } }) {
    items {
      schema_name
    }
  }
}
```

### 2.4 Expose Stored Procedures

1. In GraphQL API settings, enable stored procedures
2. Select SPs to expose:
   - `sp_create_data_source`
   - `sp_update_data_source`
   - `sp_delete_data_source`
   - `sp_create_check`
   - `sp_create_freshness_check`
   - `sp_create_schema_check`
   - `sp_create_reference_check`
   - `sp_create_scalar_comparison_check`
   - `sp_create_custom_sql_check`
   - `sp_toggle_check`
   - `sp_delete_check`

### 2.5 Test Mutations (SP-backed)

**Important:** Use `executesp_*` mutations, NOT direct table mutations.

```graphql
# Create data source via SP
mutation {
  executesp_create_data_source(
    source_name: "NYTaxi"
    description: "NYC Taxi sample data"
    is_active: true
  ) {
    source_id
    source_name
  }
}

# Create check via SP
mutation {
  executesp_create_check(
    testcase_id: 1
    source_id: 1
    schema_name: "dbo"
    table_name: "trips"
    check_name: "Trip row count"
    metric: "row_count"
    fail_comparison: ">"
    fail_threshold: 0
  ) {
    check_id
  }
}

# Create freshness check (extension table)
mutation {
  executesp_create_freshness_check(
    testcase_id: 1
    source_id: 1
    schema_name: "dbo"
    table_name: "trips"
    check_name: "Trip freshness"
    freshness_column: "pickup_datetime"
    threshold_value: 24
    threshold_unit: "h"
  ) {
    check_id
  }
}
```

### 2.6 Save Endpoint

Copy the GraphQL endpoint URL for frontend configuration.

---

## Step 3: Frontend Setup

### 3.1 Create Item Files

```bash
cd src/Workload/app/items
mkdir DQCheckerItem
```

Create the following files:

```
DQCheckerItem/
├── DQCheckerItemDefinition.ts
├── DQCheckerItemEditor.tsx
├── DQCheckerItemEmptyView.tsx
├── DQCheckerItemDefaultView.tsx
├── DQCheckerItemRibbon.tsx
├── DQCheckerService.ts
├── DQCheckerItem.scss
└── components/
    ├── DataSourcesPanel.tsx
    ├── ChecksPanel.tsx
    └── ...
```

### 3.2 Update Manifest

Add to `Manifest/Product.json`:

```json
{
  "items": [
    {
      "name": "DQCheckerItem",
      "displayName": "DQ Checker",
      "description": "Data Quality Checks with Soda",
      "icon": "checkmark-circle"
    }
  ]
}
```

### 3.3 Implement Data Sources Panel

```tsx
// components/DataSourcesPanel.tsx
import {
  DataGrid, DataGridHeader, DataGridRow, DataGridCell,
  Button, Dialog, Input, Textarea, Switch, Field
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Edit24Regular } from '@fluentui/react-icons';

export function DataSourcesPanel() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);

  // Load sources
  useEffect(() => {
    loadDataSources().then(setSources);
  }, []);

  // CRUD handlers...

  return (
    <div className="data-sources-panel">
      <div className="panel-header">
        <h2>Data Sources</h2>
        <Button icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>
          Add Source
        </Button>
      </div>

      <DataGrid items={sources}>
        {/* DataGrid columns... */}
      </DataGrid>

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        {/* Form fields... */}
      </Dialog>
    </div>
  );
}
```

### 3.4 Implement Checks Panel

See [docs/specs/items/DQCheckerItem.md](specs/items/DQCheckerItem.md) for full specification.

Key components:
- `CheckTemplatesSidebar` - 22 template options
- `CheckForm` - Dynamic form with conditional sections
- `useCascadingDropdowns` - Source → Schema → Table → Column hook

---

## Step 4: Integration Testing

### 4.1 Test Data Sources CRUD

| Test | Action | Expected |
|------|--------|----------|
| Create | Add new source | Row appears in grid, persisted to DB |
| Read | Refresh | Data loads correctly |
| Update | Edit source | Changes saved |
| Delete | Delete source | Row removed |

### 4.2 Test Check Creation

Test each template type:

| Template | Additional Fields | Extension Table |
|----------|-------------------|-----------------|
| row_count | - | - |
| missing_count | column | - |
| freshness | freshness_column, threshold | dq_checks_freshness |
| schema | required_columns JSON | dq_checks_schema |
| foreign_key | reference_table, reference_column | dq_checks_reference |
| scalar_comparison | query_a, query_b | dq_checks_scalar |
| custom_sql | custom_sql_query | dq_checks_custom |

### 4.3 Verify Database

```sql
-- Check base table
SELECT * FROM dbo.dq_checks WHERE check_id = @id;

-- Check extension table (for freshness)
SELECT * FROM dbo.dq_checks_freshness WHERE check_id = @id;

-- Check view returns all data
SELECT * FROM dbo.vw_checks_complete WHERE check_id = @id;
```

---

## Step 5: Success Criteria Validation

| Criteria | Status | Notes |
|----------|--------|-------|
| Data source CRUD works | ⬜ | |
| Standard checks persist | ⬜ | row_count, missing, etc. |
| Freshness checks persist | ⬜ | Extension table populated |
| Schema checks persist | ⬜ | JSON fields stored correctly |
| Reference checks persist | ⬜ | Extension table populated |
| Scalar checks persist | ⬜ | Extension table populated |
| Custom SQL checks persist | ⬜ | Extension table populated |
| Cascading dropdowns work | ⬜ | Source → Schema → Table → Column |
| Read-back displays correctly | ⬜ | Form shows saved values |

**GO Decision:** All criteria checked → Proceed with full migration
**NO-GO Decision:** Critical failures → Document blockers, re-evaluate

---

## Troubleshooting

### GraphQL Mutations Not Working

1. Verify table has primary key
2. Check GraphQL schema is refreshed
3. Verify authentication (saved credentials)

### Cascading Dropdowns Slow

1. Add indexes to fabric_metadata table
2. Increase pagination limit
3. Add loading indicators

### Extension Tables Not Populated

1. Verify SP is called (check logs)
2. Verify parameters are passed correctly
3. Check constraint violations

---

## Next Steps After POC

If POC successful:

1. Implement remaining forms (Testcases, Suites, Contracts, Scans)
2. Add scan execution via Fabric notebook
3. Implement results display
4. Add Soda-Fabric integration
5. Production deployment
