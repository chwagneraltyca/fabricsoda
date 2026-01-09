# Fabric Architecture: One-Way Execution Model

**Version:** 1.0
**Last Updated:** 2025-01-04
**Status:** Architecture Decision

---

## Executive Summary

The Fabric migration changes from a **two-way** architecture (both GUI and notebooks can execute) to a **one-way** architecture (only notebooks execute). This simplifies the system but changes the user experience.

---

## Architecture Comparison

### OLD: Two-Way (Flask + Synapse)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLASK GUI (Environment A)                            │
│  ─────────────────────────────────────────────────────────────────────────   │
│  • Define checks, testcases, suites, contracts          ◄── CRUD            │
│  • Run ad-hoc tests for validation                      ◄── CAN EXECUTE     │
│  • View historical results and dashboards               ◄── READ RESULTS    │
│  • Python backend with Soda Core installed              ◄── HAS RUNTIME     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Shared Metadata Database
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               SYNAPSE NOTEBOOK (Environment B)                               │
│  ─────────────────────────────────────────────────────────────────────────   │
│  • Scheduled suite execution in pipelines               ◄── CAN EXECUTE     │
│  • Pipeline failure on DQ failures                      ◄── PIPELINE CTRL   │
│  • Results written back to shared database              ◄── WRITE RESULTS   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key characteristic:** BOTH environments can execute Soda scans.

---

### NEW: One-Way (Fabric Workload + Python Notebook)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FABRIC WORKLOAD (Frontend Only)                           │
│  ─────────────────────────────────────────────────────────────────────────   │
│  • Define checks, testcases, suites via UI              ◄── CRUD            │
│  • Configure data sources and thresholds                ◄── CRUD            │
│  • View historical results (read-only)                  ◄── READ ONLY       │
│  • NO Python runtime - pure React/TypeScript            ◄── NO EXECUTION    │
│  • GraphQL API for all data access                      ◄── API ONLY        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ GraphQL API
                                    ▼
                         ┌─────────────────────┐
                         │   Fabric SQL DB     │
                         │   (Metadata Store)  │
                         └─────────────────────┘
                                    ▲
                                    │ Direct SQL / GraphQL
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FABRIC PYTHON NOTEBOOK (Execution Only)                   │
│  ─────────────────────────────────────────────────────────────────────────   │
│  • Read check definitions from database                 ◄── READ METADATA   │
│  • Generate YAML, execute Soda Core                     ◄── EXECUTE         │
│  • Write results back to database                       ◄── WRITE RESULTS   │
│  • Ad-hoc testing (manual notebook run)                 ◄── DEV TESTING     │
│  • Scheduled execution (Data Factory pipeline)          ◄── PRODUCTION      │
│  • Pipeline integration (assert_no_failures)            ◄── PIPELINE CTRL   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key characteristic:** ONLY notebook can execute Soda scans.

---

## What This Means

### For Users

| Action | OLD (Flask) | NEW (Fabric) |
|--------|-------------|--------------|
| Create check | GUI form | GUI form (same) |
| Edit check | GUI form | GUI form (same) |
| **Test check** | GUI "Run" button | **Open notebook, run cell** |
| View results | GUI dashboard | GUI dashboard (same) |
| Production run | Pipeline/Notebook | Pipeline/Notebook (same) |

**Key UX Change:** Users cannot "test" a check directly from the UI. They must:
1. Save the check in the UI
2. Open the Python notebook
3. Run the scan manually
4. Return to UI to view results

### For Development

| Component | Responsibility |
|-----------|---------------|
| Fabric Workload | CRUD only - no execution logic |
| Python Notebook | ALL execution - ad-hoc AND production |
| GraphQL API | Data access layer |
| Fabric SQL DB | Metadata + results storage |

---

## Execution Patterns

### Pattern 1: Ad-hoc Testing (Development)

```python
# Fabric Python Notebook - Manual execution

from soda.scan import Scan

# 1. Load check metadata
checks = fetch_checks_from_db(testcase_id=5)

# 2. Generate YAML
yaml_content = generate_yaml(checks)

# 3. Execute
scan = Scan()
scan.add_configuration_yaml_str(connection_config)
scan.add_sodacl_yaml_str(yaml_content)
scan.execute()

# 4. View results
print(scan.get_scan_results())

# 5. Store results (optional for ad-hoc)
store_results(scan.get_scan_results())
```

### Pattern 2: Scheduled Execution (Production)

```python
# Fabric Python Notebook - Called by Data Factory

def run_suite(suite_id: int, pipeline_run_id: str):
    # 1. Load suite checks
    checks = fetch_suite_checks(suite_id)

    # 2. Generate YAML
    yaml_content = generate_yaml(checks)

    # 3. Execute
    scan = Scan()
    scan.add_configuration_yaml_str(connection_config)
    scan.add_sodacl_yaml_str(yaml_content)
    scan.execute()

    # 4. Store results (REQUIRED for production)
    results = scan.get_scan_results()
    store_results(results, pipeline_run_id)

    # 5. Pipeline control
    if results['hasFailures']:
        raise Exception(f"DQ Failed: {count_failures(results)} checks failed")

# Called by Data Factory with parameters
run_suite(
    suite_id=dbutils.widgets.get("suite_id"),
    pipeline_run_id=dbutils.widgets.get("pipeline_run_id")
)
```

### Pattern 3: Quick Test from Notebook (Merged Pattern)

```python
# Same notebook handles both dev testing and production

# Quick test mode (no result storage)
run_scan(suite_id=5, store_results=False)

# Production mode (with result storage)
run_scan(suite_id=5, store_results=True, pipeline_run_id="abc123")
```

---

## Comparison to Soda ADF Pattern

From [Soda ADF Quick Start](https://docs.soda.io/use-case-guides/quick-start-adf):

| Soda Pattern | Our Pattern |
|--------------|-------------|
| Checks defined in YAML files | Checks defined in DB via UI |
| YAML stored in repo | Metadata stored in Fabric SQL DB |
| Results to Soda Cloud | Results to Fabric SQL DB |
| ADF orchestrates notebooks | Data Factory orchestrates notebooks |

**Key difference:** We use a database for check definitions (UI-friendly) instead of YAML files (developer-friendly). This enables non-technical users to manage checks.

---

## Alternative: Add "Run" Button to UI

If users need to test from the UI, we could add a "Run Check" button that:

1. Calls a Fabric API to trigger notebook execution
2. Waits for completion (or polls)
3. Displays results in UI

**Implementation options:**
- Fabric REST API to run notebook
- Azure Functions as intermediary
- Power Automate flow

**Complexity:** High - requires additional infrastructure.

**Recommendation:** Start with notebook-only execution. Add UI trigger later if user feedback demands it.

---

## Data Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   User      │     │  Pipeline   │
│  (Config)   │     │  (Testing)  │     │ (Scheduled) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Fabric    │     │   Python    │     │   Python    │
│  Workload   │     │  Notebook   │     │  Notebook   │
│   (CRUD)    │     │  (Manual)   │     │  (Auto)     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ GraphQL           │ SQL               │ SQL
       │ executesp_*       │ EXEC sp_*         │ EXEC sp_*
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│              STORED PROCEDURES (Single Source)       │
│  ┌────────────────────────────────────────────────┐ │
│  │  sp_insert_result, sp_insert_execution_log     │ │
│  │  sp_create_check, sp_create_freshness_check    │ │
│  └────────────────────────────────────────────────┘ │
│                         │                           │
│                         ▼                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  dq_checks   │  │  dq_results  │  │ exec_logs  │ │
│  │  dq_sources  │  │              │  │            │ │
│  │  dq_suites   │  │              │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│     METADATA          RESULTS          LOGS         │
└─────────────────────────────────────────────────────┘
       ▲                                      │
       │                                      │
       │         READ RESULTS                 │
       └──────────────────────────────────────┘
              Workload displays results
```

---

## Data Access Patterns

### Principle: Separation of Concerns

| Component | Connection | Purpose | Policy |
|-----------|------------|---------|--------|
| **Frontend** | GraphQL API | CRUD operations | Forms, UI |
| **Notebook** | Direct SQL (pyodbc) | Read metadata | Fetch checks |
| **Notebook** | OneLake (notebookutils) | Write results | JSON logs |

**Frontend does NOT execute scans. Notebook does NOT do CRUD.**

---

## Storage Strategy: SQL DB + OneLake

### Complete Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PYTHON NOTEBOOK EXECUTION                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    ▼                               ▼                               ▼
┌─────────┐                   ┌─────────┐                   ┌─────────────┐
│ STEP 1  │                   │ STEP 2  │                   │   STEP 3    │
│ READ    │                   │ EXECUTE │                   │   WRITE     │
└────┬────┘                   └────┬────┘                   └──────┬──────┘
     │                             │                               │
     │ pyodbc                      │ soda-core-fabric              │
     ▼                             ▼                               ▼
┌─────────────┐             ┌─────────────┐             ┌─────────────────┐
│ SQL DB      │             │ Fabric DWH  │             │ SQL DB + OneLake│
│ (Metadata)  │             │ (Target)    │             │ (Results)       │
├─────────────┤             ├─────────────┤             ├─────────────────┤
│ dq_checks   │             │ sample_dwh  │             │ ► execution_logs│
│ dq_sources  │             │ NYTaxi data │             │ ► dq_results    │
│ dq_suites   │             │             │             │ ► JSON to Lake  │
└─────────────┘             └─────────────┘             └─────────────────┘
```

### Step-by-Step Notebook Flow

```python
# ═══════════════════════════════════════════════════════════════════════
# STEP 1: READ METADATA (SQL DB via pyodbc)
# ═══════════════════════════════════════════════════════════════════════

# 1a. Create execution log entry (status='running')
cursor.execute("EXEC sp_create_scan_execution_log @suite_id=?, @status='running'", (suite_id,))
execution_log_id = cursor.fetchone()[0]

# 1b. Fetch check definitions
cursor.execute("SELECT * FROM vw_checks_complete WHERE suite_id = ?", (suite_id,))
checks = cursor.fetchall()

# 1c. Generate SodaCL YAML
yaml_content = yaml_generator.generate_yaml(checks)

# ═══════════════════════════════════════════════════════════════════════
# STEP 2: EXECUTE SODA SCAN (Against Fabric DWH)
# ═══════════════════════════════════════════════════════════════════════

scan = Scan()
scan.set_data_source_name("fabric_dwh")
scan.add_configuration_yaml_str(fabric_connection_config)
scan.add_sodacl_yaml_str(yaml_content)
scan.execute()

# Get results
scan_results = scan.get_scan_results()
soda_logs = scan.get_logs_text()

# ═══════════════════════════════════════════════════════════════════════
# STEP 3: WRITE RESULTS (SQL DB + OneLake)
# ═══════════════════════════════════════════════════════════════════════

# 3a. Write individual check results to SQL DB
for check in scan_results['checks']:
    cursor.execute("""
        EXEC sp_insert_result
            @execution_log_id = ?,
            @check_id = ?,
            @outcome = ?,
            @measured_value = ?
    """, (execution_log_id, check['check_id'], check['outcome'], check['value']))

# 3b. Update execution log with summary (SQL DB)
cursor.execute("""
    EXEC sp_update_scan_execution_log
        @execution_log_id = ?,
        @status = 'completed',
        @total_checks = ?,
        @checks_passed = ?,
        @checks_failed = ?
""", (execution_log_id, total, passed, failed))

# 3c. Write full JSON logs to OneLake (for analytics/archival)
full_results = {
    "run_id": run_id,
    "execution_log_id": execution_log_id,
    "scan_results": scan_results,
    "soda_logs": soda_logs,
    "yaml_content": yaml_content
}
with open(f"/lakehouse/default/Files/logs/execution_{run_id}.json", "w") as f:
    json.dump(full_results, f, indent=2)
```

### What Goes Where?

| Data | Storage | Purpose | Format |
|------|---------|---------|--------|
| Check definitions | SQL DB | CRUD, UI display | Relational |
| Execution log (summary) | SQL DB | UI dashboard, status | Relational |
| Check results (outcomes) | SQL DB | UI results view | Relational |
| Full Soda logs | OneLake | Debug, analytics | JSON |
| Raw scan output | OneLake | Archival, audit | JSON |
| YAML content | OneLake | Reproducibility | JSON |

### Storage Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SQL DATABASE                                   │
│  (For UI/CRUD - Relational, ACID, GraphQL-accessible)                   │
├─────────────────┬─────────────────┬─────────────────────────────────────┤
│ METADATA        │ EXECUTION LOGS  │ RESULTS (Summary)                   │
├─────────────────┼─────────────────┼─────────────────────────────────────┤
│ dq_sources      │ execution_log_id│ result_id                           │
│ dq_checks       │ suite_id        │ execution_log_id                    │
│ dq_suites       │ status          │ check_id                            │
│ dq_testcases    │ total_checks    │ outcome (pass/fail/warn)            │
│                 │ checks_passed   │ measured_value                      │
│                 │ checks_failed   │ threshold                           │
│                 │ error_message   │                                     │
└─────────────────┴─────────────────┴─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           ONELAKE (Lakehouse)                            │
│  (For Analytics/Archival - JSON, Unlimited, Spark-queryable)            │
├─────────────────────────────────────────────────────────────────────────┤
│ /Files/logs/                                                             │
│   └── execution_{run_id}.json    ← Full Soda logs, debug info           │
│ /Files/results/                                                          │
│   └── results_{run_id}.json      ← Complete scan results (all fields)   │
│ /Files/yaml/                                                             │
│   └── checks_{run_id}.yaml       ← Generated SodaCL for reproducibility │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why OneLake for Results?

| Aspect | SQL DB | OneLake |
|--------|--------|---------|
| **Cost** | Higher (compute) | Lower (storage) |
| **Scale** | Limited by DB size | Unlimited |
| **Analytics** | SQL queries | Spark, Power BI |
| **Schema** | Fixed | Flexible (JSON) |
| **Historical** | Retention policies | Cheap archival |

### Writing JSON to OneLake

```python
import json
from notebookutils import mssparkutils

# Execution results
results = {
    "run_id": "abc123",
    "suite_id": 5,
    "timestamp": "2025-01-04T10:30:00Z",
    "checks": [
        {"check_id": 101, "outcome": "pass", "measured_value": 1523},
        {"check_id": 102, "outcome": "fail", "measured_value": 0.15}
    ]
}

# Write to OneLake (default lakehouse)
output_path = f"/lakehouse/default/Files/results/execution_{results['run_id']}.json"
with open(output_path, "w") as f:
    json.dump(results, f, indent=2)

# Or using notebookutils for non-default lakehouse
notebookutils.fs.put(
    "abfss://workspace@onelake.dfs.fabric.microsoft.com/lakehouse.Lakehouse/Files/logs/exec.json",
    json.dumps(results)
)
```

### Reading Results in Frontend

Frontend reads results via SQL DB views that reference OneLake:
1. **Option A:** Lakehouse SQL endpoint (query JSON directly)
2. **Option B:** Sync job copies summary to SQL DB
3. **Option C:** Power BI DirectLake on Lakehouse

---

### Frontend: GraphQL for CRUD

The Fabric Workload frontend uses GraphQL API for all data access:

```graphql
# Read
query { dq_checks { items { check_id, check_name } } }

# Write (simple CRUD - auto-generated)
mutation { createDq_sources(item: { source_name: "NYTaxi" }) { source_id } }

# Write (extension checks - SP-backed)
mutation { executesp_create_freshness_check(...) { check_id } }
```

**Why GraphQL for Frontend:**
- Standard Fabric SDK pattern
- Built-in authentication
- Type-safe queries
- No direct DB credentials in browser

---

### Notebook: Direct SQL for Execution

The Python Notebook connects directly to the metadata DB via pyodbc/ODBC:

```python
import pyodbc

# Connect to metadata DB (same DB as GraphQL points to)
conn = pyodbc.connect(
    f"Driver={{ODBC Driver 18 for SQL Server}};"
    f"Server={metadata_server};"
    f"Database={metadata_db};"
    f"Authentication=ActiveDirectoryServicePrincipal;"
    f"UID={client_id};PWD={client_secret}"
)

# Read checks for scan
cursor.execute("SELECT * FROM vw_checks_complete WHERE suite_id = ?", (suite_id,))
checks = cursor.fetchall()

# Write results via SP
cursor.execute("EXEC sp_insert_result @check_id=?, @outcome=?, @measured_value=?",
               (check_id, outcome, value))
```

**Why Direct SQL for Notebook:**
- No HTTP overhead for batch operations
- Same connection pattern as Soda Core uses
- Simpler authentication (Service Principal)
- Full SQL capabilities (transactions, bulk inserts)

---

### Both Use Same Stored Procedures

Even though transport differs, both hit the same SPs for writes:

| Operation | Frontend (GraphQL) | Notebook (SQL) |
|-----------|-------------------|----------------|
| Insert result | `executesp_insert_result` | `EXEC sp_insert_result` |
| Create log | `executesp_insert_execution_log` | `EXEC sp_insert_execution_log` |
| Update log | `executesp_update_execution_log` | `EXEC sp_update_execution_log` |

**Benefit:** Same validation, same business logic, regardless of caller.

### Required Stored Procedures for Notebook

| SP | Purpose | Used By |
|----|---------|---------|
| `sp_insert_execution_log` | Create execution log entry | Notebook |
| `sp_update_execution_log` | Update log status (running→completed) | Notebook |
| `sp_insert_result` | Store check result | Notebook |
| `sp_get_suite_checks` | Fetch checks for YAML generation | Notebook |
| `sp_get_testcase_checks` | Fetch checks by testcase | Notebook |

### Notebook Execution Pattern

```python
# 1. Create execution log (SP)
cursor.execute("EXEC sp_insert_execution_log @suite_id=?, @status='running'", (suite_id,))
execution_log_id = cursor.fetchone()[0]

# 2. Fetch checks (SP)
cursor.execute("EXEC sp_get_suite_checks @suite_id=?", (suite_id,))
checks = cursor.fetchall()

# 3. Generate YAML, execute Soda (Python)
yaml_content = generate_yaml(checks)
scan.execute()

# 4. Store results (SP)
for result in scan.get_scan_results()['checks']:
    cursor.execute("""
        EXEC sp_insert_result
            @execution_log_id = ?,
            @check_id = ?,
            @outcome = ?,
            @measured_value = ?
    """, (execution_log_id, result['check_id'], result['outcome'], result['value']))

# 5. Update execution log (SP)
cursor.execute("EXEC sp_update_execution_log @id=?, @status='completed'", (execution_log_id,))
```

---

---

## Comparison with Legacy Architecture

### OLD: Shared Python Adapter

```
┌─────────────────┐     ┌─────────────────┐
│   Flask GUI     │     │ Synapse Notebook│
│                 │     │                 │
│  Service Class  │     │ ScanOrchestrator│
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  SHARED PYTHON CODE   │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           azure_sql_adapter.py          │
│      call_stored_procedure(sp_name)     │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│          Stored Procedures              │
│   sp_create_check, sp_insert_result     │
└─────────────────────────────────────────┘
```

**Both Flask and Notebook shared the same adapter code.**

---

### NEW: Separate Data Access, Same SPs

```
┌─────────────────┐     ┌─────────────────┐
│ Fabric Workload │     │ Python Notebook │
│  (TypeScript)   │     │    (Python)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ GraphQL               │ pyodbc
         │ (HTTP)                │ (SQL)
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  GraphQL API    │     │  Direct SQL     │
│  executesp_*    │     │  EXEC sp_*      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │   SAME STORED PROCS   │
         ▼                       ▼
┌─────────────────────────────────────────┐
│          Stored Procedures              │
│   sp_create_check, sp_insert_result     │
└─────────────────────────────────────────┘
```

**Frontend and Notebook have separate data access, but hit same SPs.**

---

### Why The Change?

| Aspect | OLD | NEW | Reason |
|--------|-----|-----|--------|
| Frontend runtime | Python (Flask) | TypeScript (React) | Fabric SDK is TypeScript |
| Shared adapter? | Yes | No | Different languages |
| SP layer | Same | Same | Business logic unchanged |
| Notebook code | Can import Flask libs | Standalone | No Flask dependency |

**The fundamental pattern (SP-based data access) remains the same.**

---

## Migration Impact

### Code Reuse from Legacy

| Legacy Component | Fabric Reuse | Notes |
|-----------------|--------------|-------|
| `yaml_generator.py` | **100%** | No changes needed |
| `scan_orchestrator.py` | **90%** | Change connection type |
| `validation_models.py` | **50%** | TypeScript equivalent in frontend |
| Flask blueprints | **0%** | Replaced by GraphQL |
| Jinja templates | **0%** | Replaced by React |

### New Components

| Component | Purpose |
|-----------|---------|
| React UI (Workload) | Check management forms |
| GraphQL queries | Data access |
| Fabric Notebook | Soda execution |
| Data Factory pipeline | Scheduled runs |

---

## Decision Record

**Decision:** Adopt one-way execution model (notebook only).

**Rationale:**
1. Fabric Workload has no Python runtime
2. Simpler architecture with single execution point
3. Consistent behavior between dev and prod
4. Easier to maintain and debug

**Trade-offs:**
- Users must use notebook for testing (extra step)
- No instant "preview" of check results from UI

**Mitigation:**
- Provide well-documented notebook with easy-to-use functions
- Consider UI trigger for notebook in future iteration

---

## References

- [Soda ADF Quick Start](https://docs.soda.io/use-case-guides/quick-start-adf)
- [Fabric Python Notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/fabric-notebook-selection-guide)
- [Legacy Architecture](../../Legacy/docs/04-SODA-CORE-INTEGRATION.md)
