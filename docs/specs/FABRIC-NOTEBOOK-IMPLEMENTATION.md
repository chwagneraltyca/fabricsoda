# Fabric Python Notebook Implementation Plan

**Version:** 1.2
**Last Updated:** 2025-01-04
**Status:** Ready for Implementation

---

## Executive Summary

**Key Insight:** We are a wrapper on top of the Soda `Scan` class.

The notebook has 5 jobs:
1. **READ** - Fetch check metadata from SQL DB (pyodbc)
2. **YAML** - Generate SodaCL YAML from checks
3. **EXECUTE** - Run `Scan.execute()` against Fabric DWH
4. **PARSE** - Extract check_id, outcome, value from `scan_results`
5. **WRITE** - Store results to SQL DB + OneLake

Everything else is optional complexity.

---

## Notebook Template

**Location:** `src/Notebook/dq_checker_scan.py`

### Notebook Structure

| Cell | Type | Purpose |
|------|------|---------|
| 1 | MD | Title, architecture diagram, component table |
| 2 | MD | Section: Configuration |
| 3 | Code | Parameters, connection config, paths |
| 4 | MD | Section: Imports & Setup |
| 5 | Code | Imports, run ID generation |
| 6 | MD | Section: Database Connection |
| 7 | Code | `get_metadata_connection()`, `get_dwh_config_yaml()` |
| 8 | MD | Section: READ Component |
| 9 | Code | `read_suite_checks()`, `create_execution_log()` |
| 10 | MD | Section: YAML Component (✅ PROVEN) |
| 11 | Code | YAML helpers |
| 12 | Code | YAML generator (all 20 metrics) |
| 13 | MD | Section: EXECUTE Component |
| 14 | Code | `execute_soda_scan()` |
| 15 | MD | Section: PARSE Component (✅ PROVEN) |
| 16 | Code | `parse_scan_results()`, `count_outcomes()` |
| 17 | MD | Section: WRITE Component |
| 18 | Code | `write_results_to_db()`, `update_execution_log()`, `write_to_onelake()` |
| 19 | MD | Section: Main Execution |
| 20 | Code | `execute_suite()` - orchestrates all components |
| 21 | MD | Section: Run Scan |
| 22 | Code | Execute and display result |
| 23 | MD | Section: Pipeline Integration |
| 24 | Code | Optional: fail on DQ errors |
| 25 | MD | Appendix: YAML Preview |
| 26 | Code | Debug: print generated YAML |

### Design Principles

1. **Self-Documenting** - Each section has MD header explaining purpose
2. **Modular** - Each component is a separate function
3. **Progressive** - Cells can be run individually for debugging
4. **Production-Ready** - Includes error handling and logging
5. **Pipeline-Friendly** - Can fail pipeline on DQ errors

---

## 5 Components Detail

### Component 1: READ (Metadata from SQL DB)

**Purpose:** Fetch check definitions for the suite

**Legacy Code:** `scan_orchestrator.py` → `_get_suite_checks()`, `_get_suite_info()`

**Simplified:**
```python
def read_suite_checks(conn, suite_id):
    """Fetch enabled checks for suite execution."""
    import pandas as pd

    query = """
        SELECT c.*, tc.schema_name
        FROM vw_checks_complete c
        JOIN suites_testcases st ON c.testcase_id = st.testcase_id
        WHERE st.suite_id = ? AND c.is_enabled = 1
        ORDER BY c.check_id
    """
    return pd.read_sql(query, conn, params=[suite_id])
```

**Required columns from `vw_checks_complete`:**
- `check_id`, `check_name`, `metric`, `column_name`
- `table_name`, `schema_name`
- `fail_comparison`, `fail_threshold`, `warn_comparison`, `warn_threshold`
- Extension columns for freshness, schema, custom_sql, etc.

---

### Component 2: YAML (Generate SodaCL)

**Purpose:** Convert check metadata to SodaCL YAML string

**Legacy Code:** `yaml_generator.py` → `generate_yaml_from_dataframe()`, `_generate_check_yaml()`

**Status:** ✅ PROVEN - All 20 metrics working. Copy core logic.

**What to Keep (100% reusable):**
- `_generate_check_yaml()` - 200+ lines of metric-specific logic
- `_generate_freshness_yaml()`
- `_generate_schema_yaml()`
- `_generate_scalar_comparison_yaml()`
- `yaml_helpers.py` - `yaml_safe_value()`, `yaml_safe_filter()`

**Simplified Entry Point:**
```python
def generate_yaml_from_checks(checks_df, schema_in_connection=None):
    """Generate SodaCL YAML from checks DataFrame."""
    yaml_lines = []

    for (schema_name, table_name), table_checks in checks_df.groupby(['schema_name', 'table_name']):
        # Build table identifier
        if schema_in_connection and schema_name == schema_in_connection:
            table_id = table_name  # Schema in connection config
        elif schema_name:
            table_id = f"{schema_name}.{table_name}"
        else:
            table_id = table_name

        yaml_lines.append(f"checks for {table_id}:")

        for _, check in table_checks.iterrows():
            check_yaml = _generate_check_yaml(check)  # Reuse Legacy logic
            yaml_lines.extend(check_yaml)

        yaml_lines.append("")

    return "\n".join(yaml_lines)
```

---

### Component 3: EXECUTE (Soda Scan)

**Purpose:** Run Soda scan against target Fabric DWH

**Legacy Code:** `scan_orchestrator.py` → `execute_suite()`

**Simplified:**
```python
def execute_soda_scan(yaml_content, dwh_config):
    """Execute Soda scan and return results."""
    from soda.scan import Scan

    scan = Scan()
    scan.set_data_source_name("fabric_dwh")
    scan.set_scan_definition_name(f"scan_{run_id}")
    scan.add_configuration_yaml_str(dwh_config)
    scan.add_sodacl_yaml_str(yaml_content)

    scan.execute()

    return {
        "results": scan.get_scan_results(),
        "logs": scan.get_logs_text(),
        "has_errors": scan.has_error_logs()
    }
```

**Fabric DWH Config:**
```yaml
data_source fabric_dwh:
  type: fabric
  connection:
    driver: ODBC Driver 18 for SQL Server
    host: {server}.datawarehouse.fabric.microsoft.com
    database: {database}
    authentication: ActiveDirectoryDefault
```

---

### Component 4: PARSE (Extract Results)

**Purpose:** Extract check_id, outcome, measured_value from Soda results

**Legacy Code:** `scan_orchestrator.py` → `_store_results()` (lines 997-1272)

**Status:** ✅ PROVEN - This parsing logic is battle-tested and works well. Reuse as-is.

**Key Parsing Logic (copy from Legacy):**
```python
import re

def parse_scan_results(scan_results):
    """Parse Soda scan results into result records."""
    results = []

    for check in scan_results.get('checks', []):
        # Extract check_id from name (format: "Check Name [check_id:123]")
        check_name = check.get('name', '')
        check_id_match = re.search(r'\[check_id:(\d+)\]', check_name)
        check_id = int(check_id_match.group(1)) if check_id_match else 0

        # Get diagnostics for values and thresholds
        diagnostics = check.get('diagnostics', {})
        check_value = diagnostics.get('value', check.get('value'))

        # Extract thresholds from diagnostics
        fail_threshold = extract_threshold(diagnostics, 'fail')
        warn_threshold = extract_threshold(diagnostics, 'warn')

        results.append({
            'check_id': check_id,
            'check_name': check_name,
            'check_table': check.get('table', ''),
            'check_column': check.get('column'),
            'outcome': check.get('outcome', 'unknown'),
            'value': check_value,
            'fail_threshold': fail_threshold,
            'warn_threshold': warn_threshold,
            'soda_identity': check.get('identity', '')
        })

    return results

def extract_threshold(diagnostics, key):
    """Extract threshold value from diagnostics.fail or diagnostics.warn."""
    if not diagnostics:
        return None
    threshold_dict = diagnostics.get(key, {})
    for comparison, value in threshold_dict.items():
        return value
    return None
```

**Count Outcomes:**
```python
def count_outcomes(results):
    """Count pass/fail/warn outcomes."""
    return {
        'total': len(results),
        'passed': len([r for r in results if r['outcome'] == 'pass']),
        'failed': len([r for r in results if r['outcome'] == 'fail']),
        'warned': len([r for r in results if r['outcome'] == 'warn'])
    }
```

---

### Component 5: WRITE (Store Results)

**Purpose:** Store results to SQL DB (summary) + OneLake (full JSON)

**Legacy Code:** `scan_orchestrator.py` → `_store_results()`, `_update_execution_log()`

#### 5a. Write to SQL DB (Execution Log + Results)

```python
def create_execution_log(conn, run_id, suite_id):
    """Create execution log entry (status=running)."""
    cursor = conn.cursor()
    cursor.execute("""
        EXEC sp_create_execution_log
            @run_id = ?,
            @suite_id = ?,
            @status = 'running'
    """, (run_id, suite_id))
    execution_log_id = cursor.fetchone()[0]
    conn.commit()
    return execution_log_id

def write_results_to_db(conn, execution_log_id, run_id, results):
    """Write individual check results to SQL DB."""
    cursor = conn.cursor()
    for r in results:
        cursor.execute("""
            EXEC sp_insert_result
                @run_id = ?,
                @execution_log_id = ?,
                @check_id = ?,
                @check_name = ?,
                @check_outcome = ?,
                @check_value = ?
        """, (run_id, execution_log_id, r['check_id'], r['check_name'],
              r['outcome'], r['value']))
    conn.commit()

def update_execution_log(conn, execution_log_id, counts, yaml_content):
    """Update execution log with completion status."""
    cursor = conn.cursor()
    cursor.execute("""
        EXEC sp_update_execution_log
            @execution_log_id = ?,
            @status = 'completed',
            @total_checks = ?,
            @checks_passed = ?,
            @checks_failed = ?,
            @checks_warned = ?,
            @generated_yaml = ?
    """, (execution_log_id, counts['total'], counts['passed'],
          counts['failed'], counts['warned'], yaml_content))
    conn.commit()
```

#### 5b. Write to OneLake (Full JSON)

```python
import json
from datetime import datetime

def write_to_onelake(run_id, execution_log_id, scan_results, soda_logs, yaml_content):
    """Write full results JSON to OneLake."""
    full_results = {
        "run_id": run_id,
        "execution_log_id": execution_log_id,
        "timestamp": datetime.utcnow().isoformat(),
        "scan_results": scan_results,
        "soda_logs": soda_logs,
        "yaml_content": yaml_content
    }

    log_path = f"/lakehouse/default/Files/dq_logs/execution_{run_id}.json"
    with open(log_path, "w") as f:
        json.dump(full_results, f, indent=2, default=str)

    return log_path
```

---

## Component Summary

| Component | Legacy Source | Lines to Reuse | Status |
|-----------|--------------|----------------|--------|
| **READ** | `scan_orchestrator._get_suite_checks()` | ~30 | Simplify to `pd.read_sql()` |
| **YAML** | `yaml_generator.py` (entire file) | ~500 | ✅ PROVEN - copy core logic |
| **EXECUTE** | `scan_orchestrator.execute_suite()` | ~20 | Just `Scan.execute()` |
| **PARSE** | `scan_orchestrator._store_results()` | ~100 | ✅ PROVEN - copy as-is |
| **WRITE** | `scan_orchestrator._finalize_execution()` | ~50 | Direct SP calls + JSON |

**Total reusable code:** ~700 lines from Legacy → ~350 lines in notebook

**Proven Components (copy as-is):**
- YAML generation (`yaml_generator.py`) - all 20 metrics working
- Result parsing (`_store_results()`) - check_id extraction, diagnostics parsing, threshold extraction

---

## Simplifications vs Legacy

### What We Remove

| Legacy Component | Lines | Why Remove |
|-----------------|-------|------------|
| `azure_sql_adapter.py` | 400+ | Use `pyodbc` directly - Fabric has ODBC Driver 18 built-in |
| `base_service.py` | 84 | No service layer needed - direct SP calls |
| `config.py` | 100+ | Use `notebookutils.credentials` or hardcoded config |
| `logging_config.py` | 80+ | Use `print()` or simple logging |
| `models.py` | 200+ | Use simple dicts - no need for dataclasses in notebook |
| `schema_discovery.py` | 150+ | Not needed for execution - metadata already in DB |
| `validation_models.py` | 300+ | Validation done by Frontend (Fabric Workload) |

**Total removed:** ~1,300+ lines of Python

### What We Keep (Simplified)

| Legacy Component | Keep | Simplification |
|-----------------|------|----------------|
| `yaml_generator.py` | ~200 lines | Only `generate_yaml_from_dataframe()` and `_generate_check_yaml()` |
| `yaml_helpers.py` | ~50 lines | Keep as-is (small helper functions) |
| `scan_orchestrator.py` | ~100 lines | Only the core flow (no multi-mode, no Flask context) |

**Total notebook code:** ~350 lines (vs ~2,500+ in Legacy)

---

## Architecture

### Single-File Notebook

```
┌────────────────────────────────────────────────────────────────┐
│ Fabric Python Notebook: dq_checker_scan.py                     │
├────────────────────────────────────────────────────────────────┤
│ Cell 1: Configuration                                          │
│   - Connection strings (from Key Vault or hardcoded)          │
│   - Suite ID parameter                                         │
├────────────────────────────────────────────────────────────────┤
│ Cell 2: YAML Generator (inline)                                │
│   - generate_yaml_from_dataframe()                             │
│   - _generate_check_yaml() for each metric type                │
├────────────────────────────────────────────────────────────────┤
│ Cell 3: Execute Scan                                           │
│   - Read metadata from SQL DB (pyodbc)                        │
│   - Generate YAML                                              │
│   - Execute Soda scan                                          │
│   - Write results to SQL DB + OneLake                         │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Metadata   │────▶│   Notebook   │────▶│  Fabric DWH     │
│  SQL DB     │     │  (Soda Core) │     │  (Target Data)  │
└─────────────┘     └──────────────┘     └─────────────────┘
      ▲                    │
      │                    ▼
      │            ┌──────────────┐
      └────────────│   Results    │
      (summary)    │   OneLake    │
                   │   (JSON logs)│
                   └──────────────┘
```

---

## Implementation Plan

### Phase 1: Minimal Viable Notebook (MVP)

**Goal:** Execute a single suite and write results

**Cells:**

#### Cell 1: Configuration & Imports

```python
# Install soda-core-fabric (first run only)
# %pip install soda-core-fabric

from soda.scan import Scan
import pyodbc
import json
import uuid
from datetime import datetime

# Configuration
SUITE_ID = 1  # Parameter - passed from Fabric pipeline

# Metadata DB connection
META_DB_SERVER = "your-server.database.fabric.microsoft.com"
META_DB_NAME = "soda_db"

# Target DWH connection (for Soda)
DWH_SERVER = "your-server.datawarehouse.fabric.microsoft.com"
DWH_DATABASE = "sample_dwh"

# OneLake path for JSON logs
ONELAKE_PATH = "/lakehouse/default/Files/dq_logs"
```

#### Cell 2: YAML Generator (Inline)

```python
def generate_yaml_from_checks(checks_df):
    """Generate SodaCL YAML from checks DataFrame.

    Simplified version of Legacy yaml_generator.py.
    Only supports the 20 working metrics.
    """
    yaml_lines = []

    for (schema_name, table_name), table_checks in checks_df.groupby(['schema_name', 'table_name']):
        # Build table identifier
        if schema_name:
            table_id = f"{schema_name}.{table_name}"
        else:
            table_id = table_name

        yaml_lines.append(f"checks for {table_id}:")

        for _, check in table_checks.iterrows():
            check_yaml = _generate_check_yaml(check)
            yaml_lines.extend(check_yaml)

        yaml_lines.append("")  # Blank line between tables

    return "\n".join(yaml_lines)


def _generate_check_yaml(check):
    """Generate YAML lines for a single check."""
    lines = []
    metric = check['metric']
    column = check.get('column_name')

    # Metric line
    if column and metric not in ['row_count', 'freshness', 'schema']:
        lines.append(f"  - {metric}({column}):")
    else:
        lines.append(f"  - {metric}:")

    # Check name with ID for linking
    check_name = f"{check['check_name']} [check_id:{check['check_id']}]"
    lines.append(f'      name: "{check_name}"')

    # Thresholds
    if check.get('warn_threshold'):
        lines.append(f"      warn: when {check['warn_comparison']} {check['warn_threshold']}")
    if check.get('fail_threshold'):
        lines.append(f"      fail: when {check['fail_comparison']} {check['fail_threshold']}")

    return lines
```

#### Cell 3: Execute Scan

```python
def execute_suite(suite_id):
    """Execute all checks in a suite."""
    run_id = str(uuid.uuid4())[:8]
    print(f"Starting scan - Suite: {suite_id}, Run ID: {run_id}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 1: READ METADATA
    # ═══════════════════════════════════════════════════════════════

    conn = pyodbc.connect(
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server={META_DB_SERVER};"
        f"Database={META_DB_NAME};"
        f"Authentication=ActiveDirectoryDefault;"
    )
    cursor = conn.cursor()

    # Create execution log
    cursor.execute("""
        INSERT INTO dq_execution_logs (run_id, suite_id, execution_status, started_at)
        OUTPUT INSERTED.execution_log_id
        VALUES (?, ?, 'running', GETUTCDATE())
    """, (run_id, suite_id))
    execution_log_id = cursor.fetchone()[0]
    conn.commit()

    # Get checks for suite
    import pandas as pd
    checks_df = pd.read_sql("""
        SELECT c.*, tc.schema_name
        FROM vw_checks_complete c
        JOIN suites_testcases st ON c.testcase_id = st.testcase_id
        WHERE st.suite_id = ? AND c.is_enabled = 1
    """, conn, params=[suite_id])

    if checks_df.empty:
        print(f"No enabled checks found for suite {suite_id}")
        return

    print(f"Found {len(checks_df)} checks")

    # Generate YAML
    yaml_content = generate_yaml_from_checks(checks_df)
    print(f"Generated YAML:\n{yaml_content}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 2: EXECUTE SODA SCAN
    # ═══════════════════════════════════════════════════════════════

    # Soda connection config for Fabric DWH
    soda_config = f"""
    data_source fabric_dwh:
      type: fabric
      connection:
        driver: ODBC Driver 18 for SQL Server
        host: {DWH_SERVER}
        database: {DWH_DATABASE}
        authentication: ActiveDirectoryDefault
    """

    scan = Scan()
    scan.set_data_source_name("fabric_dwh")
    scan.set_scan_definition_name(f"suite_{suite_id}_scan_{run_id}")
    scan.add_configuration_yaml_str(soda_config)
    scan.add_sodacl_yaml_str(yaml_content)

    scan.execute()

    scan_results = scan.get_scan_results()
    soda_logs = scan.get_logs_text()

    print(f"Scan complete: {len(scan_results.get('checks', []))} checks executed")

    # ═══════════════════════════════════════════════════════════════
    # STEP 3: WRITE RESULTS
    # ═══════════════════════════════════════════════════════════════

    # 3a. Write individual results to SQL DB
    import re
    for check in scan_results.get('checks', []):
        check_name = check.get('name', '')
        check_id_match = re.search(r'\[check_id:(\d+)\]', check_name)
        check_id = int(check_id_match.group(1)) if check_id_match else 0

        cursor.execute("""
            INSERT INTO dq_results (
                run_id, execution_log_id, check_id, check_name,
                check_outcome, check_value, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, GETUTCDATE())
        """, (
            run_id,
            execution_log_id,
            check_id,
            check_name,
            check.get('outcome', 'unknown'),
            check.get('value')
        ))

    # 3b. Update execution log
    checks = scan_results.get('checks', [])
    passed = len([c for c in checks if c.get('outcome') == 'pass'])
    failed = len([c for c in checks if c.get('outcome') == 'fail'])
    warned = len([c for c in checks if c.get('outcome') == 'warn'])

    cursor.execute("""
        UPDATE dq_execution_logs
        SET execution_status = 'completed',
            completed_at = GETUTCDATE(),
            total_checks = ?,
            checks_passed = ?,
            checks_failed = ?,
            checks_warned = ?,
            generated_yaml = ?
        WHERE execution_log_id = ?
    """, (len(checks), passed, failed, warned, yaml_content, execution_log_id))

    conn.commit()

    # 3c. Write full JSON to OneLake
    full_results = {
        "run_id": run_id,
        "execution_log_id": execution_log_id,
        "suite_id": suite_id,
        "scan_results": scan_results,
        "soda_logs": soda_logs,
        "yaml_content": yaml_content,
        "executed_at": datetime.utcnow().isoformat()
    }

    log_path = f"{ONELAKE_PATH}/execution_{run_id}.json"
    with open(log_path, "w") as f:
        json.dump(full_results, f, indent=2, default=str)

    print(f"Results written to SQL DB and OneLake")
    print(f"Summary: {passed} passed, {failed} failed, {warned} warned")

    conn.close()

    # Return summary
    return {
        "run_id": run_id,
        "suite_id": suite_id,
        "total_checks": len(checks),
        "passed": passed,
        "failed": failed,
        "warned": warned,
        "has_failures": failed > 0
    }


# Execute
result = execute_suite(SUITE_ID)
print(f"\nFinal Result: {result}")

# Optional: Fail pipeline on failures
if result and result.get('has_failures'):
    raise Exception(f"DQ validation failed: {result['failed']} checks failed")
```

---

### Phase 2: Enhanced Features

Add these incrementally:

| Feature | Priority | Complexity |
|---------|----------|------------|
| Service Principal auth | High | Low |
| Multi-schema support | Medium | Medium |
| Advanced metrics (freshness, schema, custom_sql) | High | Medium |
| Tolerance-based thresholds | Low | Low |
| Pipeline integration (parameters) | High | Low |

### Phase 3: Production Hardening

| Feature | Priority |
|---------|----------|
| Error handling with SP calls | High |
| Retry logic for transient failures | Medium |
| Structured logging | Low |
| Unit tests | Medium |

---

## Reusable Code from Legacy

### 100% Reusable (copy with minor cleanup)

1. **YAML Generation Logic** from `yaml_generator.py`:
   - `_generate_check_yaml()` - all metric-specific logic
   - `_generate_freshness_yaml()`
   - `_generate_schema_yaml()`
   - `_generate_scalar_comparison_yaml()`

2. **YAML Helpers** from `yaml_helpers.py`:
   - `yaml_safe_value()`
   - `yaml_safe_filter()`

### Partially Reusable (extract core logic)

1. **Result Storage** from `scan_orchestrator.py`:
   - `_store_results()` - check_id extraction regex
   - `_count_check_outcomes()` - counting logic

---

## Stored Procedures Required

**Minimum for MVP:**

| SP Name | Purpose |
|---------|---------|
| `sp_get_suite_checks` | Get enabled checks for suite execution |
| `sp_create_execution_log` | Create execution log entry |
| `sp_update_execution_log` | Update log with results |
| `sp_insert_result` | Insert individual check result |

**Note:** Can also use direct SQL (INSERT/UPDATE) if SPs not deployed yet.

---

## Connection Methods

### Recommended: `notebookutils.data.connect_to_artifact()` (Simplest)

**Use this method.** No tokens, passwords, or connection strings needed. Fabric handles authentication automatically.

```python
import notebookutils

# Connect to SQL Database artifact by name or ID
conn = notebookutils.data.connect_to_artifact(
    "soda_db-3dbb8254-b235-48a7-b66b-6b321f471b52",  # Database name or ID
    artifact_type="sqldatabase"
)

# Execute queries - returns pandas DataFrame
df = conn.query("SELECT * FROM dq_checks WHERE is_enabled = 1")

# Execute stored procedures
result_df = conn.query("EXEC sp_create_execution_log @run_id='abc', @suite_id=1")
execution_log_id = int(result_df.iloc[0, 0])
```

**Key benefits:**
- No tokens or secrets required
- Fabric handles identity seamlessly
- Works only in Fabric Python notebooks (not PySpark)
- `.query()` method returns pandas DataFrame for any T-SQL

### Alternative: ActiveDirectoryDefault (NOT recommended for Fabric Python)

**Note:** This does NOT work in Fabric Python notebooks. Use `connect_to_artifact()` instead.

```python
# DOES NOT WORK in Fabric Python notebooks!
conn = pyodbc.connect(
    "Driver={ODBC Driver 18 for SQL Server};"
    f"Server={server};"
    f"Database={database};"
    "Authentication=ActiveDirectoryDefault;"  # Fails with "Invalid value" error
)
```

### Alternative: Service Principal (for external scripts only)

Use this only for scripts running outside Fabric (e.g., deployment scripts).

```python
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=TENANT_ID,
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET
)
token = credential.get_token("https://database.windows.net/.default").token

conn = pyodbc.connect(
    "Driver={ODBC Driver 18 for SQL Server};"
    f"Server={server};"
    f"Database={database};"
    f"AccessToken={token};"
)
```

---

## Soda Core Connection to Fabric DWH

Soda Core requires its own connection configuration separate from `notebookutils`.

### Supported Authentication Methods

Based on [Soda Fabric documentation](https://docs.soda.io/data-source-reference/connect-fabric):

| Method | Package | Type | Parameters | Notes |
|--------|---------|------|------------|-------|
| Service Principal | `soda-core-sqlserver` | `sqlserver` | `authentication`, `username`, `password` | **Tested working** |
| Service Principal | `soda-core-fabric` | `fabric` | `authentication`, `client_id`, `client_secret` | **Tested working** |
| Fabric Spark | `soda-core-fabric` | `fabric` | `authentication: fabricspark` | For managed identity |
| Trusted Connection | `soda-core-sqlserver` | `sqlserver` | `trusted_connection: true` | For managed identity |

### Recommended: Service Principal with soda-core-sqlserver

```yaml
data_source fabric_dwh:
  type: sqlserver
  driver: ODBC Driver 18 for SQL Server
  host: <server>.datawarehouse.fabric.microsoft.com
  port: '1433'
  database: <database>
  authentication: ActiveDirectoryServicePrincipal
  username: <client_id>
  password: <client_secret>
  encrypt: true
  trust_server_certificate: false
```

### Alternative: Service Principal with soda-core-fabric

```yaml
data_source fabric_dwh:
  type: fabric
  driver: ODBC Driver 18 for SQL Server
  host: <server>.datawarehouse.fabric.microsoft.com
  database: <database>
  authentication: activedirectoryserviceprincipal
  client_id: <client_id>
  client_secret: <client_secret>
  encrypt: true
```

### Smoke Test Template

Use `src/Notebook/templates/soda_auth_smoke_test.py` to test which authentication methods work in your environment before implementing.

---

## OneLake Integration

### Writing JSON Logs

```python
# Method 1: Direct file write (works in Python notebook)
log_path = "/lakehouse/default/Files/dq_logs/execution_{run_id}.json"
with open(log_path, "w") as f:
    json.dump(results, f, indent=2)

# Method 2: Using notebookutils
import notebookutils
notebookutils.fs.put(log_path, json.dumps(results))
```

### Reading JSON Logs (for dashboards)

```python
# From Spark (if needed for analytics)
df = spark.read.json("Files/dq_logs/*.json")
```

---

## Success Criteria

### MVP Complete When:

1. Notebook executes against Fabric DWH (soda-core-fabric)
2. Reads checks from vw_checks_complete view
3. Generates valid SodaCL YAML
4. Executes Soda scan
5. Writes results to dq_results table
6. Writes JSON logs to OneLake
7. Returns pass/fail status to pipeline

### Production Ready When:

1. All 20 metrics supported
2. Service Principal authentication working
3. Multi-schema execution tested
4. Error handling complete
5. Pipeline integration tested
6. Documentation complete

---

## Timeline (No Estimates - Just Phases)

**Phase 1: MVP**
- Cell 1: Config
- Cell 2: Basic YAML generator
- Cell 3: Execute flow (single schema)

**Phase 2: Full Metrics**
- Add freshness, schema, custom_sql, scalar_comparison
- Add multi-schema support

**Phase 3: Production**
- Service Principal auth
- Error handling SPs
- Pipeline integration

---

## References

- [FABRIC-NOTEBOOK-COMPATIBILITY.md](FABRIC-NOTEBOOK-COMPATIBILITY.md) - Compatibility matrix
- [FABRIC-ARCHITECTURE.md](FABRIC-ARCHITECTURE.md) - Architecture overview
- [Legacy yaml_generator.py](../../Legacy/soda_quality/core/yaml_generator.py) - YAML generation logic
- [Soda Fabric Docs](https://docs.soda.io/soda-v4/reference/data-source-reference-for-soda-core/microsoft-fabric)
