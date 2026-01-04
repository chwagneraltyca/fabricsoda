# DQ Checker Virtual Data Mart

## Overview

The DQ Checker uses a **virtual data mart** pattern - no ETL, no data duplication. Power BI connects directly to views in the metadata database via DirectQuery.

## Bus Matrix

| Fact/Dimension | dq_checks | dq_results | dq_suites | dq_testcases | dq_sources |
|----------------|:---------:|:----------:|:---------:|:------------:|:----------:|
| **Check Dimension** | X | X | - | - | - |
| **Testcase Dimension** | X | X | X | X | - |
| **Suite Dimension** | - | X | X | - | - |
| **Source Dimension** | X | X | - | X | X |
| **Time Dimension** | X | X | - | - | - |
| **Metric Type** | X | X | - | - | - |

## Star Schema (Virtual)

```
                    ┌─────────────────┐
                    │   dim_sources   │
                    │ source_id (PK)  │
                    │ source_name     │
                    └────────┬────────┘
                             │
┌─────────────────┐          │          ┌─────────────────┐
│   dim_suites    │          │          │   dim_time      │
│ suite_id (PK)   │          │          │ date_key (PK)   │
│ suite_name      │          │          │ year, month     │
│ category        │          │          │ week, day       │
│ data_domain     │          │          └────────┬────────┘
└────────┬────────┘          │                   │
         │                   │                   │
         │         ┌─────────┴───────────────────┴─────────┐
         └─────────│         fact_check_results            │
                   │─────────────────────────────────────────│
                   │ result_id (PK)                         │
                   │ check_id (FK) ─────────────────────────┼─────┐
                   │ suite_id (FK)                          │     │
                   │ testcase_id (FK)                       │     │
                   │ source_id (FK)                         │     │
                   │ date_key (FK)                          │     │
                   │ metric                                 │     │
                   │ pass/fail/warn                         │     │
                   │ value                                  │     │
                   └───────────────────────────────────────┬┘     │
                                                           │      │
                   ┌─────────────────┐                     │      │
                   │  dim_testcases  │◄────────────────────┘      │
                   │ testcase_id (PK)│                            │
                   │ testcase_name   │                            │
                   │ schema.table    │                            │
                   └─────────────────┘                            │
                                                                  │
                   ┌─────────────────┐                            │
                   │   dim_checks    │◄───────────────────────────┘
                   │ check_id (PK)   │
                   │ check_name      │
                   │ metric          │
                   │ dimension       │
                   │ severity        │
                   └─────────────────┘
```

## Views for Power BI

| View | Type | Purpose |
|------|------|---------|
| `vw_checks_complete` | Dimension | All check attributes joined |
| `vw_suite_testcases` | Bridge | N:M suite-testcase relationship |
| `vw_orphan_testcases` | Filter | Testcases not in any suite |
| `vw_active_data_sources` | Dimension | Active sources only |
| `vw_check_results` | Fact | Results with outcome (TBD) |

## POC Scope

For POC, only **metadata views** are needed (no results yet):

```sql
-- These exist in simplified-schema-minimal-ddl.sql
vw_checks_complete      -- Check catalog
vw_suite_testcases      -- Suite contents
vw_active_data_sources  -- Source list
```

## Future: Results Views

When results table is added:

```sql
-- Future: Add after execution engine works
CREATE VIEW vw_check_results AS
SELECT
    r.result_id,
    r.check_id,
    r.execution_time,
    r.outcome,  -- 'pass', 'fail', 'warn'
    r.value,
    c.check_name,
    c.metric,
    t.testcase_name,
    t.schema_name,
    t.table_name,
    s.source_name
FROM dq_results r
JOIN dq_checks c ON r.check_id = c.check_id
JOIN dq_testcases t ON c.testcase_id = t.testcase_id
JOIN dq_sources s ON t.source_id = s.source_id;
```

## Power BI Connection

1. **Create GraphQL API** exposing views
2. **DirectQuery** from Power BI to GraphQL
3. **No import** - always live data

```
Power BI ──DirectQuery──> GraphQL API ──> Views ──> Tables
```

## What's NOT Included (Legacy)

Legacy had complex dashboard queries - these are **NOT migrated**:
- Trend calculations in SQL
- Pre-aggregated rollups
- Materialized summaries

Power BI handles these natively via DAX.
