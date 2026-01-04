# DQ Checker Design Principles

> **MANDATORY**: These principles must be followed throughout the project.

## Fabric Workload SDK Guidelines

Based on [Microsoft Fabric Extensibility Toolkit](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/implementation-guide):

### Required Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Fabric UX System** | Use FluentUI v9 + Fabric design tokens |
| **Workload manifest** | Least-privilege permissions |
| **Scripts** | Use provided StartDevServer, StartDevGateway |
| **AI-assisted** | Claude configured via CLAUDE.md |

### Development Workflow

```
1. Start DevGateway (Terminal 1)
2. Start DevServer (Terminal 2)
3. Open Fabric portal → Workload Hub → Create item
4. Changes reflect immediately (hot reload)
```

### Best Practices (MS Guidelines)

1. **Fork Starter-Kit** as project base
2. **Validate manifest** early with least-privilege
3. **Use dev scripts** for automation
4. **Debug in browser** dev tools (iFrame hosted)
5. **Iterate rapidly** with DevGateway

---

## 1. Data Model

### ER Relationships

```
Suite ←─N:M─→ suites_testcases ←─N:M─→ Testcase ──1:N──→ Check
                                              │
                                    Extension Tables (1:0..1)
```

| Relationship | Type | Table |
|--------------|------|-------|
| Suite ↔ Testcase | N:M | `suites_testcases` |
| Testcase → Check | 1:N | `dq_checks.testcase_id` |
| Check → Extension | 1:0..1 | `dq_checks_*` tables |

### Schema File

**Source of truth:** `setup/simplified-schema-minimal-ddl.sql`

## 2. Naming Conventions

### Tables

| Pattern | Example | Usage |
|---------|---------|-------|
| `dq_*` | `dq_sources`, `dq_checks` | Core DQ entities |
| `dq_checks_*` | `dq_checks_freshness` | Check extension tables |
| `fabric_*` | `fabric_metadata` | Cached Fabric data |

### Views

| Pattern | Example | Usage |
|---------|---------|-------|
| `vw_*` | `vw_checks_complete` | API/reporting views |
| `vw_*_complete` | `vw_checks_complete` | Joins all related data |
| `vw_orphan_*` | `vw_orphan_testcases` | NOT EXISTS filters |

### Stored Procedures

| Pattern | Example | Usage |
|---------|---------|-------|
| `sp_create_*` | `sp_create_freshness_check` | Multi-table inserts |
| `sp_update_*` | - | Multi-table updates |
| `sp_delete_*` | - | Cascade deletes |

## 3. API Strategy

### Hybrid Approach

| Operation | Method | Rationale |
|-----------|--------|-----------|
| Simple CRUD | Auto-generated GraphQL | Single table, no logic |
| Extension Checks | Stored Procedure | Multi-table atomicity |
| Batch Operations | Stored Procedure | Transaction required |

### Auto-Generated Mutations

Use for these tables (simple CRUD):
- `dq_sources`
- `dq_suites`
- `dq_testcases`
- `dq_checks` (standard types only)
- `suites_testcases`

### SP-Backed Mutations

Use for extension check types:
- `executesp_create_freshness_check`
- `executesp_create_schema_check`
- `executesp_create_reference_check`
- `executesp_create_scalar_comparison_check`
- `executesp_create_custom_sql_check`

## 4. Check Types

### Standard (Single Table)

| Metric | Extension Table | SP Required |
|--------|-----------------|-------------|
| row_count | - | No |
| missing_count | - | No |
| duplicate_count | - | No |
| invalid_count | - | No |
| values_in_set | - | No |

### Extended (Multi-Table)

| Metric | Extension Table | SP Required |
|--------|-----------------|-------------|
| freshness | `dq_checks_freshness` | **Yes** |
| schema | `dq_checks_schema` | **Yes** |
| reference | `dq_checks_reference` | **Yes** |
| scalar_comparison | `dq_checks_scalar` | **Yes** |
| custom_sql | `dq_checks_custom` | **Yes** |

## 5. Frontend Patterns

### Cascading Dropdowns

```
Source → Schema → Table → Column
```

Data from `fabric_metadata` table via views:
- `vw_fabric_schemas`
- `vw_fabric_tables`
- `vw_fabric_columns`

### Two Entry Points

| Entry | Skips | Creates Suite |
|-------|-------|---------------|
| Create Suite | Nothing | Yes |
| Quick Check | Step 1 | No (orphan testcase) |

## 6. Reporting

### Virtual Data Mart

- No ETL, no duplication
- Power BI DirectQuery to views
- See: `docs/specs/data-model/VIRTUAL-DATAMART.md`

## Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| ER Model | `docs/specs/data-model/er-model-simplified.md` | Entity relationships |
| Virtual Datamart | `docs/specs/data-model/VIRTUAL-DATAMART.md` | Reporting layer |
| DDL | `setup/simplified-schema-minimal-ddl.sql` | Schema definition |
| Design Analysis | `docs/design/SIMPLIFICATION-ANALYSIS.md` | Full design rationale |
