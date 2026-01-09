# DQ Checker Design Principles

> **MANDATORY**: These principles must be followed throughout the project.

## Architecture Overview

**Current Architecture (OneLake JSON):**
- Frontend: CRUD via OneLake JSON files (no cold start, <200ms)
- Notebook: Read JSON config via Spark external tables, write results to Parquet
- Storage: `Files/config/data/` for JSON, `Tables/` for Parquet

**Full schema:** `docs/specs/data-model/json-data-model.md`

---

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

## 1. Data Model (OneLake JSON)

### Entity Relationships

```
Suite (suites/*.json)
  └── testcase_ids[]: N:M references
        │
        ▼
Testcase (testcases/*.json)
  ├── source_id: FK to Source (N:1)
  │     │
  │     ▼
  │   Source (sources/*.json)
  │
  └── checks[]: Embedded checks (composition)
```

| Relationship | Type | Implementation |
|--------------|------|----------------|
| Suite ↔ Testcase | N:M | `testcase_ids[]` array in suite |
| Testcase → Source | N:1 | `source_id` FK |
| Testcase → Check | 1:N | Embedded `checks[]` array |

### Storage Structure

```
Files/config/data/
├── sources/*.json       # 3-5 files, connection configs
├── testcases/*.json     # 80-140 files, embedded checks
└── suites/*.json        # 40-60 files, testcase references

Tables/
├── dq_results/          # Parquet, notebook writes
└── dq_execution_logs/   # Parquet, notebook writes
```

### Schema File

**Source of truth:** `docs/specs/data-model/json-data-model.md`

## 2. Naming Conventions

### JSON Files

| Pattern | Example | Usage |
|---------|---------|-------|
| `sources/{uuid}.json` | `sources/src-abc123.json` | Connection configs |
| `testcases/{uuid}.json` | `testcases/tc-def456.json` | Table scope + embedded checks |
| `suites/{uuid}.json` | `suites/suite-ghi789.json` | Business metadata + testcase refs |

### TypeScript Services

| Pattern | Example | Usage |
|---------|---------|-------|
| `*Service.ts` | `sourceService.ts` | CRUD operations for entity |
| `onelakeJsonService.ts` | - | Low-level OneLake DFS operations |

## 3. Data Access Strategy

### Frontend (OneLake JSON via DFS API)

| Operation | Pattern |
|-----------|---------|
| Load all | Parallel read of all JSON files on app start |
| Create | Generate UUID, write JSON file |
| Update | Read file, modify, write with version check |
| Delete | Delete JSON file |

### Notebook (Spark)

| Operation | Method |
|-----------|--------|
| Read config | External tables on JSON files |
| Write results | Internal Parquet tables |

## 4. Check Types

All check types supported via polymorphic `config` object in embedded checks:

| Metric | Config Fields |
|--------|---------------|
| `row_count`, `missing_*` | (none - uses thresholds only) |
| `freshness` | `freshness_column`, `threshold_value`, `threshold_unit` |
| `schema` | `required_columns[]`, `forbidden_columns[]`, `column_types{}` |
| `reference` | `reference_table`, `reference_column`, `reference_sql_query` |
| `scalar_comparison` | `query_a`, `query_b`, `comparison_operator`, `tolerance` |
| `custom_sql` | `custom_sql_query` |

## 5. Frontend Patterns

### Load-All-Cache-In-Memory

```
App Start (~300ms)
├── Load sources/*.json → memory
├── Load testcases/*.json → memory
└── Load suites/*.json → memory

After Load (instant)
├── Dropdowns → filter from memory
├── List views → sort/filter from memory
└── Mutations → update memory + persist to OneLake
```

### Two Entry Points

| Entry | Skips | Creates Suite |
|-------|-------|---------------|
| Create Suite | Nothing | Yes |
| Quick Check | Step 1 | No (orphan testcase) |

## 6. Reporting

### Results Storage (Parquet)

- Notebook writes execution logs and results to Parquet tables
- Power BI DirectLake on Parquet files
- No ETL required

## Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| JSON Data Model | `docs/specs/data-model/json-data-model.md` | Current data model |
| Notebook Implementation | `docs/specs/FABRIC-NOTEBOOK-IMPLEMENTATION.md` | Soda Core execution |
| Automation | `docs/specs/AUTOMATION.md` | PowerShell scripts |

## Archived Documents (GraphQL/SQL Database)

Previous architecture documentation moved to `archive/docs/`:
- `archive/docs/specs/data-model/er-model-simplified.md` - SQL ER model
- `archive/docs/specs/FABRIC-ARCHITECTURE.md` - SQL + GraphQL architecture
- `archive/docs/design/SIMPLIFICATION-ANALYSIS.md` - SQL schema analysis
