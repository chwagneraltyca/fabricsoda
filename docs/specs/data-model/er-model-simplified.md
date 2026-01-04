# DQ Checker Simplified ER Model

## Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    dq_suites ||--o{ suites_testcases : "has (N:M)"
    suites_testcases }o--|| dq_testcases : "contains (N:M)"
    dq_testcases ||--o{ dq_checks : "has (1:N)"
    dq_checks ||--o| dq_checks_freshness : "extends"
    dq_checks ||--o| dq_checks_schema : "extends"
    dq_checks ||--o| dq_checks_reference : "extends"
    dq_checks ||--o| dq_checks_scalar : "extends"
    dq_checks ||--o| dq_checks_custom : "extends"
    dq_sources ||--o{ dq_testcases : "referenced by"
    dq_sources ||--o{ fabric_metadata : "cached for"

    dq_suites {
        int suite_id PK
        string suite_name
        string suite_code
        string description
        string category "Critical"
        string data_domain "Critical"
        int execution_order
        string owner
        string tags "JSON"
        bit is_active
        datetime created_at
        datetime updated_at
    }

    suites_testcases {
        int suite_id PK,FK
        int testcase_id PK,FK
        datetime created_at
    }

    dq_testcases {
        int testcase_id PK
        string testcase_name
        int source_id FK
        string schema_name
        string table_name
        string owner
        string tags "JSON"
        bit is_active
        datetime created_at
        datetime updated_at
    }

    dq_sources {
        int source_id PK
        string source_name
        string description
        bit is_active
        datetime created_at
        datetime updated_at
    }

    dq_checks {
        int check_id PK
        int testcase_id FK
        string column_name "nullable"
        string check_name
        string metric
        string fail_comparison
        decimal fail_threshold
        string warn_comparison
        decimal warn_threshold
        string filter_condition
        string dimension
        string severity
        string owner
        string tags
        bit is_enabled
        datetime created_at
        datetime updated_at
    }

    dq_checks_freshness {
        int check_id PK,FK
        string freshness_column
        int threshold_value
        string threshold_unit
    }

    dq_checks_schema {
        int check_id PK,FK
        string required_columns "JSON"
        string forbidden_columns "JSON"
        string column_types "JSON"
        string column_indexes "JSON"
        bit warn_required_missing
        bit warn_forbidden_present
        bit fail_required_missing
        bit fail_forbidden_present
    }

    dq_checks_reference {
        int check_id PK,FK
        string reference_table
        string reference_column
        string reference_sql_query
    }

    dq_checks_scalar {
        int check_id PK,FK
        string query_a
        string query_b
        string comparison_operator
        decimal tolerance_value
        string tolerance_type
    }

    dq_checks_custom {
        int check_id PK,FK
        string custom_sql_query
    }

    fabric_metadata {
        int metadata_id PK
        int source_id FK
        string schema_name
        string table_name
        string column_name
        string data_type
        datetime refreshed_at
    }

    dq_execution_logs {
        bigint execution_log_id PK
        string run_id
        int suite_id FK
        int source_id FK
        string execution_type
        string execution_status
        int total_checks
        int checks_passed
        int checks_failed
        int checks_warned
        bit has_failures
        string error_message
        string generated_yaml
        datetime created_at
    }

    dq_results {
        int result_id PK
        string run_id
        bigint execution_log_id FK
        int check_id FK
        string check_name
        string check_outcome
        decimal check_value
        datetime created_at
    }

    dq_suites ||--o{ dq_execution_logs : "executes"
    dq_execution_logs ||--o{ dq_results : "produces"
    dq_checks ||--o{ dq_results : "measured by"
```

## ASCII Diagram

```
                                   BUSINESS METADATA
                              ┌─────────────────────────┐
                              │      dq_suites          │
                              │─────────────────────────│
                              │ suite_id (PK)           │
                              │ suite_name              │
                              │ suite_code              │
                              │ category      ← CRITICAL│
                              │ data_domain   ← CRITICAL│
                              │ execution_order         │
                              │ owner, tags, is_active  │
                              └───────────┬─────────────┘
                                          │
                                          │ N:M (via suites_testcases)
                                          │
                              ┌───────────┴─────────────┐
                              │   suites_testcases      │
                              │─────────────────────────│
                              │ suite_id (PK,FK)        │
                              │ testcase_id (PK,FK)     │
                              │ created_at              │
                              └───────────┬─────────────┘
                                          │
                                          │ N:M
                                          │
┌──────────────────┐          ┌───────────┴─────────────┐
│   dq_sources     │          │     dq_testcases        │  ← TABLE SCOPE
│──────────────────│   1:N    │─────────────────────────│
│ source_id (PK)   │◄─────────│ testcase_id (PK)        │
│ source_name      │          │ testcase_name           │
│ description      │          │ source_id (FK)          │
│ is_active        │          │ schema_name             │
└──────────────────┘          │ table_name              │
                              │ owner, tags, is_active  │
                              └───────────┬─────────────┘
                                          │
                                          │ 1:N
                                          │
                              ┌───────────┴─────────────┐
                              │      dq_checks          │  ← DQ RULES
                              │─────────────────────────│
                              │ check_id (PK)           │
                              │ testcase_id (FK)        │
                              │ column_name (nullable)  │
                              │ check_name, metric      │
                              │ fail/warn thresholds    │
                              │ dimension, severity     │
                              │ is_enabled              │
                              └───────────┬─────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │              │            │            │              │
    ┌─────────┴────┐ ┌──────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌─────┴──────┐
    │  freshness   │ │   schema   │ │ reference│ │  scalar  │ │   custom   │
    │──────────────│ │────────────│ │──────────│ │──────────│ │────────────│
    │ check_id(FK) │ │ check_id   │ │ check_id │ │ check_id │ │ check_id   │
    │ column       │ │ req_cols   │ │ ref_table│ │ query_a  │ │ custom_sql │
    │ threshold    │ │ forb_cols  │ │ ref_col  │ │ query_b  │ │            │
    │ unit         │ │ col_types  │ │ sql_query│ │ operator │ │            │
    └──────────────┘ └────────────┘ └──────────┘ └──────────┘ └────────────┘
              EXTENSION TABLES (1:1 with dq_checks, ON DELETE CASCADE)
```

## Key Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| Suite → Testcase | **N:M** | Via `suites_testcases` link table. Same testcase can belong to multiple suites. |
| Testcase → Check | 1:N | Each testcase (table scope) has many checks |
| Check → Extension | 1:0..1 | Each check may have ONE extension table (based on metric type) |
| Source → Testcase | 1:N | Each data source has many testcases |

## What Changed from Legacy

| Entity | Change |
|--------|--------|
| `dq_suites` | **NEW** - Added business metadata fields (category, data_domain, execution_order) |
| `suites_testcases` | **KEPT** - N:M link table preserved for testcase reuse |
| `dq_testcases` | **MODIFIED** - Added schema_name, table_name (from Contract) |
| `dq_contracts` | **ELIMINATED** - Redundant 1:1 with testcase |
| `dq_checks` | **MODIFIED** - Removed source_id, schema_name, table_name (now on testcase) |

## Orphan Testcases

Testcases not linked to any suite are "orphans" (created via Quick Check):

```sql
-- View to find orphan testcases
CREATE VIEW vw_orphan_testcases AS
SELECT t.*
FROM dq_testcases t
WHERE NOT EXISTS (
    SELECT 1 FROM suites_testcases st WHERE st.testcase_id = t.testcase_id
);
```
